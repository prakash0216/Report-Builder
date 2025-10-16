import { atomFamily } from "recoil";
import { localStorageEffect } from "./persistence";

export const variableAtomFamily = atomFamily<string,string>({
    key: 'variableAtomFamily',
    default: '',
  //   effects: (param) => [
  //     localStorageEffect(`variable_${param}`)
  // ]
  });
  