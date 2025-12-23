import { useRef, useCallback } from 'react';
import { TooltipCardRef } from '../components/TooltipCard';

export interface UseTooltipCardOptions {
  offset?: { x: number; y: number };
}

export function useTooltipCard(options: UseTooltipCardOptions = {}) {
  const tooltipRef = useRef<TooltipCardRef>(null);
  const { offset = { x: 10, y: 10 } } = options;
  
  const showTooltip = useCallback((
    event: MouseEvent | React.MouseEvent | { clientX: number; clientY: number },
    data?: any
  ) => {
    if (tooltipRef.current) {
      const x = 'clientX' in event ? event.clientX : 0;
      const y = 'clientY' in event ? event.clientY : 0;
      
      tooltipRef.current.show({ x, y }, data);
    }
  }, []);
  
  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.hide();
    }
  }, []);
  
  // Extract point data from Highcharts point object
  const extractPointData = useCallback((point: any) => {
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
      // Include any custom properties
      options: point.options,
    };
  }, []);
  
  // Create Highcharts event handlers
  const createHighchartsEventHandlers = useCallback(() => {
    return {
      mouseOver: function(this: any, e: any) {
        const point = this;
        const pointData = extractPointData(point);
        
        // Get mouse position from the event
        const mouseEvent = e.target?.ownerDocument?.defaultView?.event || window.event;
        const clientX = mouseEvent?.clientX || e.chartX || 0;
        const clientY = mouseEvent?.clientY || e.chartY || 0;
        
        showTooltip({ clientX, clientY }, pointData);
      },
      mouseOut: function(this: any) {
        hideTooltip();
      },
    };
  }, [showTooltip, hideTooltip, extractPointData]);
  
  return {
    tooltipRef,
    showTooltip,
    hideTooltip,
    extractPointData,
    createHighchartsEventHandlers,
    isVisible: tooltipRef.current?.isVisible ?? false,
  };
}

export default useTooltipCard;

