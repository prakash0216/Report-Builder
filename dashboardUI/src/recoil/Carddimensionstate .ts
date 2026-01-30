// src/recoil/CardDimensionState.ts
import { atom } from 'recoil';
import axios from 'axios';
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue
} from './initializationState';
import { getCurrentViewId } from './ViewContext';
import { API_BASE_URL } from '../config/api.config';

export interface DimensionCondition {
  id: string;
  variableName: string;
  expectedValue: boolean;
  width: number;
  height: number;
  priority: number;
}

const ATOM_KEY = 'cardDimensionConditionsState';

export const cardDimensionConditionsState = atom<Record<string, DimensionCondition[]>>({
  key: ATOM_KEY,
  default: {},
  effects: [
    // Skip loading - DataInitializer handles this to avoid duplicate API calls
    ({ onSet }) => {
      // Save card dimension conditions to API when they change (debounced)
      let timeoutId: NodeJS.Timeout;
      onSet(async (newValue, oldValue, isReset) => {
        if (isReset) {
          return;
        }
        
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
            // Save conditions for each chart
            for (const [chartId, conditions] of Object.entries(newValue)) {
              await axios.post(`${API_BASE_URL}/api/card-dimension-conditions`, {
                chartId,
                viewId,
                conditions: conditions || [],
              });
            }
            console.log(`✅ CardDimensions: Saved conditions (viewId: ${viewId})`);
          } catch (error) {
            console.error('❌ CardDimensions: Failed to save:', error);
          }
        }, 500);
      });
    },
  ],
});
