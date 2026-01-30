import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
} from "./initializationState";
import { getCurrentViewId } from "./ViewContext";
import { TableSettings } from "../types/tableTypes";
import { API_BASE_URL } from '../config/api.config';

const ATOM_KEY = 'childCardConfigState';

// Layout configuration for a child card within the parent
export interface ChildCardLayout {
  id: string;           // Unique ID for the child card
  x: number;            // X position (0-1 grid, 0=left, 1=right for 2-col)
  y: number;            // Y position (0-1 grid, 0=top, 1=bottom for 2-row)
  w: number;            // Width (1 = full, 0.5 = half)
  h: number;            // Height (1 = full, 0.5 = half)
}

// Configuration for a single child card
export interface ChildCardConfig {
  id: string;
  type: 'chart' | 'table' | 'html';
  
  // For chart type
  template?: string;
  
  // For table type
  tableDataSource?: string;
  tableSettings?: TableSettings;
  
  // For HTML type
  htmlContent?: string;
  
  // Display settings - legacy simple title
  title?: string;
  showTitle?: boolean;
  
  // 🔥 NEW: Dynamic HTML Title Support
  titleMode?: 'simple' | 'html';           // 'simple' = plain text, 'html' = full HTML template
  titleTemplate?: string;                   // HTML template with ${variable} support
  
  // Layout within parent
  layout: ChildCardLayout;
  
  // Tooltip configuration - if enabled, tooltip config is stored separately
  // in childCardTooltipConfigState with key "{parentCardId}_{childCardId}"
  tooltipEnabled?: boolean;
  
  // 🔥 NEW: Child Card Visibility & Arrangement Control
  visibilityVariable?: string;              // Boolean variable name - if true, card is visible
  arrangementVariable?: string;             // Number variable name - controls display order (lower = first)
  
  // 🔥 NEW: Child Card Dimension Conditions (similar to parent CardArrangement)
  dimensionConditions?: ChildCardDimensionCondition[];
}

// Dimension condition for child card (similar to parent's DimensionCondition)
export interface ChildCardDimensionCondition {
  id: string;
  variableName: string;           // Boolean variable to check
  expectedValue: boolean;         // When variable equals this value
  width: number;                  // Width as grid columns / 12 (e.g., 0.5 = 6 columns, 1 = 12 columns)
  height: number;                 // Height as grid rows / 12 (e.g., 0.5 = 6 rows, 1 = 12 rows)
  priority: number;               // Lower number = higher priority (first match wins)
}

// Parent card container configuration
export interface ParentCardConfig {
  isContainer: boolean;           // Flag to identify this as a container card
  containerLayout: 'grid' | 'vertical' | 'horizontal' | 'custom';
  childCards: ChildCardConfig[];  // Array of child cards (max 4)
  enableContainerScroll: boolean; // Enable container-level scrolling
  cardMinHeight: number;          // Minimum height per card in pixels (used when scrolling enabled)
  gap: number;                    // Gap between child cards in pixels
  
  // 🔥 Dynamic Height Settings - uses a pre-calculated height variable
  useDynamicHeight?: boolean;     // Enable dynamic height from variable
  heightDataSource?: string;      // Variable name containing the calculated height value (e.g., "chartHeight")
  
  // 🔥 NEW: Dynamic HTML Title Support for Parent Card
  showParentTitle?: boolean;                // Show parent card title
  parentTitleMode?: 'simple' | 'html';      // 'simple' = plain text, 'html' = full HTML template
  parentTitle?: string;                     // Simple title text (legacy)
  parentTitleTemplate?: string;             // HTML template with ${variable} support
  
  // 🔥 NEW: Parent Card Visibility & Arrangement Control (controls the entire container)
  visibilityVariable?: string;              // Boolean variable name - if true, entire container is visible
  arrangementVariable?: string;             // Number variable name - controls display order in dashboard
  
  // 🔥 NEW: Child Cards Visibility Mode
  childVisibilityMode?: 'all' | 'individual';  // 'all' = all children visible, 'individual' = each child has own rule
}

// Default child card layout presets
export const LAYOUT_PRESETS = {
  // Single card - full size
  single: [
    { id: 'child-1', x: 0, y: 0, w: 1, h: 1 }
  ],
  // Two cards - side by side
  twoHorizontal: [
    { id: 'child-1', x: 0, y: 0, w: 0.5, h: 1 },
    { id: 'child-2', x: 0.5, y: 0, w: 0.5, h: 1 }
  ],
  // Two cards - stacked vertically
  twoVertical: [
    { id: 'child-1', x: 0, y: 0, w: 1, h: 0.5 },
    { id: 'child-2', x: 0, y: 0.5, w: 1, h: 0.5 }
  ],
  // Three cards - 1 top, 2 bottom
  threeTopOne: [
    { id: 'child-1', x: 0, y: 0, w: 1, h: 0.5 },
    { id: 'child-2', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'child-3', x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
  ],
  // Three cards - 2 top, 1 bottom
  threeBottomOne: [
    { id: 'child-1', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'child-2', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'child-3', x: 0, y: 0.5, w: 1, h: 0.5 }
  ],
  // Four cards - 2x2 grid
  fourGrid: [
    { id: 'child-1', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'child-2', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'child-3', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'child-4', x: 0.5, y: 0.5, w: 0.5, h: 0.5 }
  ],
};

// Default parent card configuration
// 🔥 Every card is now a multi-card container by default (with 1-4 child cards)
export const defaultParentCardConfig: ParentCardConfig = {
  isContainer: true,  // Always true - every card is a container
  containerLayout: 'custom',
  childCards: [],  // Will be initialized with one child card when created
  enableContainerScroll: false,  // false = no scrolling (compress to fit), true = container scrolls
  cardMinHeight: 800,            // Content height in pixels when scrolling (set higher than container)
  gap: 8,
  
  // 🔥 Dynamic Height Defaults - user calculates height in their own logic
  useDynamicHeight: false,
  heightDataSource: '',          // Variable containing pre-calculated height value
  
  // 🔥 Dynamic Title Defaults
  showParentTitle: false,
  parentTitleMode: 'simple',
  parentTitle: '',
  parentTitleTemplate: '',
  
  // 🔥 Visibility & Arrangement Defaults
  visibilityVariable: '',        // Empty = always visible
  arrangementVariable: '',       // Empty = use default layout order
  childVisibilityMode: 'individual',    // Default: each child has its own visibility
};

// Default child card configuration
// Note: title is left empty - the UI will display "Card N" based on the child number extracted from the ID
export const createDefaultChildCard = (id: string, layout: ChildCardLayout): ChildCardConfig => ({
  id,
  type: 'chart',
  template: '',
  title: '', // Empty by default - display shows "Card N" based on ID (e.g., 17_child2 -> "Card 2")
  titleMode: 'simple',
  titleTemplate: '',
  showTitle: false,
  layout,
  // Visibility & Arrangement Defaults
  visibilityVariable: '',   // Empty = always visible
  arrangementVariable: '',  // Empty = use default layout order
  dimensionConditions: [],  // Empty = use default layout dimensions
});

// State to store parent card configurations
// Key: parentCardId, Value: ParentCardConfig
export const childCardConfigState = atom<{[parentCardId: string]: ParentCardConfig}>({
  key: ATOM_KEY,
  default: {},
  effects: [
    // Skip loading - DataInitializer handles this to avoid duplicate API calls
    // 🔥 SAVE EFFECT: Save configs to backend when they change
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
            const viewId = getCurrentViewId();
            for (const [parentCardId, config] of Object.entries(newValue)) {
              await axios.post(`${API_BASE_URL}/api/child-card-configs`, {
                parentCardId,
                viewId,
                config,
              });
            }
            console.log(`✅ ChildCardConfig: Saved ${Object.keys(newValue).length} parent configs (viewId: ${viewId})`);
          } catch (error) {
            console.error('❌ ChildCardConfig: Failed to save:', error);
          }
        }, 500);
      });
    },
  ]
});

