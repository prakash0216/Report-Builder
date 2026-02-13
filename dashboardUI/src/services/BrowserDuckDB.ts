/**
 * BrowserDuckDB — Singleton service for DuckDB-WASM in the browser.
 *
 * Stores large variable data in WASM linear memory (off the V8 heap)
 * to prevent "Snap: Out of Memory" errors. DuckDB-WASM runs in a Web
 * Worker so the main UI thread is never blocked.
 *
 * Usage:
 *   const db = BrowserDuckDB.getInstance();
 *   await db.init();                               // one-time (idempotent)
 *   await db.storeVariable('rawData', arrayOfObjects);
 *   const rows = await db.getVariable('rawData');   // returns plain JS objects
 */

import * as duckdb from '@duckdb/duckdb-wasm';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sanitise a variable name into a valid SQL identifier. */
const toTableName = (varName: string): string =>
  `var_${varName.replace(/[^a-zA-Z0-9_]/g, '_')}`;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

class BrowserDuckDB {
  // ---- singleton plumbing ----
  private static instance: BrowserDuckDB;
  static getInstance(): BrowserDuckDB {
    if (!BrowserDuckDB.instance) {
      BrowserDuckDB.instance = new BrowserDuckDB();
    }
    return BrowserDuckDB.instance;
  }

  // ---- internal state ----
  private db: duckdb.AsyncDuckDB | null = null;
  private conn: duckdb.AsyncDuckDBConnection | null = null;
  private initPromise: Promise<void> | null = null;
  private ready = false;
  private initFailed = false;
  private opfsEnabled = false; // Whether OPFS persistence is active

  private constructor() {
    // Start initialization eagerly so it overlaps with React hydration
    this.initPromise = this._init();
  }

  // ---- public API ----

  /** Whether DuckDB-WASM is initialised and ready to use. */
  isReady(): boolean {
    return this.ready;
  }

  /** Whether initialisation failed (CDN blocked, old browser, etc.). */
  hasFailed(): boolean {
    return this.initFailed;
  }

  /** Whether OPFS persistence is active. */
  isOPFSEnabled(): boolean {
    return this.opfsEnabled;
  }

  /** Await initialisation (idempotent — safe to call multiple times). */
  async init(): Promise<void> {
    if (this.ready) return;
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._init();
    return this.initPromise;
  }

  /**
   * Store an array-of-objects as a DuckDB table in WASM memory.
   * Existing table for the same variable is replaced.
   */
  async storeVariable(name: string, data: any[]): Promise<{ rows: number; columns: string[] }> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    const t0 = performance.now();

    // Serialise to JSON and register as a virtual file so DuckDB's
    // native (C++) JSON reader can parse it — much faster than row-by-row
    // INSERT statements and the data goes straight to WASM memory.
    const jsonString = JSON.stringify(data);
    const fileName = `${tableName}.json`;

    await this.db!.registerFileText(fileName, jsonString);

    try {
      await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
      await conn.query(
        `CREATE TABLE "${tableName}" AS SELECT * FROM read_json_auto('${fileName}')`
      );
    } finally {
      // Always clean up the virtual file even if the CREATE fails
      try { await this.db!.dropFile(fileName); } catch { /* ignore */ }
    }

    // Fetch metadata to return to caller
    const countResult = await conn.query(`SELECT count(*)::INTEGER as cnt FROM "${tableName}"`);
    const rowCount = countResult.get(0)?.cnt ?? data.length;

    const colResult = await conn.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`
    );
    const columns: string[] = [];
    for (let i = 0; i < colResult.numRows; i++) {
      columns.push(String(colResult.get(i)?.column_name ?? ''));
    }

    const ms = (performance.now() - t0).toFixed(0);
    console.log(
      `🦆 [DuckDB-WASM] Stored "${name}" → ${rowCount} rows × ${columns.length} cols in ${ms}ms`
    );

    // Flush to OPFS so the data survives browser refresh
    if (this.opfsEnabled) {
      this.flushToOPFS().catch(() => {}); // fire-and-forget
    }

    return { rows: rowCount, columns };
  }

  /** Retrieve ALL rows of a stored variable as plain JS objects. */
  async getVariable(name: string): Promise<any[]> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    const result = await conn.query(`SELECT * FROM "${tableName}"`);
    return this.arrowToObjects(result);
  }

  /** Retrieve a page of rows (for table pagination). */
  async getVariablePage(
    name: string,
    offset: number,
    limit: number
  ): Promise<any[]> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    const result = await conn.query(
      `SELECT * FROM "${tableName}" LIMIT ${limit} OFFSET ${offset}`
    );
    return this.arrowToObjects(result);
  }

  /** Get metadata (row count + column names) without loading data into JS. */
  async getVariableMeta(
    name: string
  ): Promise<{ rows: number; columns: string[] } | null> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    try {
      const countResult = await conn.query(
        `SELECT count(*)::INTEGER as cnt FROM "${tableName}"`
      );
      const rows = countResult.get(0)?.cnt ?? 0;

      const colResult = await conn.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName}' ORDER BY ordinal_position`
      );
      const columns: string[] = [];
      for (let i = 0; i < colResult.numRows; i++) {
        columns.push(String(colResult.get(i)?.column_name ?? ''));
      }
      return { rows, columns };
    } catch {
      return null;
    }
  }

  /** Check whether a variable is stored in DuckDB-WASM. */
  async hasVariable(name: string): Promise<boolean> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    try {
      const result = await conn.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = '${tableName}' LIMIT 1`
      );
      return result.numRows > 0;
    } catch {
      return false;
    }
  }

  /** Drop a variable's table from DuckDB-WASM. */
  async dropVariable(name: string): Promise<void> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    try {
      await conn.query(`DROP TABLE IF EXISTS "${tableName}"`);
      console.log(`🦆 [DuckDB-WASM] Dropped table for "${name}"`);
    } catch (err) {
      console.warn(`[DuckDB-WASM] Failed to drop "${name}":`, err);
    }
  }

  /**
   * Query a stored variable with optional sorting and pagination.
   * All processing happens inside WASM — only the requested slice enters JS.
   */
  async queryVariable(
    name: string,
    options: {
      offset?: number;
      limit?: number;
      orderBy?: string;
      orderDirection?: 'ASC' | 'DESC';
    } = {}
  ): Promise<any[]> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    let sql = `SELECT * FROM "${tableName}"`;

    if (options.orderBy) {
      // Sanitise column name to prevent injection
      const safeCol = options.orderBy.replace(/[^a-zA-Z0-9_ ]/g, '');
      sql += ` ORDER BY "${safeCol}" ${options.orderDirection === 'DESC' ? 'DESC' : 'ASC'}`;
    }
    if (options.limit !== undefined) {
      sql += ` LIMIT ${Math.max(0, Math.floor(options.limit))}`;
    }
    if (options.offset !== undefined) {
      sql += ` OFFSET ${Math.max(0, Math.floor(options.offset))}`;
    }

    const result = await conn.query(sql);
    return this.arrowToObjects(result);
  }

  /**
   * Run aggregate calculations on a variable entirely inside DuckDB-WASM.
   * Returns one value per (column, aggregation) pair without loading rows into JS.
   */
  async getVariableAggregates(
    name: string,
    aggregations: Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'>
  ): Promise<Record<string, number | null>> {
    await this.ensureReady();
    const conn = this.conn!;
    const tableName = toTableName(name);

    const selectParts: string[] = [];
    const aliasMap: string[] = []; // keep track of aliases

    for (const [col, agg] of Object.entries(aggregations)) {
      const safeCol = col.replace(/[^a-zA-Z0-9_ ]/g, '');
      const alias = `${safeCol}__${agg}`;
      switch (agg) {
        case 'sum':
          selectParts.push(`SUM(TRY_CAST("${safeCol}" AS DOUBLE))::DOUBLE AS "${alias}"`);
          break;
        case 'avg':
          selectParts.push(`AVG(TRY_CAST("${safeCol}" AS DOUBLE))::DOUBLE AS "${alias}"`);
          break;
        case 'min':
          selectParts.push(`MIN(TRY_CAST("${safeCol}" AS DOUBLE))::DOUBLE AS "${alias}"`);
          break;
        case 'max':
          selectParts.push(`MAX(TRY_CAST("${safeCol}" AS DOUBLE))::DOUBLE AS "${alias}"`);
          break;
        case 'count':
          selectParts.push(`COUNT("${safeCol}")::INTEGER AS "${alias}"`);
          break;
      }
      aliasMap.push(alias);
    }

    if (selectParts.length === 0) return {};

    const sql = `SELECT ${selectParts.join(', ')} FROM "${tableName}"`;
    const result = await conn.query(sql);
    const row = this.arrowToObjects(result)[0] || {};

    // Flatten {col__agg: value} → {col: value}
    const out: Record<string, number | null> = {};
    for (const [col, agg] of Object.entries(aggregations)) {
      const safeCol = col.replace(/[^a-zA-Z0-9_ ]/g, '');
      const alias = `${safeCol}__${agg}`;
      const v = row[alias];
      out[col] = v !== undefined && v !== null ? Number(v) : null;
    }
    return out;
  }

  /** Get a list of all variable table names currently stored in DuckDB-WASM. */
  async getStoredVariableNames(): Promise<string[]> {
    await this.ensureReady();
    const conn = this.conn!;

    try {
      const result = await conn.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name LIKE 'var_%'`
      );
      const names: string[] = [];
      for (let i = 0; i < result.numRows; i++) {
        const tName = String(result.get(i)?.table_name ?? '');
        // Convert var_xxx back to the original variable name
        names.push(tName.replace(/^var_/, ''));
      }
      return names;
    } catch {
      return [];
    }
  }

  /** Drop ALL variable tables from DuckDB-WASM (cache clear). */
  async clearAllVariables(): Promise<void> {
    await this.ensureReady();
    const conn = this.conn!;

    try {
      const storedNames = await this.getStoredVariableNames();
      for (const name of storedNames) {
        await conn.query(`DROP TABLE IF EXISTS "var_${name}"`);
      }
      console.log(`🦆 [DuckDB-WASM] Cleared all ${storedNames.length} variable tables`);
    } catch (err) {
      console.warn('[DuckDB-WASM] Failed to clear all variables:', err);
    }
  }

  // ------------------------------------------------------------------
  // Internal
  // ------------------------------------------------------------------

  private async _init(): Promise<void> {
    try {
      const t0 = performance.now();
      console.log('🦆 [DuckDB-WASM] Initializing...');

      // Use jsDelivr CDN — no webpack config changes needed for CRA
      const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

      // Create a Web Worker from the CDN bundle
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], {
          type: 'text/javascript',
        })
      );
      const worker = new Worker(workerUrl);
      const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);

      this.db = new duckdb.AsyncDuckDB(logger, worker);
      await this.db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);

      // ---- OPFS Persistence ----
      // Check if the browser supports OPFS (Origin Private File System).
      // When available, DuckDB-WASM persists data to disk-backed storage,
      // surviving browser refresh without re-running calculations.
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).storage?.getDirectory) {
          const opfsRoot = await (navigator as any).storage.getDirectory();
          if (opfsRoot) {
            // Register OPFS with DuckDB-WASM so tables persist across page loads
            await this.db.open({
              path: 'dashboard.duckdb',
              accessMode: duckdb.DuckDBAccessMode.READ_WRITE,
            });
            this.opfsEnabled = true;
            console.log('🦆 [DuckDB-WASM] OPFS persistence enabled — data survives refresh');
          }
        }
      } catch (opfsErr) {
        console.warn('🦆 [DuckDB-WASM] OPFS not available, using in-memory mode:', opfsErr);
        this.opfsEnabled = false;
      }

      // Open a persistent connection
      this.conn = await this.db.connect();

      this.ready = true;
      const ms = (performance.now() - t0).toFixed(0);
      console.log(`🦆 [DuckDB-WASM] Ready in ${ms}ms (OPFS: ${this.opfsEnabled ? 'ON' : 'OFF'})`);
    } catch (err) {
      console.error('🦆 [DuckDB-WASM] Initialization FAILED — falling back to Recoil-only mode:', err);
      this.initFailed = true;
      this.ready = false;
    }
  }

  /**
   * Flush the DuckDB-WASM database to OPFS.
   * This is a no-op if OPFS is not enabled.
   * Call this after storing variables to ensure they persist.
   */
  async flushToOPFS(): Promise<void> {
    if (!this.opfsEnabled || !this.db) return;
    try {
      // DuckDB-WASM's flushFiles() writes any dirty pages to OPFS
      await this.db.flushFiles();
      console.log('🦆 [DuckDB-WASM] Flushed to OPFS');
    } catch (err) {
      console.warn('[DuckDB-WASM] OPFS flush failed:', err);
    }
  }

  /**
   * Clear all OPFS persistence data.
   * Useful when the user logs out or switches dashboards.
   */
  async clearOPFS(): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).storage?.getDirectory) {
        const root = await (navigator as any).storage.getDirectory();
        // Remove the DuckDB database file from OPFS
        try { await root.removeEntry('dashboard.duckdb', { recursive: true }); } catch { /* file may not exist */ }
        try { await root.removeEntry('dashboard.duckdb.wal', { recursive: true }); } catch { /* wal may not exist */ }
        console.log('🦆 [DuckDB-WASM] OPFS storage cleared');
      }
    } catch (err) {
      console.warn('[DuckDB-WASM] Failed to clear OPFS:', err);
    }
  }

  /** Await initialisation; throw if it failed. */
  private async ensureReady(): Promise<void> {
    if (this.ready) return;
    if (this.initFailed) {
      throw new Error('DuckDB-WASM initialization failed');
    }
    await this.init();
    if (!this.ready) {
      throw new Error('DuckDB-WASM not ready');
    }
  }

  /**
   * Convert an Apache Arrow Table to an array of plain JS objects.
   * Uses column-oriented access for efficiency.
   */
  private arrowToObjects(table: any): any[] {
    const fields: { name: string }[] = table.schema.fields;
    const numRows: number = table.numRows;

    if (numRows === 0) return [];

    const colNames = fields.map((f) => f.name);

    // Pre-fetch column vectors once (avoid repeated getChild calls)
    const vectors: any[] = colNames.map((c) => table.getChild(c));

    const result: any[] = new Array(numRows);
    for (let i = 0; i < numRows; i++) {
      const row: Record<string, any> = {};
      for (let c = 0; c < colNames.length; c++) {
        const val = vectors[c]?.get(i);
        // Arrow BigInt → JS number (safe for ints < 2^53)
        row[colNames[c]] = typeof val === 'bigint' ? Number(val) : val;
      }
      result[i] = row;
    }
    return result;
  }
}

export default BrowserDuckDB;

