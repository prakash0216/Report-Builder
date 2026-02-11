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
                // 🔥 FIX: Always cancel pending timeout first to prevent cross-view saves
                clearTimeout(timeoutId);
                
                // Skip saving during initialization
                if (shouldBlockSave()) {
                    updateLastValue(ATOM_KEY, newValue);
                    return;
                }
                
                // Skip if value hasn't actually changed
                if (!hasValueChanged(ATOM_KEY, newValue)) {
                    return;
                }
                
                // 🔥 FIX: Capture viewId NOW (at set time), not later in the timeout
                const capturedViewId = getCurrentViewId();
                
                timeoutId = setTimeout(async () => {
                    try {
                        console.log(`💾 [ChartConfig SAVE] viewId=${capturedViewId}, saving ${Object.keys(newValue).length} configs`);
                        
                        // Save each chart config individually with viewId
                        for (const [chartId, config] of Object.entries(newValue)) {
                            await axios.post(`${API_BASE_URL}/api/chart-configs`, {
                                chartId,
                                viewId: capturedViewId,
                                template: config.template,
                                type: config.type,
                                processed: config.processed,
                                htmlContent: config.htmlContent,
                                tableDataSource: config.tableDataSource,
                                tableSettings: config.tableSettings,
                            });
                        }
                        console.log(`✅ ChartConfig: Saved ${Object.keys(newValue).length} configs (viewId: ${capturedViewId})`);
                    } catch (error) {
                        console.error('❌ ChartConfig: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
})
