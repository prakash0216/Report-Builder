import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
} from "./initializationState";
import { TableSettings } from "../types/tableTypes";
import { API_BASE_URL } from '../config/api.config';

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
 * Layout configuration for a tooltip card within the tooltip container
 */
export interface TooltipCardLayout {
  id: string;           // Unique ID for the tooltip card
  x: number;            // X position (0-1 grid, 0=left, 1=right for 2-col)
  y: number;            // Y position (0-1 grid, 0=top, 1=bottom for 2-row)
  w: number;            // Width (1 = full, 0.5 = half)
  h: number;            // Height (1 = full, 0.5 = half)
}

/**
 * Configuration for a single card within the tooltip
 */
export interface TooltipCardConfig {
  id: string;
  type: 'chart' | 'table' | 'html';
  
  // For chart type
  chartTemplate?: string;
  
  // For table type
  tableDataSource?: string;
  tableSettings?: TableSettings;
  
  // For HTML type
  htmlTemplate?: string;
  
  // Display settings
  title?: string;
  showTitle?: boolean;
  backgroundColor?: string;
  
  // Layout within tooltip container
  layout: TooltipCardLayout;
}

/**
 * Layout presets for tooltip cards (max 4 cards)
 */
export const TOOLTIP_LAYOUT_PRESETS = {
  // Single card - full size
  single: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 1, h: 1 }
  ],
  // Two cards - side by side
  twoHorizontal: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 0.5, h: 1 },
    { id: 'tooltip-card-2', x: 0.5, y: 0, w: 0.5, h: 1 }
  ],
  // Two cards - stacked vertically
  twoVertical: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 1, h: 0.5 },
    { id: 'tooltip-card-2', x: 0, y: 0.5, w: 1, h: 0.5 }
  ],
  // Three cards - 1 top, 2 bottom
  threeTopOne: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 1, h: 0.5 },
    { id: 'tooltip-card-2', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-3', x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
  ],
  // Three cards - 2 top, 1 bottom
  threeBottomOne: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-2', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-3', x: 0, y: 0.5, w: 1, h: 0.5 }
  ],
  // Four cards - 2x2 grid
  fourGrid: [
    { id: 'tooltip-card-1', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-2', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-3', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'tooltip-card-4', x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
  ],
};

/**
 * Create a default tooltip card configuration
 */
export const createDefaultTooltipCard = (id: string, layout: TooltipCardLayout): TooltipCardConfig => ({
  id,
  type: 'html',
  htmlTemplate: '<div style="padding: 16px; text-align: center; color: #64748b;">Configure this card</div>',
  title: '',
  showTitle: false,
  layout,
});

/**
 * Complete Tooltip Configuration for a Child Card
 * Now supports multiple cards within the tooltip (max 4)
 */
export interface ChildCardTooltipConfig {
  enabled: boolean;
  
  // 🔥 NEW: Multi-card support
  useMultiCard: boolean;              // If true, use tooltipCards array; if false, use legacy single card
  tooltipCards: TooltipCardConfig[];  // Array of tooltip cards (max 4)
  containerLayout: 'grid' | 'vertical' | 'horizontal' | 'custom';
  gap: number;                        // Gap between tooltip cards in pixels
  
  // Legacy single-card fields (kept for backward compatibility)
  type: 'chart' | 'table' | 'html';
  chartTemplate?: string;
  tableDataSource?: string;
  tableSettings?: TableSettings;
  htmlTemplate?: string;
  
  // Data extraction from parent chart (shared across all tooltip cards)
  dataExtractions: TooltipDataExtraction[];
  
  // Calculation bindings (shared across all tooltip cards)
  calculationBindings: TooltipCalculationBinding[];
  
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
  triggerOn: 'hover' | 'click';
}

/**
 * Default tooltip configuration
 */
export const defaultChildCardTooltipConfig: ChildCardTooltipConfig = {
  enabled: false,
  
  // Multi-card defaults
  useMultiCard: false,
  tooltipCards: [],
  containerLayout: 'grid',
  gap: 4,
  
  // Legacy single-card defaults
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
          const response = await axios.get(`${API_BASE_URL}/api/child-card-tooltip-configs`);
          if (response.data?.success && response.data.configs) {
            // 🔥 Validate and sanitize loaded configs to handle corrupt/old data
            const sanitizedConfigs: {[key: string]: ChildCardTooltipConfig} = {};
            
            for (const [key, rawConfig] of Object.entries(response.data.configs)) {
              try {
                const config = rawConfig as any;
                // Ensure all required fields exist with proper types
                sanitizedConfigs[key] = {
                  enabled: typeof config?.enabled === 'boolean' ? config.enabled : false,
                  
                  // 🔥 NEW: Multi-card fields
                  useMultiCard: typeof config?.useMultiCard === 'boolean' ? config.useMultiCard : false,
                  tooltipCards: Array.isArray(config?.tooltipCards) ? config.tooltipCards : [],
                  containerLayout: ['grid', 'vertical', 'horizontal', 'custom'].includes(config?.containerLayout) 
                    ? config.containerLayout : 'grid',
                  gap: typeof config?.gap === 'number' ? config.gap : 4,
                  
                  // Legacy single-card fields
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
            await axios.post(`${API_BASE_URL}/api/child-card-tooltip-configs`, {
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

