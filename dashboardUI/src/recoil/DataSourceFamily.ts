import { atomFamily,atom } from "recoil";
import { localStorageEffect } from "./persistence";

export const dataSourceAtomFamily = atomFamily<string,string>({
    key: 'dataSourceAtomFamily',
    default: '',
    effects: (param) => [
      localStorageEffect(`dataSource_${param}`)
  ]
  });
  

  // export const dataSourceNamesState = atom<string[]>({
  //   key: 'dataSourceNamesState',
  //   default: [], // initially no data sources
  // });