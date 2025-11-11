import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../App"; // Assuming this import is correct for your project structure
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { chartConfigState } from "../recoil/ChartConfig";
import { layoutState } from "../recoil/LayoutState";
import ResizableChart from "../components/ResizableChart";
// Removed useSetRecoilState as it wasn't used, but can be added back if needed
import FilterPanel from "../components/FilterPanel";
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { filterNamesState } from '../recoil/FiltersFamily';
import { isChartVisibleSelector } from '../recoil/DashboardVisibility';
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
    // Replace variables wrapped in quotes: "${variable}"
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    // Replace variables not in quotes: ${variable} (e.g., for numbers, booleans)
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  return result;
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
        visibilityMap[chartId] = true; // Default to visible on error
      }
    }
    return visibilityMap;
  }, [chartConfigs]);

  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});
  const [chartVisibility, setChartVisibility] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getAllVariables().then(setAvailableVariables);
  }, [getAllVariables, variableUpdateTrigger]);

  useEffect(() => {
    getChartVisibility().then(setChartVisibility);
  }, [getChartVisibility, filterNames, variableUpdateTrigger]);

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
        // Use the config object itself, excluding internal keys like _lastRefresh
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
  }, []); // Empty dependency array, should only run once on mount

  type ResizeHandleAxis = 's' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw';

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
  const [mounted, setMounted] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [resizeHandle] = useState<ResizeHandleAxis[]>(['s', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw']);
  // const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isEditMode, setIsEditMode] = useRecoilState<boolean>(IsEditModeState);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getCurrentLayout = useCallback(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return JSON.parse(JSON.stringify(currentLayout));
  }, [layouts, currentBreakpoint]);

  const visibleCharts = useMemo(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    if (isEditMode) {
      return currentLayout;
    }
    return currentLayout.filter((item: Layout) => chartVisibility[item.i] !== false);
  }, [layouts, currentBreakpoint, chartVisibility, isEditMode]);

  const hiddenChartCount = useMemo(() => {
    if (isEditMode) return 0;
    const currentLayout = layouts[currentBreakpoint] || [];
    return currentLayout.filter((item: Layout) => chartVisibility[item.i] === false).length;
  }, [layouts, currentBreakpoint, chartVisibility, isEditMode]);

  const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode) {
      return;
    }

    const clonedLayouts = JSON.parse(JSON.stringify(layouts));
    const incomingLayout = JSON.parse(JSON.stringify(_layout));

    clonedLayouts[currentBreakpoint] = incomingLayout;
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
      const updated = JSON.parse(JSON.stringify(prev));
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
      const updated = JSON.parse(JSON.stringify(prev));
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

  const wouldBeHiddenInViewMode = (itemId: string): boolean => {
    return chartVisibility[itemId] === false;
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
  }, [removeItem]); // Added removeItem to dependency array

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

  // Helper function to get grid style for a chart item in view mode
  const getGridItemStyle = (item: Layout) => {
    return {
      gridColumn: `span ${item.w}`,
      gridRow: `span ${item.h}`,
    };
  };

  // Corrected renderChartContent function
  const renderChartContent = (item: Layout) => {
    const isHiddenByFilters = wouldBeHiddenInViewMode(item.i);
    const chartConfig = getChartConfig(item.i);

    return (
      <>
        {isEditMode && isHiddenByFilters && (
          <div className="absolute inset-0 bg-yellow-500 bg-opacity-10 border-2 border-yellow-500 border-dashed rounded-lg pointer-events-none" style={{ zIndex: 1 }}>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-400 rounded-lg px-4 py-2 shadow-lg">
              <div className="flex items-center space-x-2">
                <svg className="h-5 w-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium text-yellow-800">Hidden in View Mode</span>
              </div>
            </div>
          </div>
        )}

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
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Report Builder Intelligence</h1>
            <p className="text-sm text-gray-600 mt-1">
              {isEditMode ? "Edit mode: Drag, resize, and configure your charts" : "View mode: Dashboard is locked"}
              {isEditMode && (
                <span className="ml-4 text-xs bg-gray-100 px-2 py-1 rounded">
                  Variables: {Object.keys(availableVariables).length} |
                  Charts: {layouts[currentBreakpoint]?.length || 0} total
                  {Object.values(chartVisibility).filter(v => v === false).length > 0 && (
                    <span className="ml-2 text-yellow-700 font-semibold">
                      ({Object.values(chartVisibility).filter(v => v === false).length} would be hidden in view mode)
                    </span>
                  )} | Filters: {filterNames.length}
                </span>
              )}
              {!isEditMode && (
                <span className="ml-4 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  Showing {visibleCharts.length} of {layouts[currentBreakpoint]?.length || 0} charts
                  {hiddenChartCount > 0 && (
                    <span className="ml-2 text-yellow-700 font-semibold">
                      ({hiddenChartCount} hidden by filters)
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            { (
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
            )}

            {isEditMode && (
              <button onClick={toggleCompactType} className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                Layout: {compactType || "Free"}
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
        <div className="fixed top-20 left-0 right-0 z-40 bg-white border-b border-gray-200 px-6 py-4 shadow-sm" style={{ top: '88px' }}> {/* Adjusted top position */ }
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
        {isEditMode ? (
          // EDIT MODE: Use ResponsiveGridLayout for drag and drop
          <ResponsiveGridLayout
            key={`grid-edit-${currentBreakpoint}-${variableUpdateTrigger}`}
            className="layout"
            layouts={layouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            compactType={compactType} // Use state value directly
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
            {getCurrentLayout().map((item: Layout) => (
              <div
                key={item.i}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  minHeight: 0,
                  minWidth: 0,
                  opacity: wouldBeHiddenInViewMode(item.i) ? 0.6 : 1,
                }}
              >
                {renderChartContent(item)}
              </div>
            ))}
          </ResponsiveGridLayout>
        ) : (
          // VIEW MODE: Use CSS Grid with auto-flow dense for automatic rearrangement
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(12, 1fr)',
              gridAutoFlow: 'row dense',
              gridAutoRows: 'minmax(100px, auto)',
              minHeight: '400px'
            }}
          >
            {visibleCharts.map((item: Layout) => (
              <div
                key={item.i}
                className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                style={{
                  ...getGridItemStyle(item),
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
          </div>
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

        {!isEditMode && visibleCharts.length === 0 && layouts[currentBreakpoint]?.length > 0 && (
          <div className="text-center py-12">
            <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">All Charts Hidden</h3>
            <p className="text-sm text-gray-600 mb-4">
              All {hiddenChartCount} chart{hiddenChartCount > 1 ? 's are' : ' is'} currently hidden by filter conditions.
            </p>
            <button onClick={toggleEditMode} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              Edit Filters
            </button>
          </div>
        )}

        {!isEditMode && hiddenChartCount > 0 && visibleCharts.length > 0 && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-yellow-800">
                <strong>{hiddenChartCount}</strong> chart{hiddenChartCount > 1 ? 's are' : ' is'} currently hidden based on filter conditions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}