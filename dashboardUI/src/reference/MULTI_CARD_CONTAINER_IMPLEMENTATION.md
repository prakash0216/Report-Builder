# Multi-Card Container Implementation Guide

## Overview

The Multi-Card Container feature allows you to create a parent card that can hold up to **4 child cards** inside it. Each child card can be a **chart**, **table**, or **HTML** visualization. This enables:

- **Composite Visualizations**: Multiple related visuals in a single card
- **Shared Local Filters**: One filter panel that affects all child cards
- **Scrollable Content**: When child cards exceed the parent size, scrolling is enabled
- **Flexible Layouts**: Predefined presets (2x2 grid, side-by-side, stacked) or custom positioning

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────────┐
│  ParentCardContainer                                             │
│  ┌─────────────────────────────┬─────────────────────────────┐  │
│  │  ChildCard (Chart)          │  ChildCard (Table)          │  │
│  │                             │                             │  │
│  │                             │                             │  │
│  ├─────────────────────────────┼─────────────────────────────┤  │
│  │  ChildCard (HTML)           │  ChildCard (Chart)          │  │
│  │                             │                             │  │
│  │                             │                             │  │
│  └─────────────────────────────┴─────────────────────────────┘  │
│  [Local Filter Button]  [Edit Button]  [Close Button]           │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
dashboardUI/src/
├── recoil/
│   └── ChildCardState.ts          # State management for child cards
├── components/
│   ├── ChildCard.tsx              # Individual child card renderer
│   ├── ChildCardConfigTab.tsx     # Configuration UI in Chart Editor
│   └── ParentCardContainer.tsx    # Parent container component
└── reference/
    └── MULTI_CARD_CONTAINER_IMPLEMENTATION.md  # This file
```

---

## State Structure

### `ChildCardState.ts`

```typescript
// Layout for each child card (relative positioning)
interface ChildCardLayout {
  id: string;       // Unique ID (e.g., "child-1")
  x: number;        // X position (0-1 scale, 0=left, 0.5=middle)
  y: number;        // Y position (0-1 scale, 0=top, 0.5=middle)
  w: number;        // Width (0-1 scale, 1=full width, 0.5=half)
  h: number;        // Height (0-1 scale, 1=full height, 0.5=half)
}

// Configuration for a single child card
interface ChildCardConfig {
  id: string;
  type: 'chart' | 'table' | 'html';
  
  // For chart type
  template?: string;                  // Highcharts JSON with ${variables}
  
  // For table type
  tableDataSource?: string;           // Variable name containing data
  tableSettings?: TableSettings;      // Table display settings
  
  // For HTML type
  htmlContent?: string;               // HTML with {{variables}}
  
  // Display settings
  title?: string;
  showTitle?: boolean;
  
  layout: ChildCardLayout;
}

// Parent card container configuration
interface ParentCardConfig {
  isContainer: boolean;               // Enable container mode
  containerLayout: 'grid' | 'vertical' | 'horizontal' | 'custom';
  childCards: ChildCardConfig[];      // Array of child cards (max 4)
  enableScroll: boolean;              // Enable scrolling
  gap: number;                        // Gap between cards (pixels)
}
```

---

## Layout Presets

The system provides 6 predefined layout presets:

| Preset | Cards | Description |
|--------|-------|-------------|
| `single` | 1 | Full-size single card |
| `twoHorizontal` | 2 | Side by side (50% width each) |
| `twoVertical` | 2 | Stacked vertically (50% height each) |
| `threeTopOne` | 3 | 1 full-width top, 2 half-width bottom |
| `threeBottomOne` | 3 | 2 half-width top, 1 full-width bottom |
| `fourGrid` | 4 | 2×2 grid (25% each) |

### Layout Examples

```javascript
// 2x2 Grid Layout
LAYOUT_PRESETS.fourGrid = [
  { id: 'child-1', x: 0, y: 0, w: 0.5, h: 0.5 },    // Top-left
  { id: 'child-2', x: 0.5, y: 0, w: 0.5, h: 0.5 },  // Top-right
  { id: 'child-3', x: 0, y: 0.5, w: 0.5, h: 0.5 },  // Bottom-left
  { id: 'child-4', x: 0.5, y: 0.5, w: 0.5, h: 0.5 } // Bottom-right
];

// Side by Side Layout
LAYOUT_PRESETS.twoHorizontal = [
  { id: 'child-1', x: 0, y: 0, w: 0.5, h: 1 },      // Left half
  { id: 'child-2', x: 0.5, y: 0, w: 0.5, h: 1 }     // Right half
];
```

---

## Usage Guide

### Step 1: Create a Card in Dashboard

1. Go to the dashboard in Edit Mode
2. Click **"+ Add New Card"** to create a new card
3. Click **"Configure"** or the edit icon on the card

### Step 2: Enable Multi-Card Container

1. In the Chart Editor, click on the **"Multi-Card"** tab
2. Toggle **"Enable Multi-Card Container"** to ON
3. A default single child card will be created

### Step 3: Choose a Layout

1. In the **"Layout Presets"** section, select your desired layout:
   - 1 Card (full)
   - 2 Side by Side
   - 2 Stacked
   - 1 Top + 2 Bottom
   - 2 Top + 1 Bottom
   - 2×2 Grid

### Step 4: Configure Each Child Card

1. In the **"Child Cards"** section, click on a child card to select it
2. In **"Configure: Card X"**, set:
   - **Title**: Optional display title
   - **Show Title Bar**: Toggle title visibility
   - **Content Type**: Chart, Table, or HTML

#### For Chart Type:
```json
{
  "chart": { "type": "bar" },
  "title": { "text": "Sales by Region" },
  "xAxis": { "categories": ${regionNames} },
  "series": [{ 
    "name": "Sales", 
    "data": ${salesData} 
  }],
  "credits": { "enabled": false }
}
```

#### For Table Type:
Select a data source variable (array of objects) from the dropdown.

#### For HTML Type:
```html
<div style="padding: 16px; text-align: center;">
  <h2 style="color: #667eea;">Total Sales</h2>
  <p style="font-size: 48px; font-weight: bold; color: #10b981;">
    ${{totalSales}}
  </p>
  <p style="color: #6b7280;">Last updated: {{lastUpdated}}</p>
</div>
```

### Step 5: Fine-tune Layout (Optional)

For custom positioning, use the sliders:
- **X Position**: 0 (left) to 0.75 (right edge)
- **Y Position**: 0 (top) to 1.5 (allows scrolling)
- **Width**: 0.25 (quarter) to 1 (full)
- **Height**: 0.25 (quarter) to 1 (full)

### Step 6: Preview and Save

The live preview on the right shows your configuration in real-time. Configuration is auto-saved.

---

## Variable References

Use variables from hooks/calculations in your child cards:

| Syntax | Use Case | Example |
|--------|----------|---------|
| `${varName}` | JSON templates (charts) | `"data": ${salesData}` |
| `{{varName}}` | HTML templates | `<p>{{totalRevenue}}</p>` |

---

## Example: Sales Dashboard Container

### Scenario
Create a 2×2 grid with:
1. **Top-left**: Bar chart showing sales by region
2. **Top-right**: KPI card showing total revenue
3. **Bottom-left**: Table with order details
4. **Bottom-right**: Pie chart showing category distribution

### Configuration

```javascript
// Parent Card Config
{
  isContainer: true,
  containerLayout: 'grid',
  enableScroll: false,
  gap: 8,
  childCards: [
    {
      id: 'child-1',
      type: 'chart',
      title: 'Sales by Region',
      showTitle: true,
      layout: { x: 0, y: 0, w: 0.5, h: 0.5 },
      template: `{
        "chart": { "type": "bar" },
        "title": { "text": null },
        "xAxis": { "categories": \${regionNames} },
        "series": [{ "name": "Sales", "data": \${regionSales} }],
        "credits": { "enabled": false }
      }`
    },
    {
      id: 'child-2',
      type: 'html',
      title: 'Total Revenue',
      showTitle: true,
      layout: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      htmlContent: `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px;">
          <p style="font-size: 14px; opacity: 0.9; margin: 0;">Total Revenue</p>
          <p style="font-size: 42px; font-weight: 700; margin: 8px 0;">$\{{totalRevenue}}</p>
          <p style="font-size: 12px; color: #a5f3fc;">↑ \{{revenueGrowth}}% from last month</p>
        </div>
      `
    },
    {
      id: 'child-3',
      type: 'table',
      title: 'Recent Orders',
      showTitle: true,
      layout: { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      tableDataSource: 'recentOrders'
    },
    {
      id: 'child-4',
      type: 'chart',
      title: 'Category Distribution',
      showTitle: true,
      layout: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      template: `{
        "chart": { "type": "pie" },
        "title": { "text": null },
        "plotOptions": { "pie": { "innerSize": "60%" } },
        "series": [{ 
          "name": "Sales", 
          "data": \${categoryDistribution}
        }],
        "credits": { "enabled": false }
      }`
    }
  ]
}
```

---

## Scrolling Behavior

When **Enable Scrolling** is ON:
- Child cards can be positioned beyond y=1.0
- The parent container shows a scrollbar
- Useful for dashboards with many small visualizations

### Example: Scrollable List
```javascript
// 4 cards stacked vertically (requires scrolling)
{
  enableScroll: true,
  gap: 8,
  childCards: [
    { id: 'child-1', layout: { x: 0, y: 0, w: 1, h: 0.5 } },
    { id: 'child-2', layout: { x: 0, y: 0.5, w: 1, h: 0.5 } },
    { id: 'child-3', layout: { x: 0, y: 1.0, w: 1, h: 0.5 } },
    { id: 'child-4', layout: { x: 0, y: 1.5, w: 1, h: 0.5 } }
  ]
}
```

---

## Database Schema

```sql
CREATE TABLE child_card_configs (
  id INTEGER PRIMARY KEY,
  parent_card_id TEXT UNIQUE NOT NULL,
  is_container BOOLEAN DEFAULT FALSE,
  container_layout TEXT DEFAULT 'grid',
  child_cards_json TEXT,           -- JSON array of ChildCardConfig
  enable_scroll BOOLEAN DEFAULT TRUE,
  gap INTEGER DEFAULT 8,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_modified TIMESTAMP
);
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/child-card-configs` | Fetch all container configs |
| POST | `/api/child-card-configs` | Save/update container config |
| DELETE | `/api/child-card-configs/:parentCardId` | Delete container config |

### POST Request Body
```json
{
  "parentCardId": "chart-1",
  "config": {
    "isContainer": true,
    "containerLayout": "grid",
    "childCards": [...],
    "enableScroll": true,
    "gap": 8
  }
}
```

---

## Key Features

### ✅ No Shadow Between Child Cards
Child cards have minimal borders with no drop shadows, creating a clean, unified look.

### ✅ Shared Local Filters
The parent card's filter button controls filters that apply to all child cards inside.

### ✅ Responsive Resizing
When the parent card is resized in the dashboard, all child cards proportionally resize.

### ✅ Variable Support
All child cards support variable interpolation (`${var}` and `{{var}}`) from hooks and calculations.

### ✅ Live Preview
Changes in the configuration tab are immediately visible in the preview panel.

---

## Troubleshooting

### Child cards not rendering
- Ensure `isContainer` is `true`
- Check that `childCards` array has at least one item
- Verify the chart template is valid JSON

### Variables not replaced
- Use `${varName}` for JSON (charts)
- Use `{{varName}}` for HTML
- Ensure the variable exists in hooks/calculations

### Layout looks wrong
- Check that x + w ≤ 1 and y + h ≤ 1 (unless scrolling)
- Use layout presets for common arrangements
- The gap value affects available space for children

---

## Component Reference

### ParentCardContainer

```tsx
<ParentCardContainer
  parentCardId="chart-1"
  config={parentCardConfig}
  showExport={true}
/>
```

### ChildCard

```tsx
<ChildCard
  config={childCardConfig}
  parentWidth={800}
  parentHeight={600}
  gap={8}
  showExport={false}
/>
```

---

## Best Practices

1. **Start with presets**: Use layout presets, then customize if needed
2. **Keep it simple**: 2-4 cards work best; more can be overwhelming
3. **Consistent types**: Mix chart + HTML for KPI dashboards
4. **Use titles**: Enable titles for clarity when multiple cards exist
5. **Test scrolling**: If using y > 1.0, ensure scrolling is enabled
6. **Variable naming**: Use clear, descriptive variable names

