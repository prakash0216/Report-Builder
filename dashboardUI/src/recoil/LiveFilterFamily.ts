import { atomFamily } from "recoil";
import { localStorageEffect } from "./persistence";

// Dedicated Atom Family for Live Filter Selections (Decoupled Global State)
// This serves as the single source of truth for the *current* selection value of any filter/hook.
// It stores the array of selected objects, e.g., [{label: "North", value: "N"}]
export const liveFilterFamily = atomFamily<any, string>({
    key: 'LiveFilterFamily',
    default: null, // Default to null until initialized with the filter's default value
    effects: (variableName) => [
        localStorageEffect(`liveFilter_${variableName}`),
    ],
});
