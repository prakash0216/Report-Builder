import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';
import { IsVisible } from './IsVisible';
import { CardArrangement } from './CardArrangement';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`others-tabpanel-${index}`}
      aria-labelledby={`others-tab-${index}`}
      {...other}
    >
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function Others() {
  const { id } = useParams<{ id: string }>();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box 
      sx={{ 
        width: '100%', 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        p: 3,
      }}
    >
      <Box>
        <Paper 
          elevation={0} 
          sx={{ 
            borderRadius: 3, 
            overflow: 'hidden',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.95rem',
                py: 2,
                color: '#64748b',
                '&.Mui-selected': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                },
              },
              '& .MuiTabs-indicator': {
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                height: 3,
              },
            }}
          >
            <Tab
              icon={<VisibilityIcon />}
              iconPosition="start"
              label="Is Visible"
              id="others-tab-0"
              aria-controls="others-tabpanel-0"
            />
            <Tab
              icon={<ViewModuleIcon />}
              iconPosition="start"
              label="Card Arrangement"
              id="others-tab-1"
              aria-controls="others-tabpanel-1"
            />
          </Tabs>

          {/* Tab Content */}
          <TabPanel value={tabValue} index={0}>
            <IsVisible />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ p: 4 }}>
              <CardArrangement/>
            </Box>
          </TabPanel>
        </Paper>
      </Box>
    </Box>
  );
}