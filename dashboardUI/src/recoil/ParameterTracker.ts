import { atom } from 'recoil';
import { localStorageEffect } from './persistence';

export const parameterNamesState = atom<string[]>({
  key: 'parameterNamesState',
  default: [],
  effects:[
    localStorageEffect('parameterNames')
  ]
});
