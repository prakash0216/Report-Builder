import { atomFamily } from "recoil";

/**
 * Core Recoil atom for variable data.
 *
 * For SMALL variables:  stores the full JSON string (same as before).
 * For LARGE variables:  stores a lightweight DuckDB-WASM metadata marker.
 *                        Consumers detect the marker with isDuckDBRef()
 *                        and resolve via VariableStorageService.
 */
export const variableAtomFamily = atomFamily<string, string>({
  key: 'variableAtomFamily',
  default: '',
});

// Re-export helpers so existing consumers can import from this file
export { isDuckDBRef, type DuckDBRef } from '../services/VariableStorageService';
