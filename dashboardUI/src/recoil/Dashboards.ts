import { atom } from "recoil";
import { localStorageEffect } from "./persistence";

export interface Dashboard{
    id:string;
    name:string;
    slug?:string;
    description?:string;
    createdAt:number;
    updatedAt:number;
    thumbnail?:string;
    chartsCount:number;
    viewsCount?:number;
    icon?:string;
    color?:string;
    // New fields for enhanced library management
    dataSource?: string;           // Data source name
    timePeriodStart?: number;      // Calendar year start (e.g., 2020)
    timePeriodEnd?: number;        // Calendar year end (e.g., 2025)
    libraryType?: string;          // Core, Claims, Reference, Premium
    iconType?: 'text' | 'upload';  // Whether using text abbreviation or uploaded image
    iconText?: string;             // Custom 2-letter text for icon (max 2 chars)
    iconColor?: string;            // Custom color for text icon
    iconImageUrl?: string;         // URL of uploaded icon image
}

export const dashboardsManager=atom<Dashboard[]>({
    key:'dashboardsState',
    default:[],
    effects:[
        localStorageEffect('dashboards')
    ]
})
