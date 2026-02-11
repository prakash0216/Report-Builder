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
  alpha,
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
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  Description as DocsIcon,
  Help as HelpIcon,
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
import OnClickConfigTab from '../components/OnClickConfigTab';
import { ViewModule as ViewModuleIcon, TouchApp as TouchAppIcon, Mouse as MouseIcon } from '@mui/icons-material';

// Define the available tabs
type TabKey = 'parameters' | 'filters' | 'hooks' | 'others' | 'tooltipConfig' | 'childCards' | 'onClickActions';

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

// Left Icon Sidebar Component
const LeftSidebar: React.FC<{ dashboardSlug?: string; viewSlug?: string }> = ({ dashboardSlug, viewSlug }) => {
  const navigate = useNavigate();
  const [auth] = useRecoilState(authState);

  return (
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
          onClick={() => navigate('/')}
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
          onClick={() => navigate('/')}
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

      {/* Spacer */}
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
  const navigate = useNavigate();
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
      key: 'onClickActions',
      label: 'onClick Actions',
      icon: MouseIcon,
      component: OnClickConfigTab,
      color: '#ef4444'
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
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC' }}>
      {/* Left Icon Sidebar */}
      <LeftSidebar dashboardSlug={dashboardSlug} viewSlug={viewSlug} />
      
      {/* Main Content Area */}
      <Box sx={{ flex: 1, ml: '72px', display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#E5E7EB' }}>
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
                onClick={() => navigate(backUrl)}
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
                  }
                }}
              >
                Back
              </Button>
              
              <Divider orientation="vertical" flexItem sx={{ height: 32, alignSelf: 'center' }} />
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ width: 4, height: 32, bgcolor: '#3B82F6', borderRadius: 1 }} />
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#1F2937' }}>
                    Chart Editor
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#6B7280' }}>
                    Card ID: {id}
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Right - Dashboard/View Info */}
            {dashboardSlug && viewSlug && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={dashboardSlug}
                  size="small"
                  sx={{
                    bgcolor: '#EEF2FF',
                    color: '#4F46E5',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 1.5 },
                  }}
                />
                <Typography sx={{ color: '#9CA3AF', fontSize: '0.875rem' }}>/</Typography>
                <Chip
                  label={viewSlug}
                  size="small"
                  sx={{
                    bgcolor: '#ECFDF5',
                    color: '#059669',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    '& .MuiChip-label': { px: 1.5 },
                  }}
                />
              </Box>
            )}
          </Paper>
        </Box>

        {/* Content Card */}
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
            {/* Tab Navigation */}
            <Box sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'center' }}>
              <Tabs
                value={activeTabIndex}
                onChange={handleTabChange}
                centered
                sx={{
                  minHeight: 56,
                  '& .MuiTabs-indicator': {
                    height: 3,
                    bgcolor: '#3B82F6',
                    borderRadius: '3px 3px 0 0',
                  },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    minHeight: 56,
                    px: 2.5,
                    color: '#6B7280',
                    transition: 'all 0.2s',
                    '&.Mui-selected': {
                      color: '#3B82F6',
                    },
                    '&:hover': {
                      bgcolor: alpha('#3B82F6', 0.05),
                      color: '#3B82F6',
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
                              width: 28,
                              height: 28,
                              borderRadius: 1.5,
                              bgcolor: activeTabIndex === index ? alpha('#3B82F6', 0.1) : '#F3F4F6',
                              transition: 'all 0.2s',
                            }}
                          >
                            <IconComponent 
                              sx={{ 
                                fontSize: 16,
                                color: activeTabIndex === index ? '#3B82F6' : '#6B7280',
                              }} 
                            />
                          </Box>
                          <Box 
                            component="span" 
                            sx={{ 
                              display: { xs: 'none', md: 'inline' },
                              fontWeight: activeTabIndex === index ? 600 : 500,
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
            </Box>

            {/* Tab Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3, bgcolor: '#F8FAFC' }}>
              {tabs.map((tab, index) => {
                const Component = tab.component;
                return (
                  <TabPanel key={tab.key} value={activeTabIndex} index={index}>
                    <Component />
                  </TabPanel>
                );
              })}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default EditChart;