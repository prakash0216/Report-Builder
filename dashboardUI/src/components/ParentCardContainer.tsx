import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { ParentCardConfig } from '../recoil/ChildCardState';
import ChildCard from './ChildCard';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';
import { isDuckDBRef } from '../services/VariableStorageService';
import VariableStorageService from '../services/VariableStorageService';

// 🔥 HTML variable replacement for parent titles
const replaceHtmlVariables = (template: string, variables: Record<string, any>): string => {
  if (!template) return template;
  
  let result = template;
  
  Object.entries(variables).forEach(([name, value]) => {
    let replacement: string;
    if (value === null || value === undefined) {
      replacement = '';
    } else if (typeof value === 'object') {
      replacement = JSON.stringify(value);
    } else {
      replacement = String(value);
    }
    
    result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
    result = result.replace(new RegExp(`\\{\\{${name}\\}\\}`, 'g'), replacement);
  });
  
  result = result.replace(/\$\{[^}]+\}/g, '');
  result = result.replace(/\{\{[^}]+\}\}/g, '');
  
  return result;
};

// 🔥 Safe parse function
const safeParse = (value: any): any => {
  if (typeof value !== 'string') return value;
  if (/^[\d,]+$/.test(value)) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

interface ParentCardContainerProps {
  parentCardId: string;
  config: ParentCardConfig;
  showExport?: boolean;
  onPointClick?: (pointData: any) => void;
  onChartBackgroundClick?: () => void;
}

const ParentCardContainer: React.FC<ParentCardContainerProps> = ({
  parentCardId,
  config,
  showExport = false,
  onPointClick,
  onChartBackgroundClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [heightFromVariable, setHeightFromVariable] = useState<number>(0);
  
  // 🔥 Get all variables for parent title rendering
  const variableNames = useRecoilValue(variableNamesState);
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);
  const [variables, setVariables] = useState<Record<string, any>>({});
  
  const getAllVariables = useRecoilCallback(({ snapshot }) => (): Record<string, any> => {
    const vars: Record<string, any> = {};
    const varNameArray: string[] = Array.from(variableNames);
    
    for (const varName of varNameArray) {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(varName));
        if (loadable.state === 'hasValue') {
          const varValue = loadable.contents;
          if (varValue !== undefined && varValue !== null) {
            vars[varName] = typeof varValue === 'string' ? safeParse(varValue) : varValue;
          }
        }
      } catch (e) {
        // Variable not available
      }
    }
    return vars;
  }, [variableNames]);
  
  // 🦆 DuckDB-WASM Phase 3: Update variables when trigger changes,
  // resolving DuckDB refs for small scalars used in titles.
  useEffect(() => {
    const vars = getAllVariables();

    // Resolve DuckDB refs (titles only use small scalar values)
    const resolve = async () => {
      const varStorage = VariableStorageService.getInstance();
      const resolved: Record<string, any> = { ...vars };

      for (const [name, value] of Object.entries(vars)) {
        if (isDuckDBRef(value)) {
          try {
            resolved[name] = await varStorage.resolveVariableByName(name, JSON.stringify(value));
          } catch {
            // Keep ref as fallback — title will show metadata but not crash
          }
        }
      }

      setVariables(resolved);
    };

    resolve();
  }, [getAllVariables, variableNames, variableUpdateTrigger]);

  // Handle container resize
  const updateDimensions = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    }
  }, []);

  // 🔥 Get height value directly from the selected variable (user calculates this in their logic)
  const getHeightFromVariable = useRecoilCallback(({ snapshot }) => async () => {
    if (!config.useDynamicHeight || !config.heightDataSource) {
      return 0;
    }

    try {
      const rawValue = await snapshot.getPromise(variableAtomFamily(config.heightDataSource));
      if (!rawValue) return 0;

      // Parse the value - user should store a number (the calculated height)
      let heightValue: number = 0;
      if (typeof rawValue === 'string') {
        // Try to parse as number
        const parsed = parseFloat(rawValue);
        if (!isNaN(parsed)) {
          heightValue = parsed;
        } else {
          console.warn(`[ParentContainer] heightDataSource "${config.heightDataSource}" is not a valid number:`, rawValue);
          return 0;
        }
      } else if (typeof rawValue === 'number') {
        heightValue = rawValue;
      }

      // Return the height value directly
      if (heightValue > 0) {
        return heightValue;
      }
      return 0;
    } catch (err) {
      console.warn('Failed to get height from variable:', err);
      return 0;
    }
  }, [config.useDynamicHeight, config.heightDataSource]);

  // 🔥 Update height when config changes OR when variables are recalculated
  useEffect(() => {
    if (config.useDynamicHeight && config.heightDataSource) {
      getHeightFromVariable().then(setHeightFromVariable);
    }
  }, [config.useDynamicHeight, config.heightDataSource, getHeightFromVariable, variableUpdateTrigger]);

  // 🔥 Use height from variable if available, otherwise fall back to cardMinHeight
  const calculatedHeight = useMemo(() => {
    if (!config.useDynamicHeight || !config.heightDataSource || heightFromVariable === 0) {
      return config.cardMinHeight || 800;
    }

    console.log(`📏 [ParentContainer] Using dynamic height from variable "${config.heightDataSource}": ${heightFromVariable}px`);
    
    return heightFromVariable;
  }, [config.useDynamicHeight, config.heightDataSource, config.cardMinHeight, heightFromVariable]);

  useEffect(() => {
    updateDimensions();
    
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [updateDimensions]);

  // 🔥 Render parent card title
  const renderParentTitle = () => {
    if (!config.showParentTitle) return null;
    
    // HTML Mode - render HTML template with variables
    if (config.parentTitleMode === 'html' && config.parentTitleTemplate) {
      const processedHtml = replaceHtmlVariables(config.parentTitleTemplate, variables);
      return (
        <Box
          sx={{
            minHeight: 40,
            px: 2,
            py: 1,
            display: 'flex',
            alignItems: 'center',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            backgroundColor: 'white',
            flexShrink: 0,
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: processedHtml }}
            style={{
              width: '100%',
              lineHeight: 1.4,
            }}
          />
        </Box>
      );
    }
    
    // Simple Mode - render plain text with variable replacement
    const titleText = config.parentTitle || '';
    const processedTitle = replaceHtmlVariables(titleText, variables);
    
    if (!processedTitle) return null;
    
    return (
      <Box
        sx={{
          height: 44,
          px: 2,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
          backgroundColor: 'white',
          flexShrink: 0,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontSize: '1rem',
            fontWeight: 600,
            color: '#1e293b',
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
  
  // Parent title height (approximate)
  const parentTitleHeight = config.showParentTitle ? 44 : 0;

  // 🔥 Filter and sort child cards based on visibility and arrangement variables
  const visibleChildCards = useMemo(() => {
    if (!config.childCards || config.childCards.length === 0) {
      return [];
    }
    
    // 🔥 Always use individual visibility mode (no longer respecting 'all' mode)
    const filteredCards = config.childCards.filter(child => {
      // If no visibility variable is set, card is always visible
      if (!child.visibilityVariable) {
        console.log(`[Visibility] Card ${child.id}: No visibility variable → VISIBLE`);
        return true;
      }
      
      // Check the visibility variable value
      const visValue = variables[child.visibilityVariable];
      const parsedValue = typeof visValue === 'string' ? safeParse(visValue) : visValue;
      
      console.log(`[Visibility] Card ${child.id}: Variable "${child.visibilityVariable}" = ${JSON.stringify(visValue)} → parsed = ${JSON.stringify(parsedValue)} → ${parsedValue === true ? 'VISIBLE' : 'HIDDEN'}`);
      
      // Only show if variable is exactly true
      return parsedValue === true;
    });
    
    // Sort by arrangement variable (lower numbers first)
    const sortedCards = [...filteredCards].sort((a, b) => {
      // Get arrangement values (default to Infinity if no variable set)
      const aArrangement = a.arrangementVariable && variables[a.arrangementVariable] !== undefined
        ? Number(safeParse(variables[a.arrangementVariable])) || Infinity
        : Infinity;
      const bArrangement = b.arrangementVariable && variables[b.arrangementVariable] !== undefined
        ? Number(safeParse(variables[b.arrangementVariable])) || Infinity
        : Infinity;
      
      // If both have same arrangement (or both undefined), maintain original order
      if (aArrangement === bArrangement) {
        return 0;
      }
      
      return aArrangement - bArrangement;
    });
    
    return sortedCards;
  }, [config.childCards, config.childVisibilityMode, variables]);

  // 🔥 Get dynamic dimensions for a child card based on its dimension conditions
  const getChildDynamicDimensions = useCallback((childConfig: typeof config.childCards[0]): { width: number; height: number } | null => {
    const conditions = childConfig.dimensionConditions;
    if (!conditions || conditions.length === 0) {
      return null; // No conditions = use default layout
    }
    
    // Sort by priority (lower number = higher priority)
    const sortedConditions = [...conditions].sort((a, b) => a.priority - b.priority);
    
    // Check each condition in order - first match wins
    for (const condition of sortedConditions) {
      const varValue = variables[condition.variableName];
      const parsedValue = typeof varValue === 'string' ? safeParse(varValue) : varValue;
      
      if (typeof parsedValue === 'boolean' && parsedValue === condition.expectedValue) {
        // First match wins!
        return {
          width: Math.min(1, Math.max(0, condition.width)),
          height: Math.min(1, Math.max(0, condition.height)),
        };
      }
    }
    
    return null; // No conditions matched
  }, [variables]);

  // Empty state - no cards configured
  if (!config.childCards || config.childCards.length === 0) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
          backgroundColor: '#fafafa',
        }}
      >
        No child cards configured. Open MultiCard Viz Config to add cards.
      </Box>
    );
  }
  
  // Empty state - all cards hidden by visibility rules
  if (visibleChildCards.length === 0) {
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
          backgroundColor: '#fafafa',
          gap: 1,
        }}
      >
        {renderParentTitle()}
        <Box sx={{ textAlign: 'center', p: 2 }}>
          <Typography variant="body2" color="#9ca3af">
            All child cards are currently hidden by visibility rules.
          </Typography>
          <Typography variant="caption" color="#cbd5e1">
            Adjust filter values to show cards.
          </Typography>
        </Box>
      </Box>
    );
  }

  // 🔥 CONTAINER SCROLL MODE
  // The key is: container has fixed height (100% of parent), 
  // but content inside has EXPLICIT height larger than container
  if (config.enableContainerScroll) {
    // 🔥 Use dynamic height if enabled, otherwise use cardMinHeight
    const contentHeight = calculatedHeight;
    
    return (
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%', // Fixed to parent size
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: '#f8fafc',
        }}
      >
        {/* 🔥 Parent Card Title */}
        {renderParentTitle()}
        
        {/* Scrollable content area */}
        <Box
          sx={{
            flex: 1,
            overflow: 'auto', // 🔥 Enable scrolling
          }}
        >
          {/* 
            🔥 KEY: This inner wrapper has EXPLICIT height = contentHeight
            If contentHeight > container height, scrollbar appears
          */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: `${config.gap}px`,
              p: `${config.gap}px`,
              // 🔥 EXPLICIT height - uses dynamic calculation when enabled
              height: contentHeight,
              width: '100%',
            }}
          >
            {/* 🔥 Use visibleChildCards (filtered & sorted) with dynamic dimensions */}
            {visibleChildCards.map((childConfig) => {
              // Get dynamic dimensions if conditions match
              const dynamicDims = getChildDynamicDimensions(childConfig);
              
              // 🔥 For scroll mode with single visible card, use full width
              let effectiveWidth = dynamicDims?.width ?? childConfig.layout.w;
              const effectiveHeight = dynamicDims?.height ?? 1; // 1 = 100% height for scroll mode
              
              // If only one card visible, give it full width
              if (visibleChildCards.length === 1) {
                effectiveWidth = 1;
              }
              
              return (
                <Box
                  key={childConfig.id}
                  sx={{
                    width: `calc(${effectiveWidth * 100}% - ${config.gap}px)`,
                    flex: `0 0 calc(${effectiveWidth * 100}% - ${config.gap}px)`,
                    height: `${effectiveHeight * 100}%`, // Use dynamic height percentage
                    backgroundColor: 'white',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <ChildCard
                    config={childConfig}
                    parentCardId={parentCardId}
                    parentWidth={dimensions.width * effectiveWidth}
                    parentHeight={(contentHeight - (config.gap * 2)) * effectiveHeight}
                    gap={0}
                    showExport={showExport}
                    isFullSizePreview={true}
                    onPointClick={onPointClick}
                    onChartBackgroundClick={onChartBackgroundClick}
                  />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  }

  // 🔥 NO SCROLL MODE: Absolute positioning, charts compress to fit
  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f8fafc',
      }}
    >
      {/* 🔥 Parent Card Title */}
      {renderParentTitle()}
      
      {/* Child cards area - 🔥 Use visibleChildCards (filtered & sorted) with dynamic dimensions */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          width: '100%',
        }}
      >
        {visibleChildCards.map((childConfig, cardIndex) => {
          // Get dynamic dimensions if conditions match
          const dynamicDims = getChildDynamicDimensions(childConfig);
          
          // 🔥 Calculate effective layout based on visible cards and dynamic dimensions
          let effectiveConfig = childConfig;
          
          if (visibleChildCards.length === 1) {
            // 🔥 Only one card visible - give it full size at position 0,0
            effectiveConfig = {
              ...childConfig,
              layout: {
                ...childConfig.layout,
                x: 0,
                y: 0,
                w: dynamicDims?.width ?? 1,
                h: dynamicDims?.height ?? 1,
              }
            };
          } else if (dynamicDims) {
            // 🔥 Multiple visible cards with dimension conditions
            // Auto-calculate position based on card index and dimensions
            // Simple flow layout: stack horizontally, wrap to next row when full
            let accumulatedX = 0;
            let accumulatedY = 0;
            let rowHeight = 0;
            
            for (let i = 0; i < cardIndex; i++) {
              const prevCard = visibleChildCards[i];
              const prevDims = getChildDynamicDimensions(prevCard);
              const prevWidth = prevDims?.width ?? prevCard.layout.w;
              const prevHeight = prevDims?.height ?? prevCard.layout.h;
              
              accumulatedX += prevWidth;
              rowHeight = Math.max(rowHeight, prevHeight);
              
              // If next card would overflow, wrap to next row
              if (accumulatedX >= 1 - 0.01) {
                accumulatedX = 0;
                accumulatedY += rowHeight;
                rowHeight = 0;
              }
            }
            
            effectiveConfig = {
              ...childConfig,
              layout: {
                ...childConfig.layout,
                x: accumulatedX,
                y: accumulatedY,
                w: dynamicDims.width,
                h: dynamicDims.height,
              }
            };
          }
          // If no dynamic dims and multiple cards, use original layout
          
          return (
            <ChildCard
              key={childConfig.id}
              config={effectiveConfig}
              parentCardId={parentCardId}
              parentWidth={dimensions.width}
              parentHeight={dimensions.height - parentTitleHeight}
              gap={config.gap}
              showExport={showExport}
              onPointClick={onPointClick}
              onChartBackgroundClick={onChartBackgroundClick}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default ParentCardContainer;
