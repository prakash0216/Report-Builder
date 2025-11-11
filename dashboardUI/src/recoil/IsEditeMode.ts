import { atom } from "recoil";

export const IsEditModeState=atom<boolean>({
    key:'isEditModeState',
    default:true
})