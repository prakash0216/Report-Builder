// recoil/storedLogics.js
import { atom, atomFamily, selector } from 'recoil';
import axios from 'axios';

import { API_BASE_URL } from '../config/api.config';

// Interface for stored logic (matches database schema)
export interface StoredLogic {
  id: string;
  variableName: string;
  logic: string;
  createdAt: number;
  lastExecuted?: number;
}

// Database calculation interface (from API)
interface DbCalculation {
  id: number;
  variable_name: string;
  logic: string;
  created_at: string;
  last_executed: string | null;
}

// Convert database format to StoredLogic format
function dbToStoredLogic(dbCalc: DbCalculation): StoredLogic {
  return {
    id: dbCalc.id.toString(),
    variableName: dbCalc.variable_name,
    logic: dbCalc.logic,
    createdAt: new Date(dbCalc.created_at).getTime(),
    lastExecuted: dbCalc.last_executed ? new Date(dbCalc.last_executed).getTime() : undefined,
  };
}

// Custom effect for syncing calculations with database
// Note: DataInitializer loads calculations at startup, so this effect is disabled
// to avoid duplicate API calls and race conditions
const calculationsDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Skip loading - DataInitializer handles this to avoid duplicate API calls
  // Calculations are loaded by DataInitializer from /api/calculations endpoint

  // Note: Individual calculation additions/updates/deletes are handled via API calls in components
  // This effect is primarily for loading the initial state
};

// Main atom to store all logics
export const storedLogicsState = atom<StoredLogic[]>({
  key: 'storedLogicsState',
  default: [],
  effects: [
    calculationsDbEffect
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
// export const logicsNeedingRecalculationSelector = selector({
//   key: 'logicsNeedingRecalculationSelector',
//   get: ({ get }) => {
//     const logics = get(storedLogicsState);
    
//     // Return logics that reference topN in their logic string
//     return logics.filter(logic => 
//       logic.logic.includes('topN') && 
//       (!logic.lastExecuted || Date.now() - logic.lastExecuted > 1000) // Prevent rapid re-execution
//     );
//   },
// });