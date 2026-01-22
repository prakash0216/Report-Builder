import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
} from "./initializationState";
import { getCurrentViewId } from "./ViewContext";

const ATOM_KEY = 'tooltipConfigState';

export interface TooltipDataMapping {
  sourceKey: string;      // Key from the hover point data (e.g., 'category', 'y', 'x', 'series.name')
  targetVariable: string; // Variable name to use in tooltip content (e.g., 'tooltipCategory')
}

export interface TooltipConfig {
  enabled: boolean;
  type: 'chart' | 'table' | 'html' | 'card';
  
  // For 'card' type - reference existing dashboard card
  cardId?: string;
  
  // For 'chart' type - inline chart config
  chartTemplate?: string;
  
  // For 'table' type - table configuration
  tableDataSource?: string;
  tableSettings?: any;
  
  // For 'html' type - HTML template
  htmlTemplate?: string;
  
  // Data mapping - how to pass data from main chart to tooltip
  dataMapping: TooltipDataMapping[];
  
  // Tooltip dimensions
  width: number;
  height: number;
  
  // Position offset
  offsetX: number;
  offsetY: number;
  
  // Behavior
  showOnHover: boolean;
  hideDelay: number; // ms delay before hiding tooltip
  showHeader: boolean;
  headerTitle?: string;
}

export const defaultTooltipConfig: TooltipConfig = {
  enabled: false,
  type: 'html',
  dataMapping: [],
  width: 400,
  height: 300,
  offsetX: 10,
  offsetY: 10,
  showOnHover: true,
  hideDelay: 200,
  showHeader: true,
  headerTitle: 'Details',
};

// State to store tooltip configurations per chart
// Key: chartId, Value: TooltipConfig
export const tooltipConfigState = atom<{[chartId: string]: TooltipConfig}>({
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
            // Save each tooltip config individually
            for (const [chartId, config] of Object.entries(newValue)) {
              await axios.post('http://localhost:3002/api/tooltip-configs', {
                chartId,
                viewId,
                config,
              });
            }
            console.log(`✅ TooltipConfig: Saved ${Object.keys(newValue).length} configs (viewId: ${viewId})`);
          } catch (error) {
            console.error('❌ TooltipConfig: Failed to save:', error);
          }
        }, 500);
      });
    },
  ]
});

// Active tooltip state - tracks which tooltip is currently showing and its data
export interface ActiveTooltipState {
  chartId: string | null;
  isVisible: boolean;
  position: { x: number; y: number };
  pointData: any; // Data from the hovered point
}

export const activeTooltipState = atom<ActiveTooltipState>({
  key: 'activeTooltipState',
  default: {
    chartId: null,
    isVisible: false,
    position: { x: 0, y: 0 },
    pointData: null,
  },
});

