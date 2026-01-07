// dashboardUI/src/components/TooltipConfigPanel.tsx
// Enhanced Tooltip Configuration Panel with Preview, Variable Panel, and Code Editor

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Paper,
  Divider,
  Alert,
  Chip,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Slider,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Visibility as VisibilityIcon,
  Code as CodeIcon,
  DataObject as DataObjectIcon,
  FilterAlt as FilterIcon,
  Settings as SettingsIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  TouchApp as TouchAppIcon,
  TableChart as TableIcon,
  BarChart as ChartIcon,
  Html as HtmlIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useRecoilValue, useRecoilCallback } from 'recoil';
import { variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { 
  ChildCardTooltipConfig, 
  TooltipDataExtraction, 
  TooltipCalculationBinding,
  defaultChildCardTooltipConfig,
  AVAILABLE_HOVER_KEYS,
} from '../recoil/ChildCardTooltipState';
import { CalculationEditor } from './CalculationEditor';
import { JsonEditor } from './JsonEditor';
import { HtmlEditor } from './HtmlEditor';
import ResizableChart from './ResizableChart';
import DashboardTable from './DashboardTable';

// Helper to safely parse JSON
const safeParse = (value: any): any => {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Helper to safely parse chart config that may contain template variables like ${value}
const safeParseChartConfig = (config: any): any => {
  if (!config) return null;
  if (typeof config !== 'string') return config;
  
  try {
    return JSON.parse(config);
  } catch {
    // If parsing fails, it might contain template variables
    // Try to display as-is for debugging purposes
    return { _parseError: true, _rawValue: config.substring(0, 200) + '...' };
  }
};

// Helper to get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    const arrayMatch = key.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const arrayKey = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      return current && current[arrayKey] && Array.isArray(current[arrayKey]) 
        ? current[arrayKey][index] 
        : undefined;
    }
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

interface TooltipConfigPanelProps {
  config: ChildCardTooltipConfig;
  onChange: (updates: Partial<ChildCardTooltipConfig>) => void;
  parentChartConfig?: any; // The parent child card's chart configuration
  arrayOfObjectsVariables: string[];
}

export default function TooltipConfigPanel({
  config,
  onChange,
  parentChartConfig,
  arrayOfObjectsVariables,
}: TooltipConfigPanelProps) {
  // State
  // Side-by-side layout - no tabs needed
  const [testValues, setTestValues] = useState<Record<string, any>>({});
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isRunningPreview, setIsRunningPreview] = useState(false);
  const [variableSearch, setVariableSearch] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | false>('extraction');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const editorRef = useRef<any>(null);

  // Recoil state
  const variableNames = useRecoilValue(variableNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);

  // Get all variables with their values for the variable panel
  const getAllVariables = useRecoilCallback(({ snapshot }) => async () => {
    const variables: Record<string, { value: any; type: string; source: string }> = {};

    // Get calculation variables
    for (const varName of Array.from(variableNames)) {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(varName));
        if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
          const value = safeParse(loadable.contents);
          variables[varName] = {
            value,
            type: Array.isArray(value) ? 'array' : typeof value,
            source: 'calculation',
          };
        }
      } catch { /* ignore */ }
    }

    // Get filter values
    for (const filterName of Array.from(filterNames)) {
      try {
        const liveLoadable = snapshot.getLoadable(liveFilterFamily(filterName));
        if (liveLoadable.state === 'hasValue') {
          variables[filterName] = {
            value: liveLoadable.contents,
            type: 'filter',
            source: 'filter',
          };
        }
      } catch { /* ignore */ }
    }

    // Get parameters
    for (const paramName of Array.from(parameterNames as string[])) {
      try {
        const loadable = snapshot.getLoadable(parameterAtomFamily(paramName));
        if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
          variables[paramName] = {
            value: safeParse(loadable.contents),
            type: typeof safeParse(loadable.contents),
            source: 'parameter',
          };
        }
      } catch { /* ignore */ }
    }

    return variables;
  }, [variableNames, filterNames, parameterNames]);

  const [allVariables, setAllVariables] = useState<Record<string, { value: any; type: string; source: string }>>({});

  useEffect(() => {
    getAllVariables().then(setAllVariables);
  }, [getAllVariables]);

  // Available variables for templates (including extracted and calculation outputs)
  const availableVariables = useMemo(() => {
    const vars: Record<string, any> = {};
    
    // Add all existing variables
    Object.entries(allVariables).forEach(([name, info]) => {
      vars[name] = info.value;
    });
    
    // Add extracted variables (with test values or placeholders)
    config.dataExtractions.forEach(ext => {
      // Use test value if provided, otherwise use a meaningful placeholder
      const testVal = testValues[ext.targetVariable];
      if (testVal !== undefined && testVal !== '') {
        vars[ext.targetVariable] = testVal;
      } else {
        // Use a placeholder that indicates the variable needs a test value
        // For preview, use a descriptive string that's valid in JSON
        vars[ext.targetVariable] = `(${ext.targetVariable})`;
      }
    });
    
    // Add calculation output variables
    config.calculationBindings.forEach(binding => {
      if (binding.outputVariable) {
        // Use calculation result if available, otherwise use placeholder array for data variables
        const calcResult = previewResult?.[binding.outputVariable];
        if (calcResult !== undefined) {
          vars[binding.outputVariable] = calcResult;
        } else {
          // For calculation outputs, default to empty array (likely used for chart data)
          vars[binding.outputVariable] = [];
        }
      }
    });
    
    return vars;
  }, [allVariables, config.dataExtractions, config.calculationBindings, testValues, previewResult]);

  // Filter variables based on search
  const filteredVariables = useMemo(() => {
    if (!variableSearch) return allVariables;
    const search = variableSearch.toLowerCase();
    return Object.fromEntries(
      Object.entries(allVariables).filter(([name]) => 
        name.toLowerCase().includes(search)
      )
    );
  }, [allVariables, variableSearch]);

  // Group variables by source
  const groupedVariables = useMemo(() => {
    const groups: Record<string, Array<{ name: string; value: any; type: string }>> = {
      extraction: [],
      calculation: [],
      filter: [],
      parameter: [],
    };

    // Add extracted variables
    config.dataExtractions.forEach(ext => {
      groups.extraction.push({
        name: ext.targetVariable,
        value: testValues[ext.targetVariable] ?? null,
        type: 'extracted',
      });
    });

    // Add calculation outputs
    config.calculationBindings.forEach(binding => {
      if (binding.outputVariable) {
        groups.calculation.push({
          name: binding.outputVariable,
          value: previewResult?.[binding.outputVariable] ?? null,
          type: 'calculated',
        });
      }
    });

    // Add existing variables by source
    Object.entries(filteredVariables).forEach(([name, info]) => {
      if (info.source === 'calculation') {
        groups.calculation.push({ name, value: info.value, type: info.type });
      } else if (info.source === 'filter') {
        groups.filter.push({ name, value: info.value, type: info.type });
      } else if (info.source === 'parameter') {
        groups.parameter.push({ name, value: info.value, type: info.type });
      }
    });

    return groups;
  }, [filteredVariables, config.dataExtractions, config.calculationBindings, testValues, previewResult]);

  // Data extraction handlers
  const addDataExtraction = useCallback(() => {
    const newExtraction: TooltipDataExtraction = {
      id: `ext-${Date.now()}`,
      sourceKey: '',
      extractionType: 'hover',
      targetVariable: '',
    };
    onChange({
      dataExtractions: [...config.dataExtractions, newExtraction],
    });
  }, [config.dataExtractions, onChange]);

  const updateDataExtraction = useCallback((index: number, updates: Partial<TooltipDataExtraction>) => {
    const newExtractions = [...config.dataExtractions];
    newExtractions[index] = { ...newExtractions[index], ...updates };
    onChange({ dataExtractions: newExtractions });
  }, [config.dataExtractions, onChange]);

  const removeDataExtraction = useCallback((index: number) => {
    const newExtractions = config.dataExtractions.filter((_, i) => i !== index);
    onChange({ dataExtractions: newExtractions });
  }, [config.dataExtractions, onChange]);

  // Calculation binding handlers
  const addCalculationBinding = useCallback(() => {
    const newBinding: TooltipCalculationBinding = {
      id: `calc-${Date.now()}`,
      outputVariable: '',
      inlineLogic: '// Available variables:\n// - Extracted: ' + 
        config.dataExtractions.map(e => e.targetVariable).join(', ') +
        '\n// - All existing variables, filters, and parameters\n\n// Example:\n// const filtered = allSalesData.filter(item => item.category === hoveredCategory);\n// return filtered;',
    };
    onChange({
      calculationBindings: [...config.calculationBindings, newBinding],
    });
  }, [config.calculationBindings, config.dataExtractions, onChange]);

  const updateCalculationBinding = useCallback((index: number, updates: Partial<TooltipCalculationBinding>) => {
    const newBindings = [...config.calculationBindings];
    newBindings[index] = { ...newBindings[index], ...updates };
    onChange({ calculationBindings: newBindings });
  }, [config.calculationBindings, onChange]);

  const removeCalculationBinding = useCallback((index: number) => {
    const newBindings = config.calculationBindings.filter((_, i) => i !== index);
    onChange({ calculationBindings: newBindings });
  }, [config.calculationBindings, onChange]);

  // Run preview calculation
  const runPreview = useRecoilCallback(({ snapshot }) => async () => {
    setIsRunningPreview(true);
    setPreviewError(null);

    try {
      // Build context with all variables
      const context: Record<string, any> = {};

      // Add all existing variables
      for (const varName of Array.from(variableNames)) {
        try {
          const loadable = snapshot.getLoadable(variableAtomFamily(varName));
          if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
            context[varName] = safeParse(loadable.contents);
          }
        } catch { /* ignore */ }
      }

      // Add filters
      for (const filterName of Array.from(filterNames)) {
        try {
          const liveLoadable = snapshot.getLoadable(liveFilterFamily(filterName));
          if (liveLoadable.state === 'hasValue') {
            context[filterName] = liveLoadable.contents;
          }
        } catch { /* ignore */ }
      }

      // Add parameters
      for (const paramName of Array.from(parameterNames as string[])) {
        try {
          const loadable = snapshot.getLoadable(parameterAtomFamily(paramName));
          if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
            context[paramName] = safeParse(loadable.contents);
          }
        } catch { /* ignore */ }
      }

      // Add test values (extracted data simulation)
      Object.entries(testValues).forEach(([key, value]) => {
        context[key] = value;
      });

      const results: Record<string, any> = {};

      // Execute each calculation binding
      for (const binding of config.calculationBindings) {
        if (!binding.inlineLogic || !binding.outputVariable) continue;

        try {
          // Create variable declarations
          const variableDeclarations = Object.entries(context)
            .map(([name, value]) => {
              let serialized;
              if (value === undefined) serialized = 'undefined';
              else if (value === null) serialized = 'null';
              else serialized = JSON.stringify(value);
              return `const ${name} = ${serialized};`;
            })
            .join('\n');

          const funcString = `(function() {
            ${variableDeclarations}
            ${binding.inlineLogic}
          })()`;

          // eslint-disable-next-line no-eval
          const result = eval(funcString);
          results[binding.outputVariable] = result;
          context[binding.outputVariable] = result; // Add to context for subsequent calculations
        } catch (error: any) {
          setPreviewError(`Error in "${binding.outputVariable}": ${error.message}`);
          results[binding.outputVariable] = null;
        }
      }

      setPreviewResult(results);
    } catch (error: any) {
      setPreviewError(error.message);
    } finally {
      setIsRunningPreview(false);
    }
  }, [variableNames, filterNames, parameterNames, testValues, config.calculationBindings]);

  // Copy variable name to clipboard and insert at cursor
  const handleVariableClick = useCallback((varName: string) => {
    navigator.clipboard.writeText(varName);
    setCopiedVariable(varName);
    setTimeout(() => setCopiedVariable(null), 1500);
  }, []);

  // Get type color
  const getTypeColor = (type: string) => {
    switch (type) {
      case 'array': return '#22c55e';
      case 'number': return '#3b82f6';
      case 'string': return '#f59e0b';
      case 'object': return '#8b5cf6';
      case 'filter': return '#ec4899';
      case 'extracted': return '#667eea';
      case 'calculated': return '#06b6d4';
      default: return '#64748b';
    }
  };

  // Render variable chip
  const renderVariableChip = (name: string, type: string, value: any, source: string) => (
    <Tooltip
      key={name}
      title={
        <Box sx={{ maxWidth: 300 }}>
          <Typography variant="caption" fontWeight={600}>{name}</Typography>
          <Typography variant="caption" display="block" color="text.secondary">
            Type: {type}
          </Typography>
          <Typography variant="caption" display="block" sx={{ 
            maxHeight: 100, 
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            Value: {JSON.stringify(value, null, 2)?.substring(0, 200)}
            {JSON.stringify(value)?.length > 200 ? '...' : ''}
          </Typography>
        </Box>
      }
      arrow
      placement="top"
    >
      <Chip
        label={name}
        size="small"
        onClick={() => handleVariableClick(name)}
        icon={copiedVariable === name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
        sx={{
          bgcolor: `${getTypeColor(type)}15`,
          color: getTypeColor(type),
          border: `1px solid ${getTypeColor(type)}30`,
          fontSize: '0.7rem',
          height: 24,
          cursor: 'pointer',
          '&:hover': {
            bgcolor: `${getTypeColor(type)}25`,
          },
        }}
      />
    </Tooltip>
  );

  // Source key suggestions
  const sourceKeySuggestions = useMemo(() => {
    const suggestions = AVAILABLE_HOVER_KEYS.map(k => k.key);
    
    // Add custom paths from parent chart config
    if (parentChartConfig) {
      try {
        const config = safeParseChartConfig(parentChartConfig);
        
        // Skip if parsing failed
        if (config?._parseError) return suggestions;
        
        // Extract paths from series
        if (config?.series) {
          config.series.forEach((series: any, idx: number) => {
            if (series.custom) {
              Object.keys(series.custom).forEach(key => {
                suggestions.push(`series[${idx}].custom.${key}`);
              });
            }
            if (series.data?.[0]?.custom) {
              Object.keys(series.data[0].custom).forEach(key => {
                suggestions.push(`options.custom.${key}`);
              });
            }
          });
        }
      } catch { /* ignore */ }
    }
    
    return Array.from(new Set(suggestions));
  }, [parentChartConfig]);

  // Render preview content
  const renderPreviewContent = () => {
    const allVars = { ...availableVariables };
    
    // Add calculation results
    if (previewResult) {
      Object.entries(previewResult).forEach(([key, value]) => {
        allVars[key] = value;
      });
    }

    // Replace variables in template - ONLY ${varName} syntax
    // Smart replacement: automatically handles JSON context
    const replaceVariables = (template: string, isHtml: boolean = false): string => {
      let result = template;
      
      // Replace all ${varName} occurrences
      Object.entries(allVars).forEach(([name, value]) => {
        if (isHtml) {
          // For HTML: simple string replacement
          const replacement = value === null || value === undefined 
            ? '' 
            : typeof value === 'object' 
              ? JSON.stringify(value) 
              : String(value);
          
          result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
          result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), replacement);
        } else {
          // For JSON: context-aware replacement
          
          // Pattern 1: "${varName}" (quoted) - replace with quoted string or the value
          result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), () => {
            if (value === null || value === undefined) return '""';
            if (typeof value === 'string') return JSON.stringify(value); // Adds quotes
            return JSON.stringify(value); // For objects/arrays/numbers
          });
          
          // Pattern 2: ${varName} (unquoted) - smart replacement based on type
          result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), () => {
            if (value === null || value === undefined) return 'null';
            if (typeof value === 'string') return JSON.stringify(value); // 🔥 Add quotes for strings!
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return JSON.stringify(value); // Arrays/objects
          });
          
          // Also support {{varName}}
          result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), () => {
            if (value === null || value === undefined) return 'null';
            if (typeof value === 'string') return JSON.stringify(value);
            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
            return JSON.stringify(value);
          });
        }
      });
      
      // Replace any remaining unreplaced variables
      if (isHtml) {
        result = result.replace(/\$\{[^}]+\}/g, '');
        result = result.replace(/\{\{[^}]+\}\}/g, '');
      } else {
        // For JSON: "${var}" -> "", ${var} -> []
        result = result.replace(/"\\$\\{[^}]+\\}"/g, '""');
        result = result.replace(/\$\{[^}]+\}/g, '[]');
        result = result.replace(/\{\{[^}]+\}\}/g, '""');
      }
      
      return result;
    };

    switch (config.type) {
      case 'chart':
        if (!config.chartTemplate) {
          return (
            <Box sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>
              <ChartIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography>No chart template configured</Typography>
            </Box>
          );
        }
        try {
          const processedTemplate = replaceVariables(config.chartTemplate);
          
          // Additional safety: validate it looks like JSON before parsing
          const trimmed = processedTemplate.trim();
          if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            throw new Error('Template does not appear to be valid JSON (must start with { or [)');
          }
          
          const chartOptions = JSON.parse(processedTemplate);
          
          // Validate series data
          if (chartOptions.series) {
            chartOptions.series = chartOptions.series.map((s: any) => ({
              ...s,
              data: Array.isArray(s.data) ? s.data : [],
            }));
          }
          
          return <ResizableChart options={chartOptions} />;
        } catch (error: any) {
          // Check if it's a variable replacement issue
          const unreplacedVars = config.chartTemplate.match(/\$\{([^}]+)\}/g) || [];
          const missingVars = unreplacedVars.filter(v => {
            const varName = v.replace(/\$\{|\}/g, '');
            return !allVars[varName];
          });
          
          // Show processed template for debugging
          const processedForDebug = replaceVariables(config.chartTemplate);
          console.error('❌ [TooltipConfigPanel] Chart parse error:', error.message);
          console.error('❌ [TooltipConfigPanel] Processed template:', processedForDebug);
          
          return (
            <Box sx={{ m: 2 }}>
              <Alert severity="error" sx={{ mb: 1 }}>
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 600 }}>
                  Chart Error: {error.message}
                </Typography>
                {missingVars.length > 0 && (
                  <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#f59e0b' }}>
                    ⚠️ Missing variables: {missingVars.join(', ')}
                    <br />
                    Run the calculation first or check variable names.
                  </Typography>
                )}
              </Alert>
              <Box sx={{ 
                maxHeight: 200, 
                overflow: 'auto', 
                bgcolor: '#1e1e2e', 
                p: 1, 
                borderRadius: 1,
                fontSize: '0.65rem',
                fontFamily: 'monospace',
                color: '#cdd6f4',
              }}>
                <Typography variant="caption" sx={{ color: '#f59e0b', display: 'block', mb: 1 }}>
                  Full Processed Template (debug):
                </Typography>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {processedForDebug}
                </pre>
              </Box>
            </Box>
          );
        }

      case 'table':
        const tableData = allVars[config.tableDataSource || ''];
        if (!tableData || !Array.isArray(tableData)) {
          return (
            <Box sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>
              <TableIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography>No table data available</Typography>
              <Typography variant="caption">
                Select a data source or run preview
              </Typography>
            </Box>
          );
        }
        return <DashboardTable dataSource="" directData={tableData} />;

      case 'html':
        if (!config.htmlTemplate) {
          return (
            <Box sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>
              <HtmlIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography>No HTML template configured</Typography>
            </Box>
          );
        }
        const processedHtml = replaceVariables(config.htmlTemplate, true); // isHtml = true
        return (
          <Box 
            dangerouslySetInnerHTML={{ __html: processedHtml }}
            sx={{ p: 2, height: '100%', overflow: 'auto' }}
          />
        );

      default:
        return null;
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header - Redirect to Separate Tab */}
      <Box sx={{ 
        p: 2,
        borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
        bgcolor: 'rgba(102, 126, 234, 0.02)',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <TouchAppIcon sx={{ color: '#667eea', fontSize: 24 }} />
          <Typography variant="subtitle1" fontWeight={700} color="#1e293b">
            Tooltip Configuration
          </Typography>
          {config.enabled && (
            <Chip
              label={config.useMultiCard ? `Multi-Card (${config.tooltipCards?.length || 0})` : 'Quick Config'}
              size="small"
              sx={{
                bgcolor: config.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(102, 126, 234, 0.15)',
                color: config.enabled ? '#22c55e' : '#667eea',
                fontWeight: 600,
                fontSize: '0.7rem',
              }}
            />
          )}
        </Box>
        <Alert 
          severity="info" 
          sx={{ 
            py: 0.5, 
            bgcolor: 'rgba(102, 126, 234, 0.05)',
            border: '1px solid rgba(102, 126, 234, 0.2)',
            '& .MuiAlert-icon': { color: '#667eea' },
          }}
        >
          <Typography variant="caption">
            <strong>Tip:</strong> For advanced multi-card tooltip layouts (up to 4 cards with charts, tables, or HTML), 
            use the <strong>"MultiCard Tooltip Config"</strong> tab in the main navigation.
          </Typography>
        </Alert>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1.5 }}>
          <Typography variant="body2" color="#64748b">
            Quick single-card tooltip:
          </Typography>
          <FormControlLabel
            control={
              <Switch
                checked={config.enabled}
                onChange={(e) => onChange({ enabled: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#667eea' },
                }}
              />
            }
            label={
              <Typography variant="body2" fontWeight={600} color={config.enabled ? '#667eea' : '#64748b'}>
                {config.enabled ? 'Enabled' : 'Disabled'}
              </Typography>
            }
          />
        </Box>
      </Box>

      {/* Main Content - Side by Side Layout */}
      <Collapse in={config.enabled}>
        <Box sx={{ 
          flex: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'row',
          gap: 2,
          p: 2,
          minHeight: 500,
        }}>
          {/* SINGLE-CARD MODE */}
          {/* LEFT PANEL - Configuration */}
          <Box sx={{ 
            flex: '0 0 55%', 
            overflow: 'auto', 
            pr: 1,
            borderRight: '1px solid rgba(102, 126, 234, 0.1)',
          }}>
              {/* Content Type Selection */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Content Type
                </Typography>
                <ToggleButtonGroup
                  value={config.type}
                  exclusive
                  onChange={(_, value) => value && onChange({ type: value })}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      '&.Mui-selected': {
                        bgcolor: '#667eea',
                        color: 'white',
                        '&:hover': { bgcolor: '#5567d5' },
                      },
                    },
                  }}
                >
                  <ToggleButton value="chart">
                    <ChartIcon sx={{ mr: 0.5, fontSize: 18 }} /> Chart
                  </ToggleButton>
                  <ToggleButton value="table">
                    <TableIcon sx={{ mr: 0.5, fontSize: 18 }} /> Table
                  </ToggleButton>
                  <ToggleButton value="html">
                    <HtmlIcon sx={{ mr: 0.5, fontSize: 18 }} /> HTML
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Data Extraction Section */}
              <Accordion
                expanded={expandedSection === 'extraction'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'extraction' : false)}
                sx={{ 
                  boxShadow: 'none', 
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  mb: 1.5,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DataObjectIcon sx={{ color: '#667eea', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Data Extraction</Typography>
                    <Chip 
                      label={config.dataExtractions.length} 
                      size="small" 
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        bgcolor: '#667eea20',
                        color: '#667eea',
                      }} 
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                    <Typography variant="caption">
                      Extract data from the hovered chart point to use in calculations and templates.
                      Type any path (e.g., <code>options.custom.myData</code>) or select from suggestions.
                    </Typography>
                  </Alert>

                  {/* Chart Config Inspector */}
                  {parentChartConfig && (
                    <Accordion sx={{ mb: 1.5, boxShadow: 'none', bgcolor: 'rgba(102, 126, 234, 0.03)' }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36 }}>
                        <Typography variant="caption" fontWeight={600} color="#667eea">
                          📋 Chart Config Inspector (click paths to use)
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails sx={{ p: 1 }}>
                        <Box sx={{ 
                          maxHeight: 150, 
                          overflow: 'auto', 
                          fontFamily: 'monospace',
                          fontSize: '0.7rem',
                          bgcolor: '#1e1e2e',
                          color: '#cdd6f4',
                          p: 1,
                          borderRadius: 1,
                        }}>
                          <pre style={{ margin: 0 }}>
                            {(() => {
                              const parsed = safeParseChartConfig(parentChartConfig);
                              if (parsed?._parseError) {
                                return `⚠️ Chart config contains template variables and cannot be displayed as JSON.\n\nRaw preview:\n${parsed._rawValue}`;
                              }
                              return JSON.stringify(parsed, null, 2);
                            })()}
                          </pre>
                        </Box>
                      </AccordionDetails>
                    </Accordion>
                  )}

                  {config.dataExtractions.map((extraction, index) => (
                    <Paper
                      key={extraction.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        mb: 1,
                        border: '1px solid rgba(102, 126, 234, 0.15)',
                        borderRadius: 1,
                        bgcolor: 'rgba(102, 126, 234, 0.02)',
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        {/* Source Type */}
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <InputLabel>Source</InputLabel>
                          <Select
                            value={extraction.extractionType}
                            label="Source"
                            onChange={(e) => updateDataExtraction(index, { 
                              extractionType: e.target.value as 'hover' | 'config' 
                            })}
                          >
                            <MenuItem value="hover">Hover Point</MenuItem>
                            <MenuItem value="config">Chart Config</MenuItem>
                          </Select>
                        </FormControl>

                        {/* Source Key - Free form with autocomplete */}
                        <Autocomplete
                          freeSolo
                          options={sourceKeySuggestions}
                          value={extraction.sourceKey}
                          onChange={(_, newValue) => updateDataExtraction(index, { sourceKey: newValue || '' })}
                          onInputChange={(_, newValue) => updateDataExtraction(index, { sourceKey: newValue })}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              size="small"
                              label="Source Key / Path"
                              placeholder="e.g., category, options.custom.data"
                              sx={{ minWidth: 200 }}
                            />
                          )}
                          renderOption={(props, option) => {
                            const hoverKey = AVAILABLE_HOVER_KEYS.find(k => k.key === option);
                            return (
                              <li {...props}>
                                <Box>
                                  <Typography variant="body2" fontFamily="monospace">{option}</Typography>
                                  {hoverKey && (
                                    <Typography variant="caption" color="text.secondary">
                                      {hoverKey.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            );
                          }}
                          sx={{ flex: 1 }}
                        />

                        <Typography sx={{ alignSelf: 'center', color: '#64748b' }}>→</Typography>

                        {/* Target Variable */}
                        <TextField
                          size="small"
                          label="Variable Name"
                          value={extraction.targetVariable}
                          onChange={(e) => updateDataExtraction(index, { targetVariable: e.target.value })}
                          placeholder="e.g., hoveredCategory"
                          sx={{ flex: 1, minWidth: 150 }}
                        />

                        <IconButton
                          size="small"
                          onClick={() => removeDataExtraction(index)}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}

                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addDataExtraction}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Extraction
                  </Button>
                </AccordionDetails>
              </Accordion>

              {/* Variable Panel */}
              <Accordion
                expanded={expandedSection === 'variables'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'variables' : false)}
                sx={{ 
                  boxShadow: 'none', 
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  mb: 1.5,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ color: '#22c55e', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Available Variables</Typography>
                    <Chip 
                      label={Object.keys(allVariables).length + config.dataExtractions.length + config.calculationBindings.filter(b => b.outputVariable).length} 
                      size="small" 
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        bgcolor: '#22c55e20',
                        color: '#22c55e',
                      }} 
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                    <Typography variant="caption">
                      Click any variable to copy its name. These are available in your inline calculations.
                    </Typography>
                  </Alert>

                  {/* Search */}
                  <TextField
                    size="small"
                    placeholder="Search variables..."
                    value={variableSearch}
                    onChange={(e) => setVariableSearch(e.target.value)}
                    InputProps={{
                      startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b', fontSize: 18 }} />,
                    }}
                    fullWidth
                    sx={{ mb: 1.5 }}
                  />

                  {/* Extracted Variables */}
                  {groupedVariables.extraction.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ display: 'block', mb: 0.5 }}>
                        🎯 Extracted (from hover):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {groupedVariables.extraction.map(v => 
                          renderVariableChip(v.name, 'extracted', v.value, 'extraction')
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Calculation Variables - Show both from calculation tab AND inline calculations */}
                  {(groupedVariables.calculation.length > 0 || config.calculationBindings.filter(b => b.outputVariable).length > 0) && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 0.5 }}>
                        📊 Calculated:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {/* Global calculation variables */}
                        {groupedVariables.calculation.map(v => 
                          renderVariableChip(v.name, v.type, v.value, 'calculation')
                        )}
                        {/* Inline calculation outputs */}
                        {config.calculationBindings
                          .filter(b => b.outputVariable && !groupedVariables.calculation.some(v => v.name === b.outputVariable))
                          .map(binding => {
                            const hasResult = previewResult?.[binding.outputVariable] !== undefined;
                            return (
                              <Chip
                                key={`inline-${binding.id}`}
                                label={binding.outputVariable}
                                size="small"
                                onClick={() => handleVariableClick(binding.outputVariable)}
                                sx={{
                                  height: 22,
                                  fontSize: '0.7rem',
                                  fontFamily: 'monospace',
                                  bgcolor: hasResult ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                                  color: hasResult ? '#06b6d4' : '#f59e0b',
                                  border: `1px solid ${hasResult ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                                  cursor: 'pointer',
                                  '&:hover': {
                                    bgcolor: hasResult ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                                  },
                                }}
                              />
                            );
                          })}
                      </Box>
                    </Box>
                  )}

                  {/* Filters */}
                  {groupedVariables.filter.length > 0 && (
                    <Box sx={{ mb: 1.5 }}>
                      <Typography variant="caption" fontWeight={600} color="#ec4899" sx={{ display: 'block', mb: 0.5 }}>
                        🔽 Filters:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {groupedVariables.filter.map(v => 
                          renderVariableChip(v.name, 'filter', v.value, 'filter')
                        )}
                      </Box>
                    </Box>
                  )}

                  {/* Parameters */}
                  {groupedVariables.parameter.length > 0 && (
                    <Box>
                      <Typography variant="caption" fontWeight={600} color="#f59e0b" sx={{ display: 'block', mb: 0.5 }}>
                        ⚙️ Parameters:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {groupedVariables.parameter.map(v => 
                          renderVariableChip(v.name, v.type, v.value, 'parameter')
                        )}
                      </Box>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Calculation Bindings Section */}
              <Accordion
                expanded={expandedSection === 'calculation'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'calculation' : false)}
                sx={{ 
                  boxShadow: 'none', 
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  mb: 1.5,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Inline Calculations</Typography>
                    <Chip 
                      label={config.calculationBindings.length} 
                      size="small" 
                      sx={{ 
                        height: 20, 
                        fontSize: '0.7rem',
                        bgcolor: '#8b5cf620',
                        color: '#8b5cf6',
                      }} 
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                    <Typography variant="caption">
                      <strong>Inline calculations</strong> run at hover time. Use extracted variables and 
                      all existing data to compute tooltip content.
                    </Typography>
                  </Alert>

                  {/* Show calculation output variables as chips */}
                  {config.calculationBindings.filter(b => b.outputVariable).length > 0 && (
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.5,
                        mb: 1.5,
                        border: '1px solid rgba(6, 182, 212, 0.2)',
                        borderRadius: 1,
                        bgcolor: 'rgba(6, 182, 212, 0.02)',
                      }}
                    >
                      <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 1 }}>
                        📊 Output Variables (use these in your template):
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {config.calculationBindings.filter(b => b.outputVariable).map((binding) => {
                          const hasResult = previewResult?.[binding.outputVariable] !== undefined;
                          return (
                            <Chip
                              key={binding.id}
                              label={`\${${binding.outputVariable}}`}
                              size="small"
                              onClick={() => handleVariableClick(binding.outputVariable)}
                              sx={{
                                height: 24,
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                                bgcolor: hasResult ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: hasResult ? '#06b6d4' : '#f59e0b',
                                border: `1px solid ${hasResult ? 'rgba(6, 182, 212, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: hasResult ? 'rgba(6, 182, 212, 0.25)' : 'rgba(245, 158, 11, 0.25)',
                                },
                              }}
                              icon={hasResult ? 
                                <Box component="span" sx={{ color: '#22c55e', fontSize: '10px', ml: 0.5 }}>✓</Box> : 
                                <Box component="span" sx={{ color: '#f59e0b', fontSize: '10px', ml: 0.5 }}>⏳</Box>
                              }
                            />
                          );
                        })}
                      </Box>
                      {!previewResult && config.calculationBindings.filter(b => b.outputVariable).length > 0 && (
                        <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                          💡 Click "Run Preview" to see calculated values
                        </Typography>
                      )}
                    </Paper>
                  )}

                  {config.calculationBindings.map((binding, index) => (
                    <Paper
                      key={binding.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        mb: 1.5,
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        borderRadius: 1,
                        bgcolor: 'rgba(139, 92, 246, 0.02)',
                      }}
                    >
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                        <TextField
                          size="small"
                          label="Output Variable"
                          value={binding.outputVariable}
                          onChange={(e) => updateCalculationBinding(index, { outputVariable: e.target.value })}
                          placeholder="e.g., tooltipChartData"
                          sx={{ flex: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => removeCalculationBinding(index)}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <TextField
                        size="small"
                        label="Description (optional)"
                        value={binding.description || ''}
                        onChange={(e) => updateCalculationBinding(index, { description: e.target.value })}
                        placeholder="What this calculation does..."
                        fullWidth
                        sx={{ mb: 1.5 }}
                      />

                      {/* Monaco Editor for Inline Logic */}
                      <Typography variant="caption" fontWeight={600} color="#8b5cf6" sx={{ mb: 0.5, display: 'block' }}>
                        Inline Logic:
                      </Typography>
                      <Box sx={{ border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 1, overflow: 'hidden' }}>
                        <CalculationEditor
                          value={binding.inlineLogic || ''}
                          onChange={(value) => updateCalculationBinding(index, { inlineLogic: value })}
                          height={180}
                        />
                      </Box>
                    </Paper>
                  ))}

                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addCalculationBinding}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Calculation
                  </Button>
                </AccordionDetails>
              </Accordion>

              {/* Content Template Section */}
              <Accordion
                expanded={expandedSection === 'content'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'content' : false)}
                sx={{ 
                  boxShadow: 'none', 
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  mb: 1.5,
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {config.type === 'chart' && <ChartIcon sx={{ color: '#3b82f6', fontSize: 20 }} />}
                    {config.type === 'table' && <TableIcon sx={{ color: '#3b82f6', fontSize: 20 }} />}
                    {config.type === 'html' && <HtmlIcon sx={{ color: '#3b82f6', fontSize: 20 }} />}
                    <Typography variant="subtitle2" fontWeight={700}>
                      {config.type === 'chart' && 'Chart Template'}
                      {config.type === 'table' && 'Table Configuration'}
                      {config.type === 'html' && 'HTML Template'}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {config.type === 'chart' && (
                    <>
                      <Alert severity="info" sx={{ py: 0.5, mb: 1 }}>
                        <Typography variant="caption">
                          Use <code>${'{'}variableName{'}'}</code> syntax to insert variables.
                        </Typography>
                      </Alert>
                      <JsonEditor
                        value={config.chartTemplate || ''}
                        onChange={(value) => onChange({ chartTemplate: value })}
                        height={200}
                        placeholder="Enter Highcharts JSON config..."
                        availableVariables={availableVariables}
                      />
                    </>
                  )}

                  {config.type === 'table' && (
                    <FormControl fullWidth size="small">
                      <InputLabel>Data Source Variable</InputLabel>
                      <Select
                        value={config.tableDataSource || ''}
                        label="Data Source Variable"
                        onChange={(e) => onChange({ tableDataSource: e.target.value })}
                      >
                        <MenuItem value=""><em>Select...</em></MenuItem>
                        {arrayOfObjectsVariables.map(varName => (
                          <MenuItem key={varName} value={varName}>{varName}</MenuItem>
                        ))}
                        {config.calculationBindings
                          .filter(b => b.outputVariable)
                          .map(b => (
                            <MenuItem key={b.outputVariable} value={b.outputVariable}>
                              {b.outputVariable} (calc output)
                            </MenuItem>
                          ))
                        }
                      </Select>
                    </FormControl>
                  )}

                  {config.type === 'html' && (
                    <>
                      <Alert severity="info" sx={{ py: 0.5, mb: 1 }}>
                        <Typography variant="caption">
                          Use <code>{'{{'}variableName{'}}'}</code> syntax to insert variables.
                        </Typography>
                      </Alert>
                      <HtmlEditor
                        value={config.htmlTemplate || ''}
                        onChange={(value) => onChange({ htmlTemplate: value })}
                        height={200}
                        placeholder="Enter HTML template..."
                        availableVariables={availableVariables}
                      />
                    </>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* Appearance Settings */}
              <Accordion
                expanded={expandedSection === 'appearance'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'appearance' : false)}
                sx={{ 
                  boxShadow: 'none', 
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon sx={{ color: '#64748b', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Appearance</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="#64748b">Width: {config.width}px</Typography>
                      <Slider
                        value={config.width}
                        onChange={(_, value) => onChange({ width: value as number })}
                        min={200}
                        max={800}
                        step={50}
                        size="small"
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="#64748b">Height: {config.height}px</Typography>
                      <Slider
                        value={config.height}
                        onChange={(_, value) => onChange({ height: value as number })}
                        min={150}
                        max={600}
                        step={50}
                        size="small"
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" color="#64748b">Hide Delay: {config.hideDelay}ms</Typography>
                      <Slider
                        value={config.hideDelay}
                        onChange={(_, value) => onChange({ hideDelay: value as number })}
                        min={0}
                        max={1000}
                        step={50}
                        size="small"
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={config.showHeader}
                            onChange={(e) => onChange({ showHeader: e.target.checked })}
                            size="small"
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' } }}
                          />
                        }
                        label={<Typography variant="caption">Show Header</Typography>}
                      />
                    </Grid>
                    {config.showHeader && (
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Header Title"
                          value={config.headerTitle || ''}
                          onChange={(e) => onChange({ headerTitle: e.target.value })}
                          placeholder="Details"
                        />
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
            {/* END LEFT PANEL */}

            {/* RIGHT PANEL - Live Preview (Always Visible) */}
            <Box sx={{ 
              flex: '0 0 45%', 
              display: 'flex', 
              flexDirection: 'column',
              pl: 1,
            }}>
              {/* Test Values Input */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 2,
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  borderRadius: 1,
                  bgcolor: 'rgba(102, 126, 234, 0.02)',
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Test Values (Simulate Hover Data)
                </Typography>
                
                {config.dataExtractions.length === 0 ? (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      No data extractions configured. Add extractions to test with simulated values.
                    </Typography>
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {config.dataExtractions.map((extraction) => (
                      <TextField
                        key={extraction.id}
                        size="small"
                        label={extraction.targetVariable || 'Variable'}
                        value={testValues[extraction.targetVariable] || ''}
                        onChange={(e) => setTestValues(prev => ({
                          ...prev,
                          [extraction.targetVariable]: e.target.value,
                        }))}
                        placeholder={`Test value for ${extraction.targetVariable}`}
                        sx={{ flex: '1 1 200px', minWidth: 150 }}
                      />
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={() => {
                      setTestValues({});
                      setPreviewResult(null);
                      setPreviewError(null);
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={isRunningPreview ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
                    onClick={runPreview}
                    disabled={isRunningPreview}
                    sx={{ 
                      textTransform: 'none',
                      bgcolor: '#667eea',
                      '&:hover': { bgcolor: '#5567d5' },
                    }}
                  >
                    Run Preview
                  </Button>
                </Box>
              </Paper>

              {/* Error Display */}
              {previewError && (
                <Alert 
                  severity="error" 
                  sx={{ mb: 2 }}
                  icon={<ErrorIcon />}
                >
                  <Typography variant="caption" fontFamily="monospace">
                    {previewError}
                  </Typography>
                </Alert>
              )}

              {/* Calculation Results */}
              {previewResult && Object.keys(previewResult).length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    mb: 2,
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: 1,
                    bgcolor: 'rgba(34, 197, 94, 0.02)',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600} color="#22c55e" gutterBottom>
                    ✅ Calculation Results
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {Object.entries(previewResult).map(([key, value]) => (
                      <Tooltip
                        key={key}
                        title={
                          <pre style={{ margin: 0, maxWidth: 300, overflow: 'auto' }}>
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        }
                      >
                        <Chip
                          label={`${key}: ${Array.isArray(value) ? `[${value.length} items]` : typeof value}`}
                          size="small"
                          sx={{
                            bgcolor: '#22c55e15',
                            color: '#22c55e',
                            border: '1px solid #22c55e30',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Preview Container */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Preview Header */}
                {config.showHeader && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 2,
                      py: 1,
                      borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} color="#667eea">
                      {config.headerTitle || 'Details'}
                    </Typography>
                  </Box>
                )}

                {/* Preview Content */}
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 200 }}>
                  {renderPreviewContent()}
                </Box>

                {/* Preview Footer */}
                <Box sx={{ 
                  p: 1, 
                  borderTop: '1px solid rgba(102, 126, 234, 0.1)',
                  bgcolor: 'rgba(102, 126, 234, 0.02)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <Typography variant="caption" color="#64748b">
                    Preview Size: {config.width}×{config.height}px
                  </Typography>
                  <Typography variant="caption" color="#64748b">
                    Type: {config.type}
                  </Typography>
                </Box>
              </Paper>
            </Box>
            {/* END RIGHT PANEL */}
        </Box>
      </Collapse>
    </Box>
  );
}

