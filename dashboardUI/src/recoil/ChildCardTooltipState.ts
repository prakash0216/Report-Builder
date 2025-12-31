import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
} from "./initializationState";
import { TableSettings } from "../types/tableTypes";

const ATOM_KEY = 'childCardTooltipConfigState';

/**
 * Data Extraction Configuration
 * Defines how to extract data from the parent chart to use in tooltip
 */
export interface TooltipDataExtraction {
  id: string;                           // Unique ID for this extraction
  sourceKey: string;                    // Path to extract from (e.g., "category", "y", "series.name", "options.customData")
  extractionType: 'hover' | 'config';   // 'hover' = from point data, 'config' = from chart config
  targetVariable: string;               // Variable name to use in tooltip (e.g., "selectedCategory")
  description?: string;                 // User-friendly description
}

/**
 * Calculation Binding Configuration
 * Defines inline calculation logic that runs at hover time
 */
export interface TooltipCalculationBinding {
  id: string;                           // Unique ID for this binding
  outputVariable: string;               // Variable name for calculation result
  inlineLogic: string;                  // JavaScript code to execute at hover time
  description?: string;                 // User-friendly description
}

/**
 * Complete Tooltip Configuration for a Child Card
 */
export interface ChildCardTooltipConfig {
  enabled: boolean;
  
  // Content type
  type: 'chart' | 'table' | 'html';
  
  // Data extraction from parent chart
  dataExtractions: TooltipDataExtraction[];
  
  // Calculation bindings (optional) - run calculations with extracted data
  calculationBindings: TooltipCalculationBinding[];
  
  // Content templates (use extracted variables and calculation results)
  // For 'chart' type
  chartTemplate?: string;
  
  // For 'table' type  
  tableDataSource?: string;
  tableSettings?: TableSettings;
  
  // For 'html' type
  htmlTemplate?: string;
  
  // Appearance
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  
  // Behavior
  hideDelay: number;
  showHeader: boolean;
  headerTitle?: string;
  
  // Trigger settings
  triggerOn: 'hover' | 'click';         // How to trigger tooltip
}

/**
 * Default tooltip configuration
 */
export const defaultChildCardTooltipConfig: ChildCardTooltipConfig = {
  enabled: false,
  type: 'html',
  dataExtractions: [],
  calculationBindings: [],
  width: 400,
  height: 300,
  offsetX: 15,
  offsetY: 15,
  hideDelay: 200,
  showHeader: true,
  headerTitle: 'Details',
  triggerOn: 'hover',
};

/**
 * Available point data keys that can be extracted from Highcharts hover events
 */
export const AVAILABLE_HOVER_KEYS = [
  { key: 'x', description: 'X value of the point' },
  { key: 'y', description: 'Y value of the point' },
  { key: 'name', description: 'Name of the point' },
  { key: 'category', description: 'Category of the point (from xAxis)' },
  { key: 'series.name', description: 'Name of the series' },
  { key: 'series.index', description: 'Index of the series' },
  { key: 'color', description: 'Color of the point' },
  { key: 'percentage', description: 'Percentage (for pie charts)' },
  { key: 'index', description: 'Index of the point in series' },
  { key: 'options', description: 'Full point options object' },
  { key: 'options.custom', description: 'Custom data object on point' },
];

/**
 * State to store tooltip configurations for child cards
 * Key format: "{parentCardId}_{childCardId}" (e.g., "17_child-1")
 * Value: ChildCardTooltipConfig
 */
export const childCardTooltipConfigState = atom<{[childCardKey: string]: ChildCardTooltipConfig}>({
  key: ATOM_KEY,
  default: {},
  effects: [
    // Load effect
    ({ setSelf }) => {
      const loadConfigs = async () => {
        try {
          const response = await axios.get('http://localhost:3002/api/child-card-tooltip-configs');
          if (response.data?.success && response.data.configs) {
            // 🔥 Validate and sanitize loaded configs to handle corrupt/old data
            const sanitizedConfigs: {[key: string]: ChildCardTooltipConfig} = {};
            
            for (const [key, rawConfig] of Object.entries(response.data.configs)) {
              try {
                const config = rawConfig as any;
                // Ensure all required fields exist with proper types
                sanitizedConfigs[key] = {
                  enabled: typeof config?.enabled === 'boolean' ? config.enabled : false,
                  type: ['chart', 'table', 'html'].includes(config?.type) ? config.type : 'html',
                  dataExtractions: Array.isArray(config?.dataExtractions) ? config.dataExtractions : [],
                  calculationBindings: Array.isArray(config?.calculationBindings) ? config.calculationBindings : [],
                  chartTemplate: typeof config?.chartTemplate === 'string' ? config.chartTemplate : '',
                  tableDataSource: typeof config?.tableDataSource === 'string' ? config.tableDataSource : '',
                  tableSettings: config?.tableSettings || undefined,
                  htmlTemplate: typeof config?.htmlTemplate === 'string' ? config.htmlTemplate : '',
                  width: typeof config?.width === 'number' ? config.width : 400,
                  height: typeof config?.height === 'number' ? config.height : 300,
                  offsetX: typeof config?.offsetX === 'number' ? config.offsetX : 15,
                  offsetY: typeof config?.offsetY === 'number' ? config.offsetY : 15,
                  hideDelay: typeof config?.hideDelay === 'number' ? config.hideDelay : 200,
                  showHeader: typeof config?.showHeader === 'boolean' ? config.showHeader : true,
                  headerTitle: typeof config?.headerTitle === 'string' ? config.headerTitle : 'Details',
                  triggerOn: ['hover', 'click'].includes(config?.triggerOn) ? config.triggerOn : 'hover',
                };
              } catch (e) {
                console.warn(`⚠️ Skipping corrupt tooltip config for key ${key}:`, e);
              }
            }
            
            setSelf(sanitizedConfigs);
            console.log(`✅ ChildCardTooltipConfig: Loaded ${Object.keys(sanitizedConfigs).length} configs`);
          }
        } catch (error) {
          console.warn('⚠️ ChildCardTooltipConfig: Failed to load from backend:', error);
        }
      };
      loadConfigs();
    },
    // Save effect
    ({ onSet }) => {
      let timeoutId: NodeJS.Timeout;
      onSet((newValue, oldValue, isReset) => {
        if (shouldBlockSave()) {
          updateLastValue(ATOM_KEY, newValue);
          return;
        }
        
        if (!hasValueChanged(ATOM_KEY, newValue)) {
          return;
        }
        
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            // Save all configs at once
            await axios.post('http://localhost:3002/api/child-card-tooltip-configs', {
              configs: newValue,
            });
            console.log(`✅ ChildCardTooltipConfig: Saved ${Object.keys(newValue).length} configs`);
          } catch (error) {
            console.error('❌ ChildCardTooltipConfig: Failed to save:', error);
          }
        }, 500);
      });
    },
  ]
});

/**
 * Active tooltip state for child cards
 */
export interface ActiveChildCardTooltipState {
  childCardKey: string | null;          // Format: "{parentCardId}_{childCardId}"
  isVisible: boolean;
  position: { x: number; y: number };
  extractedData: Record<string, any>;   // Data extracted from hover point
  calculationResults: Record<string, any>; // Results from running calculations
}

export const activeChildCardTooltipState = atom<ActiveChildCardTooltipState>({
  key: 'activeChildCardTooltipState',
  default: {
    childCardKey: null,
    isVisible: false,
    position: { x: 0, y: 0 },
    extractedData: {},
    calculationResults: {},
  },
});

