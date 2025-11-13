// src/recoil/CardDimensionState.ts
import { atom } from 'recoil';

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
    ({ setSelf, onSet }) => {
      const saved = localStorage.getItem('card-dimension-conditions');
      if (saved) {
        try {
          setSelf(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load dimension conditions:', e);
        }
      }

      onSet((newValue, _, isReset) => {
        if (isReset) {
          localStorage.removeItem('card-dimension-conditions');
        } else {
          localStorage.setItem('card-dimension-conditions', JSON.stringify(newValue));
        }
      });
    },
  ],
});