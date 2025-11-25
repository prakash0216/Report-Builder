// recoil/storedLogics.js
import { atom, atomFamily, selector } from 'recoil';
import { localStorageEffect } from './persistence';

// Interface for stored logic
export interface StoredLogic {
  id: string;
  variableName: string;
  logic: string;
  createdAt: number;
  lastExecuted?: number;
}

// Main atom to store all logics
export const storedLogicsState = atom<StoredLogic[]>({
  key: 'storedLogicsState',
  default: [],
  effects: [
    localStorageEffect<StoredLogic[]>('storedLogicsState')
  ],
});

// Atom family for individual logic management (if needed)
// export const storedLogicAtomFamily = atomFamily<StoredLogic | null, string>({
//   key: 'storedLogicAtomFamily',
//   default: null,
// });

// Selector to get logics count
export const storedLogicsCountState = selector({
  key: 'storedLogicsCountState',
  get: ({ get }) => {
    const logics = get(storedLogicsState);
    return logics.length;
  },
});

// Selector to get logics by variable name
export const logicsByVariableSelector = selector({
  key: 'logicsByVariableSelector',
  get: ({ get }) => {
    const logics = get(storedLogicsState);
    return logics.reduce((acc, logic) => {
      acc[logic.variableName] = logic;
      return acc;
    }, {} as Record<string, StoredLogic>);
  },
});

// Helper selectors for common operations
export const logicsNeedingRecalculationSelector = selector({
  key: 'logicsNeedingRecalculationSelector',
  get: ({ get }) => {
    const logics = get(storedLogicsState);
    
    // Return logics that reference topN in their logic string
    return logics.filter(logic => 
      logic.logic.includes('topN') && 
      (!logic.lastExecuted || Date.now() - logic.lastExecuted > 1000) // Prevent rapid re-execution
    );
  },
});