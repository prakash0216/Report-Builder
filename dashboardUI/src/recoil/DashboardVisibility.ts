// src/recoil/DashboardVisibility.ts
import { atom, selectorFamily } from 'recoil';
import { variableAtomFamily } from './VariableFamily';
import { cardDimensionConditionsState } from './Carddimensionstate ';

export const chartVisibilityVariableState = atom<Record<string, string>>({
  key: 'chartVisibilityVariableState',
  default: {},
  effects: [
    ({ setSelf, onSet }) => {
      const saved = localStorage.getItem('chart-visibility-variables');
      if (saved) {
        try {
          setSelf(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load visibility variables:', e);
        }
      }

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
    
    console.log(`[Selector] Checking visibility for chart ${chartId}, variable: ${variableName}`);
    
    if (!variableName) {
      console.log(`[Selector] Chart ${chartId}: No variable assigned, visible=true`);
      return true; // No rule = always visible
    }
    
    try {
      const rawValue = get(variableAtomFamily(variableName));
      const parsedValue = safeParse(rawValue);
      
      console.log(`[Selector] Chart ${chartId}: Variable ${variableName} = ${parsedValue}`);
      
      // If variable is true = HIDE, if false = SHOW
      const isVisible = parsedValue !== true;
      console.log(`[Selector] Chart ${chartId}: isVisible = ${isVisible}`);
      return isVisible;
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
    
    console.log(`[Dim Selector] Chart ${chartId}: Has ${conditions?.length || 0} conditions`);
    
    if (!conditions || conditions.length === 0) {
      console.log(`[Dim Selector] Chart ${chartId}: No conditions, returning null`);
      return null; // No conditions = use default layout dimensions
    }
    
    // Sort by priority (lower number = higher priority)
    const sorted = [...conditions].sort((a, b) => a.priority - b.priority);
    
    console.log(`[Dim Selector] Chart ${chartId}: Checking ${sorted.length} conditions in order`);
    
    // Check each condition in order
    for (const condition of sorted) {
      try {
        const rawValue = get(variableAtomFamily(condition.variableName));
        const parsedValue = safeParse(rawValue);
        
        console.log(`[Dim Selector] Chart ${chartId}: Condition P${condition.priority} - ${condition.variableName} = ${parsedValue}, expecting ${condition.expectedValue}`);
        
        if (typeof parsedValue === 'boolean' && parsedValue === condition.expectedValue) {
          // First match wins!
          console.log(`[Dim Selector] Chart ${chartId}: ✅ MATCH! Returning w=${condition.width}, h=${condition.height}`);
          return {
            width: condition.width,
            height: condition.height,
          };
        }
      } catch (e) {
        console.warn(`Error checking condition for ${condition.variableName}:`, e);
      }
    }
    
    console.log(`[Dim Selector] Chart ${chartId}: No conditions matched, returning null (use original)`);
    return null; // No conditions matched
  },
});