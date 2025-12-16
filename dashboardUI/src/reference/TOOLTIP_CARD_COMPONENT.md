# Tooltip Card Component Implementation Guide

## Overview

This document explains how to implement a **Tooltip Card Component** feature where an existing dashboard card (Table, Chart, or HTML) can be rendered as a tooltip within another card's chart formatter.

## Use Case

When hovering over a data point in a Highcharts chart, instead of showing a simple text tooltip, you want to display a fully rendered dashboard card component (like a table, another chart, or HTML content).

```javascript
// Example usage in Highcharts formatter
formatter: function () {
    return <RBITooltip cardId="123" data={this.point} />
}
```

---

## Architecture

### Components Involved

1. **TooltipCard** - A wrapper component that renders any existing card as a tooltip
2. **CardRenderer** - Reusable component that renders Table/Chart/HTML based on config
3. **TooltipPortal** - React Portal to render tooltip outside the chart container
4. **useTooltipCard** - Custom hook to manage tooltip state and positioning

---

## Implementation Steps

### Step 1: Create the TooltipCard Component

```tsx
// dashboardUI/src/components/TooltipCard.tsx

import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRecoilValue } from 'recoil';
import { chartConfigState } from '../recoil/ChartConfig';
import { variableAtomFamily } from '../recoil/VariableFamily';
import DashboardTable from './DashboardTable';
import ResizableChart from './ResizableChart';

export interface TooltipCardProps {
  cardId: string;                    // ID of the card to render
  data?: any;                        // Data passed from the chart point
  position?: { x: number; y: number }; // Position for the tooltip
  width?: number;                    // Tooltip width (default: 400)
  height?: number;                   // Tooltip height (default: 300)
  onClose?: () => void;              // Callback when tooltip closes
}

export interface TooltipCardRef {
  show: (position: { x: number; y: number }, data?: any) => void;
  hide: () => void;
  isVisible: boolean;
}

const TooltipCard = forwardRef<TooltipCardRef, TooltipCardProps>(
  ({ cardId, data, position, width = 400, height = 300, onClose }, ref) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
    const [tooltipData, setTooltipData] = useState<any>(null);
    
    // Get card configuration from Recoil state
    const chartConfigs = useRecoilValue(chartConfigState);
    const cardConfig = chartConfigs[cardId];
    
    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      show: (pos: { x: number; y: number }, pointData?: any) => {
        setTooltipPosition(pos);
        setTooltipData(pointData);
        setIsVisible(true);
      },
      hide: () => {
        setIsVisible(false);
        onClose?.();
      },
      isVisible,
    }));

    if (!isVisible || !cardConfig) return null;

    const contentType = cardConfig.type || 'chart';

    // Render content based on card type
    const renderContent = () => {
      switch (contentType) {
        case 'table':
          return (
            <DashboardTable
              dataSource={cardConfig.tableDataSource}
              settings={cardConfig.tableSettings}
            />
          );
        
        case 'chart':
          // Parse and apply tooltip data to chart config
          const chartOptions = parseChartConfig(cardConfig.template, tooltipData);
          return <ResizableChart options={chartOptions} />;
        
        case 'html':
          return (
            <div 
              dangerouslySetInnerHTML={{ __html: cardConfig.htmlContent || '' }}
              style={{ width: '100%', height: '100%', overflow: 'auto' }}
            />
          );
        
        default:
          return null;
      }
    };

    // Create portal to render tooltip at document body level
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          width: width,
          height: height,
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          border: '1px solid #e2e8f0',
          zIndex: 99999,
          overflow: 'hidden',
          pointerEvents: 'auto',
        }}
        onMouseLeave={() => {
          setIsVisible(false);
          onClose?.();
        }}
      >
        {/* Header with close button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 12px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b' }}>
            {cardConfig.name || 'Details'}
          </span>
          <button
            onClick={() => {
              setIsVisible(false);
              onClose?.();
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1.25rem',
              color: '#64748b',
            }}
          >
            ×
          </button>
        </div>
        
        {/* Content area */}
        <div style={{ 
          width: '100%', 
          height: `calc(100% - 40px)`,
          overflow: 'hidden',
        }}>
          {renderContent()}
        </div>
      </div>,
      document.body
    );
  }
);

// Helper function to parse chart config with data
function parseChartConfig(template: string, data: any): Highcharts.Options {
  try {
    // Replace placeholders with actual data
    let processedTemplate = template;
    
    if (data) {
      // Replace {{key}} patterns with data values
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        processedTemplate = processedTemplate.replace(regex, JSON.stringify(data[key]));
      });
    }
    
    return JSON.parse(processedTemplate);
  } catch {
    return {};
  }
}

export default TooltipCard;
```

---

### Step 2: Create the useTooltipCard Hook

```tsx
// dashboardUI/src/hooks/useTooltipCard.ts

import { useRef, useCallback } from 'react';
import { TooltipCardRef } from '../components/TooltipCard';

export function useTooltipCard() {
  const tooltipRef = useRef<TooltipCardRef>(null);
  
  const showTooltip = useCallback((
    event: MouseEvent | React.MouseEvent,
    data?: any,
    offset: { x: number; y: number } = { x: 10, y: 10 }
  ) => {
    if (tooltipRef.current) {
      // Calculate position relative to viewport
      const x = (event as MouseEvent).clientX + offset.x;
      const y = (event as MouseEvent).clientY + offset.y;
      
      // Ensure tooltip stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const tooltipWidth = 400;
      const tooltipHeight = 300;
      
      const adjustedX = x + tooltipWidth > viewportWidth 
        ? x - tooltipWidth - offset.x * 2 
        : x;
      const adjustedY = y + tooltipHeight > viewportHeight 
        ? y - tooltipHeight - offset.y * 2 
        : y;
      
      tooltipRef.current.show({ x: adjustedX, y: adjustedY }, data);
    }
  }, []);
  
  const hideTooltip = useCallback(() => {
    if (tooltipRef.current) {
      tooltipRef.current.hide();
    }
  }, []);
  
  return {
    tooltipRef,
    showTooltip,
    hideTooltip,
    isVisible: tooltipRef.current?.isVisible ?? false,
  };
}
```

---

### Step 3: Integrate with Highcharts

```tsx
// Example: Using TooltipCard in a chart component

import React, { useRef } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import TooltipCard from './TooltipCard';
import { useTooltipCard } from '../hooks/useTooltipCard';

function ChartWithTooltipCard({ chartOptions, tooltipCardId }) {
  const chartRef = useRef<HighchartsReact.RefObject>(null);
  const { tooltipRef, showTooltip, hideTooltip } = useTooltipCard();
  
  // Modify chart options to use custom tooltip
  const modifiedOptions: Highcharts.Options = {
    ...chartOptions,
    tooltip: {
      enabled: false, // Disable default tooltip
    },
    plotOptions: {
      series: {
        point: {
          events: {
            mouseOver: function(e) {
              const point = this;
              showTooltip(e.target as unknown as MouseEvent, {
                x: point.x,
                y: point.y,
                name: point.name,
                category: point.category,
                series: point.series.name,
                // Add any other data you need
              });
            },
            mouseOut: function() {
              hideTooltip();
            },
          },
        },
      },
    },
  };
  
  return (
    <>
      <HighchartsReact
        ref={chartRef}
        highcharts={Highcharts}
        options={modifiedOptions}
      />
      <TooltipCard
        ref={tooltipRef}
        cardId={tooltipCardId}
        width={450}
        height={350}
      />
    </>
  );
}

export default ChartWithTooltipCard;
```

---

### Step 4: Configuration UI for Tooltip Card Selection

Add a configuration option in the chart editor to select which card to use as a tooltip:

```tsx
// Add to HighChartField.tsx or chart configuration section

<FormControl fullWidth size="small" sx={{ mt: 2 }}>
  <InputLabel>Tooltip Card</InputLabel>
  <Select
    value={selectedTooltipCardId || ''}
    label="Tooltip Card"
    onChange={(e) => setSelectedTooltipCardId(e.target.value)}
  >
    <MenuItem value="">
      <em>Default Tooltip</em>
    </MenuItem>
    {/* List all available cards */}
    {Object.entries(chartConfigs).map(([id, config]) => (
      <MenuItem key={id} value={id}>
        {config.name || id} ({config.type})
      </MenuItem>
    ))}
  </Select>
  <Typography variant="caption" color="#64748b" sx={{ mt: 0.5 }}>
    Select a card to display as tooltip when hovering over data points
  </Typography>
</FormControl>
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        Parent Chart                              │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Highcharts Component                                    │    │
│  │  - mouseOver event triggers showTooltip()               │    │
│  │  - Passes point data (x, y, name, category, etc.)       │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  useTooltipCard Hook                                     │    │
│  │  - Calculates position                                   │    │
│  │  - Manages visibility state                              │    │
│  │  - Calls tooltipRef.show(position, data)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  TooltipCard Component (Portal)                          │    │
│  │  - Fetches card config from Recoil (chartConfigState)   │    │
│  │  - Renders Table/Chart/HTML based on config.type        │    │
│  │  - Applies passed data to template                       │    │
│  │  - Positions at mouse coordinates                        │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Advanced: Dynamic Data Binding

To pass data from the hover point to the tooltip card (e.g., filter a table based on the hovered category):

### Option 1: Variable Injection

```tsx
// In TooltipCard, set a Recoil variable with the hover data
const setTooltipData = useSetRecoilState(variableAtomFamily('__tooltipData__'));

useEffect(() => {
  if (tooltipData) {
    setTooltipData(tooltipData);
  }
}, [tooltipData, setTooltipData]);
```

Then in the tooltip card's data source query, reference `{{__tooltipData__.category}}`.

### Option 2: Filter Application

```tsx
// Apply hover data as a filter to the tooltip card's data
const filteredData = useMemo(() => {
  if (!tooltipData?.category) return originalData;
  return originalData.filter(row => row.category === tooltipData.category);
}, [originalData, tooltipData]);
```

---

## Types

```typescript
// types/tooltipTypes.ts

export interface TooltipCardConfig {
  cardId: string;
  width?: number;
  height?: number;
  position?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  offset?: { x: number; y: number };
  showHeader?: boolean;
  headerTitle?: string;
  closeOnMouseLeave?: boolean;
  closeDelay?: number; // ms delay before closing
}

export interface TooltipDataContext {
  point: {
    x: number | string;
    y: number;
    name?: string;
    category?: string;
  };
  series: {
    name: string;
    index: number;
  };
  chart: {
    title?: string;
  };
}
```

---

## Best Practices

1. **Performance**: Use React.memo and useMemo to prevent unnecessary re-renders
2. **Positioning**: Always check viewport boundaries to prevent tooltip from going off-screen
3. **Accessibility**: Add keyboard navigation support for tooltip cards
4. **Loading States**: Show a loading indicator while tooltip content is being fetched
5. **Error Handling**: Gracefully handle cases where the card config doesn't exist
6. **Z-Index**: Use a high z-index (99999) to ensure tooltip appears above all other elements

---

## Example: Complete Integration

```tsx
// Complete example showing a chart with a table tooltip

import React from 'react';
import ChartWithTooltipCard from './ChartWithTooltipCard';

function SalesChart() {
  const chartOptions = {
    chart: { type: 'column' },
    title: { text: 'Sales by Region' },
    xAxis: { categories: ['North', 'South', 'East', 'West'] },
    series: [{
      name: 'Sales',
      data: [1200, 900, 1500, 800]
    }]
  };
  
  return (
    <ChartWithTooltipCard
      chartOptions={chartOptions}
      tooltipCardId="sales-detail-table" // ID of a table card configured in the dashboard
    />
  );
}
```

When hovering over a bar, the `sales-detail-table` card will appear as a tooltip, showing detailed data for that region.

---

## Future Enhancements

1. **Tooltip Animations**: Add fade-in/fade-out animations
2. **Pinnable Tooltips**: Allow users to pin tooltips so they stay visible
3. **Multiple Tooltips**: Support showing multiple tooltip cards simultaneously
4. **Responsive Sizing**: Auto-adjust tooltip size based on content
5. **Nested Tooltips**: Support tooltips within tooltip cards

