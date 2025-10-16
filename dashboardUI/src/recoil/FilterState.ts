import { atom } from 'recoil';
import { localStorageEffect } from './persistence';

export interface FilterConfig {
  id: string;
  category: string;
  paramName: string;
  displayName: string;
  variableName: string;
  selectionType: 'single' | 'multi';
  defaultValues: (string | number)[];
  availableOptions: (string | number)[];
}

// Single atom storing all filters as Record<filterId, FilterConfig>
export const allFiltersAtom = atom<Record<string, FilterConfig>>({
  key: 'allFiltersAtom',
  default: {},
  effects: [
    localStorageEffect('allFilters')
  ]
});
