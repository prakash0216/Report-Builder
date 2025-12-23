# React Portal Tooltip Implementation for Highcharts

## Overview

This document explains the complete implementation of a **React Portal-based Tooltip System** for Highcharts that allows rendering any React component (Chart, Table, or HTML) as a tooltip when hovering over chart data points.

## The Problem

Highcharts tooltip formatter expects a string or HTML string to be returned:

```javascript
// This DOES NOT work - Highcharts expects a string
tooltip: {
  formatter: function() {
    return <MyReactComponent data={this.point} />  // ❌ Won't work!
  }
}
```

Since the chart configuration is stored as JSON (without functions), we cannot use traditional React component rendering in the formatter.

## The Solution: React Portal

React Portal allows us to render a React component outside of its parent DOM hierarchy, directly into `document.body`. This enables:

1. **Complete JSON config** - No functions needed in the Highcharts config
2. **Full React component rendering** - Use any React component as tooltip
3. **Data passing** - Pass point data from Highcharts to the React component
4. **Positioning** - Tooltip follows mouse position automatically

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Main Chart Component                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  ChartWithTooltip / ResizableChart                             │     │
│  │  - Renders Highcharts chart                                    │     │
│  │  - Injects mouseOver/mouseOut event handlers                   │     │
│  │  - Disables default Highcharts tooltip when custom enabled     │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              │ Point Events                              │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  Event Handlers                                                 │     │
│  │  - mouseOver: Extract point data, show tooltip                 │     │
│  │  - mouseOut: Hide tooltip                                       │     │
│  └────────────────────────────────────────────────────────────────┘     │
│                              │                                           │
│                              │ tooltipRef.show(position, data)          │
│                              ▼                                           │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │  TooltipCard Component (React Portal)                          │     │
│  │  - Renders into document.body via createPortal                 │     │
│  │  - Reads tooltip config from Recoil state                      │     │
│  │  - Renders Chart/Table/HTML based on config.type               │     │
│  │  - Applies data mapping to template variables                  │     │
│  │  - Positions at mouse coordinates                               │     │
│  └────────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
dashboardUI/src/
├── components/
│   ├── TooltipCard.tsx          # Portal-based tooltip component
│   ├── TooltipConfigTab.tsx     # UI for configuring tooltips
│   ├── ChartWithTooltip.tsx     # Chart component with tooltip integration
│   └── DataInitializer.tsx      # Updated to load tooltip configs
├── recoil/
│   └── TooltipConfigState.ts    # Recoil state for tooltip configurations
├── hooks/
│   └── useTooltipCard.ts        # Hook for tooltip management
└── reference/
    └── REACT_PORTAL_TOOLTIP_IMPLEMENTATION.md  # This file

backend/
├── db/
│   └── initDb.js                # Updated with tooltip_configs table
└── server.js                    # API endpoints for tooltip configs
```

---

## Implementation Details

### 1. Tooltip Configuration State (`TooltipConfigState.ts`)

```typescript
export interface TooltipConfig {
  enabled: boolean;
  type: 'chart' | 'table' | 'html' | 'card';
  
  // For 'card' type - reference existing dashboard card
  cardId?: string;
  
  // For 'chart' type - inline chart config
  chartTemplate?: string;
  
  // For 'table' type
  tableDataSource?: string;
  tableSettings?: any;
  
  // For 'html' type
  htmlTemplate?: string;
  
  // Data mapping - how to pass data from main chart to tooltip
  dataMapping: TooltipDataMapping[];
  
  // Appearance
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  hideDelay: number;
  showHeader: boolean;
  headerTitle?: string;
}
```

### 2. TooltipCard Component (`TooltipCard.tsx`)

The core component that renders the tooltip using React Portal:

```tsx
// Key implementation points:

// 1. Use createPortal to render outside React tree
return createPortal(
  <Box sx={{ position: 'fixed', left: x, top: y, zIndex: 99999 }}>
    {renderContent()}
  </Box>,
  document.body
);

// 2. Expose show/hide methods via ref
useImperativeHandle(ref, () => ({
  show: (position, data) => { /* ... */ },
  hide: () => { /* ... */ },
  isVisible,
}));

// 3. Render content based on type
const renderContent = () => {
  switch (tooltipConfig.type) {
    case 'chart': return <ResizableChart options={...} />;
    case 'table': return <DashboardTable dataSource={...} />;
    case 'html': return <div dangerouslySetInnerHTML={...} />;
    case 'card': return /* render existing card */;
  }
};
```

### 3. Chart Integration (`ChartWithTooltip.tsx`)

Integrates Highcharts with the tooltip system:

```tsx
// Inject point events into chart options
const enhancedOptions = useMemo(() => ({
  ...options,
  tooltip: { enabled: false }, // Disable default tooltip
  plotOptions: {
    series: {
      point: {
        events: {
          mouseOver: function(e) {
            tooltipRef.current?.show(
              { x: e.clientX, y: e.clientY },
              extractPointData(this)
            );
          },
          mouseOut: function() {
            tooltipRef.current?.hide();
          },
        },
      },
    },
  },
}), [options]);
```

---

## Data Flow

### 1. Configuration Flow

```
User configures tooltip in UI
        ↓
TooltipConfigTab updates Recoil state
        ↓
Recoil effect saves to backend API
        ↓
Backend stores in tooltip_configs table
```

### 2. Runtime Flow

```
User hovers over chart point
        ↓
Highcharts fires mouseOver event
        ↓
Event handler extracts point data:
  - x, y values
  - category name
  - series name
  - color, percentage, etc.
        ↓
tooltipRef.show(position, pointData)
        ↓
TooltipCard receives data
        ↓
Data mapping applied:
  { sourceKey: 'category', targetVariable: 'filterCategory' }
        ↓
Variables replaced in template:
  "{{filterCategory}}" → "Category A"
        ↓
Content rendered via Portal
```

---

## Usage Examples

### Example 1: HTML Tooltip with Point Data

**Configuration:**
```json
{
  "enabled": true,
  "type": "html",
  "htmlTemplate": "<div style='padding: 16px;'><h3>{{category}}</h3><p>Value: {{y}}</p><p>Series: {{series.name}}</p></div>",
  "dataMapping": [],
  "width": 300,
  "height": 200
}
```

**Result:** When hovering over a bar in a bar chart, shows:
```
┌─────────────────────┐
│ Category A          │
│ Value: 42.5         │
│ Series: Sales       │
└─────────────────────┘
```

### Example 2: Chart Tooltip

**Configuration:**
```json
{
  "enabled": true,
  "type": "chart",
  "chartTemplate": "{\"chart\":{\"type\":\"pie\"},\"title\":{\"text\":\"${category} Breakdown\"},\"series\":[{\"data\":${breakdownData}}]}",
  "dataMapping": [
    { "sourceKey": "category", "targetVariable": "category" },
    { "sourceKey": "options.breakdown", "targetVariable": "breakdownData" }
  ],
  "width": 400,
  "height": 300
}
```

**Result:** Hovering shows a pie chart with data specific to the hovered point.

### Example 3: Table Tooltip

**Configuration:**
```json
{
  "enabled": true,
  "type": "table",
  "tableDataSource": "detailData",
  "tableSettings": {
    "displayMode": "scroll",
    "showHeader": true
  },
  "width": 500,
  "height": 300
}
```

**Result:** Shows a table with detailed data when hovering.

### Example 4: Existing Card as Tooltip

**Configuration:**
```json
{
  "enabled": true,
  "type": "card",
  "cardId": "chart-detail-breakdown",
  "width": 450,
  "height": 350
}
```

**Result:** Renders an existing dashboard card (identified by `chart-detail-breakdown`) as the tooltip.

---

## Available Point Data Keys

When a user hovers over a Highcharts point, the following data is available:

| Key | Description | Example |
|-----|-------------|---------|
| `x` | X-axis value | `0`, `1`, `"2024-01"` |
| `y` | Y-axis value | `42.5` |
| `name` | Point name (for pie charts) | `"Category A"` |
| `category` | X-axis category name | `"January"` |
| `color` | Point color | `"#667eea"` |
| `percentage` | Percentage (for pie charts) | `25.5` |
| `total` | Total value (for stacked charts) | `100` |
| `index` | Point index in series | `0` |
| `series.name` | Series name | `"Sales"` |
| `series.index` | Series index | `0` |
| `series.type` | Series type | `"bar"` |
| `options` | Raw point options | `{ custom: "data" }` |

---

## Template Variable Syntax

### For JSON/Chart Templates

Use `${variableName}` syntax:

```json
{
  "title": { "text": "Details for ${category}" },
  "series": [{ "data": "${seriesData}" }]
}
```

### For HTML Templates

Use `{{variableName}}` or `${variableName}` syntax:

```html
<div>
  <h3>{{category}}</h3>
  <p>Value: {{y}}</p>
  <p>Percentage: ${percentage}%</p>
</div>
```

---

## Database Schema

```sql
CREATE TABLE tooltip_configs (
  id INTEGER PRIMARY KEY,
  chart_id TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  type TEXT NOT NULL CHECK (type IN ('chart', 'table', 'html', 'card')),
  card_id TEXT,
  chart_template TEXT,
  table_data_source TEXT,
  table_settings_json TEXT,
  html_template TEXT,
  data_mapping_json TEXT,
  width INTEGER DEFAULT 400,
  height INTEGER DEFAULT 300,
  offset_x INTEGER DEFAULT 10,
  offset_y INTEGER DEFAULT 10,
  show_on_hover BOOLEAN DEFAULT true,
  hide_delay INTEGER DEFAULT 200,
  show_header BOOLEAN DEFAULT true,
  header_title TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tooltip-configs` | Get all tooltip configs |
| GET | `/api/tooltip-configs/:chartId` | Get tooltip config for specific chart |
| POST | `/api/tooltip-configs` | Save tooltip config |
| DELETE | `/api/tooltip-configs/:chartId` | Delete tooltip config |

---

## UI Configuration

The tooltip configuration is available in the **Chart Editor** under the **"Tooltip Config"** tab:

1. **Enable/Disable** - Toggle tooltip on/off
2. **Type Selection** - Choose Chart, Table, HTML, or Card
3. **Content Configuration** - Configure the tooltip content based on type
4. **Data Mapping** - Map point data to template variables
5. **Appearance** - Set width, height, offsets, header, etc.
6. **Live Preview** - See tooltip preview with sample data

---

## Best Practices

1. **Performance**: Use React.memo for tooltip content components
2. **Positioning**: Tooltip automatically adjusts to stay within viewport
3. **Z-Index**: Uses z-index 99999 to appear above all elements
4. **Animation**: Smooth fade-in animation for better UX
5. **Cleanup**: Tooltip hides on mouseOut with configurable delay
6. **Accessibility**: Header includes close button for keyboard users

---

## Troubleshooting

### Tooltip not showing

1. Check if tooltip is enabled in configuration
2. Verify the chart ID matches
3. Check browser console for errors

### Data not appearing in template

1. Verify data mapping is correct
2. Check that source key exists in point data
3. Use the preview panel to test with sample data

### Tooltip positioning issues

1. Adjust offsetX and offsetY values
2. Check if tooltip width/height are too large

---

## Future Enhancements

1. **Pinnable Tooltips** - Allow users to pin tooltips to stay visible
2. **Multiple Tooltips** - Support showing multiple tooltips simultaneously
3. **Animations** - Add more animation options (slide, scale, etc.)
4. **Themes** - Support dark/light theme variants
5. **Touch Support** - Better mobile/touch device support

