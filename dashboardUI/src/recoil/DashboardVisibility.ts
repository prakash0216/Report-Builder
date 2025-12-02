// src/recoil/DashboardVisibility.ts
import { atom, selectorFamily } from 'recoil';
import { variableAtomFamily } from './VariableFamily';
import { cardDimensionConditionsState } from './Carddimensionstate ';
import axios from 'axios';
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
  markAtomInitialized 
} from './initializationState';

const ATOM_KEY = 'chartVisibilityVariableState';

export const chartVisibilityVariableState = atom<Record<string, string>>({
  key: ATOM_KEY,
  default: {},
  effects: [
    // Skip loading - DataInitializer handles this to avoid duplicate API calls
    ({ onSet }) => {
      // Save chart visibility to API when it changes (debounced)
      let timeoutId: NodeJS.Timeout;
      onSet((newValue, oldValue, isReset) => {
        // Skip saving during initialization
        if (shouldBlockSave()) {
          updateLastValue(ATOM_KEY, newValue);
          return;
        }
        
        // Skip if value hasn't actually changed
        if (!hasValueChanged(ATOM_KEY, newValue)) {
          return;
        }
        
        clearTimeout(timeoutId);
        if (isReset) {
          // If reset, clear all visibility
          axios.post('http://localhost:3002/api/chart-visibility', { visibility: {} })
            .catch(error => console.error('Failed to reset chart visibility:', error));
        } else {
          timeoutId = setTimeout(async () => {
            try {
              await axios.post('http://localhost:3002/api/chart-visibility', {
                visibility: newValue,
              });
              console.log('✅ ChartVisibility: Saved visibility');
            } catch (error) {
              console.error('❌ ChartVisibility: Failed to save:', error);
            }
          }, 500); // Debounce by 500ms
        }
      });
    },
  ],
});

const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return Function('"use strict";return (' + value + ')')();
    } catch {
      return value;
    }
  }
};

// Check if chart should be visible
export const isChartVisibleSelector = selectorFamily<boolean, string>({
  key: 'isChartVisibleSelector',
  get: (chartId: string) => ({ get }) => {
    const visibilityVariables = get(chartVisibilityVariableState);
    const variableName = visibilityVariables[chartId];
    
    if (!variableName) {
      return true; // No rule = always visible
    }
    
    try {
      const rawValue = get(variableAtomFamily(variableName));
      const parsedValue = safeParse(rawValue);
      
      // If variable is true = SHOW, if false = HIDE
      return parsedValue === true;
    } catch (e) {
      console.warn(`Error checking visibility variable ${variableName}:`, e);
      return true;
    }
  },
});

// Get dynamic dimensions based on conditions
export const chartDynamicDimensionsSelector = selectorFamily<
  { width: number; height: number } | null,
  string
>({
  key: 'chartDynamicDimensionsSelector',
  get: (chartId: string) => ({ get }) => {
    const allConditions = get(cardDimensionConditionsState);
    const conditions = allConditions[chartId];
    
    if (!conditions || conditions.length === 0) {
      return null; // No conditions = use default layout dimensions
    }
    
    // Sort by priority (lower number = higher priority)
    const sorted = [...conditions].sort((a, b) => a.priority - b.priority);
    
    // Check each condition in order
    for (const condition of sorted) {
      try {
        const rawValue = get(variableAtomFamily(condition.variableName));
        const parsedValue = safeParse(rawValue);
        
        if (typeof parsedValue === 'boolean' && parsedValue === condition.expectedValue) {
          // First match wins!
          return {
            width: condition.width,
            height: condition.height,
          };
        }
      } catch (e) {
        console.warn(`Error checking condition for ${condition.variableName}:`, e);
      }
    }
    
    return null; // No conditions matched
  },
});
