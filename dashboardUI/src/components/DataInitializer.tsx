// components/DataInitializer.tsx
import React, { useEffect, useRef } from 'react';
import { useSetRecoilState, useRecoilCallback } from 'recoil';
import { storedLogicsState } from '../recoil/StoredLogic';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { chartConfigState } from '../recoil/ChartConfig';
import { layoutState } from '../recoil/LayoutState';
import { chartVisibilityVariableState } from '../recoil/DashboardVisibility';
import { cardDimensionConditionsState } from '../recoil/Carddimensionstate ';
import { filterPositionsState, activeFilterIdsState } from './FilterPanel';
import { tooltipConfigState } from '../recoil/TooltipConfigState';
import { childCardConfigState } from '../recoil/ChildCardState';
import { predefinedFunctionsState } from '../recoil/PredefinedFunctionsState';
import { 
  dataLoadedState,
  startDataInitialization, 
  completeDataInitialization,
  updateLastValue,
  filterResetTriggerState
} from '../recoil/initializationState';
import { 
  currentViewContextState,
  setCurrentViewId, 
  setCurrentDashboardId 
} from '../recoil/ViewContext';
import { useParams } from 'react-router-dom';
import axios from 'axios';

import { API_BASE_URL } from '../config/api.config';

// Re-export dataLoadedState for backwards compatibility
export { dataLoadedState } from '../recoil/initializationState';

// Component to preload all data at app startup - now view-aware
export const DataInitializer: React.FC = () => {
  const setDataLoaded = useSetRecoilState(dataLoadedState);
  const { dashboardName: dashboardSlug, viewName: viewSlug } = useParams<{ dashboardName?: string; viewName?: string }>();
  const lastLoadedViewRef = useRef<string | null>(null);
  const lastLoadedDashboardRef = useRef<number | null>(null);

  // Fetch dashboard and view IDs from slugs
  // Returns { dashboardId, viewId, error } where error indicates if resource was not found
  const fetchViewContext = useRecoilCallback(({ set }) => async (): Promise<{ 
    dashboardId: number | null; 
    viewId: number | null; 
    error: 'dashboard_not_found' | 'view_not_found' | null;
  }> => {
    if (!dashboardSlug || !viewSlug) {
      // Not on a view page, clear context
      setCurrentViewId(null);
      setCurrentDashboardId(null);
      set(currentViewContextState, {
        dashboardId: null,
        dashboardSlug: null,
        viewId: null,
        viewSlug: null,
      });
      return { dashboardId: null, viewId: null, error: null };
    }

    try {
      // Get dashboard ID from slug
      const dashboardRes = await axios.get(`${API_BASE_URL}/api/dashboards/${dashboardSlug}`);
      if (!dashboardRes.data.success || !dashboardRes.data.dashboard) {
        console.error(`❌ [Data Initializer] Dashboard not found: "${dashboardSlug}"`);
        return { dashboardId: null, viewId: null, error: 'dashboard_not_found' };
      }
      const dashboardId = dashboardRes.data.dashboard.id;
      
      // Get view ID from slug
      const viewRes = await axios.get(`${API_BASE_URL}/api/dashboards/${dashboardSlug}/views/${viewSlug}`);
      if (!viewRes.data.success || !viewRes.data.view) {
        console.error(`❌ [Data Initializer] View not found: "${viewSlug}" in dashboard "${dashboardSlug}"`);
        return { dashboardId, viewId: null, error: 'view_not_found' };
      }
      const viewId = viewRes.data.view.id;

      // Update global context
      setCurrentViewId(viewId);
      setCurrentDashboardId(dashboardId);
      set(currentViewContextState, {
        dashboardId,
        dashboardSlug,
        viewId,
        viewSlug,
      });

      console.log(`✅ [Data Initializer] Context set: dashboardId=${dashboardId}, viewId=${viewId}`);
      return { dashboardId, viewId, error: null };
    } catch (err) {
      console.error('Failed to fetch view context:', err);
      return { dashboardId: null, viewId: null, error: null };
    }
  }, [dashboardSlug, viewSlug]);

  const initializeAllData = useRecoilCallback(({ set, snapshot }) => async (viewId: number | null, dashboardId: number | null) => {
    const viewIdParam = viewId ? `?viewId=${viewId}` : '';
    const dashboardIdParam = dashboardId ? `?dashboardId=${dashboardId}` : '';
    
    // Check if we're switching dashboards or just views within the same dashboard
    const isSameDashboard = lastLoadedDashboardRef.current === dashboardId;
    const isNewDashboard = !isSameDashboard && dashboardId !== null;
    
    console.log(`🚀 [Data Initializer] Starting to preload data (viewId: ${viewId}, dashboardId: ${dashboardId}, sameDashboard: ${isSameDashboard})...`);
    
    // Signal that initialization is starting - block all saves
    startDataInitialization();
    
    // Clear existing VIEW-SPECIFIC state before loading new data
    // (charts, layouts, visibility, etc. are view-specific)
    set(chartConfigState, {});
    set(layoutState, { lg: [], md: [], sm: [], xs: [], xxs: [] });
    set(chartVisibilityVariableState, {});
    set(cardDimensionConditionsState, {});
    set(tooltipConfigState, {});
    set(childCardConfigState, {});
    
    // NOTE: Filter panel state is DASHBOARD-scoped, so we DON'T clear it when switching views
    // within the same dashboard. Only clear when switching to a different dashboard.
    if (isNewDashboard) {
      console.log(`🔄 [Data Initializer] New dashboard - clearing filter panel state`);
      set(filterPositionsState, {});
      set(activeFilterIdsState, []);
    } else if (isSameDashboard) {
      console.log(`⏭️ [Data Initializer] Same dashboard - preserving filter panel state`);
    }
    
    try {
      // 1. Load all calculations (dashboard-scoped)
      console.log('📊 [Data Initializer] Loading calculations...');
      try {
        const calculationsResponse = await axios.get(`${API_BASE_URL}/api/calculations${dashboardIdParam}`);
        if (calculationsResponse.data.success && calculationsResponse.data.calculations) {
          const storedLogics = calculationsResponse.data.calculations.map((dbCalc: any) => ({
            id: dbCalc.id.toString(),
            variableName: dbCalc.variable_name,
            logic: dbCalc.logic,
            createdAt: new Date(dbCalc.created_at).getTime(),
            lastExecuted: dbCalc.last_executed ? new Date(dbCalc.last_executed).getTime() : undefined,
          }));
          set(storedLogicsState, storedLogics);
          console.log(`✅ [Data Initializer] Loaded ${storedLogics.length} calculations`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load calculations:', err);
      }

      // 1b. Load predefined functions (GLOBAL - shared across all dashboards)
      console.log('📊 [Data Initializer] Loading global predefined functions...');
      try {
        const functionsResponse = await axios.get(`${API_BASE_URL}/api/predefined-functions?global=true`);
        if (functionsResponse.data.success && functionsResponse.data.functions) {
          const loadedFunctions = functionsResponse.data.functions;
          set(predefinedFunctionsState, loadedFunctions);
          // Update last value to prevent duplicate saves on first edit
          updateLastValue('predefinedFunctionsState', loadedFunctions);
          console.log(`✅ [Data Initializer] Loaded ${loadedFunctions.length} global predefined functions`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load predefined functions:', err);
      }

      // 2. Load all parameter names and values (dashboard-scoped)
      console.log('📊 [Data Initializer] Loading parameters...');
      try {
        const paramsResponse = await axios.get(`${API_BASE_URL}/api/parameters/names${dashboardIdParam}`);
        if (paramsResponse.data.success && paramsResponse.data.parameterNames) {
          const paramNames = paramsResponse.data.parameterNames;
          set(parameterNamesState, paramNames);
          console.log(`✅ [Data Initializer] Loaded ${paramNames.length} parameter names`);
          
          // Load each parameter value
          for (const paramName of paramNames) {
            try {
              const paramValueResponse = await axios.get(`${API_BASE_URL}/api/parameters/${paramName}`);
              if (paramValueResponse.data.success && paramValueResponse.data.value !== undefined) {
                set(parameterAtomFamily(paramName), paramValueResponse.data.value);
              }
            } catch (err) {
              // Silently skip individual parameter errors
            }
          }
          console.log(`✅ [Data Initializer] Loaded all parameter values`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load parameters:', err);
      }

      // 3. Load all filters (dashboard-scoped configs, but ALWAYS reset values to defaults)
      console.log('📊 [Data Initializer] Loading filters...');
      let filtersResetToDefaults = false;
      try {
        const filtersResponse = await axios.get(`${API_BASE_URL}/api/filters${dashboardIdParam}`);
        if (filtersResponse.data.success && filtersResponse.data.filters) {
          const filters = filtersResponse.data.filters;
          const filterNames = filters.map((f: any) => f.variable_name);
          set(filterNamesState, filterNames);
          console.log(`✅ [Data Initializer] Loaded ${filterNames.length} filter names`);
          
          // Process each filter from the already-fetched data (no additional API calls)
          for (const dbFilter of filters) {
            try {
              const filterConfig = {
                id: dbFilter.id.toString(),
                category: dbFilter.category,
                paramName: dbFilter.param_name,
                displayName: dbFilter.display_name,
                variableName: dbFilter.variable_name,
                selectionType: dbFilter.selection_type as 'single' | 'multi',
                defaultValues: JSON.parse(dbFilter.default_values_json),
                availableOptions: JSON.parse(dbFilter.available_options_json),
                dsName: dbFilter.ds_name || undefined,
                labelIndex: dbFilter.label_index ?? undefined,
                valueIndex: dbFilter.value_index ?? undefined,
                labelKey: dbFilter.label_key || undefined,
                valuekey: dbFilter.value_key || undefined,
              };
              
              set(filterConfigFamily(dbFilter.variable_name), filterConfig);
              
              // 🔥 ALWAYS reset filter VALUES to defaults when visiting ANY view
              // This ensures dashboard shows fresh data with default filter values
              if (filterConfig.defaultValues && filterConfig.defaultValues.length > 0) {
                set(liveFilterFamily(dbFilter.variable_name), filterConfig.defaultValues);
                console.log(`🔄 [Data Initializer] Reset filter "${dbFilter.variable_name}" to defaults`);
                filtersResetToDefaults = true;
              }
            } catch (parseErr) {
              console.warn(`⚠️ [Data Initializer] Failed to parse filter ${dbFilter.variable_name}:`, parseErr);
            }
          }
          
          // 🔥 CRITICAL: Trigger recalculation AFTER filters are reset to defaults
          // This ensures charts/data recalculate with the new default filter values
          if (filtersResetToDefaults) {
            // Get current trigger value and increment it
            const currentTrigger = snapshot.getLoadable(filterResetTriggerState);
            const currentValue = currentTrigger.state === 'hasValue' ? currentTrigger.contents : 0;
            set(filterResetTriggerState, currentValue + 1);
            console.log(`🔄 [Data Initializer] Triggered filter reset recalculation (trigger: ${currentValue} -> ${currentValue + 1})`);
          }
          
          console.log(`✅ [Data Initializer] Loaded all filter configs and reset values to defaults`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load filters:', err);
      }

      // 4. Load chart configs (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading chart configs...');
      try {
        const configsResponse = await axios.get(`${API_BASE_URL}/api/chart-configs${viewIdParam}`);
        if (configsResponse.data.success && configsResponse.data.configs) {
          const configs = configsResponse.data.configs;
          set(chartConfigState, configs);
          updateLastValue('chartConfigState', configs);
          console.log(`✅ [Data Initializer] Loaded chart configs for ${Object.keys(configs).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load chart configs:', err);
      }

      // 5. Load layouts (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading layouts...');
      try {
        const layoutsResponse = await axios.get(`${API_BASE_URL}/api/layouts${viewIdParam}`);
        if (layoutsResponse.data.success && layoutsResponse.data.layouts) {
          const layouts = layoutsResponse.data.layouts;
          set(layoutState, layouts);
          updateLastValue('layoutState', layouts);
          console.log(`✅ [Data Initializer] Loaded layouts for all breakpoints`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load layouts:', err);
      }

      // 6. Load chart visibility (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading chart visibility...');
      try {
        const visibilityResponse = await axios.get(`${API_BASE_URL}/api/chart-visibility${viewIdParam}`);
        if (visibilityResponse.data.success && visibilityResponse.data.visibility) {
          const visibility = visibilityResponse.data.visibility;
          set(chartVisibilityVariableState, visibility);
          updateLastValue('chartVisibilityVariableState', visibility);
          console.log(`✅ [Data Initializer] Loaded visibility for ${Object.keys(visibility).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load chart visibility:', err);
      }

      // 7. Load card dimension conditions (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading card dimension conditions...');
      try {
        const conditionsResponse = await axios.get(`${API_BASE_URL}/api/card-dimension-conditions${viewIdParam}`);
        if (conditionsResponse.data.success && conditionsResponse.data.conditions) {
          const conditions = conditionsResponse.data.conditions;
          set(cardDimensionConditionsState, conditions);
          updateLastValue('cardDimensionConditionsState', conditions);
          const totalConditions = Object.values(conditions).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          console.log(`✅ [Data Initializer] Loaded ${totalConditions} dimension conditions`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load card dimension conditions:', err);
      }

      // 8. Load filter panel state (DASHBOARD-SCOPED - shared across all views in dashboard)
      // Only load when switching to a NEW dashboard (not when switching views within same dashboard)
      if (isNewDashboard || lastLoadedDashboardRef.current === null) {
        console.log('📊 [Data Initializer] Loading filter panel state (new dashboard)...');
        try {
          // Use dashboardId (not viewId) - filter panel state is shared across all views in a dashboard
          const filterPanelResponse = await axios.get(`${API_BASE_URL}/api/filter-panel-state${dashboardIdParam}`);
          if (filterPanelResponse.data.success) {
            if (filterPanelResponse.data.positions) {
              set(filterPositionsState, filterPanelResponse.data.positions);
              console.log(`✅ [Data Initializer] Loaded filter positions for dashboard ${dashboardId}`);
            }
            if (filterPanelResponse.data.activeFilterIds) {
              set(activeFilterIdsState, filterPanelResponse.data.activeFilterIds);
              console.log(`✅ [Data Initializer] Loaded ${filterPanelResponse.data.activeFilterIds.length} active filter IDs`);
            }
          }
        } catch (err) {
          console.warn('⚠️ [Data Initializer] Failed to load filter panel state:', err);
        }
      } else {
        console.log('⏭️ [Data Initializer] Skipping filter panel load - same dashboard, preserving state');
      }

      // 9. Load tooltip configs (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading tooltip configs...');
      try {
        const tooltipResponse = await axios.get(`${API_BASE_URL}/api/tooltip-configs${viewIdParam}`);
        if (tooltipResponse.data.success && tooltipResponse.data.configs) {
          const configs = tooltipResponse.data.configs;
          set(tooltipConfigState, configs);
          updateLastValue('tooltipConfigState', configs);
          console.log(`✅ [Data Initializer] Loaded tooltip configs for ${Object.keys(configs).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load tooltip configs:', err);
      }

      // 10. Load child card configs (VIEW-SCOPED)
      console.log('📊 [Data Initializer] Loading child card configs...');
      try {
        const childCardResponse = await axios.get(`${API_BASE_URL}/api/child-card-configs${viewIdParam}`);
        if (childCardResponse.data.success && childCardResponse.data.configs) {
          const configs = childCardResponse.data.configs;
          set(childCardConfigState, configs);
          updateLastValue('childCardConfigState', configs);
          console.log(`✅ [Data Initializer] Loaded child card configs for ${Object.keys(configs).length} containers`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load child card configs:', err);
      }

      // Signal that initialization is complete - allow saves
      completeDataInitialization();
      
      // Update the last loaded dashboard ref
      lastLoadedDashboardRef.current = dashboardId;
      
      // Mark data as loaded for UI
      setDataLoaded(true);
      console.log('✅ [Data Initializer] All data preloaded successfully!');
      
    } catch (err) {
      console.error('❌ [Data Initializer] Failed to preload data:', err);
      // Still complete initialization to allow app to function
      completeDataInitialization();
      setDataLoaded(true);
    }
  }, [setDataLoaded]);

  useEffect(() => {
    const initialize = async () => {
      const viewKey = `${dashboardSlug || 'none'}/${viewSlug || 'none'}`;
      
      console.log(`🔍 [DataInitializer] Route params: dashboardSlug="${dashboardSlug}", viewSlug="${viewSlug}"`);
      console.log(`🔍 [DataInitializer] View key: "${viewKey}"`);
      
      // 🔥 ALWAYS reload data when visiting a view to ensure:
      // 1. Filter values are reset to defaults
      // 2. Charts show fresh data based on default filter values
      // NO CACHING - fresh data every time for consistency
      
      // 🔥 Set dataLoaded to false BEFORE starting to load
      // This shows loading indicator in the UI
      setDataLoaded(false);
      
      // Fetch view context (dashboard/view IDs from slugs)
      console.log(`📡 [DataInitializer] Fetching view context...`);
      const { dashboardId, viewId, error } = await fetchViewContext();
      console.log(`📡 [DataInitializer] Got context: dashboardId=${dashboardId}, viewId=${viewId}, error=${error}`);
      
      // 🔥 CRITICAL: Do NOT initialize data if dashboard or view doesn't exist
      // This prevents database corruption from invalid routes
      if (error) {
        console.error(`🚫 [DataInitializer] Skipping data initialization due to error: ${error}`);
        // Mark data as "loaded" to prevent infinite loading state, but don't actually load data
        setDataLoaded(true);
        return;
      }
      
      // Only initialize data if we have valid dashboard and view IDs
      if (viewId === null || dashboardId === null) {
        console.warn(`⚠️ [DataInitializer] Missing viewId or dashboardId, skipping initialization`);
        setDataLoaded(true);
        return;
      }
      
      // Initialize data with the current view context
      await initializeAllData(viewId, dashboardId);
      
      // Update refs for dashboard-level optimizations (filter panel state)
      lastLoadedViewRef.current = viewKey;
      console.log(`✅ [DataInitializer] Loaded view "${viewKey}"`);
    };

    initialize();
  }, [dashboardSlug, viewSlug, fetchViewContext, initializeAllData, setDataLoaded]);

  return null; // This component doesn't render anything
};
