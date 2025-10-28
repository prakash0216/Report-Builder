// Create this file: recoil/VariableTracker.ts
import { atom, selector } from 'recoil';
import { variableAtomFamily } from './VariableFamily';

// Atom to track all variable names that have been created
export const variableNamesState = atom<Set<string>>({
  key: 'variableNamesState',
  default: new Set<string>(),
//   effects: [
//     localStorageSetEffect('variableNames')
// ]
});

// Atom to track variable updates for reactivity
export const variableUpdateTriggerState = atom<number>({
  key: 'variableUpdateTriggerState',
  default: 0,
//   effects: [
//     localStorageEffect('variableUpdateTrigger')
// ]
});

const _classificationCalculation =selector({
  key:'_hooksClassificationCalculation',
  get:({get})=>{
    const names=get(variableNamesState);
    const hooksArray:any=[];
    const hooksArrayOfArray:any=[];
    const hooksArrayOfObjects:any=[];

    names.forEach(paramName => {
      // 🔑 CORRECT WAY TO READ VALUE: Use the Recoil 'get' function
      const paramValue = get(variableAtomFamily(paramName)); 
      
      try {
        // Attempt to parse the value
        const parsedValue = JSON.parse(paramValue);
        
        if (Array.isArray(parsedValue)) {
          // Check Array of Arrays
          if (parsedValue.length > 0 && Array.isArray(parsedValue[0])) {
            hooksArrayOfArray.push(paramName);
          }
          // Check Array of Objects
          else if (parsedValue.length > 0 && typeof parsedValue[0] === 'object' && parsedValue[0] !== null) {
            hooksArrayOfObjects.push(paramName);
          }
          // Simple Array
          else {
            hooksArray.push(paramName);
          }
        }
      } catch (err) {
        // Value is not valid JSON (could be a string, number, or incomplete array/object)
      }
    });
    return {
      hooksArray,
      hooksArrayOfArray,
      hooksArrayOfObjects,
    };
  }
})

// Exported Selectors for use in components
export const hooksArraySelector = selector({
  key: 'hooksArraySelector',
  get: ({ get }) => get(_classificationCalculation).hooksArray,
});

export const hooksArrayOfArraySelector = selector({
  key: 'hooksArrayOfArraySelector',
  get: ({ get }) => get(_classificationCalculation).hooksArrayOfArray,
});

export const hooksArrayOfObjectsSelector = selector({
  key: 'hooksArrayOfObjectsSelector',
  get: ({ get }) => get(_classificationCalculation).hooksArrayOfObjects,
});