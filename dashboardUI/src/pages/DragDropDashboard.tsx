import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../App";
import { useRecoilState, useRecoilValue, useRecoilCallback, useSetRecoilState } from "recoil";
import { chartConfigState } from "../recoil/ChartConfig";
import { layoutState } from "../recoil/LayoutState";
import ResizableChart from "../components/ResizableChart";
import FilterPanel from "../components/FilterPanel";
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { isChartVisibleSelector, chartDynamicDimensionsSelector } from '../recoil/DashboardVisibility';
import { IsEditModeState } from "../recoil/IsEditeMode";
import { dahboardNameMain } from "../recoil/DashboardName";
import { Typography, Box, CircularProgress, Menu, MenuItem, Divider } from "@mui/material";
import { dataLoadedState } from '../components/DataInitializer';
import Highcharts from 'highcharts';
import {
  exportAllAsPNG,
  exportAllAsJPEG,
  exportAllAsPDF,
  exportAllAsSVG,
  exportAllAsCSV,
  exportAllAsExcel,
  ChartRef,
} from '../utils/downloadUtilities';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface ChartConfigData {
  template?: string;
  htmlContent?: string;
  type?: 'chart' | 'html' | 'table' | 'tableChart';
  processed?: any;
  [key: string]: any;
}

// 🔥 FIXED: Preserve formatted number strings
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

const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  
  Object.entries(variables).forEach(([name, value]) => {
    // Check if the raw stored value is a formatted number (before parsing)
    const isFormattedNumber = typeof value === 'string' && /^[\d,]+$/.test(value);
    
    let replacement: string;
    
    if (isFormattedNumber) {
      // 🔥 Formatted numbers: use as-is without quotes
      replacement = value;
    } else {
      // 🔥 Everything else: stringify the raw value
      replacement = JSON.stringify(value);
    }
    
    // Replace in JSON context: "${variableName}"
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    
    // Replace in HTML context: ${variableName}
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  
  return result;
};

const deepClone = <T,>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item)) as unknown as T;
  }
  
  const cloned: any = {};
  Object.keys(obj).forEach(key => {
    cloned[key] = deepClone((obj as any)[key]);
  });
  
  return cloned as T;
};

const makeMutableLayoutItem = (item: Layout): Layout => {
  const mutable: any = {
    i: String(item.i),
    x: Number(item.x),
    y: Number(item.y),
    w: Number(item.w),
    h: Number(item.h),
  };
  
  if (item.minW !== undefined) mutable.minW = Number(item.minW);
  if (item.maxW !== undefined) mutable.maxW = Number(item.maxW);
  if (item.minH !== undefined) mutable.minH = Number(item.minH);
  if (item.maxH !== undefined) mutable.maxH = Number(item.maxH);
  if (item.static !== undefined) mutable.static = Boolean(item.static);
  if (item.isDraggable !== undefined) mutable.isDraggable = Boolean(item.isDraggable);
  if (item.isResizable !== undefined) mutable.isResizable = Boolean(item.isResizable);
  if (item.isBounded !== undefined) mutable.isBounded = Boolean(item.isBounded);
  if (item.resizeHandles) mutable.resizeHandles = [...item.resizeHandles];
  if (item.moved !== undefined) mutable.moved = Boolean(item.moved);
  
  return mutable as Layout;
};

export default function DropDragDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const idRef = useRef(1);

  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  const variableNames = useRecoilValue(variableNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const dataLoaded = useRecoilValue(dataLoadedState);

  const [layouts, setLayouts] = useRecoilState(layoutState);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditMode, setIsEditMode] = useRecoilState<boolean>(IsEditModeState);

  // Track if we've already reset filters for this dashboard visit
  const hasResetForThisVisitRef = useRef<boolean>(false);

  // 🔥 Reset filters to default values when navigating to /dashboards
  const resetFiltersToDefaults = useRecoilCallback(
    ({ snapshot, set }) =>
      async () => {
        console.log('🔄 [Dashboard] Resetting filters to default values...');
        
        try {
          const currentFilterNames = await snapshot.getPromise(filterNamesState);
          console.log(`   Found ${currentFilterNames.length} filters to reset`);
          
          let resetCount = 0;
          for (const filterVariableName of currentFilterNames) {
            try {
              const filterConfig = await snapshot.getPromise(filterConfigFamily(filterVariableName));
              
              if (filterConfig?.defaultValues && filterConfig.defaultValues.length > 0) {
                console.log(`   Resetting ${filterConfig.variableName} to:`, filterConfig.defaultValues);
                set(liveFilterFamily(filterConfig.variableName), filterConfig.defaultValues);
                resetCount++;
              } else {
                console.log(`   Skipping ${filterVariableName} - no default values`);
              }
            } catch (err) {
              console.warn(`   Error resetting ${filterVariableName}:`, err);
            }
          }
          
          // Small delay to ensure state propagates
          await new Promise(resolve => setTimeout(resolve, 100));
          
          console.log(`✅ [Dashboard] Reset ${resetCount} filters to default values`);
          return resetCount;
        } catch (err) {
          console.error('❌ [Dashboard] Error resetting filters:', err);
          throw err;
        }
      },
    []
  );

  // Reset filters to defaults whenever we're on /dashboards route
  useEffect(() => {
    const currentPath = location.pathname;
    const isOnDashboards = currentPath === '/dashboards';
    
    // Reset filters if:
    // 1. We're on /dashboards
    // 2. Data is loaded
    // 3. We haven't reset for this visit yet
    if (isOnDashboards && dataLoaded && !hasResetForThisVisitRef.current) {
      console.log('🔄 [Dashboard] Resetting filters to defaults (always reset on /dashboards)');
      
      // Reset filters and wait for it to complete
      resetFiltersToDefaults().then(() => {
        console.log('✅ [Dashboard] Filter reset completed');
        hasResetForThisVisitRef.current = true; // Mark as reset for this visit
      }).catch(err => {
        console.error('❌ [Dashboard] Filter reset failed:', err);
      });
    }
    
    // Reset the flag when we leave /dashboards (so it resets again on next visit)
    if (!isOnDashboards && hasResetForThisVisitRef.current) {
      hasResetForThisVisitRef.current = false;
      console.log('📍 [Dashboard] Left /dashboards, reset flag cleared for next visit');
    }
  }, [location.pathname, dataLoaded, resetFiltersToDefaults]);

  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});
  const [chartVisibility, setChartVisibility] = useState<Record<string, boolean>>({});
  const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number } | null>>({});

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
 
  const [dashboardName, setDashboardName] = useRecoilState(dahboardNameMain);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // 🔥 CRITICAL: Store TRUE original positions (before any visibility changes)
  const trueOriginalPositionsRef = useRef<Record<string, Layout>>({});
  const isInternalUpdateRef = useRef<boolean>(false);
  const previousVisibilityRef = useRef<Record<string, boolean>>({});

  const [selectedView, setSelectedView] = useState<string>("dashboardName");
  const [selectedCustomView, setSelectedCustomView] = useState<string>("default");
  const [selectedBranch, setSelectedbranch] = useState<string>("createBranch");
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);

  const [views] = useState([
    { id: "dashboardName", name: dashboardName },
    { id: "view-1", name: "View 1" },
    { id: "view-2", name: "View 2" },
    { id: "view-3", name: "View 3" },
  ]);

  const [customViews] = useState([
    { id: "default", name: "Default" },
    { id: "cust-view-1", name: "Custom Filter View 1" },
    { id: "cust-view-2", name: "Custom Filter View 2" },
    { id: "cust-view-3", name: "Custom Filter View 3" },
  ]);

  const [downloadOptions] = useState([
    { id: "png", name: "Image (PNG)", icon: "🖼️", description: "Download all as PNG" },
    { id: "jpeg", name: "Image (JPEG)", icon: "📷", description: "Download all as JPEG" },
    { id: "pdf", name: "PDF", icon: "📄", description: "Download combined PDF" },
    { id: "svg", name: "SVG", icon: "🎨", description: "Vector export for charts" },
    { id: "csv", name: "CSV", icon: "📊", description: "Data export as CSV" },
    { id: "xls", name: "Excel", icon: "📗", description: "All cards as sheets" },
  ]);

  const [branchOptions] = useState([
    { id: "createBranch", name: "Create Branch" },
    { id: "branch5", name: "Claims Volume b1" },
    { id: "branch4", name: "Claims Volume b2" },
    { id: "branch1", name: "Project Volume b1" },
    { id: "branch2", name: "Custom Comparison b1" },
    { id: "branch3", name: "Patient Provider b1" }
  ]);

  const [mounted, setMounted] = useState(false);
  const [currentBreakpoint, setCurrentBreakpoint] = useState("lg");
  const [resizeHandle] = useState<('s' | 'n' | 'se' | 'ne' | 'w' | 'e' | 'sw' | 'nw')[]>(['s', 'n', 'se', 'ne', 'w', 'e', 'sw', 'nw']);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);


  // 🔥 CRITICAL FIX: Create default layouts for charts that have configs but no layouts
  useEffect(() => {
    if (!dataLoaded) return; // Wait for data to load
    
    const chartIds = Object.keys(chartConfigs);
    if (chartIds.length === 0) {
      console.log('📊 No chart configs found');
      return;
    }
    
    // Check if we have layouts for any breakpoint
    const hasAnyLayouts = Object.values(layouts).some(layout => layout && layout.length > 0);
    
    if (!hasAnyLayouts && chartIds.length > 0) {
      console.log(`⚠️ Found ${chartIds.length} chart configs but no layouts. Creating default layouts...`);
      
      // Create default layouts for all breakpoints
      const defaultLayouts: { [key: string]: Layout[] } = {
        lg: [],
        md: [],
        sm: [],
        xs: [],
        xxs: []
      };
      
      // Arrange charts in a grid (4 columns for lg, adjust for others)
      const colsPerRow = { lg: 4, md: 3, sm: 2, xs: 2, xxs: 1 };
      const defaultWidth = { lg: 3, md: 4, sm: 6, xs: 6, xxs: 2 };
      const defaultHeight = 4;
      
      chartIds.forEach((chartId, index) => {
        const row = Math.floor(index / colsPerRow.lg);
        const col = index % colsPerRow.lg;
        
        Object.keys(defaultLayouts).forEach(bp => {
          const bpKey = bp as keyof typeof colsPerRow;
          const rowForBp = Math.floor(index / colsPerRow[bpKey]);
          const colForBp = index % colsPerRow[bpKey];
          
          defaultLayouts[bp].push({
            i: chartId,
            x: colForBp * defaultWidth[bpKey],
            y: rowForBp * defaultHeight,
            w: defaultWidth[bpKey],
            h: defaultHeight,
            minW: 2,
            minH: 1  // Allow charts to be resized down to 1 unit
          });
        });
        
        // Store as true original position
        trueOriginalPositionsRef.current[chartId] = {
          i: chartId,
          x: col * defaultWidth.lg,
          y: row * defaultHeight,
          w: defaultWidth.lg,
          h: defaultHeight,
          minW: 2,
          minH: 1  // Allow charts to be resized down to 1 unit
        };
      });
      
      console.log(`✅ Created default layouts for ${chartIds.length} charts`);
      setLayouts(defaultLayouts);
      
      // Save layouts to database
      fetch('http://localhost:3002/api/layouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts: defaultLayouts })
      }).catch(err => {
        console.warn('Failed to save default layouts:', err);
      });
    } else {
      // Initialize TRUE original positions for existing layouts
      const currentLayout = layouts[currentBreakpoint] || [];
      currentLayout.forEach((item: Layout) => {
        if (!trueOriginalPositionsRef.current[item.i]) {
          const originalPos = makeMutableLayoutItem(item);
          // Override minH to 1 to allow flexible resizing
          originalPos.minH = 1;
          trueOriginalPositionsRef.current[item.i] = originalPos;
          console.log(`📍 [INIT] Stored TRUE original position for ${item.i}:`, originalPos);
        } else {
          // Update existing stored position to have minH: 1
          trueOriginalPositionsRef.current[item.i].minH = 1;
        }
      });
    }
  }, [dataLoaded, chartConfigs, layouts, currentBreakpoint, setLayouts]);

  // 🔥 PERFORMANCE: Use synchronous getLoadable instead of async getPromise
  const getAllVariables = useRecoilCallback(({ snapshot }) => (): Record<string, any> => {
    const variables: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);

    for (const varName of varNameArray) {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(varName));
        if (loadable.state === 'hasValue') {
          const varValue = loadable.contents;
          if (varValue !== undefined && varValue !== null) {
            variables[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
          }
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

  // 🔥 PERFORMANCE: Synchronous variable loading
  useEffect(() => {
    console.log(`🔄 variableUpdateTrigger changed to: ${variableUpdateTrigger}`);
    const vars = getAllVariables();
    console.log(`📦 Got ${Object.keys(vars).length} variables`);
    setAvailableVariables(vars);
  }, [getAllVariables, variableUpdateTrigger]);

  // 🔥 KEY FIX: When visibility changes, restore ALL items to their TRUE original positions
  useEffect(() => {
    if (!dataLoaded) return; // Wait for data to load
    
    getChartVisibility().then((newVisibility) => {
      // Ensure all charts in configs have visibility set (default to true if not set)
      const allChartIds = Object.keys(chartConfigs);
      allChartIds.forEach(chartId => {
        if (newVisibility[chartId] === undefined) {
          newVisibility[chartId] = true; // Default to visible
          console.log(`👁️ [Visibility] Chart ${chartId} had no visibility rule, defaulting to visible`);
        }
      });
      
      const hasChanged = Object.keys(newVisibility).some(
        chartId => previousVisibilityRef.current[chartId] !== newVisibility[chartId]
      );

      if (!hasChanged && Object.keys(previousVisibilityRef.current).length > 0) {
        return;
      }

      console.log('👁️ Visibility changed:', newVisibility);
      console.log(`   Total charts: ${allChartIds.length}, Visible: ${Object.values(newVisibility).filter(v => v !== false).length}`);

      // Check if any hidden card is becoming visible
      const anyBecameVisible = Object.keys(newVisibility).some(chartId => {
        const wasHidden = previousVisibilityRef.current[chartId] === false;
        const isNowVisible = newVisibility[chartId] !== false;
        return wasHidden && isNowVisible;
      });

      if (anyBecameVisible) {
        console.log('🔄 Cards becoming visible - restoring ALL to original positions');
        
        isInternalUpdateRef.current = true;
        
        // Restore ALL items to their TRUE original positions
        setLayouts(prev => {
          const updated: { [key: string]: Layout[] } = {};
          
          Object.keys(prev).forEach(bp => {
            const currentLayout = prev[bp] || [];
            const restoredLayout: Layout[] = [];
            
            // Restore each item to its TRUE original position
            currentLayout.forEach((item: Layout) => {
              if (trueOriginalPositionsRef.current[item.i]) {
                console.log(`🔄 Restoring ${item.i} to TRUE original position:`, trueOriginalPositionsRef.current[item.i]);
                restoredLayout.push(makeMutableLayoutItem(trueOriginalPositionsRef.current[item.i]));
              } else {
                restoredLayout.push(makeMutableLayoutItem(item));
              }
            });
            
            // Sort by original Y position to maintain order
            restoredLayout.sort((a, b) => {
              if (a.y === b.y) return a.x - b.x;
              return a.y - b.y;
            });
            
            updated[bp] = restoredLayout;
          });
          
          return updated;
        });

        setTimeout(() => {
          isInternalUpdateRef.current = false;
        }, 100);
      }
      
      previousVisibilityRef.current = { ...newVisibility };
      setChartVisibility(newVisibility);
    });
  }, [dataLoaded, getChartVisibility, filterNames, variableUpdateTrigger, setLayouts, chartConfigs]);

  useEffect(() => {
    getChartDimensions().then(setChartDimensions);
  }, [getChartDimensions, filterNames, variableUpdateTrigger]);

  // Process chart configs with variable replacement (no caching - causes stale data)
  const processedChartConfigs = useMemo(() => {
    const processed: Record<string, any> = {};

    Object.entries(chartConfigs).forEach(([id, config]) => {
      if (!config) {
        processed[id] = null;
        return;
      }

      if (config.type === 'html' && config.htmlContent) {
        try {
          const htmlWithVariables = replaceVariableReferences(config.htmlContent, availableVariables);
          processed[id] = { html: htmlWithVariables, type: 'html' };
        } catch (error) {
          processed[id] = { html: config.htmlContent, type: 'html' };
        }
        return;
      }

      if (config.type === 'table' || config.type === 'tableChart') {
        processed[id] = null;
        return;
      }

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
          processed[id] = null;
        }
      } else {
        processed[id] = null;
      }
    });

    return processed;
  }, [chartConfigs, availableVariables]);

  // Initialize idRef from database on mount
  useEffect(() => {
    const initializeChartId = async () => {
      try {
        const response = await fetch('http://localhost:3002/api/next-chart-id');
        const data = await response.json();
        if (data.success && data.nextChartId) {
          idRef.current = data.nextChartId;
          console.log(`✅ Initialized chart ID counter to ${idRef.current}`);
        }
      } catch (err) {
        console.warn('Failed to fetch next chart ID from server, using fallback:', err);
        // Fallback: use layouts if available
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
      }
    };
    
    initializeChartId();
  }, [layouts]);

  const getCurrentLayout = useCallback(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return currentLayout.map(makeMutableLayoutItem);
  }, [layouts, currentBreakpoint]);

  // Filter by visibility in both modes
  const visibleCharts = useMemo(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return currentLayout.filter((item: Layout) => chartVisibility[item.i] !== false);
  }, [layouts, currentBreakpoint, chartVisibility]);

  const hiddenChartCount = useMemo(() => {
    const currentLayout = layouts[currentBreakpoint] || [];
    return currentLayout.filter((item: Layout) => chartVisibility[item.i] === false).length;
  }, [layouts, currentBreakpoint, chartVisibility]);

  // Collect chart references for export (after configs & visibility are computed)
  const collectChartRefs = useCallback((): ChartRef[] => {
    const refs: ChartRef[] = [];
    for (const item of visibleCharts) {
      const configData = chartConfigs[item.i];
      const contentType = (configData?.type as any) || 'chart';
      const container = document.querySelector(`[data-chart-id="${item.i}"]`) as HTMLElement | null;

      let title = `Chart_${item.i}`;
      if (contentType === 'chart' && processedChartConfigs[item.i]) {
        const chartTitle = processedChartConfigs[item.i]?.title?.text;
        if (chartTitle) title = typeof chartTitle === 'string' ? chartTitle : String(chartTitle);
      } else if (contentType === 'html' && configData?.htmlContent) {
        const temp = document.createElement('div');
        temp.innerHTML = configData.htmlContent;
        const h = temp.querySelector('h1,h2,h3');
        if (h?.textContent) title = h.textContent;
      }

      let chartInstance: Highcharts.Chart | null = null;
      if (contentType === 'chart' && container) {
        const hc = container.querySelector('.highcharts-container') as HTMLElement | null;
        if (hc) {
          chartInstance = Highcharts.charts.find((ch: any) => ch?.renderTo === hc) as Highcharts.Chart | null;
        }
        if (!chartInstance) {
          chartInstance = Highcharts.charts.find((ch: any) => {
            const renderTo = ch?.renderTo;
            return renderTo && container.contains(renderTo);
          }) as Highcharts.Chart | null;
        }
      }

      refs.push({
        chart: chartInstance,
        chartId: item.i,
        title: title.replace(/[^a-z0-9]/gi, '_'),
        type: contentType,
        htmlContent: contentType === 'html' ? configData?.htmlContent : undefined,
        containerElement: container || undefined,
      });
    }
    return refs;
  }, [visibleCharts, chartConfigs, processedChartConfigs]);

  const handleDownload = useCallback(async (format: string) => {
    if (isDownloading || visibleCharts.length === 0) return;
    setIsDownloading(true);
    try {
      const refs = collectChartRefs();
      switch (format.toLowerCase()) {
        case 'png':
          await exportAllAsPNG(refs);
          break;
        case 'jpeg':
          await exportAllAsJPEG(refs);
          break;
        case 'pdf':
          await exportAllAsPDF(refs, dashboardName);
          break;
        case 'svg':
          await exportAllAsSVG(refs);
          break;
        case 'csv':
          await exportAllAsCSV(refs);
          break;
        case 'xls':
          await exportAllAsExcel(refs, dashboardName);
          break;
        default:
          console.warn('Unknown format', format);
      }
    } catch (err) {
      console.error('Download failed', err);
      alert('Download failed. Please try again after charts finish rendering.');
    } finally {
      setIsDownloading(false);
      setDownloadMenuAnchor(null);
    }
  }, [collectChartRefs, isDownloading, visibleCharts.length, dashboardName]);

  // 🔥 PERFORMANCE FIX: Remove variableUpdateTrigger from key
  // Including it caused entire grid to remount on every calculation update
  // Charts already update via their props changing, no need to remount
  const gridStateKey = useMemo(() => {
    const visibleIds = visibleCharts.map(c => c.i).sort().join(',');
    return `${currentBreakpoint}-${visibleIds}-${isEditMode ? 'edit' : 'view'}`;
  }, [currentBreakpoint, visibleCharts, isEditMode]);

  const getCleanLayouts = useCallback(() => {
    const clean: { [key: string]: Layout[] } = {};
    
    Object.keys(layouts).forEach(breakpoint => {
      clean[breakpoint] = [];
      const seenIds = new Set<string>();
      
      (layouts[breakpoint] || []).forEach((item: Layout) => {
        if (seenIds.has(item.i)) {
          return;
        }
        seenIds.add(item.i);
        
        const dynamicDims = chartDimensions[item.i];
        
        const cleanItem: any = {
          i: String(item.i),
          x: Math.max(0, Math.min(11, Number(item.x) || 0)),
          y: Math.max(0, Number(item.y) || 0),
          w: dynamicDims ? Number(dynamicDims.width) : (Number(item.w) || 6),
          h: dynamicDims ? Number(dynamicDims.height) : (Number(item.h) || 4),
          minW: item.minW !== undefined ? Math.max(1, Number(item.minW)) : 1,
          maxW: item.maxW !== undefined ? Math.min(12, Number(item.maxW)) : 12,
          minH: 1, // Always allow resizing down to 1 unit (override database value)
          maxH: item.maxH !== undefined ? Math.min(20, Number(item.maxH)) : 20,
        };
        
        if (item.static !== undefined) cleanItem.static = Boolean(item.static);
        if (item.isDraggable !== undefined) cleanItem.isDraggable = Boolean(item.isDraggable);
        if (item.isResizable !== undefined) cleanItem.isResizable = Boolean(item.isResizable);
        if (item.isBounded !== undefined) cleanItem.isBounded = Boolean(item.isBounded);
        if (item.resizeHandles) cleanItem.resizeHandles = [...item.resizeHandles];
        if (item.moved !== undefined) cleanItem.moved = Boolean(item.moved);
        
        clean[breakpoint].push(cleanItem as Layout);
      });
      
      clean[breakpoint].sort((a, b) => {
        if (a.y === b.y) return a.x - b.x;
        return a.y - b.y;
      });
    });
    
    return clean;
  }, [layouts, chartDimensions]);

  const onLayoutChange = useCallback((_layout: Layout[], allLayouts: { [key: string]: Layout[] }) => {
    if (!isEditMode) {
      return;
    }

    if (isInternalUpdateRef.current) {
      console.log('🚫 [onLayoutChange] Ignored - internal update');
      return;
    }

    console.log('✅ [onLayoutChange] User-initiated change - updating TRUE original positions');

    const mutableLayout = _layout.map(makeMutableLayoutItem);
    const clonedLayouts: { [key: string]: Layout[] } = {};
    
    Object.keys(layouts).forEach(bp => {
      clonedLayouts[bp] = (layouts[bp] || []).map(makeMutableLayoutItem);
    });
    
    const currentLayout = clonedLayouts[currentBreakpoint] || [];

    const incomingMap = new Map<string, Layout>();
    mutableLayout.forEach(item => {
      incomingMap.set(item.i, item);
    });

    const updatedLayout = currentLayout.map((item: Layout) => {
      const updated = incomingMap.get(item.i);
      if (updated) {
        const mutableItem = makeMutableLayoutItem(updated);
        mutableItem.minH = 1; // Ensure minH is always 1 for flexible resizing
        // 🔥 CRITICAL: Update TRUE original position when user manually moves
        if (chartVisibility[item.i] !== false) {
          trueOriginalPositionsRef.current[item.i] = { ...mutableItem };
          console.log(`📍 Updated TRUE original position for ${item.i}:`, mutableItem);
        }
        return mutableItem;
      }
      const mutableItem = makeMutableLayoutItem(item);
      mutableItem.minH = 1; // Ensure minH is always 1
      return mutableItem;
    });

    mutableLayout.forEach(item => {
      const existsInCurrent = currentLayout.some((existing: Layout) => existing.i === item.i);
      if (!existsInCurrent && item.i !== "__dropping-elem__") {
        const newItem = makeMutableLayoutItem(item);
        newItem.minH = 1; // Ensure minH is always 1
        updatedLayout.push(newItem);
        trueOriginalPositionsRef.current[item.i] = { ...newItem };
      }
    });

    clonedLayouts[currentBreakpoint] = updatedLayout;
    
    isInternalUpdateRef.current = true;
    setLayouts(clonedLayouts);
    
    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 100);
  }, [isEditMode, layouts, currentBreakpoint, setLayouts, chartVisibility]);

  const onDrag = useCallback(() => {
    document.dispatchEvent(new CustomEvent('react-grid-layout-drag'));
  }, []);

  const onResize = useCallback(() => {
    document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
  }, []);

  const onBreakpointChange = useCallback((breakpoint: string) => {
    setCurrentBreakpoint(breakpoint);
  }, []);

  const onDrop = useCallback(async (_layout: Layout[], item: Layout) => {
    // Get next chart ID from server to ensure no duplicates
    let newId: string;
    try {
      const response = await fetch('http://localhost:3002/api/next-chart-id');
      const data = await response.json();
      if (data.success && data.nextChartId) {
        newId = data.nextChartId.toString();
        idRef.current = data.nextChartId + 1; // Update local ref for next time
      } else {
        // Fallback to local counter
        newId = idRef.current.toString();
        idRef.current += 1;
      }
    } catch (err) {
      console.warn('Failed to fetch next chart ID, using local counter:', err);
      // Fallback to local counter
      newId = idRef.current.toString();
      idRef.current += 1;
    }

    const newItem: Layout = makeMutableLayoutItem({
      i: newId,
      x: item.x,
      y: item.y,
      w: 6,
      h: 4,
      static: false,
    } as Layout);

    trueOriginalPositionsRef.current[newId] = makeMutableLayoutItem(newItem);

    isInternalUpdateRef.current = true;
    
    setLayouts(prev => {
      const updated: { [key: string]: Layout[] } = {};
      Object.keys(prev).forEach(bp => {
        updated[bp] = (prev[bp] || []).map(makeMutableLayoutItem);
      });
      
      if (!updated[currentBreakpoint]) {
        updated[currentBreakpoint] = [];
      }

      const filtered = updated[currentBreakpoint].filter((i: Layout) => i.i !== "__dropping-elem__");
      updated[currentBreakpoint] = [...filtered, newItem];

      return updated;
    });

    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 100);
  }, [currentBreakpoint, setLayouts]);

  const toggleCompactType = () => {
    setCompactType(prev => {
      const next = prev === null ? "vertical" : prev === "vertical" ? "horizontal" : null;
      return next;
    });
  };

  const removeItem = useCallback(async (id: string) => {
    // Delete from database first
    try {
      const response = await fetch(`http://localhost:3002/api/charts/${id}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Failed to delete chart from database:', data.error);
        alert('Failed to delete chart. Please try again.');
        return;
      }
      console.log(`✅ Chart ${id} deleted from database`);
    } catch (err) {
      console.error('Error deleting chart from database:', err);
      alert('Failed to delete chart. Please try again.');
      return;
    }

    // Update frontend state after successful database deletion
    delete trueOriginalPositionsRef.current[id];

    isInternalUpdateRef.current = true;

    setLayouts(prev => {
      const updated: { [key: string]: Layout[] } = {};
      Object.keys(prev).forEach(bp => {
        updated[bp] = (prev[bp] || [])
          .filter((item: Layout) => item.i !== id)
          .map(makeMutableLayoutItem);
      });
      return updated;
    });

    setChartConfigs(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 100);
  }, [setLayouts, setChartConfigs]);

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
  }, [removeItem]);

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
              onClick={(e) => handleVisibilityClick(e, item.i)}
              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
              title="Visibility Settings"
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
            <ResizableChart key={item.i} options={chartConfig} showExport={isEditMode ? false : true} />
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
                </p>
                {isEditMode && (
                  <button 
                    onClick={(e) => handleEditClick(e, item.i)} 
                    className="non-draggable-configure-btn inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Configure
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  // Show loading state if data isn't loaded yet
  if (!dataLoaded) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        }}
      >
        <CircularProgress size={60} sx={{ mb: 2 }} />
        <Typography variant="h6" color="text.secondary">
          Loading dashboard data...
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Please wait while we load charts, filters, and calculations
        </Typography>
      </Box>
    );
  }

  return (
    <>
    <div 
      className="min-h-screen"
      style={{
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      <FilterPanel showFilters={showFilters} topOffset={filterPanelTopOffset} />

      {/* Navbar */}
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
                  Report Builder
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
                        title={`${hiddenChartCount} hidden`}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                        </svg>
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

              {isEditMode && (
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
              )}

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

      {/* Dashboard Name Section */}
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
              className="text-base font-bold text-gray-900 bg-white border-2 border-indigo-500 outline-none rounded-lg shadow-sm px-2 py-1"
              style={{ minWidth: '200px', maxWidth: '400px' }}
            />
          ) : (
            <button
              onClick={() => isEditMode ? setIsEditingName(true) : setIsEditingName(false)}
              className="text-base font-bold text-indigo-900 hover:text-indigo-700 transition-colors px-2 py-1 rounded-lg hover:bg-white/40 border border-transparent hover:border-indigo-300"
            >
              {dashboardName}
            </button>
          )}

          {isEditMode && (
            <button
              onClick={() => setIsEditingName(true)}
              className="p-1 text-indigo-600 hover:text-indigo-700 hover:bg-white/40 rounded transition-colors"
              title="Edit name"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Edit Mode Toolbar */}
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

      {/* Main Content */}
      <div 
        className={`px-2 pb-16 transition-all duration-300 ${isEditMode ? 'pt-48' : 'pt-32'} ${showFilters ? 'mr-80' : 'mr-0'}`}
        style={{
          backgroundImage: isEditMode ? `radial-gradient(circle, #94a3b8 1.5px, transparent 1.5px)` : 'none',
          backgroundSize: isEditMode ? '24px 24px' : 'auto',
          backgroundPosition: isEditMode ? '0 0' : 'initial',
          minHeight: 'calc(100vh - 80px)',
        }}
      >
        <ResponsiveGridLayout
          key={gridStateKey}
          className="layout"
          layouts={getCleanLayouts()}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={60}
          compactType={compactType}
          preventCollision={false}
          useCSSTransforms={mounted}
          onLayoutChange={onLayoutChange}
          onBreakpointChange={onBreakpointChange}
          onDrop={isEditMode ? onDrop : undefined}
          onDrag={isEditMode ? onDrag : undefined}
          onResize={isEditMode ? onResize : undefined}
          droppingItem={isEditMode ? { i: "__dropping-elem__", w: 6, h: 4 } : undefined}
          isDroppable={isEditMode}
          isResizable={isEditMode}
          isDraggable={isEditMode}
          draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn, .non-draggable-visibility-btn, .non-draggable-configure-btn"
          resizeHandles={isEditMode ? resizeHandle : []}
          allowOverlap={false}
          margin={[12, 12]}
          style={{ minHeight: '400px' }}
          verticalCompact={true}
          maxRows={100}
        >
          {visibleCharts.map((item: Layout) => {
            const configData = chartConfigs[item.i];
            const contentType = configData?.type || 'chart';
            return (
              <div
                key={item.i}
                data-chart-id={item.i}
                data-chart-type={contentType}
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
            );
          })}
        </ResponsiveGridLayout>

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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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

        {/* All Charts Hidden */}
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
                Adjust your filter values to display content
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[60] border-t shadow-lg" 
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderTopColor: 'rgba(102, 126, 234, 0.3)',
          boxShadow: '0 -4px 20px 0 rgba(102, 126, 234, 0.2)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-2">
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
            
            <button
              className="ml-2 p-1.5 text-white/60 hover:text-white hover:bg-white/20 rounded transition-colors"
              title="Add View"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </button>
          </div>

          <div className="flex items-center justify-end">
            <div className="flex items-center gap-3 mr-3">
              <button
                onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                disabled={isDownloading || visibleCharts.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: isDownloading 
                    ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                    : 'linear-gradient(135deg,rgb(157, 173, 245) 0%,rgb(135, 93, 177) 100%)',
                  boxShadow: isDownloading 
                    ? '0 2px 8px rgba(148, 163, 184, 0.3)'
                    : '0 4px 15px rgba(102, 126, 234, 0.3)',
                }}
                title={visibleCharts.length === 0 ? 'No charts to download' : 'Download dashboard'}
              >
                {isDownloading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exporting...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </>
                )}
              </button>
              <Menu
                anchorEl={downloadMenuAnchor}
                open={Boolean(downloadMenuAnchor)}
                onClose={() => setDownloadMenuAnchor(null)}
                PaperProps={{
                  sx: {
                    mt: 1,
                    minWidth: 260,
                    borderRadius: 2,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              >
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                    Export Dashboard
                  </Typography>
                </Box>
                <Divider />
                {downloadOptions.map((option) => (
                  <MenuItem
                    key={option.id}
                    onClick={() => handleDownload(option.id)}
                    disabled={isDownloading || visibleCharts.length === 0}
                    sx={{
                      py: 1.4,
                      px: 2,
                      '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.08)' },
                      '&.Mui-disabled': { opacity: 0.5 },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                      <Box sx={{ fontSize: '1.2rem', width: 24, textAlign: 'center' }}>{option.icon}</Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {option.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.74rem' }}>
                          {option.description}
                        </Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                ))}
              </Menu>
            </div>

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
      {isDownloading && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'white',
              padding: '16px 20px',
              borderRadius: '12px',
              boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '220px',
              justifyContent: 'center',
              border: '1px solid rgba(148, 163, 184, 0.3)',
            }}
          >
            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '14px' }}>Exporting...</div>
              <div style={{ color: '#475569', fontSize: '12px' }}>Please wait while we prepare your download</div>
            </div>
          </div>
        </div>,
        document.body
      )}
  </>
  );
}