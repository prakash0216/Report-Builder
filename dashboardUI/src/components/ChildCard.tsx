import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { useRecoilValue, useRecoilCallback } from 'recoil';
import { ChildCardConfig } from '../recoil/ChildCardState';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import ResizableChart from './ResizableChart';
import DashboardTable from './DashboardTable';

interface ChildCardProps {
  config: ChildCardConfig;
  parentWidth?: number;
  parentHeight?: number;
  gap?: number;
  showExport?: boolean;
  isFullSizePreview?: boolean; // 🔥 When true, render at 100% size without layout positioning
}

// 🔥 FIXED: Match the replaceVariableReferences from DragDropDashboard.tsx exactly
const replaceVariables = (template: string, variables: Record<string, any>): string => {
  if (!template) return template;
  
  let result = template;
  
  Object.entries(variables).forEach(([name, value]) => {
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
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    
    // Replace in unquoted context: ${variableName}
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
    
    // Replace {{variableName}} pattern for HTML
    result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), 
      typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  
  // Replace any remaining unreplaced ${varName} with null to prevent JSON parse errors
  // This handles cases where variables haven't loaded yet
  result = result.replace(/\$\{[^}]+\}/g, 'null');
  result = result.replace(/\{\{[^}]+\}\}/g, '""');
  
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
function useAllVariables(): Record<string, any> {
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
    const vars = getAllVariables();
    console.log(`📦 [ChildCard] Got ${Object.keys(vars).length} variables`);
    setVariables(vars);
  }, [getAllVariables, variableNames, variableUpdateTrigger]);
  
  // Also update periodically to catch changes
  React.useEffect(() => {
    const interval = setInterval(() => {
      const vars = getAllVariables();
      setVariables(prev => {
        const newStr = JSON.stringify(vars);
        const prevStr = JSON.stringify(prev);
        if (newStr !== prevStr) {
          return vars;
        }
        return prev;
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, [getAllVariables]);
  
  return variables;
}

const ChildCard: React.FC<ChildCardProps> = ({
  config,
  parentWidth = 400,
  parentHeight = 300,
  gap = 8,
  showExport = false,
  isFullSizePreview = false, // 🔥 NEW: Full-size preview mode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Get all variables for template replacement
  const variables = useAllVariables();
  
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
        
        // 🔥 Render the chart only when we have valid options
        return (
          <ResizableChart
            options={chartOptions}
            showExport={showExport}
          />
        );

      case 'table':
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
        return (
          <DashboardTable
            dataSource={config.tableDataSource}
            settings={config.tableSettings}
          />
        );

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

  const titleHeight = config.showTitle ? 32 : 0;

  // 🔥 FULL-SIZE PREVIEW MODE: Render at 100% size without layout positioning
  if (isFullSizePreview) {
    return (
      <Box
        ref={containerRef}
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
        {/* Optional title bar */}
        {config.showTitle && config.title && (
          <Box
            sx={{
              height: titleHeight,
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
                fontSize: '0.85rem',
                fontWeight: 600,
                color: '#4b5563',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {config.title}
            </Typography>
          </Box>
        )}
        
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
      {/* Optional title bar */}
      {config.showTitle && config.title && (
        <Box
          sx={{
            height: titleHeight,
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
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#4b5563',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {config.title}
          </Typography>
        </Box>
      )}
      
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
