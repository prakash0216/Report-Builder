import { atomFamily } from 'recoil';
import axios from 'axios';
import { shouldBlockSave } from './initializationState';
import { getCurrentDashboardId } from './ViewContext';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing parameters with database via API
// Note: DataInitializer loads parameter values at startup
const parameterDbSyncEffect = (param: string) => ({ setSelf, onSet, trigger }: any) => {
  // Skip loading - DataInitializer handles this to avoid duplicate API calls

  // Save to database when value changes (after initialization)
  onSet((newValue: string, oldValue: string, isReset: boolean) => {
    // Skip saving during initialization
    if (shouldBlockSave()) {
      return;
    }
    
    // Only save if param is not empty
    if (!param || param.trim() === '' || param === '__placeholder__' || isReset || newValue === oldValue) {
      return;
    }
    
    const dashboardId = getCurrentDashboardId();
    axios.post(`${API_BASE_URL}/api/parameters/${param}`, { value: newValue, dashboardId })
      .then(response => {
        console.log(`✅ Parameter ${param} synced to database (dashboardId: ${dashboardId || 'global'})`);
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