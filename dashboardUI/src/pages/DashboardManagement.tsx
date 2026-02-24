import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { dashboardsManager, Dashboard } from '../recoil/Dashboards';
import { authState, authAPI } from '../recoil/AuthState';
import { predefinedFunctionsState } from '../recoil/PredefinedFunctionsState';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  InputAdornment,
  alpha,
  Zoom,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  Collapse,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  Switch,
  Stack,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FolderOpen as FolderOpenIcon,
  ChevronRight as ChevronRightIcon,
  BarChart as BarChartIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Layers as LayersIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  ViewModule as ViewModuleIcon,
  MoreVert as MoreVertIcon,
  AccessTime as AccessTimeIcon,
  CalendarToday as CalendarTodayIcon,
  Analytics as AnalyticsIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  History as HistoryIcon,
  Help as HelpIcon,
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
  AcUnit as SnowflakeIcon,
  Logout as LogoutIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Description as DocsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Sort as SortIcon,
  Apps as AppsIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import AddDataSource from '../components/AddDataSource';
import SnowflakeConnector from '../components/SnowflakeConnector';
import PredefinedFunctions from '../components/PredefinedFunctions';
import { Functions as FunctionsIcon } from '@mui/icons-material';
import { API_BASE_URL } from '../config/api.config';

// API base URL
const API_BASE = `${API_BASE_URL}/api`;

// Library types for tabs
const LIBRARY_TYPES = ['All', 'Core libraries', 'Claims libraries', 'Reference libraries', 'Premium libraries'];

// Generate abbreviation from name
const getAbbreviation = (name: string): string => {
  const words = name.split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
};

// Up to 5 chars, no spaces
const getShortCode = (name: string): string => {
  return name.replace(/\s+/g, '').substring(0, 5).toUpperCase() || 'LIB';
};

// Color palette for cards
const CARD_COLORS = [
  '#F59E0B', // Yellow/Amber
  '#10B981', // Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#EC4899', // Pink
];

const getCardColor = (id: string): string => {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CARD_COLORS[hash % CARD_COLORS.length];
};

const DashboardManagement: React.FC = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useRecoilState(dashboardsManager);
  const [auth, setAuth] = useRecoilState(authState);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [newDashboardName, setNewDashboardName] = useState<string>('');
  const [newDashboardDesc, setNewDashboardDesc] = useState<string>('');
  const [newLibraryType, setNewLibraryType] = useState<string>('Core libraries');
  const [newDataSource, setNewDataSource] = useState<string>('');
  const [newTimePeriodStart, setNewTimePeriodStart] = useState<string>('');
  const [newTimePeriodEnd, setNewTimePeriodEnd] = useState<string>('');
  const [newIconType, setNewIconType] = useState<'text' | 'upload'>('text');
  const [newIconText, setNewIconText] = useState<string>('');
  const [newIconColor, setNewIconColor] = useState<string>('#3B82F6');
  const [newIconImageUrl, setNewIconImageUrl] = useState<string>('');
  const [newAdminPortalId, setNewAdminPortalId] = useState<string>('');
  const [newEmbedType, setNewEmbedType] = useState<'' | 'iframe' | 'tableau'>('');
  const [newEmbedLink, setNewEmbedLink] = useState<string>('');
  const [newTriggerCalculation, setNewTriggerCalculation] = useState<string>('');
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editDataSource, setEditDataSource] = useState<string>('');
  const [editTimePeriodStart, setEditTimePeriodStart] = useState<string>('');
  const [editTimePeriodEnd, setEditTimePeriodEnd] = useState<string>('');
  const [editLibraryType, setEditLibraryType] = useState<string>('Core libraries');
  const [editIconType, setEditIconType] = useState<'text' | 'upload'>('text');
  const [editIconText, setEditIconText] = useState<string>('');
  const [editIconColor, setEditIconColor] = useState<string>('#3B82F6');
  const [editIconImageUrl, setEditIconImageUrl] = useState<string>('');
  const [editAdminPortalId, setEditAdminPortalId] = useState<string>('');
  const [editEmbedType, setEditEmbedType] = useState<'' | 'iframe' | 'tableau'>('');
  const [editEmbedLink, setEditEmbedLink] = useState<string>('');
  const [editTriggerCalculation, setEditTriggerCalculation] = useState<string>('');
  const [calculations, setCalculations] = useState<Array<{ id: string; variable_name: string }>>([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    dashboards: Dashboard[];
    views: Array<{ id: string; name: string; slug: string; description?: string; embedType?: string; embedLink?: string; dashboardId: string; dashboardName: string; dashboardSlug: string; dashboardIconText: string; dashboardIconColor: string }>;
  }>({ dashboards: [], views: [] });
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [sortBy, setSortBy] = useState<string>('name');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuDashboard, setMenuDashboard] = useState<Dashboard | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeNav, setActiveNav] = useState<'libraries' | 'home' | 'projects' | 'charts' | 'docs' | 'dataConnections' | 'functions'>('libraries');
  const [activeLibraryTab, setActiveLibraryTab] = useState<number>(0);
  const [dataTabIndex, setDataTabIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  // Handle nav query parameter from URL
  useEffect(() => {
    const navParam = searchParams.get('nav');
    if (navParam === 'data') {
      setActiveNav('dataConnections');
    } else if (navParam === 'functions') {
      setActiveNav('functions');
    } else if (navParam === 'libraries') {
      setActiveNav('libraries');
    } else if (navParam === 'home') {
      setActiveNav('home');
    }
  }, [searchParams]);

  // Helper to update both activeNav state and URL query param
  const handleNavClick = (nav: typeof activeNav) => {
    setActiveNav(nav);
    const navParamMap: Record<typeof activeNav, string> = {
      libraries: 'libraries',
      home: 'home',
      projects: 'projects',
      charts: 'charts',
      docs: 'docs',
      dataConnections: 'data',
      functions: 'functions',
    };
    setSearchParams({ nav: navParamMap[nav] }, { replace: true });
  };
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(null);
  const [libraryMenuAnchor, setLibraryMenuAnchor] = useState<null | HTMLElement>(null);
  const libraryMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [bookmarksExpanded, setBookmarksExpanded] = useState(true);
  const [librariesExpanded, setLibrariesExpanded] = useState(true);
  const [unsubscribedExpanded, setUnsubscribedExpanded] = useState(false);
  // Home page expandable sections
  const [recentLibrariesExpanded, setRecentLibrariesExpanded] = useState(true);
  const [recentProjectsExpanded, setRecentProjectsExpanded] = useState(true);
  const [otherRecentsExpanded, setOtherRecentsExpanded] = useState(true);
  const dashIdRef = useRef(1);
  const [, setPredefinedFunctions] = useRecoilState(predefinedFunctionsState);
  const [functionsLoaded, setFunctionsLoaded] = useState(false);

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

  const closeMenu = () => {
    setAnchorEl(null);
    setMenuDashboard(null);
    setMenuPosition(null);
  };

  // Fetch favorites/bookmarks from backend
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/favorites/dashboards`);
      const data = await response.json();
      if (data.success && data.favoriteIds) {
        setFavorites(new Set(data.favoriteIds));
        // Bookmarks are the same as favorites (persisted)
        setBookmarks(new Set(data.favoriteIds));
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  }, []);

  // Fetch dashboards from backend
  const fetchDashboards = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/dashboards`);
      const data = await response.json();
      
      if (data.success && data.dashboards) {
        console.log('📥 [Dashboards] raw response', data.dashboards);
        const mappedDashboards: Dashboard[] = data.dashboards.map((d: any) => {
          const rawCharts = d.charts_count ?? d.chartsCount ?? 0;
          const rawViews = d.views_count ?? d.viewsCount ?? 0;
          return {
          id: d.id.toString(),
          name: d.name,
          slug: d.slug,
          description: d.description || '',
          thumbnail: '',
          createdAt: new Date(d.createdAt || d.created_at).getTime(),
          updatedAt: new Date(d.updatedAt || d.updated_at).getTime(),
          chartsCount: Number(rawCharts),
          viewsCount: Number(rawViews),
          icon: d.icon,
            color: d.color || getCardColor(d.id.toString()),
            // New fields (backend now returns camelCase)
            dataSource: d.dataSource || d.data_source || '',
            timePeriodStart: d.timePeriodStart || d.time_period_start || null,
            timePeriodEnd: d.timePeriodEnd || d.time_period_end || null,
            libraryType: d.libraryType || d.library_type || 'Core libraries',
            iconType: d.iconType || d.icon_type || 'text',
            iconText: d.iconText || d.icon_text || '',
            iconColor: d.iconColor || d.icon_color || '#3B82F6',
            iconImageUrl: d.iconImageUrl || d.icon_image_url || '',
            adminPortalId: d.adminPortalId || d.admin_portal_id || '',
            embedType: d.embedType || d.embed_type || '',
            embedLink: d.embedLink || d.embed_link || '',
            triggerCalculation: d.triggerCalculation || d.trigger_calculation || '',
        };
        });
        setDashboards(mappedDashboards);
        
        // Update dashIdRef for new dashboard creation
        const maxId = Math.max(0, ...mappedDashboards.map(d => parseInt(d.id) || 0));
        dashIdRef.current = maxId + 1;
      }
    } catch (err) {
      console.error('Error fetching dashboards:', err);
    } finally {
      setIsLoading(false);
    }
  }, [setDashboards]);

  // Load dashboards and favorites on mount
  useEffect(() => {
    fetchDashboards();
    fetchFavorites();
  }, [fetchDashboards, fetchFavorites]);

  // Load predefined functions on mount
  useEffect(() => {
    const loadPredefinedFunctions = async () => {
      if (functionsLoaded) return;
      
      try {
        const response = await fetch(`${API_BASE}/predefined-functions?global=true`);
        const data = await response.json();
        
        if (data.success && data.functions) {
          setPredefinedFunctions(data.functions);
          setFunctionsLoaded(true);
        }
      } catch (err) {
        console.error('Failed to load predefined functions:', err);
      }
    };
    
    loadPredefinedFunctions();
  }, [setPredefinedFunctions, functionsLoaded]);

  // Filter dashboards
  const filteredDashboards = useMemo(() => {
    let result = [...dashboards];
    
    // Library type filter
    if (activeLibraryTab > 0) {
      const selectedType = LIBRARY_TYPES[activeLibraryTab];
      result = result.filter(d => (d as any).libraryType === selectedType);
    }
    
    // Search filter
    if (searchQuery) {
      result = result.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Sort
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
      return b.createdAt - a.createdAt;
    });
    
    return result;
  }, [dashboards, searchQuery, sortBy, activeLibraryTab]);

  // Separate bookmarked and regular dashboards
  const bookmarkedDashboards = filteredDashboards.filter(d => bookmarks.has(d.id));
  const regularDashboards = filteredDashboards.filter(d => !bookmarks.has(d.id));

  // Reset form fields
  const resetCreateForm = () => {
    setNewDashboardName('');
    setNewDashboardDesc('');
    setNewLibraryType('Core libraries');
    setNewDataSource('');
    setNewTimePeriodStart('');
    setNewTimePeriodEnd('');
    setNewIconType('text');
    setNewIconText('');
    setNewIconColor('#3B82F6');
    setNewIconImageUrl('');
    setNewAdminPortalId('');
    setNewEmbedType('');
    setNewEmbedLink('');
    setNewTriggerCalculation('');
  };

  // Fetch calculations for dropdown
  const fetchCalculations = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/calculations`);
      const data = await response.json();
      if (data.success && data.calculations) {
        setCalculations(data.calculations.map((c: any) => ({ id: c.id.toString(), variable_name: c.variable_name })));
      }
    } catch (err) {
      console.error('Error fetching calculations:', err);
    }
  }, []);

  // Deep search across dashboards and views
  const performDeepSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults({ dashboards: [], views: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const lowerQuery = query.toLowerCase();

    try {
      // Search dashboards
      const matchingDashboards = dashboards.filter(d =>
        d.name.toLowerCase().includes(lowerQuery) ||
        (d.description && d.description.toLowerCase().includes(lowerQuery)) ||
        (d.dataSource && d.dataSource.toLowerCase().includes(lowerQuery)) ||
        (d.iconText && d.iconText.toLowerCase().includes(lowerQuery))
      );

      // Fetch views for all dashboards and search through them
      const allViews: Array<{ id: string; name: string; slug: string; description?: string; embedType?: string; embedLink?: string; dashboardId: string; dashboardName: string; dashboardSlug: string; dashboardIconText: string; dashboardIconColor: string }> = [];
      
      // Fetch views from all dashboards in parallel
      const viewPromises = dashboards.map(async (dashboard) => {
        try {
          const slug = (dashboard as any).slug || dashboard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          const response = await fetch(`${API_BASE}/dashboards/${slug}/views`);
          const data = await response.json();
          if (data.success && data.views) {
            return data.views.map((v: any) => ({
              id: v.id.toString(),
              name: v.name,
              slug: v.slug,
              description: v.description || '',
              embedType: v.embed_type || v.embedType || '',
              embedLink: v.embed_link || v.embedLink || '',
              dashboardId: dashboard.id,
              dashboardName: dashboard.name,
              dashboardSlug: slug,
              dashboardIconText: (dashboard as any).iconText || getShortCode(dashboard.name),
              dashboardIconColor: (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id),
            }));
          }
          return [];
        } catch (err) {
          console.error(`Error fetching views for dashboard ${dashboard.name}:`, err);
          return [];
        }
      });

      const viewsArrays = await Promise.all(viewPromises);
      viewsArrays.forEach(views => allViews.push(...views));

      // Filter views by search query
      const matchingViews = allViews.filter(v =>
        v.name.toLowerCase().includes(lowerQuery) ||
        (v.description && v.description.toLowerCase().includes(lowerQuery))
      );

      setSearchResults({
        dashboards: matchingDashboards,
        views: matchingViews,
      });
    } catch (err) {
      console.error('Error performing deep search:', err);
    } finally {
      setIsSearching(false);
    }
  }, [dashboards]);

  // Debounced search handler
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      performDeepSearch(value);
    }, 300);
  }, [performDeepSearch]);

  // Create new dashboard
  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;

    // Auto-generate icon text if not provided
    const autoIconText = newIconText || getShortCode(newDashboardName);
    
    // Generate admin portal ID (auto-generated, not editable)
    const generatedAdminPortalId = `AP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const response = await fetch(`${API_BASE}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDashboardName,
          description: newDashboardDesc,
          libraryType: newLibraryType,
          dataSource: newDataSource,
          timePeriodStart: newTimePeriodStart || null,
          timePeriodEnd: newTimePeriodEnd || null,
          iconType: newIconType,
          iconText: autoIconText,
          iconColor: newIconColor,
          iconImageUrl: newIconImageUrl,
          adminPortalId: generatedAdminPortalId,
          embedType: newEmbedType || null,
          embedLink: newEmbedLink || null,
          triggerCalculation: newTriggerCalculation || null,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Create failed (${response.status})`);
      }
      const data = text ? JSON.parse(text) : {};

      if (data.success && data.dashboard) {
        const db = data.dashboard;

        const newDashboard: Dashboard = {
          id: db.id.toString(),
          name: db.name,
          slug: db.slug,
          description: db.description || '',
          thumbnail: '',
          createdAt: new Date(db.createdAt || db.created_at).getTime(),
          updatedAt: new Date(db.updatedAt || db.updated_at).getTime(),
          chartsCount: 0,
          viewsCount: 0,
          icon: db.icon,
          color: db.color,
          dataSource: db.dataSource || db.data_source || '',
          timePeriodStart: db.timePeriodStart || db.time_period_start || null,
          timePeriodEnd: db.timePeriodEnd || db.time_period_end || null,
          libraryType: db.libraryType || db.library_type || 'Core libraries',
          iconType: db.iconType || db.icon_type || 'text',
          iconText: db.iconText || db.icon_text || '',
          iconColor: db.iconColor || db.icon_color || '#3B82F6',
          iconImageUrl: db.iconImageUrl || db.icon_image_url || '',
          adminPortalId: db.adminPortalId || db.admin_portal_id || '',
          embedType: db.embedType || db.embed_type || '',
          embedLink: db.embedLink || db.embed_link || '',
          triggerCalculation: db.triggerCalculation || db.trigger_calculation || '',
          tableauSyncedAt: db.tableauSyncedAt || db.tableau_synced_at || undefined,
        };
        
        setDashboards([...dashboards, newDashboard]);
        resetCreateForm();
        setOpenCreateDialog(false);

        // If Tableau library, navigate to embed page to trigger sync
        if (newDashboard.embedType === 'tableau' && newDashboard.embedLink) {
          navigate(`/${newDashboard.slug}/embed?sync=true`);
        }
      }
    } catch (err) {
      console.error('Error creating dashboard:', err);
    }
  };

  // Edit dashboard
  const handleEditStart = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setEditName(dashboard.name);
    setEditDesc(dashboard.description || '');
    setEditDataSource((dashboard as any).dataSource || '');
    setEditTimePeriodStart((dashboard as any).timePeriodStart?.toString() || '');
    setEditTimePeriodEnd((dashboard as any).timePeriodEnd?.toString() || '');
    setEditLibraryType((dashboard as any).libraryType || 'Core libraries');
    setEditIconType((dashboard as any).iconType || 'text');
    setEditIconText((dashboard as any).iconText || '');
    setEditIconColor((dashboard as any).iconColor || '#3B82F6');
    setEditIconImageUrl((dashboard as any).iconImageUrl || '');
    setEditAdminPortalId((dashboard as any).adminPortalId || '');
    setEditEmbedType((dashboard as any).embedType || '');
    setEditEmbedLink((dashboard as any).embedLink || '');
    setEditTriggerCalculation((dashboard as any).triggerCalculation || '');
    fetchCalculations();
    setOpenCreateDialog(true);
    setAnchorEl(null);
  };

  const handleEditSave = async () => {
    if (!editName.trim() || !editingDashboard) return;

    // Auto-generate icon text if not provided
    const autoIconText = editIconText || getShortCode(editName);

    try {
      const response = await fetch(`${API_BASE}/dashboards/${editingDashboard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
          dataSource: editDataSource,
          timePeriodStart: editTimePeriodStart || null,
          timePeriodEnd: editTimePeriodEnd || null,
          libraryType: editLibraryType,
          iconType: editIconType,
          iconText: autoIconText,
          iconColor: editIconColor,
          iconImageUrl: editIconImageUrl,
          adminPortalId: editAdminPortalId || null,
          embedType: editEmbedType || null,
          embedLink: editEmbedLink || null,
          triggerCalculation: editTriggerCalculation || null,
        }),
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `Update failed (${response.status})`);
      }
      const data = text ? JSON.parse(text) : {};

      if (data.success && data.dashboard) {
        const db = data.dashboard;
        setDashboards(
          dashboards.map((d) =>
            d.id === editingDashboard.id
              ? { 
                  ...d, 
                  name: db.name,
                  slug: db.slug || db.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
                  description: db.description || '', 
                  dataSource: db.dataSource || db.data_source || '',
                  timePeriodStart: db.timePeriodStart || db.time_period_start,
                  timePeriodEnd: db.timePeriodEnd || db.time_period_end,
                  libraryType: db.libraryType || db.library_type || 'Core libraries',
                  iconType: db.iconType || db.icon_type || 'text',
                  iconText: db.iconText || db.icon_text || '',
                  iconColor: db.iconColor || db.icon_color || '#3B82F6',
                  iconImageUrl: db.iconImageUrl || db.icon_image_url || '',
                  adminPortalId: db.adminPortalId || db.admin_portal_id || '',
                  embedType: db.embedType || db.embed_type || '',
                  embedLink: db.embedLink || db.embed_link || '',
                  triggerCalculation: db.triggerCalculation || db.trigger_calculation || '',
                  tableauSyncedAt: db.tableauSyncedAt || db.tableau_synced_at || undefined,
                }
              : d
          )
        );
        // If embed link changed and it's a Tableau type, trigger re-sync
        const oldLink = editingDashboard.embedLink || '';
        const newLink = db.embedLink || db.embed_link || '';
        const newType = db.embedType || db.embed_type || '';
        const newSlug = db.slug || editingDashboard.slug;

        if (newType === 'tableau' && newLink && newLink !== oldLink) {
          setEditingDashboard(null);
          setEditName('');
          setEditDesc('');
          setOpenCreateDialog(false);
          navigate(`/${newSlug}/embed?sync=true`);
          return;
        }
      }
    } catch (err) {
      console.error('Error updating dashboard:', err);
    }

    setEditingDashboard(null);
    setEditName('');
    setEditDesc('');
    setOpenCreateDialog(false);
  };

  const handleDeleteClick = (dashboard: Dashboard) => {
    setDeletingDashboard(dashboard);
    setOpenDeleteDialog(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingDashboard) return;
    
    try {
      const response = await fetch(`${API_BASE}/dashboards/${deletingDashboard.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDashboards(dashboards.filter((d) => d.id !== deletingDashboard.id));
      }
    } catch (err) {
      console.error('Error deleting dashboard:', err);
    }
    
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
  };

  const handleDashboardClick = (dashboard: Dashboard) => {
    const slug = (dashboard as any).slug || dashboard.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');

    if ((dashboard as any).embedType === 'tableau' && (dashboard as any).embedLink) {
      // Tableau libraries always go to views page; Sync button is there if needed
      navigate(`/${slug}`);
    } else if ((dashboard as any).embedType && (dashboard as any).embedLink) {
      navigate(`/${slug}/embed`);
    } else {
      navigate(`/${slug}`);
    }
  };

  const toggleFavorite = async (id: string) => {
    const newFavorites = new Set(favorites);
    try {
      if (newFavorites.has(id)) {
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'DELETE' });
        newFavorites.delete(id);
      } else {
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'POST' });
        newFavorites.add(id);
      }
      setFavorites(newFavorites);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  // Bookmarks use the same favorites API for persistence
  const toggleBookmark = async (id: string) => {
    const newBookmarks = new Set(bookmarks);
    try {
      if (newBookmarks.has(id)) {
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'DELETE' });
        newBookmarks.delete(id);
    } else {
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'POST' });
        newBookmarks.add(id);
    }
      setBookmarks(newBookmarks);
    } catch (err) {
      console.error('Error toggling bookmark:', err);
    }
  };

  // Library Menu Item Component with Views Submenu - Pure CSS hover approach
  const LibraryMenuItemWithViews = ({ dashboard }: { dashboard: Dashboard }) => {
    const [views, setViews] = useState<Array<{ id: string; name: string; slug: string; embedType?: string; embedLink?: string }>>([]);
    const [loadingViews, setLoadingViews] = useState(false);
    const [viewsLoaded, setViewsLoaded] = useState(false);

    // Fetch views when hovering over dashboard
    const handleMouseEnter = async () => {
      if (viewsLoaded) return;
      setLoadingViews(true);
      try {
        const slug = (dashboard as any).slug || dashboard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        const response = await fetch(`${API_BASE}/dashboards/${slug}/views`);
        const data = await response.json();
        if (data.success && data.views) {
          setViews(data.views.map((v: any) => ({
            id: v.id.toString(),
            name: v.name,
            slug: v.slug,
            embedType: v.embed_type || v.embedType || '',
            embedLink: v.embed_link || v.embedLink || '',
          })));
        }
        setViewsLoaded(true);
      } catch (err) {
        console.error('Error fetching views:', err);
      } finally {
        setLoadingViews(false);
      }
    };

    const handleViewClick = (e: React.MouseEvent, view: { slug: string; embedType?: string; embedLink?: string }) => {
      e.stopPropagation();
      const dashboardSlug = (dashboard as any).slug || dashboard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      if (view.embedType && view.embedLink) {
        navigate(`/${dashboardSlug}/embed?view=${view.slug}`);
      } else {
        navigate(`/${dashboardSlug}/${view.slug}`);
      }
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
          onClick={() => handleDashboardClick(dashboard)}
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
        
        {/* Views Submenu - Pure CSS controlled, positioned to the right */}
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
              Views in {dashboard.iconText}
            </Typography>
          </Box>
          
          {loadingViews ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={20} sx={{ color: '#3B82F6' }} />
            </Box>
          ) : views.length > 0 ? (
            views.map((view) => (
              <Box
                key={view.id}
                onClick={(e) => handleViewClick(e, view)}
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

  // Library Card Component with Views Dropdown
  const LibraryCard = ({ dashboard, isBookmarked }: { dashboard: Dashboard; isBookmarked?: boolean }) => {
    // Use custom icon settings if available
    const iconType = dashboard.iconType || 'text';
    const iconText = dashboard.iconText || getShortCode(dashboard.name);
    const iconColor = dashboard.iconColor || dashboard.color || getCardColor(dashboard.id);
    const iconImageUrl = dashboard.iconImageUrl || '';
    const dataSource = dashboard.dataSource || '';
    const timePeriodStart = dashboard.timePeriodStart;
    const timePeriodEnd = dashboard.timePeriodEnd;
    const dateRange = timePeriodStart && timePeriodEnd 
      ? `${timePeriodStart} - ${timePeriodEnd}` 
      : timePeriodStart 
        ? `${timePeriodStart} - Present` 
        : '';
    const libraryType = dashboard.libraryType || 'Core libraries';

    // State for views (loaded on hover)
    const [views, setViews] = useState<Array<{ id: string; name: string; slug: string; embedType?: string; embedLink?: string }>>([]);
    const [loadingViews, setLoadingViews] = useState(false);
    const [viewsLoaded, setViewsLoaded] = useState(false);

    // Fetch views when tooltip opens (on hover)
    const handleTooltipOpen = async () => {
      if (viewsLoaded) return;
      setLoadingViews(true);
      try {
        const slug = (dashboard as any).slug || dashboard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
        const response = await fetch(`${API_BASE}/dashboards/${slug}/views`);
        const data = await response.json();
        if (data.success && data.views) {
          setViews(data.views.map((v: any) => ({
            id: v.id.toString(),
            name: v.name,
            slug: v.slug,
            embedType: v.embed_type || v.embedType || '',
            embedLink: v.embed_link || v.embedLink || '',
          })));
        }
        setViewsLoaded(true);
      } catch (err) {
        console.error('Error fetching views:', err);
      } finally {
        setLoadingViews(false);
      }
    };

    // Navigate to specific view — route to /embed for Tableau/iframe views
    const handleViewClick = (e: React.MouseEvent, view: { slug: string; embedType?: string; embedLink?: string }) => {
      e.stopPropagation();
      const dashboardSlug = (dashboard as any).slug || dashboard.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
      if (view.embedType && view.embedLink) {
        navigate(`/${dashboardSlug}/embed?view=${view.slug}`);
      } else {
        navigate(`/${dashboardSlug}/${view.slug}`);
      }
    };

    // Info tooltip content - Details with Views shown on hover
    const infoTooltipContent = (
      <Box
        sx={{
          width: 340,
          bgcolor: 'white',
        borderRadius: 3,
          boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Open specific page - Views shown directly */}
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ExpandMoreIcon sx={{ fontSize: 18, color: '#6B7280', transform: 'rotate(0deg)' }} />
            <Typography variant="body2" sx={{ color: '#1F2937', fontWeight: 600 }}>
              Open specific page
            </Typography>
            {loadingViews && <CircularProgress size={14} sx={{ color: '#6B7280', ml: 'auto' }} />}
          </Box>
          
          {/* Views List - Always visible */}
          <Box sx={{ pl: 3.5, pr: 1 }}>
            {views.length > 0 ? (
              views.map((view) => (
                <Box
                  key={view.id}
                  onClick={(e) => handleViewClick(e, view)}
          sx={{
            display: 'flex',
            alignItems: 'center',
                    gap: 1,
                    py: 0.75,
                    px: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: alpha('#3B82F6', 0.08) },
                    transition: 'background 0.15s',
          }}
        >
                  <LayersIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                  <Typography variant="body2" sx={{ color: '#374151', fontWeight: 500 }}>
                    {view.name}
                  </Typography>
        </Box>
              ))
            ) : !loadingViews ? (
              <Typography variant="caption" sx={{ color: '#9CA3AF', fontStyle: 'italic', pl: 1 }}>
                No views available
          </Typography>
            ) : null}
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#E5E7EB' }} />

        {/* Details Section */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1F2937', mb: 1 }}>
            Details
          </Typography>
          {dashboard.description && (
            <Typography variant="body2" sx={{ color: '#4B5563', lineHeight: 1.6, mb: 2 }}>
              {dashboard.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {dataSource && (
              <Chip
                label={dataSource}
                size="small"
                icon={<StorageIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: 1.5,
                  height: 28,
                  '& .MuiChip-icon': { color: '#6B7280' },
                  '& .MuiChip-label': { fontWeight: 500 },
                }}
              />
            )}
            {dateRange && (
              <Chip
                label={dateRange}
                size="small"
                icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: 1.5,
                  height: 28,
                  '& .MuiChip-icon': { color: '#6B7280' },
                  '& .MuiChip-label': { fontWeight: 500 },
                }}
              />
            )}
        </Box>
      </Box>
      </Box>
  );

    return (
      <Card
        sx={{
          borderRadius: 2,
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          height: 200,
          display: 'flex',
          flexDirection: 'column',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            transform: 'translateY(-2px)',
          },
        }}
        onClick={() => handleDashboardClick(dashboard)}
      >
        <CardContent sx={{ p: 2, pb: '12px !important', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header with icon and actions */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
            {/* Icon Box - either text or image */}
            {iconType === 'upload' && iconImageUrl ? (
              <Box
                component="img"
                src={iconImageUrl}
                alt={dashboard.name}
          sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 1.5,
                  objectFit: 'cover',
                  flexShrink: 0,
          }}
        />
            ) : (
        <Box
          sx={{
                  minWidth: 48,
                  height: 48,
                  px: 1,
                  borderRadius: 1.5,
                  bgcolor: iconColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: iconText.length > 3 ? '0.75rem' : '0.9rem',
                  fontWeight: 700,
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                {iconText}
              </Box>
            )}

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); toggleBookmark(dashboard.id); }}
                  sx={{ color: isBookmarked ? '#F59E0B' : '#9CA3AF' }}
                >
                  {isBookmarked ? <BookmarkIcon fontSize="small" /> : <BookmarkBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {/* Info icon with full details tooltip */}
              <Tooltip 
                title={infoTooltipContent}
                arrow
                placement="right-start"
                onOpen={handleTooltipOpen}
                componentsProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'transparent',
                      p: 0,
                      maxWidth: 360,
                      boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
                      '& .MuiTooltip-arrow': {
                        color: '#ffffff',
                        '&::before': {
                          background: '#ffffff',
                        }
                      }
                    },
                  },
                }}
              >
                <IconButton
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                sx={{
                    color: '#3B82F6', 
                    bgcolor: alpha('#3B82F6', 0.1),
                    '&:hover': { bgcolor: alpha('#3B82F6', 0.2) } 
                  }}
                >
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuDashboard(dashboard);
                  setAnchorEl(e.currentTarget);
                  setMenuPosition({ top: e.clientY, left: e.clientX });
                }}
                sx={{ color: '#9CA3AF' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>

          {/* Title with dropdown icon for views */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, position: 'relative' }}>
                <Typography 
                  variant="subtitle1" 
                  sx={{ 
                fontWeight: 600,
                color: '#1F2937',
                    lineHeight: 1.3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dashboard.name}
                </Typography>
            <Tooltip
              title={
                <Box sx={{ minWidth: 150 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'white', display: 'block', mb: 1 }}>
                    Views
                </Typography>
                  {loadingViews ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 1 }}>
                      <CircularProgress size={14} sx={{ color: 'white' }} />
              </Box>
                  ) : views.length > 0 ? (
                    views.map((view) => (
                      <Box
                        key={view.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewClick(e, view);
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
                        }}
                      >
                        <LayersIcon sx={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
                        <Typography variant="caption" sx={{ color: 'white' }}>
                          {view.name}
                        </Typography>
            </Box>
                    ))
                  ) : (
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                      No views available
                    </Typography>
                  )}
                </Box>
              }
              placement="bottom-start"
              onOpen={handleTooltipOpen}
              arrow
              componentsProps={{
                tooltip: {
                  sx: {
                    bgcolor: '#1F2937',
                    '& .MuiTooltip-arrow': { color: '#1F2937' },
                    p: 1.5,
                    borderRadius: 2,
                  },
                },
              }}
            >
                <IconButton
                  size="small"
                onClick={(e) => e.stopPropagation()}
                  sx={{ 
                  p: 0.25,
                  color: '#6B7280',
                  '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
                  }}
                >
                <ExpandMoreIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
          </Box>

          {/* Data source and date */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            {dataSource && (
              <Chip
                label={dataSource}
                  size="small"
                icon={<StorageIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: 1.5,
                  '& .MuiChip-icon': { color: '#9CA3AF' },
                }}
              />
            )}
            {dateRange && (
              <Chip
                label={dateRange}
                size="small"
                icon={<CalendarTodayIcon sx={{ fontSize: 14 }} />}
                sx={{
                  bgcolor: '#F3F4F6',
                  color: '#374151',
                  borderRadius: 1.5,
                  '& .MuiChip-icon': { color: '#9CA3AF' },
                }}
              />
            )}
          </Box>

          {/* Description */}
          {dashboard.description && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: '#6B7280',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                lineHeight: 1.5,
                fontSize: '0.8rem',
              }}
            >
              {dashboard.description}
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  // Section Header Component
  const SectionHeader = ({ 
    title, 
    expanded, 
    onToggle, 
    count 
  }: { 
    title: string; 
    expanded: boolean; 
    onToggle: () => void; 
    count: number;
  }) => (
    <Box
      onClick={onToggle}
              sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 1.5,
        px: 0.5,
        cursor: 'pointer',
        '&:hover': { opacity: 0.8 },
      }}
    >
      {expanded ? (
        <ExpandLessIcon sx={{ fontSize: 20, color: '#6B7280' }} />
      ) : (
        <ExpandMoreIcon sx={{ fontSize: 20, color: '#6B7280' }} />
      )}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem' }}>
        {title}
      </Typography>
      <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
        ({count})
      </Typography>
          </Box>
  );

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        height: '100vh',
        background: '#F8FAFC',
        overflow: 'hidden',
      }}
    >
      {/* Left Icon Sidebar with Text Labels */}
      <Box
        sx={{
          width: 72,
          bgcolor: '#F3F4F6',
          borderRight: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          py: 2,
          gap: 0.5,
        }}
      >
        {/* Logo */}
      <Box
        sx={{
            width: 60,
            height: 60,
            mb: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img src="RBI.png" alt="IQVIA" style={{ height: 48, width: 48, objectFit: 'contain' }} />
        </Box>

        {/* Nav Icons with Labels */}
        {/* Home */}
        <Box
          onClick={() => handleNavClick('home')}
        sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
            borderRadius: 2,
            color: activeNav === 'home' ? '#3B82F6' : '#6B7280',
            bgcolor: activeNav === 'home' ? alpha('#3B82F6', 0.1) : 'transparent',
            '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
            transition: 'all 0.2s',
          }}
        >
          <HomeIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Home</Typography>
          </Box>

        {/* Libraries with Hover Menu - Pure CSS hover for stability */}
        <Box
          sx={{
            position: 'relative',
            '&:hover .library-hover-menu': {
              display: 'block',
            },
          }}
        >
          <Box
            onClick={() => handleNavClick('libraries')}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              cursor: 'pointer',
              py: 1,
              px: 0.5,
              borderRadius: 2,
              color: activeNav === 'libraries' ? '#3B82F6' : '#6B7280',
              bgcolor: activeNav === 'libraries' ? alpha('#3B82F6', 0.1) : 'transparent',
              '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
              transition: 'all 0.2s',
            }}
          >
            <LibraryBooksIcon sx={{ fontSize: 22 }} />
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Libraries</Typography>
          </Box>
          
          {/* Hover Menu - Pure CSS controlled, no JS state flickering */}
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
            {regularDashboards.slice(0, 8).map((dashboard) => (
              <LibraryMenuItemWithViews key={dashboard.id} dashboard={dashboard} />
            ))}
          </Paper>
        </Box>

        {/* Data */}
        <Box
          onClick={() => handleNavClick('dataConnections')}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
            borderRadius: 2,
            color: activeNav === 'dataConnections' ? '#3B82F6' : '#6B7280',
            bgcolor: activeNav === 'dataConnections' ? alpha('#3B82F6', 0.1) : 'transparent',
            '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
            transition: 'all 0.2s',
          }}
        >
          <StorageIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Data</Typography>
        </Box>

        {/* Predefined Functions */}
        <Box
          onClick={() => handleNavClick('functions')}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
            borderRadius: 2,
            color: activeNav === 'functions' ? '#3B82F6' : '#6B7280',
            bgcolor: activeNav === 'functions' ? alpha('#3B82F6', 0.1) : 'transparent',
            '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
            transition: 'all 0.2s',
          }}
        >
          <FunctionsIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Functions</Typography>
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Docs */}
        <Box
          onClick={() => handleNavClick('docs')}
                sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            py: 1,
            px: 0.5,
                  borderRadius: 2,
            color: activeNav === 'docs' ? '#3B82F6' : '#6B7280',
            bgcolor: activeNav === 'docs' ? alpha('#3B82F6', 0.1) : 'transparent',
            '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
            transition: 'all 0.2s',
          }}
        >
          <DocsIcon sx={{ fontSize: 22 }} />
          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Docs</Typography>
        </Box>

        {/* Help */}
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


      {/* Main Content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Conditional Content Based on Active Nav */}
        {activeNav === 'dataConnections' ? (
          /* Data & Connections Content */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
              <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                {/* Tabs */}
                <Box sx={{ borderBottom: '1px solid #E5E7EB', px: 2 }}>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                    <Box
                      onClick={() => setDataTabIndex(0)}
                      sx={{
                        py: 2,
                        px: 1,
                        cursor: 'pointer',
                        borderBottom: dataTabIndex === 0 ? '2px solid #06B6D4' : '2px solid transparent',
                        color: dataTabIndex === 0 ? '#06B6D4' : '#6B7280',
                    fontWeight: 600,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <CloudQueueIcon sx={{ fontSize: 18 }} />
                      Data Sources
                    </Box>
            <Box 
                      onClick={() => setDataTabIndex(1)}
              sx={{ 
                        py: 2,
                        px: 1,
                        cursor: 'pointer',
                        borderBottom: dataTabIndex === 1 ? '2px solid #06B6D4' : '2px solid transparent',
                        color: dataTabIndex === 1 ? '#06B6D4' : '#6B7280',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <SnowflakeIcon sx={{ fontSize: 18 }} />
                      Connections
              </Box>
            </Box>
          </Box>
                <Box sx={{ p: 0 }}>
                  {dataTabIndex === 0 && <AddDataSource />}
                  {dataTabIndex === 1 && <SnowflakeConnector />}
                </Box>
        </Paper>
            </Box>
          </Box>
        ) : activeNav === 'functions' ? (
          /* Predefined Functions Content */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <PredefinedFunctions />
            </Box>
          </Box>
        ) : activeNav === 'home' ? (
          /* Home Content - Welcome Dashboard with Neon Background */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', bgcolor: '#FFFFFF', pt:4 }}>
            {/* Hero Section with Neon Background */}
            <Box
              sx={{
                position: 'relative',
                minHeight: 280,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                py:3,
                px: 3,
                overflow: 'visible',
              }}
            >
              {/* Neon Background Image */}
              <Box
                sx={{
                  position: 'absolute',
                  
                  left: 20,
                  right: 20,
                  height: 300,
                  borderRadius: 4,
                  overflow: 'hidden',
                  zIndex: 0,
                }}
              >
                <Box
                  component="img"
                  src="neon.png"
                  alt=""
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                  }}
                />
              </Box>
              
              {/* Welcome Text */}
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 700,
                  color: '#1F2937',
                  mb: 3,
                  zIndex: 1,
                  textAlign: 'center',
                }}
              >
                Welcome back, {auth.email ? auth.email.split('@')[0].charAt(0).toUpperCase() + auth.email.split('@')[0].slice(1) : 'User'}
              </Typography>

              {/* Search Box */}
              <Box sx={{ position: 'relative', width: '100%', maxWidth: 500, zIndex: 10 }}>
                <Paper
                  elevation={0}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    px: 2,
                    py: 1,
                    borderRadius: searchQuery.trim() ? '12px 12px 0 0' : 3,
                    bgcolor: 'white',
                    border: '1px solid #E5E7EB',
                    borderBottom: searchQuery.trim() ? '1px solid #E5E7EB' : '1px solid #E5E7EB',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                  }}
                >
                  <SearchIcon sx={{ color: '#9CA3AF', mr: 1 }} />
                  <TextField
                    placeholder="Search libraries and views..."
                    variant="standard"
                    fullWidth
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    InputProps={{
                      disableUnderline: true,
                      sx: { fontSize: '0.95rem' },
                    }}
                  />
                  {isSearching && <CircularProgress size={20} sx={{ ml: 1, color: '#3B82F6' }} />}
                  {searchQuery && !isSearching && (
                    <IconButton size="small" onClick={() => { setSearchQuery(''); setSearchResults({ dashboards: [], views: [] }); }}>
                      <CloseIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                    </IconButton>
                  )}
                </Paper>

                {/* Search Results Dropdown */}
                {searchQuery.trim() && (
                  <Paper
                    elevation={8}
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      maxHeight: 400,
                      overflow: 'auto',
                      borderRadius: '0 0 12px 12px',
                      border: '1px solid #E5E7EB',
                      borderTop: 'none',
                      bgcolor: 'white',
                      zIndex: 1000,
                    }}
                  >
                    {isSearching ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} sx={{ color: '#3B82F6' }} />
                        <Typography sx={{ ml: 2, color: '#6B7280' }}>Searching...</Typography>
                      </Box>
                    ) : (searchResults.dashboards.length === 0 && searchResults.views.length === 0) ? (
                      <Box sx={{ py: 4, textAlign: 'center' }}>
                        <Typography sx={{ color: '#9CA3AF' }}>No results found for "{searchQuery}"</Typography>
                      </Box>
                    ) : (
                      <>
                        {/* Dashboard Results */}
                        {searchResults.dashboards.length > 0 && (
                          <>
                            <Box sx={{ px: 2, py: 1.5, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Libraries ({searchResults.dashboards.length})
                              </Typography>
                            </Box>
                            {searchResults.dashboards.map((dashboard) => {
                              const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                              const iconColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                              return (
                                <Box
                                  key={dashboard.id}
                                  onClick={() => {
                                    handleDashboardClick(dashboard);
                                    setSearchQuery('');
                                    setSearchResults({ dashboards: [], views: [] });
                                  }}
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    px: 2,
                                    py: 1.5,
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: '#F3F4F6' },
                                    borderBottom: '1px solid #F3F4F6',
                                  }}
                                >
                                  <Box
                                    sx={{
                                      minWidth: 36,
                                      height: 36,
                                      borderRadius: 1.5,
                                      bgcolor: iconColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      mr: 2,
                                    }}
                                  >
                                    {iconText}
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography sx={{ fontWeight: 600, color: '#1F2937', fontSize: '0.9rem' }}>
                                      {dashboard.name}
                                    </Typography>
                                    {dashboard.description && (
                                      <Typography sx={{ color: '#6B7280', fontSize: '0.8rem', mt: 0.25 }}>
                                        {dashboard.description.length > 60 ? dashboard.description.substring(0, 60) + '...' : dashboard.description}
                                      </Typography>
                                    )}
                                  </Box>
                                  <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#EEF2FF', borderRadius: 1 }}>
                                    <Typography sx={{ fontSize: '0.7rem', color: '#4F46E5', fontWeight: 500 }}>Library</Typography>
                                  </Box>
                                </Box>
                              );
                            })}
                          </>
                        )}

                        {/* View Results */}
                        {searchResults.views.length > 0 && (
                          <>
                            <Box sx={{ px: 2, py: 1.5, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Views ({searchResults.views.length})
                              </Typography>
                            </Box>
                            {searchResults.views.map((view) => (
                              <Box
                                key={`${view.dashboardId}-${view.id}`}
                                onClick={() => {
                                  if (view.embedType && view.embedLink) {
                                    navigate(`/${view.dashboardSlug}/embed?view=${view.slug}`);
                                  } else {
                                    navigate(`/${view.dashboardSlug}/${view.slug}`);
                                  }
                                  setSearchQuery('');
                                  setSearchResults({ dashboards: [], views: [] });
                                }}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  px: 2,
                                  py: 1.5,
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#F3F4F6' },
                                  borderBottom: '1px solid #F3F4F6',
                                }}
                              >
                                <Box
                                  sx={{
                                    minWidth: 36,
                                    height: 36,
                                    borderRadius: 1.5,
                                    bgcolor: view.dashboardIconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    mr: 2,
                                  }}
                                >
                                  {view.dashboardIconText}
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography sx={{ fontWeight: 600, color: '#1F2937', fontSize: '0.9rem' }}>
                                    {view.name}
                                  </Typography>
                                  <Typography sx={{ color: '#6B7280', fontSize: '0.8rem', mt: 0.25 }}>
                                    in <span style={{ fontWeight: 500, color: '#4B5563' }}>{view.dashboardName}</span>
                                  </Typography>
                                </Box>
                                <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#ECFDF5', borderRadius: 1 }}>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#059669', fontWeight: 500 }}>View</Typography>
                                </Box>
                              </Box>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </Paper>
                )}
              </Box>
            </Box>

            {/* Content Sections */}
            <Box sx={{ px: 3, py: 2 }}>
              {/* Recent Libraries Section - Expandable */}
              <Box sx={{ mb: 4 }}>
                <Box 
                  onClick={() => setRecentLibrariesExpanded(!recentLibrariesExpanded)}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, cursor: 'pointer' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {recentLibrariesExpanded ? (
                      <ExpandLessIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                    )}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151' }}>
                      Recent libraries
                    </Typography>
                  </Box>
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleNavClick('libraries'); }}
                    sx={{ textTransform: 'none', color: '#3B82F6', fontWeight: 500 }}
                  >
                    View all
                  </Button>
                </Box>
                
                <Collapse in={recentLibrariesExpanded}>
                  {/* Larger Library Icons */}
                  <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', overflowX: 'auto', pb: 1 }}>
                    {dashboards.slice(0, 10).map((dashboard) => {
                      const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                      const cardColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                      
                      return (
                        <Box
                          key={dashboard.id}
                          onClick={() => handleDashboardClick(dashboard)}
                          sx={{
                  display: 'flex',
                  flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            '&:hover': { '& .icon-box': { transform: 'scale(1.05)' } },
                }}
              >
                <Box 
                            className="icon-box"
                  sx={{ 
                              minWidth: 72,
                              height: 72,
                              px: 1,
                              borderRadius: 2.5,
                              bgcolor: cardColor,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'white',
                              fontWeight: 700,
                              fontSize: iconText.length > 3 ? '0.9rem' : '1.1rem',
                              mb: 1,
                              transition: 'transform 0.2s',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                          >
                            {iconText}
                          </Box>
                          <Typography
                            variant="caption"
                      sx={{
                              color: '#6B7280',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              textAlign: 'center',
                              maxWidth: 90,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {dashboard.name}
                          </Typography>
                        </Box>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>

              {/* Recent Projects Section - Expandable */}
              <Box sx={{ mb: 4 }}>
                <Box 
                  onClick={() => setRecentProjectsExpanded(!recentProjectsExpanded)}
                  sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, cursor: 'pointer' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {recentProjectsExpanded ? (
                      <ExpandLessIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                    ) : (
                      <ExpandMoreIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                    )}
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151' }}>
                      Recent projects
                    </Typography>
                  </Box>
                    <Button
                    onClick={(e) => e.stopPropagation()}
                    sx={{ textTransform: 'none', color: '#3B82F6', fontWeight: 500 }}
                  >
                    View all
                  </Button>
                </Box>
                
                <Collapse in={recentProjectsExpanded}>
                  <Grid container spacing={2}>
                    {dashboards.slice(0, 3).map((dashboard) => (
                      <Grid item xs={12} sm={6} md={4} key={dashboard.id}>
                        <Paper
                          onClick={() => handleDashboardClick(dashboard)}
                      sx={{
                            p: 2.5,
                            borderRadius: 2,
                            border: '1px solid #E5E7EB',
                            cursor: 'pointer',
                            '&:hover': { borderColor: '#3B82F6', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                            <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <LayersIcon sx={{ color: '#6B7280' }} />
                  </Box>
                </Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1F2937', mb: 1 }}>
                            {dashboard.name}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 2, color: '#6B7280', fontSize: '0.75rem' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <BarChartIcon sx={{ fontSize: 14 }} />
                              {dashboard.chartsCount || 0} reports
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <LayersIcon sx={{ fontSize: 14 }} />
                              {dashboard.viewsCount || 0} views
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, pt: 2, borderTop: '1px solid #F3F4F6' }}>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                {auth.email ? auth.email.split('@')[0] : 'User'}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#9CA3AF', display: 'block' }}>
                                {new Date(dashboard.updatedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </Typography>
                            </Box>
                            <ChevronRightIcon sx={{ color: '#9CA3AF' }} />
                </Box>
              </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Collapse>
            </Box>

              {/* Other Recents Table - Expandable */}
              <Box>
                <Box 
                  onClick={() => setOtherRecentsExpanded(!otherRecentsExpanded)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, cursor: 'pointer' }}
                >
                  {otherRecentsExpanded ? (
                    <ExpandLessIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                  ) : (
                    <ExpandMoreIcon sx={{ fontSize: 20, color: '#6B7280' }} />
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151' }}>
                    Other recents
                  </Typography>
                </Box>
                
                <Collapse in={otherRecentsExpanded}>
                  <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                  {/* Table Header */}
                  <Box sx={{ display: 'flex', px: 2, py: 1.5, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    <Typography variant="caption" sx={{ flex: 2, fontWeight: 600, color: '#6B7280' }}>Title</Typography>
                    <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, color: '#6B7280' }}>Type</Typography>
                    <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, color: '#6B7280' }}>Location</Typography>
                    <Typography variant="caption" sx={{ flex: 1, fontWeight: 600, color: '#6B7280' }}>Last accessed</Typography>
                    <Box sx={{ width: 40 }} />
                  </Box>
                  
                  {/* Table Rows */}
                  {dashboards.slice(0, 5).map((dashboard, index) => (
                    <Box
                      key={dashboard.id}
                      onClick={() => handleDashboardClick(dashboard)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        px: 2,
                        py: 1.5,
                        cursor: 'pointer',
                        borderBottom: index < 4 ? '1px solid #F3F4F6' : 'none',
                        '&:hover': { bgcolor: '#F9FAFB' },
                      }}
                    >
                      <Box sx={{ flex: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <BarChartIcon sx={{ fontSize: 18, color: '#6B7280' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#1F2937' }}>
                          {dashboard.name}
                        </Typography>
                      </Box>
                      <Typography variant="body2" sx={{ flex: 1, color: '#6B7280' }}>
                        {index % 3 === 0 ? 'Chart' : index % 3 === 1 ? 'Report' : 'Custom view'}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, color: '#3B82F6' }}>
                        {dashboard.name} Project
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, color: '#6B7280' }}>
                        {new Date(dashboard.updatedAt).toLocaleDateString('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' })} {new Date(dashboard.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Box sx={{ width: 40, display: 'flex', justifyContent: 'center' }}>
                        <ChevronRightIcon sx={{ color: '#9CA3AF', fontSize: 20 }} />
                      </Box>
                    </Box>
                  ))}
                  </Paper>
                </Collapse>
              </Box>
            </Box>
          </Box>
        ) : activeNav === 'libraries' ? (
          /* Libraries Content */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#E5E7EB' }}>
            {/* Top Header Card */}
            <Box sx={{ p: 2, pb: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: '#FFFFFF',
                  borderRadius: 3,
                  px: 3,
                  py: 2,
                  border: '1px solid #E5E7EB',
                }}
              >
                {/* Title and Tabs Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Title with blue vertical line */}
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 4, height: 24, bgcolor: '#3B82F6', borderRadius: 1, mr: 1.5 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#1F2937' }}>
                      Your Libraries
                    </Typography>
                  </Box>

                {/* Right side actions */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {/* Sort dropdown */}
                  <Button
                    onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                    endIcon={<ExpandMoreIcon />}
          sx={{
                      textTransform: 'none',
                      color: '#6B7280',
                      fontWeight: 500,
                      '&:hover': { bgcolor: '#F3F4F6' },
                    }}
                  >
                    Sort by {sortBy === 'name' ? 'name' : sortBy === 'updated' ? 'updated' : 'created'}
                  </Button>
                  <Menu
                    anchorEl={sortMenuAnchor}
                    open={Boolean(sortMenuAnchor)}
                    onClose={() => setSortMenuAnchor(null)}
                    PaperProps={{
                      sx: { borderRadius: 2, minWidth: 150, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
          }}
        >
                    <MenuItem 
                      onClick={() => { setSortBy('name'); setSortMenuAnchor(null); }}
                      selected={sortBy === 'name'}
                      sx={{ fontWeight: sortBy === 'name' ? 600 : 400 }}
                    >
                      Name
                    </MenuItem>
                    <MenuItem 
                      onClick={() => { setSortBy('updated'); setSortMenuAnchor(null); }}
                      selected={sortBy === 'updated'}
                      sx={{ fontWeight: sortBy === 'updated' ? 600 : 400 }}
                    >
                      Recently Updated
                    </MenuItem>
                    <MenuItem 
                      onClick={() => { setSortBy('created'); setSortMenuAnchor(null); }}
                      selected={sortBy === 'created'}
                      sx={{ fontWeight: sortBy === 'created' ? 600 : 400 }}
                    >
                      Date Created
                    </MenuItem>
                  </Menu>

                  {/* Search */}
                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      placeholder="Search libraries..."
                      size="small"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      sx={{
                        width: 280,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: '#F3F4F6',
                          '& fieldset': { borderColor: 'transparent' },
                          '&:hover fieldset': { borderColor: '#D1D5DB' },
                          '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
                        },
                      }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                          </InputAdornment>
                        ),
                        endAdornment: (
                          <InputAdornment position="end">
                            {isSearching && <CircularProgress size={16} sx={{ color: '#3B82F6' }} />}
                            {searchQuery && !isSearching && (
                              <IconButton size="small" onClick={() => { setSearchQuery(''); setSearchResults({ dashboards: [], views: [] }); }}>
                                <CloseIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />
                              </IconButton>
                            )}
                          </InputAdornment>
                        ),
                      }}
                    />

                    {/* Search Results Dropdown for Libraries Page */}
                    {searchQuery.trim() && (searchResults.dashboards.length > 0 || searchResults.views.length > 0) && (
                      <Paper
                        elevation={8}
                        sx={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          mt: 0.5,
                          maxHeight: 350,
                          overflow: 'auto',
                          borderRadius: 2,
                          border: '1px solid #E5E7EB',
                          bgcolor: 'white',
                          zIndex: 1000,
                        }}
                      >
                        {/* View Results in Libraries Page */}
                        {searchResults.views.length > 0 && (
                          <>
                            <Box sx={{ px: 2, py: 1, bgcolor: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                              <Typography variant="caption" sx={{ fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Views ({searchResults.views.length})
                              </Typography>
                            </Box>
                            {searchResults.views.slice(0, 8).map((view) => (
                              <Box
                                key={`lib-${view.dashboardId}-${view.id}`}
                                onClick={() => {
                                  if (view.embedType && view.embedLink) {
                                    navigate(`/${view.dashboardSlug}/embed?view=${view.slug}`);
                                  } else {
                                    navigate(`/${view.dashboardSlug}/${view.slug}`);
                                  }
                                  setSearchQuery('');
                                  setSearchResults({ dashboards: [], views: [] });
                                }}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  px: 2,
                                  py: 1,
                                  cursor: 'pointer',
                                  '&:hover': { bgcolor: '#F3F4F6' },
                                  borderBottom: '1px solid #F3F4F6',
                                }}
                              >
                                <Box
                                  sx={{
                                    minWidth: 28,
                                    height: 28,
                                    borderRadius: 1,
                                    bgcolor: view.dashboardIconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '0.65rem',
                                    mr: 1.5,
                                  }}
                                >
                                  {view.dashboardIconText}
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 500, color: '#1F2937', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {view.name}
                                  </Typography>
                                  <Typography sx={{ color: '#9CA3AF', fontSize: '0.7rem' }}>
                                    in {view.dashboardName}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}
                          </>
                        )}
                      </Paper>
                    )}
                  </Box>

                  {/* View toggles */}
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, value) => value && setViewMode(value)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                        border: '1px solid #E5E7EB',
                        color: '#6B7280',
                    px: 1,
                    '&.Mui-selected': {
                          bgcolor: '#3B82F6',
                          color: 'white',
                          '&:hover': { bgcolor: '#2563EB' },
                    },
                  },
                }}
              >
                <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="compact"><AppsIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>

                </Box>
              </Box>
              </Paper>
            </Box>

            {/* Content Card */}
            <Box sx={{ flex: 1, p: 2, pt: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  bgcolor: '#FFFFFF',
                  borderRadius: 3,
                  border: '1px solid #E5E7EB',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Scrollable Content Area */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                  {isLoading ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <CircularProgress sx={{ color: '#3B82F6' }} />
                    </Box>
                  ) : (
                    <>
                      {/* Bookmarks Section */}
                  {bookmarkedDashboards.length > 0 && (
                    <Box sx={{ mb: 4, pb: 3, borderBottom: '1px solid #E5E7EB' }}>
                      <SectionHeader
                        title="Bookmarks"
                        expanded={bookmarksExpanded}
                        onToggle={() => setBookmarksExpanded(!bookmarksExpanded)}
                        count={bookmarkedDashboards.length}
                      />
                      <Collapse in={bookmarksExpanded}>
                        {viewMode === 'list' ? (
                          /* List View */
                          <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                            <List disablePadding>
                              {bookmarkedDashboards.map((dashboard, index) => {
                                const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                                const iconColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                                return (
                                  <React.Fragment key={dashboard.id}>
                                    {index > 0 && <Divider />}
                                    <ListItemButton onClick={() => handleDashboardClick(dashboard)} sx={{ py: 2, px: 2 }}>
                                      <Box sx={{ minWidth: 48, height: 40, px: 1, borderRadius: 1.5, bgcolor: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2, color: 'white', fontWeight: 700, fontSize: iconText.length > 3 ? '0.7rem' : '0.85rem' }}>
                                        {iconText}
                                      </Box>
                                      <ListItemText
                                        primary={dashboard.name}
                                        secondary={dashboard.description || 'No description'}
                                        primaryTypographyProps={{ fontWeight: 600 }}
                                      />
                                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleBookmark(dashboard.id); }}>
                                        <BookmarkIcon sx={{ color: '#F59E0B' }} />
                                      </IconButton>
                                    </ListItemButton>
                                  </React.Fragment>
                                );
                              })}
                            </List>
                          </Paper>
                        ) : viewMode === 'compact' ? (
                          /* Compact/Icon View - just icon with bookmark */
                          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                            {bookmarkedDashboards.map((dashboard) => {
                              const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                              const iconColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                              return (
                                <Tooltip key={dashboard.id} title={dashboard.name}>
                                  <Box
                                    onClick={() => handleDashboardClick(dashboard)}
                                    sx={{
                                      position: 'relative',
                                      minWidth: 56,
                                      height: 56,
                                      px: 1,
                                      borderRadius: 2,
                                      bgcolor: iconColor,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      color: 'white',
                                      fontWeight: 700,
                                      fontSize: iconText.length > 3 ? '0.7rem' : '0.9rem',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s',
                                      '&:hover': { 
                                        transform: 'scale(1.05)', 
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                      },
                                    }}
                                  >
                                    {iconText}
                                    {/* Bookmark icon */}
                                    <IconButton
                                      size="small"
                                      onClick={(e) => { e.stopPropagation(); toggleBookmark(dashboard.id); }}
                                      sx={{ 
                                        position: 'absolute', 
                                        top: -6, 
                                        right: -6,
                                        p: 0.25,
                                        bgcolor: 'white',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                        color: '#F59E0B',
                                        '&:hover': { 
                                          bgcolor: 'white',
                                          color: '#D97706',
                                        },
                                      }}
                                    >
                                      <BookmarkIcon sx={{ fontSize: 12 }} />
                                    </IconButton>
                                  </Box>
                                </Tooltip>
                              );
                            })}
                          </Box>
                        ) : (
                          /* Grid View */
                          <Grid container spacing={2}>
                            {bookmarkedDashboards.map((dashboard) => (
                              <Grid item xs={12} sm={6} md={4} lg={3} key={dashboard.id}>
                                <LibraryCard dashboard={dashboard} isBookmarked={true} />
                              </Grid>
                            ))}
                          </Grid>
                        )}
                      </Collapse>
                    </Box>
                  )}

                  {/* Libraries Section */}
                  <Box sx={{ mb: 4 }}>
                    <SectionHeader
                      title="Libraries"
                      expanded={librariesExpanded}
                      onToggle={() => setLibrariesExpanded(!librariesExpanded)}
                      count={regularDashboards.length}
                    />
                    <Collapse in={librariesExpanded}>
                      {regularDashboards.length === 0 ? (
                <Box
                  sx={{
                            py: 8,
                    display: 'flex',
                            flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                          <FolderOpenIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 2 }} />
                          <Typography variant="h6" sx={{ color: '#6B7280', mb: 1 }}>
                            No libraries found
                </Typography>
                          <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
                            Create your first library to get started
                </Typography>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => { resetCreateForm(); fetchCalculations(); setOpenCreateDialog(true); }}
                    sx={{
                              bgcolor: '#3B82F6',
                      textTransform: 'none',
                      fontWeight: 600,
                              borderRadius: 2,
                              '&:hover': { bgcolor: '#2563EB' },
                    }}
                  >
                            Create Library
                  </Button>
              </Box>
                      ) : viewMode === 'list' ? (
                        /* List View */
                        <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
              <List disablePadding>
                            {regularDashboards.map((dashboard, index) => {
                              const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                              const iconColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                              const dataSource = (dashboard as any).dataSource;
                              const timePeriodStart = (dashboard as any).timePeriodStart;
                              const timePeriodEnd = (dashboard as any).timePeriodEnd;
                              const dateRange = timePeriodStart && timePeriodEnd 
                                ? `${timePeriodStart} - ${timePeriodEnd}` 
                                : timePeriodStart 
                                  ? `${timePeriodStart} - Present` 
                                  : '';
                              return (
                  <React.Fragment key={dashboard.id}>
                    {index > 0 && <Divider />}
                                  <ListItemButton onClick={() => handleDashboardClick(dashboard)} sx={{ py: 2, px: 2 }}>
                                    <Box sx={{ minWidth: 48, height: 40, px: 1, borderRadius: 1.5, bgcolor: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2, color: 'white', fontWeight: 700, fontSize: iconText.length > 3 ? '0.7rem' : '0.85rem' }}>
                                      {iconText}
                                    </Box>
                                    <ListItemText
                                      primary={dashboard.name}
                                      secondary={dashboard.description || 'No description'}
                                      primaryTypographyProps={{ fontWeight: 600 }}
                                    />
                                    {dataSource && (
                                      <Chip label={dataSource} size="small" sx={{ mr: 1, bgcolor: '#F3F4F6', color: '#64748b' }} />
                                    )}
                                    {dateRange && (
                                      <Chip label={dateRange} size="small" sx={{ mr: 2, bgcolor: '#F3F4F6', color: '#64748b' }} />
                                    )}
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleBookmark(dashboard.id); }}>
                                      <BookmarkBorderIcon sx={{ color: '#9CA3AF' }} />
                                    </IconButton>
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuDashboard(dashboard); setAnchorEl(e.currentTarget); setMenuPosition({ top: e.clientY, left: e.clientX }); }}>
                                      <MoreVertIcon sx={{ color: '#9CA3AF' }} />
                                    </IconButton>
                                  </ListItemButton>
                                </React.Fragment>
                              );
                            })}
                          </List>
                        </Paper>
                      ) : viewMode === 'compact' ? (
                        /* Compact/Icon View - just icon with bookmark */
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          {regularDashboards.map((dashboard) => {
                            const iconText = (dashboard as any).iconText || getShortCode(dashboard.name);
                            const iconColor = (dashboard as any).iconColor || (dashboard as any).color || getCardColor(dashboard.id);
                            const isBookmarked = bookmarks.has(dashboard.id);
                            return (
                              <Tooltip key={dashboard.id} title={dashboard.name}>
                                <Box
                                  onClick={() => handleDashboardClick(dashboard)}
                                  sx={{
                                    position: 'relative',
                                    minWidth: 56,
                                    height: 56,
                                    px: 1,
                                    borderRadius: 2,
                                    bgcolor: iconColor,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: iconText.length > 3 ? '0.7rem' : '0.9rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    '&:hover': { 
                                      transform: 'scale(1.05)', 
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                    },
                                  }}
                                >
                                  {iconText}
                                  {/* Bookmark icon */}
                                  <IconButton
                                    size="small"
                                    onClick={(e) => { e.stopPropagation(); toggleBookmark(dashboard.id); }}
                                    sx={{ 
                                      position: 'absolute', 
                                      top: -6, 
                                      right: -6,
                                      p: 0.25,
                                      bgcolor: 'white',
                                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                      color: isBookmarked ? '#F59E0B' : '#D1D5DB',
                                      '&:hover': { 
                                        bgcolor: 'white',
                                        color: isBookmarked ? '#D97706' : '#9CA3AF',
                                      },
                                    }}
                                  >
                                    {isBookmarked ? <BookmarkIcon sx={{ fontSize: 12 }} /> : <BookmarkBorderIcon sx={{ fontSize: 12 }} />}
                                  </IconButton>
                                </Box>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      ) : (
                        /* Grid View */
                        <Grid container spacing={2}>
                          {regularDashboards.map((dashboard) => (
                            <Grid item xs={12} sm={6} md={4} lg={3} key={dashboard.id}>
                              <LibraryCard dashboard={dashboard} isBookmarked={false} />
                            </Grid>
                          ))}
                        </Grid>
                      )}
                    </Collapse>
                          </Box>

                  
                    </>
                  )}
                </Box>
              </Paper>
            </Box>

            {/* Floating Add Button */}
            <Tooltip title="Create new library">
              <IconButton
                onClick={() => { setEditingDashboard(null); resetCreateForm(); fetchCalculations(); setOpenCreateDialog(true); }}
                sx={{
                  position: 'fixed',
                  bottom: 24,
                  right: 24,
                  width: 56,
                  height: 56,
                  bgcolor: '#3B82F6',
                  color: 'white',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)',
                  '&:hover': { bgcolor: '#2563EB' },
                }}
              >
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        ) : (
          /* Default/Other Nav Items - Coming Soon (Docs) */
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: alpha('#3B82F6', 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
                <DocsIcon sx={{ fontSize: 40, color: '#3B82F6' }} />
              </Box>
              <Typography variant="h5" fontWeight={600} sx={{ mb: 1, color: '#1F2937' }}>
                Documentation
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                This section is coming soon.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => handleNavClick('libraries')}
                sx={{ textTransform: 'none', borderRadius: 2 }}
              >
                Go to Libraries
              </Button>
                        </Box>
                      </Box>
          )}
        </Box>

      {/* User Menu */}
      <Menu
        anchorEl={userMenuAnchor}
        open={Boolean(userMenuAnchor)}
        onClose={() => setUserMenuAnchor(null)}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            borderRadius: 2,
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #E5E7EB' }}>
          <Typography variant="body2" fontWeight={600}>
            {auth.email || 'User'}
          </Typography>
        </Box>
        <MenuItem onClick={handleLogout} sx={{ color: '#EF4444' }}>
          <LogoutIcon fontSize="small" sx={{ mr: 1.5 }} />
          Logout
        </MenuItem>
      </Menu>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl || undefined}
        anchorReference={menuPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={menuPosition || undefined}
        open={Boolean((anchorEl || menuPosition) && menuDashboard)}
        onClose={closeMenu}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            minWidth: 200,
            mt: 0.5,
            border: `1px solid ${alpha('#667eea', 0.12)}`,
          },
        }}
      >
        <MenuItem onClick={() => { if (menuDashboard) handleDashboardClick(menuDashboard); closeMenu(); }}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5, color: '#6B7280' }} />
          Open
        </MenuItem>
        <MenuItem onClick={() => { if (menuDashboard) handleEditStart(menuDashboard); closeMenu(); }}>
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#6B7280' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => { if (menuDashboard) toggleBookmark(menuDashboard.id); closeMenu(); }}>
          {menuDashboard && bookmarks.has(menuDashboard.id) ? (
            <BookmarkIcon fontSize="small" sx={{ mr: 1.5, color: '#F59E0B' }} />
          ) : (
            <BookmarkBorderIcon fontSize="small" sx={{ mr: 1.5, color: '#6B7280' }} />
          )}
          {menuDashboard && bookmarks.has(menuDashboard.id) ? 'Remove Bookmark' : 'Add Bookmark'}
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => { if (menuDashboard) handleDeleteClick(menuDashboard); closeMenu(); }} sx={{ color: '#EF4444' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => { setOpenCreateDialog(false); setEditingDashboard(null); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            {editingDashboard ? 'Edit Library' : 'Create New Library'}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* Library Name */}
            <TextField
              autoFocus
              label="Library Name"
              fullWidth
              required
              value={editingDashboard ? editName : newDashboardName}
              onChange={(e) => editingDashboard ? setEditName(e.target.value) : setNewDashboardName(e.target.value)}
              placeholder="e.g., Market Share Analysis"
            />

            {/* Data Source */}
            <TextField
              label="Data Source"
              fullWidth
              value={editingDashboard ? editDataSource : newDataSource}
              onChange={(e) => editingDashboard ? setEditDataSource(e.target.value) : setNewDataSource(e.target.value)}
              placeholder="e.g., XPT, Snowflake, etc."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <StorageIcon sx={{ color: '#6B7280' }} />
                  </InputAdornment>
                ),
              }}
            />

            {/* Time Period */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#374151', fontWeight: 600 }}>
                Time Period
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Start Date"
                  value={editingDashboard ? editTimePeriodStart : newTimePeriodStart}
                  onChange={(e) => {
                    editingDashboard ? setEditTimePeriodStart(e.target.value) : setNewTimePeriodStart(e.target.value);
                  }}
                  placeholder="e.g., 2020, Jan 2020, Q1 2020"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarTodayIcon sx={{ color: '#6B7280', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  label="End Date"
                  value={editingDashboard ? editTimePeriodEnd : newTimePeriodEnd}
                  onChange={(e) => {
                    editingDashboard ? setEditTimePeriodEnd(e.target.value) : setNewTimePeriodEnd(e.target.value);
                  }}
                  placeholder="e.g., 2025, Dec 2025, Q4 2025"
                  sx={{ flex: 1 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <CalendarTodayIcon sx={{ color: '#6B7280', fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            </Box>

            {/* Admin Portal Permission ID - Read Only */}
            <TextField
              label="Admin Portal Permission ID"
              fullWidth
              value={editingDashboard ? editAdminPortalId : (newAdminPortalId || 'Will be auto-generated on create')}
              disabled
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <InfoIcon sx={{ color: '#6B7280' }} />
                  </InputAdornment>
                ),
              }}
              helperText="This ID is auto-generated and cannot be edited"
              sx={{
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#6B7280',
                },
              }}
            />

            {/* Embed Type Dropdown */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, color: '#374151', fontWeight: 600 }}>
                Embed Configuration (Optional)
              </Typography>
              <TextField
                select
                label="Embed Type"
                fullWidth
                value={editingDashboard ? editEmbedType : newEmbedType}
                onChange={(e) => {
                  const val = e.target.value as '' | 'iframe' | 'tableau';
                  editingDashboard ? setEditEmbedType(val) : setNewEmbedType(val);
                  // Clear embed link when type changes
                  if (!val) {
                    editingDashboard ? setEditEmbedLink('') : setNewEmbedLink('');
                  }
                }}
                sx={{ mb: 2 }}
                InputLabelProps={{
                  shrink: true,
                }}
                SelectProps={{
                  displayEmpty: true,
                  renderValue: (value) => {
                    if (!value || value === '') {
                      return <span style={{ color: '#9CA3AF' }}>None</span>;
                    }
                    if (value === 'iframe') return 'iFrame Link';
                    if (value === 'tableau') return 'Tableau Link';
                    return value as string;
                  },
                }}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="iframe">iFrame Link</MenuItem>
                <MenuItem value="tableau">Tableau Link</MenuItem>
              </TextField>

              {/* Embed Link - Only shown when embed type is selected */}
              {(editingDashboard ? editEmbedType : newEmbedType) && (
                <TextField
                  label={(editingDashboard ? editEmbedType : newEmbedType) === 'iframe' ? 'iFrame URL' : 'Tableau URL'}
                  fullWidth
                  value={editingDashboard ? editEmbedLink : newEmbedLink}
                  onChange={(e) => editingDashboard ? setEditEmbedLink(e.target.value) : setNewEmbedLink(e.target.value)}
                  placeholder={
                    (editingDashboard ? editEmbedType : newEmbedType) === 'iframe' 
                      ? 'https://example.com/embed/...' 
                      : 'https://tableau.example.com/views/...'
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OpenInNewIcon sx={{ color: '#6B7280' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            </Box>

            {/* Trigger Calculation Dropdown */}
            <TextField
              select
              label="Trigger Calculation on Visit"
              fullWidth
              value={editingDashboard ? editTriggerCalculation : newTriggerCalculation}
              onChange={(e) => editingDashboard ? setEditTriggerCalculation(e.target.value) : setNewTriggerCalculation(e.target.value)}
              helperText="Select a calculation to trigger when this dashboard is visited (for display purposes only)"
              InputLabelProps={{
                shrink: true,
              }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (value) => {
                  if (!value || value === '') {
                    return <span style={{ color: '#9CA3AF' }}>None</span>;
                  }
                  return value as string;
                },
              }}
            >
              <MenuItem value="">None</MenuItem>
              {calculations.map((calc) => (
                <MenuItem key={calc.id} value={calc.variable_name}>
                  {calc.variable_name}
                </MenuItem>
              ))}
            </TextField>

            {/* Icon Configuration */}
            <Box sx={{ p: 2.5, bgcolor: alpha('#3B82F6', 0.03), borderRadius: 2.5, border: '1px solid', borderColor: alpha('#3B82F6', 0.08) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
                <Typography variant="subtitle2" sx={{ color: '#374151', fontWeight: 600 }}>
                  Library Icon
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: '#F3F4F6', borderRadius: 2, p: 0.5 }}>
            <Box
                    onClick={() => editingDashboard ? setEditIconType('text') : setNewIconType('text')}
              sx={{
                      px: 2,
                      py: 0.75,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: (editingDashboard ? editIconType : newIconType) === 'text' ? '#FFFFFF' : 'transparent',
                      boxShadow: (editingDashboard ? editIconType : newIconType) === 'text' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: (editingDashboard ? editIconType : newIconType) === 'text' ? '#3B82F6' : '#6B7280' }}>
                      Custom Text
                    </Typography>
                  </Box>
                  <Box
                    onClick={() => editingDashboard ? setEditIconType('upload') : setNewIconType('upload')}
                    sx={{
                      px: 2,
                      py: 0.75,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      bgcolor: (editingDashboard ? editIconType : newIconType) === 'upload' ? '#FFFFFF' : 'transparent',
                      boxShadow: (editingDashboard ? editIconType : newIconType) === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontWeight: 600, color: (editingDashboard ? editIconType : newIconType) === 'upload' ? '#3B82F6' : '#6B7280' }}>
                      Upload Image
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {(editingDashboard ? editIconType : newIconType) === 'text' ? (
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
                  {/* Icon Preview */}
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 2.5,
                      bgcolor: editingDashboard ? editIconColor : newIconColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: '1.5rem',
                      flexShrink: 0,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}
                  >
                    {(editingDashboard ? editIconText : newIconText) || 
                     getShortCode(editingDashboard ? editName : newDashboardName || 'LB')}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      label="Icon Text (max 5 letters)"
                      value={editingDashboard ? editIconText : newIconText}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().substring(0, 5);
                        editingDashboard ? setEditIconText(val) : setNewIconText(val);
                      }}
                      placeholder="Auto-generated from name"
                      size="small"
                      fullWidth
                      sx={{ mb: 2 }}
                      inputProps={{ maxLength: 5, style: { textTransform: 'uppercase' } }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>Choose Color:</Typography>
                      <Box sx={{ position: 'relative' }}>
                        <input
                          type="color"
                          value={editingDashboard ? editIconColor : newIconColor}
                          onChange={(e) => editingDashboard ? setEditIconColor(e.target.value) : setNewIconColor(e.target.value)}
                          style={{
                width: 48,
                height: 48,
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            padding: 0,
                            background: 'transparent',
                          }}
                        />
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: 48,
                            height: 48,
                            borderRadius: 2,
                            bgcolor: editingDashboard ? editIconColor : newIconColor,
                            border: '2px solid #E5E7EB',
                            pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
                          <PaletteIcon sx={{ color: 'white', fontSize: 20, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }} />
            </Box>
                      </Box>
                      <Typography variant="caption" sx={{ color: '#9CA3AF', ml: 1 }}>
                        Click to open color picker
              </Typography>
            </Box>
          </Box>
                </Box>
              ) : (
                <Box>
                  {/* File Upload */}
                  <input
                    type="file"
                    id="icon-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          const base64 = reader.result as string;
                          editingDashboard ? setEditIconImageUrl(base64) : setNewIconImageUrl(base64);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <Box
                    onClick={() => document.getElementById('icon-upload')?.click()}
            sx={{
                      border: '2px dashed #D1D5DB',
                      borderRadius: 2.5,
                      p: 3,
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      bgcolor: '#FAFAFA',
                      '&:hover': {
                        borderColor: '#3B82F6',
                        bgcolor: alpha('#3B82F6', 0.04),
                      },
                    }}
                  >
                    {(editingDashboard ? editIconImageUrl : newIconImageUrl) ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <Box
                          component="img"
                          src={editingDashboard ? editIconImageUrl : newIconImageUrl}
                          alt="Icon preview"
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 2,
                            objectFit: 'cover',
                            border: '2px solid #E5E7EB',
                          }}
                        />
                        <Box sx={{ textAlign: 'left' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                            Image uploaded
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#6B7280' }}>
                            Click to change
                          </Typography>
                        </Box>
                      </Box>
                    ) : (
                      <>
                        <CloudUploadIcon sx={{ fontSize: 40, color: '#9CA3AF', mb: 1 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#374151' }}>
                          Click to upload icon image
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                          PNG, JPG, GIF up to 2MB
                        </Typography>
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            {/* Description */}
          <TextField
            label="Description (Optional)"
            fullWidth
            multiline
            rows={3}
            value={editingDashboard ? editDesc : newDashboardDesc}
            onChange={(e) => editingDashboard ? setEditDesc(e.target.value) : setNewDashboardDesc(e.target.value)}
              placeholder="Describe what this library contains..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => { setOpenCreateDialog(false); setEditingDashboard(null); }}
            sx={{ textTransform: 'none', color: '#6B7280' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingDashboard ? handleEditSave : handleCreateDashboard}
            disabled={editingDashboard ? !editName.trim() : !newDashboardName.trim()}
            sx={{
              bgcolor: '#3B82F6',
              textTransform: 'none',
              fontWeight: 600,
              '&:hover': { bgcolor: '#2563EB' },
            }}
          >
            {editingDashboard ? 'Save Changes' : 'Create Library'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <WarningIcon sx={{ color: '#EF4444' }} />
            <Typography variant="h6" fontWeight={700}>Delete Library</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>"{deletingDashboard?.name}"</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            sx={{
              bgcolor: '#EF4444',
              textTransform: 'none',
              '&:hover': { bgcolor: '#DC2626' },
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardManagement;
