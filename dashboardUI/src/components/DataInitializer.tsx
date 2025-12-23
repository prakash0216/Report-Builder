// components/DataInitializer.tsx
import React, { useEffect } from 'react';
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
import { 
  dataLoadedState,
  startDataInitialization, 
  completeDataInitialization,
  updateLastValue 
} from '../recoil/initializationState';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Re-export dataLoadedState for backwards compatibility
export { dataLoadedState } from '../recoil/initializationState';

// Component to preload all data at app startup
export const DataInitializer: React.FC = () => {
  const setDataLoaded = useSetRecoilState(dataLoadedState);

  const initializeAllData = useRecoilCallback(({ set }) => async () => {
    console.log('🚀 [Data Initializer] Starting to preload all data from database...');
    
    // Signal that initialization is starting - block all saves
    startDataInitialization();
    
    try {
      // 1. Load all calculations
      console.log('📊 [Data Initializer] Loading calculations...');
      try {
        const calculationsResponse = await axios.get(`${API_BASE_URL}/api/calculations`);
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

      // 2. Load all parameter names and values
      console.log('📊 [Data Initializer] Loading parameters...');
      try {
        const paramsResponse = await axios.get(`${API_BASE_URL}/api/parameters/names`);
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

      // 3. Load all filters from the main filters endpoint (not individual ones)
      console.log('📊 [Data Initializer] Loading filters...');
      try {
        const filtersResponse = await axios.get(`${API_BASE_URL}/api/filters`);
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
              
              // Initialize filter with default values
              if (filterConfig.defaultValues && filterConfig.defaultValues.length > 0) {
                set(liveFilterFamily(dbFilter.variable_name), filterConfig.defaultValues);
              }
            } catch (parseErr) {
              console.warn(`⚠️ [Data Initializer] Failed to parse filter ${dbFilter.variable_name}:`, parseErr);
            }
          }
          console.log(`✅ [Data Initializer] Loaded all filter configs and default values`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load filters:', err);
      }

      // 4. Load chart configs
      console.log('📊 [Data Initializer] Loading chart configs...');
      try {
        const configsResponse = await axios.get(`${API_BASE_URL}/api/chart-configs`);
        if (configsResponse.data.success && configsResponse.data.configs) {
          const configs = configsResponse.data.configs;
          set(chartConfigState, configs);
          updateLastValue('chartConfigState', configs);
          console.log(`✅ [Data Initializer] Loaded chart configs for ${Object.keys(configs).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load chart configs:', err);
      }

      // 5. Load layouts
      console.log('📊 [Data Initializer] Loading layouts...');
      try {
        const layoutsResponse = await axios.get(`${API_BASE_URL}/api/layouts`);
        if (layoutsResponse.data.success && layoutsResponse.data.layouts) {
          const layouts = layoutsResponse.data.layouts;
          set(layoutState, layouts);
          updateLastValue('layoutState', layouts);
          console.log(`✅ [Data Initializer] Loaded layouts for all breakpoints`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load layouts:', err);
      }

      // 6. Load chart visibility
      console.log('📊 [Data Initializer] Loading chart visibility...');
      try {
        const visibilityResponse = await axios.get(`${API_BASE_URL}/api/chart-visibility`);
        if (visibilityResponse.data.success && visibilityResponse.data.visibility) {
          const visibility = visibilityResponse.data.visibility;
          set(chartVisibilityVariableState, visibility);
          updateLastValue('chartVisibilityVariableState', visibility);
          console.log(`✅ [Data Initializer] Loaded visibility for ${Object.keys(visibility).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load chart visibility:', err);
      }

      // 7. Load card dimension conditions
      console.log('📊 [Data Initializer] Loading card dimension conditions...');
      try {
        const conditionsResponse = await axios.get(`${API_BASE_URL}/api/card-dimension-conditions`);
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

      // 8. Load filter panel state (positions and active filters)
      console.log('📊 [Data Initializer] Loading filter panel state...');
      try {
        const filterPanelResponse = await axios.get(`${API_BASE_URL}/api/filter-panel-state`);
        if (filterPanelResponse.data.success) {
          if (filterPanelResponse.data.positions) {
            set(filterPositionsState, filterPanelResponse.data.positions);
            console.log(`✅ [Data Initializer] Loaded filter positions`);
          }
          if (filterPanelResponse.data.activeFilterIds) {
            set(activeFilterIdsState, filterPanelResponse.data.activeFilterIds);
            console.log(`✅ [Data Initializer] Loaded ${filterPanelResponse.data.activeFilterIds.length} active filter IDs`);
          }
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load filter panel state:', err);
      }

      // 9. Load tooltip configs
      console.log('📊 [Data Initializer] Loading tooltip configs...');
      try {
        const tooltipResponse = await axios.get(`${API_BASE_URL}/api/tooltip-configs`);
        if (tooltipResponse.data.success && tooltipResponse.data.configs) {
          const configs = tooltipResponse.data.configs;
          set(tooltipConfigState, configs);
          updateLastValue('tooltipConfigState', configs);
          console.log(`✅ [Data Initializer] Loaded tooltip configs for ${Object.keys(configs).length} charts`);
        }
      } catch (err) {
        console.warn('⚠️ [Data Initializer] Failed to load tooltip configs:', err);
      }

      // 10. Load child card configs (multi-card containers)
      console.log('📊 [Data Initializer] Loading child card configs...');
      try {
        const childCardResponse = await axios.get(`${API_BASE_URL}/api/child-card-configs`);
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
    initializeAllData();
  }, [initializeAllData]);

  return null; // This component doesn't render anything
};
