import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../App";
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { chartConfigState } from "../recoil/ChartConfig";
import { layoutState } from "../recoil/LayoutState";
import ResizableChart from "../components/ResizableChart";
import FilterPanel from "../components/FilterPanel";
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { filterNamesState } from '../recoil/FiltersFamily';
import { isChartVisibleSelector, chartDynamicDimensionsSelector } from '../recoil/DashboardVisibility';
import { IsEditModeState } from "../recoil/IsEditeMode";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ChartConfigData {
  template?: string;
  processed?: any;
  [key: string]: any;
}

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

const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  Object.entries(variables).forEach(([name, value]) => {
    const replacement = JSON.stringify(value);
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  return result;
};

// Deep clone helper to fix the "Cannot assign to read only property" error
const deepClone = <T,>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

export default function DropDragDashboard() {
  const navigate = useNavigate();
  const idRef = useRef(1);

  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  const variableNames = useRecoilValue(variableNamesState);
  const filterNames = useRecoilValue(filterNamesState);

  const [layouts, setLayouts] = useRecoilState(layoutState);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditMode, setIsEditMode] = useRecoilState<boolean>(IsEditModeState);

  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});
  const [chartVisibility, setChartVisibility] = useState<Record<string, boolean>>({});
  const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number } | null>>({});

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("horizontal");

  // Track previous visibility to detect when charts reappear
  const prevVisibilityRef = useRef<Record<string, boolean>>({});
  
  // Flag to ignore auto-compact layout changes
  const ignoreNextLayoutChange = useRef<boolean>(false);
  const visibilityChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getAllVariables = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, any>> => {
    const variables: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);

    for (const varName of varNameArray) {
      try {
        const varValue = await snapshot.getPromise(variableAtomFamily(varName));
        if (varValue !== undefined && varValue !== null) {
          variables[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
        }
      } catch (e) {
        console.warn(`Could not get variable ${varName}:`, e);
      }
    }
    return variables;
  }, [variableNames]);

  const getChartVisibility = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, boolean>> => {
    const visibilityMap: Record<string, boolean> = {};
    const chartIds = Object.keys(chartConfigs);

    for (const chartId of chartIds) {
      try {
        const isVisible = await snapshot.getPromise(isChartVisibleSelector(chartId));
        visibilityMap[chartId] = isVisible;
      } catch (e) {
        console.warn(`Could not get visibility for chart ${chartId}:`, e);
        visibilityMap[chartId] = true;
      }
    }
    return visibilityMap;
  }, [chartConfigs]);

  const getChartDimensions = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, { width: number; height: number } | null>> => {
    const dimensionMap: Record<string, { width: number; height: number } | null> = {};
    const chartIds = Object.keys(chartConfigs);

    for (const chartId of chartIds) {
      try {
        const dimensions = await snapshot.getPromise(chartDynamicDimensionsSelector(chartId));
        dimensionMap[chartId] = dimensions;
      } catch (e) {
        console.warn(`Could not get dimensions for chart ${chartId}:`, e);
        dimensionMap[chartId] = null;
      }
    }
    return dimensionMap;
  }, [chartConfigs]);

  useEffect(() => {
    getAllVariables().then(setAvailableVariables);
  }, [getAllVariables, variableUpdateTrigger]);

  // Preemptively disable compacting when filters change (before visibility is calculated)
  useEffect(() => {
    console.log('🎯 [PRE-EMPTIVE] Filters or variables changed, disabling compacting temporarily');
    setTempCompactType(null);
    
    const timeout = setTimeout(() => {
      console.log('🎯 [PRE-EMPTIVE] Restoring compacting after delay');
      setTempCompactType(compactType);
    }, 2500);
    
    return () => clearTimeout(timeout);
  }, [filterNames, variableUpdateTrigger, compactType]);

  useEffect(() => {
    getChartVisibility().then((newVisibility) => {
      console.log('👁️ Chart visibility updated:', newVisibility);
      console.log('👁️ Previous visibility:', prevVisibilityRef.current);
      
      // Detect charts that are becoming visible or hidden
      const becomingVisible: string[] = [];
      const becomingHidden: string[] = [];
      
      Object.keys(newVisibility).forEach(chartId => {
        const wasHidden = prevVisibilityRef.current[chartId] === false;
        const nowVisible = newVisibility[chartId] === true;
        const wasVisible = prevVisibilityRef.current[chartId] !== false;
        const nowHidden = newVisibility[chartId] === false;
        
        if (wasHidden && nowVisible) {
          becomingVisible.push(chartId);
        }
        if (wasVisible && nowHidden) {
          becomingHidden.push(chartId);
        }
      });
      
      if (becomingVisible.length > 0 || becomingHidden.length > 0) {
        console.log('🔄 Visibility changes:', { becomingVisible, becomingHidden });
        
        // Set flag to ignore the next few layout change events
        ignoreNextLayoutChange.current = true;
        console.log('🚫 Ignoring next layout changes');
        
        // Clear any existing timeout
        if (visibilityChangeTimeoutRef.current) {
          clearTimeout(visibilityChangeTimeoutRef.current);
        }
        
        // Re-enable layout tracking after delay
        visibilityChangeTimeoutRef.current = setTimeout(() => {
          console.log('✅ Re-enabling layout tracking');
          ignoreNextLayoutChange.current = false;
        }, 2000);
      }
      
      prevVisibilityRef.current = newVisibility;
      setChartVisibility(newVisibility);
    });
  }, [getChartVisibility, filterNames, variableUpdateTrigger]);

  useEffect(() => {
    getChartDimensions().then((newDimensions) => {
      console.log('📐 Chart dimensions updated:', newDimensions);
      setChartDimensions(newDimensions);
    });
  }, [getChartDimensions, filterNames, variableUpdateTrigger]);

  const processedChartConfigs = useMemo(() => {
    const processed: Record<string, any> = {};

    Object.entries(chartConfigs).forEach(([id, config]) => {
      if (!config) {
        processed[id] = null;
        return;
      }

      let configToProcess = null;

      if (config.template) {
        configToProcess = config.template;
      } else if (typeof config === 'object' && config !== null) {
        const { _lastRefresh, ...rest } = config;
        configToProcess = JSON.stringify(rest);
      }

      if (configToProcess) {
        try {
          const configWithVariables = replaceVariableReferences(configToProcess, availableVariables);
          const parsedConfig = JSON.parse(configWithVariables);
          processed[id] = parsedConfig;
        } catch (error) {
          console.warn(`Error processing chart config for ${id}:`, error);
          processed[id] = null;
        }
      } else {
        processed[id] = null;
      }
    });

    return processed;
  }, [chartConfigs, availableVariables]);

  const forceChartRefresh = useRecoilCallback(({ set }) => () => {
    setChartConfigs(current => {
      const refreshed = { ...current };
      Object.keys(refreshed).forEach(id => {
        if (refreshed[id]) {
          refreshed[id] = {
            ...refreshed[id],
            _lastRefresh: Date.now()
          };
        }
      });
      return refreshed;
    });
  }, [setChartConfigs]);

  useEffect(() => {
    if (variableUpdateTrigger > 0) {
      forceChartRefresh();
    }
  }, [variableUpdateTrigger, forceChartRefresh]);

  useEffect(() => {
    if (layouts && Object.keys(layouts).length > 0) {
      const allIds = Object.values(layouts)
        .flat()
        .map((item: Layout) => {
          const num = parseInt(item.i);
          return isNaN(num) ? 0 : num;
        });

      if (allIds.length > 0) {
        idRef.current = Math.max(...allIds, 0) + 1;
      }
    }
  }, []);

  type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';


  const [tempCompactType, setTempCompactType] = useState<"vertical" | "horizontal" | null>("horizontal");
  const [mounted, setMounted] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [resizeHandle] = useState<ResizeHandleAxis[]>(['s', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw']);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCurrentLayout = useCallback(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return deepClone(currentLayout);
  }, [layouts, currentBreakpoint]);

  // Get visible charts for BOTH edit and view modes
  const visibleCharts = useMemo(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    console.log('🔍 Current layout:', currentLayout.map(item => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));
    console.log('🔍 Chart visibility map:', chartVisibility);
    
    const filtered = currentLayout.filter((item: Layout) => {
      const isVisible = chartVisibility[item.i] !== false;
      console.log(`🔍 Chart ${item.i}: visibility=${chartVisibility[item.i]}, showing=${isVisible}`);
      return isVisible;
    });
    
    console.log('🔍 Visible charts:', filtered.map(item => `${item.i}(x=${item.x},y=${item.y})`));
    return filtered;
  }, [layouts, currentBreakpoint, chartVisibility]);

  const hiddenChartCount = useMemo(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return currentLayout.filter((item: Layout) => chartVisibility[item.i] === false).length;
  }, [layouts, currentBreakpoint, chartVisibility]);

  // Create a stable key for grid re-rendering - CRITICAL: Use exact visible IDs to force remount
  const gridStateKey = useMemo(() => {
    const visibleIds = visibleCharts.map(c => c.i).sort().join(',');
    return `${currentBreakpoint}-${variableUpdateTrigger}-${visibleIds}`;
  }, [currentBreakpoint, variableUpdateTrigger, visibleCharts]);

  // Create modified layouts with dynamic dimensions applied - DEEP CLONE to fix readonly error
  const layoutsWithDynamicDimensions = useMemo(() => {
    const modified = deepClone(layouts);
    
    console.log('📏 [Dynamic Dims] Processing layouts');
    console.log('📏 [Dynamic Dims] Base layouts:', layouts[currentBreakpoint]?.map(item => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));
    console.log('📏 [Dynamic Dims] Chart dimensions:', chartDimensions);
    
    Object.keys(modified).forEach(breakpoint => {
      modified[breakpoint] = modified[breakpoint].map((item: Layout) => {
        const dynamicDims = chartDimensions[item.i];
        
        if (dynamicDims) {
          // Apply dynamic dimensions but KEEP original position
          console.log(`📏 [Dynamic Dims] Chart ${item.i}: Applying w=${dynamicDims.width}, h=${dynamicDims.height}, KEEPING x=${item.x}, y=${item.y}`);
          return {
            ...item,
            w: dynamicDims.width,
            h: dynamicDims.height,
            // x and y stay from base layout
          };
        } else {
          // Use original completely
          console.log(`📏 [Dynamic Dims] Chart ${item.i}: Using original x=${item.x}, y=${item.y}, w=${item.w}, h=${item.h}`);
          return item;
        }
      });
    });
    
    //@ts-ignore
    console.log('📏 [Dynamic Dims] Final layouts:', modified[currentBreakpoint]?.map(item => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));
    return modified;
  }, [layouts, chartDimensions, currentBreakpoint]);

  const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode) {
      return;
    }

    // Check if we should ignore this layout change
    if (ignoreNextLayoutChange.current) {
      console.log('🚫 [onLayoutChange] IGNORED (triggered by visibility change)');
      console.log('🚫 Incoming layout:', _layout.map(item => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));
      return;
    }

    console.log('🔄 [onLayoutChange] START');
    console.log('🔄 [onLayoutChange] Incoming layout:', _layout.map(item => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));

    const clonedLayouts = deepClone(layouts);
    const currentLayout = clonedLayouts[currentBreakpoint] || [];
    
    console.log('🔄 [onLayoutChange] Current stored layout:', currentLayout.map((item: Layout) => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));

    // Create a map of the incoming layout changes
    const incomingMap = new Map<string, Layout>();
    _layout.forEach(item => {
      incomingMap.set(item.i, item);
    });

    // Update existing items - preserve ALL charts (visible + hidden)
    const updatedLayout = currentLayout.map((item: Layout) => {
      const updated = incomingMap.get(item.i);
      if (updated) {
        // Chart is visible and was in the grid
        const dynamicDims = chartDimensions[item.i];
        
        if (dynamicDims) {
          // Has dynamic dimensions - only save position, not size
          console.log(`🔄 [onLayoutChange] Chart ${item.i}: Has dynamic dims, saving position only x=${updated.x}, y=${updated.y}`);
          return {
            ...item,
            x: updated.x,
            y: updated.y,
            // Keep base w/h
          };
        } else {
          // No dynamic dimensions - save everything
          console.log(`🔄 [onLayoutChange] Chart ${item.i}: No dynamic dims, saving all x=${updated.x}, y=${updated.y}, w=${updated.w}, h=${updated.h}`);
          return updated;
        }
      }
      // Chart is hidden - keep as is
      console.log(`🔄 [onLayoutChange] Chart ${item.i}: Hidden, preserving x=${item.x}, y=${item.y}, w=${item.w}, h=${item.h}`);
      return item;
    });

    // Add any completely new items
    _layout.forEach(item => {
      const existsInCurrent = currentLayout.some((existing: Layout) => existing.i === item.i);
      if (!existsInCurrent) {
        console.log(`🔄 [onLayoutChange] Adding new chart ${item.i}`);
        updatedLayout.push(item);
      }
    });

    console.log('🔄 [onLayoutChange] Final layout to save:', updatedLayout.map((item: Layout) => `${item.i}(x=${item.x},y=${item.y},w=${item.w},h=${item.h})`));
    
    clonedLayouts[currentBreakpoint] = updatedLayout;
    setLayouts(clonedLayouts);

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  const onDrag = () => {
    document.dispatchEvent(new CustomEvent('react-grid-layout-drag'));
  };

  const onResize = () => {
    document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
  };

  const onBreakpointChange = (breakpoint: string) => {
    setCurrentBreakpoint(breakpoint);
  };

  const onDrop = (_layout: Layout[], item: Layout) => {
    const newId = idRef.current.toString();
    idRef.current += 1;

    const newItem: Layout = {
      i: newId,
      x: item.x,
      y: item.y,
      w: 6,
      h: 2,
      static: false,
    };

    setLayouts(prev => {
      const updated = deepClone(prev);
      if (!updated[currentBreakpoint]) {
        updated[currentBreakpoint] = [];
      }

      const filtered = updated[currentBreakpoint].filter((i: Layout) => i.i !== "__dropping-elem__");
      updated[currentBreakpoint] = [...filtered, newItem];

      return updated;
    });
  };

  const toggleCompactType = () => {
    setCompactType(prev => {
      const next = prev === null ? "vertical" : prev === "vertical" ? "horizontal" : null;
      setTempCompactType(next); // Keep them in sync
      return next;
    });
  };

  const removeItem = (id: string) => {
    setLayouts(prev => {
      const updated = deepClone(prev);
      if (updated[currentBreakpoint]) {
        updated[currentBreakpoint] = updated[currentBreakpoint].filter((item: Layout) => item.i !== id);
      }
      return updated;
    });

    setChartConfigs(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  };

  const toggleEditMode = () => {
    setIsEditMode(prev => !prev);
  };

  const getChartConfig = (itemId: string) => {
    return processedChartConfigs[itemId] || null;
  };

  const handleEditClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    setTimeout(() => {
      navigate(`/addChart/${itemId}`);
    }, 10);
  }, [navigate]);

  const handleRemoveClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    setTimeout(() => {
      removeItem(itemId);
    }, 10);
  }, []);

  const handleVisibilityClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();

    setTimeout(() => {
      navigate(`/others/${itemId}`);
    }, 10);
  }, [navigate]);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
    }, 150);
    return () => clearTimeout(timer);
  }, [isEditMode, chartVisibility]);

  const filterPanelTopOffset: string = isEditMode ? '204px' : '90px';

  // Get grid style with dynamic dimensions for VIEW mode
  const getGridItemStyle = (item: Layout) => {
    const dynamicDims = chartDimensions[item.i];
    
    return {
      gridColumn: `span ${dynamicDims?.width || item.w}`,
      gridRow: `span ${dynamicDims?.height || item.h}`,
    };
  };

  const renderChartContent = (item: Layout) => {
    const chartConfig = getChartConfig(item.i);

    return (
      <>
        {isEditMode && (
          <div className="absolute top-2 right-2 flex space-x-1" style={{ zIndex: 9999, pointerEvents: 'auto' }}>
            <button
              type="button"
              className="non-draggable-visibility-btn bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center"
              onClick={(e) => handleVisibilityClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Manage Visibility"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              type="button"
              className="non-draggable-edit-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center"
              onClick={(e) => handleEditClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Edit Chart"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              className="non-draggable-close-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
              onClick={(e) => handleRemoveClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Remove Chart"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              ×
            </button>
          </div>
        )}

        <div className="flex-1 p-2" style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 0 }}>
          {chartConfig ? (
            <ResizableChart key={`${item.i}-${variableUpdateTrigger}`} options={chartConfig} />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
              <div className="text-center">
                <svg className="h-10 w-10 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-sm font-medium text-gray-900 mb-1">Empty Chart</h3>
                <p className="text-xs text-gray-500 mb-3">Click Edit to configure this chart</p>
                {isEditMode && (
                  <button onClick={(e) => handleEditClick(e, item.i)} className="text-xs text-blue-600 hover:text-blue-800 underline">
                    Configure Chart
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <FilterPanel showFilters={showFilters} topOffset={filterPanelTopOffset} />

      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img src="RBI.png" alt="Logo" className="h-16 w-16 inline-block mr-1" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Report Builder Intelligence</h1>
              <p className="text-sm text-gray-600 mt-1">
                {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
                <span className="ml-4 text-xs bg-gray-100 px-2 py-1 rounded">
                  Variables: {Object.keys(availableVariables).length} |
                  Visible: {visibleCharts.length} | Hidden: {hiddenChartCount} | Filters: {filterNames.length}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center relative ${
                showFilters ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
              </svg>
              Filters
            </button>

            {isEditMode && (
              <button onClick={toggleCompactType} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Layout: {compactType === null ? "Free (Locked)" : compactType === "vertical" ? "Vertical" : "Horizontal"}
              </button>
            )}

            <button
              onClick={toggleEditMode}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
                isEditMode ? "bg-green-500 text-white hover:bg-green-600" : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isEditMode ? (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Dashboard
                </>
              ) : (
                <>
                  <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Dashboard
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {isEditMode && (
        <div className="fixed top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm" style={{ top: '88px' }}>
          <div className="flex items-center space-x-4">
            <div
              className="droppable-element flex items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg px-4 py-3 cursor-grab hover:bg-blue-100 transition-colors select-none"
              draggable={true}
              unselectable="on"
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", "");
                e.dataTransfer.effectAllowed = "move";
                setTimeout(() => { e.dataTransfer.dropEffect = "move"; }, 0);
              }}
              onDragEnd={(e) => { e.preventDefault(); }}
            >
              <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span className="text-blue-700 font-medium">Drag to add new chart</span>
            </div>
            <div className="text-sm text-gray-500">
              Drag the element above into the grid to create a new chart widget
            </div>
          </div>
        </div>
      )}

      <div className={`p-2 transition-all duration-300 ${isEditMode ? 'pt-52' : 'pt-24'} ${showFilters ? 'mr-80' : 'mr-0'}`} style={{ position: 'relative' }}>
        
        {/* {console.log('🎨 [RENDER] Edit mode:', isEditMode, '| tempCompactType:', tempCompactType, '| compactType:', compactType, '| gridStateKey:', gridStateKey)} */}
        
        {/* EDIT MODE: Use ResponsiveGridLayout */}
        {isEditMode && (
          <ResponsiveGridLayout
            key={`grid-edit-${gridStateKey}`}
            className="layout"
            layouts={layoutsWithDynamicDimensions}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            compactType={tempCompactType}
            preventCollision={false}
            useCSSTransforms={mounted}
            onLayoutChange={onLayoutChange}
            onBreakpointChange={onBreakpointChange}
            onDrop={onDrop}
            onDrag={onDrag}
            onResize={onResize}
            droppingItem={{ i: "__dropping-elem__", w: 6, h: 2 }}
            isDroppable={true}
            isResizable={true}
            isDraggable={true}
            draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn, .non-draggable-visibility-btn"
            resizeHandles={resizeHandle}
            allowOverlap={false}
            margin={[10, 10]}
            style={{ minHeight: '400px' }}
          >
            {visibleCharts.map((item: Layout) => (
              <div
                key={item.i}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                {renderChartContent(item)}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}

        {/* VIEW MODE: Use ResponsiveGridLayout (same as edit but not draggable/resizable) */}
        {!isEditMode && (
          <ResponsiveGridLayout
            key={`grid-view-${gridStateKey}`}
            className="layout"
            layouts={layoutsWithDynamicDimensions}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            compactType={tempCompactType}
            preventCollision={false}
            useCSSTransforms={mounted}
            onBreakpointChange={onBreakpointChange}
            isDroppable={false}
            isResizable={false}
            isDraggable={false}
            allowOverlap={false}
            margin={[10, 10]}
            style={{ minHeight: '400px' }}
          >
            {visibleCharts.map((item: Layout) => (
              <div
                key={item.i}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 0,
                  minWidth: 0,
                }}
              >
                {renderChartContent(item)}
              </div>
            ))}
          </ResponsiveGridLayout>
        )}

        {(!layouts[currentBreakpoint] || layouts[currentBreakpoint].length === 0) && (
          <div className="text-center py-12">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
            <p className="text-sm text-gray-600 mb-4">
              {isEditMode
                ? "Drag the 'Add Chart' element into this area to create your first visualization"
                : "Switch to edit mode to add charts to your dashboard"
              }
            </p>
            {!isEditMode && (
              <button onClick={toggleEditMode} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                Enter Edit Mode
              </button>
            )}
          </div>
        )}

        {visibleCharts.length === 0 && layouts[currentBreakpoint]?.length > 0 && (
          <div className="text-center py-12">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Charts Hidden</h3>
            <p className="text-sm text-gray-600 mb-4">
              All {hiddenChartCount} chart{hiddenChartCount > 1 ? 's are' : ' is'} currently hidden by visibility conditions.
            </p>
            <p className="text-xs text-gray-500">
              Change filter values or update visibility conditions in Others section to show charts.
            </p>
          </div>
        )}

        {hiddenChartCount > 0 && visibleCharts.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-yellow-800">
                <strong>{hiddenChartCount}</strong> chart{hiddenChartCount > 1 ? 's are' : ' is'} currently hidden by visibility conditions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}