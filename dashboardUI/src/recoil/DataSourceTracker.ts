import { atom } from 'recoil';
import { localStorageEffect } from './persistence';

// Atom to track all data source names
export const dataSourceNamesState = atom<string[]>({
  key: 'dataSourceNamesState',
  default: [], // Start with some default data sources
  effects: [
    localStorageEffect('dataSourceNames')
]
});

// Optional: Atom to track when data sources are updated (for triggering re-renders)
export const dataSourceUpdateTriggerState = atom<number>({
  key: 'dataSourceUpdateTriggerState', 
  default: 0,
  effects: [
    localStorageEffect('dataSourceUpdateTrigger')
]
});