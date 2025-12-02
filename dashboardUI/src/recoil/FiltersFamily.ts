import { atomFamily, atom, selector } from 'recoil';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

export interface DefaultValueOption {
    label: string;
    value: string | number;
}

export interface FilterConfig {
    id: string;
    category: string;
    paramName: string;
    displayName: string;
    variableName: string;
    selectionType: 'single' | 'multi';
    defaultValues: DefaultValueOption[];
    availableOptions: DefaultValueOption[];
    dsName?: string | undefined;
    labelIndex?:number;
    valueIndex?:number;
    labelKey?:string;
    valuekey?:string;
}

// Database filter interface (from API)
interface DbFilter {
  id: number;
  variable_name: string;
  category: string;
  param_name: string;
  display_name: string;
  selection_type: string;
  ds_name: string | null;
  label_index: number | null;
  value_index: number | null;
  label_key: string | null;
  value_key: string | null;
  available_options_json: string;
  default_values_json: string;
  last_modified: string | null;
}

// Convert database format to FilterConfig format
function dbToFilterConfig(dbFilter: DbFilter): FilterConfig {
  return {
    id: dbFilter.id.toString(),
    category: dbFilter.category,
    paramName: dbFilter.param_name,
    displayName: dbFilter.display_name,
    variableName: dbFilter.variable_name,
    selectionType: dbFilter.selection_type as 'single' | 'multi',
    defaultValues: JSON.parse(dbFilter.default_values_json),
    availableOptions: JSON.parse(dbFilter.available_options_json),
    dsName: dbFilter.ds_name || undefined,
    labelIndex: dbFilter.label_index ?? undefined,
    valueIndex: dbFilter.value_index ?? undefined,
    labelKey: dbFilter.label_key || undefined,
    valuekey: dbFilter.value_key || undefined,
  };
}

// Custom effect for syncing filter config with database
// Note: DataInitializer loads all filters at startup, so this effect is a fallback
// for filters accessed before DataInitializer completes or for dynamically added filters
const filterConfigDbEffect = (variableName: string) => ({ setSelf, onSet, trigger }: any) => {
  // Skip loading - DataInitializer handles this to avoid duplicate API calls
  // Individual filter data is loaded by DataInitializer from the main /api/filters endpoint
  // This prevents N+1 API calls (one for each filter)
  
  // Note: Individual filter save/update/delete operations are handled via API calls in components
  // This effect is primarily for loading the initial state
  // We don't auto-save on every change to avoid too many API calls
};

// Key: variableName (string)
// Value: FilterConfig object
export const filterConfigFamily = atomFamily<FilterConfig | null, string>({
    key: 'filterConfigFamily',
    default: null, // Default is null or an empty config object
    effects: (variableName) => [
        filterConfigDbEffect(variableName)
    ],
});

// Custom effect for syncing filter names with database
// Note: DataInitializer loads filter names at startup, so this effect is a fallback
const filterNamesDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Skip loading - DataInitializer handles this to avoid duplicate API calls
  // Filter names are loaded by DataInitializer from the main /api/filters endpoint

  // Note: Individual filter additions/removals are handled via API calls in components
  // This effect is primarily for loading the initial state
};

// --- Atom: Stores the list of all filter variable names (keys) ---
export const filterNamesState = atom<string[]>({
    key: 'filterNamesState',
    default: [],
    effects: [
        filterNamesDbEffect
    ],
});

// --- Selector: Reconstructs the map of all filters---
// This selector reads the list of names and then retrieves the config for each using the family.
export const allFiltersSelector = selector<Record<string, FilterConfig>>({
    key: 'allFiltersSelector',
    get: ({ get }) => {
        const names = get(filterNamesState);
        const allFilters: Record<string, FilterConfig> = {};
        
        names.forEach(name => {
            const config = get(filterConfigFamily(name));
            if (config) {
                allFilters[name] = config;
            }
        });

        return allFilters;
    },
});
