# Multi-Card Container Architecture: Complete Flow Documentation

This document explains the complete flow from the main dashboard's draggable/resizable cards to the child cards inside multi-card containers, including all scrolling and height behaviors.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Hierarchy](#component-hierarchy)
3. [Key Interfaces](#key-interfaces)
4. [Flow Diagram](#flow-diagram)
5. [Mode 1: No Scroll (Compress to Fit)](#mode-1-no-scroll-compress-to-fit)
6. [Mode 2: Scroll with Fixed Height](#mode-2-scroll-with-fixed-height)
7. [Mode 3: Scroll with Dynamic Height](#mode-3-scroll-with-dynamic-height)
8. [Dimension Propagation](#dimension-propagation)
9. [Configuration Settings](#configuration-settings)
10. [Visual Comparison](#visual-comparison)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DragDropDashboard.tsx                              │
│                    (Main Dashboard - React Grid Layout)                      │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                     Dashboard Card (Draggable/Resizable)                 │ │
│  │                              height: dynamic (based on grid units)       │ │
│  │                              width: dynamic (based on grid columns)      │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────────┐ │ │
│  │  │                    ParentCardContainer.tsx                          │ │ │
│  │  │                         height: 100% of parent                      │ │ │
│  │  │                         width: 100% of parent                       │ │ │
│  │  │                                                                     │ │ │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │ │ │
│  │  │  │ ChildCard 1 │  │ ChildCard 2 │  │ ChildCard 3 │  │ ChildCard 4 │ │ │ │
│  │  │  │   (Chart)   │  │   (Table)   │  │   (HTML)    │  │   (Chart)   │ │ │ │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │ │ │
│  │  │                                                                     │ │ │
│  │  └─────────────────────────────────────────────────────────────────────┘ │ │
│  │                                                                          │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Hierarchy

### 1. DragDropDashboard.tsx (Top Level)

**Role**: Main dashboard component that uses `react-grid-layout` for draggable/resizable cards.

**Key Responsibilities**:
- Renders the grid layout with multiple cards
- Detects if a card is a "container card" (multi-card)
- Passes the `ParentCardConfig` to `ParentCardContainer`
- Manages card visibility, positioning, and sizing

**Relevant Code** (`DragDropDashboard.tsx` lines ~1250-1260):
```tsx
{isContainerCard ? (
  <div style={{ flex: 1, minHeight: 0, maxHeight: '100%', overflow: 'hidden', position: 'relative' }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      <ParentCardContainer
        parentCardId={item.i}
        config={containerConfig}
        showExport={isEditMode ? false : true}
      />
    </div>
  </div>
) : (
  // Regular chart/table/html rendering
)}
```

**Important**: The parent div has `overflow: hidden` and uses absolute positioning to constrain the `ParentCardContainer` to the exact size of the dashboard card.

---

### 2. ParentCardContainer.tsx (Middle Level)

**Role**: Container that holds multiple child cards and manages scrolling behavior.

**Key Responsibilities**:
- Receives the `ParentCardConfig` from `DragDropDashboard`
- Measures its own dimensions using `ResizeObserver`
- Decides whether to enable scrolling based on `config.enableContainerScroll`
- Calculates content height (fixed or dynamic)
- Renders child cards with appropriate dimensions

**Props**:
```tsx
interface ParentCardContainerProps {
  parentCardId: string;       // ID of the dashboard card
  config: ParentCardConfig;   // Configuration including scroll settings
  showExport?: boolean;       // Whether to show export buttons
}
```

---

### 3. ChildCard.tsx (Bottom Level)

**Role**: Individual visualization card (chart, table, or HTML content).

**Key Responsibilities**:
- Receives dimensions from `ParentCardContainer`
- Renders the appropriate content type
- Handles variable substitution in templates
- Supports two rendering modes: positioned (for no-scroll) and full-size (for scroll)

**Props**:
```tsx
interface ChildCardProps {
  config: ChildCardConfig;      // Child card configuration
  parentWidth?: number;         // Width from parent
  parentHeight?: number;        // Height from parent
  gap?: number;                 // Gap between cards
  showExport?: boolean;         // Show export buttons
  isFullSizePreview?: boolean;  // 🔥 KEY: Determines rendering mode
}
```

---

## Key Interfaces

### ParentCardConfig (Stored in Recoil)

```tsx
interface ParentCardConfig {
  isContainer: boolean;           // Is this a multi-card container?
  containerLayout: 'grid' | 'vertical' | 'horizontal' | 'custom';
  childCards: ChildCardConfig[];  // Array of child cards (max 4)
  enableContainerScroll: boolean; // 🔥 Enable container-level scrolling
  cardMinHeight: number;          // Fixed content height (used when useDynamicHeight=false)
  gap: number;                    // Gap between child cards in pixels
  
  // 🔥 Dynamic Height Settings
  useDynamicHeight?: boolean;     // Enable dynamic height from variable
  heightDataSource?: string;      // Variable name containing calculated height
}
```

### ChildCardConfig

```tsx
interface ChildCardConfig {
  id: string;
  type: 'chart' | 'table' | 'html';
  template?: string;              // For chart type - Highcharts JSON with variables
  tableDataSource?: string;       // For table type - variable name
  tableSettings?: TableSettings;  // Table configuration
  htmlContent?: string;           // For HTML type - HTML with variables
  title?: string;
  showTitle?: boolean;
  layout: ChildCardLayout;        // Position and size within parent
}
```

### ChildCardLayout

```tsx
interface ChildCardLayout {
  id: string;
  x: number;  // X position (0-1 range, e.g., 0.5 = 50% from left)
  y: number;  // Y position (0-1 range)
  w: number;  // Width (0-1 range, e.g., 0.5 = 50% width)
  h: number;  // Height (0-1 range)
}
```

---

## Flow Diagram

```
User resizes dashboard card
         │
         ▼
┌─────────────────────────┐
│   DragDropDashboard     │
│   (Grid Layout)         │
│                         │
│   Card dimensions:      │
│   - width: grid cols    │
│   - height: grid rows   │
└───────────┬─────────────┘
            │
            │ Passes: config, parentCardId
            ▼
┌─────────────────────────────────────────────────────────┐
│                 ParentCardContainer                      │
│                                                          │
│   1. Measures container dimensions (ResizeObserver)      │
│   2. Checks config.enableContainerScroll                 │
│                                                          │
│   ┌─────────────────┐      ┌─────────────────────────┐   │
│   │  Scroll = OFF   │      │     Scroll = ON         │   │
│   │                 │      │                         │   │
│   │  No overflow    │      │  overflow: auto         │   │
│   │  Charts compress│      │                         │   │
│   │  to fit         │      │  ┌───────────────────┐  │   │
│   │                 │      │  │ useDynamicHeight? │  │   │
│   │                 │      │  └─────────┬─────────┘  │   │
│   │                 │      │            │            │   │
│   │                 │      │    ┌───────┴───────┐    │   │
│   │                 │      │   YES              NO   │   │
│   │                 │      │    │               │    │   │
│   │                 │      │    ▼               ▼    │   │
│   │                 │      │ Read height    Use      │   │
│   │                 │      │ from variable  cardMin  │   │
│   │                 │      │                Height   │   │
│   └─────────────────┘      └─────────────────────────┘   │
│                                                          │
└────────────────────────┬─────────────────────────────────┘
                         │
                         │ Passes: parentWidth, parentHeight, isFullSizePreview
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      ChildCard                           │
│                                                          │
│   ┌─────────────────┐      ┌─────────────────────────┐   │
│   │ isFullSizePreview│     │ isFullSizePreview       │   │
│   │ = false          │     │ = true                  │   │
│   │                  │     │                         │   │
│   │ Uses absolute    │     │ Uses 100% width/height  │   │
│   │ positioning with │     │ No positioning          │   │
│   │ calculated       │     │ Fills parent container  │   │
│   │ dimensions       │     │                         │   │
│   └─────────────────┘      └─────────────────────────┘   │
│                                                          │
│   Renders: Chart | Table | HTML                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Mode 1: No Scroll (Compress to Fit)

### Settings
- `enableContainerScroll`: **false**

### Behavior
1. `ParentCardContainer` renders with `overflow: hidden`
2. Child cards use **absolute positioning** based on their `layout` configuration
3. Charts **compress** to fit the available space
4. If you have 50 data points, they all squeeze into the visible area
5. Bars may appear very thin if there's a lot of data

### Code Flow

**ParentCardContainer.tsx** (lines 187-218):
```tsx
// 🔥 NO SCROLL MODE: Absolute positioning, charts compress to fit
return (
  <Box
    ref={containerRef}
    sx={{
      width: '100%',
      height: '100%',
      overflow: 'hidden',  // 🔥 No scrolling
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
          parentWidth={dimensions.width}
          parentHeight={dimensions.height}
          gap={config.gap}
          showExport={showExport}
          // 🔥 isFullSizePreview is NOT passed (defaults to false)
        />
      ))}
    </Box>
  </Box>
);
```

**ChildCard.tsx** - Dimension Calculation (lines 147-163):
```tsx
const dimensions = useMemo(() => {
  // 🔥 In full-size preview mode, don't calculate layout dimensions
  if (isFullSizePreview) {
    return { width: 0, height: 0, left: 0, top: 0 };
  }
  
  const { layout } = config;
  const availableWidth = parentWidth - (gap * 2);
  const availableHeight = parentHeight - (gap * 2);
  
  return {
    width: availableWidth * layout.w - (gap / 2),
    height: availableHeight * layout.h - (gap / 2),
    left: (availableWidth * layout.x) + gap,
    top: (availableHeight * layout.y) + gap,
  };
}, [config.layout, parentWidth, parentHeight, gap, isFullSizePreview]);
```

**ChildCard.tsx** - Rendering with Absolute Position (lines 455-472):
```tsx
return (
  <Box
    ref={containerRef}
    sx={{
      position: 'absolute',  // 🔥 Absolute positioning
      left: dimensions.left,
      top: dimensions.top,
      width: dimensions.width,
      height: dimensions.height,
      backgroundColor: 'white',
      borderRadius: '8px',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      border: '1px solid rgba(0, 0, 0, 0.06)',
    }}
  >
    {/* Content */}
  </Box>
);
```

### Visual Result

```
┌───────────────────────────────────────┐
│         Dashboard Card (400px)         │
│ ┌───────────────────────────────────┐ │
│ │      ParentCardContainer          │ │
│ │      height: 100% (400px)         │ │
│ │      overflow: hidden             │ │
│ │ ┌───────────────────────────────┐ │ │
│ │ │        ChildCard              │ │ │
│ │ │   All 50 bars compressed      │ │ │
│ │ │   into 400px                  │ │ │
│ │ │   ▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌▌ │ │ │
│ │ │   (very thin bars)            │ │ │
│ │ └───────────────────────────────┘ │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

---

## Mode 2: Scroll with Fixed Height

### Settings
- `enableContainerScroll`: **true**
- `useDynamicHeight`: **false**
- `cardMinHeight`: **800** (or any fixed value in pixels)

### Behavior
1. `ParentCardContainer` renders with `overflow: auto`
2. Inner content wrapper has **explicit height** = `cardMinHeight`
3. If `cardMinHeight` > visible container height → scrollbar appears
4. Charts render at full size with proper bar thickness
5. User scrolls to see all data

### Code Flow

**ParentCardContainer.tsx** (lines 126-185):
```tsx
// 🔥 CONTAINER SCROLL MODE
if (config.enableContainerScroll) {
  // 🔥 Use dynamic height if enabled, otherwise use cardMinHeight
  const contentHeight = calculatedHeight;  // Falls back to cardMinHeight when useDynamicHeight=false
  
  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: '100%',       // 🔥 Fixed to parent size (visible area)
        overflow: 'auto',     // 🔥 Enable scrolling
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
          height: contentHeight,  // 🔥 EXPLICIT height (e.g., 800px)
          width: '100%',
        }}
      >
        {config.childCards.map((childConfig) => (
          <Box
            key={childConfig.id}
            sx={{
              width: `calc(${childConfig.layout.w * 100}% - ${config.gap}px)`,
              flex: `0 0 calc(${childConfig.layout.w * 100}% - ${config.gap}px)`,
              height: '100%',  // 🔥 Fill the content height
              backgroundColor: 'white',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <ChildCard
              config={childConfig}
              parentWidth={dimensions.width * childConfig.layout.w}
              parentHeight={contentHeight - (config.gap * 2)}
              gap={0}
              showExport={showExport}
              isFullSizePreview={true}  // 🔥 Full-size mode (no absolute positioning)
            />
          </Box>
        ))}
      </Box>
    </Box>
  );
}
```

**Height Calculation** (lines 78-87):
```tsx
const calculatedHeight = useMemo(() => {
  // When useDynamicHeight is false OR no height variable set
  if (!config.useDynamicHeight || !config.heightDataSource || heightFromVariable === 0) {
    return config.cardMinHeight || 800;  // 🔥 Falls back to cardMinHeight
  }

  // Dynamic height from variable (Mode 3)
  return heightFromVariable;
}, [...]);
```

### Visual Result

```
┌───────────────────────────────────────┐
│         Dashboard Card (400px)         │
│ ┌───────────────────────────────────┐ │
│ │      ParentCardContainer          │ │
│ │      height: 100% (400px visible) │ │
│ │      overflow: auto               │ │
│ │ ┌─────────────────────────────┐ ▲ │ │
│ │ │   Inner Content Wrapper     │ █ │ │
│ │ │   height: 800px (fixed)     │ █ │ │
│ │ │ ┌─────────────────────────┐ │ █ │ │
│ │ │ │      ChildCard          │ │ █ │ │
│ │ │ │  Bars at proper size    │ │ █ │ │
│ │ │ │  ████████████████       │ │ █ │ │
│ │ │ │  ██████████████         │ │ ░ │ │  ← Scrollbar
│ │ │ │  ████████████           │ │ ░ │ │
│ │ │ │  ██████████             │ │ ░ │ │
│ │ │ │  (more bars below...)   │ │ ░ │ │
│ │ │ └─────────────────────────┘ │ ▼ │ │
│ │ └─────────────────────────────┘   │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘
```

---

## Mode 3: Scroll with Dynamic Height

### Settings
- `enableContainerScroll`: **true**
- `useDynamicHeight`: **true**
- `heightDataSource`: **"chartHeight"** (variable name containing calculated height)

### Behavior
1. User calculates the height in their own calculation logic
2. Height value is stored in a Recoil variable (e.g., `chartHeight = 1200`)
3. `ParentCardContainer` reads this variable and uses it as `contentHeight`
4. Height automatically adjusts when data changes (e.g., Top 10 → Top 25)
5. Consistent bar appearance regardless of data count

### Code Flow

**User's Calculation Logic** (example):
```javascript
// In user's calculation:
const dataCount = NBRxPayerName.length;  // Number of bars/categories
const heightPerBar = 35;                  // Pixels per bar
const padding = 100;                      // Extra space for title/axis
const chartHeight = (dataCount * heightPerBar) + padding;

// Store in variable: chartHeight
// - Top 10: (10 × 35) + 100 = 450px
// - Top 25: (25 × 35) + 100 = 975px
// - Top 50: (50 × 35) + 100 = 1850px
```

**ParentCardContainer.tsx** - Reading Height Variable (lines 32-66):
```tsx
// 🔥 Get height value directly from the selected variable
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
      const parsed = parseFloat(rawValue);
      if (!isNaN(parsed)) {
        heightValue = parsed;
      }
    } else if (typeof rawValue === 'number') {
      heightValue = rawValue;
    }

    return heightValue > 0 ? heightValue : 0;
  } catch (err) {
    console.warn('Failed to get height from variable:', err);
    return 0;
  }
}, [config.useDynamicHeight, config.heightDataSource]);
```

**ParentCardContainer.tsx** - Using Height (lines 78-87):
```tsx
const calculatedHeight = useMemo(() => {
  if (!config.useDynamicHeight || !config.heightDataSource || heightFromVariable === 0) {
    return config.cardMinHeight || 800;
  }

  console.log(`📏 [ParentContainer] Using dynamic height from variable "${config.heightDataSource}": ${heightFromVariable}px`);
  
  return heightFromVariable;  // 🔥 Uses the value directly from variable
}, [...]);
```

**ParentCardContainer.tsx** - Subscribing to Variable Updates (lines 68-76):
```tsx
// 🔥 Subscribe to variable updates to recalculate height when data changes
const variableUpdateTrigger = useRecoilValue(variableUpdateTriggerState);

// 🔥 Update height when config changes OR when variables are recalculated
useEffect(() => {
  if (config.useDynamicHeight && config.heightDataSource) {
    getHeightFromVariable().then(setHeightFromVariable);
  }
}, [config.useDynamicHeight, config.heightDataSource, getHeightFromVariable, variableUpdateTrigger]);
```

### Visual Result - Top 10

```
┌───────────────────────────────────────┐
│         Dashboard Card (400px)         │
│ ┌───────────────────────────────────┐ │
│ │      ParentCardContainer          │ │
│ │      height: 100% (400px visible) │ │
│ │      overflow: auto               │ │
│ │ ┌─────────────────────────────┐ ▲ │ │
│ │ │   Inner Content Wrapper     │ █ │ │
│ │ │   height: 450px (dynamic)   │ █ │ │
│ │ │                             │ █ │ │
│ │ │   ████████████████████████  │ ░ │ │
│ │ │   ██████████████████████    │ ░ │ │
│ │ │   ████████████████████      │ ░ │ │
│ │ │   ██████████████████        │ ░ │ │
│ │ │   ████████████████          │ ░ │ │
│ │ │   (... 5 more bars)         │ ▼ │ │
│ │ └─────────────────────────────┘   │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘

User changes filter to Top 25...
Height automatically updates to 975px!
```

### Visual Result - Top 25

```
┌───────────────────────────────────────┐
│         Dashboard Card (400px)         │
│ ┌───────────────────────────────────┐ │
│ │      ParentCardContainer          │ │
│ │      height: 100% (400px visible) │ │
│ │      overflow: auto               │ │
│ │ ┌─────────────────────────────┐ ▲ │ │
│ │ │   Inner Content Wrapper     │ █ │ │
│ │ │   height: 975px (dynamic)   │ █ │ │
│ │ │                             │ █ │ │
│ │ │   ████████████████████████  │ █ │ │
│ │ │   ██████████████████████    │ █ │ │
│ │ │   ████████████████████      │ ░ │ │  ← More scroll range
│ │ │   ██████████████████        │ ░ │ │
│ │ │   (... 21 more bars below)  │ ░ │ │
│ │ │                             │ ░ │ │
│ │ │                             │ ▼ │ │
│ │ └─────────────────────────────┘   │ │
│ └───────────────────────────────────┘ │
└───────────────────────────────────────┘

Bars remain the same size (35px each)!
```

---

## Dimension Propagation

### No Scroll Mode (Absolute Positioning)

```
DragDropDashboard
│
├─ Card dimensions: { width: 600px, height: 400px }
│
└─► ParentCardContainer
    │
    ├─ Measures itself: { width: 580px, height: 380px } (minus padding)
    │
    └─► ChildCard (isFullSizePreview = false)
        │
        ├─ Receives: parentWidth=580, parentHeight=380, gap=8
        │
        ├─ Calculates dimensions based on layout:
        │   - layout: { x: 0, y: 0, w: 0.5, h: 1 }
        │   - width = (580 - 16) * 0.5 - 4 = 278px
        │   - height = (380 - 16) * 1 - 4 = 360px
        │   - left = (564 * 0) + 8 = 8px
        │   - top = (364 * 0) + 8 = 8px
        │
        └─ Renders with: position: absolute, left: 8, top: 8, width: 278, height: 360
```

### Scroll Mode (Flexbox Layout)

```
DragDropDashboard
│
├─ Card dimensions: { width: 600px, height: 400px }
│
└─► ParentCardContainer
    │
    ├─ Outer container: height=100% (400px), overflow=auto
    │
    ├─ Inner wrapper: height=800px (contentHeight)
    │
    └─► ChildCard (isFullSizePreview = true)
        │
        ├─ Receives: parentWidth=290, parentHeight=784, gap=0
        │
        ├─ Does NOT calculate dimensions (isFullSizePreview=true)
        │
        └─ Renders with: width: 100%, height: 100% (fills parent Box)
```

---

## Configuration Settings

### Container Settings in UI

| Setting | Description | Mode |
|---------|-------------|------|
| **Enable Container Scroll** | Toggle ON/OFF scrolling | All modes |
| **Dynamic Height** | Use variable for height | Scroll only |
| **Height Variable** | Dropdown to select variable | Dynamic only |
| **Content Height** | Slider (400-2000px) | Fixed scroll only |
| **Gap Between Cards** | Slider (0-24px) | All modes |

### Configuration UI Location

**Path**: Viz Config → Layout Presets → Container Settings

```
┌─────────────────────────────────────────────┐
│ Container Settings                          │
│                                             │
│ ☐ Enable Container Scroll                   │
│   Charts compress to fit container          │
│                                             │
│ When enabled:                               │
│ ┌─────────────────────────────────────────┐ │
│ │ ○ Dynamic Height                        │ │
│ │   Height auto-calculates from variable  │ │
│ │                                         │ │
│ │   Height Variable: [chartHeight    ▼]   │ │
│ │   Select a variable containing the      │ │
│ │   calculated height value (in pixels)   │ │
│ │                                         │ │
│ │ ○ Fixed Height                          │ │
│ │   Content Height: 800px                 │ │
│ │   [━━━━━━━━━━━○━━━━━━━━━━━━━━━━━━━━━━]   │ │
│ │   400     800     1200    1600    2000  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ Gap Between Cards: 8px                      │
│ [━━━○━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]    │
└─────────────────────────────────────────────┘
```

---

## Visual Comparison

| Aspect | No Scroll | Fixed Scroll | Dynamic Scroll |
|--------|-----------|--------------|----------------|
| **Scrollbar** | None | Always (if content > visible) | Always (if content > visible) |
| **Bar Size** | Compressed | Consistent | Consistent |
| **Height** | = Container | Fixed (e.g., 800px) | From variable |
| **Data Change** | Bars shrink/grow | Height unchanged | Height adjusts |
| **Best For** | Small datasets | Known data range | Variable data count |
| **Config Needed** | None | Set cardMinHeight | Set heightDataSource |

---

## Summary

1. **No Scroll (Default)**: Simple, all data visible, charts compress
2. **Fixed Scroll**: Consistent bar size, fixed height, may need adjustment
3. **Dynamic Scroll**: Best UX, height responds to data, bars always consistent

For dashboards with filter-based Top N selectors, **Dynamic Height** is recommended as it automatically adjusts the chart height when users switch between Top 10, Top 25, Top 50, etc.

