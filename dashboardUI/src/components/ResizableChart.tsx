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

const ResizableChart: React.FC<ResizableChartProps> = ({ options, showExport = false }) => {
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
    return {
      ...options,
      chart: {
        ...options.chart,
        animation: false,
        reflow: true,
        backgroundColor: 'transparent',
        style: {
          fontFamily: 'inherit',
        },
      },
      credits: {
        enabled: false,
        ...options.credits,
      },
      exporting: showExport ? {
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
              fill: 'transparent',
              stroke: '#cccccc',
              states: {
                hover: {
                  fill: '#f0f0f0',
                },
                select: {
                  fill: '#e0e0e0',
                }
              }
            }
          },
        },
        filename: options.title?.text ? 
          (typeof options.title.text === 'string' ? options.title.text.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'chart') 
          : 'chart',
        ...options.exporting,
      } : {
        enabled: false,
      },
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

export default ResizableChart;