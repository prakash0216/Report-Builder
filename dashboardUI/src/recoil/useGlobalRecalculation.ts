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
  const setVariableNames = useSetRecoilState(variableNamesState);
  const setStoredLogics = useSetRecoilState(storedLogicsState);
  const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);
  
  const lastRecalculatedTopNRef = useRef<number | null>(null);
  const recalculationInProgressRef = useRef(false);

  // Function to get all variable values for sending to backend
  const getAllVariableValues = useRecoilCallback(({ snapshot }) => () => {
    const allVariables: Record<string, any> = {};
    
    variableNames.forEach(varName => {
      try {
        const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
        const parsedValue = safeParse(rawValue);
        if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
          allVariables[varName] = parsedValue;
        }
      } catch (err) {
        console.warn(`Failed to load variable ${varName}:`, err);
      }
    });
    
    // Always include topN in the available variables
    allVariables['topN'] = topNValue;
    
    return allVariables;
  }, [variableNames, topNValue]);

  // Function to execute a single logic
  const executeSingleLogic = useRecoilCallback(({ set }) => async (logic: StoredLogic) => {
    try {
      const allVariables = getAllVariableValues();
      const response = await fetch('http://localhost:3002/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logic: logic.logic,
          existingVariables: allVariables,
          variableName: logic.variableName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error ${response.status}`);
      }

      const result = await response.json();
      const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

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
      console.error(`Failed to execute logic for ${logic.variableName}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [getAllVariableValues, setVariableNames, setStoredLogics]);

  // Global recalculation function
  const recalculateAllLogics = useCallback(async () => {
    if (storedLogics.length === 0) return;
    
    // Prevent concurrent recalculations
    if (recalculationInProgressRef.current) {
      console.log('Global: Recalculation already in progress, skipping...');
      return;
    }

    // Check if we already recalculated for this topN value
    if (lastRecalculatedTopNRef.current === topNValue) {
      console.log(`Global: Already recalculated for topN = ${topNValue}, skipping...`);
      return;
    }

    recalculationInProgressRef.current = true;
    
    console.log(`Global: Recalculating all stored logics with topN = ${topNValue}...`);
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
          console.log(`Global: Setting update trigger to ${newValue} after recalculation`);
          return newValue;
        });
      }, 100);

      console.log('Global: Recalculation completed:', results);
      return results;
    } finally {
      setTimeout(() => {
        recalculationInProgressRef.current = false;
        console.log('Global: Recalculation state reset');
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
      console.log(`Global: TopN changed from ${lastRecalculatedTopNRef.current} to ${topNValue}, triggering global recalculation...`);
      
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