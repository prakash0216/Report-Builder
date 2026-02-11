import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
} from "./initializationState";
import { getCurrentViewId } from "./ViewContext";
import { API_BASE_URL } from '../config/api.config';

const ATOM_KEY = 'onClickConfigState';

// Data mapping: extract data from clicked point into named variables
export interface OnClickDataMapping {
  sourceKey: string;        // Key from clicked point (e.g., 'category', 'y', 'series.name')
  clickVariable: string;    // Temporary variable name available in onClick logic (e.g., 'clickedCity')
  extractionType: 'point' | 'config' | 'row';  // 'point' = from clicked point, 'config' = from chart config, 'row' = from clicked table row
}

// A single onClick calculation
export interface OnClickCalculation {
  id: string;               // Unique ID for this calculation
  logic: string;            // JavaScript logic (same syntax as Calculations tab)
  targetVariable: string;   // Variable to assign result to — can be existing or a new custom name
  isCustomVariable: boolean; // true = creates a new variable (only available during onClick), false = overrides existing
  order: number;            // Execution order (for dependency chaining)
}

// Full onClick config for a single chart
export interface OnClickConfig {
  enabled: boolean;

  // Data extraction - map point fields to click variables
  dataMapping: OnClickDataMapping[];

  // Calculations to run on click (executed sequentially by order)
  calculations: OnClickCalculation[];

  // Behavior
  resetOnClickOutside: boolean;   // Auto-reset when clicking outside chart
  showResetButton: boolean;       // Show a "Reset" button overlay on the chart
  highlightClicked: boolean;      // Visually highlight the clicked point
}

export const defaultOnClickConfig: OnClickConfig = {
  enabled: false,
  dataMapping: [],
  calculations: [],
  resetOnClickOutside: true,
  showResetButton: true,
  highlightClicked: false,
};

// Available source keys that can be extracted from a Highcharts point
export const AVAILABLE_SOURCE_KEYS = [
  { key: 'x', label: 'X Value', description: 'X-axis value of the clicked point' },
  { key: 'y', label: 'Y Value', description: 'Y-axis value of the clicked point' },
  { key: 'name', label: 'Point Name', description: 'Name of the point (for pie charts, etc.)' },
  { key: 'category', label: 'Category', description: 'Category label from xAxis' },
  { key: 'color', label: 'Color', description: 'Color of the clicked point' },
  { key: 'percentage', label: 'Percentage', description: 'Percentage (for pie/stacked charts)' },
  { key: 'total', label: 'Total', description: 'Total value (for stacked charts)' },
  { key: 'index', label: 'Point Index', description: 'Index of the point in the series' },
  { key: 'series.name', label: 'Series Name', description: 'Name of the series the point belongs to' },
  { key: 'series.index', label: 'Series Index', description: 'Index of the series' },
  { key: 'series.type', label: 'Series Type', description: 'Chart type of the series (line, bar, etc.)' },
  { key: 'options', label: 'Point Options', description: 'Full point options object (all custom data)' },
  { key: 'options.custom', label: 'Custom Data', description: 'Custom data object attached to the point (options.custom)' },
];

// Special source keys available when clicking a table row
export const AVAILABLE_TABLE_SOURCE_KEYS = [
  { key: '_rowIndex', label: 'Row Index', description: 'Index of the clicked row in the displayed data' },
  { key: '_rowData', label: 'Full Row Object', description: 'The entire row as a JSON object (all columns)' },
];

// State to store onClick configurations per chart
// Key: chartId, Value: OnClickConfig
export const onClickConfigState = atom<Record<string, OnClickConfig>>({
  key: ATOM_KEY,
  default: {},
  effects: [
    ({ onSet }) => {
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
        timeoutId = setTimeout(async () => {
          try {
            const viewId = getCurrentViewId();
            // Save each onClick config individually
            for (const [chartId, config] of Object.entries(newValue)) {
              await axios.post(`${API_BASE_URL}/api/onclick-configs`, {
                chartId,
                viewId,
                config,
              });
            }
            console.log(`✅ OnClickConfig: Saved ${Object.keys(newValue).length} configs (viewId: ${viewId})`);
          } catch (error) {
            console.error('❌ OnClickConfig: Failed to save:', error);
          }
        }, 500);
      });
    },
  ]
});

