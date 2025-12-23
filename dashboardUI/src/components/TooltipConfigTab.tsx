import React, { useState, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import { tooltipConfigState, TooltipConfig, TooltipDataMapping, defaultTooltipConfig } from '../recoil/TooltipConfigState';
import { chartConfigState } from '../recoil/ChartConfig';
import { variableNamesState } from '../recoil/Variabletracker';
import { hooksArrayOfObjectsSelector } from '../recoil/Variabletracker';
import ResizableChart from './ResizableChart';
import DashboardTable from './DashboardTable';
import { JsonEditor } from './JsonEditor';
import { HtmlEditor } from './HtmlEditor';
import {
  Box,
  Paper,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Chip,
  Alert,
  AlertTitle,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  Grid,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ShowChart as ShowChartIcon,
  TableChart as TableChartIcon,
  Html as HtmlIcon,
  Dashboard as DashboardIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  DataObject as DataObjectIcon,
  Link as LinkIcon,
  Info as InfoIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { TableSettings, defaultTableSettings } from '../types/tableTypes';

interface TooltipConfigTabProps {
  availableVariables?: Record<string, any>;
}

// Sample point data for preview
const samplePointData = {
  x: 0,
  y: 42.5,
  name: 'Sample Point',
  category: 'Category A',
  series: { name: 'Series 1' },
  color: '#667eea',
  percentage: 25.5,
};

export default function TooltipConfigTab({ availableVariables = {} }: TooltipConfigTabProps) {
  const { id: chartId } = useParams<{ id: string }>();
  const [tooltipConfigs, setTooltipConfigs] = useRecoilState(tooltipConfigState);
  const chartConfigs = useRecoilValue(chartConfigState);
  const variableNames = useRecoilValue(variableNamesState);
  const arrayOfObjectsVariables = useRecoilValue(hooksArrayOfObjectsSelector);
  
  // Get current tooltip config or use default
  const tooltipConfig: TooltipConfig = chartId && tooltipConfigs[chartId] 
    ? tooltipConfigs[chartId] 
    : defaultTooltipConfig;
  
  // Preview state
  const [previewData, setPreviewData] = useState(samplePointData);
  const [showPreview, setShowPreview] = useState(true);
  
  // Local state for editing
  const [localConfig, setLocalConfig] = useState<TooltipConfig>(tooltipConfig);
  
  // Sync local state when chartId changes
  useEffect(() => {
    if (chartId && tooltipConfigs[chartId]) {
      setLocalConfig(tooltipConfigs[chartId]);
    } else {
      setLocalConfig(defaultTooltipConfig);
    }
  }, [chartId, tooltipConfigs]);

  // Save config to recoil state
  const saveConfig = (newConfig: TooltipConfig) => {
    if (!chartId) return;
    setLocalConfig(newConfig);
    setTooltipConfigs(prev => ({
      ...prev,
      [chartId]: newConfig,
    }));
  };

  // Update a single field
  const updateField = <K extends keyof TooltipConfig>(field: K, value: TooltipConfig[K]) => {
    saveConfig({ ...localConfig, [field]: value });
  };

  // Add data mapping
  const addDataMapping = () => {
    const newMapping: TooltipDataMapping = {
      sourceKey: '',
      targetVariable: '',
    };
    saveConfig({
      ...localConfig,
      dataMapping: [...localConfig.dataMapping, newMapping],
    });
  };

  // Update data mapping
  const updateDataMapping = (index: number, field: keyof TooltipDataMapping, value: string) => {
    const newMappings = [...localConfig.dataMapping];
    newMappings[index] = { ...newMappings[index], [field]: value };
    saveConfig({ ...localConfig, dataMapping: newMappings });
  };

  // Remove data mapping
  const removeDataMapping = (index: number) => {
    const newMappings = localConfig.dataMapping.filter((_, i) => i !== index);
    saveConfig({ ...localConfig, dataMapping: newMappings });
  };

  // Get available cards for card type tooltip
  const availableCards = useMemo(() => {
    return Object.entries(chartConfigs)
      .filter(([id]) => id !== chartId) // Exclude current chart
      .map(([id, config]) => ({
        id,
        name: id,
        type: config.type || 'chart',
      }));
  }, [chartConfigs, chartId]);

  // Build preview variables
  const previewVariables = useMemo(() => {
    const vars: Record<string, any> = { ...previewData };
    
    // Apply data mappings
    localConfig.dataMapping.forEach(mapping => {
      if (mapping.sourceKey && mapping.targetVariable) {
        const value = mapping.sourceKey.split('.').reduce((obj: any, key) => obj?.[key], previewData);
        if (value !== undefined) {
          vars[mapping.targetVariable] = value;
        }
      }
    });
    
    return vars;
  }, [previewData, localConfig.dataMapping]);

  // Render preview content
  const renderPreview = () => {
    if (!showPreview || !localConfig.enabled) {
      return (
        <Box sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'rgba(102, 126, 234, 0.05)',
          borderRadius: 2,
        }}>
          <Typography variant="body2" color="#64748b">
            {!localConfig.enabled ? 'Enable tooltip to see preview' : 'Preview hidden'}
          </Typography>
        </Box>
      );
    }

    switch (localConfig.type) {
      case 'card': {
        const cardConfig = localConfig.cardId ? chartConfigs[localConfig.cardId] : null;
        if (!cardConfig) {
          return (
            <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
              <Typography variant="body2">Select a card to preview</Typography>
            </Box>
          );
        }
        
        if (cardConfig.type === 'table') {
          return <DashboardTable dataSource={cardConfig.tableDataSource} settings={cardConfig.tableSettings} />;
        } else if (cardConfig.type === 'html') {
          return <div dangerouslySetInnerHTML={{ __html: cardConfig.htmlContent || '' }} />;
        } else {
          try {
            const options = JSON.parse(cardConfig.template || '{}');
            return <ResizableChart options={options} />;
          } catch {
            return <Typography color="error">Invalid chart config</Typography>;
          }
        }
      }
      
      case 'chart': {
        if (!localConfig.chartTemplate) {
          return (
            <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
              <Typography variant="body2">Enter chart template to preview</Typography>
            </Box>
          );
        }
        
        try {
          let processedTemplate = localConfig.chartTemplate;
          Object.entries(previewVariables).forEach(([key, value]) => {
            const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
            const jsonValue = JSON.stringify(value);
            
            // Replace {{key}} pattern (double curly braces) - for titles and text
            processedTemplate = processedTemplate.replace(
              new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
              stringValue
            );
            // Replace "${key}" pattern (quoted)
            processedTemplate = processedTemplate.replace(
              new RegExp(`"\\$\\{${key}\\}"`, 'g'),
              jsonValue
            );
            // Replace ${key} pattern (unquoted)
            processedTemplate = processedTemplate.replace(
              new RegExp(`\\$\\{${key}\\}`, 'g'),
              stringValue
            );
          });
          const options = JSON.parse(processedTemplate);
          return <ResizableChart options={options} />;
        } catch (e) {
          return <Typography color="error" variant="body2">Error: {String(e)}</Typography>;
        }
      }
      
      case 'table': {
        if (!localConfig.tableDataSource) {
          return (
            <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
              <Typography variant="body2">Select data source to preview</Typography>
            </Box>
          );
        }
        return <DashboardTable dataSource={localConfig.tableDataSource} settings={localConfig.tableSettings} />;
      }
      
      case 'html': {
        if (!localConfig.htmlTemplate) {
          // Show default HTML preview
          return (
            <Box sx={{ p: 2, fontFamily: 'system-ui' }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1, color: '#1e293b' }}>
                Point Details
              </Typography>
              {Object.entries(previewVariables)
                .filter(([key]) => !key.includes('.') && typeof previewVariables[key] !== 'object')
                .map(([key, value]) => (
                  <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, borderBottom: '1px solid #e2e8f0' }}>
                    <Typography variant="body2" color="#64748b">{key}:</Typography>
                    <Typography variant="body2" fontWeight={600} color="#1e293b">{String(value)}</Typography>
                  </Box>
                ))}
            </Box>
          );
        }
        
        let processedHtml = localConfig.htmlTemplate;
        Object.entries(previewVariables).forEach(([key, value]) => {
          processedHtml = processedHtml.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'),
            String(value)
          );
          processedHtml = processedHtml.replace(
            new RegExp(`\\$\\{${key}\\}`, 'g'),
            String(value)
          );
        });
        return <div dangerouslySetInnerHTML={{ __html: processedHtml }} style={{ height: '100%', overflow: 'auto' }} />;
      }
      
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 300px)', minHeight: 500 }}>
      {/* Configuration Panel */}
      <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid rgba(102, 126, 234, 0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
          }}
        >
          {/* Enable/Disable Toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                Tooltip Configuration
              </Typography>
              <Typography variant="caption" color="#64748b">
                Configure custom tooltip for chart hover interactions
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={localConfig.enabled}
                  onChange={(e) => updateField('enabled', e.target.checked)}
                  sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#667eea' },
                  }}
                />
              }
              label={<Typography fontWeight={600}>{localConfig.enabled ? 'Enabled' : 'Disabled'}</Typography>}
            />
          </Box>

          {localConfig.enabled && (
            <>
              {/* Tooltip Type Selection */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SettingsIcon fontSize="small" />
                  Tooltip Type
                </Typography>
                <ToggleButtonGroup
                  value={localConfig.type}
                  exclusive
                  onChange={(_, value) => value && updateField('type', value)}
                  fullWidth
                  size="small"
                  sx={{
                    '& .MuiToggleButton-root': {
                      textTransform: 'none',
                      fontWeight: 600,
                      py: 1.5,
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                      '&.Mui-selected': {
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="chart">
                    <ShowChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Chart
                  </ToggleButton>
                  <ToggleButton value="table">
                    <TableChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Table
                  </ToggleButton>
                  <ToggleButton value="html">
                    <HtmlIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    HTML
                  </ToggleButton>
                  <ToggleButton value="card">
                    <DashboardIcon sx={{ mr: 0.5, fontSize: 18 }} />
                    Card
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Type-specific Configuration */}
              {localConfig.type === 'card' && (
                <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DashboardIcon fontSize="small" />
                      Select Card
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormControl fullWidth size="small">
                      <InputLabel>Dashboard Card</InputLabel>
                      <Select
                        value={localConfig.cardId || ''}
                        label="Dashboard Card"
                        onChange={(e) => updateField('cardId', e.target.value)}
                        sx={{ bgcolor: 'white' }}
                      >
                        <MenuItem value="">
                          <em>Select a card...</em>
                        </MenuItem>
                        {availableCards.map((card) => (
                          <MenuItem key={card.id} value={card.id}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip
                                size="small"
                                label={card.type}
                                sx={{
                                  height: 20,
                                  fontSize: '0.7rem',
                                  bgcolor: card.type === 'chart' ? 'rgba(102, 126, 234, 0.1)' : 
                                          card.type === 'table' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  color: card.type === 'chart' ? '#667eea' : 
                                         card.type === 'table' ? '#3b82f6' : '#10b981',
                                }}
                              />
                              <Typography variant="body2">{card.name}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    {availableCards.length === 0 && (
                      <Alert severity="info" sx={{ mt: 1.5 }}>
                        <Typography variant="caption">
                          No other cards available. Create additional cards in the dashboard first.
                        </Typography>
                      </Alert>
                    )}
                  </AccordionDetails>
                </Accordion>
              )}

              {localConfig.type === 'chart' && (
                <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ShowChartIcon fontSize="small" />
                      Chart Template
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                      <Typography variant="caption">
                        Use <code style={{ background: 'rgba(102, 126, 234, 0.1)', padding: '2px 4px', borderRadius: 4 }}>${'{'}variableName{'}'}</code> to insert data from the hovered point.
                      </Typography>
                    </Alert>
                    <Box sx={{ height: 300 }}>
                      <JsonEditor
                        value={localConfig.chartTemplate || ''}
                        onChange={(value) => updateField('chartTemplate', value)}
                        height={280}
                        placeholder="Enter Highcharts JSON configuration for tooltip chart..."
                        availableVariables={previewVariables}
                      />
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {localConfig.type === 'table' && (
                <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TableChartIcon fontSize="small" />
                      Table Configuration
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Data Source Variable</InputLabel>
                      <Select
                        value={localConfig.tableDataSource || ''}
                        label="Data Source Variable"
                        onChange={(e) => updateField('tableDataSource', e.target.value)}
                        sx={{ bgcolor: 'white' }}
                      >
                        <MenuItem value="">
                          <em>Select a variable...</em>
                        </MenuItem>
                        {arrayOfObjectsVariables.map((varName: string) => (
                          <MenuItem key={varName} value={varName}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Chip size="small" label="Array" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} />
                              <Typography variant="body2">{varName}</Typography>
                            </Box>
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </AccordionDetails>
                </Accordion>
              )}

              {localConfig.type === 'html' && (
                <Accordion defaultExpanded sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HtmlIcon fontSize="small" />
                      HTML Template
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                      <Typography variant="caption">
                        Use <code style={{ background: 'rgba(102, 126, 234, 0.1)', padding: '2px 4px', borderRadius: 4 }}>{'{{'}variableName{'}}'}</code> or <code style={{ background: 'rgba(102, 126, 234, 0.1)', padding: '2px 4px', borderRadius: 4 }}>${'{'}variableName{'}'}</code> to insert data.
                      </Typography>
                    </Alert>
                    <Box sx={{ height: 300 }}>
                      <HtmlEditor
                        value={localConfig.htmlTemplate || ''}
                        onChange={(value) => updateField('htmlTemplate', value)}
                        height={280}
                        placeholder="Enter HTML template for tooltip..."
                        availableVariables={previewVariables}
                      />
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Data Mapping */}
              <Accordion sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LinkIcon fontSize="small" />
                    Data Mapping
                    {localConfig.dataMapping.length > 0 && (
                      <Chip size="small" label={localConfig.dataMapping.length} sx={{ ml: 1, height: 20, bgcolor: '#667eea', color: 'white' }} />
                    )}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
                    <Typography variant="caption">
                      Map data from the hovered point to custom variable names for use in your tooltip template.
                    </Typography>
                  </Alert>
                  
                  {/* Available Point Data */}
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'rgba(102, 126, 234, 0.05)', borderRadius: 2 }}>
                    <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ mb: 1, display: 'block' }}>
                      Available Point Data Keys:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {['x', 'y', 'name', 'category', 'series.name', 'color', 'percentage'].map(key => (
                        <Chip
                          key={key}
                          label={key}
                          size="small"
                          sx={{ fontSize: '0.7rem', bgcolor: 'white', border: '1px solid rgba(102, 126, 234, 0.3)' }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Mapping List */}
                  {localConfig.dataMapping.map((mapping, index) => (
                    <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        label="Source Key"
                        value={mapping.sourceKey}
                        onChange={(e) => updateDataMapping(index, 'sourceKey', e.target.value)}
                        placeholder="e.g., category"
                        sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'white' } }}
                      />
                      <Typography color="#64748b">→</Typography>
                      <TextField
                        size="small"
                        label="Variable Name"
                        value={mapping.targetVariable}
                        onChange={(e) => updateDataMapping(index, 'targetVariable', e.target.value)}
                        placeholder="e.g., tooltipCategory"
                        sx={{ flex: 1, '& .MuiInputBase-root': { bgcolor: 'white' } }}
                      />
                      <IconButton
                        size="small"
                        onClick={() => removeDataMapping(index)}
                        sx={{ color: '#ef4444' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  
                  <Button
                    startIcon={<AddIcon />}
                    onClick={addDataMapping}
                    size="small"
                    sx={{ mt: 1, textTransform: 'none' }}
                  >
                    Add Mapping
                  </Button>
                </AccordionDetails>
              </Accordion>

              {/* Appearance Settings */}
              <Accordion sx={{ mb: 2, borderRadius: '8px !important', border: '1px solid rgba(102, 126, 234, 0.2)', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <VisibilityIcon fontSize="small" />
                    Appearance & Behavior
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 0.5, display: 'block' }}>
                        Width: {localConfig.width}px
                      </Typography>
                      <Slider
                        value={localConfig.width}
                        onChange={(_, value) => updateField('width', value as number)}
                        min={200}
                        max={800}
                        step={50}
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 0.5, display: 'block' }}>
                        Height: {localConfig.height}px
                      </Typography>
                      <Slider
                        value={localConfig.height}
                        onChange={(_, value) => updateField('height', value as number)}
                        min={150}
                        max={600}
                        step={50}
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 0.5, display: 'block' }}>
                        X Offset: {localConfig.offsetX}px
                      </Typography>
                      <Slider
                        value={localConfig.offsetX}
                        onChange={(_, value) => updateField('offsetX', value as number)}
                        min={0}
                        max={50}
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 0.5, display: 'block' }}>
                        Y Offset: {localConfig.offsetY}px
                      </Typography>
                      <Slider
                        value={localConfig.offsetY}
                        onChange={(_, value) => updateField('offsetY', value as number)}
                        min={0}
                        max={50}
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 0.5, display: 'block' }}>
                        Hide Delay: {localConfig.hideDelay}ms
                      </Typography>
                      <Slider
                        value={localConfig.hideDelay}
                        onChange={(_, value) => updateField('hideDelay', value as number)}
                        min={0}
                        max={1000}
                        step={50}
                        sx={{ color: '#667eea' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={localConfig.showHeader}
                            onChange={(e) => updateField('showHeader', e.target.checked)}
                            size="small"
                            sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' } }}
                          />
                        }
                        label={<Typography variant="body2">Show Header</Typography>}
                      />
                    </Grid>
                    {localConfig.showHeader && (
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Header Title"
                          value={localConfig.headerTitle || ''}
                          onChange={(e) => updateField('headerTitle', e.target.value)}
                          placeholder="Details"
                          sx={{ '& .MuiInputBase-root': { bgcolor: 'white' } }}
                        />
                      </Grid>
                    )}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </>
          )}
        </Paper>
      </Box>

      {/* Preview Panel */}
      <Box sx={{ width: 450, flexShrink: 0 }}>
        <Paper
          elevation={0}
          sx={{
            height: '100%',
            borderRadius: 3,
            border: '1px solid rgba(102, 126, 234, 0.2)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Preview Header */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(102, 126, 234, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon sx={{ color: '#667eea' }} />
              <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#667eea' }}>
                Live Preview
              </Typography>
            </Box>
            <FormControlLabel
              control={
                <Switch
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                  size="small"
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' } }}
                />
              }
              label=""
            />
          </Box>

          {/* Sample Data Editor */}
          <Box sx={{ p: 2, borderBottom: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'rgba(102, 126, 234, 0.03)' }}>
            <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ mb: 1, display: 'block' }}>
              <DataObjectIcon sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
              Sample Point Data (for preview)
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <TextField
                size="small"
                label="category"
                value={previewData.category}
                onChange={(e) => setPreviewData(prev => ({ ...prev, category: e.target.value }))}
                sx={{ width: 120, '& .MuiInputBase-root': { bgcolor: 'white', fontSize: '0.8rem' } }}
              />
              <TextField
                size="small"
                label="y"
                type="number"
                value={previewData.y}
                onChange={(e) => setPreviewData(prev => ({ ...prev, y: Number(e.target.value) }))}
                sx={{ width: 80, '& .MuiInputBase-root': { bgcolor: 'white', fontSize: '0.8rem' } }}
              />
              <TextField
                size="small"
                label="name"
                value={previewData.name}
                onChange={(e) => setPreviewData(prev => ({ ...prev, name: e.target.value }))}
                sx={{ width: 120, '& .MuiInputBase-root': { bgcolor: 'white', fontSize: '0.8rem' } }}
              />
            </Box>
          </Box>

          {/* Preview Content */}
          <Box
            sx={{
              flex: 1,
              p: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#f8fafc',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                width: localConfig.width,
                height: localConfig.height,
                maxWidth: '100%',
                maxHeight: '100%',
                bgcolor: 'white',
                borderRadius: '12px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Tooltip Header Preview */}
              {localConfig.showHeader && localConfig.enabled && (
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
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea', fontSize: '0.875rem' }}>
                    {localConfig.headerTitle || 'Details'}
                  </Typography>
                  <IconButton size="small" sx={{ color: '#64748b', p: 0.5 }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              )}
              
              {/* Tooltip Content Preview */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                {renderPreview()}
              </Box>
            </Box>
          </Box>

          {/* Mapped Variables Preview */}
          {localConfig.enabled && localConfig.dataMapping.length > 0 && (
            <Box sx={{ p: 2, borderTop: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'rgba(102, 126, 234, 0.03)' }}>
              <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ mb: 1, display: 'block' }}>
                Mapped Variables:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(previewVariables)
                  .filter(([key]) => localConfig.dataMapping.some(m => m.targetVariable === key))
                  .map(([key, value]) => (
                    <Chip
                      key={key}
                      label={`${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`}
                      size="small"
                      sx={{ fontSize: '0.7rem', bgcolor: 'white', border: '1px solid rgba(102, 126, 234, 0.3)' }}
                    />
                  ))}
              </Box>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

