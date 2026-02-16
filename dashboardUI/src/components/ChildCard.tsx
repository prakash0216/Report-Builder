import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { useRecoilValue, useRecoilCallback } from 'recoil';
import { ChildCardConfig } from '../recoil/ChildCardState';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { childCardTooltipConfigState } from '../recoil/ChildCardTooltipState';
import { onClickConfigState } from '../recoil/OnClickConfigState';
import { onClickSnapshotState } from '../recoil/OnClickSnapshotState';
import ResizableChart from './ResizableChart';
import DashboardTable from './DashboardTable';
import ChildCardTooltip, { ChildCardTooltipRef } from './ChildCardTooltip';
// replaceVariableReferencesAsync kept for potential future DuckDB-WASM use
// import { replaceVariableReferencesAsync } from '../utils/variableResolver';

interface ChildCardProps {
  config: ChildCardConfig;
  parentCardId?: string;         // Parent card ID for tooltip key construction
  allVariables?: Record<string, any>; // Optional shared variable map from parent
  parentWidth?: number;
  parentHeight?: number;
  gap?: number;
  showExport?: boolean;
  isFullSizePreview?: boolean;   // 🔥 When true, render at 100% size without layout positioning
  onPointClick?: (pointData: any) => void;           // onClick action callback
  onChartBackgroundClick?: () => void;               // Click outside point → reset
}

// 🔥 FIXED: Match the replaceVariableReferences from DragDropDashboard.tsx exactly
const extractReferencedVariableNames = (template: string): Set<string> => {
  const names = new Set<string>();
  if (!template) return names;
  const pattern = /\$\{([^}]+)\}|\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(template)) !== null) {
    const name = match[1] || match[2];
    if (name) names.add(name);
  }
  return names;
};

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const replaceVariables = (template: string, variables: Record<string, any>): string => {
  if (!template) return template;
  
  let result = template;
  const referencedNames = extractReferencedVariableNames(template);
  
  referencedNames.forEach((name) => {
    if (!(name in variables)) return;
    const value = variables[name];
    // Check if the raw stored value is a formatted number (before parsing)
    const isFormattedNumber = typeof value === 'string' && /^[\d,]+$/.test(value);
    
    let replacement: string;
    
    if (isFormattedNumber) {
      // 🔥 Formatted numbers: use as-is without quotes
      replacement = value;
    } else {
      // 🔥 Everything else: stringify the value (handles arrays, objects, strings properly)
      replacement = JSON.stringify(value);
    }
    
    // Replace in JSON context: "${variableName}" (quoted placeholder)
    result = result.replace(new RegExp(`"\\$\\{${escapeRegex(name)}\\}"`, 'g'), replacement);
    
    // Replace in unquoted context: ${variableName}
    result = result.replace(new RegExp(`\\$\\{${escapeRegex(name)}\\}`, 'g'), replacement);
    
    // Replace {{variableName}} pattern for HTML
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(name)}\\}\\}`, 'g'),
      typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  
  // Replace any remaining unreplaced ${varName} with null to prevent JSON parse errors
  // This handles cases where variables haven't loaded yet
  result = result.replace(/\$\{[^}]+\}/g, 'null');
  result = result.replace(/\{\{[^}]+\}\}/g, '""');
  
  return result;
};

// 🔥 HTML variable replacement - for HTML templates (no JSON.stringify for strings)
const replaceHtmlVariables = (template: string, variables: Record<string, any>): string => {
  if (!template) return template;
  
  let result = template;
  const referencedNames = extractReferencedVariableNames(template);
  
  referencedNames.forEach((name) => {
    if (!(name in variables)) return;
    const value = variables[name];
    // For HTML, always convert to string representation
    let replacement: string;
    if (value === null || value === undefined) {
      replacement = '';
    } else if (typeof value === 'object') {
      replacement = JSON.stringify(value);
    } else {
      replacement = String(value);
    }
    
    // Replace ${variableName}
    result = result.replace(new RegExp(`\\$\\{${escapeRegex(name)}\\}`, 'g'), replacement);
    
    // Replace {{variableName}} pattern
    result = result.replace(new RegExp(`\\{\\{${escapeRegex(name)}\\}\\}`, 'g'), replacement);
  });
  
  // Replace any remaining unreplaced patterns
  result = result.replace(/\$\{[^}]+\}/g, '');
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  return result;
};

// 🔥 Safe parse function matching DragDropDashboard.tsx
const safeParse = (value: any): any => {
  if (typeof value !== 'string') return value;
  
  // Check if it looks like a formatted number (e.g., "1,234")
  if (/^[\d,]+$/.test(value)) {
    return value; // Keep formatted numbers as strings
  }
  
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Custom hook to get all variables as an object
function useAllVariables(enabled: boolean = true): Record<string, any> {
  const variableNames = useRecoilValue(variableNamesState);
  
  // 🔥 PERFORMANCE: Use synchronous getLoadable instead of async getPromise (matching DragDropDashboard)
  const getAllVariables = useRecoilCallback(({ snapshot }) => (): Record<string, any> => {
    const variables: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);
    
    for (const varName of varNameArray) {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(varName));
        if (loadable.state === 'hasValue') {
          const varValue = loadable.contents;
          if (varValue !== undefined && varValue !== null) {
            variables[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
          }
        }
      } catch (e) {
        // Variable not available yet
      }
    }
    
    return variables;
  }, [variableNames]);
  
  // 🔥 Subscribe to variable update trigger (same as DragDropDashboard)
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  
  // Get initial values
  const [variables, setVariables] = React.useState<Record<string, any>>({});
  
  // 🔥 Update variables when trigger changes (matching DragDropDashboard behavior)
  React.useEffect(() => {
    if (!enabled) return;
    const vars = getAllVariables();
    setVariables(vars);
  }, [enabled, getAllVariables, variableNames, variableUpdateTrigger]);
  
  return variables;
}

const ChildCard: React.FC<ChildCardProps> = ({
  config,
  parentCardId,
  allVariables,
  parentWidth = 400,
  parentHeight = 300,
  gap = 8,
  showExport = false,
  isFullSizePreview = false, // 🔥 NEW: Full-size preview mode
  onPointClick,
  onChartBackgroundClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<ChildCardTooltipRef>(null);
  const highlightChartRef = useRef<any>(null); // Stores the Highcharts chart instance for highlight reset
  const [highlightedRowIndex, setHighlightedRowIndex] = useState<number | null>(null);
  
  // Get all variables for template replacement
  const localVariables = useAllVariables(!allVariables);
  const variables = allVariables ?? localVariables;
  
  // 🔥 Tooltip configuration
  const childCardKey = parentCardId ? `${parentCardId}_${config.id}` : '';
  const tooltipConfigs = useRecoilValue(childCardTooltipConfigState);
  const tooltipConfig = childCardKey ? tooltipConfigs[childCardKey] : undefined;
  const isTooltipEnabled = tooltipConfig?.enabled ?? false;

  // 🔥 onClick highlight configuration
  const onClickConfigs = useRecoilValue(onClickConfigState);
  const clickSnapshot = useRecoilValue(onClickSnapshotState);
  const onClickConfig = childCardKey ? onClickConfigs[childCardKey] : undefined;
  // highlightEnabled: config says highlight is on (used for allowPointSelect + dimming states)
  const highlightEnabled = !!(onClickConfig?.enabled && onClickConfig?.highlightClicked);
  // shouldHighlight kept for backward compat — true when an active drill-down is from this chart
  const shouldHighlight = highlightEnabled && clickSnapshot.active && clickSnapshot.sourceChartId === childCardKey;

  // 🔥 Clear visual highlight (chart or table) when:
  //   1. Snapshot resets (Reset button clicked → active becomes false)
  //   2. A different card/chart is clicked (sourceChartId changes away from this card)
  const isThisChildHighlighted = clickSnapshot.active && clickSnapshot.sourceChartId === childCardKey;
  useEffect(() => {
    if (!highlightEnabled) return;
    if (isThisChildHighlighted) return; // This child is currently highlighted — don't clear

    // Clear chart highlight (for chart-type child cards)
    const chart = highlightChartRef.current;
    if (chart) {
      try {
        chart.series.forEach((s: any) => {
          // Reset series-level opacity (for line/spline/area charts)
          if (s.group) s.group.attr({ opacity: 1 });
          if (s.markerGroup) s.markerGroup.attr({ opacity: 1 });
          // Reset point-level opacity and selection (for bar/column/pie charts)
          s.points?.forEach((p: any) => {
            if (p.selected) p.select(false, false);
            if (p.graphic) p.graphic.css({ opacity: 1 });
          });
        });
        console.log(`🔄 [Highlight Reset] Cleared chart highlight for ${childCardKey}`);
      } catch (err) {
        // Silently ignore — chart may have been destroyed
      }
      highlightChartRef.current = null; // Clear the ref after reset
    }

    // Clear table row highlight (for table-type child cards)
    if (highlightedRowIndex !== null) {
      setHighlightedRowIndex(null);
      console.log(`🔄 [Highlight Reset] Cleared table row highlight for ${childCardKey}`);
    }
  }, [isThisChildHighlighted, highlightEnabled, childCardKey, highlightedRowIndex]);

  // Calculate dimensions based on layout (only used when not in full-size preview mode)
  const dimensions = useMemo(() => {
    // 🔥 In full-size preview mode, don't calculate layout dimensions
    if (isFullSizePreview) {
      return { width: 0, height: 0, left: 0, top: 0 };
    }
    
    const { layout } = config;
    const availableWidth = parentWidth - (gap * 2); // Account for container padding
    const availableHeight = parentHeight - (gap * 2);
    
    return {
      width: availableWidth * layout.w - (gap / 2),
      height: availableHeight * layout.h - (gap / 2),
      left: (availableWidth * layout.x) + gap,
      top: (availableHeight * layout.y) + gap,
    };
  }, [config.layout, parentWidth, parentHeight, gap, isFullSizePreview]);

  // State for chart options - NO FALLBACK to previous state to prevent crashes
  const [chartOptions, setChartOptions] = useState<any>(null);
  const [chartError, setChartError] = useState<string | null>(null);

  // Parse chart template and create options - with robust error handling
  useEffect(() => {
    if (config.type !== 'chart') {
      setChartOptions(null);
      setChartError(null);
      return;
    }

    if (!config.template) {
      setChartOptions(null);
      setChartError(null);
      return;
    }

    // Skip if template is too short (user is likely editing)
    const trimmedTemplate = config.template.trim();
    if (trimmedTemplate.length < 10) {
      setChartOptions(null);
      setChartError('Configuration too short');
      return;
    }

    try {
      const replacedTemplate = replaceVariables(config.template, variables);
      const parsed = JSON.parse(replacedTemplate);
      
      // Validate that chart type is valid to prevent Highcharts error #17
      const chartType = parsed?.chart?.type;
      if (chartType !== undefined && chartType !== null && chartType.toString().trim() === '') {
        setChartOptions(null);
        setChartError('Empty chart type');
        return;
      }
      
      // Check if chart type is a valid Highcharts type
      const validChartTypes = ['line', 'spline', 'area', 'areaspline', 'column', 'bar', 'pie', 'scatter', 'gauge', 'arearange', 'areasplinerange', 'columnrange', 'bubble', 'boxplot', 'errorbar', 'waterfall', 'funnel', 'pyramid', 'heatmap', 'treemap', 'sankey', 'sunburst', 'organization', 'networkgraph', 'packedbubble', 'lollipop', 'dumbbell', 'timeline', 'venn', 'wordcloud', 'polygon', 'streamgraph', 'variablepie', 'dependencywheel', 'vector', 'windbarb', 'xrange', 'item', 'solidgauge'];
      if (chartType && !validChartTypes.includes(chartType)) {
        setChartOptions(null);
        setChartError(`Unknown chart type: ${chartType}`);
        return;
      }
      
      // Ensure series exists and has valid data
      if (!parsed?.series || !Array.isArray(parsed.series)) {
        setChartOptions(null);
        setChartError('No series data defined');
        return;
      }

      // 🔥 CRITICAL: Validate series data to prevent Highcharts crash
      for (let i = 0; i < parsed.series.length; i++) {
        const series = parsed.series[i];
        if (series.data === null || series.data === undefined) {
          setChartOptions(null);
          setChartError(`Series ${i + 1} has no data (waiting for variable)`);
          return;
        }
        if (!Array.isArray(series.data)) {
          setChartOptions(null);
          setChartError(`Series ${i + 1} data must be an array`);
          return;
        }
      }

      // 🔥 CRITICAL: Validate xAxis categories if present
      if (parsed.xAxis?.categories !== undefined) {
        if (parsed.xAxis.categories === null || !Array.isArray(parsed.xAxis.categories)) {
          setChartOptions(null);
          setChartError('xAxis categories must be an array (waiting for variable)');
          return;
        }
      }
      
      // 🔥 Check if container scroll is enabled (passed from ParentCardContainer)
      const containerScrollEnabled = (config as any).__containerScroll || false;
      
      // For container scroll mode, remove any chart-level scroll constraints
      if (containerScrollEnabled && parsed.xAxis) {
        delete parsed.xAxis.min;
        delete parsed.xAxis.max;
        delete parsed.xAxis.scrollbar;
      }
      
      // All validations passed - set the chart options
      setChartOptions(parsed);
      setChartError(null);
    } catch (error: any) {
      setChartOptions(null);
      setChartError(error.message || 'Invalid JSON');
    }
  }, [config.type, config.template, variables]);

  // 🔥 Tooltip handlers
  const handleShowTooltip = useCallback((event: MouseEvent | { clientX: number; clientY: number }, point: any) => {
    if (!isTooltipEnabled || !tooltipRef.current) return;

    // 🔥 FIX: Get category from multiple possible sources
    // In bar charts with xAxis categories, the category might be in different places
    const category = point?.category 
      || point?.name 
      || point?.options?.name
      || (point?.series?.xAxis?.categories ? point.series.xAxis.categories[point.index] : undefined);
    
    const pointData = {
      x: point?.x,
      y: point?.y,
      name: point?.name,
      category: category,  // 🔥 Use our resolved category
      color: point?.color,
      percentage: point?.percentage,
      total: point?.total,
      index: point?.index,
      series: {
        name: point?.series?.name,
        index: point?.series?.index,
        type: point?.series?.type,
      },
      options: point?.options,
    };
    
    tooltipRef.current.show(
      { x: event.clientX, y: event.clientY },
      pointData
    );
  }, [isTooltipEnabled]);

  const handleHideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.hide();
    }
  }, []);

  // 🔥 Table row click handler — constructs a pointData-like object for useOnClickActions
  const handleTableRowClick = useCallback((rowData: Record<string, any>, rowIndex: number, columns: string[]) => {
    const childConfigKey = parentCardId ? `${parentCardId}_${config.id}` : config.id;
    const isHighlightOn = onClickConfigs[childConfigKey]?.highlightClicked && onClickConfigs[childConfigKey]?.enabled;

    // Set highlight
    if (isHighlightOn) {
      setHighlightedRowIndex(rowIndex);
    }

    if (onPointClick) {
      // Build a pointData-like object carrying all row information
      const pointData = {
        // Standard point-like fields (mapped to row data for convenience)
        x: rowIndex,
        y: null,
        name: null,
        category: null,
        color: null,
        percentage: null,
        total: null,
        index: rowIndex,
        series: {
          name: config.tableDataSource || '',
          index: 0,
          type: 'table',
        },
        options: rowData,
        // Table-specific fields
        _rowData: rowData,        // Full row object: { columnName: value, ... }
        _rowIndex: rowIndex,      // Index of the clicked row
        _columns: columns,        // Array of visible column names
        // Internal metadata for config lookup
        _configKey: childConfigKey,
        _chartOptions: null,      // Not applicable for tables
        _isTableClick: true,      // Flag to differentiate from chart clicks
      };
      onPointClick(pointData);
    }
  }, [onPointClick, parentCardId, config.id, config.tableDataSource, onClickConfigs]);

  // 🔥 Enhanced chart options with tooltip events, onClick actions, and highlight
  const enhancedChartOptions = useMemo(() => {
    if (!chartOptions) return chartOptions;
    
    const needsEnhancement = isTooltipEnabled || onPointClick || shouldHighlight;
    if (!needsEnhancement) return chartOptions;
    
    // Build point events object
    const pointEvents: Record<string, any> = {
      ...chartOptions.plotOptions?.series?.point?.events,
    };

    // Tooltip hover handlers
    if (isTooltipEnabled) {
      pointEvents.mouseOver = function(this: any, e: any) {
        let clientX = 0;
        let clientY = 0;
        
        if (e.browserEvent) {
          clientX = e.browserEvent.clientX;
          clientY = e.browserEvent.clientY;
        } else if ((window as any).event) {
          clientX = (window as any).event.clientX;
          clientY = (window as any).event.clientY;
        } else if (e.chartX !== undefined && e.chartY !== undefined) {
          const chart = this.series?.chart;
          if (chart && chart.container) {
            const rect = chart.container.getBoundingClientRect();
            clientX = rect.left + e.chartX;
            clientY = rect.top + e.chartY;
          }
        }
        
        handleShowTooltip({ clientX, clientY }, this);
      };
      pointEvents.mouseOut = function(this: any) {
        handleHideTooltip();
      };
    }

    // onClick action handler — includes child card config key for proper config lookup
    {
      const childConfigKey = parentCardId ? `${parentCardId}_${config.id}` : config.id;
      const isHighlightOn = onClickConfigs[childConfigKey]?.highlightClicked && onClickConfigs[childConfigKey]?.enabled;

      if (onPointClick || isHighlightOn) {
        pointEvents.click = function(this: any) {
          // Highlight: select the clicked point and dim others within this chart only
          if (isHighlightOn) {
            const chart = this.series?.chart;
            if (chart) {
              // Store chart ref for reset via useEffect
              highlightChartRef.current = chart;
              const clickedSeriesIndex = this.series?.index;
              // For line/spline/area charts: highlight the clicked series, dim others
              // For bar/column/pie charts: highlight the clicked point, dim others
              const isLineLike = ['line', 'spline', 'area', 'areaspline'].includes(this.series?.type);

              if (isLineLike) {
                // Dim all series except the one containing the clicked point
                chart.series.forEach((s: any) => {
                  const isClickedSeries = s.index === clickedSeriesIndex;
                  // Set series-level opacity via the SVG group
                  if (s.group) {
                    s.group.attr({ opacity: isClickedSeries ? 1 : 0.15 });
                  }
                  if (s.markerGroup) {
                    s.markerGroup.attr({ opacity: isClickedSeries ? 1 : 0.15 });
                  }
                });
                // Select the clicked point for visual marker
                chart.series.forEach((s: any) => {
                  s.points?.forEach((p: any) => {
                    if (p.selected) p.select(false, false);
                  });
                });
                this.select(true, false);
              } else {
                // Bar/column/pie: dim individual points
                chart.series.forEach((s: any) => {
                  s.points?.forEach((p: any) => {
                    if (p.selected) p.select(false, false);
                  });
                });
                this.select(true, false);
                chart.series.forEach((s: any) => {
                  s.points?.forEach((p: any) => {
                    if (p.graphic) {
                      p.graphic.css({ opacity: p.selected ? 1 : 0.2 });
                    }
                  });
                });
              }
            }
          }

          if (onPointClick) {
            const pointData = {
              x: this.x,
              y: this.y,
              name: this.name,
              category: this.category,
              color: this.color,
              percentage: this.percentage,
              total: this.total,
              index: this.index,
              series: {
                name: this.series?.name,
                index: this.series?.index,
                type: this.series?.type,
              },
              options: this.options,
              _configKey: childConfigKey, // internal: used by useOnClickActions to look up the right config
              _chartOptions: chartOptions, // internal: full chart config for extractionType='config'
            };
            onPointClick(pointData);
          }
        };
      }
    }
    
    // Build highlight-related options — enabled based on config, not snapshot state
    // This ensures allowPointSelect and dimming are always active when the feature is on
    const highlightOptions = highlightEnabled ? {
      allowPointSelect: true,
      cursor: 'pointer',
      marker: {
        ...chartOptions.plotOptions?.series?.marker,
        states: {
          ...chartOptions.plotOptions?.series?.marker?.states,
          select: {
            enabled: true,
            radius: 6,
            lineWidth: 2,
            lineColor: '#333',
            fillColor: undefined, // Keep original color
          },
        },
      },
      states: {
        ...chartOptions.plotOptions?.series?.states,
        select: {
          enabled: true,
          color: undefined, // Keep original color
          borderColor: '#333',
          borderWidth: 2,
        },
        inactive: {
          opacity: 0.15,
        },
      },
    } : {};

    return {
      ...chartOptions,
      ...(isTooltipEnabled ? { tooltip: { enabled: false } } : {}),
      chart: {
        ...chartOptions.chart,
        events: {
          ...chartOptions.chart?.events,
          ...(onChartBackgroundClick || highlightEnabled ? {
            click: function(this: any, e: any) {
              if (!(e as any).point) {
                // Reset highlight: restore all series/point opacities when clicking background
                if (highlightEnabled) {
                  this.series.forEach((s: any) => {
                    // Reset series-level opacity (for line/spline/area charts)
                    if (s.group) {
                      s.group.attr({ opacity: 1 });
                    }
                    if (s.markerGroup) {
                      s.markerGroup.attr({ opacity: 1 });
                    }
                    // Reset point-level opacity (for bar/column/pie charts)
                    s.points?.forEach((p: any) => {
                      if (p.selected) p.select(false, false);
                      if (p.graphic) {
                        p.graphic.css({ opacity: 1 });
                      }
                    });
                  });
                }
                if (onChartBackgroundClick) {
                  onChartBackgroundClick();
                }
              }
            },
          } : {}),
        },
      },
      plotOptions: {
        ...chartOptions.plotOptions,
        series: {
          ...chartOptions.plotOptions?.series,
          ...highlightOptions,
          point: {
            ...chartOptions.plotOptions?.series?.point,
            events: pointEvents,
          },
        },
      },
    };
  }, [chartOptions, isTooltipEnabled, handleShowTooltip, handleHideTooltip, onPointClick, onChartBackgroundClick, highlightEnabled, shouldHighlight, onClickConfigs, parentCardId, config.id]);

  // Render HTML content
  const htmlContent = useMemo(() => {
    if (config.type !== 'html' || !config.htmlContent) return null;
    return replaceVariables(config.htmlContent, variables);
  }, [config.type, config.htmlContent, variables]);

  // Render content based on type
  const renderContent = () => {
    switch (config.type) {
      case 'chart':
        // 🔥 Show error message if there's an error
        if (chartError) {
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#f59e0b',
                gap: 1,
                p: 2,
                textAlign: 'center',
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'rgba(245, 158, 11, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                }}
              >
                <Typography sx={{ fontSize: 24 }}>⚠️</Typography>
              </Box>
              <Typography variant="body2" fontWeight={500}>
                Chart Configuration Issue
              </Typography>
              <Typography variant="caption" color="#9ca3af" sx={{ maxWidth: 200 }}>
                {chartError}
              </Typography>
            </Box>
          );
        }
        
        // Show placeholder if no config
        if (!chartOptions) {
          return (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
                gap: 1,
              }}
            >
              <Typography variant="body2">No chart configuration</Typography>
            </Box>
          );
        }
        
        // 🔥 Render the chart with optional tooltip and/or onClick actions
        const useEnhanced = isTooltipEnabled || onPointClick || highlightEnabled;
        return (
          <>
            <ResizableChart
              options={useEnhanced ? enhancedChartOptions : chartOptions}
              showExport={showExport}
            />
            {isTooltipEnabled && childCardKey && (
              <ChildCardTooltip
                ref={tooltipRef}
                childCardKey={childCardKey}
                chartConfig={chartOptions}
              />
            )}
          </>
        );

      case 'table': {
        if (!config.tableDataSource) {
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
              }}
            >
              <Typography variant="body2">No data source configured</Typography>
            </Box>
          );
        }
        const tableConfigKey = parentCardId ? `${parentCardId}_${config.id}` : '';
        const tableOnClickConfig = tableConfigKey ? onClickConfigs[tableConfigKey] : undefined;
        const tableClickEnabled = !!(tableOnClickConfig?.enabled);
        const tableHighlightEnabled = !!(tableOnClickConfig?.enabled && tableOnClickConfig?.highlightClicked);
        const isThisTableHighlighted = clickSnapshot.active && clickSnapshot.sourceChartId === tableConfigKey;
        return (
          <DashboardTable
            dataSource={config.tableDataSource}
            settings={config.tableSettings}
            onRowClick={tableClickEnabled ? handleTableRowClick : undefined}
            highlightEnabled={tableHighlightEnabled && isThisTableHighlighted}
            highlightedRowIndex={tableHighlightEnabled && isThisTableHighlighted ? highlightedRowIndex : null}
          />
        );
      }

      case 'html':
        if (!htmlContent) {
          return (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#9ca3af',
              }}
            >
              <Typography variant="body2">No HTML content</Typography>
            </Box>
          );
        }
        return (
          <Box
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            sx={{
              width: '100%',
              height: '100%',
              overflow: 'auto',
              p: 1,
            }}
          />
        );

      default:
        return null;
    }
  };

  // 🔥 Dynamic Title Height - increases for HTML mode
  const titleHeight = config.showTitle ? (config.titleMode === 'html' ? 'auto' : 32) : 0;

  // 🔥 Render dynamic title - supports both simple text and HTML templates
  const renderTitle = (fontSize: string = '0.85rem') => {
    if (!config.showTitle) return null;
    
    // HTML Mode - render HTML template with variables
    if (config.titleMode === 'html' && config.titleTemplate) {
      const processedHtml = replaceHtmlVariables(config.titleTemplate, variables);
      return (
        <Box
          sx={{
            minHeight: 32,
            maxHeight: 80,
            px: 1.5,
            py: 0.75,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
            backgroundColor: 'rgba(102, 126, 234, 0.03)',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: processedHtml }}
            style={{
              width: '100%',
              fontSize,
              lineHeight: 1.3,
            }}
          />
        </Box>
      );
    }
    
    // Simple Mode - render plain text with variable replacement
    const titleText = config.title || '';
    const processedTitle = replaceHtmlVariables(titleText, variables);
    
    if (!processedTitle) return null;
    
    return (
      <Box
        sx={{
          height: 32,
          px: 1.5,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
          backgroundColor: 'rgba(102, 126, 234, 0.03)',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontSize,
            fontWeight: 600,
            color: '#4b5563',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {processedTitle}
        </Typography>
      </Box>
    );
  };

  // 🔥 FULL-SIZE PREVIEW MODE: Render at 100% size without layout positioning
  if (isFullSizePreview) {
    return (
      <Box
        ref={containerRef}
        data-child-id={config.id}
        sx={{
          width: '100%',
          height: '100%',
          backgroundColor: 'white',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* 🔥 Dynamic title bar - supports HTML templates */}
        {renderTitle('0.85rem')}
        
        {/* Content area - FULL SIZE */}
        <Box
          sx={{
            flex: 1,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {renderContent()}
        </Box>
      </Box>
    );
  }

  // 🔥 NORMAL MODE: Render at positioned size based on layout
  return (
    <Box
      ref={containerRef}
      data-child-id={config.id}
      sx={{
        position: 'absolute',
        left: dimensions.left,
        top: dimensions.top,
        width: dimensions.width,
        height: dimensions.height,
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        // No shadow between child cards as requested
        border: '1px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      {/* 🔥 Dynamic title bar - supports HTML templates */}
      {renderTitle('0.75rem')}
      
      {/* Content area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
          height: `calc(100% - ${titleHeight}px)`,
        }}
      >
        {renderContent()}
      </Box>
    </Box>
  );
};

export default ChildCard;
