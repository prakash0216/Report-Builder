import { atomFamily } from 'recoil';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing parameters with database via API
const parameterDbSyncEffect = (param: string) => ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/parameters/${param}`)
      .then(response => {
        if (response.data.success && response.data.value !== undefined) {
          setSelf(response.data.value);
        }
      })
      .catch(error => {
        console.error(`Error loading parameter ${param}:`, error);
        // Keep default value on error
      });
  }

  // Save to database when value changes
  onSet((newValue: string, oldValue: string, isReset: boolean) => {
    if (!isReset && newValue !== oldValue) {
      axios.post(`${API_BASE_URL}/api/parameters/${param}`, { value: newValue })
        .then(response => {
          console.log(`✅ Parameter ${param} synced to database`);
        })
        .catch(error => {
          console.error(`❌ Error syncing parameter ${param}:`, error);
        });
    }
  });
};

export const parameterAtomFamily = atomFamily<string, string>({
  key: 'parameterAtomFamily',
  default: '',
  effects: (param) => [
    parameterDbSyncEffect(param)
  ]
});