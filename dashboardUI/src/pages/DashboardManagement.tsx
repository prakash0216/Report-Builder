import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil'; 

import { dashboardsManager, Dashboard } from '../recoil/Dashboards';

import {
  Box,
  Card,
  CardContent,
  CardActions,
  Grid,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
  Chip,
  Paper,
  Fade,
  Grow,
  CardMedia,
  Input
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  BarChart as BarChartIcon,
  ShowChart as ShowChartIcon,
  Warning as WarningIcon,
  Image as ImageIcon,
  Close as CloseIcon
} from '@mui/icons-material';


const DashboardsManagement = () => {
  const [dashboards, setDashboards] = useRecoilState(dashboardsManager);
  
  const [openDialog, setOpenDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(null);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '', thumbnail: '' });
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const dashId = useRef(1);

  const handleCreate = () => {
    if (!formData.name.trim()) return;

    let newId = dashId.current.toString();
    dashId.current += 1;
    
    const newDashboard: Dashboard = {
      id: newId,
      name: formData.name,
      description: formData.description,
      thumbnail: formData.thumbnail,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      chartsCount: 0
    };
    
    setDashboards(prevDashboards => [...prevDashboards, newDashboard]);
    handleCloseDialog();
  };

  const handleEdit = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setFormData({ 
      name: dashboard.name, 
      description: dashboard.description || '', 
      thumbnail: dashboard.thumbnail || '' 
    });
    setThumbnailPreview(dashboard.thumbnail || '');
    setOpenDialog(true);
  };

  const handleUpdate = () => {
    if (!formData.name.trim() || !editingDashboard) return;
    
    setDashboards(prevDashboards => prevDashboards.map(d => 
      d.id === editingDashboard.id
        ? { 
            ...d, 
            name: formData.name, 
            description: formData.description, 
            thumbnail: formData.thumbnail,
            updatedAt: Date.now() 
          }
        : d
    ));
    
    handleCloseDialog();
  };

  const handleDeleteClick = (dashboard: Dashboard) => {
    setDeletingDashboard(dashboard);
    setOpenDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deletingDashboard) {
      setDashboards(prevDashboards => prevDashboards.filter(d => d.id !== deletingDashboard.id));
    }
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
  };

  const handleDeleteCancel = () => {
    setOpenDeleteDialog(false);
    setDeletingDashboard(null);
  };

  const handleOpenDashboard = (id: string) => {
    console.log(`Maps to dashboard: ${id}`);
    alert(`This would navigate to /dashboard/${id}`);
  };

  const handleOpenDialog = () => {
    setEditingDashboard(null);
    setFormData({ name: '', description: '', thumbnail: '' });
    setThumbnailPreview('');
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingDashboard(null);
    setFormData({ name: '', description: '', thumbnail: '' });
    setThumbnailPreview('');
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setFormData({ ...formData, thumbnail: url });
    setThumbnailPreview(url);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Box sx={{ 
      minHeight: '100vh',
      bgcolor: '#f8f9fa'
    }}>
      <Container maxWidth={false} sx={{ py: 4, px: 3 }}>
        {/* Header */}
        <Box sx={{ 
          mb: 4, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 2,
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}
            >
              <ShowChartIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Box>
              <Typography 
                variant="h4" 
                fontWeight="700"
                sx={{ color: '#1a1a2e', mb: 0.5 }}
              >
                Report Builder Intelligence
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create, manage, and explore your analytics dashboards
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenDialog}
            size="large"
            sx={{
              px: 3,
              py: 1.2,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              textTransform: 'none',
              fontSize: '0.95rem',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease'
            }}
          >
            New Dashboard
          </Button>
        </Box>

        {/* Dashboard Grid */}
        {dashboards.length > 0 ? (
          <Grid container spacing={3}>
            {dashboards.map((dashboard, index) => (
              <Grid size={{xs:12,sm:6,md:4}} key={dashboard.id}>
                <Card 
                  sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 3,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    border: '1px solid #e8e8e8',
                    overflow: 'hidden',
                    '&:hover': {
                      boxShadow: '0 8px 24px rgba(102, 126, 234, 0.15)',
                      transform: 'translateY(-4px)',
                      borderColor: '#667eea'
                    }
                  }}
                >
                  {/* Thumbnail */}
                  {dashboard.thumbnail ? (
                    <Box
                      onClick={() => handleOpenDashboard(dashboard.id)}
                      sx={{
                        height: 300,
                        width: '100%',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#f5f5f5'
                      }}
                    >
                      <img
                        src={dashboard.thumbnail}
                        alt={dashboard.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  ) : (
                    <Box
                      onClick={() => handleOpenDashboard(dashboard.id)}
                      sx={{
                        height: 300,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                        }
                      }}
                    >
                      <BarChartIcon sx={{ fontSize: 64, color: '#667eea', opacity: 0.5 }} />
                    </Box>
                  )}

                  <CardContent 
                    sx={{ flexGrow: 1, cursor: 'pointer', p: 2.5 }}
                    onClick={() => handleOpenDashboard(dashboard.id)}
                  >
                    <Typography variant="h6" fontWeight="600" sx={{ mb: 1, color: '#1a1a2e' }}>
                      {dashboard.name}
                    </Typography>
                    
                    {dashboard.description && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.5,
                          minHeight: '3em'
                        }}
                      >
                        {dashboard.description}
                      </Typography>
                    )}
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip 
                        label={`${dashboard.chartsCount} charts`} 
                        size="small"
                        sx={{
                          bgcolor: 'rgba(102, 126, 234, 0.1)',
                          color: '#667eea',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                      <Chip 
                        label={formatDate(dashboard.updatedAt)} 
                        size="small"
                        sx={{
                          bgcolor: '#f0f0f0',
                          color: '#666',
                          fontWeight: 500,
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>
                  </CardContent>
                  
                  <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0, gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(dashboard);
                      }}
                      sx={{
                        color: '#667eea',
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.1)'
                        }
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(dashboard);
                      }}
                      sx={{
                        color: '#f44336',
                        '&:hover': {
                          bgcolor: 'rgba(244, 67, 54, 0.1)'
                        }
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper
            elevation={0}
            sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              borderRadius: 3,
              border: '2px dashed #e0e0e0',
              bgcolor: 'white'
            }}
          >
            <Box
              sx={{
                display: 'inline-flex',
                p: 3,
                borderRadius: '50%',
                bgcolor: 'rgba(102, 126, 234, 0.1)',
                mb: 2
              }}
            >
              <BarChartIcon sx={{ fontSize: 56, color: '#667eea' }} />
            </Box>
            <Typography variant="h5" fontWeight="600" gutterBottom sx={{ color: '#1a1a2e' }}>
              No dashboards yet
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
              Start building your first dashboard to visualize and analyze your data
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenDialog}
              size="large"
              sx={{
                px: 4,
                py: 1.2,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                textTransform: 'none',
                fontSize: '1rem',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)',
                  boxShadow: '0 6px 16px rgba(102, 126, 234, 0.4)',
                  transform: 'translateY(-2px)'
                },
                transition: 'all 0.3s ease'
              }}
            >
              Create Your First Dashboard
            </Button>
          </Paper>
        )}

        {/* Create/Edit Dialog */}
        <Dialog 
          open={openDialog} 
          onClose={handleCloseDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
            }
          }}
        >
          <DialogTitle sx={{ 
            pb: 2, 
            pt: 3,
            px: 3,
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#1a1a2e'
          }}>
            {editingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
          </DialogTitle>
          <DialogContent sx={{ px: 3, pt: 2 }}>
            <TextField
              autoFocus
              margin="normal"
              label="Dashboard Name"
              fullWidth
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter dashboard name"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#667eea'
                }
              }}
            />
            <TextField
              margin="normal"
              label="Description"
              fullWidth
              multiline
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe what this dashboard will track..."
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#667eea'
                }
              }}
            />
            
            {/* Thumbnail URL Input */}
            <TextField
              margin="normal"
              label="Thumbnail URL (Optional)"
              fullWidth
              value={formData.thumbnail}
              onChange={handleThumbnailChange}
              placeholder="https://example.com/image.jpg"
              InputProps={{
                startAdornment: <ImageIcon sx={{ mr: 1, color: '#667eea' }} />
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#667eea',
                    borderWidth: 2
                  }
                },
                '& .MuiInputLabel-root.Mui-focused': {
                  color: '#667eea'
                }
              }}
            />
            
            {/* Thumbnail Preview */}
            {thumbnailPreview && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Preview:
                </Typography>
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    height: 180,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1px solid #e0e0e0'
                  }}
                >
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail preview"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.parentElement!.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f5f5f5; color: #999;">Invalid image URL</div>';
                    }}
                  />
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, pt: 2, gap: 1 }}>
            <Button 
              onClick={handleCloseDialog}
              sx={{
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                color: '#666'
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingDashboard ? handleUpdate : handleCreate}
              variant="contained"
              disabled={!formData.name.trim()}
              sx={{
                borderRadius: 2,
                px: 4,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%)'
                },
                '&:disabled': {
                  background: '#ccc'
                }
              }}
            >
              {editingDashboard ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={openDeleteDialog}
          onClose={handleDeleteCancel}
          maxWidth="xs"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.15)'
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 2,
            pb: 2,
            pt: 3,
            px: 3
          }}>
            <Box
              sx={{
                bgcolor: 'rgba(244, 67, 54, 0.1)',
                borderRadius: '50%',
                p: 1.5,
                display: 'flex'
              }}
            >
              <WarningIcon sx={{ color: '#f44336', fontSize: 28 }} />
            </Box>
            <Typography variant="h6" fontWeight="700" sx={{ color: '#1a1a2e' }}>
              Delete Dashboard
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ px: 3, pb: 2 }}>
            <Typography variant="body1" color="text.secondary">
              Are you sure you want to delete{' '}
              <strong style={{ color: '#1a1a2e' }}>
                "{deletingDashboard?.name}"
              </strong>
              ? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
            <Button
              onClick={handleDeleteCancel}
              variant="outlined"
              sx={{
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
                borderColor: '#ddd',
                color: '#666',
                '&:hover': {
                  borderColor: '#bbb',
                  bgcolor: 'rgba(0, 0, 0, 0.02)'
                }
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              sx={{
                borderRadius: 2,
                px: 4,
                bgcolor: '#f44336',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#d32f2f'
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
};

export default DashboardsManagement;