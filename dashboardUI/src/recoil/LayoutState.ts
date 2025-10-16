import { Layout } from "react-grid-layout";
import { atom } from "recoil";
import { localStorageEffect } from "./persistence";

export const layoutState = atom<{ [key: string]: Layout[] }>({
    key: 'layoutState',
    default: {
      lg: [],
      md: [],
      sm: [],
      xs: [],
      xxs: [],
    },
    effects: [
      localStorageEffect('gridLayouts')
  ]
  });
  