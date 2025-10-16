import { atom } from "recoil";
import { localStorageEffect
    
 } from "./persistence";
export const chartConfigState=atom<{[id:string]:any}>({
    key:'chartConfigState',
    default:{},
    effects: [
        localStorageEffect('chartConfigs')
    ]
})