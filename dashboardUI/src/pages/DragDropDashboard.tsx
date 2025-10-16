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
import { useSetRecoilState } from "recoil";
import FilterPanel from "../components/FilterPanel";
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { topNState } from '../recoil/topN';
import { storedLogicsState } from '../recoil/StoredLogic';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ChartConfigData {
  template?: string;
  processed?: any;
  [key: string]: any;
}

// Helper to safely parse values - same as in HighChart field
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

// Helper to replace variable references in JSON string - same as in HighChart field
const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  
  // Replace variables, handling quoted and unquoted cases
  Object.entries(variables).forEach(([name, value]) => {
    const replacement = JSON.stringify(value);
    
    // Replace quoted variable placeholders (e.g. "${var}")
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    // Replace unquoted variable placeholders (e.g. ${var})
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  
  return result;
};

export default function DropDragDashboard() {
  const navigate = useNavigate();
  const idRef = useRef(1);
  
  // Use useRecoilState to make it reactive
  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  
  // Listen to variable updates
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  const variableNames = useRecoilValue(variableNamesState);
  const topNValue = useRecoilValue(topNState);
  const storedLogics = useRecoilValue(storedLogicsState);
  
  const [layouts, setLayouts] = useRecoilState(layoutState);
  const [showFilters, setShowFilters] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<any>({});
  
  // Add loading state for dashboard recalculation
  const [isDashboardRecalculating, setIsDashboardRecalculating] = useState(false);
  const lastProcessedTopNRef = useRef<number | null>(null);
  const recalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get all variables - same logic as HighChart field
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
    
    // Always include topN
    variables['topN'] = topNValue;
    
    return variables;
  }, [variableNames, topNValue]);

  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});

  // Update available variables when they change
  useEffect(() => {
    getAllVariables().then(setAvailableVariables);
  }, [getAllVariables, variableUpdateTrigger]);

  // Watch for topN changes and trigger dashboard recalculation
  useEffect(() => {
    if (topNValue && storedLogics.length > 0 && lastProcessedTopNRef.current !== topNValue) {
      console.log(`Dashboard: TopN changed from ${lastProcessedTopNRef.current} to ${topNValue}, showing loader...`);
      
      setIsDashboardRecalculating(true);
      lastProcessedTopNRef.current = topNValue;
      
      // Clear any existing timeout
      if (recalculationTimeoutRef.current) {
        clearTimeout(recalculationTimeoutRef.current);
      }
      
      // Set a timeout to hide the loader after calculations should be complete
      // This gives time for the Hooks component to finish recalculating
      recalculationTimeoutRef.current = setTimeout(() => {
        setIsDashboardRecalculating(false);
        console.log('Dashboard: Recalculation timeout completed, hiding loader');
      }, 2000); // 2 second timeout
    }
  }, [topNValue, storedLogics.length]);

  // Also hide loader when variableUpdateTrigger changes (indicates calculations finished)
  useEffect(() => {
    if (isDashboardRecalculating && variableUpdateTrigger > 0) {
      // Add small delay to ensure all variables are processed
      setTimeout(() => {
        setIsDashboardRecalculating(false);
        console.log('Dashboard: Variables updated, hiding loader');
      }, 500);
    }
  }, [variableUpdateTrigger, isDashboardRecalculating]);

  // Process chart configs with current variables
  const processedChartConfigs = useMemo(() => {
    const processed: Record<string, any> = {};
    
    Object.entries(chartConfigs).forEach(([id, config]) => {
      if (!config) {
        processed[id] = null;
        return;
      }

      let configToProcess = null;
      
      // Get the template or raw config
      if (config.template) {
        configToProcess = config.template;
      } else if (typeof config === 'object' && config !== null) {
        configToProcess = JSON.stringify(config);
      }

      if (configToProcess) {
        try {
          // Apply variable substitution
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

  // Force refresh chart configs when variables update
  const forceChartRefresh = useRecoilCallback(({ set }) => () => {
    console.log('Dashboard: Forcing chart config refresh...');
    
    // Trigger a re-render by updating the chart configs
    // This ensures charts pick up new variable values
    setChartConfigs(current => {
      const refreshed = { ...current };
      
      // Add a timestamp to force re-processing
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

  // Watch for variable updates and refresh charts
  useEffect(() => {
    if (variableUpdateTrigger > 0) {
      console.log('Dashboard: Variable update trigger fired, refreshing charts...');
      forceChartRefresh();
    }
  }, [variableUpdateTrigger, forceChartRefresh]);

  const handleFiltersChange = useCallback((filters: any) => {
    setCurrentFilters(filters);
    console.log('Filters updated:', filters);
  }, []);

  const hasActiveFilters = Object.values(currentFilters).some((filterArray: any) =>
    Array.isArray(filterArray) && filterArray.length > 0
  );

  // Initialize idRef to avoid duplicates
  useEffect(() => {
    if (layouts && Object.keys(layouts).length > 0) {
      const allIds = Object.values(layouts)
        .flat()
        .map(item => {
          const num = parseInt(item.i);
          return isNaN(num) ? 0 : num;
        });
     
      if (allIds.length > 0) {
        idRef.current = Math.max(...allIds, 0) + 1;
      }
    }
  }, []);

  type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [resizeHandle, setResizehandle] = useState<ResizeHandleAxis[]>([
    's', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw'
  ]);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    const clonedLayouts = JSON.parse(JSON.stringify(allLayouts));
    setLayouts(clonedLayouts);
   
    // Trigger resize events for charts
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
      const updated = { ...prev };
      if (!updated[currentBreakpoint]) {
        updated[currentBreakpoint] = [];
      }
     
      const filtered = updated[currentBreakpoint].filter((i: Layout) => i.i !== "__dropping-elem__");
      updated[currentBreakpoint] = [...filtered, newItem];
     
      return updated;
    });
  };

  const toggleCompactType = () => {
    setCompactType(prev =>
      prev === "vertical" ? "horizontal" : prev === "horizontal" ? null : "vertical"
    );
  };

  const removeItem = (id: string) => {
    setLayouts(prev => {
      const updated = { ...prev };
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

  // Get processed chart config
  const getChartConfig = (itemId: string) => {
    return processedChartConfigs[itemId] || null;
  };

  const handleEditClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    console.log('Edit button clicked for item:', itemId);
    
    setTimeout(() => {
      navigate(`/addChart/${itemId}`);
    }, 10);
  }, [navigate]);

  const handleRemoveClick = useCallback((e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    console.log('Remove button clicked for item:', itemId);
    
    setTimeout(() => {
      removeItem(itemId);
    }, 10);
  }, []);

  // Calculate the top position for FilterPanel based on edit mode
  const filterPanelTopOffset: string = isEditMode ? '204px' : '90px';

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (recalculationTimeoutRef.current) {
        clearTimeout(recalculationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dashboard Recalculation Overlay */}
      {isDashboardRecalculating && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 shadow-xl flex items-center space-x-4 max-w-md mx-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
            <div>
              <h3 className="font-medium text-gray-900">Updating Dashboard</h3>
              <p className="text-sm text-gray-600 mt-1">
                Recalculating charts with topN = {topNValue}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      <FilterPanel
        showFilters={showFilters}
        onFiltersChange={handleFiltersChange}
        topOffset={filterPanelTopOffset}
      />
      
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Builder Intelligence</h1>
            <p className="text-sm text-gray-600 mt-1">
              {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
              {/* DEBUG INFO */}
              <span className="ml-4 text-xs bg-gray-100 px-2 py-1 rounded">
                Variables: {Object.keys(availableVariables).length} | Charts: {Object.keys(processedChartConfigs).length} | TopN: {topNValue}
              </span>
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center relative ${
                showFilters
                  ? "bg-blue-500 text-white hover:bg-blue-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
              </svg>
              Filters
              {hasActiveFilters && (
                <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  !
                </span>
              )}
            </button>

            {/* Layout Toggle */}
            <button
              onClick={toggleCompactType}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Layout: {compactType || "Free"}
            </button>

            {/* Edit Mode Toggle */}
            <button
              onClick={toggleEditMode}
              className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
                isEditMode
                  ? "bg-green-500 text-white hover:bg-green-600"
                  : "bg-blue-500 text-white hover:bg-blue-600"
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

      {/* Fixed Toolbar */}
      {isEditMode && (
        <div className="fixed top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex items-center space-x-4">
            <div
              className="droppable-element flex items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg px-4 py-3 cursor-grab hover:bg-blue-100 transition-colors select-none"
              draggable={true}
              unselectable="on"
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", "");
                e.dataTransfer.effectAllowed = "move";
                setTimeout(() => {
                  e.dataTransfer.dropEffect = "move";
                }, 0);
              }}
              onDragEnd={(e) => {
                e.preventDefault();
              }}
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

      {/* Content with dynamic RIGHT margin and top padding */}
      <div 
        className={`p-2 transition-all duration-300 ${isEditMode ? 'pt-52' : 'pt-24'} ${showFilters ? 'mr-80' : 'mr-0'}`} 
        style={{ position: 'relative' }}
      >
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={100}
          compactType={compactType}
          preventCollision={!compactType}
          useCSSTransforms={mounted}
          onLayoutChange={onLayoutChange}
          onBreakpointChange={onBreakpointChange}
          onDrop={onDrop}
          onDrag={onDrag}
          onResize={onResize}
          droppingItem={{ i: "__dropping-elem__", w: 6, h: 2 }}
          isDroppable={isEditMode}
          isResizable={isEditMode}
          isDraggable={isEditMode}
          draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn"
          resizeHandles={resizeHandle}
          allowOverlap={false}
          margin={[10, 10]}
          style={{ minHeight: '400px' }}
        >
          {(layouts[currentBreakpoint] || []).map((item) => {
            const chartConfig = getChartConfig(item.i);
           
            return (
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
                {/* Chart Controls */}
                {isEditMode && (
                  <div 
                    className="absolute top-2 right-2 flex space-x-1"
                    style={{ 
                      zIndex: 9999,
                      pointerEvents: 'auto'
                    }}
                  >
                    <button
                      type="button"
                      className="non-draggable-edit-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors flex items-center justify-center"
                      onClick={(e) => handleEditClick(e, item.i)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      title="Edit Chart"
                      style={{ 
                        pointerEvents: 'auto', 
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 10000
                      }}
                    >
                       <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="non-draggable-close-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
                      onClick={(e) => handleRemoveClick(e, item.i)}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      title="Remove Chart"
                      style={{ 
                        pointerEvents: 'auto', 
                        cursor: 'pointer',
                        position: 'relative',
                        zIndex: 10000
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                {/* Chart Content */}
                <div
                  className="flex-1 p-2"
                  style={{
                    minHeight: 0,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  {chartConfig ? (
                    <ResizableChart 
                      key={`${item.i}-${variableUpdateTrigger}-${availableVariables.topN || 0}`}
                      options={chartConfig}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
                      <div className="text-center">
                        <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <h3 className="text-sm font-medium text-gray-900 mb-1">Empty Chart</h3>
                        <p className="text-xs text-gray-500 mb-3">Click Edit to configure this chart</p>
                        {isEditMode && (
                          <button
                            onClick={(e) => handleEditClick(e, item.i)}
                            className="text-xs text-blue-600 hover:text-blue-800 underline"
                          >
                            Configure Chart
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>

        {/* Empty State */}
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
              <button
                onClick={toggleEditMode}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Enter Edit Mode
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// import { useState, useEffect, useRef } from "react";
// import { useNavigate } from 'react-router-dom';
// import { Responsive, WidthProvider, Layout } from "react-grid-layout";
// import "react-grid-layout/css/styles.css";
// import "react-resizable/css/styles.css";
// import "../App";
// import { useRecoilState, useRecoilValue } from "recoil";
// import { chartConfigState } from "../recoil/ChartConfig";
// import { layoutState } from "../recoil/LayoutState";
// import ResizableChart from "../components/ResizableChart";
// import { useSetRecoilState } from "recoil";
// import FilterPanel from "../components/FilterPanel";

// const ResponsiveGridLayout = WidthProvider(Responsive);

// interface ChartConfigData {
//   template?: string;
//   processed?: any;
//   [key: string]: any;
// }

// export default function DropDragDashboard() {
//   const navigate = useNavigate();
//   const idRef = useRef(1);
//   const chartConfigs = useRecoilValue<Record<string, ChartConfigData>>(chartConfigState);
//   const setChartConfigs = useSetRecoilState(chartConfigState);

//   const [layouts, setLayouts] = useRecoilState(layoutState);
//   const [showFilters, setShowFilters] = useState(false);
//   const [currentFilters, setCurrentFilters] = useState<any>({});

//   const handleFiltersChange = (filters: any) => {
//     setCurrentFilters(filters);
//     console.log('Filters updated:', filters);
//     // Here you would typically update your dashboard data based on filters
//     // You could pass these filters to your ResizableChart components
//     // or trigger a data refresh with the new filter parameters
//   };

//   const hasActiveFilters = Object.values(currentFilters).some((filterArray: any) =>
//     Array.isArray(filterArray) && filterArray.length > 0
//   );

//   // Initialize idRef to avoid duplicates
//   useEffect(() => {
//     if (layouts && Object.keys(layouts).length > 0) {
//       const allIds = Object.values(layouts)
//         .flat()
//         .map(item => {
//           const num = parseInt(item.i);
//           return isNaN(num) ? 0 : num;
//         });
     
//       if (allIds.length > 0) {
//         idRef.current = Math.max(...allIds, 0) + 1;
//       }
//     }
//   }, []);

//   type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';

//   const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
//   const [mounted, setMounted] = useState(false);
//   const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
//   const [resizeHandle, setResizehandle] = useState<ResizeHandleAxis[]>([
//     's', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw'
//   ]);
//   const [isEditMode, setIsEditMode] = useState<boolean>(true);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
//     const clonedLayouts = JSON.parse(JSON.stringify(allLayouts));
//     setLayouts(clonedLayouts);
   
//     // Trigger resize events for charts
//     setTimeout(() => {
//       document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
//       window.dispatchEvent(new Event('resize'));
//     }, 50);
//   };

//   const onDrag = () => {
//     document.dispatchEvent(new CustomEvent('react-grid-layout-drag'));
//   };

//   const onResize = () => {
//     document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
//   };

//   const onBreakpointChange = (breakpoint: string) => {
//     setCurrentBreakpoint(breakpoint);
//   };

//   const onDrop = (_layout: Layout[], item: Layout) => {
//     const newId = idRef.current.toString();
//     idRef.current += 1;
   
//     const newItem: Layout = {
//       i: newId,
//       x: item.x,
//       y: item.y,
//       w: 6,
//       h: 2,
//       static: false,
//     };

//     setLayouts(prev => {
//       const updated = { ...prev };
//       if (!updated[currentBreakpoint]) {
//         updated[currentBreakpoint] = [];
//       }
     
//       const filtered = updated[currentBreakpoint].filter((i: Layout) => i.i !== "__dropping-elem__");
//       updated[currentBreakpoint] = [...filtered, newItem];
     
//       return updated;
//     });
//   };

//   const toggleCompactType = () => {
//     setCompactType(prev =>
//       prev === "vertical" ? "horizontal" : prev === "horizontal" ? null : "vertical"
//     );
//   };

//   const removeItem = (id: string) => {
//     setLayouts(prev => {
//       const updated = { ...prev };
//       if (updated[currentBreakpoint]) {
//         updated[currentBreakpoint] = updated[currentBreakpoint].filter((item: Layout) => item.i !== id);
//       }
//       return updated;
//     });

//     setChartConfigs(prev => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//   };

//   const toggleEditMode = () => {
//     setIsEditMode(prev => !prev);
//   };

//   const getChartConfig = (itemId: string) => {
//     const config = chartConfigs[itemId];
//     if (!config) return null;
   
//     if (config.processed) {
//       return config.processed;
//     } else if (config.template) {
//       try {
//         return JSON.parse(config.template);
//       } catch {
//         return null;
//       }
//     } else {
//       return config;
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Filter Panel - positioned to avoid overlapping with header */}
//       <FilterPanel
//         showFilters={showFilters}
//         onFiltersChange={handleFiltersChange}
//       />

//       {/* Fixed Header */}
//       <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
//         <div className="flex items-center justify-between">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
//             <p className="text-sm text-gray-600 mt-1">
//               {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
//             </p>
//           </div>
          
//           <div className="flex items-center space-x-3">
//             {/* Filter Toggle Button */}
//             <button
//               onClick={() => setShowFilters(!showFilters)}
//               className={`px-4 py-2 rounded-lg transition-colors flex items-center relative ${
//                 showFilters
//                   ? "bg-blue-500 text-white hover:bg-blue-600"
//                   : "bg-gray-100 text-gray-700 hover:bg-gray-200"
//               }`}
//             >
//               <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
//               </svg>
//               Filters
//               {hasActiveFilters && (
//                 <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
//                   !
//                 </span>
//               )}
//             </button>

//             {/* Layout Toggle */}
//             <button
//               onClick={toggleCompactType}
//               className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
//             >
//               Layout: {compactType || "Free"}
//             </button>

//             {/* Edit Mode Toggle */}
//             <button
//               onClick={toggleEditMode}
//               className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
//                 isEditMode
//                   ? "bg-green-500 text-white hover:bg-green-600"
//                   : "bg-blue-500 text-white hover:bg-blue-600"
//               }`}
//             >
//               {isEditMode ? (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//                   </svg>
//                   Save Dashboard
//                 </>
//               ) : (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                   </svg>
//                   Edit Dashboard
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Fixed Toolbar */}
//       {isEditMode && (
//         <div className="fixed top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
//           <div className="flex items-center space-x-4">
//             <div
//               className="droppable-element flex items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg px-4 py-3 cursor-grab hover:bg-blue-100 transition-colors select-none"
//               draggable={true}
//               unselectable="on"
//               onDragStart={(e) => {
//                 e.dataTransfer.setData("text/plain", "");
//                 e.dataTransfer.effectAllowed = "move";
//                 // Add a slight delay to ensure proper drag initialization
//                 setTimeout(() => {
//                   e.dataTransfer.dropEffect = "move";
//                 }, 0);
//               }}
//               onDragEnd={(e) => {
//                 e.preventDefault();
//               }}
//             >
//               <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
//               </svg>
//               <span className="text-blue-700 font-medium">Drag to add new chart</span>
//             </div>
           
//             <div className="text-sm text-gray-500">
//               Drag the element above into the grid to create a new chart widget
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Content with dynamic left margin and top padding */}
//       <div 
//         className={`p-2 transition-all duration-300 ${isEditMode ? 'pt-52' : 'pt-24'} ${showFilters ? 'ml-80' : 'ml-0'}`} 
//         style={{ position: 'relative' }}
//       >
//         <ResponsiveGridLayout
//           className="layout"
//           layouts={layouts}
//           breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
//           cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
//           rowHeight={100}
//           compactType={compactType}
//           preventCollision={!compactType}
//           useCSSTransforms={mounted}
//           onLayoutChange={onLayoutChange}
//           onBreakpointChange={onBreakpointChange}
//           onDrop={onDrop}
//           onDrag={onDrag}
//           onResize={onResize}
//           droppingItem={{ i: "__dropping-elem__", w: 6, h: 2 }}
//           isDroppable={isEditMode}
//           isResizable={isEditMode}
//           isDraggable={isEditMode}
//           draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn"
//           resizeHandles={resizeHandle}
//           allowOverlap={false}
//           margin={[10, 10]}
//           style={{ minHeight: '400px' }}
//         >
//           {(layouts[currentBreakpoint] || []).map((item) => {
//             const chartConfig = getChartConfig(item.i);
           
//             return (
//               <div
//                 key={item.i}
//                 className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
//                 style={{
//                   display: "flex",
//                   flexDirection: "column",
//                   position: "relative",
//                   minHeight: 0,
//                   minWidth: 0,
//                 }}
//               >
//                 {/* Chart Controls */}
//                 {isEditMode && (
//                   <div className="absolute top-2 right-2 z-10 flex space-x-1">
//                     <button
//                       className="non-draggable-edit-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors"
//                       onClick={() => navigate(`/addChart/${item.i}`)}
//                       title="Edit Chart"
//                     >
//                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                       </svg>
//                     </button>
//                     <button
//                       className="non-draggable-close-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
//                       onClick={() => removeItem(item.i)}
//                     >
//                       ×
//                     </button>
//                   </div>
//                 )}

//                 {/* Chart Content */}
//                 <div
//                   className="flex-1 p-2"
//                   style={{
//                     minHeight: 0,
//                     minWidth: 0,
//                     display: 'flex',
//                     flexDirection: 'column'
//                   }}
//                 >
//                   {chartConfig ? (
//                     <ResizableChart 
//                       options={chartConfig}
//                     />
//                   ) : (
//                     <div className="h-full flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
//                       <div className="text-center">
//                         <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//                         </svg>
//                         <h3 className="text-sm font-medium text-gray-900 mb-1">Empty Chart</h3>
//                         <p className="text-xs text-gray-500 mb-3">Click Edit to configure this chart</p>
//                         {isEditMode && (
//                           <button
//                             onClick={() => navigate(`/addChart/${item.i}`)}
//                             className="text-xs text-blue-600 hover:text-blue-800 underline"
//                           >
//                             Configure Chart
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//         </ResponsiveGridLayout>

//         {/* Empty State */}
//         {(!layouts[currentBreakpoint] || layouts[currentBreakpoint].length === 0) && (
//           <div className="text-center py-12">
//             <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//             </svg>
//             <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
//             <p className="text-sm text-gray-600 mb-4">
//               {isEditMode
//                 ? "Drag the 'Add Chart' element into this area to create your first visualization"
//                 : "Switch to edit mode to add charts to your dashboard"
//               }
//             </p>
//             {!isEditMode && (
//               <button
//                 onClick={toggleEditMode}
//                 className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
//               >
//                 Enter Edit Mode
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// import { useState, useEffect, useRef } from "react";
// import { useNavigate } from 'react-router-dom';
// import { Responsive, WidthProvider, Layout } from "react-grid-layout";
// import "react-grid-layout/css/styles.css";
// import "react-resizable/css/styles.css";
// import "../App";
// import { useRecoilState, useRecoilValue } from "recoil";
// import { chartConfigState } from "../recoil/ChartConfig";
// import { layoutState } from "../recoil/LayoutState";
// import ResizableChart from "../components/ResizableChart";
// import { useSetRecoilState } from "recoil";
// import FilterPanel from "../components/FilterPanel";

// const ResponsiveGridLayout = WidthProvider(Responsive);

// interface ChartConfigData {
//   template?: string;
//   processed?: any;
//   [key: string]: any;
// }

// export default function DropDragDashboard() {
//   const navigate = useNavigate();
//   const idRef = useRef(1);
//   const chartConfigs = useRecoilValue<Record<string, ChartConfigData>>(chartConfigState);
//   const setChartConfigs = useSetRecoilState(chartConfigState);

//   const [layouts, setLayouts] = useRecoilState(layoutState);
//   const [showFilters, setShowFilters] = useState(false);
//   const [currentFilters, setCurrentFilters] = useState<any>({});

//   const handleFiltersChange = (filters: any) => {
//     setCurrentFilters(filters);
//     console.log('Filters updated:', filters);
//     // Here you would typically update your dashboard data based on filters
//   };

//   const hasActiveFilters = Object.values(currentFilters).some((filterArray: any) => 
//     Array.isArray(filterArray) && filterArray.length > 0
//   );

//   // Initialize idRef to avoid duplicates
//   useEffect(() => {
//     if (layouts && Object.keys(layouts).length > 0) {
//       const allIds = Object.values(layouts)
//         .flat()
//         .map(item => {
//           const num = parseInt(item.i);
//           return isNaN(num) ? 0 : num;
//         });
      
//       if (allIds.length > 0) {
//         idRef.current = Math.max(...allIds, 0) + 1;
//       }
//     }
//   }, []);

//   type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';

//   const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
//   const [mounted, setMounted] = useState(false);
//   const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
//   const [resizeHandle, setResizehandle] = useState<ResizeHandleAxis[]>([
//     's', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw'
//   ]);
//   const [isEditMode, setIsEditMode] = useState<boolean>(true);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
//     const clonedLayouts = JSON.parse(JSON.stringify(allLayouts));
//     setLayouts(clonedLayouts);
    
//     // Trigger resize events for charts
//     setTimeout(() => {
//       document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
//       window.dispatchEvent(new Event('resize'));
//     }, 50);
//   };

//   const onDrag = () => {
//     document.dispatchEvent(new CustomEvent('react-grid-layout-drag'));
//   };

//   const onResize = () => {
//     document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
//   };

//   const onBreakpointChange = (breakpoint: string) => {
//     setCurrentBreakpoint(breakpoint);
//   };

//   const onDrop = (_layout: Layout[], item: Layout) => {
//     const newId = idRef.current.toString();
//     idRef.current += 1;
    
//     const newItem: Layout = {
//       i: newId,
//       x: item.x,
//       y: item.y,
//       w: 6,
//       h: 2,
//       static: false,
//     };

//     setLayouts(prev => {
//       const updated = { ...prev };
//       if (!updated[currentBreakpoint]) {
//         updated[currentBreakpoint] = [];
//       }
      
//       const filtered = updated[currentBreakpoint].filter((i: Layout) => i.i !== "__dropping-elem__");
//       updated[currentBreakpoint] = [...filtered, newItem];
      
//       return updated;
//     });
//   };

//   const toggleCompactType = () => {
//     setCompactType(prev =>
//       prev === "vertical" ? "horizontal" : prev === "horizontal" ? null : "vertical"
//     );
//   };

//   const removeItem = (id: string) => {
//     setLayouts(prev => {
//       const updated = { ...prev };
//       if (updated[currentBreakpoint]) {
//         updated[currentBreakpoint] = updated[currentBreakpoint].filter((item: Layout) => item.i !== id);
//       }
//       return updated;
//     });
  
//     setChartConfigs(prev => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//   };

//   const toggleEditMode = () => {
//     setIsEditMode(prev => !prev);
//   };

//   const getChartConfig = (itemId: string) => {
//     const config = chartConfigs[itemId];
//     if (!config) return null;
    
//     if (config.processed) {
//       return config.processed;
//     } else if (config.template) {
//       try {
//         return JSON.parse(config.template);
//       } catch {
//         return null;
//       }
//     } else {
//       return config;
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Fixed Header */}
//       <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
//         <div className="flex items-center justify-between">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
//             <p className="text-sm text-gray-600 mt-1">
//               {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
//             </p>
//           </div>
//           <div className="flex items-center space-x-3">
//             <button
//               onClick={() => setShowFilters(!showFilters)}
//               className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
//                 showFilters
//                   ? "bg-blue-500 text-white hover:bg-blue-600"
//                   : "bg-gray-100 text-gray-700 hover:bg-gray-200"
//               }`}
//             >
//               <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
//               </svg>
//               Filters
//               {hasActiveFilters && (
//                 <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
//                   !
//                 </span>
//               )}
//             </button>
//           </div>
//           <FilterPanel 
//             showFilters={showFilters} 
//             onFiltersChange={handleFiltersChange}
//           />
//           <div className="flex items-center space-x-3">
//             <button
//               onClick={toggleCompactType}
//               className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
//             >
//               Layout: {compactType || "Free"}
//             </button>
//             <button
//               onClick={toggleEditMode}
//               className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
//                 isEditMode
//                   ? "bg-green-500 text-white hover:bg-green-600"
//                   : "bg-blue-500 text-white hover:bg-blue-600"
//               }`}
//             >
//               {isEditMode ? (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//                   </svg>
//                   Save Dashboard
//                 </>
//               ) : (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                   </svg>
//                   Edit Dashboard
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Fixed Toolbar */}
//       {isEditMode && (
//         <div className="fixed top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
//           <div className="flex items-center space-x-4">
//             <div
//               className="droppable-element flex items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg px-4 py-3 cursor-grab hover:bg-blue-100 transition-colors select-none"
//               draggable={true}
//               unselectable="on"
//               onDragStart={(e) => {
//                 e.dataTransfer.setData("text/plain", "");
//                 e.dataTransfer.effectAllowed = "move";
//                 // Add a slight delay to ensure proper drag initialization
//                 setTimeout(() => {
//                   e.dataTransfer.dropEffect = "move";
//                 }, 0);
//               }}
//               onDragEnd={(e) => {
//                 e.preventDefault();
//               }}
//             >
//               <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
//               </svg>
//               <span className="text-blue-700 font-medium">Drag to add new chart</span>
//             </div>
            
//             <div className="text-sm text-gray-500">
//               Drag the element above into the grid to create a new chart widget
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Content with top padding to account for fixed header and toolbar */}
//       <div className={`p-2 ${isEditMode ? 'pt-52' : 'pt-24'}`} style={{ position: 'relative' }}>
//         <ResponsiveGridLayout
//           className="layout"
//           layouts={layouts}
//           breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
//           cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
//           rowHeight={100}
//           compactType={compactType}
//           preventCollision={!compactType}
//           useCSSTransforms={mounted}
//           onLayoutChange={onLayoutChange}
//           onBreakpointChange={onBreakpointChange}
//           onDrop={onDrop}
//           onDrag={onDrag}
//           onResize={onResize}
//           droppingItem={{ i: "__dropping-elem__", w: 6, h: 2 }}
//           isDroppable={isEditMode}
//           isResizable={isEditMode}
//           isDraggable={isEditMode}
//           draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn"
//           resizeHandles={resizeHandle}
//           allowOverlap={false}
//           margin={[10, 10]}
//           style={{ minHeight: '400px' }}
//         >
//           {(layouts[currentBreakpoint] || []).map((item) => {
//             const chartConfig = getChartConfig(item.i);
            
//             return (
//               <div
//                 key={item.i}
//                 className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
//                 style={{
//                   display: "flex",
//                   flexDirection: "column",
//                   position: "relative",
//                   minHeight: 0,
//                   minWidth: 0,
//                 }}
//               >
//                 {/* Chart Controls */}
//                 {isEditMode && (
//                   <div className="absolute top-2 right-2 z-10 flex space-x-1">
//                     <button
//                       className="non-draggable-edit-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors"
//                       onClick={() => navigate(`/addChart/${item.i}`)}
//                       title="Edit Chart"
//                     >
//                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                       </svg>
//                     </button>
//                     <button
//                       className="non-draggable-close-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
//                       onClick={() => removeItem(item.i)}
//                     >
//                       ×
//                     </button>
//                   </div>
//                 )}

//                 {/* Chart Content */}
//                 <div 
//                   className="flex-1 p-2" 
//                   style={{ 
//                     minHeight: 0,
//                     minWidth: 0,
//                     display: 'flex',
//                     flexDirection: 'column'
//                   }}
//                 >
//                   {chartConfig ? (
//                     <ResizableChart options={chartConfig} />
//                   ) : (
//                     <div className="h-full flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
//                       <div className="text-center">
//                         <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//                         </svg>
//                         <h3 className="text-sm font-medium text-gray-900 mb-1">Empty Chart</h3>
//                         <p className="text-xs text-gray-500 mb-3">Click Edit to configure this chart</p>
//                         {isEditMode && (
//                           <button
//                             onClick={() => navigate(`/addChart/${item.i}`)}
//                             className="text-xs text-blue-600 hover:text-blue-800 underline"
//                           >
//                             Configure Chart
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//         </ResponsiveGridLayout>

//         {/* Empty State */}
//         {(!layouts[currentBreakpoint] || layouts[currentBreakpoint].length === 0) && (
//           <div className="text-center py-12">
//             <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//             </svg>
//             <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
//             <p className="text-sm text-gray-600 mb-4">
//               {isEditMode 
//                 ? "Drag the 'Add Chart' element into this area to create your first visualization"
//                 : "Switch to edit mode to add charts to your dashboard"
//               }
//             </p>
//             {!isEditMode && (
//               <button
//                 onClick={toggleEditMode}
//                 className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
//               >
//                 Enter Edit Mode
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// import { useState, useEffect, useRef } from "react";
// import { useNavigate } from 'react-router-dom';
// import { Responsive, WidthProvider, Layout } from "react-grid-layout";
// import "react-grid-layout/css/styles.css";
// import "react-resizable/css/styles.css";
// import "../App";
// import { useRecoilState, useRecoilValue } from "recoil";
// import { chartConfigState } from "../recoil/ChartConfig";
// import { layoutState } from "../recoil/LayoutState";
// import ResizableChart from "../components/ResizableChart";
// import { useSetRecoilState } from "recoil";

// const ResponsiveGridLayout = WidthProvider(Responsive);

// interface ChartConfigData {
//   template?: string;
//   processed?: any;
//   [key: string]: any;
// }

// export default function DropDragDashboard() {
//   const navigate = useNavigate();
//   const idRef = useRef(1);
//   const chartConfigs = useRecoilValue<Record<string, ChartConfigData>>(chartConfigState);
//   const setChartConfigs = useSetRecoilState(chartConfigState);

//   const [layouts, setLayouts] = useRecoilState(layoutState);

//   type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';

//   const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
//   const [mounted, setMounted] = useState(false);
//   const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
//   const [resizeHandle, setResizehandle] = useState<ResizeHandleAxis[]>([
//     's', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw'
//   ]);
//   const [isEditMode, setIsEditMode] = useState<boolean>(true);

//   useEffect(() => {
//     setMounted(true);
//   }, []);

//   const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
//     const clonedLayouts = JSON.parse(JSON.stringify(allLayouts));
//     setLayouts(clonedLayouts);
//   };

//   const onBreakpointChange = (breakpoint: string) => {
//     setCurrentBreakpoint(breakpoint);
//   };

//   const onDrop = (_layout: Layout[], item: Layout) => {
//     const newItem: Layout = {
//       i: idRef.current.toString(),
//       x: item.x,
//       y: item.y,
//       w: 6,
//       h: 2,
//       static: false,
//     };
//     idRef.current += 1;

//     setLayouts(prev => {
//       const updated = JSON.parse(JSON.stringify(prev));
//       const filtered = updated[currentBreakpoint]?.filter((i: Layout) => i.i !== "__dropping-elem__") || [];
//       updated[currentBreakpoint] = [...filtered, newItem];
//       return updated;
//     });
//   };

//   const toggleCompactType = () => {
//     setCompactType(prev =>
//       prev === "vertical" ? "horizontal" : prev === "horizontal" ? null : "vertical"
//     );
//   };

//   const removeItem = (id: string) => {
//     // Remove from layouts
//     setLayouts(prev => {
//       const updated = JSON.parse(JSON.stringify(prev));
//       updated[currentBreakpoint] = updated[currentBreakpoint]?.filter((item: Layout) => item.i !== id.toString());
//       return updated;
//     });
  
//     // Remove from chart configurations
//     setChartConfigs(prev => {
//       const updated = { ...prev };
//       delete updated[id];
//       return updated;
//     });
//   };

//   const toggleEditMode = () => {
//     setIsEditMode(prev => !prev);
//   };

//   // Helper function to get chart config for an item
//   const getChartConfig = (itemId: string) => {
//     const config = chartConfigs[itemId];
//     if (!config) return null;
    
//     // If it has a processed version, use that; otherwise use the config directly
//     if (config.processed) {
//       return config.processed;
//     } else if (config.template) {
//       // If only template exists, try to parse it (this shouldn't happen in normal flow)
//       try {
//         return JSON.parse(config.template);
//       } catch {
//         return null;
//       }
//     } else {
//       // Legacy format - direct config object
//       return config;
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Header */}
//       <div className="bg-white border-b border-gray-200 px-6 py-4">
//         <div className="flex items-center justify-between">
//           <div>
//             <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
//             <p className="text-sm text-gray-600 mt-1">
//               {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
//             </p>
//           </div>
//           <div className="flex items-center space-x-3">
//             <button
//               onClick={toggleCompactType}
//               className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
//             >
//               Layout: {compactType || "Free"}
//             </button>
//             <button
//               onClick={toggleEditMode}
//               className={`px-6 py-2 rounded-lg transition-colors flex items-center ${
//                 isEditMode
//                   ? "bg-green-500 text-white hover:bg-green-600"
//                   : "bg-blue-500 text-white hover:bg-blue-600"
//               }`}
//             >
//               {isEditMode ? (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
//                   </svg>
//                   Save Dashboard
//                 </>
//               ) : (
//                 <>
//                   <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
//                   </svg>
//                   Edit Dashboard
//                 </>
//               )}
//             </button>
//           </div>
//         </div>
//       </div>

//       {/* Toolbar */}
//       {isEditMode && (
//         <div className="bg-white border-b border-gray-200 px-6 py-4">
//           <div className="flex items-center space-x-4">
//             <div
//               className="droppable-element flex items-center justify-center bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg px-4 py-3 cursor-grab hover:bg-blue-100 transition-colors"
//               draggable
//               unselectable="on"
//               onDragStart={(e) => e.dataTransfer.setData("text/plain", "new-item")}
//             >
//               <svg className="h-5 w-5 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
//               </svg>
//               <span className="text-blue-700 font-medium">Drag to add new chart</span>
//             </div>
            
//             <div className="text-sm text-gray-500">
//               Drag the element above into the grid to create a new chart widget
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Grid Layout */}
//       <div className="p-6">
//         <ResponsiveGridLayout
//           className="layout"
//           layouts={layouts}
//           breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
//           cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
//           rowHeight={220}
//           compactType={compactType}
//           preventCollision={!compactType}
//           useCSSTransforms={mounted}
//           onLayoutChange={onLayoutChange}
//           onBreakpointChange={onBreakpointChange}
//           onDrop={onDrop}
//           droppingItem={{ i: "__dropping-elem__", w: 6, h: 2 }}
//           isDroppable={isEditMode}
//           isResizable={isEditMode}
//           isDraggable={isEditMode}
//           draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn"
//           resizeHandles={resizeHandle}
//         >
//           {layouts[currentBreakpoint]?.map((item) => {
//             const chartConfig = getChartConfig(item.i);
            
//             return (
//               <div
//                 key={item.i}
//                 className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
//                 style={{
//                   display: "flex",
//                   flexDirection: "column",
//                   position: "relative",
//                 }}
//               >
//                 {/* Chart Controls */}
//                 {isEditMode && (
//                   <div className="absolute top-2 right-2 z-10 flex space-x-1">
//                     <button
//                       className="non-draggable-edit-btn bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition-colors"
//                       onClick={() => navigate(`/addChart/${item.i}`)}
//                     >
//                       Edit
//                     </button>
//                     <button
//                       className="non-draggable-close-btn bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
//                       onClick={() => {
//                         console.log("Clicked delete for:", item.i);
//                         removeItem(item.i);
//                       }}
//                     >
//                       ×
//                     </button>
//                   </div>
//                 )}

//                 {/* Chart Content */}
//                 <div className="flex-1 p-2">
//                   {chartConfig ? (
//                     <ResizableChart options={chartConfig} />
//                   ) : (
//                     <div className="h-full flex items-center justify-center bg-gray-50 rounded border-2 border-dashed border-gray-300">
//                       <div className="text-center">
//                         <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//                         </svg>
//                         <h3 className="text-sm font-medium text-gray-900 mb-1">Empty Chart</h3>
//                         <p className="text-xs text-gray-500 mb-3">Click Edit to configure this chart</p>
//                         {isEditMode && (
//                           <button
//                             onClick={() => navigate(`/addChart/${item.i}`)}
//                             className="text-xs text-blue-600 hover:text-blue-800 underline"
//                           >
//                             Configure Chart
//                           </button>
//                         )}
//                       </div>
//                     </div>
//                   )}
//                 </div>
//               </div>
//             );
//           })}
//         </ResponsiveGridLayout>

//         {/* Empty State */}
//         {(!layouts[currentBreakpoint] || layouts[currentBreakpoint].length === 0) && (
//           <div className="text-center py-12">
//             <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
//               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
//             </svg>
//             <h3 className="text-lg font-medium text-gray-900 mb-2">No Charts Yet</h3>
//             <p className="text-sm text-gray-600 mb-4">
//               {isEditMode 
//                 ? "Drag the 'Add Chart' element into this area to create your first visualization"
//                 : "Switch to edit mode to add charts to your dashboard"
//               }
//             </p>
//             {!isEditMode && (
//               <button
//                 onClick={toggleEditMode}
//                 className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
//               >
//                 Enter Edit Mode
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }