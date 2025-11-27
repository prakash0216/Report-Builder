import { atom } from "recoil";
import axios from "axios";

export const chartConfigState = atom<{[id:string]:any}>({
    key:'chartConfigState',
    default:{},
    effects: [
        ({ setSelf }) => {
            // Load chart configs from API on initialization
            axios.get('http://localhost:3002/api/chart-configs')
                .then(response => {
                    if (response.data.success && response.data.configs) {
                        setSelf(response.data.configs);
                    }
                })
                .catch(error => {
                    console.error('Failed to load chart configs:', error);
                });
        },
        ({ onSet }) => {
            // Save chart configs to API when they change
            onSet(async (newValue) => {
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
                } catch (error) {
                    console.error('Failed to save chart configs:', error);
                }
            });
        },
    ]
})