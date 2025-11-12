import React, { useState } from 'react';
import { useParams, useNavigate } from "react-router-dom";
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
} from '@mui/material';
import {
  Dataset as DatabaseIcon,
  Code as CodeIcon,
  BarChart as BarChartIcon,
  Bolt as BoltIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
  FilterAlt as FilterAltIcon,
  AcUnit as SnowflakeIcon,
  Tune as TuneIcon,
  MiscellaneousServices as MiscellaneousServicesIcon,
  CloudQueue,
  Storage,
  Visibility,
} from '@mui/icons-material';
import JsCompiler from "../components/JsCompiler";
import AddDataSource from "../components/AddDataSource";
import HighChartField from "../components/HighChartField";
import Hooks from '../components/Hooks';
import SnowflakeConnector from '../components/SnowflakeConnector';
import Parameters from '../components/Parameters';
import Filters from '../components/Filters';
// import { Others } from '../components/Others';
import {IsVisible} from "../components/IsVisible";
import { CardArrangement } from '../components/CardArrangement';
import Others from '../components/Others';

// Define the available tabs
type TabKey = 'connectionManager' | 'parameters' | 'dataSource' | 'filters' | 'hooks' | 'highChart' | 'others';

// Tab configuration
interface Tab {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ sx?: any }>;
  component: React.ComponentType;
}

// Define the URL params type
interface ChartParams {
  id: string;
  [key: string]: string | undefined;
}

// Navigation Bar Component
const NavBar: React.FC<{ chartId: string }> = ({ chartId }) => {
  const navigate = useNavigate();

  return (
    <AppBar 
      position="sticky" 
      color="default" 
      elevation={1}
      sx={{ 
        bgcolor: 'white',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 64, sm: 70 } }}>
        {/* Left section */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate("/dashboards")}
            sx={{ 
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
              }
            }}
          >
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
              Back to Charts
            </Box>
          </Button>
          
          <Divider orientation="vertical" flexItem sx={{ height: 24, alignSelf: 'center' }} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box 
              sx={{ 
                bgcolor: 'primary.main', 
                p: 1, 
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BarChartIcon sx={{ color: 'white', fontSize: 20 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={600} color="text.primary">
                Chart Editor
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                ID: {chartId}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Center section - Auto-saved status (placeholder) */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center' }}>
          <Chip 
            label="" 
            size="small"
            sx={{ 
              bgcolor: 'success.50',
              visibility: 'hidden', // Hidden as per original
            }}
          />
        </Box>

        {/* Right section */}
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={() => navigate("/dashboards")}
            sx={{ 
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: 2,
            }}
          >
            Save
          </Button>
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
  const { id } = useParams<ChartParams>();
  const [activeTabIndex, setActiveTabIndex] = useState<number>(0);

  // Tab configuration
  const tabs: Tab[] = [
    {
      key: 'connectionManager',
      label: 'Connection Manager',
      icon: SnowflakeIcon,
      component: SnowflakeConnector
    },
    {
      key: 'parameters',
      label: 'Parameters',
      icon: TuneIcon,
      component: Parameters
    },
    {
      key: 'dataSource',
      label: 'Data Source',
      icon: CloudQueue,
      component: AddDataSource
    },
    {
      key: 'filters',
      label: 'Filters',
      icon: FilterAltIcon,
      component: Filters
    },
    {
      key: 'hooks',
      label: 'Calculations',
      icon: BoltIcon,
      component: Hooks
    },
    {
      key: 'highChart',
      label: 'Chart Config',
      icon: BarChartIcon,
      component: HighChartField
    },
    {
      key: 'others',
      label: 'Others',
      icon: MiscellaneousServicesIcon,
      component: Others
    }
  ];

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTabIndex(newValue);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Navigation Bar */}
      <NavBar chartId={id || 'No ID provided'} />
      
      {/* Main Content */}
      <Container maxWidth={false} sx={{ py: 3 }}>
        {/* Header Section */}
        <Paper 
          elevation={0}
          sx={{ 
            mb: 4, 
            p: 3,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={700} color="text.primary" gutterBottom>
              Chart Configuration
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure your chart's connections, parameters, data sources, filters, hooks, and visualization settings
            </Typography>
          </Box>
        </Paper>

        {/* Tabs Container */}
        <Box sx={{ width: '100%' }}>
          {/* Tab Navigation */}
          <Paper 
            elevation={0}
            sx={{ 
              borderRadius: '8px 8px 0 0',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Tabs
              value={activeTabIndex}
              onChange={handleTabChange}
              // variant="scrollable"
              // scrollButtons="auto"
              allowScrollButtonsMobile
              centered
              sx={{
                bgcolor: 'grey.100',
                borderRadius: '8px 8px 0 0',
                px: 0.5,
                py: 0.5,
                minHeight: 48,
                '& .MuiTabs-indicator': {
                  height: 3,
                  borderRadius: '3px 3px 0 0',
                },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  minHeight: 48,
                  color: 'text.secondary',
                  '&.Mui-selected': {
                    color: 'primary.main',
                    bgcolor: 'white',
                    borderRadius: '6px 6px 0 0',
                    boxShadow: '0 -1px 3px rgba(0,0,0,0.05)',
                  },
                  '&:hover': {
                    bgcolor: 'grey.50',
                    color: 'text.primary',
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
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconComponent sx={{ fontSize: 18 }} />
                        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
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
              borderRadius: '0 0 8px 8px',
              border: 1,
              borderTop: 0,
              borderColor: 'divider',
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


// import React, { useState } from 'react';
// import { useParams, useNavigate } from "react-router-dom";
// import { 
//   Database, 
//   Code, 
//   BarChart3,
//   Zap,
//   Save,
//   ArrowLeft,
//   Filter,
//   Snowflake,
//   SlidersHorizontal
// } from 'lucide-react';
// import JsCompiler from "../components/JsCompiler";
// import AddDataSource from "../components/AddDataSource";
// import HighChartField from "../components/HighChartField";
// import Hooks from '../components/Hooks';
// import SnowflakeConnector from '../components/SnowflakeConnector';
// import Parameters from '../components/Parameters';
// import Filters from '../components/Filters';
// import { MiscellaneousServices, MiscellaneousServicesSharp } from '@mui/icons-material';
// import { Others } from '../components/Others';

// // Define the available tabs
// type TabKey = 'connectionManager' | 'parameters' | 'dataSource' | 'filters' | 'hooks' | 'highChart' | 'others';

// // Tab configuration
// interface Tab {
//   key: TabKey;
//   label: string;
//   icon: React.ComponentType<{ className?: string }>;
//   component: React.ComponentType;
// }

// // Define the URL params type
// interface ChartParams {
//   id: string;
//   [key: string]: string | undefined;
// }

// // Navigation Bar Component
// const NavBar: React.FC<{ chartId: string }> = ({ chartId }) => {
//   const navigate = useNavigate();

//   return (
//     <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
//       <div className="px-4 sm:px-6 lg:px-8">
//         <div className="grid grid-cols-3 items-center h-16">
//           {/* Left section */}
//           <div className="flex items-center space-x-4">
//             <button 
//               onClick={() => navigate("/dashboards")}
//               className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
//             >
//               <ArrowLeft className="h-5 w-5" />
//               <span className="hidden sm:inline">Back to Charts</span>
//             </button>
            
//             <div className="h-6 border-l border-gray-300"></div>
            
//             <div className="flex items-center space-x-3">
//               <div className="bg-blue-600 p-2 rounded-lg">
//                 <BarChart3 className="h-5 w-5 text-white" />
//               </div>
//               <div>
//                 <h1 className="text-lg font-semibold text-gray-900">Chart Editor</h1>
//                 <p className="text-sm text-gray-500">ID: {chartId}</p>
//               </div>
//             </div>
//           </div>

//           {/* Center section - Auto-saved status */}
//           <div className="flex justify-center">
//             <div className="flex items-center space-x-1 bg-green-50 px-3 py-1 rounded-full">
              
//             </div>
//           </div>

//           {/* Right section */}
//           <div className="flex justify-end items-center">
//             <button 
//               onClick={() => navigate("/dashboards")}
//               className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
//             >
//               <Save className="h-4 w-4" />
//               <span>Save</span>
//             </button>
//           </div>
//         </div>
//       </div>
//     </nav>
//   );
// };

// // Tab Button Component
// interface TabButtonProps {
//   tab: Tab;
//   isActive: boolean;
//   onClick: () => void;
// }

// const TabButton: React.FC<TabButtonProps> = ({ tab, isActive, onClick }) => {
//   const Icon = tab.icon;
  
//   return (
//     <button
//       onClick={onClick}
//       className={`
//         flex items-center space-x-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all duration-200
//         ${isActive 
//           ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm' 
//           : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
//         }
//       `}
//       type="button"
//     >
//       <Icon className="h-4 w-4" />
//       <span className="hidden sm:inline">{tab.label}</span>
//     </button>
//   );
// };

// // Tab Content Component
// interface TabContentProps {
//   children: React.ReactNode;
// }

// const TabContent: React.FC<TabContentProps> = ({ children }) => {
//   return (
//     <div className="bg-white rounded-b-lg rounded-tr-lg border border-gray-200 shadow-sm min-h-[500px]">
//       {children}
//     </div>
//   );
// };

// const EditChart: React.FC = () => {
//   const { id } = useParams<ChartParams>();
  
//   // State to manage active tab
//   const [activeTab, setActiveTab] = useState<TabKey>('connectionManager');

//   // Tab configuration
//   const tabs: Tab[] = [
//     {
//       key: 'connectionManager',
//       label: 'Connection Manager',
//       icon: Snowflake,
//       component: SnowflakeConnector
//     },
//     {
//       key: 'parameters',
//       label: 'Parameters',
//       icon: SlidersHorizontal,
//       component: Parameters
//     },
//     {
//       key: 'dataSource',
//       label: 'Data Source',
//       icon: Database,
//       component: AddDataSource
//     },
//     {
//       key: 'filters',
//       label: 'Filters',
//       icon: Filter,
//       component: Filters
//     },
//     {
//       key: 'hooks',
//       label: 'Calculations',
//       icon: Zap,
//       component: Hooks
//     },
//     {
//       key: 'highChart',
//       label: 'Chart Config',
//       icon: BarChart3,
//       component: HighChartField
//     },
//     {
//       key:'others',
//       label:'Others',
//       icon: MiscellaneousServicesSharp,
//       component: Others
//     }
//   ];

//   // Get the active tab component
//   const ActiveComponent = tabs.find(tab => tab.key === activeTab)?.component || SnowflakeConnector;

//   return (
//     <div className="min-h-screen bg-gray-50">
//       {/* Navigation Bar */}
//       <NavBar chartId={id || 'No ID provided'} />
      
//       {/* Main Content */}
//       <div className="p-6 w-full mx-auto">
//         {/* Header Section */}
//         <div className="mb-8">
//           <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
//             <div className="text-center">
//               <h2 className="text-3xl font-bold text-gray-900 mb-3">
//                 Chart Configuration
//               </h2>
//               <p className="text-gray-600 text-lg">
//                 Configure your chart's connections, parameters, data sources, filters, hooks, and visualization settings
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Tabs Container */}
//         <div className="w-full">
//           {/* Tab Navigation */}
//           <div className="flex flex-wrap justify-center gap-1 bg-gray-100 p-1 rounded-t-lg border-b border-gray-200">
//             {tabs.map((tab) => (
//               <TabButton
//                 key={tab.key}
//                 tab={tab}
//                 isActive={activeTab === tab.key}
//                 onClick={() => setActiveTab(tab.key)}
//               />
//             ))}
//           </div>

//           {/* Tab Content */}
//           <TabContent>
//             <ActiveComponent />
//           </TabContent>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default EditChart;
