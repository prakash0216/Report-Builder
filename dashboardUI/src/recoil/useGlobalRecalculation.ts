// hooks/useGlobalRecalculation.ts
import { useEffect, useRef, useCallback } from 'react';
import {
  useRecoilValue,
  useSetRecoilState,
  useRecoilCallback
} from 'recoil';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { topNState } from '../recoil/topN';
import { storedLogicsState, StoredLogic } from '../recoil/StoredLogic';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily, filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';

// Helper to safely parse stored strings into arrays/objects/values
const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return Function('"use strict";return (' + value + ')')();
    } catch {
      return value;
    }
  }
};

export const useGlobalRecalculation = () => {
  const topNValue = useRecoilValue(topNState);
  const storedLogics = useRecoilValue(storedLogicsState);
  const variableNames = useRecoilValue(variableNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const setVariableNames = useSetRecoilState(variableNamesState);
  const setStoredLogics = useSetRecoilState(storedLogicsState);
  const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);
  
  const lastRecalculatedTopNRef = useRef<number | null>(null);
  const recalculationInProgressRef = useRef(false);

  // Function to get all variable, parameter, and filter values for sending to backend
  const getAllValuesForBackend = useRecoilCallback(({ snapshot }) => () => {
    const allVariables: Record<string, any> = {};
    const allParameters: Record<string, any> = {};
    const allFilters: Record<string, any> = {};
    
    // Get all computed variables
    variableNames.forEach(varName => {
      try {
        const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
        const parsedValue = safeParse(rawValue);
        if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
          allVariables[varName] = parsedValue;
        }
      } catch (err) {
        console.warn(`[Global Recalc] Failed to load variable ${varName}:`, err);
      }
    });

    // Get explicit parameter values
    const filterNamesSet = new Set(filterNames);
    
    parameterNames.forEach(paramName => {
      // Only collect parameters that are NOT claimed by a filter name
      if (!filterNamesSet.has(paramName)) { 
        try {
          const rawValue = snapshot.getLoadable(parameterAtomFamily(paramName)).contents;
          const parsedValue = safeParse(rawValue);
          if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
            allParameters[paramName] = parsedValue;
          }
        } catch (err) {
          console.warn(`[Global Recalc] Failed to load explicit parameter ${paramName}:`, err);
        }
      }
    });

    // Get live filter values using variableName from filterConfig
    filterNames.forEach(filterId => {
      try {
        // Get the filter config first to access variableName
        const filterConfig = snapshot.getLoadable(filterConfigFamily(filterId)).contents;
        
        if (filterConfig && filterConfig.variableName) {
          // Use variableName as the key to access liveFilterFamily
          const selectedOptions = snapshot.getLoadable(liveFilterFamily(filterConfig.variableName)).contents;
          
          // Store using variableName (e.g., "filter_msl_extract_MOP")
          allFilters[filterConfig.variableName] = selectedOptions;
          
          console.log(`✅ [Global Recalc] Loaded filter: ${filterConfig.variableName}`, selectedOptions);
        } else {
          console.warn(`⚠️ [Global Recalc] Filter config not found or missing variableName for filterId: ${filterId}`);
        }
      } catch (err) {
        console.warn(`[Global Recalc] Failed to load live filter value for ${filterId}:`, err);
      }
    });
    
    // Always include topN in the available variables
    allVariables['topN'] = topNValue;
    
    console.log('📦 [Global Recalc] All variables:', allVariables);
    console.log('📦 [Global Recalc] All parameters:', allParameters);
    console.log('📦 [Global Recalc] All filters:', allFilters);
    
    return { variables: allVariables, parameters: allParameters, filters: allFilters };
  }, [variableNames, parameterNames, filterNames, topNValue]);

  // Function to execute a single logic
  const executeSingleLogic = useRecoilCallback(({ set }) => async (logic: StoredLogic) => {
    try {
      const { variables, parameters, filters } = getAllValuesForBackend();
      
      console.log(`🔄 [Global Recalc] Executing logic for: ${logic.variableName}`);
      
      const response = await fetch('http://localhost:3002/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logic: logic.logic,
          existingVariables: variables,
          existingParameters: parameters,
          existingFilters: filters,
          variableName: logic.variableName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

      console.log(`✅ [Global Recalc] Success for ${logic.variableName}:`, 
        Array.isArray(calculatedValue) ? `Array with ${calculatedValue.length} items` : calculatedValue);

      // Update the variable atom using the logic's variable name
      set(variableAtomFamily(logic.variableName), JSON.stringify(calculatedValue));

      // Update variable names set
      setVariableNames(prev => {
        const newSet = new Set(prev);
        newSet.add(logic.variableName);
        return newSet;
      });

      // Update last executed time in stored logics
      setStoredLogics(prev => prev.map(l => 
        l.id === logic.id ? { ...l, lastExecuted: Date.now() } : l
      ));

      return { success: true, result: calculatedValue };
    } catch (err) {
      console.error(`❌ [Global Recalc] Failed to execute logic for ${logic.variableName}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [getAllValuesForBackend, setVariableNames, setStoredLogics]);

  // Global recalculation function
  const recalculateAllLogics = useCallback(async () => {
    if (storedLogics.length === 0) return;
    
    // Prevent concurrent recalculations
    if (recalculationInProgressRef.current) {
      console.log('⏸️ [Global Recalc] Already in progress, skipping...');
      return;
    }

    // Check if we already recalculated for this topN value
    if (lastRecalculatedTopNRef.current === topNValue) {
      console.log(`⏸️ [Global Recalc] Already recalculated for topN = ${topNValue}, skipping...`);
      return;
    }

    recalculationInProgressRef.current = true;
    
    console.log(`🚀 [Global Recalc] Starting recalculation for ${storedLogics.length} logics with topN = ${topNValue}...`);
    lastRecalculatedTopNRef.current = topNValue;

    try {
      const results = [];
      for (const logic of storedLogics) {
        const result = await executeSingleLogic(logic);
        results.push({ logic: logic.variableName, ...result });
      }

      // Trigger dashboard update
      setTimeout(() => {
        setUpdateTrigger(prev => {
          const newValue = prev + 1;
          console.log(`✅ [Global Recalc] Update trigger set to ${newValue}`);
          return newValue;
        });
      }, 100);

      console.log('✅ [Global Recalc] Completed:', results);
      return results;
    } finally {
      setTimeout(() => {
        recalculationInProgressRef.current = false;
        console.log('🏁 [Global Recalc] State reset');
      }, 200);
    }
  }, [storedLogics, executeSingleLogic, setUpdateTrigger, topNValue]);

  // Watch for topN changes and recalculate - THIS RUNS GLOBALLY
  useEffect(() => {
    if (
      topNValue && 
      storedLogics.length > 0 && 
      lastRecalculatedTopNRef.current !== topNValue &&
      !recalculationInProgressRef.current
    ) {
      console.log(`🔔 [Global Recalc] TopN changed from ${lastRecalculatedTopNRef.current} to ${topNValue}, triggering recalculation...`);
      
      // Small delay to ensure topN state has propagated
      setTimeout(() => {
        recalculateAllLogics();
      }, 50);
    }
  }, [topNValue, storedLogics.length, recalculateAllLogics]);

  return {
    recalculateAllLogics,
    isRecalculating: recalculationInProgressRef.current
  };
};