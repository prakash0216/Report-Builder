// src/recoil/DashboardVisibility.ts
import { atom, selectorFamily } from 'recoil';
import { variableAtomFamily } from './VariableFamily';

// Store ONE boolean variable name per chart ID
// If the variable evaluates to true, the chart is HIDDEN
export const chartVisibilityVariableState = atom<Record<string, string>>({
  key: 'chartVisibilityVariableState',
  default: {},
  effects: [
    ({ setSelf, onSet }) => {
      // Load from localStorage
      const saved = localStorage.getItem('chart-visibility-variables');
      if (saved) {
        try {
          setSelf(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load visibility variables:', e);
        }
      }

      // Save to localStorage on changes
      onSet((newValue, _, isReset) => {
        if (isReset) {
          localStorage.removeItem('chart-visibility-variables');
        } else {
          localStorage.setItem('chart-visibility-variables', JSON.stringify(newValue));
        }
      });
    },
  ],
});

// Helper to safely parse variable values
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

// Selector: Check if a specific chart should be visible
// Returns FALSE if chart should be HIDDEN (when variable === true)
// Returns TRUE if chart should be VISIBLE (when variable === false or undefined)
export const isChartVisibleSelector = selectorFamily<boolean, string>({
  key: 'isChartVisibleSelector',
  get: (chartId: string) => ({ get }) => {
    const visibilityVariables = get(chartVisibilityVariableState);
    const variableName = visibilityVariables[chartId];
    
    // No variable assigned = always visible
    if (!variableName) {
      return true;
    }
    
    try {
      // Get the variable value
      const rawValue = get(variableAtomFamily(variableName));
      const parsedValue = safeParse(rawValue);
      
      // If variable is true, HIDE the chart
      // If variable is false/undefined/null, SHOW the chart
      if (parsedValue === true) {
        return false; // HIDE
      }
      
      return true; // SHOW
    } catch (e) {
      console.warn(`Error checking visibility variable ${variableName} for chart ${chartId}:`, e);
      // On error, default to visible
      return true;
    }
  },
});