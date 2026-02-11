// hooks/useOnClickActions.ts
// Runtime hook that executes onClick logic when a chart point is clicked.
// Extracts point data → runs calculations via /api/calculate-batch → writes results to variables → dashboard re-renders.

import { useCallback, useRef } from 'react';
import { useRecoilValue, useRecoilCallback } from 'recoil';
import { onClickConfigState, OnClickConfig } from '../recoil/OnClickConfigState';
import { onClickSnapshotState, OnClickSnapshot } from '../recoil/OnClickSnapshotState';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily, filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { API_BASE_URL } from '../config/api.config';

// Point data shape extracted from Highcharts
export interface ClickPointData {
  x: any;
  y: any;
  name: string;
  category: string;
  color: string;
  percentage: number;
  total: number;
  index: number;
  series: {
    name: string;
    index: number;
    type: string;
  };
  options: any;
}

// Helper to safely parse stored strings
const safeParse = (value: string): any => {
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

// Helper to get a nested value from an object using a dot-notation key
// e.g., getNestedValue(pointData, 'series.name') → pointData.series.name
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }
  return current;
};

export const useOnClickActions = () => {
  const onClickConfigs = useRecoilValue(onClickConfigState);
  const processingRef = useRef(false);

  // Gather all context (same pattern as useGlobalRecalculation's getCalculationContext)
  const getCalculationContext = useRecoilCallback(({ snapshot }) => async () => {
    const currentFilterNames = await snapshot.getPromise(filterNamesState);
    const currentParameterNames = await snapshot.getPromise(parameterNamesState);
    const currentVariableNames = await snapshot.getPromise(variableNamesState);

    const allParameters: Record<string, any> = {};
    const allFilters: Record<string, any> = {};
    const allVariables: Record<string, any> = {};

    // Get parameters
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

    // Get all variable values
    const varNamesArray = Array.from(currentVariableNames);
    for (const varName of varNamesArray) {
      try {
        const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
        const parsedValue = safeParse(rawValue);
        if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
          allVariables[varName] = parsedValue;
        }
      } catch (err) { /* skip */ }
    }

    return { allParameters, allFilters, allVariables };
  });

  // Main handler: called when a chart point is clicked
  // chartId can be the parent card ID; pointData._configKey has the full config key (parentId_childId)
  const handleChartClick = useRecoilCallback(({ snapshot, set }) =>
    async (chartId: string, pointData: ClickPointData) => {
      // Use _configKey from point data if available (set by ChildCard), else fall back to chartId
      const configKey = (pointData as any)?._configKey || chartId;
      const config: OnClickConfig | undefined = onClickConfigs[configKey];
      if (!config?.enabled) return;
      if (processingRef.current) {
        console.log('⏸️ [onClick] Already processing, skipping');
        return;
      }

      processingRef.current = true;
      const startTime = performance.now();
      console.log(`🖱️ [onClick] Chart "${configKey}" clicked. Point:`, {
        category: pointData.category,
        y: pointData.y,
        name: pointData.name,
        series: pointData.series?.name,
      });

      try {
        // Step 1: Extract click variables from point data (or chart config / table row) using dataMapping
        const clickVariables: Record<string, any> = {};
        const isTableClick = !!(pointData as any)?._isTableClick;

        for (const mapping of config.dataMapping) {
          if (!mapping.clickVariable) continue; // Skip mappings without a variable name

          if (mapping.extractionType === 'row') {
            // Extract from the clicked table row data
            const rowData = (pointData as any)?._rowData || {};
            if (mapping.sourceKey === '_rowData') {
              // Special key: the entire row object
              clickVariables[mapping.clickVariable] = rowData;
              console.log(`  📋 [row] _rowData → ${mapping.clickVariable} = ${JSON.stringify(rowData).substring(0, 100)}...`);
            } else if (mapping.sourceKey === '_rowIndex') {
              // Special key: the row index
              clickVariables[mapping.clickVariable] = (pointData as any)?._rowIndex ?? 0;
              console.log(`  📋 [row] _rowIndex → ${mapping.clickVariable} = ${(pointData as any)?._rowIndex}`);
            } else {
              // Column name: extract specific column value from row
              const value = rowData[mapping.sourceKey];
              clickVariables[mapping.clickVariable] = value;
              console.log(`  📋 [row] ${mapping.sourceKey} → ${mapping.clickVariable} = ${JSON.stringify(value)}`);
            }
          } else if (mapping.extractionType === 'config') {
            // Extract from the chart configuration (design-time data)
            const chartOptions = (pointData as any)?._chartOptions || {};
            const value = getNestedValue(chartOptions, mapping.sourceKey);
            clickVariables[mapping.clickVariable] = value;
            console.log(`  📋 [config] ${mapping.sourceKey} → ${mapping.clickVariable} = ${JSON.stringify(value)}`);
          } else {
            // Default ('point'): extract from the clicked point (runtime data)
            // For table clicks, also check _rowData as a fallback for column-named source keys
            let value = getNestedValue(pointData, mapping.sourceKey);
            if (value === undefined && isTableClick) {
              const rowData = (pointData as any)?._rowData || {};
              value = rowData[mapping.sourceKey];
            }
            clickVariables[mapping.clickVariable] = value;
            console.log(`  📋 [point] ${mapping.sourceKey} → ${mapping.clickVariable} = ${JSON.stringify(value)}`);
          }
        }

        // Step 2: Snapshot current values of all target variables (for reset)
        const currentSnapshot = await snapshot.getPromise(onClickSnapshotState);
        const originalValues: Record<string, string> = { ...currentSnapshot.originalValues };

        // Only snapshot variables we haven't already snapshot'd (i.e., first click)
        for (const calc of config.calculations) {
          if (!(calc.targetVariable in originalValues)) {
            if (calc.isCustomVariable) {
              // Custom variables don't exist yet — mark with a sentinel so reset knows to clear them
              originalValues[calc.targetVariable] = '__ONCLICK_CUSTOM_NEW__';
            } else {
              try {
                const currentVal = await snapshot.getPromise(variableAtomFamily(calc.targetVariable));
                originalValues[calc.targetVariable] = currentVal;
              } catch (err) {
                originalValues[calc.targetVariable] = '';
              }
            }
          }
        }

        // Save snapshot (include parent card ID for per-card reset button)
        set(onClickSnapshotState, {
          active: true,
          sourceChartId: configKey,
          sourceParentCardId: chartId, // The parent card ID passed from DragDropDashboard
          originalValues,
        });

        // Step 3: Build calculation context with click variables merged in
        const context = await getCalculationContext();
        const enrichedVariables = {
          ...context.allVariables,
          ...clickVariables,
        };

        // Sort calculations by order
        const sortedCalcs = [...config.calculations].sort((a, b) => a.order - b.order);

        // Step 4: Send to /api/calculate-batch (only if there are calculations)
        if (sortedCalcs.length > 0) {
          const calculations = sortedCalcs.map(c => ({
            logic: c.logic,
            variableName: c.targetVariable,
          }));

          console.log(`⚡ [onClick] Sending ${calculations.length} calculations to backend...`);

          const fetchStart = performance.now();
          const response = await fetch(`${API_BASE_URL}/api/calculate-batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              calculations,
              existingVariables: enrichedVariables,
              existingParameters: context.allParameters,
              existingFilters: context.allFilters,
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ [onClick] Backend error: ${errorData.message}`);
            // Don't return — snapshot is already set, reset button should still work
          } else {
            const batchResult = await response.json();
            const fetchMs = (performance.now() - fetchStart).toFixed(0);
            console.log(`✅ [onClick] Backend response in ${fetchMs}ms (server: ${batchResult.totalMs}ms)`);

            // Step 5: Write results back to Recoil state
            // Build a set of custom variable names from this config for registration
            const customVarNames = new Set(
              config.calculations.filter(c => c.isCustomVariable).map(c => c.targetVariable)
            );

            let successCount = 0;
            const newCustomVarNames: string[] = [];
            for (const r of batchResult.results) {
              if (r.success) {
                const calculatedValue = typeof r.value === 'string' ? r.value : JSON.stringify(r.value);
                set(variableAtomFamily(r.variableName), calculatedValue);
                successCount++;
                // Track custom variables that need to be registered
                if (customVarNames.has(r.variableName)) {
                  newCustomVarNames.push(r.variableName);
                }
                console.log(`  ✅ ${r.variableName}${customVarNames.has(r.variableName) ? ' (new)' : ''} = ${calculatedValue.substring(0, 100)}${calculatedValue.length > 100 ? '...' : ''}`);
              } else {
                console.error(`  ❌ ${r.variableName}: ${r.error}`);
              }
            }

            // Register new custom variables in variableNamesState so they're available to other charts
            if (newCustomVarNames.length > 0) {
              const currentNames = await snapshot.getPromise(variableNamesState);
              const updatedNames = new Set(currentNames);
              for (const name of newCustomVarNames) {
                updatedNames.add(name);
              }
              if (updatedNames.size > currentNames.size) {
                set(variableNamesState, updatedNames);
                console.log(`  📝 Registered ${newCustomVarNames.length} new custom variable(s): ${newCustomVarNames.join(', ')}`);
              }
            }

            const totalMs = (performance.now() - startTime).toFixed(0);
            console.log(`🖱️ [onClick] Complete: ${successCount}/${calculations.length} succeeded in ${totalMs}ms`);
          }
        } else {
          console.log(`🖱️ [onClick] No calculations configured — highlight-only mode. Snapshot set.`);
        }

        // Step 6: Trigger UI re-render
        const currentTrigger = await snapshot.getPromise(variableUpdateTriggerState);
        set(variableUpdateTriggerState, currentTrigger + 1);

      } catch (err) {
        console.error('❌ [onClick] Error executing onClick actions:', err);
      } finally {
        processingRef.current = false;
      }
    }
  );

  // Reset handler: restores original variable values
  const handleReset = useRecoilCallback(({ snapshot, set }) => async () => {
    const clickState = await snapshot.getPromise(onClickSnapshotState);
    if (!clickState.active) return;

    console.log('🔄 [onClick Reset] Restoring original values...');

    const customVarsToRemove: string[] = [];

    // Restore all original values
    for (const [varName, originalValue] of Object.entries(clickState.originalValues)) {
      if (originalValue === '__ONCLICK_CUSTOM_NEW__') {
        // This was a custom variable created by onClick — clear it
        set(variableAtomFamily(varName), '');
        customVarsToRemove.push(varName);
        console.log(`  🗑️ ${varName} cleared (custom onClick variable)`);
      } else {
        set(variableAtomFamily(varName), originalValue);
        console.log(`  🔄 ${varName} restored`);
      }
    }

    // Remove custom variables from variableNamesState
    if (customVarsToRemove.length > 0) {
      const currentNames = await snapshot.getPromise(variableNamesState);
      const updatedNames = new Set(currentNames);
      for (const name of customVarsToRemove) {
        updatedNames.delete(name);
      }
      set(variableNamesState, updatedNames);
      console.log(`  📝 Removed ${customVarsToRemove.length} custom variable(s): ${customVarsToRemove.join(', ')}`);
    }

    // Clear click state
    set(onClickSnapshotState, { active: false, sourceChartId: null, sourceParentCardId: null, originalValues: {} });

    // Trigger UI update
    const currentTrigger = await snapshot.getPromise(variableUpdateTriggerState);
    set(variableUpdateTriggerState, currentTrigger + 1);

    console.log('✅ [onClick Reset] All values restored');
  });

  // Check if any child chart within a parent card has onClick enabled
  // Config keys are "{parentCardId}_{childCardId}", so we check all keys starting with parentCardId
  const isOnClickEnabled = useCallback((parentCardId: string): boolean => {
    for (const key of Object.keys(onClickConfigs)) {
      if ((key === parentCardId || key.startsWith(`${parentCardId}_`)) && onClickConfigs[key]?.enabled) {
        return true;
      }
    }
    return false;
  }, [onClickConfigs]);

  // Check if any child chart within a parent card should reset on click outside
  const shouldResetOnClickOutside = useCallback((parentCardId: string): boolean => {
    for (const key of Object.keys(onClickConfigs)) {
      if ((key === parentCardId || key.startsWith(`${parentCardId}_`)) && onClickConfigs[key]?.enabled) {
        return onClickConfigs[key]?.resetOnClickOutside !== false;
      }
    }
    return false;
  }, [onClickConfigs]);

  return {
    onClickConfigs,
    handleChartClick,
    handleReset,
    isOnClickEnabled,
    shouldResetOnClickOutside,
  };
};

