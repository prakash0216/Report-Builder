import { Layout } from "react-grid-layout";
import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue
} from "./initializationState";
import { getCurrentViewId } from "./ViewContext";
import { API_BASE_URL } from '../config/api.config';

const ATOM_KEY = 'layoutState';

export const layoutState = atom<{ [key: string]: Layout[] }>({
    key: ATOM_KEY,
    default: {
      lg: [],
      md: [],
      sm: [],
      xs: [],
      xxs: [],
    },
    effects: [
        // Skip loading - DataInitializer handles this to avoid duplicate API calls
        ({ onSet }) => {
            // Save layouts to API when they change (debounced)
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
                        const totalItems = Object.values(newValue).reduce((sum, arr) => sum + (arr?.length || 0), 0);
                        console.log(`💾 [LayoutState SAVE] viewId=${viewId}, saving ${totalItems} layout items`);
                        
                        await axios.post(`${API_BASE_URL}/api/layouts`, {
                            layouts: newValue,
                            viewId, // Include viewId to scope to current view
                        });
                        console.log(`✅ LayoutState: Saved layouts (viewId: ${viewId})`);
                    } catch (error) {
                        console.error('❌ LayoutState: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
  });
