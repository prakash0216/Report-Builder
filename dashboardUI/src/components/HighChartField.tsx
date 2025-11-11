import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chartConfigState } from "../recoil/ChartConfig";
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import ResizableChart from "./ResizableChart";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Grid,
  Alert,
  AlertTitle,
  Chip,
  AppBar,
  Toolbar,
  TextField,
  MenuItem,
  Divider,
  Stack,
  Collapse,
} from '@mui/material';
import {
  Save as SaveIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Code as CodeIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  StackedBarChart as StackedBarChartIcon,
  Timeline as TimelineIcon,
  StackedBarChartTwoTone,
  StackedBarChartSharp,
  StackedLineChart,
} from '@mui/icons-material';
import { AreaChartIcon, Columns, Columns2Icon, Columns3CogIcon, DonutIcon, ScatterChartIcon } from "lucide-react";

const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return Function('"use strict";return (' + value + ')')();
    } catch {
      return value;
    }
  }
};

const highchartsTemplateList = [
  {
    label: "Custom/Manual",
    icon: <CodeIcon fontSize="small" />,
    value: null,
    isDefault: true
  },
  {
    label: "Line Chart",
    icon: <ShowChartIcon fontSize="small" />,
    value: {
      chart: { type: "line" },
      title: { text: "Line Chart Example" },
      xAxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Series 1", data: [10, 20, 15, 25, 30] }],
      credits: { enabled: false }
    }
  },
  {
    label: "Area Chart",
    icon: <AreaChartIcon fontSize="small" />,
    value: {
      chart: { type: "area" },
      title: { text: "Area Chart Example" },
      xAxis: { categories: ["A", "B", "C", "D", "E"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Data Set 1", data: [5, 9, 12, 8, 15] }],
      credits: { enabled: false }
    }
  },
  {
    label: "Stacked Area Chart",
    icon: <StackedLineChart fontSize="small" />,
    value: {
      chart: { type: "area" },
      title: { text: "Stacked Area Chart" },
      plotOptions: { area: { stacking: "normal" } },
      xAxis: { categories: ["Q1", "Q2", "Q3", "Q4"] },
      series: [
        { name: "Product A", data: [50, 60, 70, 80] },
        { name: "Product B", data: [30, 40, 20, 50] }
      ],
      credits: { enabled: false }
    }
  },
  {
    label: "Bar Chart",
    icon: <BarChartIcon fontSize="small" />,
    value: {
      chart: { type: "bar" },
      title: { text: "Bar Chart Example" },
      xAxis: { categories: ["Category A", "Category B", "Category C"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Data", data: [100, 80, 120] }],
      credits: { enabled: false }
    }
  },
  {
    label: "Column Chart",
    icon: <Columns3CogIcon fontSize="small" />,
    value: {
      chart: { type: "column" },
      title: { text: "Column Chart Example" },
      xAxis: { categories: ["Apples", "Bananas", "Oranges"] },
      yAxis: { title: { text: "Count" } },
      series: [{ name: "Sales", data: [100, 80, 120] }],
      credits: { enabled: false }
    }
  },
  {
    label: "Stacked Column Chart",
    icon: <StackedBarChartSharp fontSize="small" />, 
    value: {
      chart: { type: "column" },
      title: { text: "Stacked Column Chart" },
      plotOptions: { column: { stacking: "normal" } },
      xAxis: { categories: ["2020", "2021", "2022", "2023"] },
      yAxis: { title: { text: "Total Revenue" } },
      series: [
        { name: "North Region", data: [120, 150, 130, 160] },
        { name: "South Region", data: [80, 90, 110, 100] }
      ],
      credits: { enabled: false }
    }
  },
  {
    label: "Pie Chart",
    icon: <PieChartIcon fontSize="small" />,
    value: {
      chart: { type: "pie" },
      title: { text: "Pie Chart Example" },
      plotOptions: {
        pie: {
          dataLabels: {
            enabled: true,
            format: "{point.name}: {point.percentage:.1f}%"
          }
        }
      },
      series: [{
        name: "Data",
        colorByPoint: true,
        data: [
          { name: "Category A", y: 60 },
          { name: "Category B", y: 30 },
          { name: "Category C", y: 10 }
        ]
      }],
      credits: { enabled: false }
    }
  },
  {
    label: "Donut Chart",
    icon: <DonutIcon fontSize="small" />, // Reusing PieChartIcon, Donut is a type of Pie
    value: {
      chart: { type: "pie" },
      title: { text: "Donut Chart Example" },
      plotOptions: {
        pie: {
          innerSize: '60%', // This creates the 'donut' hole
          dataLabels: {
            enabled: true,
            format: "{point.name}: {point.percentage:.1f}%"
          }
        }
      },
      series: [{
        name: "Distribution",
        colorByPoint: true,
        data: [
          { name: "Major", y: 45 },
          { name: "Minor", y: 35 },
          { name: "Other", y: 20 }
        ]
      }],
      credits: { enabled: false }
    }
  },
  {
    label: "Scatter Chart",
    icon: <ScatterChartIcon fontSize="small" />, // Assuming a ScatterPlotIcon is available
    value: {
      chart: { type: "scatter", zoomType: "xy" },
      title: { text: "Scatter Chart Example" },
      xAxis: { title: { text: "X-Axis Value (e.g., Weight)" } },
      yAxis: { title: { text: "Y-Axis Value (e.g., Height)" } },
      series: [{
        name: "Observations",
        data: [
          [161.2, 51.6], [167.5, 59.0], [159.5, 49.2], [157.0, 63.2],
          [170.2, 80.1], [180.1, 90.1], [165.2, 55.6], [168.5, 65.0]
        ]
      }],
      credits: { enabled: false }
    }
  }
];

const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  Object.entries(variables).forEach(([name, value]) => {
    const replacement = JSON.stringify(value);
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  return result;
};

const VariableList = ({ variables }: { variables: Record<string, any> }) => {
  const variableCount = Object.keys(variables).length;
  
  if (variableCount === 0) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>No Variables Available</AlertTitle>
        Run code in the JS compiler to create variables for use here.
      </Alert>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'success.50', border: 1, borderColor: 'success.light' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={600} color="success.dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon fontSize="small" />
          Available Variables
        </Typography>
        <Chip label={`${variableCount} variable${variableCount !== 1 ? 's' : ''}`} size="small" color="success" />
      </Box>
      
      <Typography variant="caption" color="success.dark" sx={{ mb: 1, display: 'block' }}>
        Use <code style={{ background: '#e8f5e9', padding: '2px 4px', borderRadius: 2 }}>${`{variableName}`}</code> syntax in your JSON
      </Typography>
      
      <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
        <Stack spacing={1}>
          {Object.entries(variables).map(([name, value]) => (
            <Paper key={name} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1,  }}>
              <Typography
                component="code"
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  flexShrink: 0,
                }}
              >
                ${`{${name}}`}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={typeof value === 'object' ? JSON.stringify(value) : String(value)}
              >
                {typeof value === 'object'
                  ? JSON.stringify(value).substring(0, 40) + (JSON.stringify(value).length > 40 ? '...' : '')
                  : String(value)}
              </Typography>
            </Paper>
          ))}
        </Stack>
      </Box>
    </Paper>
  );
};

const useAllVariables = (): Record<string, any> => {
  const variableNames = useRecoilValue(variableNamesState);
  const updateTrigger = useRecoilValue(variableUpdateTriggerState);
  
  const getAllVariables = useRecoilCallback(({ snapshot }) => async (): Promise<Record<string, any>> => {
    const variables: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);
    
    for (const varName of varNameArray) {
      try {
        const varValue = await snapshot.getPromise(variableAtomFamily(varName));
        if (varValue !== undefined && varValue !== null) {
          variables[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
        }
      } catch (e) {
        console.warn(`Could not get variable ${varName}:`, e);
      }
    }
    return variables;
  }, [variableNames]);

  const [variables, setVariables] = useState<Record<string, any>>({});

  useEffect(() => {
    getAllVariables().then(setVariables);
  }, [getAllVariables, updateTrigger]);

  return variables;
};

interface ChartConfigData {
  template?: string;
  processed?: any;
  [key: string]: any;
}

export default function HighChartField() {
  const { id } = useParams<{ id: string }>();
  const [chartConfig, setChartConfig] = useState<string>("");
  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const [chartKey, setChartKey] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [showProcessedConfig, setShowProcessedConfig] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Custom/Manual");
  const navigate = useNavigate();

  const availableVariables = useAllVariables();

  const processedChartConfig = useMemo(() => {
    if (!chartConfig.trim()) return null;
    
    try {
      const configWithVariables = replaceVariableReferences(chartConfig, availableVariables);
      const parsedConfig = JSON.parse(configWithVariables);
      setError("");
      return parsedConfig;
    } catch (error: any) {
      setError(`Configuration error: ${error.message}`);
      return null;
    }
  }, [chartConfig, availableVariables]);

  // Load saved config on mount ONCE
  useEffect(() => {
    if (id && chartConfigs[id]) {
      if (chartConfigs[id].template) {
        setChartConfig(chartConfigs[id].template!);
      } else if (typeof chartConfigs[id] === 'object') {
        setChartConfig(JSON.stringify(chartConfigs[id], null, 2));
      }
    }
  }, [id]); // Only depend on id

  // Save to localStorage whenever chartConfigs changes
  useEffect(() => {
    if (Object.keys(chartConfigs).length > 0) {
      localStorage.setItem('chart-configs', JSON.stringify(chartConfigs));
    }
  }, [chartConfigs]);

  // Load from localStorage ONCE on mount
  useEffect(() => {
    const savedConfigs = localStorage.getItem('chart-configs');
    if (savedConfigs) {
      try {
        const parsed = JSON.parse(savedConfigs);
        setChartConfigs(parsed);
      } catch (e) {
        console.error('Failed to load saved configs:', e);
      }
    }
  }, []); // Empty deps - only run once

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setChartConfig(value);

    if (!value.trim()) {
      setError("");
      return;
    }

    if (!id) return;

    try {
      const configWithVariables = replaceVariableReferences(value, availableVariables);
      const parsedConfig = JSON.parse(configWithVariables);
      
      setChartConfigs(prev => ({
        ...prev,
        [id]: { 
          template: value, 
          processed: parsedConfig 
        },
      }));

      setChartKey(prev => prev + 1);
      setError("");
    } catch (error: any) {
      setError(`Invalid JSON: ${error.message}`);
    }
  };

  const handleTemplateSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const templateLabel = event.target.value;
    setSelectedTemplate(templateLabel);
    
    if (templateLabel === "Custom/Manual") {
      return;
    }
    
    const template = highchartsTemplateList.find(t => t.label === templateLabel);
    if (template && template.value) {
      const templateJson = JSON.stringify(template.value, null, 2);
      setChartConfig(templateJson);
      
      if (id) {
        setChartConfigs(prev => ({
          ...prev,
          [id]: {
            template: templateJson,
            processed: template.value
          }
        }));
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="static" elevation={1} sx={{ bgcolor: 'white', color: 'text.primary' }}>
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <CodeIcon sx={{ color: 'primary.main', fontSize: 32 }} />
            <Box>
              <Typography variant="h6" fontWeight={700} color="text.primary">
                Chart Configuration
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Create and customize your Highcharts visualization
              </Typography>
            </Box>
          </Box>
          
          <Button
            variant="contained"
            startIcon={<DashboardIcon />}
            onClick={() => navigate("/dashboards")}
            sx={{ textTransform: 'none' }}
          >
            View Dashboards
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ flex: 1, py: 3 }}>
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 120px)' }}>
          <Grid size={{xs:12,lg:6}} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <VariableList variables={availableVariables} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    Highcharts JSON Configuration
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <TextField
                      select
                      label="Chart Type"
                      value={selectedTemplate}
                      onChange={handleTemplateSelect}
                      size="small"
                      sx={{ 
                        minWidth: 200,
                        '& .MuiInputBase-root': {
                          bgcolor: 'white',
                        }
                      }}
                    >
                      {highchartsTemplateList.map((template) => (
                        <MenuItem key={template.label} value={template.label}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {template.icon}
                            <Typography variant="body2">{template.label}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </TextField>
                    <Chip
                      icon={<InfoIcon />}
                      label="Live preview"
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                </Box>

                {error && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    <AlertTitle>Configuration Error</AlertTitle>
                    {error}
                  </Alert>
                )}
              </Box>

              <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <TextField
                  multiline
                  fullWidth
                  value={chartConfig}
                  onChange={handleChange}
                  placeholder="Enter your Highcharts configuration here..."
                  error={!!error}
                  sx={{
                    flex: 1,
                    '& .MuiInputBase-root': {
                      height: '100%',
                      alignItems: 'flex-start',
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.6,
                    },
                    '& textarea': {
                      height: '100% !important',
                      overflow: 'auto !important',
                    },
                  }}
                  InputProps={{
                    sx: {
                      bgcolor: error ? 'error.50' : 'grey.50',
                      '&:hover': {
                        bgcolor: error ? 'error.100' : 'grey.100',
                      },
                    },
                  }}
                />
              </Box>

              <Divider />

              <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<SaveIcon />}
                  onClick={() => navigate("/dashboards")}
                  sx={{ textTransform: 'none' }}
                >
                  Save & Go to Dashboards
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{xs:12,lg:6}} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={2} sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VisibilityIcon color="primary" />
                    Live Preview
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Chart updates automatically
                  </Typography>
                </Box>
                
                {processedChartConfig && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={showProcessedConfig ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    onClick={() => setShowProcessedConfig(!showProcessedConfig)}
                    sx={{ textTransform: 'none' }}
                  >
                    {showProcessedConfig ? 'Hide' : 'Show'} JSON
                  </Button>
                )}
              </Box>

              <Box sx={{ flex: 1, p: 2, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
                <Paper
                  variant="outlined"
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    bgcolor: processedChartConfig ? 'white' : error ? 'error.50' : 'grey.50',
                  }}
                >
                  {processedChartConfig ? (
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <ResizableChart key={chartKey} options={processedChartConfig} />
                    </Box>
                  ) : error ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <ErrorIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
                      <Typography variant="h6" fontWeight={600} color="error.main" gutterBottom>
                        Chart Error
                      </Typography>
                      <Typography variant="body2" color="error.dark" sx={{ maxWidth: 400 }}>
                        {error}
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <CodeIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                      <Typography variant="h6" fontWeight={600} gutterBottom>
                        Ready for Configuration
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Select a template or enter JSON configuration
                      </Typography>
                    </Box>
                  )}
                </Paper>

                <Collapse in={showProcessedConfig && !!processedChartConfig}>
                  <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
                    <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                      Processed Configuration
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontSize: '0.75rem',
                        bgcolor: 'grey.100',
                        p: 2,
                        borderRadius: 1,
                        overflow: 'auto',
                        maxHeight: 200,
                        fontFamily: 'monospace',
                      }}
                    >
                      {JSON.stringify(processedChartConfig, null, 2)}
                    </Box>
                  </Paper>
                </Collapse>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}