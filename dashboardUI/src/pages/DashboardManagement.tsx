import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState, useSetRecoilState } from 'recoil';
import { dashboardsManager, Dashboard } from '../recoil/Dashboards';
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
  AppBar,
  Toolbar,
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
} from '@mui/icons-material';
import AddDataSource from '../components/AddDataSource';
import SnowflakeConnector from '../components/SnowflakeConnector';

// API base URL
const API_BASE = 'http://localhost:3002/api';

const DashboardManagement: React.FC = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useRecoilState(dashboardsManager);
  const [auth, setAuth] = useRecoilState(authState);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [newDashboardName, setNewDashboardName] = useState<string>('');
  const [newDashboardDesc, setNewDashboardDesc] = useState<string>('');
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openMigrateDialog, setOpenMigrateDialog] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [migrateDashboardName, setMigrateDashboardName] = useState('');
  const [migrateViewName, setMigrateViewName] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [menuDashboard, setMenuDashboard] = useState<Dashboard | null>(null);
  const [activeNav, setActiveNav] = useState<'all' | 'favorites' | 'recent' | 'dataConnections'>('all');
  const [dataTabIndex, setDataTabIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const dashIdRef = useRef(1);

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

  // Fetch favorites from backend
  const fetchFavorites = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/favorites/dashboards`);
      const data = await response.json();
      if (data.success && data.favoriteIds) {
        setFavorites(new Set(data.favoriteIds));
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
        if (data.dashboards.length > 0) {
          const d0 = data.dashboards[0];
          console.log('📥 [Dashboards] sample fields', {
            charts_count: d0.charts_count,
            chartsCount: d0.chartsCount,
            views_count: d0.views_count,
            viewsCount: d0.viewsCount,
          });
        }
        const mappedDashboards: Dashboard[] = data.dashboards.map((d: any) => {
          const rawCharts = d.charts_count ?? d.chartsCount ?? 0;
          const rawViews = d.views_count ?? d.viewsCount ?? 0;
          return {
          id: d.id.toString(),
          name: d.name,
          slug: d.slug,
          description: d.description || '',
          thumbnail: '',
          createdAt: new Date(d.created_at).getTime(),
          updatedAt: new Date(d.updated_at).getTime(),
          chartsCount: Number(rawCharts),
          viewsCount: Number(rawViews),
          icon: d.icon,
          color: d.color,
        };
        });
        setDashboards(mappedDashboards);
        console.log('📊 [Dashboards] mapped totals', {
          totalDashboards: mappedDashboards.length,
          totalCharts: mappedDashboards.reduce((acc, d) => acc + (d.chartsCount || 0), 0),
          sample: mappedDashboards.slice(0, 3).map(d => ({ name: d.name, chartsCount: d.chartsCount, viewsCount: d.viewsCount })),
        });
        
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

  // Filter and sort dashboards
  const filteredDashboards = useMemo(() => {
    let result = [...dashboards];
    
    // Nav filter
    if (activeNav === 'favorites') {
      result = result.filter(d => favorites.has(d.id));
    } else if (activeNav === 'recent') {
      result = result.filter(d => Date.now() - d.updatedAt < 7 * 24 * 60 * 60 * 1000);
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
    
    // Favorites first (only in 'all' view)
    if (activeNav === 'all') {
      result.sort((a, b) => {
        const aFav = favorites.has(a.id) ? 1 : 0;
        const bFav = favorites.has(b.id) ? 1 : 0;
        return bFav - aFav;
      });
    }
    
    return result;
  }, [dashboards, searchQuery, sortBy, favorites, activeNav]);

  // Stats
  const stats = useMemo(() => ({
    total: dashboards.length,
    totalCharts: dashboards.reduce((acc, d) => acc + (d.chartsCount || 0), 0),
    recentlyUpdated: dashboards.filter(d => Date.now() - d.updatedAt < 7 * 24 * 60 * 60 * 1000).length,
    favorites: favorites.size,
  }), [dashboards, favorites]);

  // Create new dashboard
  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/dashboards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newDashboardName,
          description: newDashboardDesc,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.dashboard) {
        const newDashboard: Dashboard = {
          id: data.dashboard.id.toString(),
          name: data.dashboard.name,
          slug: data.dashboard.slug,
          description: data.dashboard.description || '',
          thumbnail: '',
          createdAt: new Date(data.dashboard.created_at).getTime(),
          updatedAt: new Date(data.dashboard.updated_at).getTime(),
          chartsCount: 0,
        };
        
        setDashboards([...dashboards, newDashboard]);
        setNewDashboardName('');
        setNewDashboardDesc('');
        setOpenCreateDialog(false);
        setSelectedDashboard(newDashboard);
      } else {
        console.error('Failed to create dashboard:', data.error);
        alert(data.error || 'Failed to create dashboard');
      }
    } catch (err) {
      console.error('Error creating dashboard:', err);
      alert('Error creating dashboard');
    }
  };

  // Edit dashboard
  const handleEditStart = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setEditName(dashboard.name);
    setEditDesc(dashboard.description || '');
    setOpenCreateDialog(true);
    setAnchorEl(null);
  };

  const handleEditSave = async () => {
    if (!editName.trim() || !editingDashboard) return;

    try {
      const response = await fetch(`${API_BASE}/dashboards/${editingDashboard.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          description: editDesc,
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.dashboard) {
        setDashboards(
          dashboards.map((d) =>
            d.id === editingDashboard.id
              ? { 
                  ...d, 
                  name: data.dashboard.name, 
                  slug: data.dashboard.slug,
                  description: data.dashboard.description || '', 
                  updatedAt: new Date(data.dashboard.updated_at).getTime() 
                }
              : d
          )
        );

        if (selectedDashboard?.id === editingDashboard.id) {
          setSelectedDashboard({ 
            ...editingDashboard, 
            name: data.dashboard.name, 
            slug: data.dashboard.slug,
            description: data.dashboard.description || '' 
          });
        }
      } else {
        console.error('Failed to update dashboard:', data.error);
        alert(data.error || 'Failed to update dashboard');
      }
    } catch (err) {
      console.error('Error updating dashboard:', err);
      alert('Error updating dashboard');
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
        if (selectedDashboard?.id === deletingDashboard.id) {
          setSelectedDashboard(null);
        }
        // Remove from favorites (if favorited)
        if (favorites.has(deletingDashboard.id)) {
          try {
            await fetch(`${API_BASE}/favorites/dashboards/${deletingDashboard.id}`, { method: 'DELETE' });
            const newFavorites = new Set(favorites);
            newFavorites.delete(deletingDashboard.id);
            setFavorites(newFavorites);
          } catch (err) {
            console.error('Error removing from favorites:', err);
          }
        }
      } else {
        console.error('Failed to delete dashboard:', data.error);
        alert(data.error || 'Failed to delete dashboard');
      }
    } catch (err) {
      console.error('Error deleting dashboard:', err);
      alert('Error deleting dashboard');
    }
    
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
  };

  // Use slug from dashboard if available, otherwise generate from name
  const handleDashboardClick = (dashboard: Dashboard) => {
    const slug = (dashboard as any).slug || dashboard.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    navigate(`/${slug}`);
  };

  // Migration handler - migrate existing data to new hierarchy
  const handleMigrate = async () => {
    if (!migrateDashboardName.trim() || !migrateViewName.trim()) return;
    
    try {
      setIsMigrating(true);
      const response = await fetch(`${API_BASE}/migrate-to-hierarchy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardName: migrateDashboardName,
          viewName: migrateViewName,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Migration successful!\n\nDashboard: ${migrateDashboardName}\nView: ${migrateViewName}\n\nYou can now access your data at:\n/${data.dashboardSlug}/${data.viewSlug}`);
        setOpenMigrateDialog(false);
        setMigrateDashboardName('');
        setMigrateViewName('');
        // Refresh dashboards list
        fetchDashboards();
      } else {
        alert(data.error || 'Migration failed');
      }
    } catch (err) {
      console.error('Migration error:', err);
      alert('Error during migration');
    } finally {
      setIsMigrating(false);
    }
  };

  const toggleFavorite = async (id: string) => {
    const newFavorites = new Set(favorites);
    const isFavorite = newFavorites.has(id);
    
    try {
      if (isFavorite) {
        // Remove from favorites
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'DELETE' });
        newFavorites.delete(id);
      } else {
        // Add to favorites
        await fetch(`${API_BASE}/favorites/dashboards/${id}`, { method: 'POST' });
        newFavorites.add(id);
      }
      setFavorites(newFavorites);
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

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

  const DashboardCard = ({ dashboard, index }: { dashboard: Dashboard; index: number }) => (
    <Zoom in={true} style={{ transitionDelay: `${index * 50}ms` }}>
      <Card
        sx={{
          height: '100%',
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
          border: `1px solid ${alpha('#667eea', selectedDashboard?.id === dashboard.id ? 0.4 : 0.12)}`,
          boxShadow: selectedDashboard?.id === dashboard.id 
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
            '& .card-gradient': {
              opacity: 1,
            },
          },
        }}
        onClick={() => handleDashboardClick(dashboard)}
      >
        {/* Top gradient bar */}
        <Box
          sx={{
            height: 4,
            background: favorites.has(dashboard.id)
              ? 'linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)'
              : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          }}
        />
        
        {/* Hover gradient overlay */}
        <Box
          className="card-gradient"
          sx={{
            position: 'absolute',
            top: 4,
            left: 0,
            right: 0,
            height: 80,
            background: `linear-gradient(180deg, ${alpha('#667eea', 0.05)} 0%, transparent 100%)`,
            opacity: 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: 'none',
          }}
        />

        <CardContent sx={{ p: 2.5, pb: '16px !important' }}>
          <Box display="flex" alignItems="start" justifyContent="space-between" mb={2}>
            <Box display="flex" alignItems="center" gap={1.5}>
              <Avatar
                sx={{
                  width: 40,
                  height: 40,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                {dashboard.name.charAt(0).toUpperCase()}
              </Avatar>
              <Box>
                <Typography 
                  variant="subtitle1" 
                  fontWeight={700} 
                  sx={{ 
                    color: '#1e293b',
                    lineHeight: 1.3,
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {dashboard.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {getTimeAgo(dashboard.updatedAt)}
                </Typography>
              </Box>
            </Box>
            
            <Box className="card-actions" sx={{ opacity: 0, transition: 'opacity 0.2s ease', display: 'flex', gap: 0.5 }}>
              <Tooltip title={favorites.has(dashboard.id) ? "Remove from favorites" : "Add to favorites"}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(dashboard.id); }}
                  sx={{ 
                    color: favorites.has(dashboard.id) ? '#f59e0b' : alpha('#667eea', 0.5),
                    '&:hover': { bgcolor: alpha('#f59e0b', 0.1) },
                  }}
                >
                  {favorites.has(dashboard.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="More options">
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuDashboard(dashboard);
                    setAnchorEl(e.currentTarget);
                    setMenuPosition({ top: e.clientY, left: e.clientX });
                  }}
                  sx={{ color: alpha('#667eea', 0.6) }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {dashboard.description && (
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
              {dashboard.description}
            </Typography>
          )}

          <Box display="flex" alignItems="center" gap={1} flexWrap="wrap">
            <Chip
              size="small"
              icon={<BarChartIcon sx={{ fontSize: 14 }} />}
              label={`${dashboard.chartsCount || 0} charts`}
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
              icon={<CalendarTodayIcon sx={{ fontSize: 12 }} />}
              label={formatDate(dashboard.createdAt)}
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

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
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
          <div 
                className="flex items-center justify-center w-12 h-12 rounded-xl shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)',
                }}
              >
                <img src="RBI.png" alt="Logo" className="h-8 w-8" />
              </div>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: 'white', letterSpacing: '-0.3px' }}>
                Report Builder Intelligence
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                Enterprise Analytics Platform
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setEditingDashboard(null); setNewDashboardName(''); setNewDashboardDesc(''); setOpenCreateDialog(true); }}
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
            New Dashboard
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
          <List sx={{ flex: 1, p: 1.5 }}>
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
                  <LayersIcon sx={{ fontSize: 20 }} />
                </ListItemIcon>
                <ListItemText 
                  primary="All Dashboards" 
                  primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: 600 }}
                />
                <Chip 
                  label={dashboards.length} 
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

            {/* Data & Connections - Always has background */}
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
                Click on any dashboard card to open it directly.
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
              icon={<LayersIcon sx={{ color: 'white', fontSize: 24 }} />}
              label="Total Dashboards"
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
              placeholder="Search dashboards..."
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
                label={`${filteredDashboards.length} dashboard${filteredDashboards.length !== 1 ? 's' : ''}`}
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

        {/* Dashboards Grid/List */}
        <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <CircularProgress sx={{ color: '#667eea' }} />
            </Box>
          ) : filteredDashboards.length === 0 ? (
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
                    <FolderOpenIcon sx={{ fontSize: 48, color: alpha('#667eea', 0.4) }} />
                  )}
                </Box>
                <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#667eea' }}>
                  {searchQuery ? 'No Results Found' : 
                    activeNav === 'favorites' ? 'No Favorites Yet' :
                    activeNav === 'recent' ? 'No Recent Dashboards' : 'No Dashboards Yet'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery ? 'Try adjusting your search or filters' :
                    activeNav === 'favorites' ? 'Star dashboards to add them to favorites' :
                    activeNav === 'recent' ? 'Dashboards updated in the last 7 days will appear here' :
                    'Create your first dashboard to get started with analytics'}
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
                    Create Dashboard
                  </Button>
                )}
              </Box>
            </Paper>
          ) : viewMode === 'grid' ? (
            <Grid container spacing={2.5}>
              {filteredDashboards.map((dashboard, index) => (
                <Grid size={{xs:12, sm:6, md:4, lg:3}} key={dashboard.id}>
                  <DashboardCard dashboard={dashboard} index={index} />
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
                {filteredDashboards.map((dashboard, index) => (
                  <React.Fragment key={dashboard.id}>
                    {index > 0 && <Divider />}
                    <ListItemButton
                      selected={selectedDashboard?.id === dashboard.id}
                      onClick={() => handleDashboardClick(dashboard)}
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
                          {dashboard.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box flex={1}>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#1e293b' }}>
                              {dashboard.name}
                            </Typography>
                            {favorites.has(dashboard.id) && (
                              <StarIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            {dashboard.description || 'No description'}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Chip
                            size="small"
                            label={`${dashboard.chartsCount || 0} charts`}
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              bgcolor: alpha('#667eea', 0.08),
                              color: '#667eea',
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', minWidth: 80 }}>
                            {getTimeAgo(dashboard.updatedAt)}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(dashboard.id); }}
                            sx={{ color: favorites.has(dashboard.id) ? '#f59e0b' : '#94a3b8' }}
                          >
                            {favorites.has(dashboard.id) ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuDashboard(dashboard);
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
            border: `1px solid ${alpha('#667eea', 0.1)}`,
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={() => { if (menuDashboard) handleDashboardClick(menuDashboard); closeMenu(); }}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Open
        </MenuItem>
        <MenuItem onClick={() => { if (menuDashboard) handleEditStart(menuDashboard); closeMenu(); }}>
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => { if (menuDashboard) toggleFavorite(menuDashboard.id); closeMenu(); }}>
          {menuDashboard && favorites.has(menuDashboard.id) ? (
            <StarIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          ) : (
            <StarBorderIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          )}
          {menuDashboard && favorites.has(menuDashboard.id) ? 'Unfavorite' : 'Favorite'}
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => { if (menuDashboard) handleDeleteClick(menuDashboard); closeMenu(); }} sx={{ color: '#ef4444' }}>
          <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => { setOpenCreateDialog(false); setEditingDashboard(null); }}
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
              {editingDashboard ? <EditIcon sx={{ color: 'white' }} /> : <AddIcon sx={{ color: 'white' }} />}
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                {editingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {editingDashboard ? 'Update dashboard details' : 'Set up your new analytics workspace'}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <TextField
            autoFocus
            label="Dashboard Name"
            fullWidth
            required
            value={editingDashboard ? editName : newDashboardName}
            onChange={(e) => editingDashboard ? setEditName(e.target.value) : setNewDashboardName(e.target.value)}
            placeholder="e.g., Sales Analytics, Marketing KPIs"
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
            value={editingDashboard ? editDesc : newDashboardDesc}
            onChange={(e) => editingDashboard ? setEditDesc(e.target.value) : setNewDashboardDesc(e.target.value)}
            placeholder="Describe what this dashboard will display..."
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
            onClick={() => { setOpenCreateDialog(false); setEditingDashboard(null); }}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={editingDashboard ? handleEditSave : handleCreateDashboard}
            disabled={editingDashboard ? !editName.trim() : !newDashboardName.trim()}
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
            {editingDashboard ? 'Save Changes' : 'Create Dashboard'}
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
            <Typography variant="h6" fontWeight={700}>Delete Dashboard</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#667eea' }}>"{deletingDashboard?.name}"</strong>?
            This will permanently remove all associated views and charts.
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
            Delete Dashboard
          </Button>
        </DialogActions>
      </Dialog>

      {/* Migration Dialog */}
      <Dialog
        open={openMigrateDialog}
        onClose={() => setOpenMigrateDialog(false)}
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
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              }}
            >
              <TrendingUpIcon sx={{ color: 'white' }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={700}>
                Migrate Existing Data
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Move your current dashboard data to the new hierarchy structure
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ 
            p: 2, 
            mb: 3, 
            borderRadius: 2, 
            bgcolor: alpha('#f59e0b', 0.1),
            border: `1px solid ${alpha('#f59e0b', 0.2)}`,
          }}>
            <Typography variant="body2" sx={{ color: '#b45309' }}>
              <strong>Note:</strong> This will move all existing configurations (charts, layouts, filters, parameters, calculations) 
              that don't have a dashboard/view assigned to the new dashboard and view you specify below.
            </Typography>
          </Box>
          <TextField
            autoFocus
            label="Dashboard Name"
            fullWidth
            required
            value={migrateDashboardName}
            onChange={(e) => setMigrateDashboardName(e.target.value)}
            placeholder="e.g., MSL Dashboard"
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
            helperText="The dashboard to migrate data into (will be created if it doesn't exist)"
          />
          <TextField
            label="View Name"
            fullWidth
            required
            value={migrateViewName}
            onChange={(e) => setMigrateViewName(e.target.value)}
            placeholder="e.g., Patient View"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
                '& fieldset': { borderColor: alpha('#667eea', 0.2) },
                '&:hover fieldset': { borderColor: alpha('#667eea', 0.4) },
                '&.Mui-focused fieldset': { borderColor: '#667eea' },
              },
              '& .MuiInputLabel-root.Mui-focused': { color: '#667eea' },
            }}
            helperText="The view within the dashboard to assign chart configs and layouts to"
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setOpenMigrateDialog(false)}
            disabled={isMigrating}
            sx={{ textTransform: 'none', fontWeight: 600, color: 'text.secondary' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleMigrate}
            disabled={!migrateDashboardName.trim() || !migrateViewName.trim() || isMigrating}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              textTransform: 'none',
              fontWeight: 700,
              px: 4,
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(16, 185, 129, 0.3)',
              '&:disabled': { background: alpha('#10b981', 0.3) },
            }}
          >
            {isMigrating ? 'Migrating...' : 'Start Migration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardManagement;
