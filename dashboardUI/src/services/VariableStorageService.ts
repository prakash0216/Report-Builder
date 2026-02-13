/**
 * VariableStorageService — High-level layer that decides WHERE to store
 * variable data and provides transparent retrieval.
 *
 * Strategy:
 * ─────────
 * • SMALL data (JSON string < 512 KB or non-tabular):
 *   → Stored in Recoil atom as a JSON string (exactly as before).
 *   → Zero behaviour change for consumers.
 *
 * • LARGE tabular data (array of objects with JSON > 512 KB):
 *   → Stored in DuckDB-WASM (WASM memory, off the V8 heap).
 *   → Recoil atom receives a tiny metadata marker (~100 bytes).
 *   → Consumers detect the marker and fetch from DuckDB-WASM.
 *
 * This prevents the V8 "Snap: Out of Memory" crash while keeping
 * the behaviour identical for every variable under 512 KB.
 */

import BrowserDuckDB from './BrowserDuckDB';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** JSON string length threshold (in characters). 512 KB ≈ 524 288 chars. */
const SIZE_THRESHOLD = 524_288;

/** Marker key used to detect a DuckDB reference inside a Recoil atom. */
export const DUCKDB_REF_KEY = '__duckdb__';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The metadata object stored in the Recoil atom for offloaded variables. */
export interface DuckDBRef {
  __duckdb__: true;
  table: string;
  rows: number;
  columns: string[];
  /** epoch-ms when the variable was last stored */
  ts: number;
}

// ---------------------------------------------------------------------------
// Public helpers (importable without the class)
// ---------------------------------------------------------------------------

/**
 * Synchronous check — is this Recoil atom value a DuckDB reference?
 * Works on both the raw string and an already-parsed object.
 */
export function isDuckDBRef(value: any): value is DuckDBRef {
  if (!value) return false;
  if (typeof value === 'string') {
    // Fast prefix check before parsing
    return value.startsWith(`{"${DUCKDB_REF_KEY}"`);
  }
  return typeof value === 'object' && value[DUCKDB_REF_KEY] === true;
}

/**
 * Parse a raw Recoil atom string into its value.
 * If it's a DuckDB ref, returns the DuckDBRef object.
 * Otherwise behaves like the existing `safeParse`.
 */
export function safeParseVariable(rawValue: string): any {
  if (typeof rawValue === 'string' && /^[\d,]+$/.test(rawValue)) {
    return rawValue; // formatted number
  }
  try {
    return JSON.parse(rawValue);
  } catch {
    return rawValue;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class VariableStorageService {
  // ---- singleton ----
  private static instance: VariableStorageService;
  static getInstance(): VariableStorageService {
    if (!VariableStorageService.instance) {
      VariableStorageService.instance = new VariableStorageService();
    }
    return VariableStorageService.instance;
  }

  private duckdb = BrowserDuckDB.getInstance();

  private constructor() {}

  // ---- public API ----

  /**
   * Store a variable. Returns the string to put into the Recoil atom.
   *
   * @returns recoilValue — the string to `set(variableAtomFamily(name), …)`
   */
  async storeVariable(
    name: string,
    value: any
  ): Promise<{ recoilValue: string; offloaded: boolean }> {
    const jsonString = typeof value === 'string' ? value : JSON.stringify(value);

    // Determine if we should offload
    const parsedValue = typeof value === 'string' ? safeParseVariable(value) : value;
    const shouldOffload = this.shouldOffloadToDuckDB(parsedValue, jsonString);

    if (shouldOffload && this.duckdb.isReady()) {
      try {
        const data = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
        const meta = await this.duckdb.storeVariable(name, data);

        // Build the lightweight reference for the Recoil atom
        const ref: DuckDBRef = {
          __duckdb__: true,
          table: `var_${name.replace(/[^a-zA-Z0-9_]/g, '_')}`,
          rows: meta.rows,
          columns: meta.columns,
          ts: Date.now(),
        };
        return { recoilValue: JSON.stringify(ref), offloaded: true };
      } catch (err) {
        console.warn(
          `[VariableStorage] DuckDB-WASM store failed for "${name}", falling back to Recoil:`,
          err
        );
        // Fall through to Recoil-only
      }
    }

    // For DuckDB-WASM not ready or if we shouldn't offload (or offload failed):
    // Also opportunistically store in DuckDB-WASM (non-blocking) for future use,
    // but DON'T change the Recoil value (keep full JSON for backward compat)
    if (
      this.duckdb.isReady() &&
      Array.isArray(parsedValue) &&
      parsedValue.length > 0 &&
      typeof parsedValue[0] === 'object' &&
      parsedValue[0] !== null &&
      !Array.isArray(parsedValue[0])
    ) {
      // Fire-and-forget: store a copy in DuckDB for future querying
      this.duckdb.storeVariable(name, parsedValue).catch(() => {});
    }

    return { recoilValue: jsonString, offloaded: false };
  }

  /**
   * Resolve a variable's value. If the Recoil value is a DuckDB reference,
   * fetches the full data from DuckDB-WASM. Otherwise parses normally.
   */
  async resolveVariable(recoilRawValue: string): Promise<any> {
    const parsed = safeParseVariable(recoilRawValue);

    if (isDuckDBRef(parsed)) {
      try {
        // Extract variable name from the table name
        const varName = parsed.table.replace(/^var_/, '');
        return await this.duckdb.getVariable(varName);
      } catch (err) {
        console.warn('[VariableStorage] Failed to resolve DuckDB ref:', err);
        return parsed; // return the metadata object as fallback
      }
    }

    return parsed;
  }

  /**
   * Resolve a variable by name (reads DuckDB-WASM directly if available,
   * otherwise caller must provide the Recoil atom value).
   */
  async resolveVariableByName(name: string, recoilRawValue: string): Promise<any> {
    const parsed = safeParseVariable(recoilRawValue);

    if (isDuckDBRef(parsed)) {
      try {
        return await this.duckdb.getVariable(name);
      } catch (err) {
        console.warn(`[VariableStorage] Failed to resolve "${name}" from DuckDB:`, err);
        return parsed;
      }
    }

    return parsed;
  }

  /**
   * Drop a variable from DuckDB-WASM (e.g. when a logic is deleted).
   */
  async dropVariable(name: string): Promise<void> {
    if (this.duckdb.isReady()) {
      await this.duckdb.dropVariable(name);
    }
  }

  /**
   * Check whether DuckDB-WASM is operational.
   */
  isAvailable(): boolean {
    return this.duckdb.isReady() && !this.duckdb.hasFailed();
  }

  // ---- internal ----

  /**
   * Should this value be offloaded to DuckDB-WASM?
   * Criteria:
   *   1. JSON string > SIZE_THRESHOLD (512 KB)
   *   2. Value is an array of objects (tabular data)
   */
  private shouldOffloadToDuckDB(parsedValue: any, jsonString: string): boolean {
    if (jsonString.length < SIZE_THRESHOLD) return false;
    if (!Array.isArray(parsedValue)) return false;
    if (parsedValue.length === 0) return false;
    const firstItem = parsedValue[0];
    if (typeof firstItem !== 'object' || firstItem === null || Array.isArray(firstItem))
      return false;
    return true;
  }
}

export default VariableStorageService;

