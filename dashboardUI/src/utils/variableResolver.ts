/**
 * variableResolver.ts — Shared utilities for resolving DuckDB-backed variables
 * in chart / HTML / card templates.
 *
 * KEY DESIGN PRINCIPLE:
 *   Only the variables that a template actually references are fetched from
 *   DuckDB-WASM. This prevents loading all 100K-row datasets into JS memory
 *   just because they exist — only the data a chart/card needs enters the V8
 *   heap, and it is garbage-collected after template substitution.
 */

import VariableStorageService, { isDuckDBRef } from '../services/VariableStorageService';

// ---------------------------------------------------------------------------
// Extract referenced variable names from a template string
// ---------------------------------------------------------------------------

/** Regex that matches  ${varName}  and  {{varName}}  patterns. */
const VAR_PATTERN = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;

/**
 * Scan a template string and return the set of variable names it references.
 * Cheap — no DuckDB or Recoil calls, pure regex.
 */
export function extractReferencedVariables(template: string): Set<string> {
  const names = new Set<string>();
  if (!template) return names;

  let match: RegExpExecArray | null;
  // Reset lastIndex in case the regex was used before
  VAR_PATTERN.lastIndex = 0;
  while ((match = VAR_PATTERN.exec(template)) !== null) {
    const name = match[1] || match[2];
    if (name) names.add(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Resolve only the variables a template needs
// ---------------------------------------------------------------------------

/**
 * Given a set of variable names and the "raw" variables map (which may contain
 * DuckDB ref objects for offloaded data), resolve ONLY the listed names.
 *
 * Small variables are returned as-is (already parsed JS values).
 * DuckDB-backed variables are fetched from WASM memory on demand.
 *
 * @param neededNames   Variable names the caller actually needs.
 * @param allVariables  The full {name → parsedValue | DuckDBRef} map.
 * @returns             A map containing only `neededNames` with real values.
 */
export async function resolveNeededVariables(
  neededNames: Set<string>,
  allVariables: Record<string, any>
): Promise<Record<string, any>> {
  if (neededNames.size === 0) return {};

  const varStorage = VariableStorageService.getInstance();
  const resolved: Record<string, any> = {};

  // Collect async resolution promises in parallel for speed
  const promises: Array<Promise<void>> = [];

  for (const name of Array.from(neededNames)) {
    if (!(name in allVariables)) continue;

    const value = allVariables[name];

    if (isDuckDBRef(value)) {
      // Schedule async DuckDB resolution
      promises.push(
        varStorage
          .resolveVariableByName(name, JSON.stringify(value))
          .then((resolvedVal) => {
            resolved[name] = resolvedVal;
          })
          .catch((err) => {
            console.warn(`[variableResolver] Failed to resolve DuckDB ref "${name}":`, err);
            // Fallback: keep the ref object (chart will get a metadata object instead
            // of real data — better than crashing)
            resolved[name] = value;
          })
      );
    } else {
      resolved[name] = value;
    }
  }

  // Wait for all DuckDB queries to finish in parallel
  if (promises.length > 0) {
    await Promise.all(promises);
  }

  return resolved;
}

// ---------------------------------------------------------------------------
// Async template replacement (chart JSON / HTML)
// ---------------------------------------------------------------------------

/**
 * Async version of `replaceVariableReferences`.
 *
 * 1. Scans the template for referenced variable names.
 * 2. Resolves ONLY those variables from the `allVariables` map (DuckDB refs are
 *    fetched from WASM memory).
 * 3. Performs the same `${varName}` / `{{varName}}` substitution as before.
 *
 * This means a chart that only uses `${totalRevenue}` (a 10-byte scalar)
 * will **not** cause a 100K-row DuckDB ref to be loaded into JS memory.
 */
export async function replaceVariableReferencesAsync(
  template: string,
  allVariables: Record<string, any>
): Promise<string> {
  if (!template) return template;

  // 1. Find which variables the template actually uses
  const referencedNames = extractReferencedVariables(template);
  if (referencedNames.size === 0) return template;

  // 2. Resolve only those variables
  const resolved = await resolveNeededVariables(referencedNames, allVariables);

  // 3. Substitute (same logic as the existing sync function)
  let result = template;

  for (const [name, value] of Object.entries(resolved)) {
    const isFormattedNumber = typeof value === 'string' && /^[\d,]+$/.test(value);

    let replacement: string;
    if (isFormattedNumber) {
      replacement = value;
    } else {
      replacement = JSON.stringify(value);
    }

    // Replace in JSON context: "${variableName}"
    result = result.replace(new RegExp(`"\\$\\{${escapeRegex(name)}\\}"`, 'g'), replacement);

    // Replace in HTML/unquoted context: ${variableName}
    result = result.replace(new RegExp(`\\$\\{${escapeRegex(name)}\\}`, 'g'), replacement);

    // Replace {{variableName}} pattern (HTML cards)
    result = result.replace(
      new RegExp(`\\{\\{${escapeRegex(name)}\\}\\}`, 'g'),
      typeof value === 'object' ? JSON.stringify(value) : String(value)
    );
  }

  // Clean up any unreplaced patterns (variables not loaded yet)
  result = result.replace(/\$\{[^}]+\}/g, 'null');
  result = result.replace(/\{\{[^}]+\}\}/g, '""');

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape special regex characters in a variable name. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

