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

// Flag to track if we're in initialization mode (loading from DataInitializer)
let isInitializing = true;
let previousValue: Record<string, DimensionCondition[]> = {};

export const cardDimensionConditionsState = atom<Record<string, DimensionCondition[]>>({
  key: 'cardDimensionConditionsState',
  default: {},
  effects: [
    ({ setSelf }) => {
      // Load card dimension conditions from API on initialization
      // Note: DataInitializer also loads this, but we keep this as a fallback
      axios.get('http://localhost:3002/api/card-dimension-conditions')
        .then(response => {
          if (response.data.success && response.data.conditions) {
            previousValue = response.data.conditions;
            setSelf(response.data.conditions);
          }
          // After initial load attempt, allow saves (DataInitializer will load too)
          setTimeout(() => {
            isInitializing = false;
          }, 2000); // Give DataInitializer time to load
        })
        .catch(error => {
          console.error('Failed to load card dimension conditions:', error);
          // Even on error, allow saves after a delay
          setTimeout(() => {
            isInitializing = false;
          }, 2000);
        });
    },
    ({ onSet }) => {
      // Save card dimension conditions to API when they change
      onSet(async (newValue, _, isReset) => {
        if (isReset) {
          // If reset, clear all conditions (would need a delete all endpoint)
          return;
        }
        
        // Skip saving during initialization (when DataInitializer is loading data)
        if (isInitializing) {
          previousValue = newValue;
          return;
        }
        
        // Skip if value hasn't actually changed (prevent duplicate saves)
        const valueChanged = JSON.stringify(previousValue) !== JSON.stringify(newValue);
        if (!valueChanged) {
          return;
        }
        
        previousValue = newValue;
        
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