// recoil/ViewContext.ts
// Global view context state for scoping data to specific views
import { atom } from 'recoil';

// Current view context - used by all atoms to scope their data
export interface ViewContextState {
  dashboardId: number | null;
  dashboardSlug: string | null;
  viewId: number | null;
  viewSlug: string | null;
}

export const currentViewContextState = atom<ViewContextState>({
  key: 'currentViewContextState',
  default: {
    dashboardId: null,
    dashboardSlug: null,
    viewId: null,
    viewSlug: null,
  },
});

// Helper to get the viewId - can be called from anywhere
let currentViewId: number | null = null;
let currentDashboardId: number | null = null;

export const setCurrentViewId = (viewId: number | null) => {
  currentViewId = viewId;
};

export const getCurrentViewId = (): number | null => {
  return currentViewId;
};

export const setCurrentDashboardId = (dashboardId: number | null) => {
  currentDashboardId = dashboardId;
};

export const getCurrentDashboardId = (): number | null => {
  return currentDashboardId;
};

