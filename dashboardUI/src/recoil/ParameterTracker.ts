import { atom, selector } from 'recoil';
import axios from 'axios';
import { parameterAtomFamily } from './ParameterFamliy';

const API_BASE_URL = 'http://localhost:3002';

// Custom effect for syncing parameter names with database
const parameterNamesDbEffect = ({ setSelf, onSet, trigger }: any) => {
  // Load initial value from database
  if (trigger === 'get') {
    axios.get(`${API_BASE_URL}/api/parameters/names`)
      .then(response => {
        if (response.data.success && response.data.parameterNames) {
          setSelf(response.data.parameterNames);
          console.log('✅ Loaded parameter names from database:', response.data.parameterNames);
        }
      })
      .catch(error => {
        console.error('❌ Error loading parameter names:', error);
        // Keep default value on error
      });
  }

  // Note: Individual parameter additions/removals are handled via API calls in components
  // This effect is primarily for loading the initial state
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