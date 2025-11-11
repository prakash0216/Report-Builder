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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'grey.50' }}>
      {/* Top Navigation Bar */}
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 2,
                p: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChartIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: '#1a1a2e' }}>
              Chart Builder
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - Dashboard List */}
        <Paper
          elevation={2}
          sx={{
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            borderRight: 1,
            borderColor: 'divider',
          }}
        >
          {/* Sidebar Header */}
          <Box sx={{ p: 2.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Dashboards
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="Enter dashboard name"
              value={newDashboardName}
              onChange={(e) => setNewDashboardName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateDashboard()}
              sx={{ mb: 1 }}
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
              }}
            >
              Create Dashboard
            </Button>
          </Box>

          {/* Dashboard List */}
          <List sx={{ flex: 1, overflow: 'auto', p: 1 }}>
            {dashboards.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4, px: 2 }}>
                <FolderOpenIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  No dashboards yet. Create your first dashboard above.
                </Typography>
              </Box>
            ) : (
              dashboards.map((dashboard) => (
                <ListItem
                  key={dashboard.id}
                  disablePadding
                  sx={{ mb: 1 }}
                  secondaryAction={
                    editingDashboard?.id !== dashboard.id && (
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditStart(dashboard);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(dashboard);
                            }}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )
                  }
                >
                  {editingDashboard?.id === dashboard.id ? (
                    <Box sx={{ width: '100%', px: 2, py: 1 }}>
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
                      />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button size="small" variant="contained" onClick={handleEditSave}>
                          Save
                        </Button>
                        <Button size="small" variant="outlined" onClick={handleEditCancel}>
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <ListItemButton
                      selected={selectedDashboard?.id === dashboard.id}
                      onClick={() => setSelectedDashboard(dashboard)}
                      sx={{
                        borderRadius: 1,
                        '&.Mui-selected': {
                          bgcolor: 'primary.light',
                          color: 'primary.contrastText',
                          '&:hover': {
                            bgcolor: 'primary.main',
                          },
                        },
                      }}
                    >
                      <DashboardIcon sx={{ mr: 2, fontSize: 20 }} />
                      <ListItemText
                        primary={dashboard.name}
                        secondary={formatDate(dashboard.updatedAt)}
                        primaryTypographyProps={{
                          fontWeight: 600,
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          sx: {
                            color: selectedDashboard?.id === dashboard.id ? 'inherit' : 'text.secondary',
                            opacity: selectedDashboard?.id === dashboard.id ? 0.8 : 1,
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
        <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
          {selectedDashboard ? (
            <Box>
              {/* Dashboard Header */}
              <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: '#1a1a2e' }}>
                  {selectedDashboard.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={`Created ${formatDate(selectedDashboard.createdAt)}`}
                    size="small"
                    sx={{ bgcolor: 'grey.200' }}
                  />
                  <Chip
                    label={`Updated ${formatDate(selectedDashboard.updatedAt)}`}
                    size="small"
                    sx={{ bgcolor: 'grey.200' }}
                  />
                </Box>
                <Divider />
              </Box>

              {/* Dashboard Card - Click to go to views */}
              <Card
                sx={{
                  maxWidth: 600,
                  borderRadius: 3,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  border: 2,
                  borderColor: 'primary.light',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                    borderColor: 'primary.main',
                  },
                }}
              >
                <CardActionArea onClick={() => handleDashboardClick(selectedDashboard)}>
                  <Box
                    sx={{
                      height: 200,
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                  >
                    <DashboardIcon sx={{ fontSize: 80, color: '#667eea', opacity: 0.5 }} />
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        bgcolor: 'white',
                        borderRadius: 2,
                        px: 2,
                        py: 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="caption" fontWeight={600} color="primary">
                        Click to view
                      </Typography>
                      <ChevronRightIcon fontSize="small" color="primary" />
                    </Box>
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                      Open Dashboard Views
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Access all views and reports for this dashboard. Create and manage different
                      perspectives of your data.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Chip
                        icon={<FolderOpenIcon />}
                        label="Views"
                        size="small"
                        sx={{
                          bgcolor: 'rgba(102, 126, 234, 0.1)',
                          color: '#667eea',
                          fontWeight: 600,
                        }}
                      />
                      <Chip
                        label={`${selectedDashboard.chartsCount} Charts`}
                        size="small"
                        sx={{ bgcolor: 'grey.200' }}
                      />
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Box>
          ) : (
            // Empty State
            <Box
              sx={{
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Box sx={{ textAlign: 'center', maxWidth: 400 }}>
                <DashboardIcon sx={{ fontSize: 80, color: 'grey.400', mb: 2 }} />
                <Typography variant="h5" fontWeight={600} gutterBottom sx={{ color: '#1a1a2e' }}>
                  Select a Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Choose a dashboard from the left sidebar to view and manage its views, or create a
                  new dashboard to get started.
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={() => setOpenDeleteDialog(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              bgcolor: 'rgba(244, 67, 54, 0.1)',
              borderRadius: '50%',
              p: 1.5,
              display: 'flex',
            }}
          >
            <WarningIcon sx={{ color: 'error.main' }} />
          </Box>
          <Typography variant="h6" fontWeight={700}>
            Delete Dashboard
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Are you sure you want to delete{' '}
            <strong style={{ color: '#1a1a2e' }}>"{deletingDashboard?.name}"</strong>? This will also
            delete all associated views and charts. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setOpenDeleteDialog(false)}>
            Cancel
          </Button>
          <Button variant="contained" color="error" onClick={handleDeleteConfirm}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardManagement;