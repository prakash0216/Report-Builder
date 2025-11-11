// recoil/AllFiltersSelector.ts
import { selector, selectorFamily } from 'recoil';
import { filterNamesState, filterConfigFamily } from './FiltersFamily';
import { liveFilterFamily } from './LiveFilterFamily';

/**
 * Selector that returns all current filter values
 * This will trigger re-renders whenever ANY filter value changes
 */
export const allFiltersValuesSelector = selector({
  key: 'allFiltersValuesSelector',
  get: ({ get }) => {
    const filterNames = get(filterNamesState);
    const allFilterValues: Record<string, any> = {};
    
    filterNames.forEach(filterId => {
      try {
        const filterConfig = get(filterConfigFamily(filterId));
        if (filterConfig && filterConfig.variableName) {
          const selectedOptions = get(liveFilterFamily(filterConfig.variableName));
          allFilterValues[filterConfig.variableName] = selectedOptions;
        }
      } catch (err) {
        console.warn(`Failed to get filter value for ${filterId}:`, err);
      }
    });
    
    return allFilterValues;
  }
});

/**
 * Selector that returns a JSON string of all filter values
 * Useful for change detection
 */
export const allFiltersSnapshotSelector = selector({
  key: 'allFiltersSnapshotSelector',
  get: ({ get }) => {
    const allFilterValues = get(allFiltersValuesSelector);
    return JSON.stringify(allFilterValues);
  }
});