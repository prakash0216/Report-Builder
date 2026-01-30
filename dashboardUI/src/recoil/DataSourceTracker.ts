import { atom } from 'recoil';
import axios from 'axios';

import { API_BASE_URL } from '../config/api.config';

// Interface for data source info
export interface DataSourceInfo {
  name: string;
  connectionId: number | null;
  connectionType: string | null;
  connectionName: string | null;
}

// Custom effect for syncing data source names with database
const dataSourceNamesDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/datasources/names`)
      .then(response => {
        if (response.data.success && response.data.dataSources) {
          // Extract just the names for backward compatibility
          const names = response.data.dataSources.map((ds: DataSourceInfo) => ds.name);
          setSelf(names);
          console.log('✅ Loaded data source names from database:', names);
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

// Atom to track all data source names (for backward compatibility)
export const dataSourceNamesState = atom<string[]>({
  key: 'dataSourceNamesState',
  default: [],
  effects: [
    dataSourceNamesDbEffect
  ]
});

// Atom to track all data source info (with connection details)
export const dataSourcesInfoState = atom<DataSourceInfo[]>({
  key: 'dataSourcesInfoState',
  default: [],
});

// Optional: Atom to track when data sources are updated (for triggering re-renders)
export const dataSourceUpdateTriggerState = atom<number>({
  key: 'dataSourceUpdateTriggerState', 
  default: 0,
});