import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { authState, authAPI } from '../recoil/AuthState';
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
  AppBar,
  Toolbar,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Tooltip,
  alpha,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Select,
  FormControl,
  InputLabel,
  Stack,
  SelectChangeEvent,
} from '@mui/material';
import NotFound from './NotFound';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewModule as ViewModuleIcon,
  BarChart as BarChartIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
  Layers as LayersIcon,
  TrendingUp as TrendingUpIcon,
  Search as SearchIcon,
  GridView as GridViewIcon,
  ViewList as ViewListIcon,
  MoreVert as MoreVertIcon,
  AccessTime as AccessTimeIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  OpenInNew as OpenInNewIcon,
  History as HistoryIcon,
  Help as HelpIcon,
  Storage as StorageIcon,
  CloudQueue as CloudQueueIcon,
  AcUnit as SnowflakeIcon,
  Logout as LogoutIcon,
  Email as EmailIcon,
  Info as InfoIcon,
  CloudUpload as CloudUploadIcon,
  Palette as PaletteIcon,
  Image as ImageIcon,
  CalendarToday as CalendarTodayIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Description as DocsIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
  Apps as AppsIcon,
  ExpandMore as ExpandMoreIcon,
  Sync as SyncIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import AddDataSource from '../components/AddDataSource';
import SnowflakeConnector from '../components/SnowflakeConnector';
import PredefinedFunctions from '../components/PredefinedFunctions';
import { Functions as FunctionsIcon } from '@mui/icons-material';
import { predefinedFunctionsState } from '../recoil/PredefinedFunctionsState';
import { API_BASE_URL } from '../config/api.config';

// API base URL
const API_BASE = `${API_BASE_URL}/api`;

interface View {
  id: string;
  name: string;
  slug?: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  chartsCount: number;
  // New fields
  adminPortalId?: string;
  embedType?: '' | 'iframe' | 'tableau';
  embedLink?: string;
  triggerCalculation?: string;
  iconType?: 'text' | 'upload';
  iconText?: string;
  iconColor?: string;
  iconImageUrl?: string;
}

const DashboardViews: React.FC = () => {
  const navigate = useNavigate();
  const { dashboardName: dashboardSlug } = useParams<{ dashboardName: string }>();
  const [auth, setAuth] = useRecoilState(authState);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // State for dashboard info
  const [, setDashboardId] = useState<number | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('Dashboard');
  const [dashboardEmbedType, setDashboardEmbedType] = useState<string>('');
  const [dashboardEmbedLink, setDashboardEmbedLink] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardNotFound, setDashboardNotFound] = useState(false);

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

  // Convert name to URL-friendly slug
  const toSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Replace multiple dashes with single
      .trim();
  };

  // Generate short code from name (up to 5 chars)
  const getShortCode = (name: string): string => {
    return name.replace(/\s+/g, '').substring(0, 5).toUpperCase() || 'VIEW';
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
  
  const [views, setViews] = useState<View[]>([]);
  
  const [newViewName, setNewViewName] = useState<string>('');
  const [newViewDesc, setNewViewDesc] = useState<string>('');
  const [newAdminPortalId, setNewAdminPortalId] = useState<string>('');
  const [newEmbedType, setNewEmbedType] = useState<'' | 'iframe' | 'tableau'>('');
  const [newEmbedLink, setNewEmbedLink] = useState<string>('');
  const [newTriggerCalculation, setNewTriggerCalculation] = useState<string>('');
  const [newIconType, setNewIconType] = useState<'text' | 'upload'>('text');
  const [newIconText, setNewIconText] = useState<string>('');
  const [newIconColor, setNewIconColor] = useState<string>('#667eea');
  const [newIconImageUrl, setNewIconImageUrl] = useState<string>('');
  const [calculations, setCalculations] = useState<Array<{ id: string; variable_name: string }>>([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingView, setDeletingView] = useState<View | null>(null);
  const [editingView, setEditingView] = useState<View | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [dashboardIdForFavorites, setDashboardIdForFavorites] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<View | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuView, setMenuView] = useState<View | null>(null);
  const [activeNav, setActiveNav] = useState<'all' | 'favorites' | 'recent' | 'dataConnections' | 'functions'>('all');
  const [dataTabIndex, setDataTabIndex] = useState<number>(0);
  const viewIdRef = useRef(3);
  const [, setPredefinedFunctions] = useRecoilState(predefinedFunctionsState);
  const [functionsLoaded, setFunctionsLoaded] = useState(false);
  
  // All dashboards for hover menu
  const [allDashboards, setAllDashboards] = useState<Array<{ id: string; name: string; slug: string; iconText?: string; iconColor?: string }>>([]);
  const [bookmarkedDashboardIds, setBookmarkedDashboardIds] = useState<Set<string>>(new Set());

  const closeMenu = () => {
    setAnchorEl(null);
    setMenuView(null);
    setMenuPosition(null);
  };

  // Fetch favorites from backend
  const fetchFavorites = useCallback(async (dashId: number) => {
    try {
      const response = await fetch(`${API_BASE}/favorites/views/${dashId}`);
      const data = await response.json();
      if (data.success && data.favoriteIds) {
        setFavorites(new Set(data.favoriteIds));
      }
    } catch (err) {
      console.error('Error fetching favorites:', err);
    }
  }, []);

  // Fetch dashboard info and views from backend
  const fetchDashboardAndViews = useCallback(async () => {
    if (!dashboardSlug) return;
    
    try {
      setIsLoading(true);
      setDashboardNotFound(false);
      
      // First get dashboard info (with retry for transient failures)
      let dashboardData: any = null;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const dashboardResponse = await fetch(`${API_BASE}/dashboards/${dashboardSlug}`);
          dashboardData = await dashboardResponse.json();
          if (dashboardData.success || dashboardResponse.status === 404) break;
        } catch {
          if (attempt === 2) throw new Error('Failed to fetch dashboard after retries');
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
      
      if (dashboardData?.success && dashboardData.dashboard) {
        const dashId = dashboardData.dashboard.id;
        setDashboardId(dashId);
        setDashboardIdForFavorites(dashId);
        setDashboardName(dashboardData.dashboard.name);
        setDashboardEmbedType(dashboardData.dashboard.embedType || dashboardData.dashboard.embed_type || '');
        setDashboardEmbedLink(dashboardData.dashboard.embedLink || dashboardData.dashboard.embed_link || '');
        
        // Fetch favorites for this dashboard
        fetchFavorites(dashId);
        
        // Then get views for this dashboard
        const viewsResponse = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views`);
        const viewsData = await viewsResponse.json();
        
        if (viewsData.success && viewsData.views) {
          console.log('📥 [Views] raw response', viewsData.views);
          if (viewsData.views.length > 0) {
            const v0 = viewsData.views[0];
            console.log('📥 [Views] sample fields', {
              charts_count: v0.charts_count,
              chartsCount: v0.chartsCount,
            });
          }
          const mappedViews: View[] = viewsData.views.map((v: any) => ({
            id: v.id.toString(),
            name: v.name,
            slug: v.slug,
            description: v.description || '',
            createdAt: new Date(v.created_at || v.createdAt).getTime(),
            updatedAt: new Date(v.updated_at || v.updatedAt).getTime(),
            chartsCount: Number(v.charts_count ?? v.chartsCount ?? 0),
            // New fields
            adminPortalId: v.admin_portal_id || v.adminPortalId || '',
            embedType: v.embed_type || v.embedType || '',
            embedLink: v.embed_link || v.embedLink || '',
            triggerCalculation: v.trigger_calculation || v.triggerCalculation || '',
            iconType: v.icon_type || v.iconType || 'text',
            iconText: v.icon_text || v.iconText || '',
            iconColor: v.icon_color || v.iconColor || '#667eea',
            iconImageUrl: v.icon_image_url || v.iconImageUrl || '',
          }));
          setViews(mappedViews);
          console.log('📊 [Views] mapped totals', {
            totalViews: mappedViews.length,
            totalCharts: mappedViews.reduce((acc, v) => acc + (v.chartsCount || 0), 0),
            sample: mappedViews.slice(0, 3).map(v => ({ name: v.name, chartsCount: v.chartsCount })),
          });
          
          // Update viewIdRef for new view creation
          const maxId = Math.max(0, ...mappedViews.map(v => parseInt(v.id) || 0));
          viewIdRef.current = maxId + 1;
        }
      } else {
        // Dashboard not found - show 404 page
        console.error(`Dashboard not found: "${dashboardSlug}"`);
        setDashboardNotFound(true);
      }
    } catch (err) {
      console.error('Error fetching dashboard/views:', err);
    } finally {
      setIsLoading(false);
    }
  }, [dashboardSlug, fetchFavorites]);

  // Load dashboard and views on mount
  useEffect(() => {
    fetchDashboardAndViews();
  }, [fetchDashboardAndViews]);

  // Fetch all dashboards for Libraries hover menu
  const fetchAllDashboards = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/dashboards`);
      const data = await response.json();
      if (data.success && data.dashboards) {
        const mapped = data.dashboards.map((d: any) => ({
          id: d.id.toString(),
          name: d.name,
          slug: d.slug || d.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-'),
          iconText: d.iconText || d.icon_text || d.name.replace(/\s+/g, '').substring(0, 5).toUpperCase(),
          iconColor: d.iconColor || d.icon_color || '#3B82F6',
        }));
        setAllDashboards(mapped);
        
        // Also fetch bookmarked dashboard IDs
        const bookmarksResponse = await fetch(`${API_BASE}/bookmarks`);
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

  // Load predefined functions when functions nav is selected
  useEffect(() => {
    const loadPredefinedFunctions = async () => {
      if (functionsLoaded || activeNav !== 'functions') return;
      
      try {
        console.log('📊 [DashboardViews] Loading global predefined functions...');
        const response = await fetch(`${API_BASE}/predefined-functions?global=true`);
        const data = await response.json();
        
        if (data.success && data.functions) {
          setPredefinedFunctions(data.functions);
          setFunctionsLoaded(true);
          console.log(`✅ [DashboardViews] Loaded ${data.functions.length} predefined functions`);
        }
      } catch (err) {
        console.error('❌ [DashboardViews] Failed to load predefined functions:', err);
      }
    };
    
    loadPredefinedFunctions();
  }, [activeNav, functionsLoaded, setPredefinedFunctions]);

  // Filter and sort views
  const filteredViews = useMemo(() => {
    let result = [...views];
    
    // Nav filter
    if (activeNav === 'favorites') {
      result = result.filter(v => favorites.has(v.id));
    } else if (activeNav === 'recent') {
      result = result.filter(v => Date.now() - v.updatedAt < 7 * 24 * 60 * 60 * 1000);
    }
    
    if (searchQuery) {
      result = result.filter(v => 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
      return b.createdAt - a.createdAt;
    });
    
    // Favorites first (only in 'all' view)
    if (activeNav === 'all') {
      result.sort((a, b) => {
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        return bFav - aFav;
      });
    }
    
    return result;
  }, [views, searchQuery, sortBy, favorites, activeNav]);

  // Favorite views (for separate section)
  const favoriteViews = useMemo(() => {
    return views.filter(v => favorites.has(v.id));
  }, [views, favorites]);

  // Regular views (non-favorites for the Views section when favorites are shown separately)
  const regularViews = useMemo(() => {
    let result = views.filter(v => !favorites.has(v.id));
    
    if (searchQuery) {
      result = result.filter(v => 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.description && v.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    result.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'updated') return b.updatedAt - a.updatedAt;
      return b.createdAt - a.createdAt;
    });
    
    return result;
  }, [views, searchQuery, sortBy, favorites]);

  // Bookmarked and regular dashboards for hover menu
  const bookmarkedDashboards = useMemo(() => {
    return allDashboards.filter(d => bookmarkedDashboardIds.has(d.id));
  }, [allDashboards, bookmarkedDashboardIds]);

  const otherDashboards = useMemo(() => {
    return allDashboards.filter(d => !bookmarkedDashboardIds.has(d.id));
  }, [allDashboards, bookmarkedDashboardIds]);

  // Stats
  const stats = useMemo(() => ({
    total: views.length,
    totalCharts: views.reduce((acc, v) => acc + (v.chartsCount || 0), 0),
    recentlyUpdated: views.filter(v => Date.now() - v.updatedAt < 7 * 24 * 60 * 60 * 1000).length,
    favorites: favorites.size,
  }), [views, favorites]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return formatDate(timestamp);
  };

  const handleCreateView = async () => {
    if (!newViewName.trim() || !dashboardSlug) return;

    // Auto-generate icon text if not provided
    const autoIconText = newIconText || getShortCode(newViewName);
    
    // Generate admin portal ID (auto-generated, not editable)
    const generatedAdminPortalId = `VP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    try {
      const response = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newViewName,
          description: newViewDesc,
          adminPortalId: generatedAdminPortalId,
          embedType: newEmbedType || null,
          embedLink: newEmbedLink || null,
          triggerCalculation: newTriggerCalculation || null,
          iconType: newIconType,
          iconText: autoIconText,
          iconColor: newIconColor,
          iconImageUrl: newIconImageUrl,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.view) {
        const v = data.view;
        const newView: View = {
          id: v.id.toString(),
          name: v.name,
          slug: v.slug,
          description: v.description || '',
          createdAt: new Date(v.created_at || v.createdAt).getTime(),
          updatedAt: new Date(v.updated_at || v.updatedAt).getTime(),
          chartsCount: 0,
          adminPortalId: v.admin_portal_id || v.adminPortalId || '',
          embedType: v.embed_type || v.embedType || '',
          embedLink: v.embed_link || v.embedLink || '',
          triggerCalculation: v.trigger_calculation || v.triggerCalculation || '',
          iconType: v.icon_type || v.iconType || 'text',
          iconText: v.icon_text || v.iconText || '',
          iconColor: v.icon_color || v.iconColor || '#667eea',
          iconImageUrl: v.icon_image_url || v.iconImageUrl || '',
        };
        
        setViews([...views, newView]);
        resetCreateForm();
        setOpenCreateDialog(false);
      } else {
        console.error('Failed to create view:', data.error);
        alert(data.error || 'Failed to create view');
      }
    } catch (err) {
      console.error('Error creating view:', err);
      alert('Error creating view');
    }
  };

  // Reset form fields
  const resetCreateForm = () => {
    setNewViewName('');
    setNewViewDesc('');
    setNewAdminPortalId('');
    setNewEmbedType('');
    setNewEmbedLink('');
    setNewTriggerCalculation('');
    setNewIconType('text');
    setNewIconText('');
    setNewIconColor('#667eea');
    setNewIconImageUrl('');
  };

  const handleEditStart = (view: View) => {
    setEditingView(view);
    setNewViewName(view.name);
    setNewViewDesc(view.description);
    setNewAdminPortalId(view.adminPortalId || '');
    setNewEmbedType(view.embedType || '');
    setNewEmbedLink(view.embedLink || '');
    setNewTriggerCalculation(view.triggerCalculation || '');
    setNewIconType(view.iconType || 'text');
    setNewIconText(view.iconText || '');
    setNewIconColor(view.iconColor || '#667eea');
    setNewIconImageUrl(view.iconImageUrl || '');
    fetchCalculations();
    setOpenCreateDialog(true);
    setAnchorEl(null);
  };

  const handleEditSave = async () => {
    if (!newViewName.trim() || !editingView || !dashboardSlug) return;

    // Auto-generate icon text if not provided
    const autoIconText = newIconText || getShortCode(newViewName);

    try {
      const response = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views/${editingView.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newViewName,
          description: newViewDesc,
          adminPortalId: newAdminPortalId || null,
          embedType: newEmbedType || null,
          embedLink: newEmbedLink || null,
          triggerCalculation: newTriggerCalculation || null,
          iconType: newIconType,
          iconText: autoIconText,
          iconColor: newIconColor,
          iconImageUrl: newIconImageUrl,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.view) {
        const vw = data.view;
        setViews(
          views.map((v) =>
            v.id === editingView.id
              ? { 
                  ...v, 
                  name: vw.name, 
                  slug: vw.slug,
                  description: vw.description || '', 
                  updatedAt: new Date(vw.updated_at || vw.updatedAt).getTime(),
                  adminPortalId: vw.admin_portal_id || vw.adminPortalId || '',
                  embedType: vw.embed_type || vw.embedType || '',
                  embedLink: vw.embed_link || vw.embedLink || '',
                  triggerCalculation: vw.trigger_calculation || vw.triggerCalculation || '',
                  iconType: vw.icon_type || vw.iconType || 'text',
                  iconText: vw.icon_text || vw.iconText || '',
                  iconColor: vw.icon_color || vw.iconColor || '#667eea',
                  iconImageUrl: vw.icon_image_url || vw.iconImageUrl || '',
                }
              : v
          )
        );

        if (selectedView?.id === editingView.id) {
          setSelectedView({ 
            ...editingView, 
            name: vw.name, 
            slug: vw.slug,
            description: vw.description || '' 
          });

          const newSlug = vw.slug || vw.name.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
          if (newSlug !== editingView.slug) {
            navigate(`/${dashboardSlug}/${newSlug}`, { replace: true });
          }
        }
      } else {
        console.error('Failed to update view:', data.error);
        alert(data.error || 'Failed to update view');
      }
    } catch (err) {
      console.error('Error updating view:', err);
      alert('Error updating view');
    }

    setEditingView(null);
    setNewViewName('');
    setNewViewDesc('');
    setOpenCreateDialog(false);
  };

  const handleDeleteClick = (view: View) => {
    setDeletingView(view);
    setOpenDeleteDialog(true);
    setAnchorEl(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingView || !dashboardSlug) return;
    
    try {
      const response = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views/${deletingView.id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setViews(views.filter((v) => v.id !== deletingView.id));
        if (selectedView?.id === deletingView.id) {
          setSelectedView(null);
        }
        // Remove from favorites (if favorited)
        if (favorites.has(deletingView.id) && dashboardIdForFavorites) {
          try {
            await fetch(`${API_BASE}/favorites/views/${dashboardIdForFavorites}/${deletingView.id}`, { method: 'DELETE' });
            const newFavorites = new Set(favorites);
            newFavorites.delete(deletingView.id);
            setFavorites(newFavorites);
          } catch (err) {
            console.error('Error removing from favorites:', err);
          }
        }
      } else {
        console.error('Failed to delete view:', data.error);
        alert(data.error || 'Failed to delete view');
      }
    } catch (err) {
      console.error('Error deleting view:', err);
      alert('Error deleting view');
    }
    
    setOpenDeleteDialog(false);
    setDeletingView(null);
  };

  const handleViewClick = (view: View) => {
    // Use slug from view if available, otherwise generate from name
    const viewSlug = view.slug || toSlug(view.name);
    
    // Check if view has an embed link - if so, route to embed view
    if (view.embedType && view.embedLink) {
      navigate(`/${dashboardSlug}/embed?view=${viewSlug}`);
    } else {
      // Normal drag-drop dashboard flow
      navigate(`/${dashboardSlug}/${viewSlug}`);
    }
  };

  const toggleFavorite = async (id: string) => {
    if (!dashboardIdForFavorites) return;
    
    const newFavorites = new Set(favorites);
    const isFavorite = newFavorites.has(id);
    
    try {
      if (isFavorite) {
        // Remove from favorites
        await fetch(`${API_BASE}/favorites/views/${dashboardIdForFavorites}/${id}`, { method: 'DELETE' });
        newFavorites.delete(id);
      } else {
        // Add to favorites
        await fetch(`${API_BASE}/favorites/views/${dashboardIdForFavorites}/${id}`, { method: 'POST' });
        newFavorites.add(id);
      }
      setFavorites(newFavorites);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const StatCard = ({ icon, label, value, color, gradient }: { icon: React.ReactNode; label: string; value: number; color: string; gradient: string }) => (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: 'white',
        border: '1px solid #E5E7EB',
        transition: 'all 0.2s ease',
        cursor: 'default',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        },
      }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 4px 12px ${alpha(color, 0.3)}`,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ color: '#1F2937', lineHeight: 1.2 }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  // Library Menu Item Component with Views Submenu - For hover menu
  const LibraryMenuItemWithViews = ({ dashboard }: { dashboard: { id: string; name: string; slug: string; iconText?: string; iconColor?: string } }) => {
    const [menuViews, setMenuViews] = useState<Array<{ id: string; name: string; slug: string }>>([]);
    const [loadingMenuViews, setLoadingMenuViews] = useState(false);
    const [menuViewsLoaded, setMenuViewsLoaded] = useState(false);

    const handleMouseEnter = async () => {
      if (menuViewsLoaded) return;
      setLoadingMenuViews(true);
      try {
        const response = await fetch(`${API_BASE}/dashboards/${dashboard.slug}/views`);
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
              Views in {dashboard.iconText || dashboard.name}
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

  const ViewCard = ({ view, index }: { view: View; index: number }) => {
    const iconColors = ['#3B82F6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const iconColor = view.iconColor || iconColors[index % iconColors.length];
    const iconText = view.iconText || getShortCode(view.name);
    const isBookmarked = favorites.has(view.id);
    
    // Info tooltip content - Details section only (no "Open specific page" since we're in views)
    const infoTooltipContent = (
      <Box
        sx={{
          width: 300,
          bgcolor: 'white',
          borderRadius: 3,
          boxShadow: '0 12px 40px rgba(0,0,0,0.16)',
          border: '1px solid #E5E7EB',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Details Section */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1F2937', mb: 1 }}>
            Details
          </Typography>
          {view.description && (
            <Typography variant="body2" sx={{ color: '#4B5563', lineHeight: 1.6, mb: 2 }}>
              {view.description}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={`${view.chartsCount} charts`}
              size="small"
              icon={<BarChartIcon sx={{ fontSize: 14 }} />}
              sx={{
                bgcolor: '#F3F4F6',
                color: '#374151',
                borderRadius: 1.5,
                height: 28,
                '& .MuiChip-icon': { color: '#6B7280' },
                '& .MuiChip-label': { fontWeight: 500 },
              }}
            />
            <Chip
              label={getTimeAgo(view.updatedAt)}
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
        onClick={() => handleViewClick(view)}
      >
        <CardContent sx={{ p: 2, pb: '12px !important', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Header with icon and actions */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
            {/* Icon Box with abbreviation */}
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
                color: 'white',
                fontWeight: 700,
                fontSize: iconText.length > 3 ? '0.7rem' : '0.85rem',
                flexShrink: 0,
              }}
            >
              {iconText}
            </Box>
            
            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Tooltip title={isBookmarked ? "Remove bookmark" : "Add bookmark"}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}
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
                  setMenuView(view); 
                  setMenuPosition({ top: e.clientY, left: e.clientX }); 
                }}
                sx={{ color: '#9CA3AF' }}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
          
          {/* Name with dropdown arrow */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#1F2937' }}>
              {view.name}
            </Typography>
            <ChevronRightIcon sx={{ fontSize: 16, color: '#9CA3AF', transform: 'rotate(90deg)' }} />
          </Box>
          
          {/* Chips */}
          <Box sx={{ display: 'flex', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Chip
              label={`${view.chartsCount} charts`}
              size="small"
              icon={<BarChartIcon sx={{ fontSize: 14 }} />}
              sx={{
                bgcolor: '#F3F4F6',
                color: '#374151',
                borderRadius: 1.5,
                height: 24,
                '& .MuiChip-icon': { color: '#6B7280' },
                '& .MuiChip-label': { fontWeight: 500, fontSize: '0.7rem' },
              }}
            />
            <Chip
              label={getTimeAgo(view.updatedAt)}
              size="small"
              icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
              sx={{
                bgcolor: '#F3F4F6',
                color: '#374151',
                borderRadius: 1.5,
                height: 24,
                '& .MuiChip-icon': { color: '#6B7280' },
                '& .MuiChip-label': { fontWeight: 500, fontSize: '0.7rem' },
              }}
            />
          </Box>
          
          {/* Description */}
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
            {view.description || 'No description'}
          </Typography>
        </CardContent>
      </Card>
    );
  };

  // Compact view card - just icon with bookmark
  const CompactViewCard = ({ view, index }: { view: View; index: number }) => {
    const iconColors = ['#3B82F6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const iconColor = view.iconColor || iconColors[index % iconColors.length];
    const iconText = view.iconText || getShortCode(view.name);
    const isBookmarked = favorites.has(view.id);
    
    return (
      <Tooltip title={view.name}>
        <Box
          onClick={() => handleViewClick(view)}
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
            onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}
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
  };

  // 🔥 CRITICAL: Show 404 page if dashboard doesn't exist
  // This prevents confusion and data corruption from invalid routes
  if (dashboardNotFound) {
    return <NotFound type="dashboard" />;
  }

  // Show loading state while fetching dashboard info
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          bgcolor: '#F8FAFC',
        }}
      >
        <CircularProgress size={60} sx={{ mb: 2, color: '#3B82F6' }} />
        <Typography variant="h6" sx={{ color: '#6B7280' }}>
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        height: '100vh',
        background: '#F8FAFC',
        overflow: 'hidden',
      }}
    >
      {/* Left Icon Sidebar with Text Labels - Same as DashboardManagement */}
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
          <img src="/RBI.png" alt="IQVIA" style={{ height: 48, width: 48, objectFit: 'contain' }} />
        </Box>

        {/* Nav Icons with Labels */}
        {/* Home */}
        <Box
          onClick={() => navigate('/?nav=home')}
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
            {otherDashboards.slice(0, 8).map((dashboard) => (
              <LibraryMenuItemWithViews key={dashboard.id} dashboard={dashboard} />
            ))}
          </Paper>
        </Box>

        {/* Data */}
        <Box
          onClick={() => setActiveNav('dataConnections')}
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
          onClick={() => setActiveNav('functions')}
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
        ) : (
          /* Views Content - Matching Libraries Page Layout */
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
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {/* Title with blue vertical line + breadcrumb */}
                  <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
                    <Box sx={{ width: 4, borderRadius: 1, bgcolor: '#3B82F6' }} />
                    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: '#1F2937' }}>
                        {dashboardName}
                      </Typography>
                      <Breadcrumbs
                        separator={<NavigateNextIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />}
                        sx={{ '& .MuiBreadcrumbs-li': { lineHeight: 1 } }}
                      >
                        <Link
                          underline="hover"
                          sx={{ fontSize: '0.8rem', color: '#6B7280', cursor: 'pointer', '&:hover': { color: '#3B82F6' } }}
                          onClick={() => navigate('/')}
                        >
                          Libraries
                        </Link>
                        <Typography sx={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 600 }}>
                          {dashboardName}
                        </Typography>
                      </Breadcrumbs>
                    </Box>
                  </Box>

                  {/* Right side actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {/* Sort dropdown */}
                    <Button
                      onClick={(e) => setAnchorEl(e.currentTarget)}
                      endIcon={<ChevronRightIcon sx={{ transform: 'rotate(90deg)' }} />}
                      sx={{
                        textTransform: 'none',
                        color: '#6B7280',
                        fontWeight: 500,
                        '&:hover': { bgcolor: '#F3F4F6' },
                      }}
                    >
                      Sort by {sortBy === 'name' ? 'name' : sortBy === 'updated' ? 'updated' : 'created'}
                    </Button>

                    {/* Search */}
                    <TextField
                      placeholder="Search views..."
                      size="small"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      sx={{
                        width: 220,
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
                      }}
                    />

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
            <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
              {/* Favorites Section - only shows when there are favorites */}
              {favoriteViews.length > 0 && activeNav === 'all' && (
                <Box sx={{ mb: 4, pb: 3, borderBottom: '1px solid #E5E7EB' }}>
                  <Box
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}
                  >
                    <ChevronRightIcon sx={{ fontSize: 20, color: '#6B7280', transform: 'rotate(90deg)' }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem' }}>
                      Bookmarks
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                      ({favoriteViews.length})
                    </Typography>
                  </Box>
                  
                  {viewMode === 'grid' ? (
                    <Grid container spacing={2}>
                      {favoriteViews.map((view, idx) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={view.id}>
                          <ViewCard view={view} index={idx} />
                        </Grid>
                      ))}
                    </Grid>
                  ) : viewMode === 'compact' ? (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      {favoriteViews.map((view, idx) => (
                        <CompactViewCard key={view.id} view={view} index={idx} />
                      ))}
                    </Box>
                  ) : (
                    <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      <List disablePadding>
                        {favoriteViews.map((view, index) => (
                          <React.Fragment key={view.id}>
                            {index > 0 && <Divider />}
                            <ListItemButton onClick={() => handleViewClick(view)} sx={{ py: 2, px: 2 }}>
                              <Box sx={{ minWidth: 48, height: 40, px: 1, borderRadius: 1.5, bgcolor: view.iconColor || '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2, color: 'white', fontWeight: 700, fontSize: '0.7rem' }}>
                                {view.iconText || getShortCode(view.name)}
                              </Box>
                              <ListItemText
                                primary={view.name}
                                secondary={view.description || 'No description'}
                                primaryTypographyProps={{ fontWeight: 600 }}
                              />
                              <Chip label={`${view.chartsCount} charts`} size="small" sx={{ mr: 1, bgcolor: '#F3F4F6', color: '#64748b' }} />
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}>
                                <BookmarkIcon sx={{ color: '#F59E0B' }} />
                              </IconButton>
                            </ListItemButton>
                          </React.Fragment>
                        ))}
                      </List>
                    </Paper>
                  )}
                </Box>
              )}

              {/* Views Section - shows non-favorites when favorites section is visible */}
              <Box sx={{ mb: 4 }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1.5 }}
                >
                  <ChevronRightIcon sx={{ fontSize: 20, color: '#6B7280', transform: 'rotate(90deg)' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#374151', fontSize: '0.85rem' }}>
                    Views
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                    ({activeNav === 'all' && favoriteViews.length > 0 ? regularViews.length : filteredViews.length})
                  </Typography>
                </Box>
                
                {/* Determine which views to display */}
                {(() => {
                  const displayViews = activeNav === 'all' && favoriteViews.length > 0 ? regularViews : filteredViews;
                  
                  if (displayViews.length === 0 && views.length === 0) {
                    return (
                      <Box
                        sx={{
                          py: 8,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ViewModuleIcon sx={{ fontSize: 64, color: '#D1D5DB', mb: 2 }} />
                        <Typography variant="h6" sx={{ color: '#6B7280', mb: 1 }}>
                          No views found
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#9CA3AF', mb: 3 }}>
                          Create your first view to get started
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
                          Create View
                        </Button>
                      </Box>
                    );
                  }
                  
                  if (displayViews.length === 0) {
                    return (
                      <Typography variant="body2" sx={{ color: '#9CA3AF', py: 2, textAlign: 'center' }}>
                        No additional views to display
                      </Typography>
                    );
                  }
                  
                  if (viewMode === 'grid') {
                    return (
                      <Grid container spacing={2}>
                        {displayViews.map((view, index) => (
                          <Grid item xs={12} sm={6} md={4} lg={3} key={view.id}>
                            <ViewCard view={view} index={index} />
                          </Grid>
                        ))}
                      </Grid>
                    );
                  }
                  
                  if (viewMode === 'compact') {
                    return (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        {displayViews.map((view, index) => (
                          <CompactViewCard key={view.id} view={view} index={index} />
                        ))}
                      </Box>
                    );
                  }
                  
                  // List view
                  return (
                    <Paper sx={{ borderRadius: 2, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
                      <List disablePadding>
                        {displayViews.map((view, index) => (
                          <React.Fragment key={view.id}>
                            {index > 0 && <Divider />}
                            <ListItemButton onClick={() => handleViewClick(view)} sx={{ py: 2, px: 2 }}>
                              <Box sx={{ minWidth: 48, height: 40, px: 1, borderRadius: 1.5, bgcolor: view.iconColor || '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2, color: 'white', fontWeight: 700, fontSize: '0.7rem' }}>
                                {view.iconText || getShortCode(view.name)}
                              </Box>
                              <ListItemText
                                primary={view.name}
                                secondary={view.description || 'No description'}
                                primaryTypographyProps={{ fontWeight: 600 }}
                              />
                              <Chip label={`${view.chartsCount} charts`} size="small" sx={{ mr: 1, bgcolor: '#F3F4F6', color: '#64748b' }} />
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}>
                                {favorites.has(view.id) ? (
                                  <BookmarkIcon sx={{ color: '#F59E0B' }} />
                                ) : (
                                  <BookmarkBorderIcon sx={{ color: '#9CA3AF' }} />
                                )}
                              </IconButton>
                              <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuView(view); setMenuPosition({ top: e.clientY, left: e.clientX }); }}>
                                <MoreVertIcon sx={{ color: '#9CA3AF' }} />
                              </IconButton>
                            </ListItemButton>
                          </React.Fragment>
                        ))}
                      </List>
                    </Paper>
                  );
                })()}
              </Box>

                </Box>
              </Paper>
            </Box>

            {/* Floating Add Button */}
            {dashboardEmbedType === 'tableau' && dashboardEmbedLink && (
              <Tooltip title="Sync Tableau Views" placement="left">
                <IconButton
                  onClick={() => navigate(`/${dashboardSlug}/embed?sync=true`)}
                  sx={{
                    position: 'fixed',
                    bottom: 100,
                    right: 32,
                    width: 56,
                    height: 56,
                    bgcolor: '#7C3AED',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(124, 58, 237, 0.4)',
                    '&:hover': {
                      bgcolor: '#6D28D9',
                      transform: 'scale(1.1)',
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <SyncIcon sx={{ fontSize: 28 }} />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Create New View" placement="left">
              <IconButton
                onClick={() => { setEditingView(null); resetCreateForm(); fetchCalculations(); setOpenCreateDialog(true); }}
                sx={{
                  position: 'fixed',
                  bottom: 32,
                  right: 32,
                  width: 56,
                  height: 56,
                  bgcolor: '#3B82F6',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)',
                  '&:hover': {
                    bgcolor: '#2563EB',
                    transform: 'scale(1.1)',
                  },
                  transition: 'all 0.2s',
                }}
              >
                <AddIcon sx={{ fontSize: 28 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={menuPosition ? undefined : anchorEl || undefined}
        anchorReference={menuPosition ? 'anchorPosition' : 'anchorEl'}
        anchorPosition={menuPosition || undefined}
        open={Boolean((menuPosition || anchorEl) && menuView)}
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
            border: '1px solid #E5E7EB',
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={() => { if (menuView) handleViewClick(menuView); closeMenu(); }}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5, color: '#3B82F6' }} />
          Open
        </MenuItem>
        <MenuItem onClick={() => { if (menuView) handleEditStart(menuView); closeMenu(); }}>
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#3B82F6' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => { if (menuView) toggleFavorite(menuView.id); closeMenu(); }}>
          {menuView && favorites.has(menuView.id) ? (
            <BookmarkIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          ) : (
            <BookmarkBorderIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          )}
          {menuView && favorites.has(menuView.id) ? 'Remove bookmark' : 'Add bookmark'}
        </MenuItem>
        <Divider sx={{ my: 1, borderColor: '#E5E7EB' }} />
        <MenuItem onClick={() => { if (menuView) handleDeleteClick(menuView); closeMenu(); }} sx={{ color: '#ef4444' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => { setOpenCreateDialog(false); setEditingView(null); resetCreateForm(); }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: 'white',
            border: '1px solid #E5E7EB',
            boxShadow: '0 24px 48px rgba(0,0,0,0.12)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1, borderBottom: '1px solid #E5E7EB' }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: '#3B82F6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.3)',
              }}
            >
              {editingView ? <EditIcon sx={{ color: 'white' }} /> : <AddIcon sx={{ color: 'white' }} />}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#1F2937' }}>
                {editingView ? 'Edit View' : 'Create New View'}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6B7280' }}>
                {editingView ? 'Update view details' : 'Set up your new analytics view'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Stack spacing={3}>
            {/* View Name */}
            <TextField
              autoFocus
              label="View Name"
              fullWidth
              required
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              placeholder="e.g., Patient View, Sales Overview"
              InputLabelProps={{ shrink: true }}
            />

            {/* Description */}
            <TextField
              label="Description (Optional)"
              fullWidth
              multiline
              rows={2}
              value={newViewDesc}
              onChange={(e) => setNewViewDesc(e.target.value)}
              placeholder="Describe what this view will display..."
              InputLabelProps={{ shrink: true }}
            />

            {/* Admin Portal Permission ID */}
            <TextField
              label="Admin Portal Permission ID"
              fullWidth
              value={editingView ? newAdminPortalId : '(Auto-generated on create)'}
              InputProps={{
                readOnly: true,
                startAdornment: (
                  <InputAdornment position="start">
                    <InfoIcon sx={{ color: '#9CA3AF' }} />
                  </InputAdornment>
                ),
              }}
              InputLabelProps={{ shrink: true }}
              helperText="This ID is auto-generated and cannot be edited"
              sx={{ '& .MuiOutlinedInput-root': { bgcolor: '#F9FAFB' } }}
            />

            {/* Embed Configuration */}
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mt: 1 }}>
              Embed Configuration (Optional)
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel shrink>Embed Type</InputLabel>
              <Select
                value={newEmbedType}
                onChange={(e: SelectChangeEvent) => setNewEmbedType(e.target.value as '' | 'iframe' | 'tableau')}
                label="Embed Type"
                displayEmpty
                notched
                renderValue={(value) => {
                  if (!value) return <span style={{ color: '#9CA3AF' }}>None</span>;
                  return value === 'iframe' ? 'iFrame Link' : 'Tableau Link';
                }}
              >
                <MenuItem value="">None</MenuItem>
                <MenuItem value="iframe">iFrame Link</MenuItem>
                <MenuItem value="tableau">Tableau Link</MenuItem>
              </Select>
            </FormControl>

            {/* Embed Link - shown when embed type is selected */}
            {newEmbedType && (
              <TextField
                label={newEmbedType === 'iframe' ? 'iFrame URL' : 'Tableau URL'}
                fullWidth
                value={newEmbedLink}
                onChange={(e) => setNewEmbedLink(e.target.value)}
                placeholder={newEmbedType === 'iframe' ? 'https://example.com/embed' : 'https://tableau.example.com/view'}
                InputLabelProps={{ shrink: true }}
              />
            )}

            {/* Trigger Calculation */}
            <TextField
              select
              label="Trigger Calculation on Visit"
              fullWidth
              value={newTriggerCalculation}
              onChange={(e) => setNewTriggerCalculation(e.target.value)}
              InputLabelProps={{ shrink: true }}
              helperText="Select a calculation to trigger when this view is visited (for display purposes only)"
              SelectProps={{
                displayEmpty: true,
                renderValue: (value: unknown) => {
                  if (!value) return <span style={{ color: '#9CA3AF' }}>None</span>;
                  const calc = calculations.find(c => c.variable_name === value);
                  return calc ? calc.variable_name : String(value);
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

            {/* View Icon Section */}
            <Box sx={{ bgcolor: '#F9FAFB', borderRadius: 2, p: 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151' }}>
                  View Icon
                </Typography>
                <ToggleButtonGroup
                  value={newIconType}
                  exclusive
                  onChange={(_, value) => value && setNewIconType(value)}
                  size="small"
                >
                  <ToggleButton value="text" sx={{ textTransform: 'none', px: 2 }}>
                    Custom Text
                  </ToggleButton>
                  <ToggleButton value="upload" sx={{ textTransform: 'none', px: 2 }}>
                    Upload Image
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {newIconType === 'text' ? (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    {/* Preview */}
                    <Box
                      sx={{
                        minWidth: 64,
                        height: 64,
                        px: 1,
                        borderRadius: 2.5,
                        bgcolor: newIconColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: (newIconText || getShortCode(newViewName || 'VIEW')).length > 3 ? '0.85rem' : '1rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {newIconText || getShortCode(newViewName || 'VIEW')}
                    </Box>
                    <TextField
                      label="Icon Text (max 5 letters)"
                      value={newIconText}
                      onChange={(e) => setNewIconText(e.target.value.substring(0, 5).toUpperCase())}
                      placeholder={getShortCode(newViewName || 'VIEW')}
                      size="small"
                      sx={{ flex: 1 }}
                      inputProps={{ maxLength: 5, style: { textTransform: 'uppercase' } }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="caption" sx={{ color: '#6B7280', fontWeight: 500 }}>Choose Color:</Typography>
                    <Box sx={{ position: 'relative' }}>
                      <input
                        type="color"
                        value={newIconColor}
                        onChange={(e) => setNewIconColor(e.target.value)}
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
                    </Box>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', ml: 1 }}>
                      Click to open color picker
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Box>
                  {/* File Upload */}
                  <input
                    type="file"
                    id="view-icon-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setNewIconImageUrl(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                  <label htmlFor="view-icon-upload">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        p: 2,
                        border: '2px dashed #D1D5DB',
                        borderRadius: 2,
                        cursor: 'pointer',
                        '&:hover': { borderColor: '#667eea', bgcolor: alpha('#667eea', 0.05) },
                      }}
                    >
                      {newIconImageUrl ? (
                        <Box
                          component="img"
                          src={newIconImageUrl}
                          sx={{ width: 64, height: 64, borderRadius: 2, objectFit: 'cover' }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: 64,
                            height: 64,
                            borderRadius: 2,
                            bgcolor: '#E5E7EB',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <ImageIcon sx={{ color: '#9CA3AF', fontSize: 28 }} />
                        </Box>
                      )}
                      <Box>
                        <Typography variant="body2" fontWeight={600} color="#374151">
                          {newIconImageUrl ? 'Change Image' : 'Upload Icon Image'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          PNG, JPG up to 2MB
                        </Typography>
                      </Box>
                    </Box>
                  </label>
                </Box>
              )}
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => { setOpenCreateDialog(false); setEditingView(null); resetCreateForm(); }}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingView ? handleEditSave : handleCreateView}
            disabled={!newViewName.trim()}
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
            {editingView ? 'Save Changes' : 'Create View'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={openDeleteDialog} 
        onClose={() => setOpenDeleteDialog(false)} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${alpha('#ef4444', 0.2)}`,
            boxShadow: '0 24px 48px rgba(239, 68, 68, 0.15)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                bgcolor: alpha('#ef4444', 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px solid ${alpha('#ef4444', 0.2)}`,
              }}
            >
              <WarningIcon sx={{ color: '#ef4444', fontSize: 24 }} />
            </Box>
            <Typography variant="h6" fontWeight={700}>Delete View</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#667eea' }}>"{deletingView?.name}"</strong>?
            All charts in this view will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setOpenDeleteDialog(false)}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDeleteConfirm}
            sx={{
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(239, 68, 68, 0.3)',
            }}
          >
            Delete View
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardViews;
