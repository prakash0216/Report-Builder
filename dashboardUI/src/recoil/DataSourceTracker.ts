import { atom } from 'recoil';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing data source names with database
const dataSourceNamesDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/datasources/names`)
      .then(response => {
        if (response.data.success && response.data.dataSourceNames) {
          setSelf(response.data.dataSourceNames);
          console.log('✅ Loaded data source names from database:', response.data.dataSourceNames);
        }
      })
      .catch(error => {
        console.error('❌ Error loading data source names:', error);
        // Keep default value on error
      });
  }

  // Note: Individual data source additions/removals are handled via API calls in components
  // This effect is primarily for loading the initial state
};

// Atom to track all data source names
export const dataSourceNamesState = atom<string[]>({
  key: 'dataSourceNamesState',
  default: [],
  effects: [
    dataSourceNamesDbEffect
  ]
});

// Optional: Atom to track when data sources are updated (for triggering re-renders)
export const dataSourceUpdateTriggerState = atom<number>({
  key: 'dataSourceUpdateTriggerState', 
  default: 0,
});