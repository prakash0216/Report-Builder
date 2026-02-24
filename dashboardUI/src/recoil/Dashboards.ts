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
    timePeriodStart?: string | number | null;  // Calendar period start (e.g., "Jan 2020", "Q1 2020")
    timePeriodEnd?: string | number | null;    // Calendar period end (e.g., "Dec 2025", "present")
    libraryType?: string;          // Core, Claims, Reference, Premium
    iconType?: 'text' | 'upload';  // Whether using text abbreviation or uploaded image
    iconText?: string;             // Custom text for icon (max 5 chars)
    iconColor?: string;            // Custom color for text icon
    iconImageUrl?: string;         // URL of uploaded icon image
    // Additional fields
    adminPortalId?: string;        // Auto-generated admin portal permission ID
    embedType?: '' | 'iframe' | 'tableau';  // Embed type
    embedLink?: string;            // Embed link URL
    triggerCalculation?: string;   // Calculation to trigger on visit
    tableauSyncedAt?: string;      // Last time Tableau views were synced
}

export const dashboardsManager=atom<Dashboard[]>({
    key:'dashboardsState',
    default:[],
    effects:[
        localStorageEffect('dashboards')
    ]
})
