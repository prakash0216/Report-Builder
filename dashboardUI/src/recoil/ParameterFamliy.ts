import { atomFamily } from 'recoil';
import { localStorageEffect } from './persistence';

export const parameterAtomFamily = atomFamily<string, string>({
  key: 'parameterAtomFamily',
  default: '',
  effects:(param) => [
    localStorageEffect(`parameter_${param}`)]
});