import { atomFamily, atom, selector } from 'recoil';
import { localStorageEffect } from './persistence';

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

// Key: variableName (string)
// Value: FilterConfig object
export const filterConfigFamily = atomFamily<FilterConfig | null, string>({
    key: 'filterConfigFamily',
    default: null, // Default is null or an empty config object
    effects: (variableName) => [
        // The effect now saves/loads a single config object by its unique variable name
        localStorageEffect(`filterConfig_${variableName}`),
    ],
});

// --- Atom: Stores the list of all filter variable names (keys) ---
export const filterNamesState = atom<string[]>({
    key: 'filterNamesState',
    default: [],
    effects: [
        localStorageEffect('filterVariableNames'),
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
