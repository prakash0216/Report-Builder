import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { dashboardsManager, Dashboard } from '../recoil/Dashboards';
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
  Fade,
  Zoom,
  Badge,
  Avatar,
  Divider,
  Menu,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Dashboard as DashboardIcon,
  FolderOpen as FolderOpenIcon,
  ChevronRight as ChevronRightIcon,
  BarChart as BarChartIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  AutoAwesome as AutoAwesomeIcon,
  Layers as LayersIcon,
  ViewModule as ViewModuleIcon,
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
  Home as HomeIcon,
  Settings as SettingsIcon,
  History as HistoryIcon,
  Bookmark as BookmarkIcon,
  Speed as SpeedIcon,
  Help as HelpIcon,
  FilterAlt as FilterAltIcon,
} from '@mui/icons-material';

const DashboardManagement: React.FC = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useRecoilState(dashboardsManager);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [newDashboardName, setNewDashboardName] = useState<string>('');
  const [newDashboardDesc, setNewDashboardDesc] = useState<string>('');
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'updated' | 'created'>('updated');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuDashboard, setMenuDashboard] = useState<Dashboard | null>(null);
  const [activeNav, setActiveNav] = useState<'all' | 'favorites' | 'recent'>('all');
  const dashIdRef = useRef(1);

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
  const handleCreateDashboard = () => {
    if (!newDashboardName.trim()) return;

    const newDashboard: Dashboard = {
      id: dashIdRef.current.toString(),
      name: newDashboardName,
      description: newDashboardDesc,
      thumbnail: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chartsCount: 0,
    };

    dashIdRef.current += 1;
    setDashboards([...dashboards, newDashboard]);
    setNewDashboardName('');
    setNewDashboardDesc('');
    setOpenCreateDialog(false);
    setSelectedDashboard(newDashboard);
  };

  // Edit dashboard
  const handleEditStart = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setEditName(dashboard.name);
    setEditDesc(dashboard.description || '');
    setOpenCreateDialog(true);
    setAnchorEl(null);
  };

  const handleEditSave = () => {
    if (!editName.trim() || !editingDashboard) return;

    setDashboards(
      dashboards.map((d) =>
        d.id === editingDashboard.id
          ? { ...d, name: editName, description: editDesc, updatedAt: Date.now() }
          : d
      )
    );

    if (selectedDashboard?.id === editingDashboard.id) {
      setSelectedDashboard({ ...editingDashboard, name: editName, description: editDesc });
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

  const handleDeleteConfirm = () => {
    if (deletingDashboard) {
      setDashboards(dashboards.filter((d) => d.id !== deletingDashboard.id));
      if (selectedDashboard?.id === deletingDashboard.id) {
        setSelectedDashboard(null);
      }
      favorites.delete(deletingDashboard.id);
      setFavorites(new Set(favorites));
    }
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
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

  const handleDashboardClick = (dashboard: Dashboard) => {
    const slug = toSlug(dashboard.name);
    navigate(`/${slug}`);
  };

  const toggleFavorite = (id: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(id)) {
      newFavorites.delete(id);
    } else {
      newFavorites.add(id);
    }
    setFavorites(newFavorites);
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
        onClick={() => setSelectedDashboard(dashboard)}
        onDoubleClick={() => handleDashboardClick(dashboard)}
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
                  onClick={(e) => { e.stopPropagation(); setMenuDashboard(dashboard); setAnchorEl(e.currentTarget); }}
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
              <AnalyticsIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
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
          </List>

          <Divider sx={{ mx: 2 }} />

          {/* Quick Actions */}
          <Box sx={{ p: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 1, mb: 1, display: 'block' }}>
              Quick Actions
            </Typography>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => { setEditingDashboard(null); setNewDashboardName(''); setNewDashboardDesc(''); setOpenCreateDialog(true); }}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.25,
                borderRadius: 2,
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
                '&:hover': {
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.35)',
                },
              }}
            >
              New Dashboard
            </Button>
          </Box>

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
                Double-click on any dashboard card to open it directly.
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* Right Content Area */}
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', p: 3, gap: 3 }}>
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
          {filteredDashboards.length === 0 ? (
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
                      onClick={() => setSelectedDashboard(dashboard)}
                      onDoubleClick={() => handleDashboardClick(dashboard)}
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
                            onClick={(e) => { e.stopPropagation(); setMenuDashboard(dashboard); setAnchorEl(e.currentTarget); }}
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

        {/* Selected Dashboard Preview Panel */}
        {selectedDashboard && (
          <Fade in={true}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.92) 100%)',
                border: `1px solid ${alpha('#667eea', 0.2)}`,
                boxShadow: `0 8px 32px ${alpha('#667eea', 0.1)}`,
              }}
            >
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar
                    sx={{
                      width: 56,
                      height: 56,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                    }}
                  >
                    {selectedDashboard.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#1e293b' }}>
                      {selectedDashboard.name}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {selectedDashboard.description || 'No description provided'}
                    </Typography>
                  </Box>
                </Box>
                <Box display="flex" alignItems="center" gap={2}>
                  <Box display="flex" gap={1}>
                    <Chip
                      icon={<BarChartIcon sx={{ fontSize: 14 }} />}
                      label={`${selectedDashboard.chartsCount || 0} Charts`}
                      size="small"
                      sx={{ bgcolor: alpha('#667eea', 0.1), color: '#667eea', fontWeight: 600 }}
                    />
                    <Chip
                      icon={<AccessTimeIcon sx={{ fontSize: 14 }} />}
                      label={getTimeAgo(selectedDashboard.updatedAt)}
                      size="small"
                      sx={{ bgcolor: alpha('#10b981', 0.1), color: '#059669', fontWeight: 600 }}
                    />
                  </Box>
                  <Button
                    variant="contained"
                    endIcon={<ChevronRightIcon />}
                    onClick={() => handleDashboardClick(selectedDashboard)}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      textTransform: 'none',
                      fontWeight: 700,
                      px: 3,
                      py: 1,
                      borderRadius: 2,
                      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                        transform: 'translateY(-1px)',
                      },
                    }}
                  >
                    Open Dashboard
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Fade>
        )}
        </Box>
      </Box>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            border: `1px solid ${alpha('#667eea', 0.1)}`,
            minWidth: 160,
          },
        }}
      >
        <MenuItem onClick={() => menuDashboard && handleDashboardClick(menuDashboard)}>
          <OpenInNewIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Open
        </MenuItem>
        <MenuItem onClick={() => menuDashboard && handleEditStart(menuDashboard)}>
          <EditIcon fontSize="small" sx={{ mr: 1.5, color: '#667eea' }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => menuDashboard && toggleFavorite(menuDashboard.id)}>
          {menuDashboard && favorites.has(menuDashboard.id) ? (
            <StarIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          ) : (
            <StarBorderIcon fontSize="small" sx={{ mr: 1.5, color: '#f59e0b' }} />
          )}
          {menuDashboard && favorites.has(menuDashboard.id) ? 'Unfavorite' : 'Favorite'}
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem onClick={() => menuDashboard && handleDeleteClick(menuDashboard)} sx={{ color: '#ef4444' }}>
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
    </Box>
  );
};

export default DashboardManagement;
