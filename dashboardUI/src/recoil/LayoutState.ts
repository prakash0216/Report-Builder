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
                        const totalItems = Object.values(newValue).reduce((sum, arr) => sum + (arr?.length || 0), 0);
                        console.log(`💾 [LayoutState SAVE] viewId=${capturedViewId}, saving ${totalItems} layout items`);
                        
                        await axios.post(`${API_BASE_URL}/api/layouts`, {
                            layouts: newValue,
                            viewId: capturedViewId,
                        });
                        console.log(`✅ LayoutState: Saved layouts (viewId: ${capturedViewId})`);
                    } catch (error) {
                        console.error('❌ LayoutState: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
  });
