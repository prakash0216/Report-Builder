# Multi-Card Container Layout Editor

## Overview

The Multi-Card Container feature allows a single dashboard card to contain up to 4 child cards (charts, tables, or HTML content) in a customizable layout. This document explains the interactive layout editor functionality.

---

## Enabling Multi-Card Container

1. Open the **Configuration Panel** for any card
2. Navigate to the **Multi-Card Config** tab
3. Toggle **"Enable Multi-Card Container"** ON
4. The system automatically:
   - Selects the **Custom** layout preset
   - Opens the **Layout Presets** accordion
   - Creates one default card (25% x 25% size)
   - Shows the **Interactive Layout Editor** on the right panel

---

## Layout Presets

| Preset | Description | Cards |
|--------|-------------|-------|
| 1 Card | Single full-size card | 1 |
| 2 Side by Side | Two cards horizontally | 2 |
| 2 Stacked | Two cards vertically | 2 |
| 1 Top + 2 Bottom | One wide card on top, two below | 3 |
| 2 Top + 1 Bottom | Two cards on top, one wide below | 3 |
| 2×2 Grid | Four equal-sized cards | 4 |
| Custom | Free-form positioning | 1-4 |

### Selecting a Preset

1. Click any preset button in the **Layout Presets** accordion
2. The layout editor on the right shows a preview
3. For non-custom presets, card positions are fixed to the preset template
4. Changes apply immediately (no Apply button needed for presets)

### Preview Mode

When selecting a preset that would **remove existing cards**, a confirmation dialog appears:
- Shows how many cards will be removed
- Click **Apply Change** to confirm
- Click **Cancel** to keep current layout

---

## Interactive Layout Editor

The Interactive Layout Editor appears on the **right panel** and provides visual drag-and-drop layout editing.

### Features

#### Adding Cards (Custom Mode Only)
- Click **"Add Card"** button to add a new card
- Maximum 4 cards allowed
- New cards are placed in the first available non-overlapping position
- Default size: 25% × 25% (3/12 grid units)

#### Removing Cards (Custom Mode Only)
- Hover over a card to reveal the **×** delete button
- Click **×** to remove the card
- At least 1 card must remain

#### Dragging Cards
1. Click and hold anywhere on a card
2. Drag to reposition
3. Cards snap to a 12×12 grid for precise alignment
4. Release to place the card

#### Resizing Cards
Cards have **8 resize handles** (visible on hover):

| Handle | Location | Cursor | Function |
|--------|----------|--------|----------|
| N | Top edge | ↕ | Resize height from top |
| S | Bottom edge | ↕ | Resize height from bottom |
| E | Right edge | ↔ | Resize width from right |
| W | Left edge | ↔ | Resize width from left |
| NE | Top-right corner | ↗ | Resize both dimensions |
| NW | Top-left corner | ↖ | Resize both dimensions |
| SE | Bottom-right corner | ↘ | Resize both dimensions |
| SW | Bottom-left corner | ↙ | Resize both dimensions |

#### Collision Detection
- Cards **cannot overlap**
- When dragging/resizing would cause overlap:
  - The action is blocked
  - Border turns red
  - Warning chip: "⚠ Cards cannot overlap"
- The system finds valid positions automatically

---

## Context-Aware Preview

The right panel shows different previews depending on what you're editing:

### Mode 1: Layout Mode
When the **Layout Presets** accordion is expanded:
- Shows the **Interactive Layout Editor** (drag & resize)
- Shows the **Container Preview** (all cards together)
- Best for positioning and resizing cards

### Mode 2: Card Configuration Mode
When the **Configure** accordion is expanded:
- Shows only the **selected card's preview**
- Displays the card type (chart/table/HTML) with icon
- Focused preview without layout distractions
- Best for editing individual card content

### Floating Fullscreen Button
A **purple floating button** (⛶) appears in the bottom-right corner:
- Click to open **fullscreen preview**
- Animated transition with fade effect
- Dark-themed immersive view
- Shows complete container at full size
- Click **"Exit Fullscreen"** to return

---

## Grid System

The layout uses a **12×12 grid** system:

| Grid Units | Percentage |
|------------|------------|
| 1 | 8.33% |
| 2 | 16.67% |
| 3 | 25% |
| 4 | 33.33% |
| 6 | 50% |
| 12 | 100% |

Cards snap to grid lines when dragging/resizing for pixel-perfect alignment.

---

## Configuring Child Cards

After positioning cards in the layout:

1. **Select a card** using the quick selector chips (Card 1, Card 2, etc.)
2. **Choose the visualization type**:
   - **Chart**: Highcharts JSON configuration
   - **Table**: Data source with table settings
   - **HTML**: Custom HTML content
3. **Configure the visualization**:
   - Use the editors with variable auto-completion
   - Variables use `${variableName}` syntax for charts
   - Variables use `{{variableName}}` syntax for HTML

---

## Workflow Summary

```
Enable Container → Select Preset → Position Cards → Select Card → Configure Visualization
                         ↓
                   Custom Mode?
                         ↓
                   Add/Remove Cards
                         ↓
                   Drag & Resize
                         ↓
                   Preview in Fullscreen
```

---

## Technical Details

### Card Layout Properties
```typescript
interface ChildCardLayout {
  id: string;    // Unique identifier (e.g., "17_child1")
  x: number;     // X position (0-1 scale, 0=left)
  y: number;     // Y position (0-1 scale, 0=top)
  w: number;     // Width (0-1 scale, 1=full width)
  h: number;     // Height (0-1 scale, 1=full height)
}
```

### Collision Algorithm
```typescript
const cardsOverlap = (a, b) => {
  return !(
    a.x + a.w <= b.x ||  // a is left of b
    b.x + b.w <= a.x ||  // b is left of a
    a.y + a.h <= b.y ||  // a is above b
    b.y + b.h <= a.y     // b is above a
  );
};
```

### State Persistence
- Layout configurations are saved to the backend via Recoil atom effects
- Changes persist across page reloads
- Each parent card ID maps to its container configuration

---

## Best Practices

1. **Start with a preset** if your layout matches one of the standard options
2. **Use Custom mode** for unique layouts requiring precise positioning
3. **Preview in fullscreen** to see how the container looks at full size
4. **Keep card count minimal** - fewer cards = better performance
5. **Use consistent sizes** for a cleaner visual appearance

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't resize card | Check if resizing would cause overlap with another card |
| Can't move card | Ensure the target position doesn't overlap other cards |
| Cards not saving | Check browser console for API errors |
| Preview not updating | Try refreshing the page |
| Layout looks different in dashboard | Compare container dimensions between config and dashboard |

