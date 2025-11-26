import { atomFamily } from 'recoil';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing parameters with database via API
const parameterDbSyncEffect = (param: string) => ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    // Only fetch if param is not empty
    if (!param || param.trim() === '' || param === '__placeholder__') {
      return;
    }
    
    axios.get(`${API_BASE_URL}/api/parameters/${param}`)
      .then(response => {
        if (response.data.success && response.data.value !== undefined) {
          setSelf(response.data.value);
        }
      })
      .catch(error => {
        // Only log error if it's not a 404 (parameter might not exist yet)
        if (error.response?.status !== 404) {
          console.error(`Error loading parameter ${param}:`, error);
        }
        // Keep default value on error
      });
  }

  // Save to database when value changes
  onSet((newValue: string, oldValue: string, isReset: boolean) => {
    // Only save if param is not empty
    if (!param || param.trim() === '' || param === '__placeholder__' || isReset || newValue === oldValue) {
      return;
    }
    
    axios.post(`${API_BASE_URL}/api/parameters/${param}`, { value: newValue })
      .then(response => {
        console.log(`✅ Parameter ${param} synced to database`);
      })
      .catch(error => {
        console.error(`❌ Error syncing parameter ${param}:`, error);
      });
  });
};

export const parameterAtomFamily = atomFamily<string, string>({
  key: 'parameterAtomFamily',
  default: '',
  effects: (param) => [
    parameterDbSyncEffect(param)
  ]
});