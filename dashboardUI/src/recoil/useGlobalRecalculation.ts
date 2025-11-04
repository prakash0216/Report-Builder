// hooks/useGlobalRecalculation.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useRecoilValue,
  useSetRecoilState,
  useRecoilCallback
} from 'recoil';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { storedLogicsState, StoredLogic } from '../recoil/StoredLogic';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily, filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { allFiltersSnapshotSelector } from '../recoil/AllFiltersSelector';
import { topNState } from '../recoil/topN';

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
  const location = useLocation();
  
  const storedLogics = useRecoilValue(storedLogicsState);
  const variableNames = useRecoilValue(variableNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const topNValue = useRecoilValue(topNState);
  const setVariableNames = useSetRecoilState(variableNamesState);
  const setStoredLogics = useSetRecoilState(storedLogicsState);
  const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);
  
  // Subscribe to all filter values via selector
  const allFiltersSnapshot = useRecoilValue(allFiltersSnapshotSelector);
  
  const recalculationInProgressRef = useRef(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  
  // Track initialization and previous snapshot
  const initializedRef = useRef(false);
  const previousSnapshotRef = useRef<string>('');
  const mountCalculationDoneRef = useRef(false);

  // Check if we're on dashboard route
  const isDashboardRoute = location.pathname === '/dashboards';

  // 🔑 CRITICAL FIX: Execute single logic with FRESH snapshot
  // Pass in logicsExecutedSoFar to get variables that were JUST calculated
  const executeSingleLogic = useRecoilCallback(({ set, snapshot }) => async (
    logic: StoredLogic,
    logicsExecutedSoFar: StoredLogic[] = []
  ) => {
    try {
      // 🔑 CRITICAL: Build list of variables from BOTH sources:
      // 1. variableNames (existing variables)
      // 2. logicsExecutedSoFar (variables just calculated in THIS batch)
      const allVariableNamesToRead = new Set([
        ...Array.from(variableNames),
        ...logicsExecutedSoFar.map(l => l.variableName)
      ]);

      console.log(`🔄 [Global Recalc] Executing logic for: ${logic.variableName}`);
      console.log(`   Variables to read:`, Array.from(allVariableNamesToRead));
      
      const allVariables: Record<string, any> = {};
      const allParameters: Record<string, any> = {};
      const allFilters: Record<string, any> = {};
      
      // Get all computed variables (including those just calculated!)
      allVariableNamesToRead.forEach(varName => {
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

      // Get live filter values
      filterNames.forEach(filterId => {
        try {
          const filterConfig = snapshot.getLoadable(filterConfigFamily(filterId)).contents;
          
          if (filterConfig && filterConfig.variableName) {
            const selectedOptions = snapshot.getLoadable(liveFilterFamily(filterConfig.variableName)).contents;
            allFilters[filterConfig.variableName] = selectedOptions;
          }
        } catch (err) {
          console.warn(`[Global Recalc] Failed to load live filter value for ${filterId}:`, err);
        }
      });
      
      // Always include topN
      allVariables['topN'] = topNValue;
      
      console.log(`📦 [Global Recalc] Fresh variables:`, Object.keys(allVariables));
      console.log(`📦 [Global Recalc] Fresh parameters:`, Object.keys(allParameters));
      console.log(`📦 [Global Recalc] Fresh filters:`, Object.keys(allFilters));
      
      const response = await fetch('http://localhost:3002/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logic: logic.logic,
          existingVariables: allVariables,
          existingParameters: allParameters,
          existingFilters: allFilters,
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

      // Update the variable atom
      set(variableAtomFamily(logic.variableName), JSON.stringify(calculatedValue));

      // Update variable names set
      setVariableNames(prev => {
        const newSet = new Set(prev);
        newSet.add(logic.variableName);
        return newSet;
      });

      // Update last executed time
      setStoredLogics(prev => prev.map(l => 
        l.id === logic.id ? { ...l, lastExecuted: Date.now() } : l
      ));

      return { success: true, result: calculatedValue };
    } catch (err) {
      console.error(`❌ [Global Recalc] Failed to execute logic for ${logic.variableName}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [variableNames, parameterNames, filterNames, topNValue, setVariableNames, setStoredLogics]);

  // Global recalculation function
  const recalculateAllLogics = useCallback(async () => {
    if (storedLogics.length === 0) {
      console.log('⏭️ [Global Recalc] No stored logics to recalculate');
      return;
    }
    
    // Prevent concurrent recalculations
    if (recalculationInProgressRef.current) {
      console.log('⏸️ [Global Recalc] Already in progress, skipping...');
      return;
    }

    recalculationInProgressRef.current = true;
    setIsRecalculating(true);
    
    console.log(`🚀 [Global Recalc] Starting recalculation for ${storedLogics.length} logics...`);

    try {
      // Execute in creation order
      const sortedLogics = [...storedLogics].sort((a, b) => a.createdAt - b.createdAt);
      
      console.log(`📋 [Global Recalc] Execution order:`, sortedLogics.map(l => l.variableName));
      
      const results = [];
      const executedSoFar: StoredLogic[] = [];
      
      // 🔑 CRITICAL: Pass executedSoFar to each iteration
      for (const logic of sortedLogics) {
        console.log(`\n═══════════════════════════════════════`);
        console.log(`Iteration ${results.length + 1}/${sortedLogics.length}`);
        console.log(`Previously executed:`, executedSoFar.map(l => l.variableName));
        console.log(`═══════════════════════════════════════`);
        
        const result = await executeSingleLogic(logic, executedSoFar);
        results.push({ logic: logic.variableName, ...result });
        
        // Add to executed list so next iteration can see it
        if (result.success) {
          executedSoFar.push(logic);
        }
      }

      // Trigger dashboard update
      setUpdateTrigger(prev => {
        const newValue = prev + 1;
        console.log(`✅ [Global Recalc] Update trigger set to ${newValue}`);
        return newValue;
      });

      console.log('✅ [Global Recalc] Completed:', results);
      return results;
    } finally {
      // Reset state
      setTimeout(() => {
        recalculationInProgressRef.current = false;
        setIsRecalculating(false);
        console.log('🏁 [Global Recalc] State reset');
      }, 300);
    }
  }, [storedLogics, executeSingleLogic, setUpdateTrigger]);

  // Initialize filter defaults
  const initializeFilterDefaults = useRecoilCallback(({ snapshot, set }) => async () => {
    console.log('🎬 [Global Recalc] Initializing filter defaults...');
    console.log(`   Filter count: ${filterNames.length}`);
    
    try {
      for (const filterId of filterNames) {
        const filterConfig = await snapshot.getPromise(filterConfigFamily(filterId));
        
        if (filterConfig?.defaultValues && filterConfig.defaultValues.length > 0 && filterConfig.variableName) {
          set(liveFilterFamily(filterConfig.variableName), filterConfig.defaultValues);
          console.log(`✅ [Global Recalc] Initialized filter: ${filterConfig.variableName}`, filterConfig.defaultValues);
        } else {
          console.warn(`⚠️ [Global Recalc] Filter ${filterId} has no default values or variableName`);
        }
      }
      
      console.log('✅ [Global Recalc] Filter initialization complete');
      console.log('⏱️ [Global Recalc] Waiting 600ms for filter state propagation...');
      await new Promise(resolve => setTimeout(resolve, 600));
      
      console.log('✅ [Global Recalc] Filter propagation complete');
      
    } catch (err) {
      console.error('❌ [Global Recalc] Error initializing filter defaults:', err);
      throw err;
    }
  }, [filterNames]);

  // Run initialization and calculation on mount - ONLY ON DASHBOARD ROUTE
  useEffect(() => {
    if (!isDashboardRoute) {
      console.log(`⏭️ [Global Recalc] Not on dashboard route (${location.pathname}), skipping mount calculations`);
      return;
    }

    console.log(`🎬 [Global Recalc] Mount effect triggered on dashboard. Logics: ${storedLogics.length}`);
    
    if (storedLogics.length > 0 && !mountCalculationDoneRef.current) {
      mountCalculationDoneRef.current = true;
      
      console.log('🎬 [Global Recalc] Running mount initialization sequence...');
      
      const runMountSequence = async () => {
        try {
          // Step 1: Initialize filter defaults
          await initializeFilterDefaults();
          
          // Step 2: Additional safety delay
          console.log('⏱️ [Global Recalc] Additional 200ms safety delay...');
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Step 3: Run calculations
          console.log('🎬 [Global Recalc] Starting initial calculations...');
          await recalculateAllLogics();
        } catch (err) {
          console.error('❌ [Global Recalc] Mount sequence failed:', err);
          mountCalculationDoneRef.current = false;
          setIsRecalculating(false);
        }
      };
      
      runMountSequence();
    } else if (storedLogics.length === 0) {
      console.log('⏭️ [Global Recalc] No logics to calculate');
    } else {
      console.log('⏭️ [Global Recalc] Already calculated on this mount');
    }
  }, [isDashboardRoute]);

  // Reset mount flag when leaving dashboard
  useEffect(() => {
    if (!isDashboardRoute && mountCalculationDoneRef.current) {
      console.log('🔄 [Global Recalc] Left dashboard, resetting mount flag for next visit');
      mountCalculationDoneRef.current = false;
      initializedRef.current = false;
    }
  }, [isDashboardRoute]);

  // Watch for filter changes AFTER mount
  useEffect(() => {
    if (!isDashboardRoute) {
      return;
    }

    if (storedLogics.length === 0) {
      return;
    }

    if (!mountCalculationDoneRef.current) {
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      previousSnapshotRef.current = allFiltersSnapshot;
      console.log('🎬 [Global Recalc] Initialized filter watcher:', allFiltersSnapshot);
      return;
    }

    if (allFiltersSnapshot !== previousSnapshotRef.current) {
      console.log('🔔 [Global Recalc] Filter values changed, triggering recalculation...');
      console.log('Previous:', previousSnapshotRef.current);
      console.log('Current:', allFiltersSnapshot);
      
      previousSnapshotRef.current = allFiltersSnapshot;
      
      const timer = setTimeout(() => {
        recalculateAllLogics();
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [allFiltersSnapshot, storedLogics.length, recalculateAllLogics, isDashboardRoute]);

  return {
    recalculateAllLogics,
    isRecalculating
  };
};