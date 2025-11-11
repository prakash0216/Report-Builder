// src/recoil/DashboardVisibility.ts
import { atom, selectorFamily } from 'recoil';
import { liveFilterFamily } from './LiveFilterFamily';

// Store visibility conditions per chart ID
export interface ChartVisibilityCondition {
  filterName: string;  // e.g., "param_metric"
  filterValue: string; // e.g., "MOP"
}

// State: Map of chartId -> array of conditions
export const chartVisibilityConditionsState = atom<Record<string, ChartVisibilityCondition[]>>({
  key: 'chartVisibilityConditionsState',
  default: {},
  effects: [
    ({ setSelf, onSet }) => {
      // Load from localStorage
      const saved = localStorage.getItem('chart-visibility-conditions');
      if (saved) {
        try {
          setSelf(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load visibility conditions:', e);
        }
      }

      // Save to localStorage on changes
      onSet((newValue, _, isReset) => {
        if (isReset) {
          localStorage.removeItem('chart-visibility-conditions');
        } else {
          localStorage.setItem('chart-visibility-conditions', JSON.stringify(newValue));
        }
      });
    },
  ],
});

// Selector: Check if a specific chart should be visible
export const isChartVisibleSelector = selectorFamily<boolean, string>({
  key: 'isChartVisibleSelector',
  get: (chartId: string) => ({ get }) => {
    const allConditions = get(chartVisibilityConditionsState);
    const conditions = allConditions[chartId];
    
    // No conditions = always visible
    if (!conditions || conditions.length === 0) {
      return true;
    }
    
    // Check each condition
    for (const condition of conditions) {
      try {
        const filterValue = get(liveFilterFamily(condition.filterName));
        
        // Extract actual values from filter
        let actualValues: string[] = [];
        
        if (Array.isArray(filterValue)) {
          // Multi-select: get all selected values
          actualValues = filterValue.map((v: any) => {
            if (typeof v === 'object' && v.value !== undefined) {
              return String(v.value);
            }
            return String(v);
          });
        } else if (filterValue && typeof filterValue === 'object' && filterValue.value !== undefined) {
          // Single select with object
          actualValues = [String(filterValue.value)];
        } else if (filterValue !== null && filterValue !== undefined) {
          // Primitive value
          actualValues = [String(filterValue)];
        }
        
        // If any selected value matches the condition value -> HIDE
        if (actualValues.some(val => val === condition.filterValue)) {
          return false; // HIDE this chart
        }
      } catch (e) {
        console.warn(`Error checking filter ${condition.filterName}:`, e);
      }
    }
    
    // All conditions checked, none matched -> VISIBLE
    return true;
  },
});