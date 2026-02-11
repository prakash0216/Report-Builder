import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Responsive, WidthProvider, Layout } from "react-grid-layout";
import { useDashboardContext } from '../context/DashboardContext';
import { authState, authAPI } from '../recoil/AuthState';
import NotFound from './NotFound';
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "../App";
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { chartConfigState } from "../recoil/ChartConfig";
import { layoutState } from "../recoil/LayoutState";
import ResizableChart from "../components/ResizableChart";
import ChartWithTooltip from "../components/ChartWithTooltip";
import FilterPanel, { filterPanelExpandedState } from "../components/FilterPanel";
import CardFilterPanel from "../components/CardFilterPanel";
import DashboardTable from "../components/DashboardTable";
import { tooltipConfigState } from "../recoil/TooltipConfigState";
import { onClickConfigState } from "../recoil/OnClickConfigState";
import { onClickSnapshotState } from "../recoil/OnClickSnapshotState";
import { useOnClickActions } from "../hooks/useOnClickActions";
import { childCardConfigState } from "../recoil/ChildCardState";
import { childCardTooltipConfigState } from "../recoil/ChildCardTooltipState";
import ParentCardContainer from "../components/ParentCardContainer";
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { filterConfigFamily, filterNamesState } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { isChartVisibleSelector, chartDynamicDimensionsSelector, chartVisibilityVariableState } from '../recoil/DashboardVisibility';
import { getCurrentViewId } from '../recoil/ViewContext';
import { IsEditModeState } from "../recoil/IsEditeMode";
import { dahboardNameMain } from "../recoil/DashboardName";
import {
  Typography, 
  Box, 
  CircularProgress, 
  Menu, 
  MenuItem, 
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  alpha,
  Avatar,
  Tooltip,
  IconButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import {
  Logout as LogoutIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  Description as DocsIcon,
  Help as HelpIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Download as DownloadIcon,
  ViewCompact as ViewCompactIcon,
  ChevronRight as ChevronRightIcon,
  Layers as LayersIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import { dataLoadedState } from '../components/DataInitializer';
import Highcharts from 'highcharts';
import {
  exportAllAsPDF,
  exportAllAsSVG,
  exportAllAsCSV,
  exportAllAsExcel,
  exportDashboardAsImage,
  ChartRef,
} from '../utils/downloadUtilities';
import { exportDashboardPPTXEditable } from '../utils/pptxExport';
import { API_BASE_URL } from '../config/api.config';

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
  const { dashboardName: dashboardSlug, viewName: viewSlug } = useParams<{ dashboardName: string; viewName: string }>();
  const idRef = useRef(1);
  const [auth, setAuth] = useRecoilState(authState);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Get dashboard context for error handling
  const { isLoading: contextLoading, errorType } = useDashboardContext();

  // Handle logout
  const handleLogout = () => {
    setUserMenuAnchor(null);
    authAPI.logout();
    setAuth({
      isAuthenticated: false,
      email: null,
    });
    navigate('/login');
  };

  // Convert slugs to display names
  const currentDashboardName = dashboardSlug
    ? dashboardSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'Dashboard';
  
  const currentViewName = viewSlug
    ? viewSlug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    : 'View';

  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const tooltipConfigs = useRecoilValue(tooltipConfigState);
  const clickSnapshot = useRecoilValue(onClickSnapshotState);
  const { onClickConfigs, handleChartClick, handleReset: handleOnClickReset, isOnClickEnabled } = useOnClickActions();
  const [childCardConfigs, setChildCardConfigs] = useRecoilState(childCardConfigState);
  const [tooltipConfigsForChildCards, setTooltipConfigsForChildCards] = useRecoilState(childCardTooltipConfigState);
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  const variableNames = useRecoilValue(variableNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const dataLoaded = useRecoilValue(dataLoadedState);
  // 🔥 Subscribe to visibility variable mappings to trigger re-render when rules change
  const visibilityVariableMap = useRecoilValue(chartVisibilityVariableState);
  
  // 🔥 Track visibility variable values to detect changes
  const [visibilityVarValues, setVisibilityVarValues] = useState<Record<string, any>>({});

  const [layouts, setLayouts] = useRecoilState(layoutState);
  const [openCardFilterId, setOpenCardFilterId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useRecoilState<boolean>(IsEditModeState);
  const isFilterPanelExpanded = useRecoilValue(filterPanelExpandedState);

  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});
  const [chartVisibility, setChartVisibility] = useState<Record<string, boolean>>({});
  
  const [chartDimensions, setChartDimensions] = useState<Record<string, { width: number; height: number } | null>>({});

  const [compactType, setCompactType] = useState<"vertical" | "horizontal" | null>("vertical");
 
  const [dashboardName, setDashboardName] = useRecoilState(dahboardNameMain);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dashboardGridRef = useRef<HTMLDivElement>(null);

  // 🔥 CRITICAL: Store TRUE original positions (before any visibility changes)
  const trueOriginalPositionsRef = useRef<Record<string, Layout>>({});
  const isInternalUpdateRef = useRef<boolean>(false);
  const previousVisibilityRef = useRef<Record<string, boolean>>({});

  const [selectedView, setSelectedView] = useState<string>("dashboardName");
  const [selectedCustomView, setSelectedCustomView] = useState<string>("default");
  const [selectedBranch, setSelectedbranch] = useState<string>("createBranch");
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<null | HTMLElement>(null);
  
  // Left navbar state
  const [allDashboards, setAllDashboards] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [bookmarkedDashboardIds, setBookmarkedDashboardIds] = useState<Set<string>>(new Set());

  // Dynamic views from database
  interface ViewData {
    id: string;
    name: string;
    slug: string;
  }
  const [dynamicViews, setDynamicViews] = useState<ViewData[]>([]);
  const [openCreateViewDialog, setOpenCreateViewDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDesc, setNewViewDesc] = useState('');
  const [isCreatingView, setIsCreatingView] = useState(false);

  // Fetch views from database
  const fetchViews = useCallback(async () => {
    if (!dashboardSlug) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardSlug}/views`);
      const data = await response.json();
      
      if (data.success && data.views) {
        const mappedViews: ViewData[] = data.views.map((v: any) => ({
          id: v.id.toString(),
          name: v.name,
          slug: v.slug,
        }));
        setDynamicViews(mappedViews);
      }
    } catch (err) {
      console.error('Error fetching views:', err);
    }
  }, [dashboardSlug]);

  // Fetch views on mount
  useEffect(() => {
    fetchViews();
  }, [fetchViews]);

  // Fetch all dashboards for left nav hover menu
  const fetchAllDashboards = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/dashboards`);
      const data = await response.json();
      if (data.success && data.dashboards) {
        const mapped = data.dashboards.map((d: any) => ({
          id: d.id.toString(),
          name: d.name,
          slug: d.slug || d.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
        }));
        setAllDashboards(mapped);
        
        // Also fetch bookmarked dashboard IDs
        const bookmarksResponse = await fetch(`${API_BASE_URL}/api/bookmarks`);
        const bookmarksData = await bookmarksResponse.json();
        if (bookmarksData.success && bookmarksData.dashboardIds) {
          setBookmarkedDashboardIds(new Set(bookmarksData.dashboardIds.map((id: number) => id.toString())));
        }
      }
    } catch (err) {
      console.error('Error fetching dashboards:', err);
    }
  }, []);

  useEffect(() => {
    fetchAllDashboards();
  }, [fetchAllDashboards]);

  // Handle create new view
  const handleCreateView = async () => {
    if (!newViewName.trim() || !dashboardSlug) return;

    try {
      setIsCreatingView(true);
      const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboardSlug}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newViewName,
          description: newViewDesc,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.view) {
        // Add to local state
        const newView: ViewData = {
          id: data.view.id.toString(),
          name: data.view.name,
          slug: data.view.slug,
        };
        setDynamicViews(prev => [...prev, newView]);
        
        // Reset form and close dialog
        setNewViewName('');
        setNewViewDesc('');
        setOpenCreateViewDialog(false);
        
        // Navigate to the new view
        navigate(`/${dashboardSlug}/${data.view.slug}`);
      } else {
        console.error('Failed to create view:', data.error);
        alert(data.error || 'Failed to create view');
      }
    } catch (err) {
      console.error('Error creating view:', err);
      alert('Error creating view');
    } finally {
      setIsCreatingView(false);
    }
  };

  // Handle view tab click - navigate to the view
  const handleViewTabClick = (view: ViewData) => {
    navigate(`/${dashboardSlug}/${view.slug}`);
  };

  const [customViews] = useState([
    { id: "default", name: "Default" },
    { id: "cust-view-1", name: "Custom Filter View 1" },
    { id: "cust-view-2", name: "Custom Filter View 2" },
    { id: "cust-view-3", name: "Custom Filter View 3" },
  ]);

  const [downloadOptions] = useState([
    { id: "png", name: "Image (PNG)", icon: "🖼️", description: "Dashboard as single PNG" },
    { id: "jpeg", name: "Image (JPEG)", icon: "📷", description: "Dashboard as single JPEG" },
    { id: "pdf", name: "PDF", icon: "📄", description: "Download combined PDF" },
    { id: "svg", name: "SVG", icon: "🎨", description: "Vector export for charts" },
    { id: "csv", name: "CSV", icon: "📊", description: "Data export as CSV" },
    { id: "xls", name: "Excel", icon: "📗", description: "All cards as sheets" },
    { id: "pptx-editable", name: "PowerPoint (PPTX)", icon: "📑", description: "Editable charts (pptxgen)" },
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
      
      // Save layouts to database (with viewId to scope to current view)
      const currentViewId = getCurrentViewId();
      fetch(`${API_BASE_URL}/api/layouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layouts: defaultLayouts, viewId: currentViewId })
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

  const collectActiveFilters = useRecoilCallback(({ snapshot }) => async (): Promise<Array<{ name: string; value: string }>> => {
    const filters: Array<{ name: string; value: string }> = [];

    const toDisplayLabel = (item: any): string => {
      if (item && typeof item === 'object') {
        if (item.label !== undefined && item.label !== null) return String(item.label);
        if (item.value !== undefined && item.value !== null) return String(item.value);
      }
      return String(item ?? '');
    };

    for (const filterVarName of filterNames) {
      try {
        const cfgLoadable = snapshot.getLoadable(filterConfigFamily(filterVarName));
        if (cfgLoadable.state !== 'hasValue' || !cfgLoadable.contents) {
          continue;
        }

        const config = cfgLoadable.contents;
        const selectedLoadable = snapshot.getLoadable(liveFilterFamily(filterVarName));
        const selectedValues = selectedLoadable.state === 'hasValue' && Array.isArray(selectedLoadable.contents)
          ? selectedLoadable.contents
          : [];
        const availableOptions = Array.isArray(config.availableOptions) ? config.availableOptions : [];

        let displayValue = 'All';
        if (selectedValues.length === 1) {
          displayValue = toDisplayLabel(selectedValues[0]);
        } else if (selectedValues.length > 1) {
          const isAllSelected = availableOptions.length > 0 && selectedValues.length === availableOptions.length;
          if (isAllSelected) {
            displayValue = 'All';
          } else if (selectedValues.length <= 3) {
            displayValue = selectedValues.map(toDisplayLabel).join(', ');
          } else {
            displayValue = `${selectedValues.length} selected`;
          }
        }

        filters.push({
          name: config.displayName || config.paramName || filterVarName,
          value: displayValue || 'All',
        });
      } catch {
        // Skip malformed or transient filter values during export.
      }
    }

    return filters;
  }, [filterNames]);

  const getChartVisibility = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, boolean>> => {
    const visibilityMap: Record<string, boolean> = {};
    
    // 🔥 Get ALL chart IDs from both chartConfigs AND childCardConfigs (for multi-card containers)
    const chartIdsFromConfigs = Object.keys(chartConfigs);
    const chartIdsFromContainers = Object.keys(childCardConfigs);
    const allChartIds = Array.from(new Set([...chartIdsFromConfigs, ...chartIdsFromContainers]));
    
    console.log(`👁️ [Visibility] Checking ${allChartIds.length} charts (${chartIdsFromConfigs.length} from chartConfigs, ${chartIdsFromContainers.length} from childCardConfigs)`);
    
    // 🔥 Get the current visibility variable mappings from the "Is Visible" tab
    const visibilityVariables = snapshot.getLoadable(chartVisibilityVariableState);
    const visibilityVarMap = visibilityVariables.state === 'hasValue' ? visibilityVariables.contents : {};

    for (const chartId of allChartIds) {
      try {
        // 🔥 First check: "Is Visible" tab (chartVisibilityVariableState) - for ALL cards
        const visibilityVarName = visibilityVarMap[chartId];
        let isVisibleFromTab = true; // Default: visible if no rule set
        
        if (visibilityVarName) {
          try {
            const rawValue = await snapshot.getPromise(variableAtomFamily(visibilityVarName));
            let parsedValue: any = rawValue;
            if (typeof rawValue === 'string') {
              try {
                parsedValue = JSON.parse(rawValue);
              } catch {
                // Keep as string
              }
            }
            // If variable is true = SHOW, if false = HIDE
            isVisibleFromTab = parsedValue === true;
            console.log(`👁️ [Visibility] Chart ${chartId}: variable "${visibilityVarName}" = ${parsedValue} → visible: ${isVisibleFromTab}`);
          } catch (e) {
            console.warn(`Could not get visibility variable "${visibilityVarName}" for chart ${chartId}:`, e);
            isVisibleFromTab = true;
          }
        }
        
        // If already hidden by "Is Visible" tab, no need to check further
        if (!isVisibleFromTab) {
          visibilityMap[chartId] = false;
          continue;
        }
        
        // 🔥 Second check: MultiCard Viz Config's parent visibility variable
        const parentConfig = childCardConfigs[chartId];
        if (parentConfig?.visibilityVariable) {
          try {
            const rawValue = await snapshot.getPromise(variableAtomFamily(parentConfig.visibilityVariable));
            let parsedValue: any = rawValue;
            if (typeof rawValue === 'string') {
              try {
                parsedValue = JSON.parse(rawValue);
              } catch {
                // Keep as string
              }
            }
            
            // If parent visibility variable is false, hide the entire container
            if (parsedValue === false) {
              visibilityMap[chartId] = false;
              console.log(`👁️ [Visibility] Chart ${chartId}: MultiCard visibility variable = false → hidden`);
              continue;
            }
          } catch (e) {
            // Variable not available, use tab visibility
          }
        }
        
        visibilityMap[chartId] = isVisibleFromTab;
      } catch (e) {
        console.warn(`Could not get visibility for chart ${chartId}:`, e);
        visibilityMap[chartId] = true;
      }
    }
    return visibilityMap;
  }, [chartConfigs, childCardConfigs]);

  // 🔥 Get current values of all visibility variables
  const getVisibilityVariableValues = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, any>> => {
    const values: Record<string, any> = {};
    
    // Get all unique visibility variable names
    const varNames = new Set<string>();
    Object.values(visibilityVariableMap).forEach(name => {
      if (name) varNames.add(name);
    });
    
    // Also check child card configs for container visibility variables
    Object.values(childCardConfigs).forEach(config => {
      if (config?.visibilityVariable) {
        varNames.add(config.visibilityVariable);
      }
    });
    
    // Get current value of each variable
    for (const varName of Array.from(varNames)) {
      try {
        const rawValue = await snapshot.getPromise(variableAtomFamily(varName));
        let parsedValue: any = rawValue;
        if (typeof rawValue === 'string') {
          try {
            parsedValue = JSON.parse(rawValue);
          } catch {
            // Keep as string
          }
        }
        values[varName] = parsedValue;
      } catch (e) {
        values[varName] = undefined;
      }
    }
    
    return values;
  }, [visibilityVariableMap, childCardConfigs]);

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

  // 🔥 Track visibility variable values to detect changes
  useEffect(() => {
    if (!dataLoaded) return;
    
    getVisibilityVariableValues().then((values) => {
      const valuesStr = JSON.stringify(values);
      const prevValuesStr = JSON.stringify(visibilityVarValues);
      
      if (valuesStr !== prevValuesStr) {
        console.log(`👁️ [Visibility] Variable values changed:`, values);
        setVisibilityVarValues(values);
      }
    });
  }, [dataLoaded, getVisibilityVariableValues, variableUpdateTrigger, visibilityVariableMap]);

  // 🔥 KEY FIX: When visibility changes, restore ALL items to their TRUE original positions
  useEffect(() => {
    if (!dataLoaded) return; // Wait for data to load
    
    console.log(`🔄 [Visibility Effect] Triggered - variableUpdateTrigger: ${variableUpdateTrigger}, visibilityVarMap:`, visibilityVariableMap, 'varValues:', visibilityVarValues);
    
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
  }, [dataLoaded, getChartVisibility, filterNames, variableUpdateTrigger, setLayouts, chartConfigs, visibilityVariableMap, visibilityVarValues]);

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
        const response = await fetch(`${API_BASE_URL}/api/next-chart-id`);
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
  // 🔥 IMPORTANT: Only exports visible charts based on chartVisibility state
  const collectChartRefs = useRecoilCallback(({ snapshot }) => (): ChartRef[] => {
    const refs: ChartRef[] = [];
    
    // 🔥 DEBUG: Log which charts are being exported
    console.log(`[Export] Collecting refs for ${visibleCharts.length} visible charts (total in layout: ${layouts[currentBreakpoint]?.length || 0})`);
    console.log('[Export] Visible chart IDs:', visibleCharts.map(c => c.i));
    console.log('[Export] Current chartVisibility state:', chartVisibility);
    
    // Helper to get table data from a data source
    const getTableData = (dataSource: string) => {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(dataSource));
        if (loadable.state === 'hasValue') {
          let rawData: any = loadable.contents;
          if (typeof rawData === 'string') {
            try { rawData = JSON.parse(rawData); } catch { rawData = undefined; }
          }
          if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'object') {
            return { columns: Object.keys(rawData[0]), rows: rawData };
          }
        }
      } catch (e) { /* ignore */ }
      return undefined;
    };
    
    // Helper to find chart instance in a container
    const findChartInContainer = (container: HTMLElement): Highcharts.Chart | null => {
      const hc = container.querySelector('.highcharts-container') as HTMLElement | null;
      if (hc) {
        const chart = Highcharts.charts.find((ch: any) => ch?.renderTo === hc) as Highcharts.Chart | null;
        if (chart) return chart;
      }
      return Highcharts.charts.find((ch: any) => {
        const renderTo = ch?.renderTo;
        return renderTo && container.contains(renderTo);
      }) as Highcharts.Chart | null;
    };
    
    for (const item of visibleCharts) {
      const configData = chartConfigs[item.i];
      const containerConfig = childCardConfigs[item.i];
      // 🔥 All cards are now containers - check if they have child cards
      const isContainerCard = containerConfig?.childCards?.length > 0;
      const container = document.querySelector(`[data-chart-id="${item.i}"]`) as HTMLElement | null;

      // 🔥 Handle Multi-Card Containers - collect child cards
      if (isContainerCard && containerConfig.childCards) {
        console.log(`[collectChartRefs] Processing multi-card container ${item.i} with ${containerConfig.childCards.length} children`);
        
        for (const childConfig of containerConfig.childCards) {
          // 🔥 CHECK CHILD CARD VISIBILITY - skip hidden child cards
          if (childConfig.visibilityVariable) {
            try {
              const loadable = snapshot.getLoadable(variableAtomFamily(childConfig.visibilityVariable));
              if (loadable.state === 'hasValue') {
                const rawValue = loadable.contents;
                let isVisible = true; // Default to visible
                
                // Parse the visibility value
                if (typeof rawValue === 'boolean') {
                  isVisible = rawValue;
                } else if (typeof rawValue === 'string') {
                  try {
                    const parsed = JSON.parse(rawValue);
                    isVisible = parsed === true;
                  } catch {
                    // Keep as string - might be "true" or "false"
                    isVisible = rawValue.toLowerCase() === 'true';
                  }
                }
                
                // If visibility is false, skip this child card
                if (!isVisible) {
                  console.log(`[Export] Skipping hidden child card: ${childConfig.id} (visibility var: ${childConfig.visibilityVariable} = false)`);
                  continue;
                }
              }
            } catch (e) {
              console.warn(`[Export] Could not check visibility for child ${childConfig.id}:`, e);
              // Default to visible if we can't check
            }
          }
          
          // Find the child card container element
          const childContainer = container?.querySelector(`[data-child-id="${childConfig.id}"]`) as HTMLElement | null;
          
          let childChartInstance: Highcharts.Chart | null = null;
          let childTitle = childConfig.title || `Card_${childConfig.id}`;
          let childTableData: { columns: string[]; rows: Array<Record<string, any>> } | undefined;
          // 🔥 FIX: Get rendered HTML content from the container element (has resolved values)
          let childHtmlContent: string | undefined;
          
          if (childConfig.type === 'chart' && childContainer) {
            childChartInstance = findChartInContainer(childContainer);
            // Get title from chart instance
            if (childChartInstance) {
              const liveTitle = (childChartInstance.options as any)?.title?.text;
              if (liveTitle) {
                childTitle = typeof liveTitle === 'string' ? liveTitle : String(liveTitle);
              }
            }
          } else if (childConfig.type === 'table' && childConfig.tableDataSource) {
            childTableData = getTableData(childConfig.tableDataSource);
            childTitle = childConfig.title || `Table_${childConfig.tableDataSource}`;
          } else if (childConfig.type === 'html' && childContainer) {
            // 🔥 FIX: Extract the rendered text content from the DOM (already has resolved variable values)
            childHtmlContent = childContainer.innerHTML;
          }
          
          console.log(`[Export] Including visible child card: ${childConfig.id}`);
          refs.push({
            chart: childChartInstance,
            chartId: childConfig.id,
            title: childTitle,
            type: childConfig.type,
            htmlContent: childHtmlContent,
            containerElement: childContainer || container || undefined,
            tableData: childTableData,
            tableTheme: childConfig.tableSettings?.theme,
          });
        }
        continue; // Skip adding the parent container itself
      }

      // Regular (non-container) cards
      const contentType = (configData?.type as any) || 'chart';

      let chartInstance: Highcharts.Chart | null = null;
      if (contentType === 'chart' && container) {
        chartInstance = findChartInContainer(container);
      }

      // Extract title based on content type
      let title = `Chart_${item.i}`;
      // 🔥 FIX: Get processed HTML with resolved variable values
      let resolvedHtmlContent: string | undefined;
      
      if (contentType === 'chart') {
        const processedTitle = processedChartConfigs[item.i]?.title?.text;
        if (processedTitle) {
          title = typeof processedTitle === 'string' ? processedTitle : String(processedTitle);
        } else if (chartInstance) {
          const liveTitle = (chartInstance.options as any)?.title?.text;
          if (liveTitle) {
            title = typeof liveTitle === 'string' ? liveTitle : String(liveTitle);
          }
        }
      } else if (contentType === 'html') {
        // 🔥 FIX: Use processedChartConfigs which has resolved variable values
        const processedHtml = processedChartConfigs[item.i]?.html;
        if (processedHtml) {
          resolvedHtmlContent = processedHtml;
          const temp = document.createElement('div');
          temp.innerHTML = processedHtml;
          const h = temp.querySelector('h1,h2,h3');
          if (h?.textContent) title = h.textContent;
        } else if (container) {
          // Fallback: get rendered HTML from DOM
          resolvedHtmlContent = container.innerHTML;
        }
      } else if (contentType === 'table' && configData?.tableDataSource) {
        title = `Table_${configData.tableDataSource}`;
      }

      // Get table data for table type cards
      let tableData: { columns: string[]; rows: Array<Record<string, any>> } | undefined;
      if (contentType === 'table' && configData?.tableDataSource) {
        tableData = getTableData(configData.tableDataSource);
      }

      refs.push({
        chart: chartInstance,
        chartId: item.i,
        title: title,
        type: contentType,
        htmlContent: resolvedHtmlContent,
        containerElement: container || undefined,
        tableData,
        tableTheme: configData?.tableSettings?.theme,
      });
    }
    
    console.log(`[Export] Total refs collected: ${refs.length}`);
    return refs;
  }, [visibleCharts, chartConfigs, processedChartConfigs, childCardConfigs, chartVisibility, layouts, currentBreakpoint]);

  const handleDownload = useCallback(async (format: string) => {
    if (isDownloading || visibleCharts.length === 0) return;
    setIsDownloading(true);
    
    // Build proper file name: "Dashboard Name - View Name"
    const exportFileName = `${currentDashboardName} - ${currentViewName}`;
    
    // Small delay to let the loading overlay render before heavy processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      const refs = collectChartRefs();
      let exportFilters: Array<{ name: string; value: string }> = [];
      const normalizedFormat = format.toLowerCase();
      const formatsWithFilterSummary = new Set(['png', 'jpeg', 'pdf', 'csv', 'xls', 'pptx-editable']);
      if (formatsWithFilterSummary.has(normalizedFormat)) {
        exportFilters = await collectActiveFilters();
      }

      // For image exports, wait for all charts to be fully rendered
      if (normalizedFormat === 'png' || normalizedFormat === 'jpeg') {
        // Quick wait for Highcharts to finish rendering
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Force reflow on all charts
        Highcharts.charts.forEach(chart => {
          if (chart) {
            try {
              chart.reflow();
            } catch (e) {
              // Ignore reflow errors
            }
          }
        });
        
        // Brief wait after reflow
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const exportMeta = {
        dashboardName: currentDashboardName,
        viewName: currentViewName,
        filters: exportFilters,
      };
      
      switch (normalizedFormat) {
        case 'png':
          // Export entire dashboard as single PNG image
          if (dashboardGridRef.current) {
            await exportDashboardAsImage(dashboardGridRef.current, 'png', exportFileName, {
              ...exportMeta,
            });
          }
          break;
        case 'jpeg':
          // Export entire dashboard as single JPEG image
          if (dashboardGridRef.current) {
            await exportDashboardAsImage(dashboardGridRef.current, 'jpeg', exportFileName, {
              ...exportMeta,
            });
          }
          break;
        case 'pdf':
          await exportAllAsPDF(refs, exportFileName, exportMeta);
          break;
        case 'svg':
          await exportAllAsSVG(refs, exportFileName);
          break;
        case 'csv':
          await exportAllAsCSV(refs, exportFileName, exportMeta);
          break;
        case 'xls':
          await exportAllAsExcel(refs, exportFileName, exportMeta);
          break;
        case 'pptx-editable':
          await exportDashboardPPTXEditable(refs, exportFileName, exportMeta);
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
  }, [collectChartRefs, collectActiveFilters, isDownloading, visibleCharts.length, currentDashboardName, currentViewName]);

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
      const response = await fetch(`${API_BASE_URL}/api/next-chart-id`);
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
    // Delete chart from database first
    try {
      const response = await fetch(`${API_BASE_URL}/api/charts/${id}`, {
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

    // Also delete child card configs from database
    try {
      await fetch(`${API_BASE_URL}/api/child-card-configs/${id}`, {
        method: 'DELETE',
      });
      console.log(`✅ Child card config for ${id} deleted from database`);
    } catch (err) {
      console.warn('Warning: Failed to delete child card config from database:', err);
      // Don't return here, continue with frontend cleanup
    }

    // 🔥 Delete tooltip configs for all child cards of this parent
    const parentConfig = childCardConfigs[id];
    if (parentConfig?.childCards) {
      for (const childCard of parentConfig.childCards) {
        const childCardKey = `${id}_${childCard.id}`;
        try {
          await fetch(`${API_BASE_URL}/api/child-card-tooltip-configs/${encodeURIComponent(childCardKey)}`, {
            method: 'DELETE',
          });
          console.log(`✅ Tooltip config for ${childCardKey} deleted from database`);
        } catch (err) {
          console.warn(`Warning: Failed to delete tooltip config for ${childCardKey}:`, err);
        }
      }
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

    // Also clean up child card configs
    setChildCardConfigs(prev => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });

    // 🔥 Clean up tooltip configs for all child cards of this parent
    setTooltipConfigsForChildCards(prev => {
      const updated = { ...prev };
      // Remove all keys that start with "{parentId}_"
      Object.keys(updated).forEach(key => {
        if (key.startsWith(`${id}_`)) {
          delete updated[key];
        }
      });
      return updated;
    });

    setTimeout(() => {
      isInternalUpdateRef.current = false;
    }, 100);
  }, [setLayouts, setChartConfigs, setChildCardConfigs, setTooltipConfigsForChildCards, childCardConfigs]);

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
      // Navigate using dashboard and view slugs
      if (dashboardSlug && viewSlug) {
        navigate(`/${dashboardSlug}/${viewSlug}/addChart/${itemId}`);
      } else {
        navigate(`/addChart/${itemId}`);
      }
    }, 10);
  }, [navigate, dashboardSlug, viewSlug]);

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

  const toggleCardFilterPanel = useCallback((itemId: string) => {
    setOpenCardFilterId((prev) => (prev === itemId ? null : itemId));
  }, []);

  const closeCardFilterPanel = useCallback(() => {
    setOpenCardFilterId(null);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new CustomEvent('react-grid-layout-resize'));
    }, 150);
    return () => clearTimeout(timer);
  }, [isEditMode, chartVisibility]);

  // Align filter panel to the navbar height; allow extra space in edit mode for edit toolbar
  const filterPanelTopOffset: string = isEditMode ? '158px' : '80px';

  // Bookmarked and regular dashboards for hover menu (must be before early returns)
  const bookmarkedDashboards = useMemo(() => {
    return allDashboards.filter(d => bookmarkedDashboardIds.has(d.id));
  }, [allDashboards, bookmarkedDashboardIds]);

  const otherDashboards = useMemo(() => {
    return allDashboards.filter(d => !bookmarkedDashboardIds.has(d.id));
  }, [allDashboards, bookmarkedDashboardIds]);

  const renderChartContent = (item: Layout) => {
    const chartConfig = getChartConfig(item.i);
    const configData = chartConfigs[item.i];
    const contentType = configData?.type || 'chart';
    const isFilterOpen = openCardFilterId === item.i;
    
    // Check if this card is a multi-card container (all cards are containers now)
    const containerConfig = childCardConfigs[item.i];
    const isContainerCard = containerConfig?.childCards?.length > 0;

    // Only show filter button for chart type cards and container cards
    const showFilterButton = contentType === 'chart' || isContainerCard;

    // Check if this container has scroll enabled (scrollbar takes up ~15px)
    const hasScroll = isContainerCard && containerConfig?.enableContainerScroll;
    
    return (
      <>
        <div 
          className={`absolute ${hasScroll ? 'top-7' : 'top-5'} flex flex-row flex-nowrap items-center gap-1.5`} 
          style={{ 
            // In edit mode: standard position
            // In view mode: offset for Highcharts export button, plus extra for scrollbar if present
            right: isEditMode ? '0.75rem' : hasScroll ? 'calc(5rem + 15px)' : '4rem',
            zIndex: 50, 
            pointerEvents: 'none' 
          }}
        >
          {/* Per-card onClick Reset button — shown beside filter button when this card triggered a click drill-down */}
          {clickSnapshot.active && clickSnapshot.sourceParentCardId === item.i && 
           clickSnapshot.sourceChartId && onClickConfigs[clickSnapshot.sourceChartId]?.showResetButton && (
            <button
              type="button"
              className="non-draggable-filter-btn group relative p-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border backdrop-blur-sm whitespace-nowrap bg-red-100 text-red-700 border-red-300 hover:bg-red-200 hover:text-red-800 hover:border-red-400"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleOnClickReset();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title="Reset click filter — restore original values"
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            >
              <span className="flex items-center gap-1">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                </svg>
                Reset
              </span>
            </button>
          )}
          {showFilterButton && (
            <button
              type="button"
              className={`non-draggable-filter-btn group relative p-2 rounded-lg text-xs font-semibold transition-all duration-200 border backdrop-blur-sm whitespace-nowrap ${
                isFilterOpen
                  ? "bg-amber-200 text-amber-900 border-amber-300"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 hover:text-amber-900 hover:border-amber-300"
              }`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleCardFilterPanel(item.i);
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              title={isFilterOpen ? "Hide filters" : "Show filters"}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 7V4z" />
              </svg>
            </button>
          )}
          {isEditMode && (
            <>
              <button
                type="button"
                className="non-draggable-edit-btn group relative bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200 hover:border-blue-400"
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
                className="non-draggable-close-btn group relative bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 p-2 rounded-lg transition-all duration-200 shadow-sm hover:shadow-md border border-red-200 hover:border-red-400"
                onClick={(e) => handleRemoveClick(e, item.i)}
                onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                title="Remove"
                style={{ pointerEvents: 'auto', cursor: 'pointer', position: 'relative', zIndex: 10000 }}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>

        {isEditMode && configData && (
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

        <div className="flex-1 p-4" style={{ minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 0, overflow: 'hidden', height: '100%' }}>
          {showFilterButton && isFilterOpen && (
            <div className="mb-3" style={{ position: 'relative', zIndex: 5 }}>
              <CardFilterPanel cardId={item.i} onClose={closeCardFilterPanel} />
            </div>
          )}
          {/* Render Multi-Card Container if configured */}
          {isContainerCard ? (
            <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                <ParentCardContainer
                  parentCardId={item.i}
                  config={containerConfig}
                  showExport={isEditMode ? false : true}
                  onPointClick={isOnClickEnabled(item.i) ? (pointData: any) => handleChartClick(item.i, pointData) : undefined}
                  onChartBackgroundClick={isOnClickEnabled(item.i) && clickSnapshot.active ? handleOnClickReset : undefined}
                />
              </div>
            </div>
          ) : contentType === 'table' && configData?.tableDataSource ? (
            /* Render Table when contentType is 'table' */
            <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                <DashboardTable 
                  dataSource={configData.tableDataSource} 
                  settings={configData.tableSettings}
                />
              </div>
            </div>
          ) : chartConfig ? (
            // Use ChartWithTooltip if tooltip or onClick is enabled, otherwise use ResizableChart
            (tooltipConfigs[item.i]?.enabled || isOnClickEnabled(item.i)) ? (
              <ChartWithTooltip
                key={item.i}
                chartId={item.i}
                options={chartConfig}
                showExport={isEditMode ? false : true}
                onPointClick={isOnClickEnabled(item.i) ? (pointData: any) => handleChartClick(item.i, pointData) : undefined}
                onChartBackgroundClick={isOnClickEnabled(item.i) && clickSnapshot.active ? handleOnClickReset : undefined}
              />
            ) : (
              <ResizableChart key={item.i} options={chartConfig} showExport={isEditMode ? false : true} />
            )
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

  // 🔥 CRITICAL: Show 404 page if dashboard or view doesn't exist
  // This prevents data corruption from invalid routes
  if (!contextLoading && errorType) {
    if (errorType === 'dashboard_not_found') {
      return <NotFound type="dashboard" />;
    }
    if (errorType === 'view_not_found') {
      return <NotFound type="view" />;
    }
  }

  // Library Menu Item Component with Views Submenu
  const LibraryMenuItemWithViews = ({ dashboard }: { dashboard: { id: string; name: string; slug: string } }) => {
    const [menuViews, setMenuViews] = useState<Array<{ id: string; name: string; slug: string }>>([]);
    const [loadingMenuViews, setLoadingMenuViews] = useState(false);
    const [menuViewsLoaded, setMenuViewsLoaded] = useState(false);

    const handleMouseEnter = async () => {
      if (menuViewsLoaded) return;
      setLoadingMenuViews(true);
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboards/${dashboard.slug}/views`);
        const data = await response.json();
        if (data.success && data.views) {
          setMenuViews(data.views.map((v: any) => ({ id: v.id.toString(), name: v.name, slug: v.slug })));
        }
        setMenuViewsLoaded(true);
      } catch (err) {
        console.error('Error fetching views:', err);
      } finally {
        setLoadingMenuViews(false);
      }
    };

    const handleMenuViewClick = (e: React.MouseEvent, viewSlug: string) => {
      e.stopPropagation();
      navigate(`/${dashboard.slug}/${viewSlug}`);
    };

    return (
      <Box
        onMouseEnter={handleMouseEnter}
        sx={{ 
          position: 'relative',
          '&:hover .views-submenu': {
            display: 'block',
          },
        }}
      >
        <Box
          onClick={() => navigate(`/${dashboard.slug}`)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            px: 2,
            py: 1,
            cursor: 'pointer',
            '&:hover': { bgcolor: alpha('#3B82F6', 0.08) },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <ChevronRightIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
            <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>
              {dashboard.name}
            </Typography>
          </Box>
          <ChevronRightIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
        </Box>
        
        {/* Views Submenu */}
        <Paper
          className="views-submenu"
          elevation={8}
          sx={{
            display: 'none',
            position: 'absolute',
            left: '100%',
            top: 0,
            ml: 0.5,
            minWidth: 200,
            maxHeight: 300,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            overflowY: 'auto',
            zIndex: 1400,
            bgcolor: 'white',
          }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
            <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 600 }}>
              Views in {dashboard.name}
            </Typography>
          </Box>
          
          {loadingMenuViews ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} sx={{ color: '#3B82F6' }} />
            </Box>
          ) : menuViews.length > 0 ? (
            menuViews.map((view) => (
              <Box
                key={view.id}
                onClick={(e) => handleMenuViewClick(e, view.slug)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: alpha('#3B82F6', 0.08) },
                }}
              >
                <LayersIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>
                  {view.name}
                </Typography>
              </Box>
            ))
          ) : (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                No views available
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
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
          background: '#F8FAFC',
        }}
      >
        <CircularProgress size={60} sx={{ mb: 2, color: '#3B82F6' }} />
        <Typography variant="h6" sx={{ color: '#6B7280' }}>
          Loading dashboard data...
        </Typography>
        <Typography variant="body2" sx={{ color: '#9CA3AF', mt: 1 }}>
          Please wait while we load charts, filters, and calculations
        </Typography>
      </Box>
    );
  }

  return (
    <>
    <Box 
      sx={{ 
        display: 'flex', 
        height: '100vh',
        background: '#F8FAFC',
        overflow: 'hidden',
      }}
    >
      <FilterPanel showFilters={true} topOffset="0px" />

      {/* Left Icon Sidebar - 72px wide */}
      <Box
        sx={{
          width: 72,
          minWidth: 72,
          bgcolor: '#FFFFFF',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          gap: 1,
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* RBI Logo */}
        <Box
          component="img"
          src="/RBI.png"
          alt="RBI"
          sx={{
            width: 50,
            height: 50,
            objectFit: 'contain',
            mb: 2,
            mt: 0.5,
          }}
        />

        {/* Home */}
        <Tooltip title="Home" placement="right">
          <Box
            onClick={() => navigate('/')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#6B7280',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <HomeIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Home</Typography>
          </Box>
        </Tooltip>

        {/* Libraries with Hover Menu */}
        <Box
          sx={{
            position: 'relative',
            '&:hover .library-hover-menu': {
              display: 'block',
            },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#3B82F6',
              bgcolor: alpha('#3B82F6', 0.1),
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <LibraryBooksIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Libraries</Typography>
          </Box>
          
          {/* Hover Menu */}
          <Paper
            className="library-hover-menu"
            elevation={8}
            sx={{
              display: 'none',
              position: 'absolute',
              left: '100%',
              top: 0,
              ml: 0.5,
              minWidth: 240,
              maxHeight: 450,
              borderRadius: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              overflow: 'visible',
              zIndex: 1300,
              bgcolor: 'white',
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
              <Typography variant="subtitle2" fontWeight={700} color="#1F2937">
                Your libraries
              </Typography>
            </Box>
            
            {/* Favourites Section */}
            {bookmarkedDashboards.length > 0 && (
              <>
                <Box sx={{ px: 2, py: 1 }}>
                  <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: '0.7rem' }}>
                    Favourites
                  </Typography>
                </Box>
                {bookmarkedDashboards.slice(0, 4).map((dashboard) => (
                  <LibraryMenuItemWithViews key={dashboard.id} dashboard={dashboard} />
                ))}
              </>
            )}
            
            {/* Other Libraries Section */}
            <Box sx={{ px: 2, py: 1, mt: 1 }}>
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontWeight: 600, fontSize: '0.7rem' }}>
                Other Libraries
              </Typography>
            </Box>
            {otherDashboards.slice(0, 8).map((dashboard) => (
              <LibraryMenuItemWithViews key={dashboard.id} dashboard={dashboard} />
            ))}
          </Paper>
        </Box>

        {/* Data */}
        <Tooltip title="Data & Connections" placement="right">
          <Box
            onClick={() => navigate('/?nav=data')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#6B7280',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <StorageIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Data</Typography>
          </Box>
        </Tooltip>

        {/* Functions */}
        <Tooltip title="Predefined Functions" placement="right">
          <Box
            onClick={() => navigate('/?nav=functions')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#6B7280',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <FunctionsIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Functions</Typography>
          </Box>
        </Tooltip>

        <Box sx={{ flex: 1 }} />

        {/* Docs */}
        <Tooltip title="Docs" placement="right">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#6B7280',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <DocsIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Docs</Typography>
          </Box>
        </Tooltip>

        {/* Help */}
        <Tooltip title="Help" placement="right">
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: '#6B7280',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <HelpIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Help</Typography>
          </Box>
        </Tooltip>

        {/* User Avatar */}
        <Box
          onClick={(e) => setUserMenuAnchor(e.currentTarget)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
            borderRadius: 2,
            mt: 1,
            '&:hover': { bgcolor: alpha('#3B82F6', 0.1) },
            transition: 'all 0.2s',
          }}
        >
          <Avatar
            sx={{ 
              width: 28,
              height: 28,
              bgcolor: '#3B82F6',
              fontSize: '0.75rem',
              fontWeight: 600,
            }}
          >
            {auth.email ? auth.email[0].toUpperCase() : 'U'}
          </Avatar>
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25, color: '#6B7280' }}>Account</Typography>
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 220,
            borderRadius: 2,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
            border: '1px solid #E5E7EB',
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'bottom' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <EmailIcon sx={{ fontSize: 16, color: '#3B82F6' }} />
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {auth.email || 'User'}
            </Typography>
          </Box>
        </Box>
        <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: '#ef4444' }}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" sx={{ color: '#ef4444' }} />
          </ListItemIcon>
          <ListItemText primary="Logout" />
        </MenuItem>
      </Menu>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, ml: '72px', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#E5E7EB', minHeight: 0 }}>
        {/* Top Header Bar - White rounded card */}
        <Box 
          sx={{ 
            p: 2, 
            pb: 0,
            pr: 4,
            mr: isFilterPanelExpanded ? '306px' : '34px',
            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FFFFFF',
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 3,
              py: 1.5,
              border: '1px solid #E5E7EB',
            }}
          >
            {/* Left side - Back button + Dashboard/View name */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Tooltip title={`Back to ${currentDashboardName} views`}>
                <IconButton
                  onClick={() => navigate(`/${dashboardSlug}`)}
                  size="small"
                  sx={{
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
                    borderRadius: 1,
                    '&:hover': { bgcolor: '#E5E7EB', color: '#3B82F6' },
                  }}
                >
                  <ChevronRightIcon sx={{ transform: 'rotate(180deg)' }} /> Back
                </IconButton>
              </Tooltip>
              <Box sx={{ width: 4, height: 32, bgcolor: '#3B82F6', borderRadius: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F2937' }}>
                {currentDashboardName}
              </Typography>
            </Box>

            {/* Right side - Action buttons with text */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              {/* Compact Type Toggle - only in edit mode */}
              {isEditMode && (
                <Button
                  onClick={toggleCompactType}
                  startIcon={<ViewCompactIcon />}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: '#6B7280',
                    borderColor: '#E5E7EB',
                    textTransform: 'none',
                    fontWeight: 600,
                    '&:hover': { borderColor: '#3B82F6', color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) },
                  }}
                >
                  {compactType === null ? "Free" : compactType === "vertical" ? "Vertical" : "Horizontal"}
                </Button>
              )}

              {/* Download Button */}
              <Button
                onClick={(e) => setDownloadMenuAnchor(e.currentTarget)}
                disabled={isDownloading || visibleCharts.length === 0}
                startIcon={isDownloading ? <CircularProgress size={16} sx={{ color: '#6B7280' }} /> : <DownloadIcon />}
                variant="outlined"
                size="small"
                sx={{
                  color: '#6B7280',
                  borderColor: '#E5E7EB',
                  textTransform: 'none',
                  fontWeight: 600,
                  '&:hover': { borderColor: '#3B82F6', color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) },
                  '&.Mui-disabled': { opacity: 0.5 },
                }}
              >
                Download
              </Button>

              {/* Edit/Save Button */}
              <Button
                onClick={toggleEditMode}
                startIcon={isEditMode ? <SaveIcon /> : <EditIcon />}
                variant="contained"
                size="small"
                sx={{
                  bgcolor: isEditMode ? '#10b981' : '#3B82F6',
                  color: 'white',
                  textTransform: 'none',
                  fontWeight: 600,
                  boxShadow: 'none',
                  '&:hover': { 
                    bgcolor: isEditMode ? '#059669' : '#2563EB',
                    boxShadow: 'none',
                  },
                }}
              >
                {isEditMode ? 'Save' : 'Edit'}
              </Button>
            </Box>
          </Paper>
        </Box>

        {/* Edit Mode Toolbar + Views Tabs - Rounded card */}
        <Box 
          sx={{ 
            pl: 2,
            pr: 4,
            pt: 2, 
            pb: 2, 
            display: 'flex', 
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
            mr: isFilterPanelExpanded ? '306px' : '34px',
            transition: 'margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FFFFFF',
              borderRadius: 3,
              border: '1px solid #E5E7EB',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Fixed Header Section - Edit Mode Toolbar + Views Tabs */}
            <Box sx={{ flexShrink: 0 }}>
              {/* Edit Mode Toolbar */}
              {isEditMode && (
                <Box
                  sx={{
                    bgcolor: '#F8FAFC',
                    borderBottom: '1px solid #E5E7EB',
                    px: 3,
                    py: 1.5,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      className="droppable-element"
                      draggable={true}
                      unselectable="on"
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", "");
                        e.dataTransfer.effectAllowed = "move";
                        setTimeout(() => { e.dataTransfer.dropEffect = "move"; }, 0);
                      }}
                      onDragEnd={(e) => { e.preventDefault(); }}
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 1,
                        bgcolor: 'white',
                        border: '2px dashed #3B82F6',
                        borderRadius: 2,
                        px: 2,
                        py: 1,
                        cursor: 'grab',
                        '&:active': { cursor: 'grabbing' },
                        '&:hover': { 
                          bgcolor: '#3B82F6',
                          borderStyle: 'solid',
                          '& .drag-icon': { color: 'white' },
                          '& .drag-text': { color: 'white' },
                        },
                        transition: 'all 0.2s',
                      }}
                    >
                      <AddIcon className="drag-icon" sx={{ fontSize: 18, color: '#3B82F6', transition: 'color 0.2s' }} />
                      <Typography className="drag-text" sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#3B82F6', transition: 'color 0.2s' }}>
                        Drag to Add Content
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#EFF6FF', px: 2, py: 0.75, borderRadius: 1.5, border: '1px solid #BFDBFE' }}>
                      <Typography sx={{ fontSize: '0.75rem', color: '#3B82F6', fontWeight: 500 }}>
                        Drag and drop to position charts, tables, or HTML cards
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Views Tabs Bar */}
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid #E5E7EB',
                  bgcolor: '#FFFFFF',
                }}
              >
                {dynamicViews.map((view) => (
                  <Box
                    key={view.id}
                    onClick={() => handleViewTabClick(view)}
                    sx={{
                      px: 2,
                      py: 1,
                      mr: 1,
                      cursor: 'pointer',
                      borderRadius: 2,
                      bgcolor: viewSlug === view.slug ? alpha('#3B82F6', 0.1) : 'transparent',
                      color: viewSlug === view.slug ? '#3B82F6' : '#6B7280',
                      fontWeight: viewSlug === view.slug ? 600 : 500,
                      fontSize: '0.875rem',
                      borderBottom: viewSlug === view.slug ? '3px solid #3B82F6' : '3px solid transparent',
                      transition: 'all 0.2s',
                      '&:hover': {
                        color: '#3B82F6',
                        bgcolor: alpha('#3B82F6', 0.05),
                      },
                    }}
                  >
                    {view.name}
                  </Box>
                ))}
                
                {/* Add View Button */}
                <Tooltip title="Add View">
                  <IconButton
                    onClick={() => setOpenCreateViewDialog(true)}
                    size="small"
                    sx={{
                      ml: 0.5,
                      color: '#9CA3AF',
                      '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.1) },
                    }}
                  >
                    <AddIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Scrollable Main Content - Inside the rounded card */}
            <Box
              ref={dashboardGridRef}
              sx={{
                p: 2,
                flex: 1,
                overflow: 'auto',
                backgroundImage: isEditMode ? `radial-gradient(circle, #CBD5E1 1.5px, transparent 1.5px)` : 'none',
                backgroundSize: isEditMode ? '24px 24px' : 'auto',
                backgroundPosition: isEditMode ? '0 0' : 'initial',
                minHeight: 0,
                // Hide scrollbar but allow scrolling
                '&::-webkit-scrollbar': {
                  display: 'none',
                },
                msOverflowStyle: 'none',  // IE and Edge
                scrollbarWidth: 'none',  // Firefox
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
          draggableCancel=".non-draggable-close-btn, .non-draggable-edit-btn, .non-draggable-visibility-btn, .non-draggable-configure-btn, .non-draggable-filter-btn, .drag-handle, .drag-handle-inline, .local-filter-card, .card-filter-panel, .compact-filter-item, .MuiMenu-root, .MuiMenu-paper, .MuiSelect-root, .MuiButton-root, .MuiIconButton-root, .MuiCheckbox-root, .MuiRadio-root"
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
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* onClick Reset button is now per-card, rendered beside the filter button in renderChartContent */}

      {/* Download Menu */}
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
            border: '1px solid #E5E7EB',
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
              '&:hover': { bgcolor: alpha('#3B82F6', 0.08) },
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
    </Box>
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

      {/* Create View Dialog */}
      <Dialog
        open={openCreateViewDialog}
        onClose={() => { setOpenCreateViewDialog(false); setNewViewName(''); setNewViewDesc(''); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.15)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2.5,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              }}
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Create New View
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Add a new view to {currentDashboardName}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            label="View Name"
            fullWidth
            required
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g., Patient View, Sales Overview"
            InputLabelProps={{ shrink: true }}
            sx={{
              mt: 1,
              mb: 3,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '& fieldset': { borderColor: alpha('#667eea', 0.2) },
                '&:hover fieldset': { borderColor: alpha('#667eea', 0.4) },
                '&.Mui-focused fieldset': { borderColor: '#667eea' },
              },
              '& .MuiInputLabel-root.Mui-focused': { color: '#667eea' },
            }}
          />
          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            value={newViewDesc}
            onChange={(e) => setNewViewDesc(e.target.value)}
            placeholder="Describe what this view will display..."
            InputLabelProps={{ shrink: true }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '& fieldset': { borderColor: alpha('#667eea', 0.2) },
                '&:hover fieldset': { borderColor: alpha('#667eea', 0.4) },
                '&.Mui-focused fieldset': { borderColor: '#667eea' },
              },
              '& .MuiInputLabel-root.Mui-focused': { color: '#667eea' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => { setOpenCreateViewDialog(false); setNewViewName(''); setNewViewDesc(''); }}
            disabled={isCreatingView}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateView}
            disabled={!newViewName.trim() || isCreatingView}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              '&:disabled': { background: alpha('#667eea', 0.3) },
            }}
          >
            {isCreatingView ? 'Creating...' : 'Create View'}
          </Button>
        </DialogActions>
      </Dialog>
  </>
  );
}