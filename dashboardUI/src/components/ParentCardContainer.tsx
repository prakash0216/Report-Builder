import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { ParentCardConfig } from '../recoil/ChildCardState';
import ChildCard from './ChildCard';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableUpdateTriggerState, variableNamesState } from '../recoil/Variabletracker';

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
}

const ParentCardContainer: React.FC<ParentCardContainerProps> = ({
  parentCardId,
  config,
  showExport = false,
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
  
  // Update variables when trigger changes
  useEffect(() => {
    const vars = getAllVariables();
    setVariables(vars);
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

  // Empty state
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
            {config.childCards.map((childConfig) => (
              <Box
                key={childConfig.id}
                sx={{
                  width: `calc(${childConfig.layout.w * 100}% - ${config.gap}px)`,
                  flex: `0 0 calc(${childConfig.layout.w * 100}% - ${config.gap}px)`,
                  height: '100%', // Fill the row height
                  backgroundColor: 'white',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <ChildCard
                  config={childConfig}
                  parentCardId={parentCardId}
                  parentWidth={dimensions.width * childConfig.layout.w}
                  parentHeight={contentHeight - (config.gap * 2)} // Account for padding
                  gap={0}
                  showExport={showExport}
                  isFullSizePreview={true}
                />
              </Box>
            ))}
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
      
      {/* Child cards area */}
      <Box
        sx={{
          flex: 1,
          position: 'relative',
          width: '100%',
        }}
      >
        {config.childCards.map((childConfig) => (
          <ChildCard
            key={childConfig.id}
            config={childConfig}
            parentCardId={parentCardId}
            parentWidth={dimensions.width}
            parentHeight={dimensions.height - parentTitleHeight}
            gap={config.gap}
            showExport={showExport}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ParentCardContainer;
