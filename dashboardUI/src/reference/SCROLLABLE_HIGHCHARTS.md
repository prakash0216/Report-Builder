# How to Make Highcharts Scrollable in Multi-Card Containers

There are **three options** for scrolling behavior in multi-card containers:

---

## 🔥 Container Settings

In **Viz Config > Layout Presets > Container Settings**, you have:

| Setting | Description |
|---------|-------------|
| **Enable Container Scroll** | Toggle ON/OFF |
| **Dynamic Height** | Auto-calculate height based on data count |
| **Content Height** | Fixed height for chart content (400-2000px) - when Dynamic Height is OFF |

**How it works**: When "Enable Container Scroll" is ON, charts are rendered at the specified height. If this height is greater than the visible container (dashboard card) height, a scrollbar appears.

---

## Option 1: No Scroll (Default)

Charts compress to fit the container. All data visible but bars may be smaller.

### Settings:
- **Enable Container Scroll** → OFF

### Best For:
- Small datasets (< 15 categories)
- When you want all data visible at once
- Quick overview without scrolling

---

## Option 2: Fixed Content Height

All charts are rendered at a fixed height. Container scrolls when content exceeds viewport.

### Settings:
1. **Enable Container Scroll** → ON
2. **Dynamic Height** → OFF
3. **Content Height** → 800-1200px (adjust based on your data)

### How It Works:
1. Charts are rendered at the "Content Height" you set (e.g., 800px)
2. Charts fill this height - bars are not compressed
3. If Content Height > dashboard card height → scrollbar appears
4. All charts scroll together with ONE scrollbar

### Choosing the Right Content Height:
| Data Size | Recommended Content Height |
|-----------|---------------------------|
| 10-15 categories | 600px |
| 15-25 categories | 900px |
| 25-40 categories | 1200px |
| 40+ categories | 1600px+ |

**Tip**: Set the Content Height larger than your dashboard card height to enable scrolling.

---

## 🔥 Option 3: Dynamic Height (Recommended!)

**NEW!** Height is controlled by a variable that you calculate in your own logic. This gives you full control over the chart height.

### Settings:
1. **Enable Container Scroll** → ON
2. **Dynamic Height** → ON
3. **Height Variable** → Select a variable containing the calculated height in pixels

### How It Works:
1. You create a calculation that computes the desired height (e.g., `dataCount * 35 + 100`)
2. Store the result in a variable (e.g., `chartHeight`)
3. Select that variable in the "Height Variable" dropdown
4. The container uses that value directly as the content height

### Example Calculation Logic:
```javascript
// In your calculation:
const dataCount = NBRxPayerName.length;  // Number of bars
const heightPerBar = 35;                  // Pixels per bar
const padding = 100;                      // Extra space for title/axis
const calculatedHeight = (dataCount * heightPerBar) + padding;

// Store in variable: chartHeight = calculatedHeight
// Example results:
// - Top 10: (10 × 35) + 100 = 450px
// - Top 25: (25 × 35) + 100 = 975px
```

### Best For:
- ✅ Full control over height calculation logic
- ✅ Data that changes based on filters (Top N selector)
- ✅ Custom formulas (different padding, bar sizes, etc.)
- ✅ Maintaining consistent bar appearance regardless of data size

### Configuration Example:
| Setting | Value | Notes |
|---------|-------|-------|
| Enable Container Scroll | ON | Required |
| Dynamic Height | ON | Uses variable for height |
| Height Variable | `chartHeight` | Your pre-calculated height value |

---

## Individual Card Scroll (Manual - In Chart Config)

If you want individual scrollbars on specific charts, add scroll settings directly in the chart config:

```json
{
  "chart": {
    "type": "bar"
  },
  "xAxis": {
    "categories": ${YourCategories},
    "min": 0,
    "max": 9,
    "scrollbar": {
      "enabled": true,
      "barBackgroundColor": "#667eea",
      "barBorderRadius": 4,
      "barBorderWidth": 0,
      "buttonBackgroundColor": "#f3f4f6",
      "buttonBorderWidth": 0,
      "trackBackgroundColor": "#f3f4f6"
    }
  },
  "series": [
    {
      "name": "Your Data",
      "data": ${YourData}
    }
  ]
}
```

### Key Properties:
- **`min: 0`**: First visible category (0-based index)
- **`max: 9`**: Last visible category (shows 10 items: 0-9)
- **`scrollbar.enabled: true`**: Shows the scrollbar

This gives each chart its own scrollbar showing 10 items at a time.

---

## Alternative: scrollablePlotArea

Highcharts also supports `scrollablePlotArea` for built-in scrolling:

```json
{
  "chart": {
    "type": "bar",
    "scrollablePlotArea": {
      "minHeight": 600,
      "scrollPositionY": 0
    }
  },
  "xAxis": {
    "categories": ${YourCategories}
  },
  "series": [...]
}
```

### Properties:
- **`minHeight`**: Minimum plot area height. Scrolling enabled if content exceeds this.
- **`scrollPositionY`**: Initial scroll position (0 = top, 1 = bottom)
- **`minWidth`**: For horizontal scrolling (column charts)

---

## Tips

1. **Container Scroll is simpler** - Just toggle ON and set min height
2. **Individual scroll gives more control** - But requires manual config
3. **For Bar Charts**: Use `minHeight` and `scrollPositionY`
4. **For Column Charts**: Use `minWidth` and `scrollPositionX`
5. **Sorting**: Sort your data before displaying for meaningful "Top N" views

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Scrollbar not appearing | Set Content Height > dashboard card height |
| Chart too compressed | Enable Container Scroll and increase Content Height |
| No scrolling in container | Increase Content Height (must be larger than card) |
| Settings not persisting | Check browser console for API errors |

---

## Complete Example

Here's a full chart config with scrollbar for Top 10 items:

```json
{
  "chart": {
    "type": "bar"
  },
  "title": {
    "text": "Paid NBRx"
  },
  "xAxis": {
    "categories": ${NBRxPayerName},
    "min": 0,
    "max": 9,
    "scrollbar": {
      "enabled": true
    },
    "title": {
      "text": ${topDimensionSelector}
    }
  },
  "yAxis": {
    "min": 0,
    "title": { "text": null },
    "gridLineWidth": 0
  },
  "plotOptions": {
    "bar": {
      "dataLabels": {
        "enabled": true,
        "format": "{y}%"
      }
    }
  },
  "legend": { "enabled": false },
  "credits": { "enabled": false },
  "series": [
    {
      "name": "Paid NBRx",
      "data": ${NBRxPercentageData}
    }
  ]
}
```
