import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { authState } from '../recoil/AuthState';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Avatar,
  CircularProgress,
  Chip,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  Description as DocsIcon,
  Help as HelpIcon,
  OpenInNew as OpenInNewIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/api.config';

const API_BASE = API_BASE_URL || '';

interface EmbedData {
  name: string;
  embedType: 'iframe' | 'tableau' | '';
  embedLink: string;
  dashboardName?: string;
  dashboardSlug?: string;
}

const EmbedView: React.FC = () => {
  const { dashboardSlug, viewSlug } = useParams<{ dashboardSlug: string; viewSlug?: string }>();
  const navigate = useNavigate();
  const [auth] = useRecoilState(authState);
  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const fetchEmbedData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        if (viewSlug) {
          // Fetch view embed data
          const response = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}/views`);
          const data = await response.json();
          
          if (data.success && data.views) {
            const view = data.views.find((v: any) => v.slug === viewSlug);
            // Check both snake_case (from raw DB) and camelCase (if transformed)
            const embedType = view?.embed_type || view?.embedType;
            const embedLink = view?.embed_link || view?.embedLink;
            
            if (view && embedType && embedLink) {
              // Also fetch dashboard name
              const dashResponse = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}`);
              const dashData = await dashResponse.json();
              
              setEmbedData({
                name: view.name,
                embedType: embedType,
                embedLink: embedLink,
                dashboardName: dashData.success ? dashData.dashboard.name : dashboardSlug,
                dashboardSlug: dashboardSlug,
              });
            } else {
              setError('No embed link configured for this view');
            }
          } else {
            setError('View not found');
          }
        } else {
          // Fetch dashboard embed data
          const response = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}`);
          const data = await response.json();
          
          if (data.success && data.dashboard) {
            const dashboard = data.dashboard;
            // Check both snake_case and camelCase
            const embedType = dashboard.embed_type || dashboard.embedType;
            const embedLink = dashboard.embed_link || dashboard.embedLink;
            
            if (embedType && embedLink) {
              setEmbedData({
                name: dashboard.name,
                embedType: embedType,
                embedLink: embedLink,
              });
            } else {
              setError('No embed link configured for this dashboard');
            }
          } else {
            setError('Dashboard not found');
          }
        }
      } catch (err) {
        console.error('Error fetching embed data:', err);
        setError('Failed to load embed data');
      } finally {
        setLoading(false);
      }
    };

    fetchEmbedData();
  }, [dashboardSlug, viewSlug]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const openInNewTab = () => {
    if (embedData?.embedLink) {
      window.open(embedData.embedLink, '_blank');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#3B82F6' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', maxWidth: 400 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}
          >
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Left Icon Sidebar - Hidden in fullscreen */}
      {!isFullscreen && (
        <Box
          sx={{
            width: 72,
            bgcolor: '#F8FAFC',
            borderRight: '1px solid #E5E7EB',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 2,
            gap: 1,
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 50,
          }}
        >
          {/* RBI Logo */}
          <Box
            component="img"
            src="/RBI.png"
            alt="RBI"
            sx={{
              width: 50,
              height: 50,
              objectFit: 'contain',
              mb: 2,
            }}
          />

          {/* Home */}
          <Tooltip title="Home" placement="right">
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
          </Tooltip>

          {/* Libraries */}
          <Tooltip title="Libraries" placement="right">
            <Box
              onClick={() => navigate('/?nav=libraries')}
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
          </Tooltip>

          {/* Data */}
          <Tooltip title="Data & Connections" placement="right">
            <Box
              onClick={() => navigate('/?nav=data')}
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
              <StorageIcon sx={{ fontSize: 22 }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Data</Typography>
            </Box>
          </Tooltip>

          {/* Functions */}
          <Tooltip title="Predefined Functions" placement="right">
            <Box
              onClick={() => navigate('/?nav=functions')}
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
              <FunctionsIcon sx={{ fontSize: 22 }} />
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>Functions</Typography>
            </Box>
          </Tooltip>

          <Box sx={{ flex: 1 }} />

          {/* Docs */}
          <Tooltip title="Documentation" placement="right">
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
          </Tooltip>

          {/* Help */}
          <Tooltip title="Help" placement="right">
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
          </Tooltip>

          {/* User Avatar */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1 }}>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                bgcolor: '#3B82F6',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {auth.email ? auth.email[0].toUpperCase() : 'U'}
            </Avatar>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25, color: '#6B7280' }}>Account</Typography>
          </Box>
        </Box>
      )}

      {/* Main Content Area */}
      <Box 
        sx={{ 
          flex: 1, 
          ml: isFullscreen ? 0 : '72px', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden', 
          bgcolor: '#E5E7EB',
          transition: 'margin-left 0.3s ease',
        }}
      >
        {/* Top Header Card */}
        <Box sx={{ p: 2, pb: 0 }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FFFFFF',
              borderRadius: 3,
              px: 3,
              py: 1.5,
              border: '1px solid #E5E7EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {/* Left - Back & Title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(-1)}
                variant="outlined"
                size="small"
                sx={{
                  color: '#6B7280',
                  borderColor: '#E5E7EB',
                  textTransform: 'none',
                  fontWeight: 500,
                  '&:hover': {
                    bgcolor: '#F3F4F6',
                    borderColor: '#D1D5DB',
                  },
                }}
              >
                Back
              </Button>

              <Box sx={{ width: 1, height: 32, bgcolor: '#E5E7EB' }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 4, height: 32, bgcolor: '#3B82F6', borderRadius: 1 }} />
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#1F2937' }}>
                    {embedData?.name}
                  </Typography>
                  {embedData?.dashboardName && viewSlug && (
                    <Typography variant="caption" sx={{ color: '#6B7280' }}>
                      {embedData.dashboardName}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Box>

            {/* Right - Actions & Type Badge */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Chip
                label={embedData?.embedType === 'tableau' ? 'Tableau Dashboard' : 'Embedded Content'}
                size="small"
                sx={{
                  bgcolor: embedData?.embedType === 'tableau' ? '#EEF2FF' : '#ECFDF5',
                  color: embedData?.embedType === 'tableau' ? '#4F46E5' : '#059669',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                }}
              />
              
              <Tooltip title="Open in new tab">
                <IconButton
                  onClick={openInNewTab}
                  size="small"
                  sx={{
                    color: '#6B7280',
                    '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
                  }}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>

              <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                <IconButton
                  onClick={toggleFullscreen}
                  size="small"
                  sx={{
                    color: '#6B7280',
                    '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
                  }}
                >
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
        </Box>

        {/* Embed Content Card */}
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
            {/* Demo Placeholder UI */}
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 3,
                bgcolor: '#F8FAFC',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Background Pattern */}
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  backgroundImage: `
                    radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.05) 0%, transparent 50%),
                    radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.05) 0%, transparent 50%),
                    linear-gradient(90deg, rgba(59, 130, 246, 0.03) 1px, transparent 1px),
                    linear-gradient(rgba(59, 130, 246, 0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
                }}
              />

              {/* Main Content */}
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  textAlign: 'center',
                  maxWidth: 600,
                  px: 4,
                }}
              >
                {/* Icon */}
                <Box
                  sx={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    bgcolor: embedData?.embedType === 'tableau' ? 'rgba(79, 70, 229, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 3,
                    border: `3px dashed ${embedData?.embedType === 'tableau' ? '#4F46E5' : '#059669'}`,
                  }}
                >
                  {embedData?.embedType === 'tableau' ? (
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                      }}
                    >
                      {/* Tableau-like icon */}
                      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                        <Box sx={{ flex: 1, bgcolor: '#4F46E5', borderRadius: 1 }} />
                        <Box sx={{ flex: 1, bgcolor: '#818CF8', borderRadius: 1 }} />
                      </Box>
                      <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                        <Box sx={{ flex: 1, bgcolor: '#A5B4FC', borderRadius: 1 }} />
                        <Box sx={{ flex: 1, bgcolor: '#4F46E5', borderRadius: 1 }} />
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        width: 60,
                        height: 60,
                        border: '3px solid #059669',
                        borderRadius: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                      }}
                    >
                      <Typography sx={{ color: '#059669', fontWeight: 700, fontSize: '0.7rem' }}>
                        {'</>'}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {/* Title */}
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: '#1F2937',
                    mb: 2,
                  }}
                >
                  {embedData?.embedType === 'tableau' ? 'Tableau Dashboard' : 'Embedded Content'}
                </Typography>

                {/* Subtitle */}
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 500,
                    color: '#6B7280',
                    mb: 3,
                  }}
                >
                  {embedData?.embedType === 'tableau' 
                    ? 'Your Tableau visualization will appear here'
                    : 'Your embedded iframe content will appear here'
                  }
                </Typography>

                {/* Info Box */}
                <Paper
                  elevation={0}
                  sx={{
                    p: 3,
                    borderRadius: 3,
                    bgcolor: 'white',
                    border: '1px solid #E5E7EB',
                    mb: 3,
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', mb: 1.5 }}>
                    Configured Embed Link:
                  </Typography>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#F3F4F6',
                      borderRadius: 2,
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      color: '#4B5563',
                      wordBreak: 'break-all',
                      textAlign: 'left',
                    }}
                  >
                    {embedData?.embedLink || 'No link configured'}
                  </Box>
                </Paper>

                {/* Action Buttons */}
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate(-1)}
                    sx={{
                      color: '#6B7280',
                      borderColor: '#E5E7EB',
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 3,
                      '&:hover': {
                        bgcolor: '#F3F4F6',
                        borderColor: '#D1D5DB',
                      },
                    }}
                  >
                    Go Back
                  </Button>
                  {embedData?.embedLink && (
                    <Button
                      variant="contained"
                      startIcon={<OpenInNewIcon />}
                      onClick={openInNewTab}
                      sx={{
                        bgcolor: embedData?.embedType === 'tableau' ? '#4F46E5' : '#059669',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        '&:hover': {
                          bgcolor: embedData?.embedType === 'tableau' ? '#4338CA' : '#047857',
                        },
                      }}
                    >
                      Open Actual Link
                    </Button>
                  )}
                </Box>
              </Box>

              {/* Decorative Elements */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 40,
                  right: 60,
                  width: 80,
                  height: 80,
                  borderRadius: 2,
                  bgcolor: 'rgba(59, 130, 246, 0.08)',
                  transform: 'rotate(15deg)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 60,
                  left: 40,
                  width: 60,
                  height: 60,
                  borderRadius: '50%',
                  bgcolor: 'rgba(16, 185, 129, 0.08)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  top: '30%',
                  left: 80,
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  border: '2px dashed rgba(59, 130, 246, 0.2)',
                  transform: 'rotate(-10deg)',
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  bottom: '25%',
                  right: 100,
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  border: '2px dashed rgba(16, 185, 129, 0.2)',
                }}
              />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default EmbedView;

