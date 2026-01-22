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
  Zoom,
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
} from '@mui/icons-material';
import AddDataSource from '../components/AddDataSource';
import SnowflakeConnector from '../components/SnowflakeConnector';

// API base URL
const API_BASE = 'http://localhost:3002/api';

interface View {
  id: string;
  name: string;
  slug?: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  chartsCount: number;
}

const DashboardViews: React.FC = () => {
  const navigate = useNavigate();
  const { dashboardName: dashboardSlug } = useParams<{ dashboardName: string }>();
  const [auth, setAuth] = useRecoilState(authState);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  
  // State for dashboard info
  const [, setDashboardId] = useState<number | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('Dashboard');
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
  
  const [views, setViews] = useState<View[]>([]);
  
  const [newViewName, setNewViewName] = useState<string>('');
  const [newViewDesc, setNewViewDesc] = useState<string>('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingView, setDeletingView] = useState<View | null>(null);
  const [editingView, setEditingView] = useState<View | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [dashboardIdForFavorites, setDashboardIdForFavorites] = useState<number | null>(null);
  const [selectedView, setSelectedView] = useState<View | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuView, setMenuView] = useState<View | null>(null);
  const [activeNav, setActiveNav] = useState<'all' | 'favorites' | 'recent' | 'dataConnections'>('all');
  const [dataTabIndex, setDataTabIndex] = useState<number>(0);
  const viewIdRef = useRef(3);

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
      
      // First get dashboard info
      const dashboardResponse = await fetch(`${API_BASE}/dashboards/${dashboardSlug}`);
      const dashboardData = await dashboardResponse.json();
      
      if (dashboardData.success && dashboardData.dashboard) {
        const dashId = dashboardData.dashboard.id;
        setDashboardId(dashId);
        setDashboardIdForFavorites(dashId);
        setDashboardName(dashboardData.dashboard.name);
        
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
            createdAt: new Date(v.created_at).getTime(),
            updatedAt: new Date(v.updated_at).getTime(),
            chartsCount: Number(v.charts_count ?? v.chartsCount ?? 0),
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

    try {
      const response = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newViewName,
          description: newViewDesc,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.view) {
        const newView: View = {
          id: data.view.id.toString(),
          name: data.view.name,
          slug: data.view.slug,
          description: data.view.description || '',
          createdAt: new Date(data.view.created_at).getTime(),
          updatedAt: new Date(data.view.updated_at).getTime(),
          chartsCount: 0,
        };
        
        setViews([...views, newView]);
        setNewViewName('');
        setNewViewDesc('');
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

  const handleEditStart = (view: View) => {
    setEditingView(view);
    setNewViewName(view.name);
    setNewViewDesc(view.description);
    setOpenCreateDialog(true);
    setAnchorEl(null);
  };

  const handleEditSave = async () => {
    if (!newViewName.trim() || !editingView || !dashboardSlug) return;

    try {
      const response = await fetch(`${API_BASE}/dashboards/${dashboardSlug}/views/${editingView.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newViewName,
          description: newViewDesc,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.view) {
        setViews(
          views.map((v) =>
            v.id === editingView.id
              ? { 
                  ...v, 
                  name: data.view.name, 
                  slug: data.view.slug,
                  description: data.view.description || '', 
                  updatedAt: new Date(data.view.updated_at).getTime() 
                }
              : v
          )
        );

        if (selectedView?.id === editingView.id) {
          setSelectedView({ 
            ...editingView, 
            name: data.view.name, 
            slug: data.view.slug,
            description: data.view.description || '' 
          });
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
    navigate(`/${dashboardSlug}/${viewSlug}`);
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
        p: 2.5,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${alpha(color, 0.08)} 0%, ${alpha(color, 0.03)} 100%)`,
        border: `1px solid ${alpha(color, 0.15)}`,
        transition: 'all 0.3s ease',
        cursor: 'default',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: `0 8px 24px ${alpha(color, 0.15)}`,
          border: `1px solid ${alpha(color, 0.3)}`,
        },
      }}
    >
      <Box display="flex" alignItems="center" gap={2}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2.5,
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
          <Typography variant="h4" fontWeight={700} sx={{ color, lineHeight: 1.2 }}>
            {value}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            {label}
          </Typography>
        </Box>
      </Box>
    </Paper>
  );

  const ViewCard = ({ view, index }: { view: View; index: number }) => {
    const iconColors = ['#667eea', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const iconColor = iconColors[index % iconColors.length];
    
    return (
      <Zoom in={true} style={{ transitionDelay: `${index * 50}ms` }}>
        <Card
          sx={{
            height: '100%',
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
            border: `1px solid ${alpha('#667eea', selectedView?.id === view.id ? 0.4 : 0.12)}`,
            boxShadow: selectedView?.id === view.id 
              ? `0 8px 32px ${alpha('#667eea', 0.2)}`
              : '0 2px 12px rgba(0,0,0,0.04)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'pointer',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: `0 12px 40px ${alpha('#667eea', 0.18)}`,
              border: `1px solid ${alpha('#667eea', 0.3)}`,
              '& .card-actions': {
                opacity: 1,
              },
              '& .card-icon': {
                transform: 'scale(1.1) rotate(5deg)',
              },
            },
          }}
          onClick={() => handleViewClick(view)}
        >
          {/* Top gradient bar */}
          <Box
            sx={{
              height: 4,
              background: favorites.has(view.id)
                ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
                : `linear-gradient(90deg, ${iconColor} 0%, ${alpha(iconColor, 0.7)} 100%)`,
            }}
          />

          {/* Icon Section */}
          <Box
            sx={{
              height: 120,
              background: `linear-gradient(135deg, ${alpha(iconColor, 0.08)} 0%, ${alpha(iconColor, 0.03)} 100%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <ViewModuleIcon 
              className="card-icon"
              sx={{ 
                fontSize: 56, 
                color: iconColor, 
                opacity: 0.6,
                transition: 'all 0.4s ease',
              }} 
            />
            
            {/* Action buttons */}
            <Box
              className="card-actions"
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                opacity: 0,
                transition: 'opacity 0.2s ease',
                display: 'flex',
                gap: 0.5,
              }}
            >
              <Tooltip title={favorites.has(view.id) ? "Remove from favorites" : "Add to favorites"}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.9)',
                    color: favorites.has(view.id) ? '#f59e0b' : alpha('#667eea', 0.5),
                    '&:hover': { bgcolor: 'white' },
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  {favorites.has(view.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="More options">
                <IconButton
                  size="small"
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    setMenuView(view); 
                    setAnchorEl(e.currentTarget); 
                    setMenuPosition({ top: e.clientY, left: e.clientX });
                  }}
                  sx={{ 
                    bgcolor: 'rgba(255,255,255,0.9)',
                    color: alpha('#667eea', 0.6),
                    '&:hover': { bgcolor: 'white' },
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Open badge on hover */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                left: '50%',
                transform: 'translateX(-50%)',
                bgcolor: 'white',
                borderRadius: 2,
                px: 2,
                py: 0.75,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                border: `1px solid ${alpha('#667eea', 0.15)}`,
                opacity: 0,
                transition: 'opacity 0.2s ease',
                '.MuiCard-root:hover &': {
                  opacity: 1,
                },
              }}
            >
              <Typography variant="caption" fontWeight={700} sx={{ color: '#667eea' }}>
                Click to open
              </Typography>
              <ChevronRightIcon sx={{ fontSize: 14, color: '#667eea' }} />
            </Box>
          </Box>

          <CardContent sx={{ p: 2.5, pb: '16px !important' }}>
            <Box display="flex" alignItems="start" justifyContent="space-between" mb={1}>
              <Typography 
                variant="subtitle1" 
                fontWeight={700} 
                sx={{ 
                  color: '#1e293b',
                  lineHeight: 1.3,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {view.name}
                {favorites.has(view.id) && (
                  <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                )}
              </Typography>
            </Box>

            {view.description && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary',
                  mb: 2,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  lineHeight: 1.5,
                  minHeight: 42,
                }}
              >
                {view.description}
              </Typography>
            )}

            <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
              <Chip
                size="small"
                icon={<BarChartIcon sx={{ fontSize: 14 }} />}
                label={`${view.chartsCount} charts`}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  bgcolor: alpha('#667eea', 0.08),
                  color: '#667eea',
                  border: `1px solid ${alpha('#667eea', 0.15)}`,
                  '& .MuiChip-icon': { color: '#667eea' },
                }}
              />
              <Chip
                size="small"
                icon={<AccessTimeIcon sx={{ fontSize: 12 }} />}
                label={getTimeAgo(view.updatedAt)}
                sx={{
                  height: 24,
                  fontSize: '0.7rem',
                  fontWeight: 500,
                  bgcolor: alpha('#64748b', 0.06),
                  color: '#64748b',
                  '& .MuiChip-icon': { color: '#94a3b8' },
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Zoom>
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
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        }}
      >
        <CircularProgress size={60} sx={{ mb: 2, color: '#667eea' }} />
        <Typography variant="h6" color="text.secondary">
          Loading dashboard...
        </Typography>
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative background elements */}
      <Box
        sx={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#667eea', 0.08)} 0%, transparent 70%)`,
          top: -150,
          right: -150,
          pointerEvents: 'none',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${alpha('#764ba2', 0.06)} 0%, transparent 70%)`,
          bottom: -100,
          left: -100,
          pointerEvents: 'none',
        }}
      />

      {/* Top Navigation Bar */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px 0 rgba(102, 126, 234, 0.25)',
        }}
      >
        <Toolbar sx={{ py: 1.5, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Tooltip title="Back to Dashboards" arrow>
              <IconButton 
                onClick={() => navigate('/')} 
                sx={{ 
                  color: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(10px)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.25)',
                  },
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            
            <Box
              sx={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: 2.5,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
              }}
            >
              <LayersIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            
            <Box>
              <Breadcrumbs 
                separator={<ChevronRightIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.6)' }} />}
              >
                <Link
                  underline="hover"
                  onClick={() => navigate('/')}
                  sx={{ 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.8)',
                    fontSize: '0.875rem',
                    '&:hover': { color: 'white' },
                  }}
                >
                  Dashboards
                </Link>
                <Typography fontWeight={700} sx={{ color: 'white', fontSize: '0.875rem' }}>
                  {dashboardName}
                </Typography>
              </Breadcrumbs>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
                Manage views and analytics
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditingView(null); setNewViewName(''); setNewViewDesc(''); setOpenCreateDialog(true); }}
            sx={{
              background: 'rgba(255,255,255,0.95)',
              color: '#667eea',
              textTransform: 'none',
              fontWeight: 700,
              px: 3,
              py: 1,
              borderRadius: 2.5,
              boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              '&:hover': {
                background: 'white',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            New View
          </Button>

          {/* User Menu */}
          <Box sx={{ ml: 2 }}>
            <Tooltip title={auth.email || 'User'}>
              <IconButton
                onClick={(e) => setUserMenuAnchor(e.currentTarget)}
                sx={{
                  p: 0.5,
                  background: 'rgba(255,255,255,0.15)',
                  border: '2px solid rgba(255,255,255,0.3)',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.25)',
                    border: '2px solid rgba(255,255,255,0.5)',
                  },
                }}
              >
                <Avatar
                  sx={{
                    width: 36,
                    height: 36,
                    bgcolor: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                  }}
                >
                  {auth.email ? auth.email[0].toUpperCase() : 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
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
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                },
              }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <EmailIcon sx={{ fontSize: 16, color: '#667eea' }} />
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
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content with Sidebar */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative', zIndex: 1 }}>
        {/* Left Navigation Sidebar */}
        <Paper
          elevation={0}
          sx={{
            width: 240,
            flexShrink: 0,
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
            borderRight: `1px solid ${alpha('#667eea', 0.1)}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          

          {/* Nav Items */}
          <List sx={{ flex: 1, p: 1.5, mt:1.5 }}>
            {/* Back to Dashboards */}
            <ListItem disablePadding sx={{ mb: 1.5 }}>
              <ListItemButton
                onClick={() => navigate('/')}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  bgcolor: alpha('#64748b', 0.05),
                  '&:hover': { bgcolor: alpha('#64748b', 0.1) },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ArrowBackIcon sx={{ fontSize: 20, color: '#64748b' }} />
                </ListItemIcon>
                <ListItemText 
                  primary="All Dashboards" 
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600, color: '#64748b' }}
                />
              </ListItemButton>
            </ListItem>

            <Divider sx={{ my: 1.5 }} />

            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeNav === 'all'}
                onClick={() => setActiveNav('all')}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  '&.Mui-selected': {
                    bgcolor: alpha('#667eea', 0.1),
                    '& .MuiListItemIcon-root': { color: '#667eea' },
                    '& .MuiListItemText-primary': { color: '#667eea', fontWeight: 700 },
                    '&:hover': { bgcolor: alpha('#667eea', 0.15) },
                  },
                  '&:hover': { bgcolor: alpha('#667eea', 0.05) },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <ViewModuleIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary="All Views" 
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <Chip 
                  label={views.length} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    bgcolor: activeNav === 'all' ? alpha('#667eea', 0.15) : alpha('#64748b', 0.1),
                    color: activeNav === 'all' ? '#667eea' : '#64748b',
                  }} 
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeNav === 'favorites'}
                onClick={() => setActiveNav('favorites')}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  '&.Mui-selected': {
                    bgcolor: alpha('#f59e0b', 0.1),
                    '& .MuiListItemIcon-root': { color: '#f59e0b' },
                    '& .MuiListItemText-primary': { color: '#f59e0b', fontWeight: 700 },
                    '&:hover': { bgcolor: alpha('#f59e0b', 0.15) },
                  },
                  '&:hover': { bgcolor: alpha('#f59e0b', 0.05) },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <StarIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Favorites" 
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <Chip 
                  label={favorites.size} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    bgcolor: activeNav === 'favorites' ? alpha('#f59e0b', 0.15) : alpha('#64748b', 0.1),
                    color: activeNav === 'favorites' ? '#f59e0b' : '#64748b',
                  }} 
                />
              </ListItemButton>
            </ListItem>

            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeNav === 'recent'}
                onClick={() => setActiveNav('recent')}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  '&.Mui-selected': {
                    bgcolor: alpha('#10b981', 0.1),
                    '& .MuiListItemIcon-root': { color: '#10b981' },
                    '& .MuiListItemText-primary': { color: '#10b981', fontWeight: 700 },
                    '&:hover': { bgcolor: alpha('#10b981', 0.15) },
                  },
                  '&:hover': { bgcolor: alpha('#10b981', 0.05) },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <HistoryIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Recent" 
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <Chip 
                  label={stats.recentlyUpdated} 
                  size="small" 
                  sx={{ 
                    height: 20, 
                    fontSize: '0.7rem', 
                    fontWeight: 700,
                    bgcolor: activeNav === 'recent' ? alpha('#10b981', 0.15) : alpha('#64748b', 0.1),
                    color: activeNav === 'recent' ? '#10b981' : '#64748b',
                  }} 
                />
              </ListItemButton>
            </ListItem>

            {/* Divider */}
            <Divider sx={{ my: 2, mx: 1, borderColor: alpha('#667eea', 0.1) }} />

            {/* Data & Connections */}
            <ListItem disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={activeNav === 'dataConnections'}
                onClick={() => setActiveNav('dataConnections')}
                sx={{
                  borderRadius: 2,
                  py: 1.25,
                  bgcolor: activeNav === 'dataConnections' 
                    ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(102, 126, 234, 0.15) 100%)'
                    : alpha('#4facfe', 0.06),
                  border: `1px solid ${activeNav === 'dataConnections' ? alpha('#4facfe', 0.3) : alpha('#4facfe', 0.1)}`,
                  '&.Mui-selected': {
                    background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.15) 0%, rgba(102, 126, 234, 0.15) 100%)',
                    '& .MuiListItemIcon-root': { color: '#4facfe' },
                    '& .MuiListItemText-primary': { color: '#4facfe', fontWeight: 700 },
                    '&:hover': { 
                      background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.2) 0%, rgba(102, 126, 234, 0.2) 100%)',
                    },
                  },
                  '&:hover': { 
                    bgcolor: alpha('#4facfe', 0.1),
                    borderColor: alpha('#4facfe', 0.2),
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, color: activeNav === 'dataConnections' ? '#4facfe' : '#64748b' }}>
                  <StorageIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary="Data & Connections" 
                  primaryTypographyProps={{ 
                    fontSize: '0.875rem', 
                    fontWeight: 600,
                    color: activeNav === 'dataConnections' ? '#4facfe' : 'inherit',
                  }}
                />
              </ListItemButton>
            </ListItem>
          </List>

          {/* Help Section */}
          <Box sx={{ p: 2, borderTop: `1px solid ${alpha('#667eea', 0.08)}`, mt: 'auto' }}>
            <Box 
              sx={{ 
                p: 2, 
                borderRadius: 2, 
                background: `linear-gradient(135deg, ${alpha('#667eea', 0.05)} 0%, ${alpha('#764ba2', 0.05)} 100%)`,
                border: `1px solid ${alpha('#667eea', 0.1)}`,
              }}
            >
              <Box display="flex" alignItems="center" gap={1} mb={1}>
                <HelpIcon sx={{ fontSize: 18, color: '#667eea' }} />
                <Typography variant="caption" fontWeight={700} sx={{ color: '#667eea' }}>
                  Quick Tip
                </Typography>
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.5 }}>
                Click on any view card to open the chart editor.
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Right Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 3, gap: 3 }}>
          
          {/* Data & Connections Panel */}
          {activeNav === 'dataConnections' ? (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Tabs Card */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.98)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${alpha('#667eea', 0.12)}`,
                  boxShadow: '0 8px 40px rgba(102, 126, 234, 0.08)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Centered Tab Headers with Underline Style */}
                <Box 
                  sx={{ 
                    borderBottom: `1px solid ${alpha('#667eea', 0.1)}`,
                    background: 'rgba(255,255,255,1)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 4, pt: 2 }}>
                    <Box
                      onClick={() => setDataTabIndex(0)}
                      sx={{
                        position: 'relative',
                        pb: 1.5,
                        px: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: dataTabIndex === 0 ? '#667eea' : '#64748b',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          color: dataTabIndex === 0 ? '#667eea' : '#4facfe',
                        },
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          borderRadius: '3px 3px 0 0',
                          background: dataTabIndex === 0 
                            ? 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)'
                            : 'transparent',
                          transition: 'all 0.3s ease',
                        },
                      }}
                    >
                      <CloudQueueIcon sx={{ fontSize: 20 }} />
                      Data Sources
                    </Box>
                    <Box
                      onClick={() => setDataTabIndex(1)}
                      sx={{
                        position: 'relative',
                        pb: 1.5,
                        px: 2,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        color: dataTabIndex === 1 ? '#667eea' : '#64748b',
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          color: dataTabIndex === 1 ? '#667eea' : '#764ba2',
                        },
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: 3,
                          borderRadius: '3px 3px 0 0',
                          background: dataTabIndex === 1 
                            ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)'
                            : 'transparent',
                          transition: 'all 0.3s ease',
                        },
                      }}
                    >
                      <SnowflakeIcon sx={{ fontSize: 20 }} />
                      Connections
                    </Box>
                  </Box>
                </Box>

                {/* Tab Content */}
                <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
                  {dataTabIndex === 0 && <AddDataSource />}
                  {dataTabIndex === 1 && <SnowflakeConnector />}
                </Box>
              </Paper>
            </Box>
          ) : (
          <>
          {/* Stats Row */}
          <Grid container spacing={2}>
          <Grid size={{xs:6, sm:3}}>
            <StatCard
              icon={<ViewModuleIcon sx={{ color: 'white', fontSize: 24 }} />}
              label="Total Views"
              value={stats.total}
              color="#667eea"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid>
          <Grid size={{xs:6, sm:3}}>
            <StatCard
              icon={<BarChartIcon sx={{ color: 'white', fontSize: 24 }} />}
              label="Total Charts"
              value={stats.totalCharts}
              color="#10b981"
              gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
            />
          </Grid>
          <Grid size={{xs:6, sm:3}}>
            <StatCard
              icon={<TrendingUpIcon sx={{ color: 'white', fontSize: 24 }} />}
              label="Recently Updated"
              value={stats.recentlyUpdated}
              color="#f59e0b"
              gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
            />
          </Grid>
          <Grid size={{xs:6, sm:3}}>
            <StatCard
              icon={<StarIcon sx={{ color: 'white', fontSize: 24 }} />}
              label="Favorites"
              value={stats.favorites}
              color="#ef4444"
              gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
            />
          </Grid>
        </Grid>

        {/* Search and Filters Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 2,
            borderRadius: 3,
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha('#667eea', 0.1)}`,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
            <TextField
              placeholder="Search views..."
              size="small"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{
                flex: 1,
                minWidth: 250,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  bgcolor: alpha('#667eea', 0.03),
                  '& fieldset': { borderColor: alpha('#667eea', 0.15) },
                  '&:hover fieldset': { borderColor: alpha('#667eea', 0.3) },
                  '&.Mui-focused fieldset': { borderColor: '#667eea' },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: alpha('#667eea', 0.5), fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Sort:
              </Typography>
              <ToggleButtonGroup
                value={sortBy}
                exclusive
                onChange={(_, value) => value && setSortBy(value)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: `1px solid ${alpha('#667eea', 0.2)}`,
                    color: '#64748b',
                    textTransform: 'none',
                    px: 1.5,
                    py: 0.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    '&.Mui-selected': {
                      bgcolor: alpha('#667eea', 0.1),
                      color: '#667eea',
                      borderColor: alpha('#667eea', 0.3),
                      '&:hover': {
                        bgcolor: alpha('#667eea', 0.15),
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="updated">Recent</ToggleButton>
                <ToggleButton value="name">Name</ToggleButton>
                <ToggleButton value="created">Created</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                View:
              </Typography>
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={(_, value) => value && setViewMode(value)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: `1px solid ${alpha('#667eea', 0.2)}`,
                    color: '#64748b',
                    px: 1,
                    '&.Mui-selected': {
                      bgcolor: alpha('#667eea', 0.1),
                      color: '#667eea',
                      borderColor: alpha('#667eea', 0.3),
                    },
                  },
                }}
              >
                <ToggleButton value="grid"><GridViewIcon fontSize="small" /></ToggleButton>
                <ToggleButton value="list"><ViewListIcon fontSize="small" /></ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Box sx={{ ml: 'auto' }}>
              <Chip
                label={`${filteredViews.length} view${filteredViews.length !== 1 ? 's' : ''}`}
                size="small"
                sx={{
                  bgcolor: alpha('#667eea', 0.08),
                  color: '#667eea',
                  fontWeight: 600,
                  border: `1px solid ${alpha('#667eea', 0.15)}`,
                }}
              />
            </Box>
          </Box>
        </Paper>

        {/* Views Grid/List */}
        <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
          {filteredViews.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                background: 'rgba(255,255,255,0.6)',
                border: `2px dashed ${alpha('#667eea', 0.2)}`,
              }}
            >
              <Box sx={{ textAlign: 'center', maxWidth: 400, p: 4 }}>
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    margin: '0 auto 24px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${alpha('#667eea', 0.1)} 0%, ${alpha('#764ba2', 0.1)} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {searchQuery ? (
                    <SearchIcon sx={{ fontSize: 48, color: alpha('#667eea', 0.4) }} />
                  ) : (
                    <ViewModuleIcon sx={{ fontSize: 48, color: alpha('#667eea', 0.4) }} />
                  )}
                </Box>
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#667eea' }}>
                  {searchQuery ? 'No Results Found' : 
                    activeNav === 'favorites' ? 'No Favorites Yet' :
                    activeNav === 'recent' ? 'No Recent Views' : 'No Views Yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery ? 'Try adjusting your search or filters' :
                    activeNav === 'favorites' ? 'Star views to add them to favorites' :
                    activeNav === 'recent' ? 'Views updated in the last 7 days will appear here' :
                    'Create your first view to start building charts'}
                </Typography>
                {!searchQuery && activeNav === 'all' && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setOpenCreateDialog(true)}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 4,
                      py: 1.5,
                      borderRadius: 2.5,
                      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                    }}
                  >
                    Create View
                  </Button>
                )}
              </Box>
            </Paper>
          ) : viewMode === 'grid' ? (
            <Grid container spacing={2.5}>
              {filteredViews.map((view, index) => (
                <Grid size={{xs:12, sm:6, md:4, lg:3}} key={view.id}>
                  <ViewCard view={view} index={index} />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Paper
              elevation={0}
              sx={{
                borderRadius: 3,
                background: 'rgba(255,255,255,0.95)',
                border: `1px solid ${alpha('#667eea', 0.1)}`,
                overflow: 'hidden',
              }}
            >
              <List disablePadding>
                {filteredViews.map((view, index) => (
                  <React.Fragment key={view.id}>
                    {index > 0 && <Divider />}
                    <ListItemButton
                      selected={selectedView?.id === view.id}
                      onClick={() => handleViewClick(view)}
                      sx={{
                        py: 2,
                        px: 3,
                        '&.Mui-selected': {
                          bgcolor: alpha('#667eea', 0.08),
                          '&:hover': { bgcolor: alpha('#667eea', 0.12) },
                        },
                        '&:hover': { bgcolor: alpha('#667eea', 0.04) },
                      }}
                    >
                      <Box display="flex" alignItems="center" gap={2} width="100%">
                        <Avatar
                          sx={{
                            width: 44,
                            height: 44,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            fontSize: '1rem',
                            fontWeight: 700,
                          }}
                        >
                          {view.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#1e293b' }}>
                              {view.name}
                            </Typography>
                            {favorites.has(view.id) && (
                              <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {view.description || 'No description'}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            size="small"
                            label={`${view.chartsCount} charts`}
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              bgcolor: alpha('#667eea', 0.08),
                              color: '#667eea',
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                            {getTimeAgo(view.updatedAt)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(view.id); }}
                            sx={{ color: favorites.has(view.id) ? '#f59e0b' : '#94a3b8' }}
                          >
                            {favorites.has(view.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setMenuView(view); 
                              setAnchorEl(e.currentTarget); 
                              setMenuPosition({ top: e.clientY, left: e.clientX });
                            }}
                          >
                            <MoreVertIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    </ListItemButton>
                  </React.Fragment>
                ))}
              </List>
            </Paper>
          )}
        </Box>
        </>
        )}

        </Box>
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
            border: `1px solid ${alpha('#667eea', 0.1)}`,
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={() => { if (menuView) handleViewClick(menuView); closeMenu(); }}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Open
        </MenuItem>
        <MenuItem onClick={() => { if (menuView) handleEditStart(menuView); closeMenu(); }}>
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => { if (menuView) toggleFavorite(menuView.id); closeMenu(); }}>
          {menuView && favorites.has(menuView.id) ? (
            <StarIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          ) : (
            <StarBorderIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          )}
          {menuView && favorites.has(menuView.id) ? 'Unfavorite' : 'Favorite'}
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => { if (menuView) handleDeleteClick(menuView); closeMenu(); }} sx={{ color: '#ef4444' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => { setOpenCreateDialog(false); setEditingView(null); setNewViewName(''); setNewViewDesc(''); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            border: `1px solid ${alpha('#667eea', 0.15)}`,
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
              {editingView ? <EditIcon sx={{ color: 'white' }} /> : <AddIcon sx={{ color: 'white' }} />}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {editingView ? 'Edit View' : 'Create New View'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingView ? 'Update view details' : 'Set up your new analytics view'}
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
            sx={{
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
            onClick={() => { setOpenCreateDialog(false); setEditingView(null); setNewViewName(''); setNewViewDesc(''); }}
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
