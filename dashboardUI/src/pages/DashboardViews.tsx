import React, { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ViewModule as ViewModuleIcon,
  BarChart as BarChartIcon,
  ChevronRight as ChevronRightIcon,
  Warning as WarningIcon,
  TableChart as TableChartIcon,
} from '@mui/icons-material';

interface View {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  chartsCount: number;
}

const DashboardViews: React.FC = () => {
  const navigate = useNavigate();
  const { dashboardId } = useParams<{ dashboardId: string }>();
  
  // Mock dashboard name - in real app, fetch from Recoil
  const [dashboardName] = useState<string>('MSL Dashboard');
  
  const [views, setViews] = useState<View[]>([
    {
      id: '1',
      name: 'Patient View',
      description: 'Patient-focused metrics and analytics',
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 86400000,
      chartsCount: 8,
    },
    {
      id: '2',
      name: 'Provider View',
      description: 'Provider performance and engagement metrics',
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now(),
      chartsCount: 6,
    },
  ]);
  
  const [newViewName, setNewViewName] = useState<string>('');
  const [newViewDesc, setNewViewDesc] = useState<string>('');
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingView, setDeletingView] = useState<View | null>(null);
  const [editingView, setEditingView] = useState<View | null>(null);
  const viewIdRef = useRef(3);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleCreateView = () => {
    if (!newViewName.trim()) return;

    const newView: View = {
      id: viewIdRef.current.toString(),
      name: newViewName,
      description: newViewDesc,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chartsCount: 0,
    };

    viewIdRef.current += 1;
    setViews([...views, newView]);
    setNewViewName('');
    setNewViewDesc('');
    setOpenCreateDialog(false);
  };

  const handleDeleteClick = (view: View) => {
    setDeletingView(view);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingView) {
      setViews(views.filter((v) => v.id !== deletingView.id));
    }
    setOpenDeleteDialog(false);
    setDeletingView(null);
  };

  const handleViewClick = (view: View) => {
    navigate(`/dashboard/${dashboardId}/view/${view.id}`);
  };

  return (
    <Box maxWidth="100vw" sx={{ display: 'flex', flexDirection: 'column', bgcolor: 'grey.50' }}>
      {/* Top Navigation Bar */}
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <IconButton onClick={() => navigate('/dashboards')} sx={{ color: 'text.secondary' }}>
              <ArrowBackIcon />
            </IconButton>
            
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
              <BarChartIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            
            <Box>
              <Breadcrumbs>
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate('/dashboards')}
                  sx={{ cursor: 'pointer', fontWeight: 600 }}
                >
                  Chart Builder
                </Link>
                <Typography fontWeight={700} color="primary">
                  {dashboardName}
                </Typography>
              </Breadcrumbs>
              <Typography variant="caption" color="text.secondary">
                Manage views and reports
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
            }}
          >
            New View
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="xl" sx={{ py: 4, flex: 1 }}>
        {/* Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom sx={{ color: '#1a1a2e' }}>
            Dashboard Views
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Select a view to access its drag-and-drop chart editor
          </Typography>
        </Box>

        {/* Views Grid */}
        {views.length > 0 ? (
          <Grid container spacing={3}>
            {views.map((view) => (
              <Grid size={{xs:12,md:4,sm:6}} key={view.id}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    border: 2,
                    borderColor: 'transparent',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                      borderColor: 'primary.main',
                    },
                  }}
                >
                  <CardActionArea onClick={() => handleViewClick(view)}>
                    <Box
                      sx={{
                        height: 160,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <ViewModuleIcon sx={{ fontSize: 64, color: '#667eea', opacity: 0.5 }} />
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          bgcolor: 'white',
                          borderRadius: 1.5,
                          px: 1.5,
                          py: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                        }}
                      >
                        <Typography variant="caption" fontWeight={600} color="primary">
                          Open
                        </Typography>
                        <ChevronRightIcon fontSize="small" color="primary" />
                      </Box>
                    </Box>
                  </CardActionArea>

                  <CardContent sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                      <Typography variant="h6" fontWeight={600} sx={{ color: '#1a1a2e' }}>
                        {view.name}
                      </Typography>
                      <Box>
                        <Tooltip title="Edit">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingView(view);
                              setNewViewName(view.name);
                              setNewViewDesc(view.description);
                              setOpenCreateDialog(true);
                            }}
                            sx={{ color: 'primary.main' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(view);
                            }}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>

                    {view.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          minHeight: '2.5em',
                        }}
                      >
                        {view.description}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<TableChartIcon sx={{ fontSize: 16 }} />}
                        label={`${view.chartsCount} charts`}
                        size="small"
                        sx={{
                          bgcolor: 'rgba(102, 126, 234, 0.1)',
                          color: '#667eea',
                          fontWeight: 600,
                        }}
                      />
                      <Chip
                        label={formatDate(view.updatedAt)}
                        size="small"
                        sx={{ bgcolor: 'grey.200' }}
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          // Empty State
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 8,
              borderRadius: 3,
              border: '2px dashed #e0e0e0',
            }}
          >
            <ViewModuleIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom sx={{ color: '#1a1a2e' }}>
              No Views Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Create your first view to start building charts and visualizations
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenCreateDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
              }}
            >
              Create First View
            </Button>
          </Paper>
        )}
      </Container>

      {/* Create/Edit View Dialog */}
      <Dialog
        open={openCreateDialog}
        onClose={() => {
          setOpenCreateDialog(false);
          setEditingView(null);
          setNewViewName('');
          setNewViewDesc('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.5rem' }}>
          {editingView ? 'Edit View' : 'Create New View'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="normal"
            label="View Name"
            fullWidth
            required
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g., Patient View, Provider View"
          />
          <TextField
            margin="normal"
            label="Description"
            fullWidth
            multiline
            rows={3}
            value={newViewDesc}
            onChange={(e) => setNewViewDesc(e.target.value)}
            placeholder="Describe what this view will display..."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button
            onClick={() => {
              setOpenCreateDialog(false);
              setEditingView(null);
              setNewViewName('');
              setNewViewDesc('');
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateView}
            disabled={!newViewName.trim()}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            {editingView ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
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
            Delete View
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" color="text.secondary">
            Are you sure you want to delete{' '}
            <strong style={{ color: '#1a1a2e' }}>"{deletingView?.name}"</strong>? All charts in this
            view will be permanently deleted. This action cannot be undone.
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

export default DashboardViews;