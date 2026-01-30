import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue
} from "./initializationState";
import { getCurrentViewId } from "./ViewContext";
import { API_BASE_URL } from '../config/api.config';

const ATOM_KEY = 'chartConfigState';

export const chartConfigState = atom<{[id:string]:any}>({
    key: ATOM_KEY,
    default:{},
    effects: [
        // Skip loading - DataInitializer handles this to avoid duplicate API calls
        ({ onSet }) => {
            // Save chart configs to API when they change (debounced)
            let timeoutId: NodeJS.Timeout;
            onSet((newValue, oldValue, isReset) => {
                // Skip saving during initialization
                if (shouldBlockSave()) {
                    updateLastValue(ATOM_KEY, newValue);
                    return;
                }
                
                // Skip if value hasn't actually changed
                if (!hasValueChanged(ATOM_KEY, newValue)) {
                    return;
                }
                
                clearTimeout(timeoutId);
                timeoutId = setTimeout(async () => {
                    try {
                        const viewId = getCurrentViewId();
                        console.log(`💾 [ChartConfig SAVE] viewId=${viewId}, saving ${Object.keys(newValue).length} configs`);
                        
                        // Save each chart config individually with viewId
                        for (const [chartId, config] of Object.entries(newValue)) {
                            console.log(`💾 [ChartConfig SAVE] Saving chartId="${chartId}" with viewId=${viewId}`);
                            await axios.post(`${API_BASE_URL}/api/chart-configs`, {
                                chartId,
                                viewId, // Include viewId to scope to current view
                                template: config.template,
                                type: config.type,
                                processed: config.processed,
                                htmlContent: config.htmlContent,
                                tableDataSource: config.tableDataSource,
                                tableSettings: config.tableSettings,
                            });
                        }
                        console.log(`✅ ChartConfig: Saved ${Object.keys(newValue).length} configs (viewId: ${viewId})`);
                    } catch (error) {
                        console.error('❌ ChartConfig: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
})
