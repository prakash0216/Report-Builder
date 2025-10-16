import { atom} from 'recoil';
import { localStorageEffect } from './persistence';

export const filterNamesState = atom<string[]>({
  key: 'filterNamesState',
  default: [],
  effects:[
    localStorageEffect('filterNames')
  ]
});

export const arrayFilterNamesState = atom<string[]>({
    key: 'arrayFilterNamesState',
    default: [],
    effects:[
        localStorageEffect('arrayFilterNames')
    ]
});

export const arrayOfArrayFilterNamesState = atom<string[]>({
    key: 'arrayOfArrayFilterNamesState',
    default: [],
    effects:[
        localStorageEffect('arrayOfFilterNames')
    ]
});

export const arrayOfObjectsFilterNamesState = atom<string[]>({
    key: 'arrayOfObjectsFilterNamesState',
    default: [],
    effects:[
        localStorageEffect('arrayOfObjectsFilterNames')
    ]
});