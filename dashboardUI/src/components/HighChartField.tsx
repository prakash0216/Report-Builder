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
  ToggleButtonGroup,
  ToggleButton,
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
  TableChart as TableChartIcon,
  Html as HtmlIcon,
  InsertChart as InsertChartIcon,
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      credits: { enabled: false },
      exporting:{enabled:true}
    }
  },
  {
    label: "Donut Chart",
    icon: <DonutIcon fontSize="small" />,
    value: {
      chart: { type: "pie" },
      title: { text: "Donut Chart Example" },
      plotOptions: {
        pie: {
          innerSize: '60%',
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
      credits: { enabled: false },
      exporting:{enabled:true}
    }
  },
  {
    label: "Scatter Chart",
    icon: <ScatterChartIcon fontSize="small" />,
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
      credits: { enabled: false },
      exporting:{enabled:true}
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
      <Alert 
        severity="info" 
        sx={{ 
          mb: 2,
          borderRadius: 2,
          border: '1px solid rgba(59, 130, 246, 0.3)',
          background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
        }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>No Variables Available</AlertTitle>
        Run code in the JS compiler to create variables for use here.
      </Alert>
    );
  }

  return (
    <Paper 
      elevation={0} 
      sx={{ 
        p: 2, 
        mb: 2, 
        borderRadius: 2,
        border: '1px solid rgba(16, 185, 129, 0.3)',
        background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.5) 0%, rgba(167, 243, 208, 0.5) 100%)',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography 
          variant="subtitle2" 
          fontWeight={700}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: '#065f46',
          }}
        >
          <CodeIcon fontSize="small" />
          Available Variables
        </Typography>
        <Chip 
          label={`${variableCount} variable${variableCount !== 1 ? 's' : ''}`} 
          size="small"
          sx={{
            background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
            color: 'white',
            fontWeight: 600,
          }}
        />
      </Box>
      
      <Typography 
        variant="caption" 
        sx={{ 
          mb: 1, 
          display: 'block',
          color: '#065f46',
          fontWeight: 500,
        }}
      >
        Use <code style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>${`{variableName}`}</code> syntax in your JSON
      </Typography>
      
      <Box sx={{ maxHeight: 120, overflow: 'auto' }}>
        <Stack spacing={1}>
          {Object.entries(variables).map(([name, value]) => (
            <Paper 
              key={name} 
              variant="outlined" 
              sx={{ 
                p: 1, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1,
                borderRadius: 1.5,
                border: '1px solid rgba(102, 126, 234, 0.2)',
                bgcolor: 'white',
              }}
            >
              <Typography
                component="code"
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  color: '#667eea',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  flexShrink: 0,
                  fontWeight: 600,
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
                  color: '#475569',
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

type ViewMode = 'chart' | 'table' | 'tableChart' | 'html';

export default function HighChartField() {
  const { id } = useParams<{ id: string }>();
  const [chartConfig, setChartConfig] = useState<string>("");
  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const [chartKey, setChartKey] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [showProcessedConfig, setShowProcessedConfig] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Custom/Manual");
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
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
  }, [id]);

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
  }, []);

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

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
      }}
    >
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          background: 'linear-gradient(135deg, #f5f7fa 0%,rgb(236, 240, 250) 100%)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
          boxShadow: '0 4px 16px rgba(102, 126, 234, 0.1)',
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              }}
            >
              <CodeIcon sx={{ color: 'white', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography 
                variant="h6" 
                fontWeight={700}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Chart Configuration
              </Typography>
              <Typography variant="caption" color="#64748b" fontWeight={500}>
                Create and customize your visualization
              </Typography>
            </Box>
          </Box>

          <Button
            variant="contained"
            sx={{ 
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
              },
            }}
          >
            Generate Chart Config with AI
          </Button>
          
          <Button
            variant="contained"
            startIcon={<DashboardIcon />}
            onClick={() => navigate("/dashboards")}
            sx={{ 
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
              },
            }}
          >
            View Dashboards
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ flex: 1, py: 3 }}>
        <Grid container spacing={3} sx={{ height: 'calc(100vh - 120px)' }}>
          <Grid size={{xs:12,lg:6}} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper 
              elevation={0} 
              sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
              }}
            >
              <Box sx={{ p: 2, borderBottom: '1px solid rgba(102, 126, 234, 0.2)' }}>
                <VariableList variables={availableVariables} />
                
                {/* Toggle for view modes */}
                <Box sx={{ mb: 2, mt: 2 }}>
                  <Typography 
                    variant="subtitle2" 
                    fontWeight={700}
                    sx={{
                      mb: 1.5,
                      color: '#667eea',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <VisibilityIcon fontSize="small" />
                    Configuration Type
                  </Typography>
                  <ToggleButtonGroup
                    value={viewMode}
                    exclusive
                    onChange={handleViewModeChange}
                    fullWidth
                    size="small"
                    sx={{
                      '& .MuiToggleButton-root': {
                        textTransform: 'none',
                        fontWeight: 600,
                        py: 1,
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        color: '#64748b',
                        '&.Mui-selected': {
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                          },
                        },
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.05)',
                        },
                      },
                    }}
                  >
                    <ToggleButton value="chart">
                      <ShowChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                      Chart Config
                    </ToggleButton>
                    <ToggleButton value="table">
                      <TableChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                      Table
                    </ToggleButton>
                    <ToggleButton value="tableChart">
                      <InsertChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                      Table + Chart
                    </ToggleButton>
                    <ToggleButton value="html">
                      <HtmlIcon sx={{ mr: 0.5, fontSize: 18 }} />
                      HTML
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, mt: 3 }}>
                  <Typography 
                    variant="subtitle1" 
                    fontWeight={700}
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {viewMode === 'chart' && 'Highcharts JSON Configuration'}
                    {viewMode === 'table' && 'Table Configuration'}
                    {viewMode === 'tableChart' && 'Table + Chart Configuration'}
                    {viewMode === 'html' && 'HTML Configuration'}
                  </Typography>
                  {viewMode === 'chart' && (
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
                            borderRadius: 1.5,
                          },
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'rgba(102, 126, 234, 0.3)',
                            },
                            '&:hover fieldset': {
                              borderColor: '#667eea',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#667eea',
                            },
                          },
                          '& .MuiInputLabel-root.Mui-focused': {
                            color: '#667eea',
                          },
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
                        sx={{
                          borderColor: '#667eea',
                          color: '#667eea',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  )}
                </Box>

                {error && viewMode === 'chart' && (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)',
                    }}
                  >
                    <AlertTitle sx={{ fontWeight: 700 }}>Configuration Error</AlertTitle>
                    {error}
                  </Alert>
                )}
              </Box>

              <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {viewMode === 'chart' ? (
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
                        borderRadius: 2,
                      },
                      '& textarea': {
                        height: '100% !important',
                        overflow: 'auto !important',
                      },
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: error ? 'rgba(239, 68, 68, 0.3)' : 'rgba(102, 126, 234, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: error ? '#ef4444' : '#667eea',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: error ? '#ef4444' : '#667eea',
                        },
                      },
                    }}
                    InputProps={{
                      sx: {
                        bgcolor: error 
                          ? 'rgba(254, 226, 226, 0.3)' 
                          : 'rgba(248, 250, 252, 0.5)',
                        '&:hover': {
                          bgcolor: error 
                            ? 'rgba(254, 226, 226, 0.5)' 
                            : 'rgba(241, 245, 249, 0.5)',
                        },
                      },
                    }}
                  />
                ) : viewMode === 'table' ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 2,
                      border: '2px dashed rgba(59, 130, 246, 0.3)',
                      bgcolor: 'rgba(224, 242, 254, 0.3)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <TableChartIcon sx={{ fontSize: 60, color: '#3b82f6', mb: 2 }} />
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        Table Configuration
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500}>
                        Table editor coming soon
                      </Typography>
                    </Box>
                  </Paper>
                ) : viewMode === 'tableChart' ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 2,
                      border: '2px dashed rgba(16, 185, 129, 0.3)',
                      bgcolor: 'rgba(209, 250, 229, 0.3)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <InsertChartIcon sx={{ fontSize: 60, color: '#10b981', mb: 2 }} />
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        Table + Chart Configuration
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500}>
                        Combined editor coming soon
                      </Typography>
                    </Box>
                  </Paper>
                ) : (
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 2,
                      border: '2px dashed rgba(245, 158, 11, 0.3)',
                      bgcolor: 'rgba(254, 243, 199, 0.3)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <HtmlIcon sx={{ fontSize: 60, color: '#f59e0b', mb: 2 }} />
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        HTML Configuration
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500}>
                        HTML editor coming soon
                      </Typography>
                    </Box>
                  </Paper>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(102, 126, 234, 0.2)' }} />

              <Box sx={{ p: 2, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={() => navigate("/dashboards")}
                  sx={{ 
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
                    },
                  }}
                >
                  Save & Go to Dashboards
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{xs:12,lg:6}} sx={{ display: 'flex', flexDirection: 'column' }}>
            <Paper 
              elevation={0} 
              sx={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column', 
                overflow: 'hidden',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
              }}
            >
              <Box 
                sx={{ 
                  p: 2, 
                  borderBottom: '1px solid rgba(102, 126, 234, 0.2)', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography 
                    variant="h6" 
                    fontWeight={700} 
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    <VisibilityIcon sx={{ color: '#667eea' }} />
                    Live Preview
                  </Typography>
                  <Typography variant="caption" color="#64748b" fontWeight={500}>
                    {viewMode === 'chart' && 'Chart updates automatically'}
                    {viewMode === 'table' && 'Table preview will appear here'}
                    {viewMode === 'tableChart' && 'Combined view will appear here'}
                    {viewMode === 'html' && 'HTML preview will appear here'}
                  </Typography>
                </Box>
                
                {processedChartConfig && viewMode === 'chart' && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={showProcessedConfig ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    onClick={() => setShowProcessedConfig(!showProcessedConfig)}
                    sx={{ 
                      textTransform: 'none',
                      borderRadius: 1.5,
                      fontWeight: 600,
                      borderColor: '#667eea',
                      color: '#667eea',
                      '&:hover': {
                        borderColor: '#5568d3',
                        bgcolor: 'rgba(102, 126, 234, 0.05)',
                      },
                    }}
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
                    borderRadius: 2,
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    bgcolor: processedChartConfig 
                      ? 'white' 
                      : error 
                        ? 'rgba(254, 226, 226, 0.3)' 
                        : 'rgba(248, 250, 252, 0.5)',
                  }}
                >
                  {processedChartConfig && viewMode === 'chart' ? (
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <ResizableChart key={chartKey} options={processedChartConfig} showExport={true}/>
                    </Box>
                  ) : error && viewMode === 'chart' ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          margin: '0 auto 24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ErrorIcon sx={{ fontSize: 40, color: '#ef4444' }} />
                      </Box>
                      <Typography variant="h6" fontWeight={700} color="#ef4444" gutterBottom>
                        Chart Error
                      </Typography>
                      <Typography variant="body2" color="#991b1b" sx={{ maxWidth: 400, mx: 'auto' }}>
                        {error}
                      </Typography>
                    </Box>
                  ) : viewMode === 'table' ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          margin: '0 auto 24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <TableChartIcon sx={{ fontSize: 40, color: '#3b82f6' }} />
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        Table View
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500} sx={{ mb: 2 }}>
                        Table preview will appear here
                      </Typography>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 3, 
                          mt: 3,
                          borderRadius: 2,
                          border: '2px dashed rgba(59, 130, 246, 0.3)',
                        }}
                      >
                        <Typography variant="caption" color="#64748b">
                          Configure your table in the left panel to see the preview here.
                        </Typography>
                      </Paper>
                    </Box>
                  ) : viewMode === 'tableChart' ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          margin: '0 auto 24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <InsertChartIcon sx={{ fontSize: 40, color: '#10b981' }} />
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        Table + Chart View
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500} sx={{ mb: 2 }}>
                        Combined preview will appear here
                      </Typography>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 3, 
                          mt: 3,
                          borderRadius: 2,
                          border: '2px dashed rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        <Typography variant="caption" color="#64748b">
                          Configure your table and chart in the left panel to see the combined preview here.
                        </Typography>
                      </Paper>
                    </Box>
                  ) : viewMode === 'html' ? (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          margin: '0 auto 24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <HtmlIcon sx={{ fontSize: 40, color: '#f59e0b' }} />
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        HTML View
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500} sx={{ mb: 2 }}>
                        HTML preview will appear here
                      </Typography>
                      <Paper 
                        variant="outlined" 
                        sx={{ 
                          p: 3, 
                          mt: 3,
                          borderRadius: 2,
                          border: '2px dashed rgba(245, 158, 11, 0.3)',
                        }}
                      >
                        <Typography variant="caption" color="#64748b">
                          Configure your HTML in the left panel to see the rendered output here.
                        </Typography>
                      </Paper>
                    </Box>
                  ) : (
                    <Box sx={{ textAlign: 'center', p: 4 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          margin: '0 auto 24px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <CodeIcon sx={{ fontSize: 40, color: '#667eea', opacity: 0.6 }} />
                      </Box>
                      <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                        Ready for Configuration
                      </Typography>
                      <Typography variant="body2" color="#64748b" fontWeight={500}>
                        Select a template or enter configuration
                      </Typography>
                    </Box>
                  )}
                </Paper>

                <Collapse in={showProcessedConfig && !!processedChartConfig && viewMode === 'chart'}>
                  <Paper 
                    variant="outlined" 
                    sx={{ 
                      mt: 2, 
                      p: 2,
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                    }}
                  >
                    <Typography 
                      variant="subtitle2" 
                      fontWeight={700} 
                      gutterBottom
                      sx={{
                        color: '#667eea',
                      }}
                    >
                      Processed Configuration
                    </Typography>
                    <Box
                      component="pre"
                      sx={{
                        fontSize: '0.75rem',
                        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%)',
                        p: 2,
                        borderRadius: 1.5,
                        overflow: 'auto',
                        maxHeight: 200,
                        fontFamily: 'monospace',
                        color: '#475569',
                        border: '1px solid rgba(102, 126, 234, 0.1)',
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