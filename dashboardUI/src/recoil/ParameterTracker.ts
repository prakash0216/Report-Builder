import { atom, selector } from 'recoil';
import { parameterAtomFamily } from './ParameterFamliy';

// Track whether parameters have been loaded from database
export const parametersLoadedState = atom<boolean>({
  key: 'parametersLoadedState',
  default: false,
});

// Custom effect for syncing parameter names with database
// Note: DataInitializer loads parameter names at startup, so this effect is disabled
const parameterNamesDbEffect = ({ setSelf, onSet, trigger, getPromise, set }: any) => {
  // Skip loading - DataInitializer handles this to avoid duplicate API calls
};

export const parameterNamesState = atom<string[]>({
  key: 'parameterNamesState',
  default: [],
  effects: [
    parameterNamesDbEffect
  ]
});

const _classificationCalculation = selector({
  key: '_classificationCalculation',
  get: ({ get }) => {
    const names = get(parameterNamesState);
    const arrayParams: any = [];
    const arrayOfArrayParams: any = [];
    const arrayOfObjectsParams: any = [];

    names.forEach(paramName => {
      // 🔑 CORRECT WAY TO READ VALUE: Use the Recoil 'get' function
      const paramValue = get(parameterAtomFamily(paramName)); 
      
      try {
        // Attempt to parse the value
        const parsedValue = JSON.parse(paramValue);
        
        if (Array.isArray(parsedValue)) {
          // Check Array of Arrays
          if (parsedValue.length > 0 && Array.isArray(parsedValue[0])) {
            arrayOfArrayParams.push(paramName);
          }
          // Check Array of Objects
          else if (parsedValue.length > 0 && typeof parsedValue[0] === 'object' && parsedValue[0] !== null) {
            arrayOfObjectsParams.push(paramName);
          }
          // Simple Array
          else {
            arrayParams.push(paramName);
          }
        }
      } catch (err) {
        // Value is not valid JSON (could be a string, number, or incomplete array/object)
      }
    });
    return {
      arrayParams,
      arrayOfArrayParams,
      arrayOfObjectsParams,
    };
  }
});

// Exported Selectors for use in components
export const arrayParameterNamesSelector = selector({
  key: 'arrayParameterNamesSelector',
  get: ({ get }) => get(_classificationCalculation).arrayParams,
});

export const arrayOfArrayParameterNamesSelector = selector({
  key: 'arrayOfArrayParameterNamesSelector',
  get: ({ get }) => get(_classificationCalculation).arrayOfArrayParams,
});

export const arrayOfObjectsParameterNamesSelector = selector({
  key: 'arrayOfObjectsParameterNamesSelector',
  get: ({ get }) => get(_classificationCalculation).arrayOfObjectsParams,
});