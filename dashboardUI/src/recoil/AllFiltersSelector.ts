// recoil/AllFiltersSelector.ts
import { selector } from 'recoil';
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
 * 🔥 PERFORMANCE: Lightweight fingerprint for change detection
 * Instead of JSON.stringify on potentially huge filter arrays (1000+ items),
 * build a compact string: "filterName:count:firstVal:lastVal|..."
 * This is O(n_filters) instead of O(total_option_values)
 */
export const allFiltersSnapshotSelector = selector({
  key: 'allFiltersSnapshotSelector',
  get: ({ get }) => {
    const allFilterValues = get(allFiltersValuesSelector);
    const parts: string[] = [];
    
    // Sort keys for stable ordering
    const keys = Object.keys(allFilterValues).sort();
    for (const key of keys) {
      const val = allFilterValues[key];
      if (Array.isArray(val)) {
        // For arrays: use count + first/last value labels as fingerprint
        const len = val.length;
        const first = len > 0 ? (val[0]?.value ?? val[0]?.label ?? String(val[0])) : '';
        const last = len > 1 ? (val[len - 1]?.value ?? val[len - 1]?.label ?? String(val[len - 1])) : first;
        parts.push(`${key}:${len}:${first}:${last}`);
      } else if (val !== null && val !== undefined) {
        parts.push(`${key}:${String(val)}`);
      } else {
        parts.push(`${key}:null`);
      }
    }
    
    return parts.join('|');
  }
});
