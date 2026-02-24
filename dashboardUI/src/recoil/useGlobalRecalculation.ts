// hooks/useGlobalRecalculation.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  useRecoilValue,
  useRecoilCallback
} from 'recoil';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { isDuckDBRef } from '../services/VariableStorageService';
import VariableStorageService from '../services/VariableStorageService';
import { storedLogicsState, StoredLogic } from '../recoil/StoredLogic';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily, filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { allFiltersSnapshotSelector } from '../recoil/AllFiltersSelector';
import { dataLoadedState } from '../components/DataInitializer';
import { filterResetTriggerState } from './initializationState';
import { API_BASE_URL } from '../config/api.config';

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
  const dataLoaded = useRecoilValue(dataLoadedState);
  const filterResetTrigger = useRecoilValue(filterResetTriggerState);
  
  // Subscribe to all filter values via selector
  const allFiltersSnapshot = useRecoilValue(allFiltersSnapshotSelector);
  
  const recalculationInProgressRef = useRef(false);
  const pendingRecalculationRef = useRef(false); // 🔥 FIX: Queue recalculation if one is in progress
  const [isRecalculating, setIsRecalculating] = useState(false);
  const cancellationTokenRef = useRef<{ cancelled: boolean }>({ cancelled: false });
  
  const lastCalculatedVariablesRef = useRef<Record<string, any>>({});
  
  // Track initialization and previous snapshot
  const initializedRef = useRef(false);
  const previousSnapshotRef = useRef<string>('');
  const mountCalculationDoneRef = useRef(false);
  const mountSequenceRunningRef = useRef(false); // Atomic flag to prevent double execution
  const prevPathnameRef = useRef(location.pathname);

  // Check if we're on a dashboard view route (/:dashboardName/:viewName)
  // This is true when we're viewing charts, not on management pages
  const isDashboardRoute = location.pathname.split('/').filter(Boolean).length >= 2;

  // 🔥 PERFORMANCE: Pre-fetch all context once, not per-calculation
  // Returns allVariables too so executeSingleLogicFast doesn't re-read atoms
  const getCalculationContext = useRecoilCallback(({ snapshot }) => async () => {
    const currentFilterNames = await snapshot.getPromise(filterNamesState);
    const currentParameterNames = await snapshot.getPromise(parameterNamesState);
    const currentVariableNames = await snapshot.getPromise(variableNamesState);
    
    const allParameters: Record<string, any> = {};
    const allFilters: Record<string, any> = {};
    const allVariables: Record<string, any> = {};
    
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

    // 🦆 DuckDB-WASM: Pre-fetch ALL variable values once (not per-calculation)
    // Large datasets are resolved from WASM memory; small ones from Recoil.
    const varNamesArray = Array.from(currentVariableNames);
    const varStorage = VariableStorageService.getInstance();
    for (let i = 0; i < varNamesArray.length; i++) {
      const varName = varNamesArray[i];
      try {
        const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
        const parsedValue = safeParse(rawValue);
        if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
          if (isDuckDBRef(parsedValue)) {
            allVariables[varName] = await varStorage.resolveVariableByName(varName, rawValue);
          } else {
            allVariables[varName] = parsedValue;
          }
        }
      } catch (err) { /* skip */ }
    }
    
    return { currentVariableNames, allParameters, allFilters, allVariables };
  });

  // 🔥🔥 PERFORMANCE: Send ALL calculations in a SINGLE HTTP request
  // This eliminates N HTTP round-trips → 1 round-trip
  // Previously: 40 calculations × ~200ms HTTP overhead = 8 seconds
  // Now: 1 HTTP request with all 40 calculations = ~100ms total
  const executeCalculationBatch = async (
    logics: StoredLogic[],
    baseContext: {
      allParameters: Record<string, any>;
      allFilters: Record<string, any>;
      allVariables: Record<string, any>;
    },
    cancellationToken: { cancelled: boolean }
  ): Promise<Array<{ variableName: string; value: any; success: boolean }>> => {
    if (cancellationToken.cancelled) return [];

    const serializeStart = performance.now();
    
    // Build the batch request payload
    const calculations = logics.map(logic => ({
      logic: logic.logic,
      variableName: logic.variableName,
    }));

    // 🦆 Phase 4: Split variables into refs (server-cached) vs inline (small)
    // Large variables that went through the server are already cached there —
    // we only need to send their names, not the full data.
    const variableRefs: string[] = [];
    const inlineVariables: Record<string, any> = {};
    const SIZE_THRESHOLD = 50_000; // ~50 KB JSON threshold

    for (const [name, value] of Object.entries(baseContext.allVariables)) {
      const jsonLen = Array.isArray(value) && value.length > 100
        ? JSON.stringify(value).length
        : 0;
      if (jsonLen > SIZE_THRESHOLD) {
        variableRefs.push(name); // server already has it
      } else {
        inlineVariables[name] = value;
      }
    }

    const requestBody = JSON.stringify({
      calculations,
      existingVariables: inlineVariables,
      existingParameters: baseContext.allParameters,
      existingFilters: baseContext.allFilters,
      variableRefs,
    });
    
    const serializeMs = (performance.now() - serializeStart).toFixed(0);
    console.log(`📦 [Batch] Serialized ${calculations.length} calculations in ${serializeMs}ms (payload: ${(requestBody.length / 1024).toFixed(1)}KB)`);

    try {
      const fetchStart = performance.now();
      let response = await fetch(`${API_BASE_URL}/api/calculate-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      let fetchMs = (performance.now() - fetchStart).toFixed(0);

      // 🦆 Cache-miss handling: if the server doesn't have some variables
      // in its cache (e.g. after IIS recycle), it returns 449 with the list
      // of missing names. We retry once, sending full data for those variables.
      if (response.status === 449) {
        const cacheMissData = await response.json();
        const missingNames: string[] = cacheMissData.missingVariables || [];
        console.warn(`⚠️ [Batch] Server cache miss for: ${missingNames.join(', ')} — retrying with full data`);

        // Move missing variables from refs → inline
        const retryInline = { ...inlineVariables };
        const retryRefs = variableRefs.filter(n => !missingNames.includes(n));
        for (const name of missingNames) {
          if (baseContext.allVariables[name] !== undefined) {
            retryInline[name] = baseContext.allVariables[name];
          }
        }

        const retryBody = JSON.stringify({
          calculations,
          existingVariables: retryInline,
          existingParameters: baseContext.allParameters,
          existingFilters: baseContext.allFilters,
          variableRefs: retryRefs,
        });

        console.log(`📦 [Batch] Retry payload: ${(retryBody.length / 1024).toFixed(1)}KB (sending ${missingNames.length} variables inline)`);
        const retryStart = performance.now();
        response = await fetch(`${API_BASE_URL}/api/calculate-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: retryBody,
        });
        fetchMs = (performance.now() - retryStart).toFixed(0);
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`❌ [Batch] HTTP ${response.status}: ${errorData.message}`);
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const parseStart = performance.now();
      const batchResult = await response.json();
      const parseMs = (performance.now() - parseStart).toFixed(0);
      
      console.log(`⚡ [Batch] HTTP round-trip: ${fetchMs}ms | Response parse: ${parseMs}ms | Server time: ${batchResult.totalMs}ms`);

      // Process results
      const results: Array<{ variableName: string; value: any; success: boolean }> = [];
      for (const r of batchResult.results) {
        if (r.success) {
          const calculatedValue = typeof r.value === 'string' ? safeParse(r.value) : r.value;
          results.push({ variableName: r.variableName, value: calculatedValue, success: true });
        } else {
          console.error(`❌ ${r.variableName}: ${r.error}`);
          results.push({ variableName: r.variableName, value: null, success: false });
        }
      }

      return results;
    } catch (err) {
      console.error(`❌ [Batch] Batch request failed:`, err);
      
      // 🔥 FALLBACK: If batch endpoint fails, fall back to individual requests
      console.warn('⚠️ [Batch] Falling back to individual requests...');
      return executeCalculationBatchFallback(logics, baseContext, cancellationToken);
    }
  };

  // Fallback: individual requests (only used if batch endpoint is unavailable)
  const executeCalculationBatchFallback = async (
    logics: StoredLogic[],
    baseContext: {
      allParameters: Record<string, any>;
      allFilters: Record<string, any>;
      allVariables: Record<string, any>;
    },
    cancellationToken: { cancelled: boolean }
  ): Promise<Array<{ variableName: string; value: any; success: boolean }>> => {
    const results: Array<{ variableName: string; value: any; success: boolean }> = [];
    const calculatedVariables: Record<string, any> = {};

    for (const logic of logics) {
      if (cancellationToken.cancelled) break;
      try {
        const mergedVariables = { ...baseContext.allVariables, ...calculatedVariables };

        // 🦆 Phase 4: Same ref-splitting for fallback individual requests
        const refs: string[] = [];
        const inline: Record<string, any> = {};
        for (const [n, v] of Object.entries(mergedVariables)) {
          const len = Array.isArray(v) && v.length > 100 ? JSON.stringify(v).length : 0;
          if (len > 50_000) refs.push(n);
          else inline[n] = v;
        }

        const response = await fetch(`${API_BASE_URL}/api/calculate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logic: logic.logic,
            existingVariables: inline,
            existingParameters: baseContext.allParameters,
            existingFilters: baseContext.allFilters,
            variableName: logic.variableName,
            variableRefs: refs,
          }),
        });
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const result = await response.json();
        const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;
        calculatedVariables[logic.variableName] = calculatedValue;
        results.push({ variableName: logic.variableName, value: calculatedValue, success: true });
      } catch (err) {
        console.error(`❌ ${logic.variableName}:`, err);
        results.push({ variableName: logic.variableName, value: null, success: false });
      }
    }
    return results;
  };

  // Batch update all variables in Recoil at once (single React re-render)
  const batchUpdateVariables = useRecoilCallback(({ set, snapshot }) => async (
    updates: Array<{ variableName: string; value: any }>
  ) => {
    const currentVarNames = await snapshot.getPromise(variableNamesState);
    const newVarNames = new Set(currentVarNames);
    
    for (const { variableName, value } of updates) {
      set(variableAtomFamily(variableName), JSON.stringify(value));
      newVarNames.add(variableName);
    }
    
    set(variableNamesState, newVarNames);
  });

  // Global recalculation function
  const recalculateAllLogics = useRecoilCallback(({ snapshot, set }) => async () => {
    // Get stored logics from snapshot
    const currentLogics = await snapshot.getPromise(storedLogicsState);
    
    if (currentLogics.length === 0) {
      console.log('⏭️ [Global Recalc] No stored logics to recalculate');
      return;
    }
    
    // 🔥 FIX: Queue recalculation instead of silently dropping it
    if (recalculationInProgressRef.current) {
      console.log('⏸️ [Global Recalc] Already in progress, queuing new request...');
      pendingRecalculationRef.current = true;
      cancellationTokenRef.current.cancelled = true; // Cancel the current one
      return;
    }

    // Reset cancellation token
    cancellationTokenRef.current = { cancelled: false };
    recalculationInProgressRef.current = true;
    setIsRecalculating(true);
    
    const recalcStartTime = performance.now();
    console.log(`🚀 [Recalc] Starting ${currentLogics.length} logics...`);

    try {
      // Phase 1: Gather all context (filters, params, variables) from Recoil
      const contextStartTime = performance.now();
      const context = await getCalculationContext();
      const contextMs = performance.now() - contextStartTime;
      
      if (cancellationTokenRef.current.cancelled) return;
      
      // Phase 2: Sort logics by creation order (dependency order)
      const sortedLogics = [...currentLogics].sort((a, b) => a.createdAt - b.createdAt);
      
      // Phase 3: Send ALL calculations in a SINGLE HTTP request to backend
      const calcStartTime = performance.now();
      const results = await executeCalculationBatch(sortedLogics, context, cancellationTokenRef.current);
      const calcMs = performance.now() - calcStartTime;
      
      // Phase 4: Write all results back to Recoil state in one batch
      if (!cancellationTokenRef.current.cancelled && results.length > 0) {
        const updateStartTime = performance.now();
        const successfulUpdates = results
          .filter(r => r.success)
          .map(r => ({ variableName: r.variableName, value: r.value }));
        
        if (successfulUpdates.length > 0) {
          await batchUpdateVariables(successfulUpdates);
          
          const calculatedVariables: Record<string, any> = {};
          for (const u of successfulUpdates) {
            calculatedVariables[u.variableName] = u.value;
          }
          lastCalculatedVariablesRef.current = { ...calculatedVariables };
        }
        const updateMs = performance.now() - updateStartTime;

        // Phase 5: Trigger UI re-render
        const currentTrigger = await snapshot.getPromise(variableUpdateTriggerState);
        set(variableUpdateTriggerState, currentTrigger + 1);
        
        const totalMs = (performance.now() - recalcStartTime).toFixed(0);
        console.log(`✅ [Recalc] ${results.length} logics in ${totalMs}ms (context=${contextMs.toFixed(0)}ms, batch=${calcMs.toFixed(0)}ms, update=${updateMs.toFixed(0)}ms)`);
      }
      
      return results;
    } catch (err) {
      console.error('❌ [Global Recalc] Fatal error during recalculation:', err);
      // Don't throw - just log and reset state
      return [];
    } finally {
      // 🔥 FIX: Check for pending recalculation before resetting
      recalculationInProgressRef.current = false;
      setIsRecalculating(false);
      
      if (pendingRecalculationRef.current) {
        console.log('🔄 [Global Recalc] Executing pending recalculation...');
        pendingRecalculationRef.current = false;
        // Use setTimeout to avoid stack overflow from recursive calls
        setTimeout(() => recalculateAllLogics(), 0);
      }
    }
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancellationTokenRef.current.cancelled = true;
      recalculationInProgressRef.current = false;
      pendingRecalculationRef.current = false;
      setIsRecalculating(false);
    };
  }, []);

  // Run calculations on mount when data is loaded
  useEffect(() => {
    if (!dataLoaded) return;
    if (mountCalculationDoneRef.current || mountSequenceRunningRef.current) return;
    if (recalculationInProgressRef.current) return;
    if (storedLogics.length === 0) return;

    // If returning to dashboard (already completed before), skip — filter trigger will handle
    if (isDashboardRoute && hasCompletedDashboardCalcRef.current) {
      mountCalculationDoneRef.current = true;
      initializedRef.current = false;
      previousSnapshotRef.current = allFiltersSnapshot;
      return;
    }
    
    mountSequenceRunningRef.current = true;
    mountCalculationDoneRef.current = true;
    
    const runMountSequence = async () => {
      try {
        initializedRef.current = true; // Temporarily disable filter watcher
        await recalculateAllLogics();
        
        if (isDashboardRoute) {
          initializedRef.current = false;
          previousSnapshotRef.current = allFiltersSnapshot;
          hasCompletedDashboardCalcRef.current = true;
        }
        mountSequenceRunningRef.current = false;
      } catch (err) {
        console.error('❌ [Recalc] Mount sequence failed:', err);
        mountCalculationDoneRef.current = false;
        mountSequenceRunningRef.current = false;
        setIsRecalculating(false);
      }
    };
    
    runMountSequence();
  }, [storedLogics.length, dataLoaded, location.pathname, isDashboardRoute]);

  // Track if we've ever successfully calculated on dashboard
  const hasCompletedDashboardCalcRef = useRef(false);
  
  // Reset mount flags when leaving dashboard or when navigating to a different view
  useEffect(() => {
    const pathChanged = prevPathnameRef.current !== location.pathname;
    prevPathnameRef.current = location.pathname;

    if (!isDashboardRoute && mountCalculationDoneRef.current) {
      mountCalculationDoneRef.current = false;
      initializedRef.current = false;
      hasCompletedDashboardCalcRef.current = false;
    } else if (pathChanged && isDashboardRoute) {
      // Navigating between views — must re-run calculation after DataInitializer reloads
      mountCalculationDoneRef.current = false;
      mountSequenceRunningRef.current = false;
      hasCompletedDashboardCalcRef.current = false;
      initializedRef.current = false;
      previousSnapshotRef.current = '';
      cancellationTokenRef.current.cancelled = true;
    }
  }, [isDashboardRoute, location.pathname]);

  // Shared debounce timer — prevents double recalculations from filter watcher + reset trigger
  const recalcDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const scheduleRecalculation = useCallback((source: string) => {
    if (recalcDebounceTimerRef.current) {
      clearTimeout(recalcDebounceTimerRef.current);
    }
    console.log(`🔔 [Recalc] Filter changed (${source}), scheduling recalculation...`);
    recalcDebounceTimerRef.current = setTimeout(() => {
      recalcDebounceTimerRef.current = null;
      recalculateAllLogics();
    }, 150);
  }, [recalculateAllLogics]);

  // Watch for filter value changes AFTER mount calculation is done
  useEffect(() => {
    if (!isDashboardRoute || storedLogics.length === 0 || !mountCalculationDoneRef.current) return;

    // Initialize watcher on first run
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousSnapshotRef.current = allFiltersSnapshot;
      return;
    }

    if (allFiltersSnapshot !== previousSnapshotRef.current) {
      previousSnapshotRef.current = allFiltersSnapshot;
      scheduleRecalculation('filter-change');
      return () => {
        if (recalcDebounceTimerRef.current) clearTimeout(recalcDebounceTimerRef.current);
      };
    }
  }, [allFiltersSnapshot, storedLogics.length, isDashboardRoute, scheduleRecalculation]);

  // Watch for filter reset trigger (e.g. "Reset All" button)
  const filterResetTriggerRef = useRef<number | null>(null);
  useEffect(() => {
    if (filterResetTriggerRef.current === null) {
      filterResetTriggerRef.current = filterResetTrigger;
      return;
    }
    if (!isDashboardRoute) {
      filterResetTriggerRef.current = filterResetTrigger;
      return;
    }
    if (filterResetTrigger !== filterResetTriggerRef.current) {
      filterResetTriggerRef.current = filterResetTrigger;
      previousSnapshotRef.current = allFiltersSnapshot;
      scheduleRecalculation('filter-reset');
      return () => {
        if (recalcDebounceTimerRef.current) clearTimeout(recalcDebounceTimerRef.current);
      };
    }
  }, [filterResetTrigger, isDashboardRoute, allFiltersSnapshot, scheduleRecalculation]);

  const getLastCalculatedVariables = useCallback(() => {
    return lastCalculatedVariablesRef.current;
  }, []);

  return {
    recalculateAllLogics,
    isRecalculating,
    getLastCalculatedVariables
  };
};
