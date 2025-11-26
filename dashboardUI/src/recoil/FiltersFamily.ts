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
const filterConfigDbEffect = (variableName: string) => ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get' && variableName) {
    axios.get(`${API_BASE_URL}/api/filters/${variableName}`)
      .then(response => {
        if (response.data.success && response.data.filter) {
          const filterConfig = dbToFilterConfig(response.data.filter);
          setSelf(filterConfig);
        }
      })
      .catch(error => {
        // 404 is expected if filter doesn't exist yet
        if (error.response?.status !== 404) {
          console.error(`❌ Error loading filter ${variableName} from database:`, error);
        }
        // Keep default value (null) on error
      });
  }

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
const filterNamesDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/filters`)
      .then(response => {
        if (response.data.success && response.data.filters) {
          const filterNames = response.data.filters.map((f: DbFilter) => f.variable_name);
          setSelf(filterNames);
          console.log('✅ Loaded filter names from database:', filterNames.length);
        }
      })
      .catch(error => {
        console.error('❌ Error loading filter names from database:', error);
        // Keep default value on error
      });
  }

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
