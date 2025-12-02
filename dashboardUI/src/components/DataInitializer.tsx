// components/DataInitializer.tsx
import React, { useEffect } from 'react';
import { atom, useSetRecoilState, useRecoilCallback } from 'recoil';
import { storedLogicsState } from '../recoil/StoredLogic';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { chartConfigState } from '../recoil/ChartConfig';
import { layoutState } from '../recoil/LayoutState';
import { chartVisibilityVariableState } from '../recoil/DashboardVisibility';
import { cardDimensionConditionsState } from '../recoil/Carddimensionstate ';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3002';

// Atom to track if all data has been loaded
export const dataLoadedState = atom<boolean>({
  key: 'dataLoadedState',
  default: false,
});

// Component to preload all data at app startup
export const DataInitializer: React.FC = () => {
  const setDataLoaded = useSetRecoilState(dataLoadedState);

  const initializeAllData = useRecoilCallback(({ set, snapshot }) => async () => {
    console.log('🚀 [Data Initializer] Starting to preload all data from database...');
    
    try {
      // 1. Load all calculations
      console.log('📊 [Data Initializer] Loading calculations...');
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

      // 2. Load all parameter names and values
      console.log('📊 [Data Initializer] Loading parameters...');
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
            console.warn(`⚠️ [Data Initializer] Failed to load parameter ${paramName}:`, err);
          }
        }
        console.log(`✅ [Data Initializer] Loaded all parameter values`);
      }

      // 3. Load all filters
      console.log('📊 [Data Initializer] Loading filters...');
      const filtersResponse = await axios.get(`${API_BASE_URL}/api/filters`);
      if (filtersResponse.data.success && filtersResponse.data.filters) {
        const filterNames = filtersResponse.data.filters.map((f: any) => f.variable_name);
        set(filterNamesState, filterNames);
        console.log(`✅ [Data Initializer] Loaded ${filterNames.length} filter names`);
        
        // Load each filter config and initialize default values
        for (const filterVariableName of filterNames) {
          try {
            const filterResponse = await axios.get(`${API_BASE_URL}/api/filters/${filterVariableName}`);
            if (filterResponse.data.success && filterResponse.data.filter) {
              const dbFilter = filterResponse.data.filter;
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
              
              set(filterConfigFamily(filterVariableName), filterConfig);
              
              // Initialize filter default values
              if (filterConfig.defaultValues && filterConfig.defaultValues.length > 0) {
                set(liveFilterFamily(filterVariableName), filterConfig.defaultValues);
              }
            }
          } catch (err) {
            console.warn(`⚠️ [Data Initializer] Failed to load filter ${filterVariableName}:`, err);
          }
        }
        console.log(`✅ [Data Initializer] Loaded all filter configs and default values`);
      }

      // 4. Load chart configs
      console.log('📊 [Data Initializer] Loading chart configs...');
      try {
        const configsResponse = await axios.get(`${API_BASE_URL}/api/chart-configs`);
        if (configsResponse.data.success && configsResponse.data.configs) {
          set(chartConfigState, configsResponse.data.configs);
          console.log(`✅ [Data Initializer] Loaded chart configs for ${Object.keys(configsResponse.data.configs).length} charts`);
        }
      } catch (err) {
        console.warn(`⚠️ [Data Initializer] Failed to load chart configs:`, err);
      }

      // 5. Load layouts
      console.log('📊 [Data Initializer] Loading layouts...');
      try {
        const layoutsResponse = await axios.get(`${API_BASE_URL}/api/layouts`);
        if (layoutsResponse.data.success && layoutsResponse.data.layouts) {
          set(layoutState, layoutsResponse.data.layouts);
          console.log(`✅ [Data Initializer] Loaded layouts for all breakpoints`);
        }
      } catch (err) {
        console.warn(`⚠️ [Data Initializer] Failed to load layouts:`, err);
      }

      // 6. Load chart visibility
      console.log('📊 [Data Initializer] Loading chart visibility...');
      try {
        const visibilityResponse = await axios.get(`${API_BASE_URL}/api/chart-visibility`);
        if (visibilityResponse.data.success && visibilityResponse.data.visibility) {
          set(chartVisibilityVariableState, visibilityResponse.data.visibility);
          console.log(`✅ [Data Initializer] Loaded visibility for ${Object.keys(visibilityResponse.data.visibility).length} charts`);
        }
      } catch (err) {
        console.warn(`⚠️ [Data Initializer] Failed to load chart visibility:`, err);
      }

      // 7. Load card dimension conditions
      console.log('📊 [Data Initializer] Loading card dimension conditions...');
      try {
        const conditionsResponse = await axios.get(`${API_BASE_URL}/api/card-dimension-conditions`);
        if (conditionsResponse.data.success && conditionsResponse.data.conditions) {
          set(cardDimensionConditionsState, conditionsResponse.data.conditions);
          const totalConditions = Object.values(conditionsResponse.data.conditions).reduce((sum: number, arr: any) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
          console.log(`✅ [Data Initializer] Loaded ${totalConditions} dimension conditions`);
        }
      } catch (err) {
        console.warn(`⚠️ [Data Initializer] Failed to load card dimension conditions:`, err);
      }

      // Mark data as loaded
      setDataLoaded(true);
      console.log('✅ [Data Initializer] All data preloaded successfully!');
      
    } catch (err) {
      console.error('❌ [Data Initializer] Failed to preload data:', err);
      // Still mark as loaded to prevent app from hanging
      setDataLoaded(true);
    }
  }, [setDataLoaded]);

  useEffect(() => {
    initializeAllData();
  }, [initializeAllData]);

  return null; // This component doesn't render anything
};

