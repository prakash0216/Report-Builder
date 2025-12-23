import React, { forwardRef, useImperativeHandle, useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import { chartConfigState } from '../recoil/ChartConfig';
import { tooltipConfigState, TooltipConfig, activeTooltipState } from '../recoil/TooltipConfigState';
import { variableAtomFamily } from '../recoil/VariableFamily';
import DashboardTable from './DashboardTable';
import ResizableChart from './ResizableChart';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

export interface TooltipCardProps {
  chartId: string;
  onClose?: () => void;
}

export interface TooltipCardRef {
  show: (position: { x: number; y: number }, data?: any) => void;
  hide: () => void;
  isVisible: boolean;
}

// Helper function to safely parse JSON
const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Helper function to replace variable references in template strings
const replaceVariableReferences = (template: string, variables: Record<string, any>): string => {
  let result = template;
  
  Object.entries(variables).forEach(([name, value]) => {
    const replacement = JSON.stringify(value);
    
    // Replace "${variableName}" pattern
    result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), replacement);
    
    // Replace ${variableName} pattern  
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), 
      typeof value === 'string' ? value : JSON.stringify(value));
    
    // Replace {{variableName}} pattern (for HTML templates)
    result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), 
      typeof value === 'string' ? value : JSON.stringify(value));
  });
  
  return result;
};

// Helper to extract nested values from point data
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
};

const TooltipCard = forwardRef<TooltipCardRef, TooltipCardProps>(
  ({ chartId, onClose }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [tooltipData, setTooltipData] = useState<any>(null);
    const isHoveringRef = React.useRef(false);
    const hideTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    
    // Get tooltip configuration for this chart
    const tooltipConfigs = useRecoilValue(tooltipConfigState);
    const tooltipConfig = tooltipConfigs[chartId];
    
    // Get all chart configs (for card type tooltips)
    const chartConfigs = useRecoilValue(chartConfigState);
    
    // Set active tooltip state for global tracking
    const setActiveTooltip = useSetRecoilState(activeTooltipState);

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
      setActiveTooltip({
        chartId: null,
        isVisible: false,
        position: { x: 0, y: 0 },
        pointData: null,
      });
      onClose?.();
    }, [clearHideTimeout, setActiveTooltip, onClose]);
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      show: (pos: { x: number; y: number }, pointData?: any) => {
        if (!tooltipConfig?.enabled) return;
        
        // Clear any pending hide
        clearHideTimeout();
        
        // Calculate adjusted position to stay within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const width = tooltipConfig?.width || 400;
        const height = tooltipConfig?.height || 300;
        const offsetX = tooltipConfig?.offsetX || 10;
        const offsetY = tooltipConfig?.offsetY || 10;
        
        let adjustedX = pos.x + offsetX;
        let adjustedY = pos.y + offsetY;
        
        // Adjust if tooltip would go off-screen
        if (adjustedX + width > viewportWidth) {
          adjustedX = pos.x - width - offsetX;
        }
        if (adjustedY + height > viewportHeight) {
          adjustedY = pos.y - height - offsetY;
        }
        
        // Ensure minimum position
        adjustedX = Math.max(10, adjustedX);
        adjustedY = Math.max(10, adjustedY);
        
        setTooltipPosition({ x: adjustedX, y: adjustedY });
        setTooltipData(pointData);
        setIsVisible(true);
        
        setActiveTooltip({
          chartId,
          isVisible: true,
          position: { x: adjustedX, y: adjustedY },
          pointData,
        });
      },
      hide: () => {
        // Schedule hide with delay, but only if not hovering over tooltip
        const delay = tooltipConfig?.hideDelay || 100;
        clearHideTimeout();
        
        hideTimeoutRef.current = setTimeout(() => {
          if (!isHoveringRef.current) {
            forceHide();
          }
        }, delay);
      },
      isVisible,
    }));

    // Handle mouse leave from tooltip
    const handleTooltipMouseLeave = useCallback(() => {
      isHoveringRef.current = false;
      const delay = tooltipConfig?.hideDelay || 100;
      
      clearHideTimeout();
      hideTimeoutRef.current = setTimeout(() => {
        if (!isHoveringRef.current) {
          forceHide();
        }
      }, delay);
    }, [tooltipConfig?.hideDelay, clearHideTimeout, forceHide]);

    // Handle mouse enter on tooltip
    const handleTooltipMouseEnter = useCallback(() => {
      isHoveringRef.current = true;
      clearHideTimeout();
    }, [clearHideTimeout]);

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        clearHideTimeout();
      };
    }, [clearHideTimeout]);

    // Build variables from data mapping
    const mappedVariables = useMemo(() => {
      const variables: Record<string, any> = {};
      
      // Always add all point data if available
      if (tooltipData) {
        // Add all point data with 'point.' prefix and without
        Object.entries(tooltipData).forEach(([key, value]) => {
          variables[`point.${key}`] = value;
          variables[key] = value; // Also add without prefix for convenience
        });
        
        // Handle nested series object
        if (tooltipData.series && typeof tooltipData.series === 'object') {
          Object.entries(tooltipData.series).forEach(([key, value]) => {
            variables[`series.${key}`] = value;
          });
        }
      }
      
      // Apply custom data mappings if configured
      if (tooltipConfig?.dataMapping && Array.isArray(tooltipConfig.dataMapping)) {
        tooltipConfig.dataMapping.forEach(mapping => {
          if (mapping.sourceKey && mapping.targetVariable) {
            const value = getNestedValue(tooltipData, mapping.sourceKey);
            if (value !== undefined) {
              variables[mapping.targetVariable] = value;
            }
          }
        });
      }
      
      return variables;
    }, [tooltipData, tooltipConfig?.dataMapping]);

    // Don't render if not visible or no config
    if (!isVisible || !tooltipConfig?.enabled) return null;

    const width = tooltipConfig.width || 400;
    const height = tooltipConfig.height || 300;

    // Render content based on tooltip type
    const renderContent = () => {
      switch (tooltipConfig.type) {
        case 'card': {
          // Render an existing card as tooltip
          const cardConfig = tooltipConfig.cardId ? chartConfigs[tooltipConfig.cardId] : null;
          if (!cardConfig) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">Card not found: {tooltipConfig.cardId}</Typography>
              </Box>
            );
          }
          
          if (cardConfig.type === 'table') {
            return (
              <DashboardTable
                dataSource={cardConfig.tableDataSource}
                settings={cardConfig.tableSettings}
              />
            );
          } else if (cardConfig.type === 'html') {
            const processedHtml = replaceVariableReferences(
              cardConfig.htmlContent || '',
              mappedVariables
            );
            return (
              <div 
                dangerouslySetInnerHTML={{ __html: processedHtml }}
                style={{ width: '100%', height: '100%', overflow: 'auto' }}
              />
            );
          } else {
            // Chart type
            try {
              const processedTemplate = replaceVariableReferences(
                cardConfig.template || '{}',
                mappedVariables
              );
              const chartOptions = JSON.parse(processedTemplate);
              return <ResizableChart options={chartOptions} />;
            } catch (error) {
              return (
                <Box sx={{ p: 2, textAlign: 'center', color: '#ef4444' }}>
                  <Typography variant="body2">Error parsing chart config</Typography>
                </Box>
              );
            }
          }
        }
        
        case 'chart': {
          // Render inline chart config
          if (!tooltipConfig.chartTemplate) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No chart template configured</Typography>
              </Box>
            );
          }
          
          try {
            const processedTemplate = replaceVariableReferences(
              tooltipConfig.chartTemplate,
              mappedVariables
            );
            const chartOptions = JSON.parse(processedTemplate);
            return <ResizableChart options={chartOptions} />;
          } catch (error) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#ef4444' }}>
                <Typography variant="body2">Error parsing chart template</Typography>
              </Box>
            );
          }
        }
        
        case 'table': {
          // Render table
          if (!tooltipConfig.tableDataSource) {
            return (
              <Box sx={{ p: 2, textAlign: 'center', color: '#64748b' }}>
                <Typography variant="body2">No data source configured</Typography>
              </Box>
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
          // Render HTML template
          if (!tooltipConfig.htmlTemplate) {
            // Default HTML showing point data
            const defaultHtml = `
              <div style="padding: 16px; font-family: system-ui, -apple-system, sans-serif;">
                <h3 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px;">Point Details</h3>
                ${Object.entries(mappedVariables)
                  .filter(([key]) => !key.includes('.'))
                  .map(([key, value]) => `
                    <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0;">
                      <span style="color: #64748b; font-weight: 500;">${key}:</span>
                      <span style="color: #1e293b; font-weight: 600;">${typeof value === 'object' ? JSON.stringify(value) : value}</span>
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
            mappedVariables
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

    // Create portal to render tooltip at document body level
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
          animation: 'tooltipFadeIn 0.15s ease-out',
          '@keyframes tooltipFadeIn': {
            from: {
              opacity: 0,
              transform: 'scale(0.95)',
            },
            to: {
              opacity: 1,
              transform: 'scale(1)',
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
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
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
            overflow: 'hidden',
          }}
        >
          {renderContent()}
        </Box>
      </Box>,
      document.body
    );
  }
);

TooltipCard.displayName = 'TooltipCard';

export default TooltipCard;

