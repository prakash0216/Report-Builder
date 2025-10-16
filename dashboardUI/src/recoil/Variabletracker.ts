// Create this file: recoil/VariableTracker.ts
import { atom } from 'recoil';
import { localStorageEffect,localStorageSetEffect } from './persistence';

// Atom to track all variable names that have been created
export const variableNamesState = atom<Set<string>>({
  key: 'variableNamesState',
  default: new Set<string>(),
//   effects: [
//     localStorageSetEffect('variableNames')
// ]
});

// Atom to track variable updates for reactivity
export const variableUpdateTriggerState = atom<number>({
  key: 'variableUpdateTriggerState',
  default: 0,
//   effects: [
//     localStorageEffect('variableUpdateTrigger')
// ]
});