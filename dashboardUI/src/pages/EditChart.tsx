import React, { useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";
import { useRecoilState } from 'recoil';
import { authState, authAPI } from '../recoil/AuthState';
import { useDashboardContext } from '../context/DashboardContext';
import NotFound from './NotFound';
import { 
  AppBar,
  Toolbar,
  Box,
  Button,
  Typography,
  Container,
  Paper,
  Tabs,
  Tab,
  Divider,
  Chip,
  IconButton,
  Avatar,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Dataset as DatabaseIcon,
  Code as CodeIcon,
  BarChart as BarChartIcon,
  Bolt as BoltIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  FilterAlt as FilterAltIcon,
  Tune as TuneIcon,
  MiscellaneousServices as MiscellaneousServicesIcon,
  Logout as LogoutIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import JsCompiler from "../components/JsCompiler";
import Hooks from '../components/Hooks';
import Parameters from '../components/Parameters';
import Filters from '../components/Filters';
import {IsVisible} from "../components/IsVisible";
import { CardArrangement } from '../components/CardArrangement';
import Others from '../components/Others';
import ChildCardConfigTab from '../components/ChildCardConfigTab';
import MultiCardTooltipConfigTab from '../components/MultiCardTooltipConfigTab';
import { ViewModule as ViewModuleIcon, TouchApp as TouchAppIcon } from '@mui/icons-material';

// Define the available tabs
type TabKey = 'parameters' | 'filters' | 'hooks' | 'others' | 'tooltipConfig' | 'childCards';

// Tab configuration
interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ sx?: any }>;
  component: React.ComponentType;
  color: string;
}

// Define the URL params type
interface ChartParams {
  id: string;
  dashboardName?: string;
  viewName?: string;
  [key: string]: string | undefined;
}

// Navigation Bar Component
const NavBar: React.FC<{ chartId: string; dashboardSlug?: string; viewSlug?: string }> = ({ chartId, dashboardSlug, viewSlug }) => {
  const navigate = useNavigate();
  const [auth, setAuth] = useRecoilState(authState);
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);

  // Build back navigation URL
  const backUrl = dashboardSlug && viewSlug ? `/${dashboardSlug}/${viewSlug}` : '/';

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

  return (
    <AppBar 
      position="sticky" 
      elevation={0}
      sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 4px 20px 0 rgba(102, 126, 234, 0.3)',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 70, sm: 76 }, px: { xs: 2, sm: 4 } }}>
        {/* Left section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(backUrl)}
            sx={{ 
              color: 'white',
              textTransform: 'none',
              fontWeight: 500,
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              px: 2.5,
              py: 1,
              borderRadius: 2,
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 0.2)',
              }
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Back to Dashboard
            </Box>
            <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>
              Back
            </Box>
          </Button>
          
          <Divider 
            orientation="vertical" 
            flexItem 
            sx={{ 
              height: 32, 
              alignSelf: 'center',
              bgcolor: 'rgba(255, 255, 255, 0.2)',
              borderColor: 'rgba(255, 255, 255, 0.2)'
            }} 
          />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box 
              sx={{ 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                p: 1.5,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(245, 87, 108, 0.3)',
              }}
            >
              <BarChartIcon sx={{ color: 'white', fontSize: 24 }} />
            </Box>
            <Box>
              <Typography 
                variant="h6" 
                fontWeight={700} 
                sx={{ 
                  color: 'white',
                  letterSpacing: 0.5,
                  fontSize: { xs: '1rem', sm: '1.25rem' }
                }}
              >
                Chart Editor
              </Typography>
              <Typography 
                variant="caption" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                }}
              >
                ID: {chartId}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* User Menu */}
        <Box>
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
  );
};

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`chart-tabpanel-${index}`}
      aria-labelledby={`chart-tab-${index}`}
    >
      {value === index && (
        <Box sx={{ minHeight: 500 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const EditChart: React.FC = () => {
  const { id, dashboardName: dashboardSlug, viewName: viewSlug } = useParams<ChartParams>();
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);
  
  // Get dashboard context for error handling
  const { isLoading: contextLoading, errorType } = useDashboardContext();

  // Tab configuration with colors
  const tabs: Tab[] = [
    {
      key: 'childCards',
      label: 'MultiCard Viz Config',
      icon: ViewModuleIcon,
      component: ChildCardConfigTab,
      color: '#764ba2'
    },
    {
      key: 'tooltipConfig',
      label: 'MultiCard Tooltip Config',
      icon: TouchAppIcon,
      component: MultiCardTooltipConfigTab,
      color: '#f59e0b'
    },
    {
      key: 'hooks',
      label: 'Calculations',
      icon: BoltIcon,
      component: Hooks,
      color: '#fa709a'
    },
    {
      key: 'parameters',
      label: 'Parameters',
      icon: TuneIcon,
      component: Parameters,
      color: '#f093fb'
    },
    {
      key: 'filters',
      label: 'Filters',
      icon: FilterAltIcon,
      component: Filters,
      color: '#43e97b'
    },
    {
      key: 'others',
      label: 'Card Configuration',
      icon: MiscellaneousServicesIcon,
      component: Others,
      color: '#ffd89b'
    }
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTabIndex(newValue);
  };

  // 🔥 CRITICAL: Show 404 page if dashboard or view doesn't exist
  if (!contextLoading && errorType) {
    if (errorType === 'dashboard_not_found') {
      return <NotFound type="dashboard" />;
    }
    if (errorType === 'view_not_found') {
      return <NotFound type="view" />;
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)' }}>
      {/* Navigation Bar */}
      <NavBar chartId={id || 'No ID provided'} dashboardSlug={dashboardSlug} viewSlug={viewSlug} />
      
      {/* Main Content */}
      <Container maxWidth={false} sx={{ py:4 }}>
        {/* Header Section */}

        {/* Tabs Container */}
        <Box sx={{ width: '100%' }}>
          {/* Tab Navigation */}
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: '16px 16px 0 0',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={activeTabIndex}
              onChange={handleTabChange}
              centered
              sx={{
                px: 2,
                py: 1.5,
                minHeight: 64,
                '& .MuiTabs-indicator': {
                  height: 4,
                  borderRadius: '4px 4px 0 0',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                },
                '& .MuiTabs-scrollButtons': {
                  color: '#667eea',
                  '&.Mui-disabled': {
                    opacity: 0.3,
                  }
                },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  minHeight: 64,
                  px: 3,
                  py: 2,
                  color: '#6b7280',
                  borderRadius: 2,
                  transition: 'all 0.3s ease',
                  '&.Mui-selected': {
                    color: '#667eea',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.2)',
                  },
                  '&:hover': {
                    background: 'rgba(102, 126, 234, 0.05)',
                    color: '#667eea',
                  },
                },
              }}
            >
              {tabs.map((tab, index) => {
                const IconComponent = tab.icon;
                return (
                  <Tab
                    key={tab.key}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 32,
                            height: 32,
                            borderRadius: '8px',
                            background: activeTabIndex === index 
                              ? `linear-gradient(135deg, ${tab.color} 0%, ${tab.color}dd 100%)`
                              : 'rgba(102, 126, 234, 0.1)',
                            transition: 'all 0.3s ease',
                          }}
                        >
                          <IconComponent 
                            sx={{ 
                              fontSize: 18,
                              color: activeTabIndex === index ? 'white' : tab.color,
                            }} 
                          />
                        </Box>
                        <Box 
                          component="span" 
                          sx={{ 
                            display: { xs: 'none', sm: 'inline' },
                            fontWeight: activeTabIndex === index ? 700 : 600,
                          }}
                        >
                          {tab.label}
                        </Box>
                      </Box>
                    }
                    id={`chart-tab-${index}`}
                    aria-controls={`chart-tabpanel-${index}`}
                  />
                );
              })}
            </Tabs>
          </Paper>

          {/* Tab Content */}
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: '0 0 16px 16px',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderTop: 0,
              p: 4,
              minHeight: 500,
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
            }}
          >
            {tabs.map((tab, index) => {
              const Component = tab.component;
              return (
                <TabPanel key={tab.key} value={activeTabIndex} index={index}>
                  <Component />
                </TabPanel>
              );
            })}
          </Paper>
        </Box>
      </Container>
    </Box>
  );
};

export default EditChart;