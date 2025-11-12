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
    <Box sx={{ width: '100%', minHeight: '100vh', bgcolor: 'grey.50', p: 3 }}>
      <Box >
        <Paper elevation={2} sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.95rem',
                py: 2,
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