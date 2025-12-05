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
import { JsonEditor } from './JsonEditor';
import { HtmlEditor } from './HtmlEditor';
import {
  Save as SaveIcon,
  Dashboard as DashboardIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Code as CodeIcon,
  Error as ErrorIcon,
  ShowChart as ShowChartIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  TableChart as TableChartIcon,
  Html as HtmlIcon,
  InsertChart as InsertChartIcon,
} from '@mui/icons-material';
import { AreaChartIcon, Columns3Icon, DonutIcon, ScatterChartIcon } from "lucide-react";


const safeParse = (value: string): any => {
  // If it's a string that looks like a formatted number (contains commas), return as-is
  if (typeof value === 'string' && /^[\d,]+$/.test(value)) {
    return value;
  }
  
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

const replaceVariableReferences = (jsonString: string, variables: Record<string, any>): string => {
  let result = jsonString;
  
  Object.entries(variables).forEach(([name, value]) => {
    // Check if the raw stored value is a formatted number (before parsing)
    const isFormattedNumber = typeof value === 'string' && /^[\d,]+$/.test(value);
    
    let replacement: string;
    
    if (isFormattedNumber) {
      // 🔥 Formatted numbers: use as-is without quotes
      replacement = value;
    } else {
      // 🔥 Everything else: stringify the raw value
      replacement = JSON.stringify(value);
    }
    
    // Replace in JSON context: "${variableName}"
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    
    // Replace in HTML context: ${variableName}
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
  });
  
  return result;
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
      exporting: { enabled: true }
    }
  },
  {
    label: "Area Chart",
    icon: <AreaChartIcon size={16} />,
    value: {
      chart: { type: "area" },
      title: { text: "Area Chart Example" },
      xAxis: { categories: ["A", "B", "C", "D", "E"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Data Set 1", data: [5, 9, 12, 8, 15] }],
      credits: { enabled: false },
      exporting: { enabled: true }
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
      exporting: { enabled: true }
    }
  },
  {
    label: "Column Chart",
    icon: <Columns3Icon size={16} />,
    value: {
      chart: { type: "column" },
      title: { text: "Column Chart Example" },
      xAxis: { categories: ["Apples", "Bananas", "Oranges"] },
      yAxis: { title: { text: "Count" } },
      series: [{ name: "Sales", data: [100, 80, 120] }],
      credits: { enabled: false },
      exporting: { enabled: true }
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
      exporting: { enabled: true }
    }
  },
  {
    label: "Donut Chart",
    icon: <DonutIcon size={16} />,
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
      exporting: { enabled: true }
    }
  },
  {
    label: "Scatter Chart",
    icon: <ScatterChartIcon size={16} />,
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
      exporting: { enabled: true }
    }
  }
];

const htmlTemplateList = [
  {
    label: "Custom",
    value: ""
  },
  {
    label: "KPI Card",
    value: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; text-align: center;">
  <h2 style="font-size: 48px; font-weight: bold; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">$1.2M</h2>
  <p style="font-size: 18px; margin: 8px 0 0 0; opacity: 0.9;">Total Revenue</p>
  <div style="margin-top: 16px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;">
    <span style="font-size: 24px;">↑</span>
    <span style="font-size: 16px; font-weight: 600;">23.5%</span>
  </div>
</div>`
  },
  {
    label: "Info Card",
    value: `<div style="background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%); border-radius: 12px; padding: 24px; height: 100%; display: flex; flex-direction: column;">
  <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
    <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px;">📊</div>
    <div>
      <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #1e293b;">Dashboard Stats</h3>
      <p style="margin: 4px 0 0 0; font-size: 14px; color: #64748b;">Updated just now</p>
    </div>
  </div>
  <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
    <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Active Users</p>
      <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #1e293b;">1,234</p>
    </div>
    <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Conversion Rate</p>
      <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #1e293b;">3.2%</p>
    </div>
  </div>
</div>`
  },
  {
    label: "Custom Text",
    value: `<div style="padding: 24px; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #fef3c7 0%, #fed7aa 100%); border-radius: 12px;">
  <div style="text-align: center;">
    <h1 style="font-size: 32px; font-weight: bold; color: #78350f; margin: 0 0 16px 0;">Welcome!</h1>
    <p style="font-size: 16px; color: #92400e; line-height: 1.6; max-width: 400px;">
      This is a custom HTML card. You can add any HTML content with inline styles to create beautiful, custom visualizations.
    </p>
  </div>
</div>`
  },
  {
    label: "Metric Grid",
    value: `<div style="padding: 20px; height: 100%; background: white; border-radius: 12px;">
  <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #1e293b;">Key Metrics</h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; height: calc(100% - 40px);">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Sales</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">$45K</p>
    </div>
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Orders</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">328</p>
    </div>
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Customers</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">892</p>
    </div>
    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Growth</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">+12%</p>
    </div>
  </div>
</div>`
  }
];


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
        Use <code style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>${`{variableName}`}</code> syntax in your JSON or HTML
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
  htmlContent?: string;
  type?: 'chart' | 'html' | 'table' | 'tableChart';
  processed?: any;
  [key: string]: any;
}

type ViewMode = 'chart' | 'table' | 'tableChart' | 'html';

export default function HighChartField() {
  const { id } = useParams<{ id: string }>();
  const [chartConfig, setChartConfig] = useState<string>("");
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [chartConfigs, setChartConfigs] = useRecoilState<Record<string, ChartConfigData>>(chartConfigState);
  const [chartKey, setChartKey] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [showProcessedConfig, setShowProcessedConfig] = useState<boolean>(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("Custom/Manual");
  const [selectedHtmlTemplate, setSelectedHtmlTemplate] = useState<string>("Custom");
  const [viewMode, setViewMode] = useState<ViewMode>('chart');
  const navigate = useNavigate();

  const availableVariables = useAllVariables();

  // Load saved config on mount
  useEffect(() => {
    if (id && chartConfigs[id]) {
      const config = chartConfigs[id];
      
      console.log('Loading config:', config);
      
      if (config.type === 'html') {
        setViewMode('html');
        setHtmlContent(config.htmlContent || '');
        setChartConfig('');
      } else if (config.type === 'table') {
        setViewMode('table');
        setChartConfig('');
        setHtmlContent('');
      } else if (config.type === 'tableChart') {
        setViewMode('tableChart');
        setChartConfig('');
        setHtmlContent('');
      } else {
        setViewMode('chart');
        setChartConfig(config.template || '');
        setHtmlContent('');
      }
    }
  }, [id, chartConfigs]);

  // Process chart config
  const processedChartConfig = useMemo(() => {
    if (viewMode !== 'chart' || !chartConfig.trim()) return null;
    
    try {
      const configWithVariables = replaceVariableReferences(chartConfig, availableVariables);
      const parsedConfig = JSON.parse(configWithVariables);
      setError("");
      return parsedConfig;
    } catch (error: any) {
      setError(`Configuration error: ${error.message}`);
      return null;
    }
  }, [chartConfig, availableVariables, viewMode]);

  // Process HTML content
  const processedHtmlConfig = useMemo(() => {
    if (viewMode !== 'html' || !htmlContent.trim()) return null;
    
    try {
      const htmlWithVariables = replaceVariableReferences(htmlContent, availableVariables);
      return {
        html: htmlWithVariables,
        type: 'html' as const
      };
    } catch (error: any) {
      console.warn('HTML processing error:', error);
      return {
        html: htmlContent,
        type: 'html' as const
      };
    }
  }, [htmlContent, availableVariables, viewMode]);

  // Handle chart config changes (for JsonEditor)
  const handleJsonChange = (value: string) => {
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
          type: 'chart',
          processed: parsedConfig,
          htmlContent: prev[id]?.htmlContent || ''
        },
      }));

      setChartKey(prev => prev + 1);
      setError("");
    } catch (error: any) {
      setError(`Invalid JSON: ${error.message}`);
    }
  };

  // Handle chart config changes (legacy for TextField - kept for compatibility)
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleJsonChange(e.target.value);
  };

  // Handle HTML content changes (for HtmlEditor)
  const handleHtmlContentChange = (value: string) => {
    setHtmlContent(value);

    if (!id) return;

    setChartConfigs(prev => ({
      ...prev,
      [id]: { 
        htmlContent: value,
        type: 'html',
        processed: { html: value, type: 'html' },
        template: prev[id]?.template || ''
      },
    }));
  };

  // Handle HTML content changes (legacy for TextField - kept for compatibility)
  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleHtmlContentChange(e.target.value);
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
            type: 'chart',
            processed: template.value,
            htmlContent: prev[id]?.htmlContent || ''
          }
        }));
        setChartKey(prev => prev + 1);
      }
    }
  };

  const handleHtmlTemplateSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const templateLabel = event.target.value;
    setSelectedHtmlTemplate(templateLabel);
    
    if (templateLabel === "Custom") {
      return;
    }
    
    const template = htmlTemplateList.find(t => t.label === templateLabel);
    if (template && template.value) {
      setHtmlContent(template.value);
      handleHtmlChange({ target: { value: template.value } } as any);
    }
  };

  const handleViewModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (newMode !== null) {
      setViewMode(newMode);
      
      if (id && chartConfigs[id]) {
        setChartConfigs(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            type: newMode
          }
        }));
      }
    }
  };

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
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
          <Grid size={{ xs: 12, lg: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
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
                  )}

                  {viewMode === 'html' && (
                    <TextField
                      select
                      label="HTML Template"
                      value={selectedHtmlTemplate}
                      onChange={handleHtmlTemplateSelect}
                      size="small"
                      sx={{ 
                        minWidth: 200,
                        '& .MuiInputBase-root': {
                          bgcolor: 'white',
                          borderRadius: 1.5,
                        },
                      }}
                    >
                      {htmlTemplateList.map((template) => (
                        <MenuItem key={template.label} value={template.label}>
                          {template.label}
                        </MenuItem>
                      ))}
                    </TextField>
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
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <JsonEditor
                      value={chartConfig}
                      onChange={handleJsonChange}
                      height={400}
                      error={error}
                      availableVariables={availableVariables}
                      placeholder="Enter Highcharts JSON configuration. Use ${variableName} syntax for variables."
                    />
                  </Box>
                ) : viewMode === 'html' ? (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <HtmlEditor
                      value={htmlContent}
                      onChange={handleHtmlContentChange}
                      height={400}
                      availableVariables={availableVariables}
                      placeholder="Enter HTML with inline styles. Use ${variableName} to insert variables."
                    />
                  </Box>
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
                ) : (
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

          <Grid size={{ xs: 12, lg: 6 }} sx={{ display: 'flex', flexDirection: 'column' }}>
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
                    {viewMode === 'html' && 'HTML renders with variables'}
                    {viewMode === 'table' && 'Table preview will appear here'}
                    {viewMode === 'tableChart' && 'Combined view will appear here'}
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
                    bgcolor: (processedChartConfig || processedHtmlConfig)
                      ? 'white' 
                      : error 
                        ? 'rgba(254, 226, 226, 0.3)' 
                        : 'rgba(248, 250, 252, 0.5)',
                  }}
                >
                  {viewMode === 'chart' && processedChartConfig ? (
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <ResizableChart key={chartKey} options={processedChartConfig} showExport={true}/>
                    </Box>
                  ) : viewMode === 'html' && processedHtmlConfig ? (
                    <Box sx={{ width: '100%', height: '100%' }}>
                      <ResizableChart options={processedHtmlConfig} showExport={false}/>
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
                        {viewMode === 'chart' && 'Select a template or enter Highcharts JSON'}
                        {viewMode === 'html' && 'Select a template or enter HTML with inline styles'}
                        {viewMode === 'table' && 'Table configuration coming soon'}
                        {viewMode === 'tableChart' && 'Combined configuration coming soon'}
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