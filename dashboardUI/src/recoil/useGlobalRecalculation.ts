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
import { dataLoadedState } from '../components/DataInitializer';

// Helper to safely parse stored strings into arrays/objects/values
const safeParse = (value: string): any => {
  // If it's a string that looks like a formatted number (contains commas), return as-is
  if (typeof value === 'string' && /^[\d,]+$/.test(value)) {
    return value;
  }
  
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
  const dataLoaded = useRecoilValue(dataLoadedState);
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
  const mountSequenceRunningRef = useRef(false); // Atomic flag to prevent double execution

  // Check if we're on dashboard route
  const isDashboardRoute = location.pathname === '/dashboards';

  // 🔑 CRITICAL FIX: Execute single logic with FRESH snapshot
  // Pass in logicsExecutedSoFar to get variables that were JUST calculated
  const executeSingleLogic = useRecoilCallback(({ set, snapshot }) => async (
    logic: StoredLogic,
    logicsExecutedSoFar: StoredLogic[] = []
  ) => {
    try {
      // 🔑 CRITICAL: Get FRESH filter and parameter names from snapshot (not closure!)
      const currentFilterNames = await snapshot.getPromise(filterNamesState);
      const currentParameterNames = await snapshot.getPromise(parameterNamesState);
      const currentVariableNames = await snapshot.getPromise(variableNamesState);
      
      // 🔑 CRITICAL: Build list of variables from BOTH sources:
      // 1. currentVariableNames (existing variables from snapshot)
      // 2. logicsExecutedSoFar (variables just calculated in THIS batch)
      const allVariableNamesToRead = new Set([
        ...Array.from(currentVariableNames),
        ...logicsExecutedSoFar.map(l => l.variableName)
      ]);

      console.log(`🔄 [Global Recalc] Executing logic for: ${logic.variableName}`);
      console.log(`   Variables to read:`, Array.from(allVariableNamesToRead));
      console.log(`   Filters available:`, currentFilterNames);
      console.log(`   Parameters available:`, currentParameterNames);
      
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

      // Get explicit parameter values - use getPromise to wait for values to load
      const filterNamesSet = new Set(currentFilterNames);
      
      for (const paramName of currentParameterNames) {
        if (!filterNamesSet.has(paramName)) { 
          try {
            // Use getPromise to ensure we wait for the parameter value to load from API
            const rawValue = await snapshot.getPromise(parameterAtomFamily(paramName));
            const parsedValue = safeParse(rawValue);
            if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
              allParameters[paramName] = parsedValue;
            }
          } catch (err) {
            console.warn(`[Global Recalc] Failed to load explicit parameter ${paramName}:`, err);
          }
        }
      }

      // Get live filter values - use getPromise to wait for values to load
      // 🔑 CRITICAL: Use currentFilterNames from snapshot, not closure!
      for (const filterId of currentFilterNames) {
        try {
          const filterConfig = await snapshot.getPromise(filterConfigFamily(filterId));
          
          if (filterConfig && filterConfig.variableName) {
            const selectedOptions = await snapshot.getPromise(liveFilterFamily(filterConfig.variableName));
            allFilters[filterConfig.variableName] = selectedOptions;
          }
        } catch (err) {
          console.warn(`[Global Recalc] Failed to load live filter value for ${filterId}:`, err);
        }
      }
      
      
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

      // Update variable names set - get current value from snapshot and update
      const currentVarNames = await snapshot.getPromise(variableNamesState);
      const newVarNames = new Set(currentVarNames);
      newVarNames.add(logic.variableName);
      set(variableNamesState, newVarNames);

      // Update last executed time - get current logics from snapshot and update
      const currentLogics = await snapshot.getPromise(storedLogicsState);
      const updatedLogics = currentLogics.map(l => 
        l.id === logic.id ? { ...l, lastExecuted: Date.now() } : l
      );
      set(storedLogicsState, updatedLogics);

      return { success: true, result: calculatedValue };
    } catch (err) {
      console.error(`❌ [Global Recalc] Failed to execute logic for ${logic.variableName}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // Global recalculation function
  const recalculateAllLogics = useRecoilCallback(({ snapshot, set }) => async () => {
    // Get stored logics from snapshot
    const currentLogics = await snapshot.getPromise(storedLogicsState);
    
    if (currentLogics.length === 0) {
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
    
    console.log(`🚀 [Global Recalc] Starting recalculation for ${currentLogics.length} logics...`);

    try {
      // 🔑 CRITICAL: Ensure filters and parameters are loaded before running calculations
      // This is especially important when triggered by filter change watcher
      const filterNames = await snapshot.getPromise(filterNamesState);
      const parameterNames = await snapshot.getPromise(parameterNamesState);
      
      // Quick check - if we have filters, verify at least one is loaded
      if (filterNames.length > 0) {
        console.log(`⏳ [Global Recalc] Verifying ${filterNames.length} filters are loaded...`);
        for (const filterVariableName of filterNames) {
          try {
            const filterConfig = await snapshot.getPromise(filterConfigFamily(filterVariableName));
            if (filterConfig?.variableName) {
              await snapshot.getPromise(liveFilterFamily(filterConfig.variableName));
            }
          } catch (err) {
            console.warn(`⚠️ [Global Recalc] Filter ${filterVariableName} not ready yet, waiting...`);
            // Wait a bit and retry
            await new Promise(resolve => setTimeout(resolve, 200));
            const retryConfig = await snapshot.getPromise(filterConfigFamily(filterVariableName));
            if (retryConfig?.variableName) {
              await snapshot.getPromise(liveFilterFamily(retryConfig.variableName));
            }
          }
        }
        console.log(`✅ [Global Recalc] All ${filterNames.length} filters verified`);
      }
      
      // Quick check - if we have parameters, verify they're loaded
      if (parameterNames.length > 0) {
        console.log(`⏳ [Global Recalc] Verifying ${parameterNames.length} parameters are loaded...`);
        for (const paramName of parameterNames) {
          await snapshot.getPromise(parameterAtomFamily(paramName));
        }
        console.log(`✅ [Global Recalc] All ${parameterNames.length} parameters verified`);
      }
      
      // Execute in creation order
      const sortedLogics = [...currentLogics].sort((a, b) => a.createdAt - b.createdAt);
      
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
      const currentTrigger = await snapshot.getPromise(variableUpdateTriggerState);
      set(variableUpdateTriggerState, currentTrigger + 1);
      console.log(`✅ [Global Recalc] Update trigger set to ${currentTrigger + 1}`);

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
  });

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

  // Helper function to wait for all initial data to be loaded (parameters AND filters)
  const waitForDataLoaded = useRecoilCallback(({ snapshot }) => async () => {
    const MAX_WAIT_TIME = 15000; // 15 seconds max wait
    const POLL_INTERVAL = 200; // Check every 200ms
    let elapsed = 0;
    
    console.log('⏳ [Global Recalc] Waiting for initial data to load (parameters and filters)...');
    
    while (elapsed < MAX_WAIT_TIME) {
      // Get current parameter names, filter names, and logics from snapshot
      const currentParamNames = await snapshot.getPromise(parameterNamesState);
      const currentFilterNames = await snapshot.getPromise(filterNamesState);
      const currentLogics = await snapshot.getPromise(storedLogicsState);
      
      // Must have logics to proceed
      if (currentLogics.length === 0) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        elapsed += POLL_INTERVAL;
        continue;
      }
      
      // Check if parameters are loaded
      let allParamsLoaded = true;
      const loadedParams: string[] = [];
      
      if (currentParamNames.length > 0) {
        for (const paramName of currentParamNames) {
          try {
            const paramValue = await snapshot.getPromise(parameterAtomFamily(paramName));
            loadedParams.push(paramName);
          } catch (err) {
            allParamsLoaded = false;
            break;
          }
        }
      }
      
      // Check if filters are loaded (both configs and values)
      let allFiltersLoaded = true;
      const loadedFilters: string[] = [];
      
      if (currentFilterNames.length > 0) {
        for (const filterVariableName of currentFilterNames) {
          try {
            // Check if filter config is loaded
            const filterConfig = await snapshot.getPromise(filterConfigFamily(filterVariableName));
            if (!filterConfig) {
              allFiltersLoaded = false;
              break;
            }
            
            // Check if filter value is loaded (from liveFilterFamily)
            if (filterConfig.variableName) {
              await snapshot.getPromise(liveFilterFamily(filterConfig.variableName));
              loadedFilters.push(filterVariableName);
            }
          } catch (err) {
            allFiltersLoaded = false;
            break;
          }
        }
      }
      
      // If both parameters and filters are loaded (or don't exist), we can proceed
      const paramsReady = currentParamNames.length === 0 || (allParamsLoaded && loadedParams.length === currentParamNames.length);
      const filtersReady = currentFilterNames.length === 0 || (allFiltersLoaded && loadedFilters.length === currentFilterNames.length);
      
      if (paramsReady && filtersReady) {
        const parts: string[] = [];
        if (loadedParams.length > 0) parts.push(`${loadedParams.length} parameters`);
        if (loadedFilters.length > 0) parts.push(`${loadedFilters.length} filters`);
        console.log(`✅ [Global Recalc] Data loaded: ${currentLogics.length} logics${parts.length > 0 ? `, ${parts.join(', ')}` : ''}`);
        if (loadedParams.length > 0) console.log(`   Parameters: ${loadedParams.join(', ')}`);
        if (loadedFilters.length > 0) console.log(`   Filters: ${loadedFilters.join(', ')}`);
        
        // Additional safety delay to ensure all state is fully propagated
        console.log('⏳ [Global Recalc] Waiting for all values to fully propagate...');
        await new Promise(resolve => setTimeout(resolve, 800));
        return true;
      }
      
      // Data not fully loaded yet, keep waiting
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
      elapsed += POLL_INTERVAL;
      
      if (elapsed % 1000 === 0) {
        const logicCount = currentLogics.length;
        const paramCount = currentParamNames.length;
        const filterCount = currentFilterNames.length;
        const loadedParamCount = loadedParams.length;
        const loadedFilterCount = loadedFilters.length;
        console.log(`⏳ [Global Recalc] Still waiting... (${elapsed}ms) - Logics: ${logicCount}, Params: ${loadedParamCount}/${paramCount}, Filters: ${loadedFilterCount}/${filterCount}`);
      }
    }
    
    // Timeout reached - check one more time if we can proceed
    const finalParamNames = await snapshot.getPromise(parameterNamesState);
    const finalFilterNames = await snapshot.getPromise(filterNamesState);
    if (finalParamNames.length === 0 && finalFilterNames.length === 0) {
      console.log('⚠️ [Global Recalc] Timeout reached, but no parameters or filters exist - proceeding');
      return true;
    }
    
    // Timeout with data that didn't load - this is an error condition
    console.warn('⚠️ [Global Recalc] Data load timeout - some parameters or filters may not be loaded. Proceeding anyway...');
    return false;
  }, []);

  // Single unified effect to handle mount calculations
  // Data is now preloaded at app startup, so we can skip waiting
  // Run calculations when data is loaded, regardless of route (needed for edit mode)
  useEffect(() => {
    // Wait for data to be preloaded
    if (!dataLoaded) {
      console.log('⏳ [Global Recalc] Waiting for data to be preloaded...');
      return;
    }

    // CRITICAL: Check if already done or in progress FIRST
    if (mountCalculationDoneRef.current || mountSequenceRunningRef.current) {
      console.log('⏭️ [Global Recalc] Already calculated or running, skipping...');
      return;
    }

    if (recalculationInProgressRef.current) {
      console.log('⏭️ [Global Recalc] Calculation already in progress, skipping...');
      return;
    }

    // Only proceed if we have logics to calculate
    if (storedLogics.length === 0) {
      console.log('⏭️ [Global Recalc] No logics to calculate');
      return;
    }

    console.log(`🎬 [Global Recalc] Mount effect triggered. Route: ${location.pathname}, Logics: ${storedLogics.length}`);
    
    // Mark as running IMMEDIATELY (atomically) to prevent other effects from running
    mountSequenceRunningRef.current = true;
    mountCalculationDoneRef.current = true;
    
    console.log('🎬 [Global Recalc] Running mount initialization sequence...');
    
    const runMountSequence = async () => {
      try {
        // Data is already preloaded by DataInitializer, so we can run calculations immediately
        initializedRef.current = true; // Temporarily disable filter watcher
        
        // Run calculations immediately (all data is already loaded)
        console.log('🎬 [Global Recalc] Starting initial calculations (data already preloaded)...');
        await recalculateAllLogics();
        
        // Re-enable filter watcher after calculations complete (only if on dashboard route)
        if (isDashboardRoute) {
          initializedRef.current = false;
          previousSnapshotRef.current = allFiltersSnapshot;
        }
        mountSequenceRunningRef.current = false; // Clear running flag
      } catch (err) {
        console.error('❌ [Global Recalc] Mount sequence failed:', err);
        mountCalculationDoneRef.current = false;
        mountSequenceRunningRef.current = false;
        setIsRecalculating(false);
      }
    };
    
    runMountSequence();
  }, [storedLogics.length, dataLoaded, location.pathname, isDashboardRoute]); // Watch logics, dataLoaded, and route

  // Reset mount flag when leaving dashboard
  useEffect(() => {
    if (!isDashboardRoute && mountCalculationDoneRef.current) {
      console.log('🔄 [Global Recalc] Left dashboard, resetting mount flag for next visit');
      mountCalculationDoneRef.current = false;
      initializedRef.current = false;
    }
  }, [isDashboardRoute]);

  // Watch for filter changes AFTER mount and initial calculation
  useEffect(() => {
    if (!isDashboardRoute) {
      return;
    }

    if (storedLogics.length === 0) {
      return;
    }

    // Don't trigger if mount calculation hasn't completed yet
    if (!mountCalculationDoneRef.current) {
      return;
    }

    // Initialize the watcher on first run (after mount calculation is done)
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousSnapshotRef.current = allFiltersSnapshot;
      console.log('🎬 [Global Recalc] Initialized filter watcher (after mount calculation):', allFiltersSnapshot);
      return;
    }

    // Only trigger if filters actually changed (not just initialized)
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