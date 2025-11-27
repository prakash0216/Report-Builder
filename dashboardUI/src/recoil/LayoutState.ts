import { Layout } from "react-grid-layout";
import { atom } from "recoil";
import axios from "axios";

export const layoutState = atom<{ [key: string]: Layout[] }>({
    key: 'layoutState',
    default: {
      lg: [],
      md: [],
      sm: [],
      xs: [],
      xxs: [],
    },
    effects: [
        ({ setSelf }) => {
            // Load layouts from API on initialization
            axios.get('http://localhost:3002/api/layouts')
                .then(response => {
                    if (response.data.success && response.data.layouts) {
                        setSelf(response.data.layouts);
                    }
                })
                .catch(error => {
                    console.error('Failed to load layouts:', error);
                });
        },
        ({ onSet }) => {
            // Save layouts to API when they change (debounced)
            let timeoutId: NodeJS.Timeout;
            onSet((newValue) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(async () => {
                    try {
                        await axios.post('http://localhost:3002/api/layouts', {
                            layouts: newValue,
                        });
                    } catch (error) {
                        console.error('Failed to save layouts:', error);
                    }
                }, 500); // Debounce by 500ms
            });
        },
    ]
  });
  