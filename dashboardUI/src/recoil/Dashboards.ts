import { atom } from "recoil";
import { localStorageEffect } from "./persistence";

export interface Dashboard{
    id:string;
    name:string;
    description?:string;
    createdAt:number;
    updatedAt:number;
    thumbnail?:string;
    chartsCount:number;
}

export const dashboardsManager=atom<Dashboard[]>({
    key:'dashboardsState',
    default:[],
    effects:[
        localStorageEffect('dashboards')
    ]
})
