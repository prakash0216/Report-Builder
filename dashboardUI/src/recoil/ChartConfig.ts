import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
  markAtomInitialized 
} from "./initializationState";

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
                        // Save each chart config individually
                        for (const [chartId, config] of Object.entries(newValue)) {
                            await axios.post('http://localhost:3002/api/chart-configs', {
                                chartId,
                                template: config.template,
                                type: config.type,
                                processed: config.processed,
                                htmlContent: config.htmlContent,
                            });
                        }
                        console.log(`✅ ChartConfig: Saved ${Object.keys(newValue).length} configs`);
                    } catch (error) {
                        console.error('❌ ChartConfig: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
})
