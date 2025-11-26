import { atomFamily } from "recoil";
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing with database via API
const dbSyncEffect = (param: string) => ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/datasources/${param}/query`)
      .then(response => {
        if (response.data.success && response.data.query) {
          setSelf(response.data.query);
        }
      })
      .catch(error => {
        console.error(`Error loading data source ${param}:`, error);
        // Keep default value on error
      });
  }

  // Save to database when value changes
  onSet((newValue: string, oldValue: string, isReset: boolean) => {
    if (!isReset && newValue !== oldValue) {
      axios.put(`${API_BASE_URL}/api/datasources/${param}/query`, { query: newValue })
        .then(response => {
          console.log(`✅ Data source ${param} synced to database`);
        })
        .catch(error => {
          console.error(`❌ Error syncing data source ${param}:`, error);
        });
    }
  });
};

export const dataSourceAtomFamily = atomFamily<string, string>({
  key: 'dataSourceAtomFamily',
  default: '',
  effects: (param) => [
    dbSyncEffect(param)
  ]
});