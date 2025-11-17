import { atom } from "recoil";
import { localStorageEffect } from "./persistence";

export const dahboardNameMain=atom({
    key:"dahboardName",
    default:'',
    effects:[
      localStorageEffect("DahboardName")
    ]
  })
