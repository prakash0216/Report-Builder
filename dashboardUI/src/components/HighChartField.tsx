import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { chartConfigState } from "../recoil/ChartConfig";
import { useRecoilState, useRecoilValue, useRecoilCallback } from "recoil";
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState, hooksArrayOfObjectsSelector } from '../recoil/Variabletracker';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Switch,
  FormControlLabel,
  Radio,
  RadioGroup,
  Checkbox,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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
  Sort as SortIcon,
  ViewColumn as ViewColumnIcon,
  Palette as PaletteIcon,
  DragIndicator as DragIndicatorIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from '@mui/icons-material';
import { AreaChartIcon, Columns3Icon, DonutIcon, ScatterChartIcon } from "lucide-react";
import { 
  TableSettings, 
  TableDisplayMode, 
  TableTheme,
  ColumnConfig, 
  SortColumn,
  SummaryCalculation,
  defaultTableSettings, 
} from '../types/tableTypes';


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
  tableDataSource?: string; // Variable name for table data
  tableSettings?: TableSettings;
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

  // Table configuration state
  const [selectedTableDataSource, setSelectedTableDataSource] = useState<string>("");
  const [tablePage, setTablePage] = useState<number>(0);
  const [tableRowsPerPage, setTableRowsPerPage] = useState<number>(10);
  const [tableSettings, setTableSettings] = useState<TableSettings>(defaultTableSettings);
  
  // Preview sorting state (for interactive sorting in preview)
  const [previewSortColumn, setPreviewSortColumn] = useState<string>('');
  const [previewSortDirection, setPreviewSortDirection] = useState<'asc' | 'desc'>('asc');

  const availableVariables = useAllVariables();
  
  // Get variables that are arrays of objects (suitable for tables)
  const arrayOfObjectsVariables = useRecoilValue(hooksArrayOfObjectsSelector);

  // Load saved config on mount
  useEffect(() => {
    if (id && chartConfigs[id]) {
      const config = chartConfigs[id];
      
      console.log('Loading config:', config);
      
      if (config.type === 'html') {
        setViewMode('html');
        setHtmlContent(config.htmlContent || '');
        setChartConfig('');
        setSelectedTableDataSource('');
      } else if (config.type === 'table') {
        setViewMode('table');
        setChartConfig('');
        setHtmlContent('');
        setSelectedTableDataSource(config.tableDataSource || '');
        setTableSettings(config.tableSettings || defaultTableSettings);
      } else if (config.type === 'tableChart') {
        setViewMode('tableChart');
        setChartConfig('');
        setHtmlContent('');
        setSelectedTableDataSource(config.tableDataSource || '');
        setTableSettings(config.tableSettings || defaultTableSettings);
      } else {
        setViewMode('chart');
        setChartConfig(config.template || '');
        setHtmlContent('');
        setSelectedTableDataSource('');
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
      setTablePage(0); // Reset pagination when switching views
      
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

  // Handle table data source selection
  const handleTableDataSourceChange = (event: SelectChangeEvent<string>) => {
    const variableName = event.target.value;
    setSelectedTableDataSource(variableName);
    setTablePage(0);
    
    // Auto-generate column config when data source changes
    if (variableName && id) {
      // Try to get columns from the data
      const varAtom = chartConfigs[id]?.tableDataSource;
      // We'll update columns when tableData is available in the effect
    }
    
    if (id) {
      setChartConfigs(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          type: viewMode,
          tableDataSource: variableName,
          tableSettings: tableSettings,
        }
      }));
    }
  };

  // Handle display mode change (only one can be selected)
  const handleDisplayModeChange = (mode: TableDisplayMode) => {
    const newSettings: TableSettings = {
      ...tableSettings,
      displayMode: mode,
    };
    setTableSettings(newSettings);
    setTablePage(0);
    persistTableSettings(newSettings);
  };

  // Handle rows per page change
  const handleRowsPerPageConfigChange = (value: number) => {
    const newSettings: TableSettings = {
      ...tableSettings,
      rowsPerPage: value,
    };
    setTableSettings(newSettings);
    setTableRowsPerPage(value);
    persistTableSettings(newSettings);
  };

  // Handle sorting enabled toggle
  const handleSortingEnabledChange = (enabled: boolean) => {
    const currentColumns = tableSettings.sorting?.columns || [];
    const newSettings: TableSettings = {
      ...tableSettings,
      sorting: {
        ...tableSettings.sorting,
        enabled,
        columns: enabled ? currentColumns : [],
      },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle adding a sort column (multi-select)
  const handleAddSortColumn = (column: string, direction: 'asc' | 'desc' = 'asc') => {
    const currentColumns = tableSettings.sorting?.columns || [];
    if (!column || currentColumns.some(s => s.column === column)) return;
    const newColumns: SortColumn[] = [...currentColumns, { column, direction }];
    const newSettings: TableSettings = {
      ...tableSettings,
      sorting: { ...tableSettings.sorting, columns: newColumns },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle removing a sort column
  const handleRemoveSortColumn = (column: string) => {
    const currentColumns = tableSettings.sorting?.columns || [];
    const newColumns = currentColumns.filter(s => s.column !== column);
    const newSettings: TableSettings = {
      ...tableSettings,
      sorting: { ...tableSettings.sorting, columns: newColumns },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle changing sort direction for a column
  const handleSortDirectionChange = (column: string, direction: 'asc' | 'desc') => {
    const currentColumns = tableSettings.sorting?.columns || [];
    const newColumns = currentColumns.map(s =>
      s.column === column ? { ...s, direction } : s
    );
    const newSettings: TableSettings = {
      ...tableSettings,
      sorting: { ...tableSettings.sorting, columns: newColumns },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle select all / deselect all sorting columns
  const handleSelectAllSortColumns = (selectAll: boolean) => {
    const newColumns: SortColumn[] = selectAll 
      ? rawTableColumns.map(col => ({ column: col, direction: 'asc' as const }))
      : [];
    const newSettings: TableSettings = {
      ...tableSettings,
      sorting: { ...tableSettings.sorting, columns: newColumns },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle show/hide header toggle
  const handleShowHeaderChange = (show: boolean) => {
    const newSettings: TableSettings = {
      ...tableSettings,
      showHeader: show,
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle summary row toggle
  const handleSummaryRowEnabledChange = (enabled: boolean) => {
    const newSettings: TableSettings = {
      ...tableSettings,
      summaryRow: {
        ...tableSettings.summaryRow,
        enabled,
      },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle summary calculation change for a column
  const handleSummaryCalculationChange = (column: string, calculation: SummaryCalculation) => {
    const newCalculations = { ...tableSettings.summaryRow.calculations };
    if (calculation === 'none') {
      delete newCalculations[column];
    } else {
      newCalculations[column] = calculation;
    }
    const newSettings: TableSettings = {
      ...tableSettings,
      summaryRow: {
        ...tableSettings.summaryRow,
        calculations: newCalculations,
      },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle column visibility toggle
  const handleColumnVisibilityChange = (columnName: string) => {
    const newColumns = tableSettings.columns.map(col =>
      col.name === columnName ? { ...col, visible: !col.visible } : col
    );
    const newSettings: TableSettings = {
      ...tableSettings,
      columns: newColumns,
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle column order change - don't sort here to preserve input focus
  const handleColumnOrderChange = (columnName: string, newOrder: number) => {
    const newColumns = tableSettings.columns.map(col =>
      col.name === columnName ? { ...col, order: newOrder } : col
    );
    // Don't sort here - sorting happens in the display logic (tableColumns useMemo)
    // This preserves the order in the config UI and prevents focus jumping
    const newSettings: TableSettings = {
      ...tableSettings,
      columns: newColumns,
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle column reorder via drag and drop
  const handleColumnReorder = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    
    // Sort columns by current order first
    const sortedColumns = [...tableSettings.columns].sort((a, b) => a.order - b.order);
    
    // Remove the dragged item and insert at new position
    const [draggedColumn] = sortedColumns.splice(dragIndex, 1);
    sortedColumns.splice(dropIndex, 0, draggedColumn);
    
    // Reassign order values based on new positions
    const newColumns = sortedColumns.map((col, idx) => ({
      ...col,
      order: idx,
    }));
    
    const newSettings: TableSettings = {
      ...tableSettings,
      columns: newColumns,
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Handle theme change
  const handleThemeChange = (field: keyof TableTheme, value: string) => {
    const newSettings: TableSettings = {
      ...tableSettings,
      theme: {
        ...tableSettings.theme,
        [field]: value,
      },
    };
    setTableSettings(newSettings);
    persistTableSettings(newSettings);
  };

  // Persist table settings to Recoil state
  const persistTableSettings = (newSettings: TableSettings) => {
    if (id) {
      setChartConfigs(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          type: viewMode,
          tableDataSource: selectedTableDataSource,
          tableSettings: newSettings,
        }
      }));
    }
  };

  // Get table data from selected variable
  const tableData = useMemo(() => {
    if (!selectedTableDataSource || !availableVariables[selectedTableDataSource]) {
      return [];
    }
    
    const data = availableVariables[selectedTableDataSource];
    
    // Parse if it's a string
    const parsedData = typeof data === 'string' ? safeParse(data) : data;
    
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      return [];
    }
    
    // Verify it's an array of objects
    if (typeof parsedData[0] !== 'object' || parsedData[0] === null) {
      return [];
    }
    
    return parsedData;
  }, [selectedTableDataSource, availableVariables]);

  // Get table columns from the first row of data
  const rawTableColumns = useMemo(() => {
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  }, [tableData]);

  // Auto-generate column config when columns change
  useEffect(() => {
    if (rawTableColumns.length > 0 && tableSettings.columns.length === 0) {
      const newColumns: ColumnConfig[] = rawTableColumns.map((col, idx) => ({
        name: col,
        visible: true,
        order: idx,
      }));
      const newSettings: TableSettings = {
        ...tableSettings,
        columns: newColumns,
      };
      setTableSettings(newSettings);
      if (id) {
        setChartConfigs(prev => ({
          ...prev,
          [id]: {
            ...prev[id],
            tableSettings: newSettings,
          }
        }));
      }
    }
  }, [rawTableColumns, tableSettings.columns.length, id]);

  // Get processed columns (filtered and ordered)
  const tableColumns = useMemo(() => {
    if (tableSettings.columns.length === 0) {
      return rawTableColumns;
    }
    return tableSettings.columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order)
      .map(col => col.name)
      .filter(name => rawTableColumns.includes(name));
  }, [tableSettings.columns, rawTableColumns]);

  // Handle table pagination
  const handleTablePageChange = (_event: unknown, newPage: number) => {
    setTablePage(newPage);
  };

  const handleTableRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTableRowsPerPage(parseInt(event.target.value, 10));
    setTablePage(0);
  };

  // Handle preview sort click
  const handlePreviewSort = (column: string) => {
    if (!tableSettings.sorting?.enabled) return;
    
    if (previewSortColumn === column) {
      setPreviewSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setPreviewSortColumn(column);
      setPreviewSortDirection('asc');
    }
  };

  // Get sorted table data for preview
  const sortedTableData = useMemo(() => {
    if (!tableSettings.sorting?.enabled) return tableData;
    
    // Use preview sort state if set, otherwise use configured default
    const sortColumns = tableSettings.sorting?.columns || [];
    const sortColumn = previewSortColumn || (sortColumns.length > 0 ? sortColumns[0].column : '');
    const sortDirection = previewSortColumn ? previewSortDirection : (sortColumns.length > 0 ? sortColumns[0].direction : 'asc');
    
    if (!sortColumn) return tableData;
    
    return [...tableData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [tableData, tableSettings.sorting, previewSortColumn, previewSortDirection]);

  // Get paginated table data
  const paginatedTableData = useMemo(() => {
    const rowsPerPage = tableSettings.rowsPerPage || tableRowsPerPage;
    return sortedTableData.slice(
      tablePage * rowsPerPage,
      tablePage * rowsPerPage + rowsPerPage
    );
  }, [sortedTableData, tablePage, tableRowsPerPage, tableSettings.rowsPerPage]);

  // Calculate summary row values
  const summaryRowData = useMemo(() => {
    if (!tableSettings.summaryRow?.enabled) return null;
    
    const calculations: Record<string, { value: string | number; type: SummaryCalculation }> = {};
    
    tableColumns.forEach(col => {
      const calcType = tableSettings.summaryRow?.calculations?.[col];
      if (!calcType || calcType === 'none') {
        calculations[col] = { value: '', type: 'none' };
        return;
      }
      
      const values = tableData
        .map(row => row[col])
        .filter(v => v != null && !isNaN(Number(v)))
        .map(v => Number(v));
      
      if (values.length === 0) {
        calculations[col] = { value: 'N/A', type: calcType };
        return;
      }
      
      let calculatedValue: string | number;
      switch (calcType) {
        case 'sum':
          calculatedValue = values.reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'avg':
          calculatedValue = (values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'min':
          calculatedValue = Math.min(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'max':
          calculatedValue = Math.max(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'count':
          calculatedValue = tableData.filter(row => row[col] != null).length;
          break;
        default:
          calculatedValue = '';
      }
      
      calculations[col] = { value: calculatedValue, type: calcType };
    });
    
    return calculations;
  }, [tableData, tableColumns, tableSettings.summaryRow]);

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

              </Box>

              <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {viewMode === 'chart' ? (
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    {error && (
                      <Alert 
                        severity="error" 
                        sx={{ 
                          mb: 1,
                          py: 0.5,
                          borderRadius: 2,
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)',
                          flexShrink: 0,
                        }}
                      >
                        <AlertTitle sx={{ fontWeight: 700, mb: 0 }}>Configuration Error</AlertTitle>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{error}</Typography>
                      </Alert>
                    )}
                    <Box sx={{ flex: 1, minHeight: 0 }}>
                      <JsonEditor
                        value={chartConfig}
                        onChange={handleJsonChange}
                        height={error ? 320 : 400}
                        error={error}
                        availableVariables={availableVariables}
                        placeholder="Enter Highcharts JSON configuration. Use ${variableName} syntax for variables."
                      />
                    </Box>
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
                  <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto', maxHeight: 'calc(100vh - 598px)' }}>
                    {/* Data Source Selection */}
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                      }}
                    >
                      <Typography 
                        variant="subtitle2" 
                        fontWeight={700} 
                        sx={{ mb: 1.5, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}
                      >
                        <TableChartIcon fontSize="small" />
                        Select Data Source
                      </Typography>
                      <FormControl fullWidth size="small">
                        <InputLabel id="table-data-source-label">Calculation Variable</InputLabel>
                        <Select
                          labelId="table-data-source-label"
                          value={selectedTableDataSource}
                          label="Calculation Variable"
                          onChange={handleTableDataSourceChange}
                          sx={{
                            bgcolor: 'white',
                            borderRadius: 1.5,
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(59, 130, 246, 0.3)',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#3b82f6',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#3b82f6',
                            },
                          }}
                        >
                          <MenuItem value="">
                            <em>Select a variable...</em>
                          </MenuItem>
                          {arrayOfObjectsVariables.map((varName: string) => (
                            <MenuItem key={varName} value={varName}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip 
                                  size="small" 
                                  label="Array" 
                                  sx={{ 
                                    height: 20, 
                                    fontSize: '0.7rem',
                                    bgcolor: 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6',
                                  }} 
                                />
                                <Typography variant="body2" fontWeight={500}>{varName}</Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      {arrayOfObjectsVariables.length === 0 && (
                        <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                          <Typography variant="caption">
                            No array-of-objects variables found. Create a calculation that returns an array of objects first.
                          </Typography>
                        </Alert>
                      )}
                      {selectedTableDataSource && tableData.length > 0 && (
                        <Typography variant="caption" color="#64748b" sx={{ mt: 1, display: 'block' }}>
                          {tableData.length} rows × {tableColumns.length} columns
                        </Typography>
                      )}
                    </Paper>

                    {/* Display Mode - Only one can be selected */}
                    <Accordion 
                      defaultExpanded 
                      sx={{ 
                        borderRadius: '8px !important', 
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        flexShrink: 0,
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <VisibilityIcon fontSize="small" />
                          Display Mode
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <RadioGroup
                          value={tableSettings.displayMode}
                          onChange={(e) => handleDisplayModeChange(e.target.value as TableDisplayMode)}
                        >
                          <FormControlLabel
                            value="pagination"
                            control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                            label={
                              <Box>
                                <Typography variant="body2" fontWeight={600} color="#1e293b">Pagination</Typography>
                                <Typography variant="caption" color="#64748b">Show page controls at the bottom</Typography>
                              </Box>
                            }
                          />
                          <FormControlLabel
                            value="scroll"
                            control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                            label={
                              <Box>
                                <Typography variant="body2" fontWeight={600} color="#1e293b">Scroll Content</Typography>
                                <Typography variant="caption" color="#64748b">Scroll through all rows</Typography>
                              </Box>
                            }
                          />
                          <FormControlLabel
                            value="lazyLoad"
                            control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                            label={
                              <Box>
                                <Typography variant="body2" fontWeight={600} color="#1e293b">Lazy Load</Typography>
                                <Typography variant="caption" color="#64748b">Load rows as you scroll</Typography>
                              </Box>
                            }
                          />
                        </RadioGroup>
                        {tableSettings.displayMode === 'pagination' && (
                          <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Rows Per Page</InputLabel>
                              <Select
                                value={tableSettings.rowsPerPage}
                                label="Rows Per Page"
                                onChange={(e) => handleRowsPerPageConfigChange(Number(e.target.value))}
                                sx={{ bgcolor: 'white' }}
                              >
                                {[5, 10, 15, 20, 25, 50, 100].map(n => (
                                  <MenuItem key={n} value={n}>{n} rows</MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Box>
                        )}
                        {/* Show/Hide Header Option */}
                        <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={tableSettings.showHeader !== false}
                                onChange={(e) => handleShowHeaderChange(e.target.checked)}
                                size="small"
                                sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                              />
                            }
                            label={<Typography variant="body2" fontWeight={600} color="#1e293b">Show Table Header</Typography>}
                          />
                        </Box>
                      </AccordionDetails>
                    </Accordion>

                    {/* Sorting Settings - Multi-column */}
                    <Accordion 
                      sx={{ 
                        borderRadius: '8px !important', 
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        flexShrink: 0,
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SortIcon fontSize="small" />
                          Sorting {(tableSettings.sorting?.columns?.length || 0) > 0 && `(${tableSettings.sorting?.columns?.length})`}
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={tableSettings.sorting?.enabled || false}
                              onChange={(e) => handleSortingEnabledChange(e.target.checked)}
                              size="small"
                              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                            />
                          }
                          label={<Typography variant="body2" fontWeight={600} color="#1e293b">Enable Sorting</Typography>}
                          sx={{ mb: 2 }}
                        />
                        {tableSettings.sorting?.enabled && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {/* Select All / Deselect All */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={(tableSettings.sorting?.columns?.length || 0) === rawTableColumns.length}
                                    indeterminate={(tableSettings.sorting?.columns?.length || 0) > 0 && (tableSettings.sorting?.columns?.length || 0) < rawTableColumns.length}
                                    onChange={(e) => handleSelectAllSortColumns(e.target.checked)}
                                    size="small"
                                    sx={{ p: 0.5, color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }}
                                  />
                                }
                                label={<Typography variant="body2" fontWeight={500} color="#475569">Select All Columns</Typography>}
                              />
                            </Box>
                            {/* Current sort columns */}
                            {(tableSettings.sorting?.columns?.length || 0) > 0 && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography variant="caption" color="#64748b" fontWeight={600}>Sortable Columns:</Typography>
                                {(tableSettings.sorting?.columns || []).map((sortCol, idx) => (
                                  <Box 
                                    key={sortCol.column} 
                                    sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 1, 
                                      p: 1, 
                                      bgcolor: 'white', 
                                      borderRadius: 1,
                                      border: '1px solid rgba(59, 130, 246, 0.2)',
                                    }}
                                  >
                                    <Typography variant="caption" sx={{ width: 20, color: '#64748b', fontWeight: 600 }}>{idx + 1}.</Typography>
                                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{sortCol.column}</Typography>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleSortDirectionChange(sortCol.column, sortCol.direction === 'asc' ? 'desc' : 'asc')}
                                      sx={{ color: '#3b82f6' }}
                                      title={sortCol.direction === 'asc' ? 'Ascending (click to change)' : 'Descending (click to change)'}
                                    >
                                      {sortCol.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => handleRemoveSortColumn(sortCol.column)}
                                      sx={{ color: '#ef4444' }}
                                      title="Remove from sorting"
                                    >
                                      <VisibilityOffIcon fontSize="small" />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            {/* Add new sort column */}
                            {rawTableColumns.filter(col => !(tableSettings.sorting?.columns || []).some(s => s.column === col)).length > 0 && (
                              <FormControl fullWidth size="small">
                                <InputLabel>Add Sort Column</InputLabel>
                                <Select
                                  value=""
                                  label="Add Sort Column"
                                  onChange={(e) => handleAddSortColumn(e.target.value as string)}
                                  sx={{ bgcolor: 'white' }}
                                >
                                  {rawTableColumns
                                    .filter(col => !(tableSettings.sorting?.columns || []).some(s => s.column === col))
                                    .map(col => (
                                      <MenuItem key={col} value={col}>{col}</MenuItem>
                                    ))}
                                </Select>
                              </FormControl>
                            )}
                            <Typography variant="caption" color="#94a3b8">
                              Click column headers in preview to sort. Arrows show on columns selected above.
                            </Typography>
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>

                    {/* Column Configuration */}
                    <Accordion 
                      sx={{ 
                        borderRadius: '8px !important', 
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ViewColumnIcon fontSize="small" />
                          Columns ({tableSettings.columns.filter(c => c.visible).length}/{tableSettings.columns.length})
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Typography variant="caption" color="#64748b" sx={{ mb: 1, display: 'block' }}>
                          Toggle visibility and drag to reorder columns
                        </Typography>
                        <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                          {[...tableSettings.columns].sort((a, b) => a.order - b.order).map((col, idx) => (
                            <Box 
                              key={`col-config-${idx}-${col.name}`} 
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData('text/plain', idx.toString());
                                e.currentTarget.style.opacity = '0.5';
                              }}
                              onDragEnd={(e) => {
                                e.currentTarget.style.opacity = '1';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                              }}
                              onDragLeave={(e) => {
                                e.currentTarget.style.backgroundColor = '';
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                e.currentTarget.style.backgroundColor = '';
                                const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                handleColumnReorder(dragIndex, idx);
                              }}
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 1, 
                                py: 0.5,
                                px: 1,
                                borderRadius: 1,
                                cursor: 'grab',
                                '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' },
                                '&:active': { cursor: 'grabbing' },
                              }}
                            >
                              <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                gap: 0, 
                                color: '#94a3b8',
                                cursor: 'grab',
                              }}>
                                <DragIndicatorIcon fontSize="small" />
                              </Box>
                              <Checkbox
                                checked={col.visible}
                                onChange={() => handleColumnVisibilityChange(col.name)}
                                size="small"
                                sx={{ p: 0.5, color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }}
                              />
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  flex: 1, 
                                  color: col.visible ? '#1e293b' : '#94a3b8',
                                  textDecoration: col.visible ? 'none' : 'line-through',
                                }}
                              >
                                {col.name}
                              </Typography>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#94a3b8',
                                  minWidth: 20,
                                  textAlign: 'right',
                                }}
                              >
                                #{idx + 1}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      </AccordionDetails>
                    </Accordion>

                    {/* Theme/Styling */}
                    <Accordion 
                      sx={{ 
                        borderRadius: '8px !important', 
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PaletteIcon fontSize="small" />
                          Theme & Styling
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {/* Header Colors */}
                          <Box>
                            <Typography variant="caption" fontWeight={600} color="#475569" sx={{ mb: 1, display: 'block' }}>
                              Header
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Background</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.headerBgColor}
                                    onChange={(e) => handleThemeChange('headerBgColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.headerBgColor}
                                    onChange={(e) => handleThemeChange('headerBgColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Text</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.headerTextColor}
                                    onChange={(e) => handleThemeChange('headerTextColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.headerTextColor}
                                    onChange={(e) => handleThemeChange('headerTextColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          {/* Row Colors */}
                          <Box>
                            <Typography variant="caption" fontWeight={600} color="#475569" sx={{ mb: 1, display: 'block' }}>
                              Rows
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Even Row</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.rowBgColor}
                                    onChange={(e) => handleThemeChange('rowBgColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.rowBgColor}
                                    onChange={(e) => handleThemeChange('rowBgColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Odd Row</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.rowAltBgColor}
                                    onChange={(e) => handleThemeChange('rowAltBgColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.rowAltBgColor}
                                    onChange={(e) => handleThemeChange('rowAltBgColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Text Color</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.rowTextColor}
                                    onChange={(e) => handleThemeChange('rowTextColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.rowTextColor}
                                    onChange={(e) => handleThemeChange('rowTextColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                              <Box sx={{ flex: 1 }}>
                                <Typography variant="caption" color="#64748b">Border</Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <input
                                    type="color"
                                    value={tableSettings.theme.borderColor}
                                    onChange={(e) => handleThemeChange('borderColor', e.target.value)}
                                    style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                  <TextField
                                    size="small"
                                    value={tableSettings.theme.borderColor}
                                    onChange={(e) => handleThemeChange('borderColor', e.target.value)}
                                    sx={{ flex: 1 }}
                                    inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                  />
                                </Box>
                              </Box>
                            </Box>
                          </Box>

                          {/* Cell Padding & Font Size */}
                          <Box sx={{ display: 'flex', gap: 2 }}>
                            <FormControl size="small" sx={{ flex: 1 }}>
                              <InputLabel>Cell Padding</InputLabel>
                              <Select
                                value={tableSettings.theme.cellPadding}
                                label="Cell Padding"
                                onChange={(e) => handleThemeChange('cellPadding', e.target.value)}
                                sx={{ bgcolor: 'white' }}
                              >
                                <MenuItem value="compact">Compact</MenuItem>
                                <MenuItem value="normal">Normal</MenuItem>
                                <MenuItem value="comfortable">Comfortable</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControl size="small" sx={{ flex: 1 }}>
                              <InputLabel>Font Size</InputLabel>
                              <Select
                                value={tableSettings.theme.fontSize}
                                label="Font Size"
                                onChange={(e) => handleThemeChange('fontSize', e.target.value)}
                                sx={{ bgcolor: 'white' }}
                              >
                                <MenuItem value="small">Small</MenuItem>
                                <MenuItem value="medium">Medium</MenuItem>
                                <MenuItem value="large">Large</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>
                        </Box>
                      </AccordionDetails>
                    </Accordion>

                    {/* Summary Row */}
                    <Accordion 
                      sx={{ 
                        borderRadius: '8px !important', 
                        border: '1px solid rgba(59, 130, 246, 0.3)',
                        bgcolor: 'rgba(224, 242, 254, 0.1)',
                        '&:before': { display: 'none' },
                        boxShadow: 'none',
                        flexShrink: 0,
                      }}
                    >
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InsertChartIcon fontSize="small" />
                          Summary Row
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={tableSettings.summaryRow?.enabled || false}
                              onChange={(e) => handleSummaryRowEnabledChange(e.target.checked)}
                              size="small"
                              sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                            />
                          }
                          label={<Typography variant="body2" fontWeight={600} color="#1e293b">Show Summary Row</Typography>}
                          sx={{ mb: 2 }}
                        />
                        {tableSettings.summaryRow?.enabled && (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 200, overflow: 'auto' }}>
                            <Typography variant="caption" color="#64748b" sx={{ mb: 0.5 }}>
                              Select calculation for each column:
                            </Typography>
                            <Typography variant="caption" color="#3b82f6" sx={{ 
                              bgcolor: 'rgba(59, 130, 246, 0.1)', 
                              p: 1, 
                              borderRadius: 1,
                              fontSize: '0.7rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}>
                              <InsertChartIcon fontSize="small" />
                              <strong>Note:</strong> Summary values appear in a sticky row at the bottom of the table, right-aligned in each column.
                            </Typography>
                            {rawTableColumns.map(col => (
                              <Box key={col} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: '#475569' }}>{col}</Typography>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                  <Select
                                    value={tableSettings.summaryRow?.calculations?.[col] || 'none'}
                                    onChange={(e) => handleSummaryCalculationChange(col, e.target.value as SummaryCalculation)}
                                    sx={{ bgcolor: 'white', fontSize: '0.75rem' }}
                                  >
                                    <MenuItem value="none"><em>None</em></MenuItem>
                                    <MenuItem value="sum">Sum</MenuItem>
                                    <MenuItem value="avg">Average</MenuItem>
                                    <MenuItem value="min">Min</MenuItem>
                                    <MenuItem value="max">Max</MenuItem>
                                    <MenuItem value="count">Count</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </AccordionDetails>
                    </Accordion>

                    {/* Empty State - Only show when no data source selected */}
                    {!selectedTableDataSource && (
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
                          <TableChartIcon sx={{ fontSize: 48, color: '#3b82f6', opacity: 0.5, mb: 1 }} />
                          <Typography variant="body2" color="#64748b" fontWeight={500}>
                            Select a data source to preview the table
                          </Typography>
                        </Box>
                      </Paper>
                    )}
                  </Box>
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

              <Box sx={{ flex: 1, p: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0, maxHeight: 'calc(100vh - 200px)' }}>
                {/* Table Preview - Full Table with Pagination */}
                {viewMode === 'table' && selectedTableDataSource && tableData.length > 0 ? (
                  <Paper
                    variant="outlined"
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      borderRadius: 2,
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      bgcolor: 'white',
                      minHeight: 0,
                      maxHeight: '100%',
                    }}
                  >
                    <TableContainer 
                      sx={{ 
                        flex: 1,
                        overflow: 'auto',
                        minHeight: 0,
                        maxHeight: '100%',
                        position: 'relative',
                      }}
                    >
                      <Table stickyHeader size={tableSettings.theme.cellPadding === 'compact' ? 'small' : 'medium'}>
                        {(tableSettings.showHeader !== false) && (
                        <TableHead>
                          <TableRow>
                            {tableColumns.map((col) => {
                              const sortColumns = tableSettings.sorting?.columns || [];
                              const isActiveSortColumn = previewSortColumn === col || 
                                (!previewSortColumn && sortColumns.some(s => s.column === col));
                              const sortDir = previewSortColumn === col 
                                ? previewSortDirection 
                                : sortColumns.find(s => s.column === col)?.direction || 'asc';
                              
                              return (
                                <TableCell 
                                  key={col}
                                  onClick={() => tableSettings.sorting?.enabled && handlePreviewSort(col)}
                                  sx={{ 
                                    fontWeight: 700, 
                                    backgroundColor: `${tableSettings.theme.headerBgColor} !important`,
                                    background: `${tableSettings.theme.headerBgColor} !important`,
                                    color: tableSettings.theme.headerTextColor,
                                    fontSize: tableSettings.theme.fontSize === 'small' ? '0.75rem' : tableSettings.theme.fontSize === 'large' ? '0.9rem' : '0.8rem',
                                    py: tableSettings.theme.cellPadding === 'compact' ? 1 : tableSettings.theme.cellPadding === 'comfortable' ? 2 : 1.5,
                                    whiteSpace: 'nowrap',
                                    borderBottom: `2px solid ${tableSettings.theme.borderColor}`,
                                    zIndex: 2,
                                    position: 'sticky',
                                    top: 0,
                                    cursor: tableSettings.sorting?.enabled ? 'pointer' : 'default',
                                    '&:hover': tableSettings.sorting?.enabled ? {
                                      backgroundColor: `${tableSettings.theme.headerBgColor}dd !important`,
                                    } : {},
                                  }}
                                >
                                  {tableSettings.sorting?.enabled ? (
                                    <TableSortLabel
                                      active={isActiveSortColumn}
                                      direction={sortDir}
                                      sx={{
                                        color: `${tableSettings.theme.headerTextColor} !important`,
                                        '& .MuiTableSortLabel-icon': {
                                          color: `${tableSettings.theme.headerTextColor} !important`,
                                        },
                                        '&.Mui-active': {
                                          color: `${tableSettings.theme.headerTextColor} !important`,
                                        },
                                      }}
                                    >
                                      {col}
                                    </TableSortLabel>
                                  ) : col}
                                </TableCell>
                              );
                            })}
                          </TableRow>
                        </TableHead>
                        )}
                        <TableBody>
                          {(tableSettings.displayMode === 'pagination' ? paginatedTableData : 
                            tableSettings.displayMode === 'scroll' ? sortedTableData : sortedTableData.slice(0, 100)
                          ).map((row: any, rowIdx: number) => (
                            <TableRow 
                              key={rowIdx} 
                              hover
                              sx={{
                                backgroundColor: rowIdx % 2 === 0 ? tableSettings.theme.rowBgColor : tableSettings.theme.rowAltBgColor,
                                '&:hover': {
                                  bgcolor: `${tableSettings.theme.headerBgColor}22 !important`,
                                },
                              }}
                            >
                              {tableColumns.map((col) => (
                                <TableCell 
                                  key={col}
                                  sx={{ 
                                    fontSize: tableSettings.theme.fontSize === 'small' ? '0.75rem' : tableSettings.theme.fontSize === 'large' ? '0.9rem' : '0.8rem',
                                    py: tableSettings.theme.cellPadding === 'compact' ? 0.5 : tableSettings.theme.cellPadding === 'comfortable' ? 1.5 : 1,
                                    color: tableSettings.theme.rowTextColor,
                                    borderBottom: `1px solid ${tableSettings.theme.borderColor}`,
                                    maxWidth: 200,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {typeof row[col] === 'object' 
                                    ? JSON.stringify(row[col]) 
                                    : String(row[col] ?? '')}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                          {/* Summary Row */}
                          {summaryRowData && (
                            <TableRow sx={{ 
                              backgroundColor: `${tableSettings.theme.headerBgColor} !important`,
                              position: 'sticky',
                              bottom: 0,
                              zIndex: 1,
                              '& td': {
                                fontWeight: 700,
                                fontSize: tableSettings.theme.fontSize === 'small' ? '0.75rem' : tableSettings.theme.fontSize === 'large' ? '0.9rem' : '0.8rem',
                                color: tableSettings.theme.headerTextColor,
                                borderTop: `2px solid ${tableSettings.theme.borderColor}`,
                                backgroundColor: `${tableSettings.theme.headerBgColor} !important`,
                                py: tableSettings.theme.cellPadding === 'compact' ? 0.5 : tableSettings.theme.cellPadding === 'comfortable' ? 1.5 : 1,
                                position: 'sticky',
                                bottom: 0,
                              }
                            }}>
                              {tableColumns.map((col, idx) => {
                                const summaryCell = summaryRowData[col];
                                const getLabel = (type: SummaryCalculation) => {
                                  switch (type) {
                                    case 'sum': return 'Sum:';
                                    case 'avg': return 'Avg:';
                                    case 'min': return 'Min:';
                                    case 'max': return 'Max:';
                                    case 'count': return 'Count:';
                                    default: return '';
                                  }
                                };
                                
                                return (
                                  <TableCell 
                                    key={col}
                                    sx={{
                                      backgroundColor: `${tableSettings.theme.headerBgColor} !important`,
                                      position: 'sticky',
                                      bottom: 0,
                                      fontSize: tableSettings.theme.fontSize === 'small' ? '0.75rem' : tableSettings.theme.fontSize === 'large' ? '0.9rem' : '0.8rem',
                                      py: tableSettings.theme.cellPadding === 'compact' ? 0.5 : tableSettings.theme.cellPadding === 'comfortable' ? 1.5 : 1,
                                      color: tableSettings.theme.headerTextColor,
                                      borderBottom: `1px solid ${tableSettings.theme.borderColor}`,
                                      maxWidth: 200,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      textAlign: idx === 0 ? 'left' : 'right',
                                    }}
                                  >
                                    {summaryCell && summaryCell.value && summaryCell.type !== 'none' ? (
                                      <Box sx={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'flex-start',
                                        fontWeight: 700,
                                        color: tableSettings.theme.headerTextColor,
                                        gap: 0.5,
                                        width: '100%',
                                      }}>
                                        <Typography variant="body2" sx={{ 
                                          fontWeight: 600,
                                          fontSize: '0.7rem',
                                          opacity: 0.8,
                                          textTransform: 'uppercase',
                                          whiteSpace: 'nowrap',
                                        }}>
                                          {getLabel(summaryCell.type)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ 
                                          fontWeight: 700,
                                          whiteSpace: 'nowrap',
                                        }}>
                                          {summaryCell.value}
                                        </Typography>
                                      </Box>
                                    ) : null}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    {tableSettings.displayMode === 'pagination' && (
                      <TablePagination
                        component="div"
                        count={sortedTableData.length}
                        page={tablePage}
                        onPageChange={handleTablePageChange}
                        rowsPerPage={tableSettings.rowsPerPage || tableRowsPerPage}
                        onRowsPerPageChange={(e) => {
                          const newValue = parseInt(e.target.value, 10);
                          setTableRowsPerPage(newValue);
                          handleRowsPerPageConfigChange(newValue);
                          setTablePage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 15, 20, 25, 50, 100]}
                        sx={{
                          borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(37, 99, 235, 0.05) 100%)',
                          '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                            color: '#64748b',
                            fontWeight: 600,
                            fontSize: '0.8rem',
                          },
                        }}
                      />
                    )}
                  </Paper>
                ) : (
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
                    ) : viewMode === 'table' && !selectedTableDataSource ? (
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
                          <TableChartIcon sx={{ fontSize: 40, color: '#3b82f6', opacity: 0.6 }} />
                        </Box>
                        <Typography variant="h6" fontWeight={700} gutterBottom color="#1e293b">
                          Select a Data Source
                        </Typography>
                        <Typography variant="body2" color="#64748b" fontWeight={500}>
                          Choose a calculation variable from the dropdown to display as a table
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
                          {viewMode === 'tableChart' && 'Combined configuration coming soon'}
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                )}

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