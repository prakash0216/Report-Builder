import React, { forwardRef, useImperativeHandle, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue, useRecoilCallback, useSetRecoilState } from 'recoil';
import { 
  childCardTooltipConfigState, 
  ChildCardTooltipConfig,
  TooltipCardConfig,
  activeChildCardTooltipState 
} from '../recoil/ChildCardTooltipState';
import { storedLogicsState } from '../recoil/StoredLogic';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableNamesState } from '../recoil/Variabletracker';
import { filterNamesState, filterConfigFamily } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import DashboardTable from './DashboardTable';
import ResizableChart from './ResizableChart';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface ChildCardTooltipProps {
  childCardKey: string;  // Format: "{parentCardId}_{childCardId}"
  chartConfig?: any;     // Current chart configuration for 'config' type extractions
  onClose?: () => void;
}

export interface ChildCardTooltipRef {
  show: (position: { x: number; y: number }, pointData?: any) => void;
  hide: () => void;
  isVisible: boolean;
}

// Helper to extract nested values from an object
const getNestedValue = (obj: any, path: string): any => {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((current, key) => {
    if (current === undefined || current === null) return undefined;
    // Handle array notation like "series[0]"
    const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, arrayKey, indexStr] = arrayMatch;
      const arr = current[arrayKey];
      return Array.isArray(arr) ? arr[parseInt(indexStr)] : undefined;
    }
    return current[key];
  }, obj);
};

// Helper function to replace variable references in template strings
const replaceVariableReferences = (template: string, variables: Record<string, any>, isHtml: boolean = false): string => {
  let result = template;
  
  Object.entries(variables).forEach(([name, value]) => {
    if (isHtml) {
      // 🔥 HTML: ${varName} replaces with raw value (no quotes)
      result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), () => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value; // No quotes for HTML
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return JSON.stringify(value);
      });
    } else {
      // 🔥 JSON: ${varName} with smart quoting
      
      // Pattern 1: "${varName}" (with surrounding quotes) - replace entirely
      result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), () => {
        if (value === null || value === undefined) return '""';
        if (typeof value === 'string') return JSON.stringify(value);
        return JSON.stringify(value);
      });
      
      // Pattern 2: ${varName} (without quotes) - auto-add quotes for strings
      result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), () => {
        if (value === null || value === undefined) return 'null';
        if (typeof value === 'string') return JSON.stringify(value); // Auto-adds quotes
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        return JSON.stringify(value);
      });
    }
  });
  
  // Replace any remaining unreplaced variables with safe defaults
  if (isHtml) {
    result = result.replace(/\$\{[^}]+\}/g, ''); // Remove unreplaced vars
  } else {
    result = result.replace(/"\\$\\{[^}]+\\}"/g, '""'); // "${var}" -> ""
    result = result.replace(/\$\{[^}]+\}/g, '[]');      // ${var} -> []
  }
  
  return result;
};

// Safe JSON parse
const safeParse = (value: any): any => {
  if (typeof value !== 'string') return value;
  if (/^[\d,]+$/.test(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const ChildCardTooltip = forwardRef<ChildCardTooltipRef, ChildCardTooltipProps>(
  ({ childCardKey, chartConfig, onClose }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [pointData, setPointData] = useState<any>(null);
    const [calculationResults, setCalculationResults] = useState<Record<string, any>>({});
    const [isCalculating, setIsCalculating] = useState(false);
    const isHoveringRef = React.useRef(false);
    const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    
    // Get tooltip configuration for this child card
    const tooltipConfigs = useRecoilValue(childCardTooltipConfigState);
    const tooltipConfig = tooltipConfigs[childCardKey];
    
    // Get stored logics for calculations
    const storedLogics = useRecoilValue(storedLogicsState);
    
    // Set active tooltip state
    const setActiveTooltip = useSetRecoilState(activeChildCardTooltipState);

    // Get all current variables (for calculations context)
    const variableNames = useRecoilValue(variableNamesState);
    const filterNames = useRecoilValue(filterNamesState);
    const parameterNames = useRecoilValue(parameterNamesState);

    // Clear any pending hide timeout
    const clearHideTimeout = useCallback(() => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    }, []);

    // Force hide the tooltip immediately
    const forceHide = useCallback(() => {
      clearHideTimeout();
      setIsVisible(false);
      setPointData(null);
      setCalculationResults({});
      setActiveTooltip({
        childCardKey: null,
        isVisible: false,
        position: { x: 0, y: 0 },
        extractedData: {},
        calculationResults: {},
      });
      onClose?.();
    }, [clearHideTimeout, setActiveTooltip, onClose]);

    // Execute calculations with extracted data
    const executeCalculations = useRecoilCallback(
      ({ snapshot }) => async (
        extractedData: Record<string, any>,
        config: ChildCardTooltipConfig
      ): Promise<Record<string, any>> => {
        const results: Record<string, any> = {};
        
        if (!config.calculationBindings || config.calculationBindings.length === 0) {
          return results;
        }

        // Get current context for calculations
        const allVariables: Record<string, any> = {};
        const allFilters: Record<string, any> = {};
        const allParameters: Record<string, any> = {};

        // Load variables
        for (const varName of Array.from(variableNames)) {
          try {
            const loadable = snapshot.getLoadable(variableAtomFamily(varName));
            if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
              allVariables[varName] = safeParse(loadable.contents);
            }
          } catch { /* ignore */ }
        }

        // Load filters
        for (const filterName of Array.from(filterNames)) {
          try {
            const configLoadable = snapshot.getLoadable(filterConfigFamily(filterName));
            const liveLoadable = snapshot.getLoadable(liveFilterFamily(filterName));
            if (configLoadable.state === 'hasValue' && liveLoadable.state === 'hasValue') {
              const config = configLoadable.contents;
              const liveValue = liveLoadable.contents;
              allFilters[filterName] = liveValue ?? config?.defaultValues;
            }
          } catch { /* ignore */ }
        }

        // Load parameters
        for (const paramName of Array.from(parameterNames) as string[]) {
          try {
            const loadable = snapshot.getLoadable(parameterAtomFamily(paramName));
            if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
              allParameters[paramName] = safeParse(loadable.contents);
            }
          } catch { /* ignore */ }
        }

        // Create context with extracted data
        const context = {
          ...allVariables,
          ...allFilters,
          ...allParameters,
          ...extractedData, // Add extracted data with highest priority
        };

        // Execute each calculation binding (inline logic that runs at hover time)
        for (const binding of config.calculationBindings) {
          if (!binding.inlineLogic) continue;

          try {
            // Create variable declarations like the backend does
            // This includes: extracted data + all existing variables + filters + parameters
            // 🔥 FIX: Only include entries with valid JavaScript variable names
            const isValidVarName = (name: string) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
            
            const variableDeclarations = Object.entries(context)
              .filter(([name]) => isValidVarName(name)) // 🔥 Filter out invalid names
              .map(([name, value]) => {
                let serialized;
                if (value === undefined) {
                  serialized = 'undefined';
                } else if (value === null) {
                  serialized = 'null';
                } else {
                  try {
                    serialized = JSON.stringify(value);
                  } catch {
                    serialized = 'null'; // Fallback for circular references
                  }
                }
                return `const ${name} = ${serialized};`;
              })
              .join('\n');

            // Execute the inline calculation with variables in scope
            const funcString = `(function() {
              ${variableDeclarations}
              ${binding.inlineLogic}
            })()`;
            
            // eslint-disable-next-line no-eval
            const result = eval(funcString);
            
            if (result !== undefined && result !== null) {
              results[binding.outputVariable] = result;
            }
          } catch (error) {
            console.error(`Error executing tooltip calculation for ${binding.outputVariable}:`, error);
          }
        }

        return results;
      },
      [storedLogics, variableNames, filterNames, parameterNames]
    );

    // Extract data based on configuration
    const extractData = useCallback((
      config: ChildCardTooltipConfig,
      hoverPointData: any,
      chartConfiguration: any
    ): Record<string, any> => {
      const extracted: Record<string, any> = {};

      for (const extraction of config.dataExtractions) {
        let value: any;

        if (extraction.extractionType === 'hover') {
          // Extract from hover point data
          value = getNestedValue(hoverPointData, extraction.sourceKey);
        } else if (extraction.extractionType === 'config') {
          // Extract from chart config
          value = getNestedValue(chartConfiguration, extraction.sourceKey);
        }

        if (value !== undefined) {
          extracted[extraction.targetVariable] = value;
        }
      }

      // Also add all hover point data with "point_" prefix (using underscore, not dot)
      // This makes them valid JavaScript variable names
      if (hoverPointData) {
        Object.entries(hoverPointData).forEach(([key, value]) => {
          if (typeof value !== 'object' && typeof value !== 'function') {
            extracted[`point_${key}`] = value;
          }
        });
        // Add series info with "series_" prefix
        if (hoverPointData.series && typeof hoverPointData.series === 'object') {
          Object.entries(hoverPointData.series).forEach(([key, value]) => {
            if (typeof value !== 'object' && typeof value !== 'function') {
              extracted[`series_${key}`] = value;
            }
          });
        }
      }

      return extracted;
    }, []);

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      show: async (pos: { x: number; y: number }, hoverPointData?: any) => {
        if (!tooltipConfig?.enabled) return;
        
        clearHideTimeout();
        
        // Calculate adjusted position
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const width = tooltipConfig?.width || 400;
        const height = tooltipConfig?.height || 300;
        const offsetX = tooltipConfig?.offsetX || 15;
        const offsetY = tooltipConfig?.offsetY || 15;
        
        let adjustedX = pos.x + offsetX;
        let adjustedY = pos.y + offsetY;
        
        if (adjustedX + width > viewportWidth) {
          adjustedX = pos.x - width - offsetX;
        }
        if (adjustedY + height > viewportHeight) {
          adjustedY = pos.y - height - offsetY;
        }
        
        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);
        
        setTooltipPosition({ x: adjustedX, y: adjustedY });
        setPointData(hoverPointData);
        
        // Extract data and run calculations
        setIsCalculating(true);
        
        try {
          const extractedData = extractData(tooltipConfig, hoverPointData, chartConfig);
          
          // 🔥 DEBUG: Log extraction results
          console.log('🎯 [Tooltip] hoverPointData:', hoverPointData);
          console.log('🎯 [Tooltip] extractedData:', extractedData);
          console.log('🎯 [Tooltip] dataExtractions config:', tooltipConfig.dataExtractions);
          
          // Execute calculations if configured
          const calcResults = await executeCalculations(extractedData, tooltipConfig);
          
          // 🔥 DEBUG: Log calculation results
          console.log('📊 [Tooltip] calcResults:', calcResults);
          
          setCalculationResults(calcResults);
          setActiveTooltip({
            childCardKey,
            isVisible: true,
            position: { x: adjustedX, y: adjustedY },
            extractedData,
            calculationResults: calcResults,
          });
        } catch (error) {
          console.error('Error processing tooltip:', error);
        } finally {
          setIsCalculating(false);
        }
        
        setIsVisible(true);
      },
      hide: () => {
        const delay = tooltipConfig?.hideDelay || 200;
        clearHideTimeout();
        
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringRef.current) {
            forceHide();
          }
        }, delay);
      },
      isVisible,
    }));

    // Handle mouse events on tooltip
    const handleTooltipMouseLeave = useCallback(() => {
      isHoveringRef.current = false;
      const delay = tooltipConfig?.hideDelay || 200;
      
      clearHideTimeout();
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          forceHide();
        }
      }, delay);
    }, [tooltipConfig?.hideDelay, clearHideTimeout, forceHide]);

    const handleTooltipMouseEnter = useCallback(() => {
      isHoveringRef.current = true;
      clearHideTimeout();
    }, [clearHideTimeout]);

    // Cleanup
    useEffect(() => {
      return () => {
        clearHideTimeout();
      };
    }, [clearHideTimeout]);

    // Build combined variables for template replacement
    const templateVariables = useMemo(() => {
      const vars: Record<string, any> = {};
      
      // Add extracted data
      if (pointData) {
        const extracted = extractData(tooltipConfig || {} as ChildCardTooltipConfig, pointData, chartConfig);
        Object.assign(vars, extracted);
      }
      
      // Add calculation results
      Object.assign(vars, calculationResults);
      
      return vars;
    }, [pointData, calculationResults, tooltipConfig, chartConfig, extractData]);

    // Don't render if not visible or no config
    if (!isVisible || !tooltipConfig?.enabled) return null;

    const width = tooltipConfig.width || 400;
    const height = tooltipConfig.height || 300;

    // Render a single tooltip card (used for both single-card mode and multi-card mode)
    const renderSingleCard = (cardConfig: TooltipCardConfig | { type: string; chartTemplate?: string; tableDataSource?: string; htmlTemplate?: string; tableSettings?: any }, vars: Record<string, any>) => {
      switch (cardConfig.type) {
        case 'chart': {
          if (!cardConfig.chartTemplate) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption">No chart template</Typography>
              </Box>
            );
          }
          
          try {
            const processedTemplate = replaceVariableReferences(cardConfig.chartTemplate, vars);
            const chartOptions = JSON.parse(processedTemplate);
            
            // Validate series data
            if (chartOptions.series) {
              chartOptions.series = chartOptions.series.map((s: any) => ({
                ...s,
                data: Array.isArray(s.data) ? s.data : [],
              }));
            }
            
            return (
              <Box sx={{ width: '100%', height: '100%', minHeight: 150 }}>
                <ResizableChart options={chartOptions} />
              </Box>
            );
          } catch (error) {
            console.error('❌ [Tooltip Card] Chart parse error:', error);
            return (
              <Box sx={{ p: 1, textAlign: 'center', color: '#ef4444', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
                <Typography variant="caption">Chart Error</Typography>
                <Typography variant="caption" sx={{ opacity: 0.7, fontSize: '0.6rem' }}>{String(error).substring(0, 50)}</Typography>
              </Box>
            );
          }
        }
        
        case 'table': {
          if (!cardConfig.tableDataSource) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption">No data source</Typography>
              </Box>
            );
          }
          
          const tableData = vars[cardConfig.tableDataSource];
          if (tableData && Array.isArray(tableData)) {
            return (
              <DashboardTable
                dataSource=""
                settings={cardConfig.tableSettings}
                directData={tableData}
              />
            );
          }
          
          return (
            <DashboardTable
              dataSource={cardConfig.tableDataSource}
              settings={cardConfig.tableSettings}
            />
          );
        }
        
        case 'html': {
          if (!cardConfig.htmlTemplate) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption">No HTML template</Typography>
              </Box>
            );
          }
          
          const processedHtml = replaceVariableReferences(cardConfig.htmlTemplate, vars, true);
          return (
            <div 
              dangerouslySetInnerHTML={{ __html: processedHtml }}
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
            />
          );
        }
        
        default:
          return null;
      }
    };

    // Render multi-card layout
    const renderMultiCardContent = () => {
      if (!tooltipConfig.tooltipCards || tooltipConfig.tooltipCards.length === 0) {
        return (
          <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
            <Typography variant="body2">No tooltip cards configured</Typography>
          </Box>
        );
      }

      const gap = tooltipConfig.gap || 4;
      const contentHeight = tooltipConfig.showHeader ? 'calc(100% - 44px)' : '100%';

      return (
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: contentHeight,
            p: `${gap / 2}px`,
          }}
        >
          {tooltipConfig.tooltipCards.map((card, index) => {
            const { x, y, w, h } = card.layout;
            
            return (
              <Box
                key={card.id}
                sx={{
                  position: 'absolute',
                  left: `calc(${x * 100}% + ${gap / 2}px)`,
                  top: `calc(${y * 100}% + ${gap / 2}px)`,
                  width: `calc(${w * 100}% - ${gap}px)`,
                  height: `calc(${h * 100}% - ${gap}px)`,
                  bgcolor: card.backgroundColor || 'transparent',
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Card Title */}
                {card.showTitle && card.title && (
                  <Box
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderBottom: '1px solid rgba(102, 126, 234, 0.1)',
                      bgcolor: 'rgba(102, 126, 234, 0.03)',
                    }}
                  >
                    <Typography variant="caption" fontWeight={600} color="#667eea">
                      {card.title}
                    </Typography>
                  </Box>
                )}
                
                {/* Card Content */}
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                  {renderSingleCard(card, templateVariables)}
                </Box>
              </Box>
            );
          })}
        </Box>
      );
    };

    // Render content based on tooltip type
    const renderContent = () => {
      if (isCalculating) {
        return (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            gap: 1,
          }}>
            <CircularProgress size={24} sx={{ color: '#667eea' }} />
            <Typography variant="body2" color="#64748b">Loading...</Typography>
          </Box>
        );
      }

      // 🔥 NEW: Check if multi-card mode is enabled
      if (tooltipConfig.useMultiCard && tooltipConfig.tooltipCards && tooltipConfig.tooltipCards.length > 0) {
        return renderMultiCardContent();
      }

      // Legacy single-card mode
      switch (tooltipConfig.type) {
        case 'chart': {
          if (!tooltipConfig.chartTemplate) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No chart template configured</Typography>
              </Box>
            );
          }
          
          // 🔥 FIX: Check if calculation results are available before rendering
          // If calculations are configured but not yet completed, show loading
          const hasCalculations = tooltipConfig.calculationBindings && tooltipConfig.calculationBindings.length > 0;
          const hasResults = Object.keys(calculationResults).length > 0;
          
          if (hasCalculations && !hasResults) {
            return (
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                gap: 1,
              }}>
                <CircularProgress size={24} sx={{ color: '#667eea' }} />
                <Typography variant="body2" color="#64748b">Calculating...</Typography>
              </Box>
            );
          }
          
          try {
            const processedTemplate = replaceVariableReferences(
              tooltipConfig.chartTemplate,
              templateVariables
            );
            
            // 🔥 DEBUG: Log the processed template
            console.log('📝 [Tooltip] Processed template:', processedTemplate.substring(0, 200));
            
            const chartOptions = JSON.parse(processedTemplate);
            
            // 🔥 FIX: Validate that series data is an array
            if (chartOptions.series) {
              chartOptions.series = chartOptions.series.map((s: any) => {
                if (s.data && !Array.isArray(s.data)) {
                  console.warn('⚠️ [Tooltip] Series data is not an array:', s.data);
                  return { ...s, data: [] }; // Default to empty array
                }
                return s;
              });
            }
            
            return (
              <Box sx={{ width: '100%', height: '100%', minHeight: 150 }}>
                <ResizableChart options={chartOptions} />
              </Box>
            );
          } catch (error) {
            console.error('❌ [Tooltip] Chart parse error:', error);
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#ef4444' }}>
                <Typography variant="body2">Error parsing chart template</Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                  {String(error)}
                </Typography>
              </Box>
            );
          }
        }
        
        case 'table': {
          if (!tooltipConfig.tableDataSource) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No data source configured</Typography>
              </Box>
            );
          }
          
          // Check if the data source is a calculation result
          const tableData = calculationResults[tooltipConfig.tableDataSource] || 
                           templateVariables[tooltipConfig.tableDataSource];
          
          if (tableData && Array.isArray(tableData)) {
            // Use direct data if available
            return (
              <DashboardTable
                dataSource=""
                settings={tooltipConfig.tableSettings}
                directData={tableData}
              />
            );
          }
          
          return (
            <DashboardTable
              dataSource={tooltipConfig.tableDataSource}
              settings={tooltipConfig.tableSettings}
            />
          );
        }
        
        case 'html': {
          if (!tooltipConfig.htmlTemplate) {
            // Default HTML showing extracted data
            const defaultHtml = `
              <div style="padding: 16px; font-family: system-ui, -apple-system, sans-serif;">
                <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px;">Point Details</h3>
                ${Object.entries(templateVariables)
                  .filter(([key, value]) => typeof value !== 'object')
                  .slice(0, 10)
                  .map(([key, value]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 500;">${key}:</span>
                      <span style="color: #1e293b; font-weight: 600;">${value}</span>
                    </div>
                  `).join('')}
              </div>
            `;
            return (
              <div 
                dangerouslySetInnerHTML={{ __html: defaultHtml }}
                style={{ width: '100%', height: '100%', overflow: 'auto' }}
              />
            );
          }
          
          const processedHtml = replaceVariableReferences(
            tooltipConfig.htmlTemplate,
            templateVariables,
            true  // isHtml = true
          );
          return (
            <div 
              dangerouslySetInnerHTML={{ __html: processedHtml }}
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
            />
          );
        }
        
        default:
          return null;
      }
    };

    // Render tooltip portal
    return createPortal(
      <Box
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
        sx={{
          position: 'fixed',
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          width: width,
          height: height,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 8px 20px rgba(0,0,0,0.15)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          zIndex: 99999,
          overflow: 'hidden',
          pointerEvents: 'auto',
          animation: 'childTooltipFadeIn 0.15s ease-out',
          '@keyframes childTooltipFadeIn': {
            from: {
              opacity: 0,
              transform: 'scale(0.95) translateY(-5px)',
            },
            to: {
              opacity: 1,
              transform: 'scale(1) translateY(0)',
            },
          },
        }}
      >
        {/* Header */}
        {tooltipConfig.showHeader && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              px: 2,
              py: 1,
              borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
            }}
          >
            <Typography
              variant="subtitle2"
              sx={{
                fontWeight: 700,
                color: '#667eea',
                fontSize: '0.875rem',
              }}
            >
              {tooltipConfig.headerTitle || 'Details'}
            </Typography>
            <IconButton
              size="small"
              onClick={forceHide}
              sx={{
                color: '#64748b',
                p: 0.5,
                '&:hover': {
                  color: '#ef4444',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
        
        {/* Content */}
        <Box
          sx={{
            width: '100%',
            height: tooltipConfig.showHeader ? 'calc(100% - 44px)' : '100%',
            overflow: 'auto',
            '& > *': {
              height: '100%',
              minHeight: '100%',
            },
          }}
        >
          {renderContent()}
        </Box>
      </Box>,
      document.body
    );
  }
);

ChildCardTooltip.displayName = 'ChildCardTooltip';

export default ChildCardTooltip;

