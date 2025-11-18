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
import { dahboardNameMain } from "../recoil/DashboardName";
const ResponsiveGridLayout = WidthProvider(Responsive);

interface ChartConfigData {
  template?: string;
  htmlContent?: string;
  type?: 'chart' | 'html' | 'table' | 'tableChart';
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

// Enhanced deep clone helper that ensures full mutability
const deepClone = <T,>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned = {} as T;
  Object.keys(obj).forEach(key => {
    cloned[key as keyof T] = deepClone((obj as any)[key]);
  });
  
  return cloned;
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

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>(null);
 
  // NEW: Dashboard naming
  const [dashboardName, setDashboardName] = useRecoilState(dahboardNameMain);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Track previous visibility to detect when charts reappear
  const prevVisibilityRef = useRef<Record<string, boolean>>({});
  
  // Flag to ignore auto-compact layout changes
  const ignoreNextLayoutChange = useRef<boolean>(false);
  const visibilityChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // NEW: Compaction safety mechanisms
  const safeLayoutsRef = useRef<{ [key: string]: Layout[] }>({});
  const compactionAttempts = useRef<number>(0);
  const MAX_COMPACTION_ATTEMPTS = 3;
  const [compactionError, setCompactionError] = useState(false);

  const [selectedView, setSelectedView] = useState<string>("dashboardName");
  const [selectedCustomView,setSelectedCustomView]=useState<string>("default")
  const [selectDownloadOption,setSelectedDownloadOption]=useState<string>("jpeg")
  const [selectedBranch,setSelectedbranch]=useState<string>("createBranch")

  const [views] = useState([
    { id: "dashboardName", name:dashboardName},
    { id: "view-1", name: "View 1" },
    { id: "view-2", name: "View 2" },
    { id: "view-3", name: "View 3" },
  ]);

  const [customViews]=useState([
    { id: "default", name: "Default" },
    { id: "cust-view-1", name: "Custom Filter View 1" },
    { id: "cust-view-2", name: "Custom Filter View 2" },
    { id: "cust-view-3", name: "Custom Filter View 3" },
  ])

  const [downloadOptions]=useState([
    { id: "png", name: "PNG" },
    { id: "jpeg", name: "JPEG" },
    { id: "pdf", name: "PDF" },
    { id: "svg", name: "SVG" },
    { id: "csv", name: "CSV" },
    { id: "Xls", name: "XLS" },
  ])

  const [branchOptions]=useState([
    { id: "createBranch", name: "Create Branch" },
    { id: "branch5", name: "Claims Volume b1" },
    { id: "branch4", name: "Claims Volume b2" },
    { id: "branch1", name: "Project Volume b1" },
    { id: "branch2", name: "Custom Comparison b1" },
    { id: "branch3", name: "Patient Provider b1" }
  ])

  // Reset compaction attempts periodically
  useEffect(() => {
    const interval = setInterval(() => {
      compactionAttempts.current = 0;
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Force unfrozen layouts - improved version
  useEffect(() => {
    if (layouts && Object.keys(layouts).length > 0) {
      const hasImmutableProps = Object.values(layouts).some(layoutArray => 
        Object.isFrozen(layoutArray) || layoutArray.some(item => Object.isFrozen(item))
      );
      
      if (hasImmutableProps) {
        console.log('🔧 Detected frozen layouts, reconstructing...');
        setLayouts(prev => {
          const reconstructed: { [key: string]: Layout[] } = {};
          Object.keys(prev).forEach(bp => {
            reconstructed[bp] = (prev[bp] || []).map(item => {
              // Create plain object
              const newItem: any = {};
              newItem.i = String(item.i);
              newItem.x = Number(item.x);
              newItem.y = Number(item.y);
              newItem.w = Number(item.w);
              newItem.h = Number(item.h);
              if (item.minW !== undefined) newItem.minW = Number(item.minW);
              if (item.maxW !== undefined) newItem.maxW = Number(item.maxW);
              if (item.minH !== undefined) newItem.minH = Number(item.minH);
              if (item.maxH !== undefined) newItem.maxH = Number(item.maxH);
              if (item.static !== undefined) newItem.static = Boolean(item.static);
              return newItem as Layout;
            });
          });
          return reconstructed;
        });
      }
    }
  }, []); // Only on mount

  // Focus name input when editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

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

      // Check if it's HTML type
      if (config.type === 'html' && config.htmlContent) {
        try {
          const htmlWithVariables = replaceVariableReferences(config.htmlContent, availableVariables);
          processed[id] = {
            html: htmlWithVariables,
            type: 'html'
          };
        } catch (error) {
          console.warn(`Error processing HTML config for ${id}:`, error);
          processed[id] = {
            html: config.htmlContent,
            type: 'html'
          };
        }
        return;
      }

      // Check if it's table or tableChart type (not yet implemented)
      if (config.type === 'table' || config.type === 'tableChart') {
        processed[id] = null;
        return;
      }

      // Handle regular chart config
      let configToProcess = null;

      if (config.template) {
        configToProcess = config.template;
      } else if (typeof config === 'object' && config !== null) {
        const { _lastRefresh, htmlContent, type, ...rest } = config;
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

  const [tempCompactType, setTempCompactType] = useState<"vertical" | "horizontal" | null>(null);
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

  // Track compaction attempts
  useEffect(() => {
    if (tempCompactType !== null) {
      compactionAttempts.current += 1;
    }
  }, [visibleCharts, tempCompactType]);

  // NEW: Safe compaction wrapper
  const getSafeCompactType = useCallback(() => {
    // If we've had too many compaction attempts, disable it temporarily
    if (compactionAttempts.current >= MAX_COMPACTION_ATTEMPTS) {
      console.warn('Too many compaction attempts, temporarily disabling');
      setCompactionError(true);
      
      // Re-enable after delay
      setTimeout(() => {
        compactionAttempts.current = 0;
        setCompactionError(false);
      }, 3000);
      
      return null;
    }
    
    return tempCompactType;
  }, [tempCompactType]);

  // IMPROVED: getCleanLayouts with bulletproof mutability and bounds validation
  const getCleanLayouts = useCallback(() => {
    const clean: { [key: string]: Layout[] } = {};
    
    Object.keys(layouts).forEach(breakpoint => {
      clean[breakpoint] = [];
      const seenIds = new Set<string>();
      
      (layouts[breakpoint] || []).forEach((item: Layout) => {
        // Skip duplicates
        if (seenIds.has(item.i)) {
          console.warn(`Skipping duplicate item: ${item.i}`);
          return;
        }
        seenIds.add(item.i);
        
        const dynamicDims = chartDimensions[item.i];
        
        // Create a completely new, mutable object
        const cleanItem: any = {};
        
        // Ensure valid, bounded values
        cleanItem.i = String(item.i);
        cleanItem.x = Math.max(0, Math.min(11, Number(item.x) || 0)); // Max x is cols-1
        cleanItem.y = Math.max(0, Number(item.y) || 0);
        cleanItem.w = Math.max(1, Math.min(12, dynamicDims ? Number(dynamicDims.width) : Number(item.w) || 6));
        cleanItem.h = Math.max(1, Math.min(20, dynamicDims ? Number(dynamicDims.height) : Number(item.h) || 4));
        
        // Add bounds to prevent infinite growth
        cleanItem.minW = item.minW !== undefined ? Math.max(1, Number(item.minW)) : 1;
        cleanItem.maxW = item.maxW !== undefined ? Math.min(12, Number(item.maxW)) : 12;
        cleanItem.minH = item.minH !== undefined ? Math.max(1, Number(item.minH)) : 1;
        cleanItem.maxH = item.maxH !== undefined ? Math.min(20, Number(item.maxH)) : 20;
        
        if (item.static !== undefined) cleanItem.static = Boolean(item.static);
        if (item.isDraggable !== undefined) cleanItem.isDraggable = Boolean(item.isDraggable);
        if (item.isResizable !== undefined) cleanItem.isResizable = Boolean(item.isResizable);
        if (item.isBounded !== undefined) cleanItem.isBounded = Boolean(item.isBounded);
        if (item.resizeHandles) cleanItem.resizeHandles = Array.from(item.resizeHandles);
        if (item.moved !== undefined) cleanItem.moved = Boolean(item.moved);
        
        clean[breakpoint].push(cleanItem as Layout);
      });
      
      // Sort by y position, then x to help prevent collisions
      clean[breakpoint].sort((a, b) => {
        if (a.y === b.y) return a.x - b.x;
        return a.y - b.y;
      });
    });
    
    // Store safe version
    safeLayoutsRef.current = clean;
    return clean;
  }, [layouts, chartDimensions]);

  const onLayoutChange = (_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode) {
      return;
    }

    // Check if we should ignore this layout change
    if (ignoreNextLayoutChange.current) {
      console.log('🚫 [onLayoutChange] IGNORED (triggered by visibility change)');
      return;
    }

    // Detect if layouts are growing exponentially (sign of infinite loop)
    const totalHeight = _layout.reduce((sum, item) => sum + (item.y + item.h), 0);
    if (totalHeight > 10000) {
      console.error('Layout height overflow detected, resetting compaction');
      setTempCompactType(null);
      setCompactType(null);
      compactionAttempts.current = MAX_COMPACTION_ATTEMPTS; // Trigger cooldown
      return;
    }

    console.log('🔄 [onLayoutChange] START');

    // Clone incoming layouts with validation
    const incomingLayoutClone = _layout.map(item => {
      const cloned: any = {};
      cloned.i = String(item.i);
      cloned.x = Math.max(0, Math.min(11, Number(item.x)));
      cloned.y = Math.max(0, Number(item.y));
      cloned.w = Math.max(1, Math.min(12, Number(item.w)));
      cloned.h = Math.max(1, Math.min(20, Number(item.h)));
      
      if (item.minW !== undefined) cloned.minW = Math.max(1, Number(item.minW));
      if (item.maxW !== undefined) cloned.maxW = Math.min(12, Number(item.maxW));
      if (item.minH !== undefined) cloned.minH = Math.max(1, Number(item.minH));
      if (item.maxH !== undefined) cloned.maxH = Math.min(20, Number(item.maxH));
      if (item.static !== undefined) cloned.static = Boolean(item.static);
      if (item.isDraggable !== undefined) cloned.isDraggable = Boolean(item.isDraggable);
      if (item.isResizable !== undefined) cloned.isResizable = Boolean(item.isResizable);
      
      return cloned as Layout;
    });

    const clonedLayouts = deepClone(layouts);
    const currentLayout = clonedLayouts[currentBreakpoint] || [];

    // Create a map of the incoming layout changes
    const incomingMap = new Map<string, Layout>();
    incomingLayoutClone.forEach(item => {
      incomingMap.set(item.i, item);
    });

    // Update existing items - preserve ALL charts (visible + hidden)
    const updatedLayout = currentLayout.map((item: Layout) => {
      const updated = incomingMap.get(item.i);
      if (updated) {
        const dynamicDims = chartDimensions[item.i];
        
        if (dynamicDims) {
          return {
            ...item,
            x: updated.x,
            y: updated.y,
          };
        } else {
          return updated;
        }
      }
      return item;
    });

    // Add any completely new items
    incomingLayoutClone.forEach(item => {
      const existsInCurrent = currentLayout.some((existing: Layout) => existing.i === item.i);
      if (!existsInCurrent) {
        updatedLayout.push(item);
      }
    });

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
      h: 4,
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

  const filterPanelTopOffset: string = isEditMode ? '155px' : '111px';

  const renderChartContent = (item: Layout) => {
    const chartConfig = getChartConfig(item.i);
    const configData = chartConfigs[item.i];
    const contentType = configData?.type || 'chart';

    return (
      <>
        {isEditMode && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5" style={{ zIndex: 9999, pointerEvents: 'auto' }}>
            <button
              type="button"
              className="non-draggable-visibility-btn group relative bg-slate-100/90 backdrop-blur-sm hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-slate-300/50 hover:border-indigo-400"
              disabled 
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Local Filters"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4H21L14 11V18L10 21V11L3 4Z" />
              </svg>
            </button>
            <button
              type="button"
              className="non-draggable-edit-btn group relative bg-slate-100/90 backdrop-blur-sm hover:bg-blue-100 text-slate-700 hover:text-blue-700 p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-slate-300/50 hover:border-blue-400"
              onClick={(e) => handleEditClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Edit Content"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              className="non-draggable-close-btn group relative bg-slate-100/90 backdrop-blur-sm hover:bg-red-100 text-slate-700 hover:text-red-700 p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-slate-300/50 hover:border-red-400"
              onClick={(e) => handleRemoveClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Remove"
              style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Content Type Badge */}
        {isEditMode && chartConfig && (
          <div className="absolute top-3 left-3" style={{ zIndex: 9999, pointerEvents: 'none' }}>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold" style={{
              backgroundColor: contentType === 'html' ? 'rgba(245, 158, 11, 0.9)' : 
                             contentType === 'table' ? 'rgba(59, 130, 246, 0.9)' : 
                             contentType === 'tableChart' ? 'rgba(16, 185, 129, 0.9)' :
                             'rgba(139, 92, 246, 0.9)',
              color: 'white'
            }}>
              {contentType === 'html' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  HTML
                </>
              ) : contentType === 'table' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Table
                </>
              ) : contentType === 'tableChart' ? (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Table+Chart
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Chart
                </>
              )}
            </span>
          </div>
        )}

        <div className="flex-1 p-4" style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 0 }}>
          {chartConfig ? (
            <ResizableChart key={`${item.i}-${variableUpdateTrigger}`} options={chartConfig} />
          ) : (
            <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 rounded-xl border-2 border-dashed border-slate-300">
              <div className="text-center px-6 py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 mb-4">
                  {contentType === 'html' ? (
                    <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  ) : contentType === 'table' ? (
                    <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : contentType === 'tableChart' ? (
                    <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ) : (
                    <svg className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  )}
                </div>
                <h3 className="text-base font-semibold text-slate-800 mb-2">
                  Configure Your {contentType === 'html' ? 'HTML Card' : contentType === 'table' ? 'Table' : contentType === 'tableChart' ? 'Table + Chart' : 'Chart'}
                </h3>
                <p className="text-sm text-slate-600 mb-4 max-w-xs mx-auto">
                  This {contentType === 'html' ? 'card' : contentType} is ready to be configured
                  {contentType === 'html' && ' with custom HTML and inline styles'}
                  {contentType === 'table' && ' with your data'}
                  {contentType === 'tableChart' && ' with combined table and chart view'}
                  {contentType === 'chart' && ' with your data and visualizations'}
                </p>
                {isEditMode && (
                  <button 
                    onClick={(e) => handleEditClick(e, item.i)} 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Configure {contentType === 'html' ? 'HTML' : contentType === 'table' ? 'Table' : contentType === 'tableChart' ? 'Table+Chart' : 'Chart'}
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
    <div 
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <FilterPanel showFilters={showFilters} topOffset={filterPanelTopOffset} />

      {/* Beautiful Purple Gradient Navbar - Matching EditChart */}
      <div 
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px 0 rgba(102, 126, 234, 0.3)',
        }}
      >
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="flex items-center justify-center w-12 h-12 rounded-xl shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)',
                }}
              >
                <img src="RBI.png" alt="Logo" className="h-8 w-8" />
              </div>
              <div>
                <h1 
                  className="text-xl font-bold leading-tight drop-shadow-md"
                  style={{ color: 'white', letterSpacing: '0.5px' }}
                >
                  Report Builder Intelligence
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs font-medium" style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                    {isEditMode ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#fde047' }}></span>
                        Edit Mode
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#86efac' }}></span>
                        View Mode
                      </span>
                    )}
                  </p>
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '10px' }}>•</span>
                  <div className="flex items-center gap-2">
                    <span 
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-semibold backdrop-blur-sm"
                      style={{ 
                        fontSize: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                      </svg>
                      {Object.keys(availableVariables).length}
                    </span>
                    <span 
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-semibold backdrop-blur-sm"
                      style={{ 
                        fontSize: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      {visibleCharts.length}
                    </span>
                    {hiddenChartCount > 0 && (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-semibold backdrop-blur-sm"
                        style={{ 
                          fontSize: '10px',
                          backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        }}
                      >
                        {hiddenChartCount}
                      </span>
                    )}
                    <span 
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-white font-semibold backdrop-blur-sm"
                      style={{ 
                        fontSize: '10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      }}
                    >
                      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 7V4z" />
                      </svg>
                      {filterNames.length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="mr-1">
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedbranch(e.target.value)}
                  className="bg-white/10 text-white text-sm px-3 py-1.5 rounded-lg border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                  style={{
                    backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                  }}
                >
                  {branchOptions.map((branch) => (
                    <option 
                      key={branch.id} 
                      value={branch.id}
                      style={{
                        backgroundColor: '#667eea',
                        color: 'white',
                      }}
                    >
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 backdrop-blur-sm ${
                  showFilters 
                    ? "text-white shadow-lg" 
                    : "text-white hover:bg-white/20 border"
                }`}
                style={{
                  backgroundColor: showFilters ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  borderColor: showFilters ? 'transparent' : 'rgba(255, 255, 255, 0.2)',
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 7V4z" />
                </svg>
                Filters
                {filterNames.length > 0 && (
                  <span 
                    className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold"
                    style={{
                      backgroundColor: showFilters ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)',
                    }}
                  >
                    {filterNames.length}
                  </span>
                )}
              </button>

              {/* {isEditMode && (
                <button 
                  onClick={toggleCompactType} 
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg hover:bg-white/20 border backdrop-blur-sm transition-all duration-200"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                  </svg>
                  {compactType === null ? "Free" : compactType === "vertical" ? "Vertical" : "Horizontal"}
                </button>
              )} */}

              <button
                onClick={toggleEditMode}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 shadow-lg ${
                  isEditMode 
                    ? "text-white shadow-green-500/50" 
                    : "text-purple-600 shadow-white/50 hover:shadow-white/70"
                }`}
                style={{
                  background: isEditMode 
                    ? 'linear-gradient(to right, #10b981, #14b8a6)'
                    : 'white',
                }}
              >
                {isEditMode ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Save
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Name Section - Visible in both Edit and View modes */}
      <div 
        className="fixed left-0 right-0 z-40"
        style={{
          top: '68px',
          background: 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
          borderBottom: '2px solid rgba(139, 92, 246, 0.3)',
          boxShadow: '0 2px 12px rgba(139, 92, 246, 0.15)',
        }}
      >
        <div className="px-6 py-2 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div 
              className="flex items-center justify-center w-7 h-7 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
              }}
            >
              <svg className="w-4 h-4 text-indigo-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-indigo-900">Dashboard:</span>
          </div>
          
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={dashboardName}
              onChange={(e) => setDashboardName(e.target.value)}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setIsEditingName(false);
                if (e.key === 'Escape') {
                  setDashboardName("My Dashboard");
                  setIsEditingName(false);
                }
              }}
              className="text-base font-bold text-gray-900 bg-white border-2 border-indigo-500 outline-none px-3 py-1 rounded-lg shadow-sm"
              style={{ minWidth: '200px', maxWidth: '400px' }}
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-base font-bold text-indigo-900 hover:text-indigo-700 transition-colors px-3 py-1 rounded-lg hover:bg-white/40 border border-transparent hover:border-indigo-300"
            >
              {dashboardName}
            </button>
          )}
          
          <button
            onClick={() => setIsEditingName(true)}
            className="p-1 text-indigo-600 hover:text-indigo-700 hover:bg-white/40 rounded transition-colors"
            title="Edit name"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Edit Mode Toolbar - Compact Inline */}
      {isEditMode && (
        <div 
          className="fixed left-0 right-0 z-40"
          style={{
            top: '111px',
            background: 'linear-gradient(135deg,rgb(204, 204, 224) 0%,rgb(205, 195, 250) 100%)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
            boxShadow: '0 2px 8px rgba(139, 92, 246, 0.1)',
          }}
        >
          <div className="px-6 py-2">
            <div className="flex items-center justify-between">
              {/* Left - Drag and Drop */}
              <div className="flex items-center gap-3">
                <div
                  className="droppable-element group inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-600 hover:to-purple-600 border-2 border-dashed border-indigo-300 hover:border-solid hover:border-indigo-600 rounded-lg px-4 py-2 cursor-grab active:cursor-grabbing transition-all duration-200 shadow-sm hover:shadow-md select-none"
                  draggable={true}
                  unselectable="on"
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", "");
                    e.dataTransfer.effectAllowed = "move";
                    setTimeout(() => { e.dataTransfer.dropEffect = "move"; }, 0);
                  }}
                  onDragEnd={(e) => { e.preventDefault(); }}
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-indigo-100 group-hover:bg-white/20">
                    <svg className="w-4 h-4 text-indigo-600 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span className="text-sm font-semibold text-indigo-900 group-hover:text-white transition-colors">Drag to Add Content</span>
                </div>
                
                <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-blue-50 px-3 py-1.5 rounded-md border border-blue-200">
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">Drag and drop to position charts, tables, or HTML cards</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compaction Error Warning Banner */}
      {compactionError && (
        <div 
          className="fixed left-1/2 transform -translate-x-1/2 z-[45] bg-amber-500 text-white px-6 py-3 rounded-lg shadow-xl animate-pulse"
          style={{
            top: isEditMode ? '170px' : '126px',
          }}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm font-medium">Auto-layout temporarily paused to prevent conflicts</p>
          </div>
        </div>
      )}

      {/* Main Content Area with Dotted Background */}
      <div 
        className={`px-2 pb-16 transition-all duration-300 ${isEditMode ? 'pt-48' : 'pt-32'} ${showFilters ? 'mr-80' : 'mr-0'}`}
        style={{
          backgroundImage: isEditMode ? `radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)` : 'none',
          backgroundSize: isEditMode ? '24px 24px' : 'auto',
          backgroundPosition: isEditMode ? '0 0' : 'initial',
          minHeight: 'calc(100vh - 80px)',
        }}
      >
        
        {/* EDIT MODE: Use ResponsiveGridLayout */}
        {isEditMode && (
          <ResponsiveGridLayout
            key={`grid-edit-${gridStateKey}`}
            className="layout"
            layouts={getCleanLayouts()}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={80}
            compactType={getSafeCompactType()}
            preventCollision={!getSafeCompactType()}
            useCSSTransforms={mounted}
            onLayoutChange={onLayoutChange}
            onBreakpointChange={onBreakpointChange}
            onDrop={onDrop}
            onDrag={onDrag}
            onResize={onResize}
            droppingItem={{ i: "__dropping-elem__", w: 6, h: 4 }}
            isDroppable={true}
            isResizable={true}
            isDraggable={true}
            draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn, .non-draggable-visibility-btn"
            resizeHandles={resizeHandle}
            allowOverlap={false}
            margin={[12, 12]}
            style={{ minHeight: '400px' }}
            verticalCompact={true}
            maxRows={100}
          >
            {visibleCharts.map((item: Layout) => (
              <div
                key={item.i}
                className="rounded-xl shadow-md hover:shadow-xl border overflow-hidden transition-all duration-200 backdrop-blur-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                  borderColor: 'rgba(203, 213, 225, 0.6)',
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

        {/* VIEW MODE: Use ResponsiveGridLayout */}
        {!isEditMode && (
          <ResponsiveGridLayout
            key={`grid-view-${gridStateKey}`}
            className="layout"
            layouts={getCleanLayouts()}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={100}
            compactType={getSafeCompactType()}
            preventCollision={!getSafeCompactType()}
            useCSSTransforms={mounted}
            onBreakpointChange={onBreakpointChange}
            isDroppable={false}
            isResizable={false}
            isDraggable={false}
            allowOverlap={false}
            margin={[12, 12]}
            style={{ minHeight: '400px' }}
            verticalCompact={true}
            maxRows={100}
          >
            {visibleCharts.map((item: Layout) => (
              <div
                key={item.i}
                className="rounded-xl shadow-md border overflow-hidden backdrop-blur-sm"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                  borderColor: 'rgba(203, 213, 225, 0.6)',
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

        {/* Empty State */}
        {(!layouts[currentBreakpoint] || layouts[currentBreakpoint].length === 0) && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(203, 213, 225, 0.5) 0%, rgba(147, 197, 253, 0.3) 100%)',
                }}
              >
                <svg className="h-10 w-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2 2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">Your Dashboard is Empty</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">
                {isEditMode
                  ? "Start building your dashboard by dragging the 'Add Content' element into the dotted area"
                  : "Switch to edit mode to add charts, tables, or HTML cards to your dashboard"
                }
              </p>
              {!isEditMode && (
                <button 
                  onClick={toggleEditMode} 
                  className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 4px 20px 0 rgba(102, 126, 234, 0.3)',
                  }}
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Enter Edit Mode
                </button>
              )}
            </div>
          </div>
        )}

        {/* All Charts Hidden State */}
        {visibleCharts.length === 0 && layouts[currentBreakpoint]?.length > 0 && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center max-w-md">
              <div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
                style={{
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%)',
                }}
              >
                <svg className="h-10 w-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-3">All Content Hidden</h3>
              <p className="text-slate-600 mb-2">
                All {hiddenChartCount} item{hiddenChartCount > 1 ? 's are' : ' is'} currently hidden by visibility conditions.
              </p>
              <p className="text-sm text-slate-500">
                Adjust your filter values or update visibility settings to display content
              </p>
            </div>
          </div>
        )}

        {/* Hidden Charts Alert */}
        {hiddenChartCount > 0 && visibleCharts.length > 0 && (
          <div 
            className="mt-6 border rounded-xl p-4 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%)',
              borderColor: 'rgba(102, 126, 234, 0.3)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div 
                  className="flex items-center justify-center w-8 h-8 rounded-lg"
                  style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)' }}
                >
                  <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-md font-medium text-indigo-900 hover:text-indigo-700 transition-colors">
                  {hiddenChartCount} item{hiddenChartCount > 1 ? 's are' : ' is'} hidden
                </p>
                <p className="text-xs text-indigo-900 hover:text-indigo-700 transition-colors mt-1">
                  These items are currently hidden based on your visibility conditions
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tableau-Style Footer with View Tabs */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[60] border-t shadow-lg" 
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderTopColor: 'rgba(102, 126, 234, 0.3)',
          boxShadow: '0 -4px 20px 0 rgba(102, 126, 234, 0.2)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-2">
          {/* Left Side - View Tabs */}
          <div className="flex items-center gap-1">
            {views.map((view) => (
              <button
                key={view.id}
                onClick={() => setSelectedView(view.id)}
                className={`group relative px-4 py-1.5 text-sm font-medium rounded-t-lg transition-all ${
                  selectedView === view.id
                    ? "bg-white text-gray-900 shadow-md"
                    : "bg-transparent text-white hover:bg-white/20 hover:text-white"
                }`}
              >
                {view.name}
                {selectedView === view.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
                )}
              </button>
            ))}
            
            {/* Add View Button */}
            <button
              className="ml-2 p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded transition-colors"
              title="Add View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>

          {/* Download options */}
          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 mr-3">
              <select
                value={selectDownloadOption}
                onChange={(e) => setSelectedDownloadOption(e.target.value)}
                className="bg-white/10 text-white text-sm px-3 py-1.5 rounded border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                style={{
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                }}
              >
                {downloadOptions.map((view) => (
                  <option 
                    key={view.id} 
                    value={view.id}
                    style={{
                      backgroundColor: '#667eea',
                      color: 'white',
                    }}
                  >
                    {view.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Right Side - View Options Dropdown */}
            <div className="flex items-center gap-3">
              <select
                value={selectedCustomView}
                onChange={(e) => setSelectedCustomView(e.target.value)}
                className="bg-white/10 text-white text-sm px-3 py-1.5 rounded border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 backdrop-blur-sm"
                style={{
                  backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
                }}
              >
                {customViews.map((view) => (
                  <option 
                    key={view.id} 
                    value={view.id}
                    style={{
                      backgroundColor: '#667eea',
                      color: 'white',
                    }}
                  >
                    {view.name}
                  </option>
                ))}
              </select>
              
              <div className="text-xs text-white/80 font-medium">
                {visibleCharts.length} sheet{visibleCharts.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}