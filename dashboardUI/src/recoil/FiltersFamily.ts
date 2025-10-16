import { atomFamily } from "recoil";
import { localStorageEffect } from "./persistence";

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
  

export const FiltersFamily = atomFamily<string,string>({
    key: 'filtersAtomFamily',
    default: '',
    effects: (param) => [
      localStorageEffect(`filter_${param}`)
  ]
  });
  