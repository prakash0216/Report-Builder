import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { dashboardsManager, Dashboard } from '../recoil/Dashboards';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
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
  Search as SearchIcon,
  TrendingUp as TrendingUpIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material';

const DashboardManagement: React.FC = () => {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useRecoilState(dashboardsManager);
  const [selectedDashboard, setSelectedDashboard] = useState<Dashboard | null>(null);
  const [newDashboardName, setNewDashboardName] = useState<string>('');
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const dashIdRef = useRef(1);

  // Create new dashboard
  const handleCreateDashboard = () => {
    if (!newDashboardName.trim()) return;

    const newDashboard: Dashboard = {
      id: dashIdRef.current.toString(),
      name: newDashboardName,
      description: '',
      thumbnail: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chartsCount: 0,
    };

    dashIdRef.current += 1;
    setDashboards([...dashboards, newDashboard]);
    setNewDashboardName('');
    setSelectedDashboard(newDashboard);
  };

  // Start editing dashboard
  const handleEditStart = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setEditName(dashboard.name);
  };

  // Save edited dashboard
  const handleEditSave = () => {
    if (!editName.trim() || !editingDashboard) return;

    setDashboards(
      dashboards.map((d) =>
        d.id === editingDashboard.id
          ? { ...d, name: editName, updatedAt: Date.now() }
          : d
      )
    );

    if (selectedDashboard?.id === editingDashboard.id) {
      setSelectedDashboard({ ...editingDashboard, name: editName });
    }

    setEditingDashboard(null);
    setEditName('');
  };

  // Cancel editing
  const handleEditCancel = () => {
    setEditingDashboard(null);
    setEditName('');
  };

  // Delete dashboard
  const handleDeleteClick = (dashboard: Dashboard) => {
    setDeletingDashboard(dashboard);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingDashboard) {
      setDashboards(dashboards.filter((d) => d.id !== deletingDashboard.id));
      if (selectedDashboard?.id === deletingDashboard.id) {
        setSelectedDashboard(null);
      }
    }
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
  };

  // Navigate to views page
  const handleDashboardClick = (dashboard: Dashboard) => {
    navigate(`/dashboard/${dashboard.id}/views`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Top Navigation Bar - Matching drag-drop dashboard */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 4px 20px 0 rgba(102, 126, 234, 0.3)',
        }}
      >
        <Toolbar sx={{ py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Box
              sx={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: 2.5,
                p: 1.2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)',
              }}
            >
              <BarChartIcon sx={{ color: 'white', fontSize: 32 }} />
            </Box>
            <Box>
              <Typography 
                variant="h5" 
                fontWeight={700} 
                sx={{ 
                  color: 'white',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.2,
                }}
              >
                Report Builder Intelligence
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                Dashboard Management
              </Typography>
            </Box>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', p: 2, gap: 2 }}>
        {/* Left Sidebar - Dashboard List */}
        <Paper
          elevation={0}
          sx={{
            width: 360,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: `1px solid ${alpha('#667eea', 0.2)}`,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)',
          }}
        >
          {/* Sidebar Header */}
          <Box 
            sx={{ 
              p: 3, 
              background: `linear-gradient(135deg, ${alpha('#667eea', 0.08)} 0%, ${alpha('#764ba2', 0.08)} 100%)`,
              borderBottom: `1px solid ${alpha('#667eea', 0.15)}`,
            }}
          >
            <Typography 
              variant="h6" 
              fontWeight={700} 
              gutterBottom
              sx={{
                color: '#667eea',
              }}
            >
              Dashboards
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter dashboard name..."
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateDashboard()}
              sx={{ 
                mb: 1.5,
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  borderRadius: 2,
                  '& fieldset': {
                    borderColor: alpha('#667eea', 0.3),
                  },
                  '&:hover fieldset': {
                    borderColor: alpha('#667eea', 0.5),
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <DashboardIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateDashboard}
              disabled={!newDashboardName.trim()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontWeight: 600,
                py: 1.2,
                borderRadius: 2,
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                  transform: 'translateY(-2px)',
                },
                '&:disabled': {
                  background: alpha('#667eea', 0.3),
                },
                transition: 'all 0.3s ease',
              }}
            >
              Create Dashboard
            </Button>
          </Box>

          {/* Dashboard List */}
          <List sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {dashboards.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    margin: '0 auto 16px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${alpha('#667eea', 0.1)} 0%, ${alpha('#764ba2', 0.1)} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FolderOpenIcon sx={{ fontSize: 40, color: '#667eea' }} />
                </Box>
                <Typography variant="h6" fontWeight={600} gutterBottom sx={{ color: '#667eea' }}>
                  No Dashboards Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create your first dashboard to get started with analytics
                </Typography>
              </Box>
            ) : (
              dashboards.map((dashboard) => (
                <ListItem
                  key={dashboard.id}
                  disablePadding
                  sx={{ mb: 1.5 }}
                  secondaryAction={
                    editingDashboard?.id !== dashboard.id && (
                      <Box>
                        <Tooltip title="Edit" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStart(dashboard);
                            }}
                            sx={{
                              color: '#667eea',
                              '&:hover': {
                                bgcolor: alpha('#667eea', 0.1),
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete" arrow>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(dashboard);
                            }}
                            sx={{ 
                              color: '#f44336',
                              '&:hover': {
                                bgcolor: alpha('#f44336', 0.1),
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )
                  }
                >
                  {editingDashboard?.id === dashboard.id ? (
                    <Box 
                      sx={{ 
                        width: '100%', 
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: `2px solid ${alpha('#667eea', 0.3)}`,
                      }}
                    >
                      <TextField
                        fullWidth
                        size="small"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleEditSave();
                          if (e.key === 'Escape') handleEditCancel();
                        }}
                        autoFocus
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: alpha('#667eea', 0.3),
                            },
                          },
                        }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                        <Button 
                          size="small" 
                          variant="contained" 
                          onClick={handleEditSave}
                          sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            textTransform: 'none',
                          }}
                        >
                          Save
                        </Button>
                        <Button 
                          size="small" 
                          variant="outlined" 
                          onClick={handleEditCancel}
                          sx={{
                            borderColor: alpha('#667eea', 0.3),
                            color: '#667eea',
                            textTransform: 'none',
                          }}
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <ListItemButton
                      selected={selectedDashboard?.id === dashboard.id}
                      onClick={() => setSelectedDashboard(dashboard)}
                      sx={{
                        borderRadius: 2,
                        transition: 'all 0.3s ease',
                        bgcolor: selectedDashboard?.id === dashboard.id 
                          ? `linear-gradient(135deg, ${alpha('#667eea', 0.15)} 0%, ${alpha('#764ba2', 0.15)} 100%)`
                          : 'transparent',
                        border: `1px solid ${
                          selectedDashboard?.id === dashboard.id 
                            ? alpha('#667eea', 0.3)
                            : 'transparent'
                        }`,
                        '&:hover': {
                          bgcolor: alpha('#667eea', 0.08),
                          transform: 'translateX(4px)',
                          border: `1px solid ${alpha('#667eea', 0.2)}`,
                        },
                        '&.Mui-selected': {
                          bgcolor: `linear-gradient(135deg, ${alpha('#667eea', 0.15)} 0%, ${alpha('#764ba2', 0.15)} 100%)`,
                          '&:hover': {
                            bgcolor: `linear-gradient(135deg, ${alpha('#667eea', 0.2)} 0%, ${alpha('#764ba2', 0.2)} 100%)`,
                          },
                        },
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          mr: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: selectedDashboard?.id === dashboard.id
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : alpha('#667eea', 0.1),
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <DashboardIcon 
                          sx={{ 
                            fontSize: 20,
                            color: selectedDashboard?.id === dashboard.id ? 'white' : '#667eea',
                          }} 
                        />
                      </Box>
                      <ListItemText
                        primary={dashboard.name}
                        secondary={formatDate(dashboard.updatedAt)}
                        primaryTypographyProps={{
                          fontWeight: 600,
                          noWrap: true,
                          color: selectedDashboard?.id === dashboard.id ? '#667eea' : 'text.primary',
                        }}
                        secondaryTypographyProps={{
                          sx: {
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                          },
                        }}
                      />
                    </ListItemButton>
                  )}
                </ListItem>
              ))
            )}
          </List>
        </Paper>

        {/* Right Content - Dashboard Details */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {selectedDashboard ? (
            <Box>
              {/* Dashboard Header */}
              <Paper
                elevation={0}
                sx={{
                  p: 4,
                  mb: 3,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  border: `1px solid ${alpha('#667eea', 0.2)}`,
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.15)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2.5,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
                    }}
                  >
                    <TrendingUpIcon sx={{ color: 'white', fontSize: 32 }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography 
                      variant="h4" 
                      fontWeight={700} 
                      sx={{ 
                        color: '#667eea',
                        mb: 0.5,
                      }}
                    >
                      {selectedDashboard.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <Chip
                        label={`Created ${formatDate(selectedDashboard.createdAt)}`}
                        size="small"
                        sx={{ 
                          bgcolor: alpha('#667eea', 0.1),
                          color: '#667eea',
                          fontWeight: 500,
                          border: `1px solid ${alpha('#667eea', 0.2)}`,
                        }}
                      />
                      <Chip
                        label={`Updated ${formatDate(selectedDashboard.updatedAt)}`}
                        size="small"
                        sx={{ 
                          bgcolor: alpha('#667eea', 0.1),
                          color: '#667eea',
                          fontWeight: 500,
                          border: `1px solid ${alpha('#667eea', 0.2)}`,
                        }}
                      />
                      <Chip
                        icon={<BarChartIcon sx={{ fontSize: 16 }} />}
                        label={`${selectedDashboard.chartsCount} Charts`}
                        size="small"
                        sx={{ 
                          bgcolor: alpha('#667eea', 0.1),
                          color: '#667eea',
                          fontWeight: 500,
                          border: `1px solid ${alpha('#667eea', 0.2)}`,
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              </Paper>

              {/* Dashboard Card - Click to go to views */}
              <Card
                sx={{
                  maxWidth: 700,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  border: `1px solid ${alpha('#667eea', 0.2)}`,
                  boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 20px 48px rgba(102, 126, 234, 0.3)',
                    border: `1px solid ${alpha('#667eea', 0.4)}`,
                  },
                }}
              >
                <CardActionArea 
                  onClick={() => handleDashboardClick(selectedDashboard)}
                  sx={{
                    '&:hover .hover-effect': {
                      transform: 'scale(1.1)',
                      opacity: 0.8,
                    },
                  }}
                >
                  <Box
                    sx={{
                      height: 240,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `
                          radial-gradient(circle at 30% 30%, ${alpha('#667eea', 0.2)} 0%, transparent 50%),
                          radial-gradient(circle at 70% 70%, ${alpha('#764ba2', 0.2)} 0%, transparent 50%)
                        `,
                      },
                    }}
                  >
                    <DashboardIcon 
                      className="hover-effect"
                      sx={{ 
                        fontSize: 100, 
                        color: '#667eea', 
                        opacity: 0.6,
                        transition: 'all 0.4s ease',
                        position: 'relative',
                        zIndex: 1,
                      }} 
                    />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 20,
                        right: 20,
                        bgcolor: 'white',
                        borderRadius: 3,
                        px: 2.5,
                        py: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.2)',
                        border: `1px solid ${alpha('#667eea', 0.2)}`,
                      }}
                    >
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#667eea' }}>
                        Click to view
                      </Typography>
                      <ChevronRightIcon sx={{ color: '#667eea', fontSize: 20 }} />
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 4 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom sx={{ color: '#667eea' }}>
                      Open Dashboard Views
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
                      Access all views and reports for this dashboard. Create and manage different
                      perspectives of your data with powerful analytics tools.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<FolderOpenIcon />}
                        label="Views Manager"
                        sx={{
                          background: `linear-gradient(135deg, ${alpha('#667eea', 0.15)} 0%, ${alpha('#764ba2', 0.15)} 100%)`,
                          color: '#667eea',
                          fontWeight: 600,
                          border: `1px solid ${alpha('#667eea', 0.3)}`,
                          py: 2.5,
                        }}
                      />
                      <Chip
                        icon={<TrendingUpIcon />}
                        label="Analytics"
                        sx={{
                          background: `linear-gradient(135deg, ${alpha('#667eea', 0.15)} 0%, ${alpha('#764ba2', 0.15)} 100%)`,
                          color: '#667eea',
                          fontWeight: 600,
                          border: `1px solid ${alpha('#667eea', 0.3)}`,
                          py: 2.5,
                        }}
                      />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          ) : (
            // Empty State
            <Paper
              elevation={0}
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.5) 100%)',
                backdropFilter: 'blur(20px) saturate(180%)',
                border: `1px solid ${alpha('#667eea', 0.15)}`,
              }}
            >
              <Box sx={{ textAlign: 'center', maxWidth: 500, p: 6 }}>
                <Box
                  sx={{
                    width: 120,
                    height: 120,
                    margin: '0 auto 24px',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${alpha('#667eea', 0.1)} 0%, ${alpha('#764ba2', 0.1)} 100%)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `2px solid ${alpha('#667eea', 0.2)}`,
                  }}
                >
                  <DashboardIcon sx={{ fontSize: 60, color: '#667eea' }} />
                </Box>
                <Typography 
                  variant="h4" 
                  fontWeight={700} 
                  gutterBottom 
                  sx={{ 
                    color: '#667eea',
                  }}
                >
                  Select a Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                  Choose a dashboard from the left sidebar to view and manage its views, or create a
                  new dashboard to get started with your analytics journey.
                </Typography>
              </Box>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: `1px solid ${alpha('#f44336', 0.2)}`,
            boxShadow: '0 8px 32px rgba(244, 67, 54, 0.2)',
          },
        }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2, pb: 2 }}>
          <Box
            sx={{
              bgcolor: alpha('#f44336', 0.1),
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
              border: `2px solid ${alpha('#f44336', 0.2)}`,
            }}
          >
            <WarningIcon sx={{ color: 'error.main', fontSize: 28 }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            Delete Dashboard
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#667eea', fontWeight: 700 }}>
              "{deletingDashboard?.name}"
            </strong>
            ? This will also delete all associated views and charts. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1.5 }}>
          <Button 
            variant="outlined" 
            onClick={() => setOpenDeleteDialog(false)}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              px: 3,
              borderColor: alpha('#667eea', 0.3),
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                bgcolor: alpha('#667eea', 0.05),
              },
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleDeleteConfirm}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: 2,
              px: 3,
              boxShadow: '0 4px 16px rgba(244, 67, 54, 0.3)',
              '&:hover': {
                boxShadow: '0 6px 20px rgba(244, 67, 54, 0.4)',
              },
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