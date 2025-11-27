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
  alpha,
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
  AutoAwesome as AutoAwesomeIcon,
  Layers as LayersIcon,
  TrendingUp as TrendingUpIcon,
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
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh',
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
            <Tooltip title="Back to Dashboards" arrow>
              <IconButton 
                onClick={() => navigate('/dashboards')} 
                sx={{ 
                  color: 'white',
                  bgcolor: 'rgba(255, 255, 255, 0.1)',
                  '&:hover': {
                    bgcolor: 'rgba(255, 255, 255, 0.2)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            
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
              <BarChartIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            
            <Box>
              <Breadcrumbs 
                separator={<ChevronRightIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.7)' }} />}
                sx={{ color: 'white' }}
              >
                <Link
                  underline="hover"
                  color="inherit"
                  onClick={() => navigate('/dashboards')}
                  sx={{ 
                    cursor: 'pointer', 
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.9)',
                    transition: 'color 0.3s ease',
                    '&:hover': {
                      color: 'white',
                    },
                  }}
                >
                  Report Builder Intelligence
                </Link>
                <Typography 
                  fontWeight={700} 
                  sx={{ color: 'white' }}
                >
                  {dashboardName}
                </Typography>
              </Breadcrumbs>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontWeight: 500 }}>
                Manage views
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenCreateDialog(true)}
            sx={{
              background: 'white',
              color: '#667eea',
              textTransform: 'none',
              fontWeight: 600,
              px: 3,
              py: 1,
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(255, 255, 255, 0.3)',
              '&:hover': {
                background: 'rgba(255, 255, 255, 0.95)',
                boxShadow: '0 6px 20px rgba(255, 255, 255, 0.4)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s ease',
            }}
          >
            New View
          </Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth={false} sx={{ py: 4, flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            mb: 4,
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
              <LayersIcon sx={{ color: 'white', fontSize: 32 }} />
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
                Dashboard Views
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                Select a view to access its drag-and-drop chart editor
              </Typography>
            </Box>
            <Chip
              icon={<ViewModuleIcon />}
              label={`${views.length} ${views.length === 1 ? 'View' : 'Views'}`}
              sx={{
                background: `linear-gradient(135deg, ${alpha('#667eea', 0.15)} 0%, ${alpha('#764ba2', 0.15)} 100%)`,
                color: '#667eea',
                fontWeight: 600,
                border: `1px solid ${alpha('#667eea', 0.3)}`,
                py: 2.5,
              }}
            />
          </Box>
        </Paper>

        {/* Views Grid */}
        {views.length > 0 ? (
          <Grid container spacing={3}>
            {views.map((view) => (
              <Grid size={{xs:12,sm:6,md:4}} key={view.id}>
                <Card
                  sx={{
                    height: '100%',
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                    backdropFilter: 'blur(20px) saturate(180%)',
                    border: `1px solid ${alpha('#667eea', 0.2)}`,
                    boxShadow: '0 4px 16px rgba(102, 126, 234, 0.15)',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 20px 48px rgba(102, 126, 234, 0.25)',
                      border: `1px solid ${alpha('#667eea', 0.4)}`,
                      '& .view-icon': {
                        transform: 'scale(1.1) rotate(5deg)',
                      },
                      '& .open-badge': {
                        transform: 'scale(1.05)',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                      },
                    },
                  }}
                >
                  <CardActionArea 
                    onClick={() => handleViewClick(view)}
                    sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                  >
                    <Box
                      sx={{
                        height: 180,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%)',
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
                            radial-gradient(circle at 30% 30%, ${alpha('#667eea', 0.15)} 0%, transparent 50%),
                            radial-gradient(circle at 70% 70%, ${alpha('#764ba2', 0.15)} 0%, transparent 50%)
                          `,
                        },
                      }}
                    >
                      <ViewModuleIcon 
                        className="view-icon"
                        sx={{ 
                          fontSize: 72, 
                          color: '#667eea', 
                          opacity: 0.6,
                          transition: 'all 0.4s ease',
                          position: 'relative',
                          zIndex: 1,
                        }} 
                      />
                      <Box
                        className="open-badge"
                        sx={{
                          position: 'absolute',
                          top: 16,
                          right: 16,
                          bgcolor: 'white',
                          borderRadius: 2,
                          px: 2,
                          py: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5,
                          boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
                          border: `1px solid ${alpha('#667eea', 0.2)}`,
                          transition: 'all 0.3s ease',
                        }}
                      >
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#667eea' }}>
                          Open
                        </Typography>
                        <ChevronRightIcon sx={{ fontSize: 16, color: '#667eea' }} />
                      </Box>
                    </Box>

                    <CardContent sx={{ p: 3, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1.5 }}>
                        <Typography 
                          variant="h6" 
                          fontWeight={700} 
                          sx={{ 
                            color: '#667eea',
                            flex: 1,
                          }}
                        >
                          {view.name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit View" arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingView(view);
                                setNewViewName(view.name);
                                setNewViewDesc(view.description);
                                setOpenCreateDialog(true);
                              }}
                              sx={{ 
                                color: '#667eea',
                                bgcolor: alpha('#667eea', 0.1),
                                '&:hover': {
                                  bgcolor: alpha('#667eea', 0.2),
                                },
                              }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete View" arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(view);
                              }}
                              sx={{ 
                                color: '#f44336',
                                bgcolor: alpha('#f44336', 0.1),
                                '&:hover': {
                                  bgcolor: alpha('#f44336', 0.2),
                                },
                              }}
                            >
                              <DeleteIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {view.description ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            flex: 1,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: '2.5em',
                            lineHeight: 1.6,
                          }}
                        >
                          {view.description}
                        </Typography>
                      ) : (
                        <Typography
                          variant="body2"
                          sx={{
                            mb: 2,
                            flex: 1,
                            color: 'text.disabled',
                            fontStyle: 'italic',
                            minHeight: '2.5em',
                          }}
                        >
                          No description provided
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<TableChartIcon sx={{ fontSize: 16 }} />}
                          label={`${view.chartsCount} ${view.chartsCount === 1 ? 'chart' : 'charts'}`}
                          size="small"
                          sx={{
                            background: `linear-gradient(135deg, ${alpha('#667eea', 0.12)} 0%, ${alpha('#764ba2', 0.12)} 100%)`,
                            color: '#667eea',
                            fontWeight: 600,
                            border: `1px solid ${alpha('#667eea', 0.25)}`,
                          }}
                        />
                        <Chip
                          label={formatDate(view.updatedAt)}
                          size="small"
                          sx={{ 
                            bgcolor: alpha('#667eea', 0.08),
                            color: 'text.secondary',
                            fontWeight: 500,
                            border: `1px solid ${alpha('#667eea', 0.15)}`,
                          }}
                        />
                      </Box>
                    </CardContent>
                  </CardActionArea>
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
              py: 10,
              borderRadius: 4,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.6) 100%)',
              backdropFilter: 'blur(20px) saturate(180%)',
              border: `2px dashed ${alpha('#667eea', 0.3)}`,
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
            }}
          >
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
              <ViewModuleIcon sx={{ fontSize: 64, color: '#667eea' }} />
            </Box>
            <Typography 
              variant="h5" 
              fontWeight={700} 
              gutterBottom 
              sx={{ 
                color: '#667eea',
              }}
            >
              No Views Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.8 }}>
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
                px: 5,
                py: 1.5,
                borderRadius: 2.5,
                fontSize: '1rem',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                  boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s ease',
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
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            border: `1px solid ${alpha('#667eea', 0.2)}`,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
          },
        }}
      >
        <DialogTitle sx={{ pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              }}
            >
              {editingView ? <EditIcon sx={{ color: 'white' }} /> : <AddIcon sx={{ color: 'white' }} />}
            </Box>
            <Typography variant="h6" fontWeight={700}>
              {editingView ? 'Edit View' : 'Create New View'}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            autoFocus
            margin="normal"
            label="View Name"
            fullWidth
            required
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="e.g., Patient View, Provider View"
            sx={{
              '& .MuiOutlinedInput-root': {
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
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#667eea',
              },
            }}
          />
          <TextField
            margin="normal"
            label="Description"
            fullWidth
            multiline
            rows={4}
            value={newViewDesc}
            onChange={(e) => setNewViewDesc(e.target.value)}
            placeholder="Describe what this view will display..."
            sx={{
              '& .MuiOutlinedInput-root': {
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
              '& .MuiInputLabel-root.Mui-focused': {
                color: '#667eea',
              },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1.5 }}>
          <Button
            onClick={() => {
              setOpenCreateDialog(false);
              setEditingView(null);
              setNewViewName('');
              setNewViewDesc('');
            }}
            sx={{
              textTransform: 'none',
              fontWeight: 600,
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha('#667eea', 0.05),
              },
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
              textTransform: 'none',
              fontWeight: 600,
              px: 4,
              borderRadius: 2,
              boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
              },
              '&:disabled': {
                background: alpha('#667eea', 0.3),
              },
              transition: 'all 0.3s ease',
            }}
          >
            {editingView ? 'Update View' : 'Create View'}
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
            Delete View
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Are you sure you want to delete{' '}
            <strong style={{ color: '#667eea', fontWeight: 700 }}>
              "{deletingView?.name}"
            </strong>
            ? All charts in this view will be permanently deleted. This action cannot be undone.
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
            Delete View
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DashboardViews;