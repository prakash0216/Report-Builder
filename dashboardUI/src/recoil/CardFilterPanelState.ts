import { atomFamily } from "recoil";
import axios from "axios";
import { API_BASE_URL } from '../config/api.config';

export type CardFilterPosition = {
  x: number;
  y: number;
};

export const cardFilterIdsFamily = atomFamily<string[], string>({
  key: "cardFilterIdsFamily",
  default: [],
  effects: (cardId) => [
    ({ setSelf }) => {
      axios
        .get(`${API_BASE_URL}/api/cards/${cardId}/filter-panel-state`)
        .then((response) => {
          if (response.data.success && response.data.activeFilterIds) {
            setSelf(response.data.activeFilterIds);
          }
        })
        .catch((error) => {
          console.error("Failed to load card filter IDs:", error);
        });
    },
  ],
});

export const cardFilterPositionsFamily = atomFamily<
  Record<string, CardFilterPosition>,
  string
>({
  key: "cardFilterPositionsFamily",
  default: {},
  effects: (cardId) => [
    ({ setSelf }) => {
      axios
        .get(`${API_BASE_URL}/api/cards/${cardId}/filter-panel-state`)
        .then((response) => {
          if (response.data.success && response.data.positions) {
            setSelf(response.data.positions);
          }
        })
        .catch((error) => {
          console.error("Failed to load card filter positions:", error);
        });
    },
  ],
});

