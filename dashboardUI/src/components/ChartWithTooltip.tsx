import React, { useRef, useMemo, useCallback, useEffect } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import { useRecoilValue } from 'recoil';
import { tooltipConfigState } from '../recoil/TooltipConfigState';
import TooltipCard, { TooltipCardRef } from './TooltipCard';
import { Box } from '@mui/material';

// Use require for modules to avoid TypeScript issues
const HighchartsExporting = require('highcharts/modules/exporting');
const HighchartsExportData = require('highcharts/modules/export-data');
const HighchartsOfflineExporting = require('highcharts/modules/offline-exporting');

// Initialize modules (same as ResizableChart)
try {
  if (typeof HighchartsExporting === 'function') {
    HighchartsExporting(Highcharts);
  }
} catch (e) {
  console.warn('Exporting module initialization failed:', e);
}

try {
  if (typeof HighchartsExportData === 'function') {
    HighchartsExportData(Highcharts);
  }
} catch (e) {
  console.warn('Export data module initialization failed:', e);
}

try {
  if (typeof HighchartsOfflineExporting === 'function') {
    HighchartsOfflineExporting(Highcharts);
  }
} catch (e) {
  console.warn('Offline exporting module initialization failed:', e);
}

interface ChartWithTooltipProps {
  chartId: string;
  options: Highcharts.Options;
  showExport?: boolean;
  onPointClick?: (pointData: any) => void;          // onClick action callback
  onChartBackgroundClick?: () => void;               // Click outside point → reset
}

// Extract point data from Highcharts point object
const extractPointData = (point: any) => {
  if (!point) return null;
  
  return {
    x: point.x,
    y: point.y,
    name: point.name,
    category: point.category,
    color: point.color,
    percentage: point.percentage,
    total: point.total,
    index: point.index,
    series: {
      name: point.series?.name,
      index: point.series?.index,
      type: point.series?.type,
    },
    options: point.options,
  };
};

const ChartWithTooltip: React.FC<ChartWithTooltipProps> = ({ 
  chartId, 
  options, 
  showExport = false,
  onPointClick,
  onChartBackgroundClick,
}) => {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<TooltipCardRef>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });
  
  // Get tooltip configuration for this chart
  const tooltipConfigs = useRecoilValue(tooltipConfigState);
  const tooltipConfig = tooltipConfigs[chartId];
  const isTooltipEnabled = tooltipConfig?.enabled ?? false;

  // Force chart resize function
  const forceChartResize = useCallback(() => {
    if (chartRef.current?.chart && containerRef.current) {
      const container = containerRef.current;
      const currentWidth = container.offsetWidth;
      const currentHeight = container.offsetHeight;
      
      if (currentWidth > 0 && currentHeight > 0 && 
          (currentWidth !== lastSizeRef.current.width || 
           currentHeight !== lastSizeRef.current.height)) {
        
        lastSizeRef.current = { width: currentWidth, height: currentHeight };
        
        try {
          chartRef.current.chart.setSize(currentWidth, currentHeight, false);
          chartRef.current.chart.reflow();
        } catch (error) {
          console.warn('Chart resize error:', error);
        }
      }
    }
  }, []);

  // Setup resize observers
  useEffect(() => {
    let observer: ResizeObserver | null = null;

    if (containerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            requestAnimationFrame(forceChartResize);
          }
        }
      });
      observer.observe(containerRef.current);
    }

    return () => {
      if (observer && containerRef.current) {
        observer.unobserve(containerRef.current);
        observer.disconnect();
      }
    };
  }, [forceChartResize]);

  // Handle tooltip show
  const handleShowTooltip = useCallback((event: MouseEvent, point: any) => {
    if (!isTooltipEnabled || !tooltipRef.current) return;
    
    const pointData = extractPointData(point);
    tooltipRef.current.show(
      { x: event.clientX, y: event.clientY },
      pointData
    );
  }, [isTooltipEnabled]);

  // Handle tooltip hide
  const handleHideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.hide();
    }
  }, []);

  // Enhanced options with custom tooltip handling
  const enhancedOptions = useMemo(() => {
    const userExporting = options.exporting || {};
    const userContext = userExporting.buttons?.contextButton || {};
    
    const mergedExporting = showExport
      ? {
          ...userExporting,
          enabled: true,
          buttons: {
            contextButton: {
              menuItems: [
                'viewFullscreen',
                'printChart',
                'separator',
                'downloadPNG',
                'downloadJPEG',
                'downloadPDF',
                'downloadSVG',
                'separator',
                'downloadCSV',
                'downloadXLS',
              ],
              theme: {
                fill: '#f3e8ff',
                stroke: '#a855f7',
                style: { color: '#6b21a8' },
                states: {
                  hover: { fill: '#e9d5ff', stroke: '#9333ea', style: { color: '#6b21a8' } },
                  select: { fill: '#d8b4fe', stroke: '#7e22ce', style: { color: '#581c87' } },
                },
              },
              ...userContext,
            },
          },
          filename: options.title?.text
            ? (typeof options.title.text === 'string'
                ? options.title.text.replace(/[^a-z0-9]/gi, '_').toLowerCase()
                : 'chart')
            : 'chart',
        }
      : { enabled: false };

    // If custom tooltip is enabled, disable default tooltip and add point events
    const tooltipOptions = isTooltipEnabled
      ? { enabled: false }
      : options.tooltip;

    // Build point events: tooltip hover + onClick actions
    const needsCustomPointEvents = isTooltipEnabled || onPointClick;
    
    const plotOptions = needsCustomPointEvents
      ? {
          ...options.plotOptions,
          series: {
            ...options.plotOptions?.series,
            point: {
              ...options.plotOptions?.series?.point,
              events: {
                ...options.plotOptions?.series?.point?.events,
                // Tooltip hover handlers
                ...(isTooltipEnabled ? {
                  mouseOver: function(this: any, e: any) {
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
                    
                    handleShowTooltip({ clientX, clientY } as MouseEvent, this);
                    
                    const originalHandler = options.plotOptions?.series?.point?.events?.mouseOver;
                    if (typeof originalHandler === 'function') {
                      originalHandler.call(this, e);
                    }
                  },
                  mouseOut: function(this: any, e: any) {
                    handleHideTooltip();
                    
                    const originalHandler = options.plotOptions?.series?.point?.events?.mouseOut;
                    if (typeof originalHandler === 'function') {
                      originalHandler.call(this, e);
                    }
                  },
                } : {}),
                // onClick action handler
                ...(onPointClick ? {
                  click: function(this: any, e: any) {
                    const pointData = extractPointData(this);
                    if (pointData) {
                      (pointData as any)._chartOptions = options; // Attach chart config for extractionType='config'
                      onPointClick(pointData);
                    }
                    
                    const originalHandler = options.plotOptions?.series?.point?.events?.click;
                    if (typeof originalHandler === 'function') {
                      originalHandler.call(this, e);
                    }
                  },
                } : {}),
              },
            },
          },
        }
      : options.plotOptions;

    return {
      ...options,
      chart: {
        ...options.chart,
        animation: false,
        reflow: true,
        backgroundColor: '#FFFFFF',
        style: {
          fontFamily: 'inherit',
        },
        events: {
          ...options.chart?.events,
          // Detect clicks on chart background (not on a data point) → trigger reset
          ...(onChartBackgroundClick ? {
            click: function(this: any, e: any) {
              // Only trigger reset if the click was NOT on a data point
              // Highcharts sets e.point when a point is clicked via chart events
              if (!(e as any).point) {
                onChartBackgroundClick();
              }
              const originalHandler = options.chart?.events?.click;
              if (typeof originalHandler === 'function') {
                originalHandler.call(this, e);
              }
            },
          } : {}),
        },
      },
      credits: {
        enabled: false,
        ...options.credits,
      },
      tooltip: tooltipOptions,
      plotOptions,
      exporting: mergedExporting,
      responsive: {
        rules: [{
          condition: { maxWidth: 400 },
          chartOptions: {
            legend: { enabled: false },
            title: { style: { fontSize: '12px' } }
          }
        }],
        ...options.responsive?.rules && { rules: options.responsive.rules }
      }
    };
  }, [options, showExport, isTooltipEnabled, handleShowTooltip, handleHideTooltip, onPointClick, onChartBackgroundClick]);

  // Chart callback for initial sizing
  const handleChartCallback = useCallback((chart: Highcharts.Chart) => {
    setTimeout(() => {
      if (chart && containerRef.current) {
        const container = containerRef.current;
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        
        if (width > 0 && height > 0) {
          try {
            chart.setSize(width, height, false);
            chart.reflow();
          } catch (error) {
            console.warn('Initial chart sizing error:', error);
          }
        }
      }
    }, 100);
  }, []);

  return (
    <>
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: '150px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <HighchartsReact
          highcharts={Highcharts}
          options={enhancedOptions}
          ref={chartRef}
          callback={handleChartCallback}
          containerProps={{
            style: {
              width: '100%',
              height: '100%',
              position: 'absolute',
              top: 0,
              left: 0,
            }
          }}
        />
      </Box>
      
      {/* Render tooltip portal */}
      {isTooltipEnabled && (
        <TooltipCard
          ref={tooltipRef}
          chartId={chartId}
        />
      )}
    </>
  );
};

// Memoized version
const arePropsEqual = (
  prevProps: ChartWithTooltipProps, 
  nextProps: ChartWithTooltipProps
): boolean => {
  if (prevProps.chartId !== nextProps.chartId) return false;
  if (prevProps.showExport !== nextProps.showExport) return false;
  if (prevProps.onPointClick !== nextProps.onPointClick) return false;
  if (prevProps.onChartBackgroundClick !== nextProps.onChartBackgroundClick) return false;
  
  if (!prevProps.options && !nextProps.options) return true;
  if (!prevProps.options || !nextProps.options) return false;

  // Compare series data length
  const prevSeries = (prevProps.options as any).series;
  const nextSeries = (nextProps.options as any).series;
  if (Array.isArray(prevSeries) && Array.isArray(nextSeries)) {
    if (prevSeries.length !== nextSeries.length) return false;
    if (prevSeries[0]?.data?.length !== nextSeries[0]?.data?.length) return false;
  }

  // Compare title
  const prevTitle = (prevProps.options as any).title?.text;
  const nextTitle = (nextProps.options as any).title?.text;
  if (prevTitle !== nextTitle) return false;

  // Deep comparison
  const prevWithoutRefresh = { ...prevProps.options };
  const nextWithoutRefresh = { ...nextProps.options };
  delete (prevWithoutRefresh as any)._lastRefresh;
  delete (nextWithoutRefresh as any)._lastRefresh;

  return JSON.stringify(prevWithoutRefresh) === JSON.stringify(nextWithoutRefresh);
};

export default React.memo(ChartWithTooltip, arePropsEqual);

