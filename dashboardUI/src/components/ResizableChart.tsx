import React, { useEffect, useRef, useCallback } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";

// Use require for modules to avoid TypeScript issues
const HighchartsExporting = require('highcharts/modules/exporting');
const HighchartsExportData = require('highcharts/modules/export-data');
const HighchartsOfflineExporting = require('highcharts/modules/offline-exporting');


// Initialize modules - wrap in try-catch and use type assertion
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

interface ResizableChartProps {
  options: Highcharts.Options;
  showExport?: boolean; // Add prop to control export visibility
}

const ResizableChart: React.FC<ResizableChartProps> = ({ options, showExport = false }) => {
  const chartComponentRef = useRef<HighchartsReact.RefObject>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  // More aggressive resize function for real-time updates
  const forceChartResize = useCallback(() => {
    if (chartComponentRef.current?.chart && containerRef.current) {
      const container = containerRef.current;
      const currentWidth = container.offsetWidth;
      const currentHeight = container.offsetHeight;
      
      // Only resize if dimensions actually changed and are valid
      if (currentWidth > 0 && currentHeight > 0 && 
          (currentWidth !== lastSizeRef.current.width || 
           currentHeight !== lastSizeRef.current.height)) {
        
        lastSizeRef.current = { width: currentWidth, height: currentHeight };
        
        try {
          // Force immediate resize
          chartComponentRef.current.chart.setSize(currentWidth, currentHeight, false);
          chartComponentRef.current.chart.reflow();
        } catch (error) {
          console.warn('Chart resize error:', error);
        }
      }
    }
  }, []);

  // Debounced version for less frequent updates
  const debouncedResize = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      forceChartResize();
    }, 50); // Faster debounce for better responsiveness
  }, [forceChartResize]);

  // Animation frame based resize for smooth updates during drag/resize
  const animationFrameResize = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    animationFrameRef.current = requestAnimationFrame(() => {
      forceChartResize();
    });
  }, [forceChartResize]);

  useEffect(() => {
    let observer: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;

    if (containerRef.current) {
      // ResizeObserver with immediate updates
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            // Use animation frame for immediate visual updates
            animationFrameResize();
            // Also use debounced version as backup
            debouncedResize();
          }
        }
      });
      observer.observe(containerRef.current);

      // MutationObserver for style changes (important for grid layout)
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
        subtree: false // Only observe the immediate container
      });
    }

    // Listen for React Grid Layout specific events
    const handleGridLayoutResize = () => {
      animationFrameResize();
    };

    // Custom event listeners for grid layout
    document.addEventListener('react-grid-layout-resize', handleGridLayoutResize);
    document.addEventListener('react-grid-layout-drag', handleGridLayoutResize);
    
    // Window resize as fallback
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
  }, [debouncedResize, animationFrameResize]);

  // Handle chart creation
  const handleChartCallback = useCallback((chart: Highcharts.Chart) => {
    // Force initial sizing after a brief delay
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

  // Enhanced options for better responsiveness and export functionality
  const enhancedOptions = React.useMemo(() => ({
    ...options,
    chart: {
      ...options.chart,
      animation: false, // Disable for better performance during resize
      reflow: true,
      backgroundColor: 'transparent',
      style: {
        fontFamily: 'inherit',
      },
    },
    credits: {
      enabled: false, // Remove Highcharts.com copyright
      ...options.credits,
    },
    // Export configuration - only enabled when showExport is true
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
      // Use chart title as filename if available
      filename: options.title?.text ? 
        (typeof options.title.text === 'string' ? options.title.text.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'chart') 
        : 'chart',
      // Merge with user-provided exporting options
      ...options.exporting,
    } : {
      enabled: false, // Disable export button when showExport is false
    },
    // Responsive configuration
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
  }), [options, showExport]);

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