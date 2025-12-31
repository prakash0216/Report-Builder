import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Box } from '@mui/material';
import { useRecoilCallback, useRecoilValue } from 'recoil';
import { ParentCardConfig } from '../recoil/ChildCardState';
import ChildCard from './ChildCard';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { variableUpdateTriggerState } from '../recoil/Variabletracker';

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

  // 🔥 Subscribe to variable updates to recalculate height when data changes
  const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);

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
          overflow: 'auto', // 🔥 Enable scrolling
          position: 'relative',
          backgroundColor: '#f8fafc',
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
        backgroundColor: '#f8fafc',
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        {config.childCards.map((childConfig) => (
          <ChildCard
            key={childConfig.id}
            config={childConfig}
            parentCardId={parentCardId}
            parentWidth={dimensions.width}
            parentHeight={dimensions.height}
            gap={config.gap}
            showExport={showExport}
          />
        ))}
      </Box>
    </Box>
  );
};

export default ParentCardContainer;
