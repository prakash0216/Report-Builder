import { Layout } from "react-grid-layout";
import { atom } from "recoil";
import axios from "axios";
import { 
  shouldBlockSave, 
  hasValueChanged, 
  updateLastValue,
  markAtomInitialized 
} from "./initializationState";

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
                        await axios.post('http://localhost:3002/api/layouts', {
                            layouts: newValue,
                        });
                        console.log('✅ LayoutState: Saved layouts');
                    } catch (error) {
                        console.error('❌ LayoutState: Failed to save:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
  });
