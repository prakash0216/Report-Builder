import { atom } from 'recoil';
import { localStorageEffect } from './persistence';

export const topNState = atom<number>({
  key: 'topNState',
  default: 10, // Default value is 10
  effects: [
    localStorageEffect<number>('topNState')
  ],
});