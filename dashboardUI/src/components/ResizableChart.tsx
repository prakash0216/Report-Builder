import React, { useEffect, useRef, useCallback, useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

// Use require for modules to avoid TypeScript issues
const HighchartsExporting = require('highcharts/modules/exporting');
const HighchartsExportData = require('highcharts/modules/export-data');
const HighchartsOfflineExporting = require('highcharts/modules/offline-exporting');

// Initialize modules
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

// Extended interface to support HTML content
interface ChartOptions extends Highcharts.Options {
  html?: string;
  type?: 'chart' | 'html' | 'table' | 'tableChart';
}

interface ResizableChartProps {
  options: ChartOptions;
  showExport?: boolean;
}

const ResizableChartInner: React.FC<ResizableChartProps> = ({ options, showExport = false }) => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  // Check if this is HTML content - MOVED BEFORE HOOKS
  const isHtmlContent = options?.html !== undefined || options?.type === 'html';

  // Enhanced options for Highcharts - MUST BE BEFORE EARLY RETURN
  const enhancedOptions = useMemo(() => {
    // If it's HTML content, just return the options as-is
    if (isHtmlContent) {
      return options;
    }

    // Otherwise, enhance for Highcharts
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
                fill: '#f3e8ff', // violet-100
                stroke: '#a855f7', // violet-500
                style: { color: '#6b21a8' }, // violet-800
                states: {
                  hover: {
                    fill: '#e9d5ff', // violet-200
                    stroke: '#9333ea', // violet-600
                    style: { color: '#6b21a8' },
                  },
                  select: {
                    fill: '#d8b4fe', // violet-300
                    stroke: '#7e22ce', // violet-700
                    style: { color: '#581c87' }, // deeper violet
                  },
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
      },
      credits: {
        enabled: false,
        ...options.credits,
      },
      exporting: mergedExporting,
      responsive: {
        rules: [{
          condition: {
            maxWidth: 400
          },
          chartOptions: {
            legend: {
              enabled: false
            },
            title: {
              style: {
                fontSize: '12px'
              }
            }
          }
        }],
        ...options.responsive?.rules && { rules: options.responsive.rules }
      }
    };
  }, [options, showExport, isHtmlContent]);

  // More aggressive resize function for real-time updates
  const forceChartResize = useCallback(() => {
    if (chartComponentRef.current?.chart && containerRef.current) {
      const container = containerRef.current;
      const currentWidth = container.offsetWidth;
      const currentHeight = container.offsetHeight;
      
      if (currentWidth > 0 && currentHeight > 0 && 
          (currentWidth !== lastSizeRef.current.width || 
           currentHeight !== lastSizeRef.current.height)) {
        
        lastSizeRef.current = { width: currentWidth, height: currentHeight };
        
        try {
          chartComponentRef.current.chart.setSize(currentWidth, currentHeight, false);
          chartComponentRef.current.chart.reflow();
        } catch (error) {
          console.warn('Chart resize error:', error);
        }
      }
    }
  }, []);

  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      forceChartResize();
    }, 50);
  }, [forceChartResize]);

  const animationFrameResize = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      forceChartResize();
    });
  }, [forceChartResize]);

  useEffect(() => {
    // Skip resize observers for HTML content
    if (isHtmlContent) return;

    let observer: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (containerRef.current) {
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            animationFrameResize();
            debouncedResize();
          }
        }
      });
      observer.observe(containerRef.current);

      mutationObserver = new MutationObserver((mutations) => {
        let shouldResize = false;
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            const target = mutation.target as HTMLElement;
            if (mutation.attributeName === 'style' && 
                (target.style.width || target.style.height || target.style.transform)) {
              shouldResize = true;
            }
          }
        });
        
        if (shouldResize) {
          animationFrameResize();
        }
      });
      
      mutationObserver.observe(containerRef.current, {
        attributes: true,
        attributeFilter: ['style', 'class'],
        subtree: false
      });
    }

    const handleGridLayoutResize = () => {
      animationFrameResize();
    };

    document.addEventListener('react-grid-layout-resize', handleGridLayoutResize);
    document.addEventListener('react-grid-layout-drag', handleGridLayoutResize);
    window.addEventListener('resize', debouncedResize);

    return () => {
      if (observer && containerRef.current) {
        observer.unobserve(containerRef.current);
        observer.disconnect();
      }
      
      if (mutationObserver) {
        mutationObserver.disconnect();
      }
      
      document.removeEventListener('react-grid-layout-resize', handleGridLayoutResize);
      document.removeEventListener('react-grid-layout-drag', handleGridLayoutResize);
      window.removeEventListener('resize', debouncedResize);
      
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [debouncedResize, animationFrameResize, isHtmlContent]);

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

  // NOW we can do the early return AFTER all hooks are called
  if (isHtmlContent) {
    return (
      <div 
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%', 
          overflow: 'auto',
          padding: '0',
        }}
      >
        <div
          dangerouslySetInnerHTML={{ __html: options.html || '' }}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </div>
    );
  }

  // Regular Highcharts rendering
  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: "100%", 
        height: "100%",
        minHeight: "150px",
        overflow: "hidden",
        position: "relative"
      }}
    >
      <HighchartsReact
        highcharts={Highcharts}
        options={enhancedOptions}
        ref={chartComponentRef}
        callback={handleChartCallback}
        containerProps={{ 
          style: { 
            width: "100%", 
            height: "100%",
            position: "absolute",
            top: 0,
            left: 0
          } 
        }}
      />
    </div>
  );
};

// 🔥 PERFORMANCE: Optimized comparison function for React.memo
// Uses quick checks before expensive JSON.stringify
const arePropsEqual = (prevProps: ResizableChartProps, nextProps: ResizableChartProps): boolean => {
  // Quick check: showExport
  if (prevProps.showExport !== nextProps.showExport) {
    return false;
  }

  // Quick check: both undefined or null
  if (!prevProps.options && !nextProps.options) {
    return true;
  }
  if (!prevProps.options || !nextProps.options) {
    return false;
  }

  // Quick check: HTML content - just compare strings
  if (prevProps.options.type === 'html' || nextProps.options.type === 'html') {
    return prevProps.options.html === nextProps.options.html;
  }

  // Quick check: compare series data length first (fast fail)
  const prevSeries = (prevProps.options as any).series;
  const nextSeries = (nextProps.options as any).series;
  if (Array.isArray(prevSeries) && Array.isArray(nextSeries)) {
    if (prevSeries.length !== nextSeries.length) {
      return false;
    }
    // Check first series data length
    if (prevSeries[0]?.data?.length !== nextSeries[0]?.data?.length) {
      return false;
    }
  }

  // Quick check: compare title
  const prevTitle = (prevProps.options as any).title?.text;
  const nextTitle = (nextProps.options as any).title?.text;
  if (prevTitle !== nextTitle) {
    return false;
  }

  // Only do expensive JSON comparison if quick checks pass
  const prevWithoutRefresh = { ...prevProps.options };
  const nextWithoutRefresh = { ...nextProps.options };
  delete (prevWithoutRefresh as any)._lastRefresh;
  delete (nextWithoutRefresh as any)._lastRefresh;

  return JSON.stringify(prevWithoutRefresh) === JSON.stringify(nextWithoutRefresh);
};

// Memoized version to prevent unnecessary re-renders
const ResizableChart = React.memo(ResizableChartInner, arePropsEqual);

export default ResizableChart;