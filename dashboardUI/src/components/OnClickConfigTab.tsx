// components/OnClickConfigTab.tsx
// Edit page tab for configuring onClick actions (chart click → filter dashboard)
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  Chip,
  Alert,
  Divider,
  Stack,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  DragIndicator as DragIcon,
  TouchApp as TouchAppIcon,
  Code as CodeIcon,
  DataObject as DataObjectIcon,
  Settings as SettingsIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Info as InfoIcon,
  ShowChart as ChartIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { onClickConfigState, OnClickConfig, OnClickDataMapping, OnClickCalculation, AVAILABLE_SOURCE_KEYS, AVAILABLE_TABLE_SOURCE_KEYS, defaultOnClickConfig } from '../recoil/OnClickConfigState';
import { variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { childCardConfigState, ChildCardConfig } from '../recoil/ChildCardState';
import { CalculationEditor } from './CalculationEditor';

// Generate unique ID
const generateId = () => `onclick_calc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

// Helper to safely parse stored strings into arrays/objects/values
const safeParse = (value: any): any => {
  if (typeof value === 'string' && /^[\d,]+$/.test(value)) return value;
  try { return JSON.parse(value); } catch {
    try { return Function('"use strict";return (' + value + ')')(); } catch { return value; }
  }
};

// Helper to extract chart title from child card template
const getChartTitleFromChild = (child: ChildCardConfig): string => {
  try {
    if (child.template) {
      const template = typeof child.template === 'string'
        ? JSON.parse(child.template)
        : child.template;
      return template?.title?.text || 'Untitled Chart';
    }
  } catch { /* ignore */ }
  return 'Untitled Chart';
};

// Helper to get display number from child card ID (e.g., "child-2" → 2)
const getChildDisplayNumber = (childId: string, fallbackIndex: number): number => {
  const match = childId.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : fallbackIndex + 1;
};

// ─── Variable Chip with Tooltip (reused from Hooks.tsx pattern) ───
function VariableChipWithTooltip({ 
  name, 
  type,
  bgColor,
  textColor,
  borderColor,
}: { 
  name: string; 
  type: 'variable' | 'parameter' | 'filter';
  bgColor: string;
  textColor: string;
  borderColor: string;
}) {
  const variableValue = useRecoilValue(variableAtomFamily(name));
  const parameterValue = useRecoilValue(parameterAtomFamily(name));
  const filterConfig = useRecoilValue(filterConfigFamily(name));
  const liveFilterValue = useRecoilValue(liveFilterFamily(name));

  const getRawValue = () => {
    if (type === 'variable') return variableValue;
    if (type === 'parameter') return parameterValue;
    if (type === 'filter') return liveFilterValue ?? filterConfig?.defaultValues;
    return null;
  };

  const rawValue = getRawValue();
  const parsedValue = safeParse(rawValue);

  const getDisplayValue = () => {
    if (parsedValue === undefined || parsedValue === null || parsedValue === '') return '(empty)';
    if (Array.isArray(parsedValue)) {
      const preview = parsedValue.slice(0, 5);
      return JSON.stringify(preview, null, 2) + (parsedValue.length > 5 ? `\n... +${parsedValue.length - 5} more` : '');
    }
    if (typeof parsedValue === 'object') {
      const str = JSON.stringify(parsedValue, null, 2);
      return str.length > 300 ? str.substring(0, 300) + '\n...' : str;
    }
    return String(parsedValue);
  };

  const getTypeLabel = () => {
    if (parsedValue === undefined || parsedValue === null) return 'empty';
    if (Array.isArray(parsedValue)) return `Array[${parsedValue.length}]`;
    if (typeof parsedValue === 'object') return 'Object';
    if (typeof parsedValue === 'number') return 'Number';
    if (typeof parsedValue === 'string') return 'String';
    if (typeof parsedValue === 'boolean') return 'Boolean';
    return typeof parsedValue;
  };

  const getTypeIcon = () => {
    if (type === 'variable') return '📊';
    if (type === 'parameter') return '⚙️';
    if (type === 'filter') return '🔽';
    return '📦';
  };

  const getTypeColor = () => {
    if (type === 'variable') return '#06b6d4';
    if (type === 'parameter') return '#f59e0b';
    if (type === 'filter') return '#ec4899';
    return '#64748b';
  };

  return (
    <Tooltip
      title={
        <Box sx={{ width: 280 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pb: 1, mb: 1, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <Box sx={{ fontSize: '0.9rem', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', bgcolor: 'rgba(255,255,255,0.1)', flexShrink: 0 }}>
              {getTypeIcon()}
            </Box>
            <Box sx={{ overflow: 'hidden', flex: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: getTypeColor(), fontFamily: 'monospace', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
                {type.charAt(0).toUpperCase() + type.slice(1)} • {getTypeLabel()}
              </Typography>
            </Box>
          </Box>
          <Box component="pre" sx={{ fontSize: '0.7rem', fontFamily: '"Consolas", "Monaco", monospace', bgcolor: 'rgba(0,0,0,0.5)', p: 1, borderRadius: 1, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0, color: '#e2e8f0', lineHeight: 1.4 }}>
            {getDisplayValue()}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, pt: 0.75, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>📋 Click to copy</Typography>
            {Array.isArray(parsedValue) && (
              <Typography variant="caption" sx={{ color: getTypeColor(), fontSize: '0.6rem', fontWeight: 600 }}>{parsedValue.length} items</Typography>
            )}
          </Box>
        </Box>
      }
      arrow
      placement="top"
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: '#1e293b',
            border: '1px solid rgba(102, 126, 234, 0.25)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            borderRadius: 1.5,
            p: 1.5,
            maxWidth: 'none',
            '& .MuiTooltip-arrow': { color: '#1e293b', '&::before': { border: '1px solid rgba(102, 126, 234, 0.25)' } },
          },
        },
      }}
    >
      <Chip
        label={name}
        size="small"
        onClick={() => navigator.clipboard.writeText(name)}
        sx={{
          height: 24,
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          bgcolor: bgColor,
          color: textColor,
          border: `1px solid ${borderColor}`,
          cursor: 'pointer',
          '&:hover': { bgcolor: borderColor, transform: 'translateY(-1px)', boxShadow: `0 2px 8px ${borderColor}40` },
          transition: 'all 0.15s ease',
        }}
      />
    </Tooltip>
  );
}

// ─── Main Component ───
const OnClickConfigTab: React.FC = () => {
  const { id: parentCardId } = useParams<{ id: string }>();
  const [onClickConfigs, setOnClickConfigs] = useRecoilState(onClickConfigState);
  const childCardConfigs = useRecoilValue(childCardConfigState);
  const variableNames = useRecoilValue(variableNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(0);

  // Get variable names as array for dropdown
  const variableNamesArray = useMemo(() => Array.from(variableNames), [variableNames]);

  // Get the parent config for the current card being edited
  const parentConfig = childCardConfigs[parentCardId || ''];

  // Get chart-type and table-type child cards (filter out html)
  const chartChildren = useMemo(() => {
    if (!parentConfig?.childCards?.length) return [];
    return parentConfig.childCards.filter(
      (child: ChildCardConfig) => child.type === 'chart' || child.type === 'table'
    );
  }, [parentConfig]);

  // All child cards (for showing non-chart ones as disabled in the tabs)
  const allChildren = useMemo(() => {
    return parentConfig?.childCards || [];
  }, [parentConfig]);

  // Auto-select first chart child when available
  useEffect(() => {
    if (chartChildren.length > 0 && selectedChildIndex >= chartChildren.length) {
      setSelectedChildIndex(0);
    }
  }, [chartChildren.length, selectedChildIndex]);

  // Current selected child (chart or table)
  const selectedChild = chartChildren[selectedChildIndex] || null;
  const isSelectedTable = selectedChild?.type === 'table';

  // Config key: "{parentCardId}_{childCardId}"
  const selectedConfigKey = selectedChild && parentCardId
    ? `${parentCardId}_${selectedChild.id}`
    : '';

  // For table children: dynamically load column names from the table data variable
  const tableDataVariable = isSelectedTable ? (selectedChild?.tableDataSource || '') : '';
  const tableDataRaw = useRecoilValue(variableAtomFamily(tableDataVariable || '__nonexistent__'));
  const tableColumnNames = useMemo(() => {
    if (!isSelectedTable || !tableDataRaw) return [];
    try {
      const parsed = typeof tableDataRaw === 'string' ? JSON.parse(tableDataRaw) : tableDataRaw;
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        return Object.keys(parsed[0]);
      }
    } catch { /* ignore */ }
    return [];
  }, [isSelectedTable, tableDataRaw]);

  // Build source key options based on selected child type
  const sourceKeyOptions = useMemo(() => {
    if (isSelectedTable) {
      // For tables: column names + special table keys
      const columnKeys = tableColumnNames.map(col => ({
        key: col,
        label: col,
        description: `Column value from "${col}"`,
      }));
      return [...AVAILABLE_TABLE_SOURCE_KEYS, ...columnKeys];
    }
    // For charts: standard Highcharts point keys
    return AVAILABLE_SOURCE_KEYS;
  }, [isSelectedTable, tableColumnNames]);

  // Get current onClick config for selected child
  const currentConfig: OnClickConfig = useMemo(() => {
    if (!selectedConfigKey) return defaultOnClickConfig;
    return onClickConfigs[selectedConfigKey] || { ...defaultOnClickConfig };
  }, [selectedConfigKey, onClickConfigs]);

  // Build an extended variable list for each calculation index that includes
  // custom variables created by preceding onClick calculations in the same config.
  // This allows calculation #2 to reference a new variable created in calculation #1.
  const getAvailableVariablesForCalc = useCallback((calcIndex: number): string[] => {
    const customVarsFromPreceding: string[] = [];
    for (let i = 0; i < calcIndex; i++) {
      const c = currentConfig.calculations[i];
      if (c && c.isCustomVariable && c.targetVariable) {
        customVarsFromPreceding.push(c.targetVariable);
      }
    }
    // Merge: global variables + custom variables from preceding calcs (deduplicated)
    const merged = [...variableNamesArray];
    for (const cv of customVarsFromPreceding) {
      if (!merged.includes(cv)) {
        merged.push(cv);
      }
    }
    return merged;
  }, [variableNamesArray, currentConfig.calculations]);

  // Update config for selected child
  const updateConfig = useCallback((updates: Partial<OnClickConfig>) => {
    if (!selectedConfigKey) return;
    setOnClickConfigs(prev => ({
      ...prev,
      [selectedConfigKey]: {
        ...(prev[selectedConfigKey] || { ...defaultOnClickConfig }),
        ...updates,
      },
    }));
  }, [selectedConfigKey, setOnClickConfigs]);

  // Data Mapping handlers
  const addDataMapping = useCallback(() => {
    const defaultSourceKey = isSelectedTable ? (tableColumnNames[0] || '') : 'category';
    const defaultExtractionType = isSelectedTable ? 'row' as const : 'point' as const;
    const newMapping: OnClickDataMapping = { sourceKey: defaultSourceKey, clickVariable: '', extractionType: defaultExtractionType };
    updateConfig({ dataMapping: [...currentConfig.dataMapping, newMapping] });
  }, [currentConfig.dataMapping, updateConfig, isSelectedTable, tableColumnNames]);

  const updateDataMapping = useCallback((index: number, field: keyof OnClickDataMapping, value: string) => {
    const updated = [...currentConfig.dataMapping];
    updated[index] = { ...updated[index], [field]: value };
    updateConfig({ dataMapping: updated });
  }, [currentConfig.dataMapping, updateConfig]);

  const removeDataMapping = useCallback((index: number) => {
    const updated = currentConfig.dataMapping.filter((_, i) => i !== index);
    updateConfig({ dataMapping: updated });
  }, [currentConfig.dataMapping, updateConfig]);

  // Calculation handlers
  const addCalculation = useCallback(() => {
    const newCalc: OnClickCalculation = {
      id: generateId(),
      logic: '// Write your calculation logic here\n// Available: dsConnect(), click variables from Data Mapping\n// All dashboard variables, parameters, and filters are available\n// Return the value to assign to the target variable\n\nreturn "";',
      targetVariable: variableNamesArray[0] || '',
      isCustomVariable: false,
      order: currentConfig.calculations.length,
    };
    updateConfig({ calculations: [...currentConfig.calculations, newCalc] });
  }, [currentConfig.calculations, updateConfig, variableNamesArray]);

  const updateCalculation = useCallback((id: string, field: keyof OnClickCalculation, value: any) => {
    const updated = currentConfig.calculations.map(calc =>
      calc.id === id ? { ...calc, [field]: value } : calc
    );
    updateConfig({ calculations: updated });
  }, [currentConfig.calculations, updateConfig]);

  // Update multiple fields at once (avoids stale state from sequential single-field updates)
  const updateCalculationMulti = useCallback((id: string, fields: Partial<OnClickCalculation>) => {
    const updated = currentConfig.calculations.map(calc =>
      calc.id === id ? { ...calc, ...fields } : calc
    );
    updateConfig({ calculations: updated });
  }, [currentConfig.calculations, updateConfig]);

  const removeCalculation = useCallback((id: string) => {
    const updated = currentConfig.calculations.filter(c => c.id !== id);
    const reordered = updated.map((c, idx) => ({ ...c, order: idx }));
    updateConfig({ calculations: reordered });
  }, [currentConfig.calculations, updateConfig]);

  const moveCalculation = useCallback((id: string, direction: 'up' | 'down') => {
    const idx = currentConfig.calculations.findIndex(c => c.id === id);
    if (idx === -1) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === currentConfig.calculations.length - 1) return;

    const updated = [...currentConfig.calculations];
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    const reordered = updated.map((c, i) => ({ ...c, order: i }));
    updateConfig({ calculations: reordered });
  }, [currentConfig.calculations, updateConfig]);

  // Track which index in allChildren maps to which index in chartChildren (or table children)
  const getChartChildIndex = useCallback((allChildIndex: number): number => {
    const child = allChildren[allChildIndex];
    if (!child || (child.type !== 'chart' && child.type !== 'table')) return -1;
    return chartChildren.findIndex(c => c.id === child.id);
  }, [allChildren, chartChildren]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <TouchAppIcon sx={{ color: '#fff', fontSize: 28 }} />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={700} color="#1e293b">
            onClick Actions
          </Typography>
          <Typography variant="body2" color="#64748b">
            Configure what happens when users click on chart data points
          </Typography>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }} icon={<InfoIcon />}>
        <Typography variant="body2">
          <strong>How it works:</strong> When a user clicks a chart point (e.g., a bar for "Mumbai") or a <strong>table row</strong>, 
          the system extracts data, runs your calculations, and assigns results to existing 
          dashboard variables — <strong>overriding their current values</strong>. The dashboard re-renders with filtered data. 
          Click "Reset" to restore original values.
        </Typography>
      </Alert>

      {/* Quick Switch: Child Card Tabs */}
      {allChildren.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="body2">
            No child cards found for this card. Create child cards in the <strong>MultiCard Viz Config</strong> tab first.
          </Typography>
        </Alert>
      ) : chartChildren.length === 0 ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <Typography variant="body2">
            No chart or table child cards found. Charts and tables support onClick actions 
            (HTML cards are excluded). Change a child card type to "chart" or "table" in the <strong>MultiCard Viz Config</strong> tab.
          </Typography>
        </Alert>
      ) : (
        <>
          {/* Quick Switch Tabs */}
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              mb: 3,
              borderRadius: 2,
              border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, rgba(249, 115, 22, 0.03) 100%)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700} color="#ef4444">
                🎯 Quick Switch: Card {selectedChild ? getChildDisplayNumber(selectedChild.id, selectedChildIndex) : selectedChildIndex + 1} of {allChildren.length}
              </Typography>
              {selectedChild && (
                <Typography variant="caption" color="#64748b">
                  {getChartTitleFromChild(selectedChild)}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {allChildren.map((child, allIdx) => {
                const isClickable = child.type === 'chart' || child.type === 'table';
                const chartIdx = isClickable ? getChartChildIndex(allIdx) : -1;
                const isSelected = isClickable && chartIdx === selectedChildIndex;
                const displayNum = getChildDisplayNumber(child.id, allIdx);
                const configKey = parentCardId ? `${parentCardId}_${child.id}` : child.id;
                const hasActiveConfig = onClickConfigs[configKey]?.enabled;

                return (
                  <Chip
                    key={`quick-${child.id}-${allIdx}`}
                    label={`Card ${displayNum} (${child.type})${hasActiveConfig ? ' ✓' : ''}`}
                    icon={<ChartIcon sx={{ fontSize: '14px !important' }} />}
                    onClick={isClickable ? () => setSelectedChildIndex(chartIdx) : undefined}
                    disabled={!isClickable}
                    sx={{
                      cursor: isClickable ? 'pointer' : 'default',
                      fontWeight: isSelected ? 700 : 500,
                      bgcolor: isSelected
                        ? '#ef4444'
                        : isClickable
                          ? 'white'
                          : '#f1f5f9',
                      color: isSelected
                        ? 'white'
                        : isClickable
                          ? '#ef4444'
                          : '#94a3b8',
                      border: isSelected
                        ? 'none'
                        : isClickable
                          ? '2px solid #ef4444'
                          : '2px solid #e2e8f0',
                      opacity: isClickable ? 1 : 0.5,
                      '&:hover': isClickable ? {
                        bgcolor: isSelected
                          ? '#dc2626'
                          : 'rgba(239, 68, 68, 0.1)',
                      } : {},
                      '&.Mui-disabled': {
                        opacity: 0.45,
                        color: '#94a3b8',
                        border: '2px solid #e2e8f0',
                      },
                    }}
                  />
                );
              })}
            </Box>
          </Paper>

          {/* Configuration for selected chart child */}
          {selectedChild && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {/* Enable Toggle */}
              <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentConfig.enabled}
                      onChange={(e) => updateConfig({ enabled: e.target.checked })}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography fontWeight={600} color="#1e293b">
                        Enable onClick Actions for Card {getChildDisplayNumber(selectedChild.id, selectedChildIndex)}
                        {isSelectedTable && <Chip label="TABLE" size="small" sx={{ ml: 1, height: 20, fontSize: '0.65rem', bgcolor: '#dbeafe', color: '#1e40af', fontWeight: 700 }} />}
                      </Typography>
                      <Typography variant="caption" color="#64748b">
                        {isSelectedTable 
                          ? `${selectedChild.tableDataSource || 'Table'} — When enabled, clicking a table row will trigger calculations`
                          : `${getChartTitleFromChild(selectedChild)} — When enabled, clicking data points will trigger calculations`
                        }
                      </Typography>
                    </Box>
                  }
                />
              </Paper>

              {currentConfig.enabled && (
                <>
                  {/* Table-specific info banner */}
                  {isSelectedTable && (
                    <Alert severity="info" sx={{ borderRadius: 2, py: 0.5 }} icon={<InfoIcon />}>
                      <Typography variant="body2">
                        <strong>Table onClick:</strong> When a user clicks a row, all column values of that row are available for data mapping. 
                        {tableColumnNames.length > 0 
                          ? <> Available columns: {tableColumnNames.slice(0, 8).map(c => <code key={c}>{c}</code>).reduce((prev: any, curr: any) => [prev, ', ', curr] as any)}{tableColumnNames.length > 8 ? `, +${tableColumnNames.length - 8} more` : ''}</>
                          : <> No columns detected yet — make sure the data variable is loaded.</>
                        }
                      </Typography>
                    </Alert>
                  )}

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* Section A: Data Mapping (with extraction type like tooltip)   */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#f0f9ff', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <DataObjectIcon sx={{ color: '#0284c7' }} />
                      <Box>
                        <Typography fontWeight={700} color="#0c4a6e">Data Mapping</Typography>
                        <Typography variant="caption" color="#64748b">
                          {isSelectedTable 
                            ? <>Map data from the clicked <strong>table row</strong> to named variables available in your calculations. Use column names like <code>{tableColumnNames[0] || 'columnName'}</code></>
                            : <>Map data from the clicked point to named variables available in your calculations. Use paths like <code>category</code>, <code>y</code>, <code>options.custom.data</code></>
                          }
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 2 }}>
                      {/* Header Row */}
                      {currentConfig.dataMapping.length > 0 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                          <Box sx={{ width: 130, flexShrink: 0 }}>
                            <Typography variant="caption" fontWeight={600} color="#475569">Source</Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" fontWeight={600} color="#475569">Source Key / Path</Typography>
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" fontWeight={600} color="#475569">Click Variable Name</Typography>
                          </Box>
                          <Box sx={{ width: 40, flexShrink: 0 }} />
                        </Box>
                      )}

                      {/* Mapping Rows */}
                      {currentConfig.dataMapping.map((mapping, index) => (
                        <Box key={index} sx={{ mb: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            {/* Extraction Type: Point, Chart Config, or Row (for tables) */}
                            <FormControl size="small" sx={{ width: 130, flexShrink: 0 }}>
                              <Select
                                value={mapping.extractionType || (isSelectedTable ? 'row' : 'point')}
                                onChange={(e) => updateDataMapping(index, 'extractionType', e.target.value)}
                                sx={{ bgcolor: '#fff' }}
                              >
                                {isSelectedTable ? (
                                  <MenuItem value="row">
                                    <Tooltip title="Extract from the clicked table row (column value)" placement="right">
                                      <Typography variant="body2" fontWeight={500}>Row</Typography>
                                    </Tooltip>
                                  </MenuItem>
                                ) : ([
                                  <MenuItem key="point" value="point">
                                    <Tooltip title="Extract from the clicked data point (runtime)" placement="right">
                                      <Typography variant="body2" fontWeight={500}>Point</Typography>
                                    </Tooltip>
                                  </MenuItem>,
                                  <MenuItem key="config" value="config">
                                    <Tooltip title="Extract from the chart configuration (design-time)" placement="right">
                                      <Typography variant="body2" fontWeight={500}>Chart Config</Typography>
                                    </Tooltip>
                                  </MenuItem>,
                                ])}
                              </Select>
                            </FormControl>

                            {/* Source Key - Autocomplete with freeSolo for custom paths */}
                            <Autocomplete
                              freeSolo
                              options={sourceKeyOptions.map(sk => sk.key)}
                              value={mapping.sourceKey}
                              onChange={(_, newValue) => updateDataMapping(index, 'sourceKey', newValue || '')}
                              onInputChange={(_, newValue) => updateDataMapping(index, 'sourceKey', newValue)}
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  size="small"
                                  placeholder={isSelectedTable 
                                    ? `e.g., ${tableColumnNames[0] || 'columnName'}` 
                                    : mapping.extractionType === 'config' ? 'e.g., series[0].name' : 'e.g., category'}
                                  sx={{ bgcolor: '#fff' }}
                                />
                              )}
                              renderOption={(props, option) => {
                                const sk = sourceKeyOptions.find(s => s.key === option);
                                const isSpecialKey = option.startsWith('_');
                                return (
                                  <li {...props}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Typography variant="body2" fontWeight={500} sx={isSpecialKey ? { color: '#7c3aed', fontStyle: 'italic' } : {}}>
                                        {option}
                                      </Typography>
                                      {sk && <Typography variant="caption" color="#94a3b8">({sk.label})</Typography>}
                                    </Box>
                                  </li>
                                );
                              }}
                              sx={{ flex: 1 }}
                            />

                            <TextField
                              size="small"
                              placeholder="e.g., clickedCity"
                              value={mapping.clickVariable}
                              onChange={(e) => updateDataMapping(index, 'clickVariable', e.target.value)}
                              sx={{ flex: 1, bgcolor: '#fff' }}
                            />

                            <IconButton
                              size="small"
                              onClick={() => removeDataMapping(index)}
                              sx={{ color: '#ef4444', width: 40, flexShrink: 0 }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* Show variable availability hint inline */}
                          {mapping.clickVariable && (
                            <Typography variant="caption" color="#64748b" sx={{ ml: '146px', mt: 0.25, display: 'block' }}>
                              Available as: <code>{mapping.clickVariable}</code>
                            </Typography>
                          )}
                        </Box>
                      ))}

                      {/* Add Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addDataMapping}
                        sx={{
                          mt: 1,
                          borderColor: '#0284c7',
                          color: '#0284c7',
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#f0f9ff', borderColor: '#0284c7' },
                        }}
                      >
                        Add Mapping
                      </Button>

                      {currentConfig.dataMapping.length === 0 && (
                        <Typography variant="body2" color="#94a3b8" sx={{ mt: 1, fontStyle: 'italic' }}>
                          No mappings yet. Add mappings to extract data from clicked points or chart config.
                        </Typography>
                      )}
                    </Box>
                  </Paper>

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* Section: Available Variables (same as Hooks.tsx)              */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  <Accordion
                    sx={{
                      boxShadow: 'none',
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                      borderRadius: '8px !important',
                      '&:before': { display: 'none' },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: '#667eea' }} />}
                      sx={{ '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.05)' } }}
                    >
                      <Typography
                        variant="subtitle2"
                        fontWeight={700}
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        📚 Available Variables in Logic (Scope)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2 }}>
                      <Stack spacing={2}>
                        {/* Variables (Calculated) */}
                        <Box>
                          <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 0.5 }}>
                            📊 Variables (Calculated):
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {variableNamesArray.length > 0 ? variableNamesArray.map((name) => (
                              <VariableChipWithTooltip
                                key={name}
                                name={name}
                                type="variable"
                                bgColor="rgba(6, 182, 212, 0.12)"
                                textColor="#06b6d4"
                                borderColor="rgba(6, 182, 212, 0.25)"
                              />
                            )) : (
                              <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                No calculated variables yet
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Parameters (Static) */}
                        <Box>
                          <Typography variant="caption" fontWeight={600} color="#f59e0b" sx={{ display: 'block', mb: 0.5 }}>
                            ⚙️ Parameters (Static):
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {parameterNames.length > 0 ? Array.from(parameterNames).map((name) => (
                              <VariableChipWithTooltip
                                key={name as string}
                                name={name as string}
                                type="parameter"
                                bgColor="rgba(245, 158, 11, 0.12)"
                                textColor="#f59e0b"
                                borderColor="rgba(245, 158, 11, 0.25)"
                              />
                            )) : (
                              <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                No parameters defined
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Filters (Interactive) */}
                        <Box>
                          <Typography variant="caption" fontWeight={600} color="#ec4899" sx={{ display: 'block', mb: 0.5 }}>
                            🔽 Filters (Interactive):
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {filterNames.length > 0 ? Array.from(filterNames).map((name) => (
                              <VariableChipWithTooltip
                                key={name}
                                name={name}
                                type="filter"
                                bgColor="rgba(236, 72, 153, 0.12)"
                                textColor="#ec4899"
                                borderColor="rgba(236, 72, 153, 0.25)"
                              />
                            )) : (
                              <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                No filters defined
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        {/* Hint */}
                        <Typography variant="caption" color="#64748b" sx={{ pt: 1, borderTop: '1px solid rgba(102, 126, 234, 0.1)' }}>
                          💡 Hover to see value, click to copy. Use these variables in your onClick calculation logic.
                          The calculation result will <strong>override</strong> the target variable's current value.
                        </Typography>
                      </Stack>
                    </AccordionDetails>
                  </Accordion>

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* Section B: Calculations                                       */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#fef3c7', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CodeIcon sx={{ color: '#d97706' }} />
                      <Box>
                        <Typography fontWeight={700} color="#78350f">onClick Calculations</Typography>
                        <Typography variant="caption" color="#64748b">
                          Define calculations to run when a point is clicked. You can <strong>override existing variables</strong> or 
                          <strong> create new custom variables</strong> specific to this onClick action. All values are restored on reset.
                        </Typography>
                      </Box>
                    </Box>

                    {/* Info */}
                    <Alert severity="info" sx={{ mx: 2, mt: 2, mb: 0, borderRadius: 1.5, py: 0.5 }}>
                      <Typography variant="caption">
                        <strong>💡 Two modes:</strong> <strong>Override Existing</strong> — replaces an existing dashboard variable's value (restored on reset). 
                        <strong> Create New</strong> — creates a new variable that only exists during the onClick drill-down (cleared on reset). 
                        Use "Create New" for intermediate calculations that don't need to exist in the Hooks tab.
                      </Typography>
                    </Alert>

                    <Box sx={{ p: 2 }}>
                      {currentConfig.calculations.map((calc, index) => (
                        <Accordion
                          key={calc.id}
                          defaultExpanded
                          sx={{
                            mb: 2,
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px !important',
                            '&:before': { display: 'none' },
                            overflow: 'hidden',
                          }}
                        >
                          <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                              bgcolor: '#fafafa',
                              minHeight: 48,
                              '& .MuiAccordionSummary-content': { alignItems: 'center', gap: 1 },
                            }}
                          >
                            <DragIcon sx={{ color: '#94a3b8', mr: 0.5 }} />
                            <Typography fontWeight={600} color="#1e293b" variant="body2">
                              Calculation {index + 1}
                            </Typography>
                            {calc.targetVariable && (
                              <Chip
                                label={calc.isCustomVariable 
                                  ? `→ NEW $\{${calc.targetVariable}}`
                                  : `→ $\{${calc.targetVariable}}`
                                }
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  ml: 1, height: 22, 
                                  borderColor: calc.isCustomVariable ? '#16a34a' : '#7c3aed', 
                                  color: calc.isCustomVariable ? '#16a34a' : '#7c3aed',
                                }}
                              />
                            )}
                            <Box sx={{ flexGrow: 1 }} />
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); moveCalculation(calc.id, 'up'); }}
                              disabled={index === 0}
                              sx={{ mr: 0.5 }}
                            >
                              <ArrowUpIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); moveCalculation(calc.id, 'down'); }}
                              disabled={index === currentConfig.calculations.length - 1}
                              sx={{ mr: 0.5 }}
                            >
                              <ArrowDownIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); removeCalculation(calc.id); }}
                              sx={{ color: '#ef4444' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </AccordionSummary>

                          <AccordionDetails sx={{ p: 2 }}>
                            {/* Variable Mode Toggle + Target Variable */}
                            <Box sx={{ mb: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Chip
                                  label="Override Existing"
                                  size="small"
                                  onClick={() => {
                                    updateCalculationMulti(calc.id, { isCustomVariable: false, targetVariable: variableNamesArray[0] || '' });
                                  }}
                                  sx={{
                                    cursor: 'pointer',
                                    fontWeight: !calc.isCustomVariable ? 700 : 500,
                                    bgcolor: !calc.isCustomVariable ? '#d97706' : 'transparent',
                                    color: !calc.isCustomVariable ? '#fff' : '#78350f',
                                    border: !calc.isCustomVariable ? 'none' : '1px solid #d97706',
                                    '&:hover': { bgcolor: !calc.isCustomVariable ? '#b45309' : 'rgba(217, 119, 6, 0.1)' },
                                  }}
                                />
                                <Chip
                                  label="Create New Variable"
                                  size="small"
                                  onClick={() => {
                                    updateCalculationMulti(calc.id, { isCustomVariable: true, targetVariable: '' });
                                  }}
                                  sx={{
                                    cursor: 'pointer',
                                    fontWeight: calc.isCustomVariable ? 700 : 500,
                                    bgcolor: calc.isCustomVariable ? '#16a34a' : 'transparent',
                                    color: calc.isCustomVariable ? '#fff' : '#14532d',
                                    border: calc.isCustomVariable ? 'none' : '1px solid #16a34a',
                                    '&:hover': { bgcolor: calc.isCustomVariable ? '#15803d' : 'rgba(22, 163, 74, 0.1)' },
                                  }}
                                />
                              </Box>

                              {!calc.isCustomVariable ? (
                                <FormControl fullWidth size="small">
                                  <InputLabel>Target Variable (will be overridden)</InputLabel>
                                  <Select
                                    value={calc.targetVariable}
                                    onChange={(e) => updateCalculation(calc.id, 'targetVariable', e.target.value)}
                                    label="Target Variable (will be overridden)"
                                  >
                                    {(() => {
                                      const availableVars = getAvailableVariablesForCalc(index);
                                      return availableVars.map(vn => {
                                        // Check if this variable was created by a preceding onClick calculation
                                        const isFromOnClick = !variableNamesArray.includes(vn);
                                        return (
                                          <MenuItem key={vn} value={vn}>
                                            <Typography variant="body2">
                                              ${`{${vn}}`}
                                              {isFromOnClick && (
                                                <Chip 
                                                  label="onClick" 
                                                  size="small" 
                                                  sx={{ 
                                                    ml: 1, height: 18, fontSize: '0.65rem',
                                                    bgcolor: '#dcfce7', color: '#16a34a', 
                                                    fontWeight: 600 
                                                  }} 
                                                />
                                              )}
                                            </Typography>
                                          </MenuItem>
                                        );
                                      });
                                    })()}
                                  </Select>
                                  <Typography variant="caption" color="#64748b" sx={{ mt: 0.5 }}>
                                    The calculation result will <strong>override</strong> this variable's current value. Original value is saved for reset.
                                    {getAvailableVariablesForCalc(index).length > variableNamesArray.length && (
                                      <span style={{ color: '#16a34a', fontWeight: 600 }}>
                                        {' '}Includes custom variables from preceding onClick calculations.
                                      </span>
                                    )}
                                  </Typography>
                                </FormControl>
                              ) : (
                                <Box>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="e.g., filteredSalesData"
                                    value={calc.targetVariable}
                                    onChange={(e) => updateCalculation(calc.id, 'targetVariable', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                    sx={{ bgcolor: '#fff' }}
                                    InputProps={{
                                      startAdornment: (
                                        <Typography variant="body2" color="#16a34a" fontWeight={600} sx={{ mr: 0.5 }}>
                                          NEW:
                                        </Typography>
                                      ),
                                    }}
                                  />
                                  <Typography variant="caption" color="#16a34a" sx={{ mt: 0.5, display: 'block' }}>
                                    Creates a <strong>new variable</strong> <code>${`{${calc.targetVariable || '...'}}`}</code> available only during this onClick drill-down. 
                                    Cleared on reset. Use this for intermediate calculations that don't exist in the Hooks tab.
                                  </Typography>
                                </Box>
                              )}
                            </Box>

                            {/* Logic Editor */}
                            <Typography variant="caption" fontWeight={600} color="#475569" sx={{ mb: 0.5, display: 'block' }}>
                              Calculation Logic
                            </Typography>
                            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1.5, overflow: 'hidden', mb: 1 }}>
                              <CalculationEditor
                                value={calc.logic}
                                onChange={(value) => updateCalculation(calc.id, 'logic', value)}
                                height={200}
                              />
                            </Box>
                            <Typography variant="caption" color="#94a3b8">
                              Use <code>dsConnect("datasource", "SQL")</code> for database queries. 
                              Click variables from Data Mapping are available directly (e.g., <code>clickedCity</code>).
                              All dashboard variables, parameters, and filters are also available.
                              Use <code>@</code> to autocomplete variables.
                            </Typography>
                          </AccordionDetails>
                        </Accordion>
                      ))}

                      {/* Add Calculation Button */}
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addCalculation}
                        sx={{
                          mt: 1,
                          borderColor: '#d97706',
                          color: '#d97706',
                          textTransform: 'none',
                          '&:hover': { bgcolor: '#fffbeb', borderColor: '#d97706' },
                        }}
                      >
                        Add Calculation
                      </Button>

                      {currentConfig.calculations.length === 0 && (
                        <Typography variant="body2" color="#94a3b8" sx={{ mt: 1, fontStyle: 'italic' }}>
                          No calculations yet. Add calculations to process clicked data and update dashboard variables.
                        </Typography>
                      )}
                    </Box>
                  </Paper>

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* Section C: Behavior                                           */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#f0fdf4', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <SettingsIcon sx={{ color: '#16a34a' }} />
                      <Box>
                        <Typography fontWeight={700} color="#14532d">Behavior</Typography>
                        <Typography variant="caption" color="#64748b">
                          Configure how the onClick interaction behaves
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={currentConfig.resetOnClickOutside}
                            onChange={(e) => updateConfig({ resetOnClickOutside: e.target.checked })}
                            size="small"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={500}>Reset on click outside</Typography>
                            <Typography variant="caption" color="#64748b">
                              Automatically restore original values when clicking on chart background
                            </Typography>
                          </Box>
                        }
                      />

                      <Divider />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={currentConfig.showResetButton}
                            onChange={(e) => updateConfig({ showResetButton: e.target.checked })}
                            size="small"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={500}>Show reset button</Typography>
                            <Typography variant="caption" color="#64748b">
                              Display a "Reset" button beside the filter button on this card when drill-down is active
                            </Typography>
                          </Box>
                        }
                      />

                      <Divider />

                      <FormControlLabel
                        control={
                          <Switch
                            checked={currentConfig.highlightClicked}
                            onChange={(e) => updateConfig({ highlightClicked: e.target.checked })}
                            size="small"
                          />
                        }
                        label={
                          <Box>
                            <Typography variant="body2" fontWeight={500}>
                              {isSelectedTable ? 'Highlight clicked row' : 'Highlight clicked point'}
                            </Typography>
                            <Typography variant="caption" color="#64748b">
                              {isSelectedTable 
                                ? <>Visually highlight the clicked <strong>table row</strong> within this specific child card only (dims other rows). Does not affect other cards.</>
                                : <>Visually highlight the clicked data point within <strong>this specific child card only</strong> (dims other points in the same chart). Does not affect other cards or charts.</>
                              }
                            </Typography>
                          </Box>
                        }
                      />
                    </Box>
                  </Paper>

                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {/* Summary / Preview                                             */}
                  {/* ═══════════════════════════════════════════════════════════════ */}
                  {currentConfig.dataMapping.length > 0 && currentConfig.calculations.length > 0 && (
                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#faf5ff' }}>
                      <Typography variant="body2" fontWeight={600} color="#7c3aed" gutterBottom>
                        Configuration Summary
                      </Typography>
                      <Typography variant="body2" color="#64748b" sx={{ mb: 1 }}>
                        When {isSelectedTable ? 'a row' : 'a point'} is clicked on <strong>{isSelectedTable ? (selectedChild.tableDataSource || 'Table') : getChartTitleFromChild(selectedChild)}</strong> (Card {getChildDisplayNumber(selectedChild.id, selectedChildIndex)}):
                      </Typography>
                      <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
                        {currentConfig.dataMapping.map((m, i) => (
                          <li key={i}>
                            <Typography variant="caption" color="#475569">
                              Extract <code>{m.sourceKey}</code> ({m.extractionType === 'row' ? 'from table row' : m.extractionType === 'config' ? 'from chart config' : 'from point'}) → <code>{m.clickVariable || '(unnamed)'}</code>
                            </Typography>
                          </li>
                        ))}
                        {currentConfig.calculations.map((c, i) => (
                          <li key={c.id}>
                            <Typography variant="caption" color="#475569">
                              Run calculation → {c.isCustomVariable 
                                ? <><strong>create new</strong> <code>${`{${c.targetVariable}}`}</code></>
                                : <><strong>override</strong> <code>${`{${c.targetVariable}}`}</code></>
                              }
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Paper>
                  )}
                </>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default OnClickConfigTab;
