// src/recoil/CardDimensionState.ts
import { atom } from 'recoil';
import axios from 'axios';

export interface DimensionCondition {
  id: string;
  variableName: string;
  expectedValue: boolean;
  width: number;
  height: number;
  priority: number;
}

export const cardDimensionConditionsState = atom<Record<string, DimensionCondition[]>>({
  key: 'cardDimensionConditionsState',
  default: {},
  effects: [
    ({ setSelf }) => {
      // Load card dimension conditions from API on initialization
      axios.get('http://localhost:3002/api/card-dimension-conditions')
        .then(response => {
          if (response.data.success && response.data.conditions) {
            setSelf(response.data.conditions);
          }
        })
        .catch(error => {
          console.error('Failed to load card dimension conditions:', error);
        });
    },
    ({ onSet }) => {
      // Save card dimension conditions to API when they change
      onSet(async (newValue, _, isReset) => {
        if (isReset) {
          // If reset, clear all conditions (would need a delete all endpoint)
          return;
        }
        
        try {
          // Save conditions for each chart
          for (const [chartId, conditions] of Object.entries(newValue)) {
            await axios.post('http://localhost:3002/api/card-dimension-conditions', {
              chartId,
              conditions: conditions || [],
            });
          }
        } catch (error) {
          console.error('Failed to save card dimension conditions:', error);
        }
      });
    },
  ],
});