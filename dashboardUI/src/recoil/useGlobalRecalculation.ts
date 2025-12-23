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
import { filterResetTriggerState } from './initializationState';

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
  const filterResetTrigger = useRecoilValue(filterResetTriggerState);
  const setVariableNames = useSetRecoilState(variableNamesState);
  const setStoredLogics = useSetRecoilState(storedLogicsState);
  const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);
  
  // Subscribe to all filter values via selector
  const allFiltersSnapshot = useRecoilValue(allFiltersSnapshotSelector);
  
  const recalculationInProgressRef = useRef(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const cancellationTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  
  // 🔥 PERFORMANCE: Store calculated variables to avoid re-reading atoms
  const lastCalculatedVariablesRef = useRef<Record<string, any>>({});
  
  // Track initialization and previous snapshot
  const initializedRef = useRef(false);
  const previousSnapshotRef = useRef<string>('');
  const mountCalculationDoneRef = useRef(false);
  const mountSequenceRunningRef = useRef(false); // Atomic flag to prevent double execution

  // Check if we're on dashboard route
  const isDashboardRoute = location.pathname === '/dashboards';

  // 🔥 PERFORMANCE: Pre-fetch all context once, not per-calculation
  const getCalculationContext = useRecoilCallback(({ snapshot }) => async () => {
    const currentFilterNames = await snapshot.getPromise(filterNamesState);
    const currentParameterNames = await snapshot.getPromise(parameterNamesState);
    const currentVariableNames = await snapshot.getPromise(variableNamesState);
    
    const allParameters: Record<string, any> = {};
    const allFilters: Record<string, any> = {};
    
    // Get parameters (only non-filter ones)
    const filterNamesSet = new Set(currentFilterNames);
    for (const paramName of currentParameterNames) {
      if (!filterNamesSet.has(paramName)) {
        try {
          const rawValue = await snapshot.getPromise(parameterAtomFamily(paramName));
          const parsedValue = safeParse(rawValue);
          if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
            allParameters[paramName] = parsedValue;
          }
        } catch (err) { /* skip */ }
      }
    }
    
    // Get all live filter values
    for (const filterId of currentFilterNames) {
      try {
        const filterConfig = await snapshot.getPromise(filterConfigFamily(filterId));
        if (filterConfig?.variableName) {
          const selectedOptions = await snapshot.getPromise(liveFilterFamily(filterConfig.variableName));
          allFilters[filterConfig.variableName] = selectedOptions;
        }
      } catch (err) { /* skip */ }
    }
    
    return { currentVariableNames, allParameters, allFilters };
  });

  // 🔥 PERFORMANCE: Execute single logic with pre-fetched context
  const executeSingleLogicFast = useRecoilCallback(({ set, snapshot }) => async (
    logic: StoredLogic,
    context: { allParameters: Record<string, any>; allFilters: Record<string, any> },
    calculatedVariables: Record<string, any> // Variables calculated so far in this batch
  ) => {
    try {
      // Get current variables from snapshot + already calculated ones
      const currentVariableNames = await snapshot.getPromise(variableNamesState);
      const allVariables: Record<string, any> = { ...calculatedVariables };
      
      // Add existing variables from atoms
      currentVariableNames.forEach(varName => {
        if (!(varName in allVariables)) {
          try {
            const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
            const parsedValue = safeParse(rawValue);
            if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
              allVariables[varName] = parsedValue;
            }
          } catch (err) { /* skip */ }
        }
      });
      
      const response = await fetch('http://localhost:3002/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logic: logic.logic,
          existingVariables: allVariables,
          existingParameters: context.allParameters,
          existingFilters: context.allFilters,
          variableName: logic.variableName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

      return { success: true, variableName: logic.variableName, value: calculatedValue };
    } catch (err) {
      console.error(`❌ ${logic.variableName}:`, err);
      return { success: false, variableName: logic.variableName, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  });

  // 🔥 PERFORMANCE: Batch update all variables at once
  const batchUpdateVariables = useRecoilCallback(({ set, snapshot }) => async (
    updates: Array<{ variableName: string; value: any }>
  ) => {
    console.log(`📦 Batch updating ${updates.length} variables...`);
    
    const currentVarNames = await snapshot.getPromise(variableNamesState);
    const newVarNames = new Set(currentVarNames);
    
    // Apply all updates in one go
    for (const { variableName, value } of updates) {
      set(variableAtomFamily(variableName), JSON.stringify(value));
      newVarNames.add(variableName);
    }
    
    // Update variable names once
    set(variableNamesState, newVarNames);
    console.log(`✅ Batch update complete`);
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

    // Reset cancellation token
    cancellationTokenRef.current = { cancelled: false };
    recalculationInProgressRef.current = true;
    setIsRecalculating(true);
    
    console.log(`🚀 [Global Recalc] Starting recalculation for ${currentLogics.length} logics...`);

    try {
      // 🔥 PERFORMANCE: Pre-fetch ALL context ONCE before calculations
      console.log(`🔍 Fetching fresh context for calculations...`);
      const context = await getCalculationContext();
      console.log(`📋 Filter context:`, Object.keys(context.allFilters));
      console.log(`📋 Filter values:`, JSON.stringify(context.allFilters).substring(0, 200));
      
      if (cancellationTokenRef.current.cancelled) {
        console.log('⏸️ [Global Recalc] Cancelled during context loading');
        return;
      }
      
      // Execute in creation order
      const sortedLogics = [...currentLogics].sort((a, b) => a.createdAt - b.createdAt);
      console.log(`🚀 Calculating ${sortedLogics.length} logics...`);
      
      const results: Array<{ variableName: string; value: any; success: boolean }> = [];
      const calculatedVariables: Record<string, any> = {}; // Track calculated values for dependencies
      
      // Execute calculations sequentially (for dependency order) but with pre-fetched context
      for (const logic of sortedLogics) {
        if (cancellationTokenRef.current.cancelled) break;
        
        const result = await executeSingleLogicFast(logic, context, calculatedVariables);
        
        if (result.success && 'value' in result) {
          calculatedVariables[result.variableName] = result.value;
          results.push({ variableName: result.variableName, value: result.value, success: true });
        } else {
          results.push({ variableName: result.variableName, value: null, success: false });
        }
      }
      
      // 🔥 PERFORMANCE: Batch update ALL variables at once (single React re-render)
      if (!cancellationTokenRef.current.cancelled && results.length > 0) {
        const successfulUpdates = results
          .filter(r => r.success)
          .map(r => ({ variableName: r.variableName, value: r.value }));
        
        if (successfulUpdates.length > 0) {
          await batchUpdateVariables(successfulUpdates);
          
          // 🔥 PERFORMANCE: Cache calculated variables to avoid re-reading atoms
          lastCalculatedVariablesRef.current = { ...calculatedVariables };
        }
      }

      // Only trigger update if not cancelled
      if (!cancellationTokenRef.current.cancelled) {
        const currentTrigger = await snapshot.getPromise(variableUpdateTriggerState);
        set(variableUpdateTriggerState, currentTrigger + 1);
        console.log(`✅ Recalc complete: ${results.length} logics`);
      }
      
      return results;
    } catch (err) {
      console.error('❌ [Global Recalc] Fatal error during recalculation:', err);
      // Don't throw - just log and reset state
      return [];
    } finally {
      // 🔥 PERFORMANCE: Reset immediately, no delay needed
      recalculationInProgressRef.current = false;
      setIsRecalculating(false);
    }
  });
  
  // Cleanup on unmount - cancel any running calculations
  useEffect(() => {
    return () => {
      console.log('🧹 [Global Recalc] Component unmounting - cancelling calculations');
      cancellationTokenRef.current.cancelled = true;
      recalculationInProgressRef.current = false;
      setIsRecalculating(false);
    };
  }, []);

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

    console.log(`🎬 [Global Recalc] Mount effect triggered. Route: ${location.pathname}, Logics: ${storedLogics.length}, hasCompletedCalc: ${hasCompletedDashboardCalcRef.current}`);
    
    // 🔥 FIX: If returning to dashboard (already completed a calculation before), skip mount calculation
    // The filter reset trigger will handle recalculation with correct filter values
    if (isDashboardRoute && hasCompletedDashboardCalcRef.current) {
      console.log('⏭️ [Global Recalc] Returning to dashboard - skipping mount calculation (trigger will handle)');
      // Mark as done so other effects can proceed, but don't run calculations
      mountCalculationDoneRef.current = true;
      initializedRef.current = false;
      previousSnapshotRef.current = allFiltersSnapshot;
      return;
    }
    
    // Mark as running IMMEDIATELY (atomically) to prevent other effects from running
    mountSequenceRunningRef.current = true;
    mountCalculationDoneRef.current = true;
    
    console.log('🎬 [Global Recalc] Running mount initialization sequence (first time)...');
    
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
          // 🔥 Mark that we've completed at least one calculation on dashboard
          hasCompletedDashboardCalcRef.current = true;
          console.log('✅ [Global Recalc] First calculation complete, future returns will use trigger');
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
  // Track if we've EVER successfully calculated on dashboard (to distinguish first load from return)
  const hasCompletedDashboardCalcRef = useRef(false);
  
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
      return;
    }

    // Only trigger if filters actually changed (not just initialized)
    if (allFiltersSnapshot !== previousSnapshotRef.current) {
      console.log('🔔 [Global Recalc] Filter values changed, triggering recalculation...');

      previousSnapshotRef.current = allFiltersSnapshot;
      
      // 🔥 PERFORMANCE: Reduced debounce from 150ms to 30ms
      const timer = setTimeout(() => {
        recalculateAllLogics();
      }, 30);

      return () => clearTimeout(timer);
    }
  }, [allFiltersSnapshot, storedLogics.length, recalculateAllLogics, isDashboardRoute]);

  // 🔥 FIX: Watch for filter reset trigger and force recalculation
  // This ensures recalculation happens AFTER filters are reset to defaults
  const filterResetTriggerRef = useRef<number | null>(null); // Use null to detect FIRST run
  useEffect(() => {
    // Skip the very first mount (when ref is null)
    if (filterResetTriggerRef.current === null) {
      console.log('🔄 [Global Recalc] Filter reset trigger: initializing to', filterResetTrigger);
      filterResetTriggerRef.current = filterResetTrigger;
      return;
    }

    // Only trigger if we're on dashboard route
    if (!isDashboardRoute) {
      filterResetTriggerRef.current = filterResetTrigger;
      return;
    }

    // Check if trigger value actually changed
    if (filterResetTrigger !== filterResetTriggerRef.current) {
      console.log(`🔄 [Global Recalc] Filter reset trigger changed: ${filterResetTriggerRef.current} -> ${filterResetTrigger}, forcing recalculation...`);
      filterResetTriggerRef.current = filterResetTrigger;
      
      // Update the previous snapshot to current state so filter watcher doesn't double-trigger
      previousSnapshotRef.current = allFiltersSnapshot;
      
      // Force recalculation with retry logic if another calculation is in progress
      const executeWithRetry = async (attempt = 1, maxAttempts = 5) => {
        // Wait for any in-progress calculation to complete
        const waitForCompletion = async () => {
          let waited = 0;
          const maxWait = 3000; // 3 seconds max wait
          while (recalculationInProgressRef.current && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waited += 100;
          }
          return !recalculationInProgressRef.current;
        };

        console.log(`🔄 [Global Recalc] Attempt ${attempt}: waiting for any in-progress calculation...`);
        const ready = await waitForCompletion();
        
        if (ready) {
          console.log('🔄 [Global Recalc] Executing triggered recalculation...');
          await recalculateAllLogics();
        } else if (attempt < maxAttempts) {
          console.log(`⏳ [Global Recalc] Calculation still in progress, retrying... (attempt ${attempt + 1})`);
          await new Promise(resolve => setTimeout(resolve, 200));
          await executeWithRetry(attempt + 1, maxAttempts);
        } else {
          console.warn('⚠️ [Global Recalc] Max retry attempts reached, giving up');
        }
      };

      // Start after a short delay to ensure filter state has propagated
      const timer = setTimeout(() => {
        executeWithRetry();
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [filterResetTrigger, isDashboardRoute, allFiltersSnapshot, recalculateAllLogics]);

  // 🔥 PERFORMANCE: Get cached variables without re-reading atoms
  const getLastCalculatedVariables = useCallback(() => {
    return lastCalculatedVariablesRef.current;
  }, []);

  return {
    recalculateAllLogics,
    isRecalculating,
    getLastCalculatedVariables
  };
};