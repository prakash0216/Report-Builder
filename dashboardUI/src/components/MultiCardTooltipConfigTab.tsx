// dashboardUI/src/components/MultiCardTooltipConfigTab.tsx
// Multi-Card Tooltip Configuration Tab - Similar to ChildCardConfigTab but for tooltips

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useRecoilCallback } from 'recoil';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Divider,
  Chip,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  AlertTitle,
  Stack,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ShowChart as ChartIcon,
  TableChart as TableIcon,
  Html as HtmlIcon,
  Code as CodeIcon,
  Check as CheckIcon,
  TouchApp as TouchAppIcon,
  DataObject as DataObjectIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
  OpenWith as OpenWithIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon,
  Sort as SortIcon,
  ViewColumn as ColumnIcon,
  Palette as PaletteIcon,
  InsertChart as InsertChartIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  VisibilityOff as VisibilityOffIcon,
  DragIndicator as DragIcon,
} from '@mui/icons-material';
import { Radio, RadioGroup, Checkbox } from '@mui/material';
import {
  childCardTooltipConfigState,
  ChildCardTooltipConfig,
  TooltipCardConfig,
  TooltipCardLayout,
  TooltipDataExtraction,
  TooltipCalculationBinding,
  TOOLTIP_LAYOUT_PRESETS,
  defaultChildCardTooltipConfig,
  createDefaultTooltipCard,
  AVAILABLE_HOVER_KEYS,
} from '../recoil/ChildCardTooltipState';
import { childCardConfigState } from '../recoil/ChildCardState';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { hooksArrayOfObjectsSelector, variableNamesState } from '../recoil/Variabletracker';
import { filterNamesState } from '../recoil/FiltersFamily';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { JsonEditor } from './JsonEditor';
import { HtmlEditor } from './HtmlEditor';
import { CalculationEditor } from './CalculationEditor';
import ResizableChart from './ResizableChart';
import DashboardTable from './DashboardTable';
import { TableSettings, TableDisplayMode, defaultTableSettings, SummaryCalculation } from '../types/tableTypes';

// Layout preset options
const layoutPresetOptions = [
  { key: 'single', label: '1 Card', icon: '▢', description: 'Single full-size card' },
  { key: 'twoHorizontal', label: '2 Side', icon: '◫', description: 'Two cards horizontally' },
  { key: 'twoVertical', label: '2 Stack', icon: '▤', description: 'Two cards vertically' },
  { key: 'threeTopOne', label: '1+2', icon: '⬓', description: '1 top, 2 bottom' },
  { key: 'threeBottomOne', label: '2+1', icon: '⬔', description: '2 top, 1 bottom' },
  { key: 'fourGrid', label: '2×2', icon: '⊞', description: 'Four cards in grid' },
  { key: 'custom', label: 'Custom', icon: '✎', description: 'Build custom layout' },
];

// Custom Layout Builder Component for Tooltip - Simple 1-4 cards selection
interface CustomTooltipLayoutBuilderProps {
  tooltipCards: TooltipCardConfig[];
  onCardsChange: (cards: TooltipCardConfig[]) => void;
  selectedCardIndex: number;
  setSelectedCardIndex: (index: number) => void;
}

const CustomTooltipLayoutBuilder: React.FC<CustomTooltipLayoutBuilderProps> = ({
  tooltipCards,
  onCardsChange,
  selectedCardIndex,
  setSelectedCardIndex,
}) => {
  const [cardCount, setCardCount] = useState<number>(tooltipCards.length || 1);

  // Sync with existing cards
  useEffect(() => {
    if (tooltipCards.length > 0) {
      setCardCount(tooltipCards.length);
    }
  }, [tooltipCards.length]);

  const applyCustomLayout = () => {
    if (cardCount < 1 || cardCount > 4) return;

    const newCards: TooltipCardConfig[] = [];
    
    // Simple horizontal layout - all cards in a single row
    for (let i = 0; i < cardCount; i++) {
      const existingCard = tooltipCards[i];
      const cardId = `tooltip-card-${i + 1}`;
      const layout: TooltipCardLayout = {
        id: cardId,
        x: i * (1 / cardCount),
        y: 0,
        w: 1 / cardCount,
        h: 1,
      };
      if (existingCard) {
        newCards.push({ ...existingCard, id: cardId, layout });
      } else {
        newCards.push(createDefaultTooltipCard(cardId, layout));
      }
    }

    onCardsChange(newCards);
    if (selectedCardIndex >= newCards.length) {
      setSelectedCardIndex(Math.max(0, newCards.length - 1));
    }
  };

  const addCard = () => {
    if (tooltipCards.length >= 4) return;
    
    const newCount = tooltipCards.length + 1;
    const newCards: TooltipCardConfig[] = [];
    
    // Redistribute existing cards + add new one
    for (let i = 0; i < newCount; i++) {
      const existingCard = tooltipCards[i];
      const cardId = `tooltip-card-${i + 1}`;
      const layout: TooltipCardLayout = {
        id: cardId,
        x: i * (1 / newCount),
        y: 0,
        w: 1 / newCount,
        h: 1,
      };
      if (existingCard) {
        newCards.push({ ...existingCard, id: cardId, layout });
      } else {
        newCards.push(createDefaultTooltipCard(cardId, layout));
      }
    }
    
    onCardsChange(newCards);
    setSelectedCardIndex(newCards.length - 1); // Select the new card
    setCardCount(newCount);
  };

  const removeCard = (indexToRemove: number) => {
    if (tooltipCards.length <= 1) return;
    
    const newCards = tooltipCards
      .filter((_, i) => i !== indexToRemove)
      .map((card, i) => {
        const newCount = tooltipCards.length - 1;
        return {
          ...card,
          id: `tooltip-card-${i + 1}`,
          layout: {
            ...card.layout,
            id: `tooltip-card-${i + 1}`,
            x: i * (1 / newCount),
            w: 1 / newCount,
          },
        };
      });
    
    onCardsChange(newCards);
    if (selectedCardIndex >= newCards.length) {
      setSelectedCardIndex(Math.max(0, newCards.length - 1));
    }
    setCardCount(newCards.length);
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 1.5,
        p: 1.5,
        borderRadius: 1.5,
        border: '2px solid rgba(102, 126, 234, 0.3)',
        bgcolor: 'rgba(102, 126, 234, 0.02)',
      }}
    >
      <Typography variant="caption" fontWeight={700} color="#667eea" sx={{ display: 'block', mb: 1.5 }}>
        ✎ Custom Layout Builder
      </Typography>
      
      <Stack spacing={2}>
        {/* Number of Cards Selection */}
        <Box>
          <Typography variant="caption" color="#64748b" sx={{ display: 'block', mb: 1, fontSize: '0.7rem' }}>
            Number of Cards:
          </Typography>
          <ToggleButtonGroup
            value={cardCount}
            exclusive
            onChange={(_, val) => val !== null && setCardCount(val)}
            size="small"
            sx={{ 
              '& .MuiToggleButton-root': {
                px: 2, py: 0.5, fontSize: '0.8rem', fontWeight: 600,
                '&.Mui-selected': { bgcolor: '#667eea', color: 'white' },
              },
            }}
          >
            <ToggleButton value={1}>1</ToggleButton>
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={3}>3</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Live Preview of Cards */}
        <Box>
          <Typography variant="caption" color="#64748b" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
            Preview:
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            gap: 0.5, 
            height: 50, 
            bgcolor: '#f8fafc', 
            borderRadius: 1, 
            p: 0.5,
            border: '1px solid #e2e8f0',
          }}>
            {Array.from({ length: cardCount }).map((_, i) => (
              <Box
                key={i}
                sx={{
                  flex: 1,
                  bgcolor: i === selectedCardIndex ? '#667eea' : 'rgba(102, 126, 234, 0.3)',
                  borderRadius: 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: i === selectedCardIndex ? 'white' : '#667eea',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  '&:hover': {
                    bgcolor: i === selectedCardIndex ? '#5567d5' : 'rgba(102, 126, 234, 0.5)',
                  },
                }}
                onClick={() => setSelectedCardIndex(i)}
              >
                {i + 1}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Apply Button */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px solid rgba(102, 126, 234, 0.15)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={`${cardCount} card${cardCount !== 1 ? 's' : ''}`}
              size="small"
              sx={{
                height: 22,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: '#22c55e15',
                color: '#22c55e',
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {tooltipCards.length < 4 && (
              <Button
                size="small"
                variant="outlined"
                onClick={addCard}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  py: 0.5,
                  px: 1.5,
                  borderColor: '#22c55e',
                  color: '#22c55e',
                  '&:hover': { borderColor: '#16a34a', bgcolor: '#22c55e10' },
                }}
              >
                + Add Card
              </Button>
            )}
            <Button
              size="small"
              variant="contained"
              onClick={applyCustomLayout}
              disabled={cardCount === tooltipCards.length}
              sx={{
                textTransform: 'none',
                fontSize: '0.7rem',
                py: 0.5,
                px: 1.5,
                bgcolor: '#667eea',
                '&:hover': { bgcolor: '#5567d5' },
              }}
            >
              Apply Layout
            </Button>
          </Box>
        </Box>

        {/* Current Cards with Remove Option */}
        {tooltipCards.length > 0 && (
          <Box>
            <Typography variant="caption" color="#64748b" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem' }}>
              Current Cards (click to remove):
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {tooltipCards.map((card, i) => (
                <Chip
                  key={card.id}
                  label={`Card ${i + 1}`}
                  size="small"
                  onDelete={tooltipCards.length > 1 ? () => removeCard(i) : undefined}
                  onClick={() => setSelectedCardIndex(i)}
                  sx={{
                    height: 24,
                    fontSize: '0.65rem',
                    bgcolor: i === selectedCardIndex ? '#667eea' : 'rgba(102, 126, 234, 0.1)',
                    color: i === selectedCardIndex ? 'white' : '#667eea',
                    cursor: 'pointer',
                    '& .MuiChip-deleteIcon': {
                      color: i === selectedCardIndex ? 'rgba(255,255,255,0.7)' : '#94a3b8',
                      fontSize: '0.9rem',
                      '&:hover': { color: '#ef4444' },
                    },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

// Chart template presets - UNIFIED ${} syntax (no quotes needed - strings auto-quoted!)
const chartTemplatePresets = [
  { label: "Custom/Empty", value: '' },
  { 
    label: "Pie Chart", 
    value: `{
  "chart": {
    "type": "pie",
    "height": 280,
    "backgroundColor": "transparent"
  },
  "title": {
    "text": \${hoveredCategory},
    "style": { "fontSize": "14px", "fontWeight": "bold" }
  },
  "subtitle": {
    "text": "Breakdown",
    "style": { "fontSize": "11px", "color": "#666" }
  },
  "tooltip": {
    "pointFormat": "<b>{point.y:,.0f}</b> ({point.percentage:.1f}%)"
  },
  "plotOptions": {
    "pie": {
      "dataLabels": {
        "enabled": true,
        "format": "<b>{point.name}</b>: {point.percentage:.1f}%",
        "style": { "fontSize": "10px" }
      },
      "showInLegend": false
    }
  },
  "series": [{
    "name": "Metrics",
    "colorByPoint": true,
    "data": \${tooltipChartData}
  }],
  "credits": { "enabled": false }
}` 
  },
  { 
    label: "Bar Chart", 
    value: `{
  "chart": { "type": "bar", "height": 250, "backgroundColor": "transparent" },
  "title": { "text": \${hoveredCategory}, "style": { "fontSize": "14px" } },
  "xAxis": { "categories": \${tooltipCategories}, "labels": { "style": { "fontSize": "10px" } } },
  "yAxis": { "title": { "text": null } },
  "series": [{ "name": "Value", "data": \${tooltipValues}, "color": "#667eea" }],
  "credits": { "enabled": false }
}` 
  },
  { 
    label: "Column Chart", 
    value: `{
  "chart": { "type": "column", "height": 250, "backgroundColor": "transparent" },
  "title": { "text": \${hoveredCategory}, "style": { "fontSize": "14px" } },
  "xAxis": { "categories": \${tooltipCategories}, "labels": { "style": { "fontSize": "10px" } } },
  "yAxis": { "title": { "text": null } },
  "series": [{ "name": "Value", "data": \${tooltipValues}, "color": "#764ba2" }],
  "credits": { "enabled": false }
}` 
  },
];

// Table template presets - describe common use cases
const tableTemplatePresets = [
  { 
    label: "Filtered Details", 
    dataSource: "tooltipTableData",
    calcDescription: "Filter data based on hovered category",
    calcTemplate: `// Filter your main data by the hovered category
const filtered = allData.filter(item => 
  item.category === hoveredCategory
);
return filtered;`
  },
  { 
    label: "Top N Items", 
    dataSource: "tooltipTopItems",
    calcDescription: "Get top N items related to hovered point",
    calcTemplate: `// Get top items for the hovered category
const items = allData
  .filter(item => item.category === hoveredCategory)
  .sort((a, b) => b.value - a.value)
  .slice(0, 5);
return items;`
  },
  { 
    label: "Summary Stats", 
    dataSource: "tooltipSummary",
    calcDescription: "Calculate summary statistics",
    calcTemplate: `// Calculate summary for hovered category
const filtered = allData.filter(item => 
  item.category === hoveredCategory
);
const total = filtered.reduce((sum, item) => sum + item.value, 0);
const avg = total / filtered.length;
return [{ metric: "Total", value: total }, { metric: "Average", value: avg.toFixed(2) }, { metric: "Count", value: filtered.length }];`
  },
];

// HTML template presets
const htmlTemplatePresets = [
  { 
    label: "Simple Card", 
    value: `<div style="padding: 12px; font-family: system-ui;">
  <h3 style="margin: 0 0 8px 0; color: #1e293b;">\${hoveredCategory}</h3>
  <p style="margin: 0; color: #64748b;">Value: <strong>\${hoveredValue}</strong></p>
</div>`
  },
  { 
    label: "Metrics List", 
    value: `<div style="padding: 12px; font-family: system-ui;">
  <h4 style="margin: 0 0 12px 0; color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 6px;">\${hoveredCategory}</h4>
  <div style="display: grid; gap: 8px;">
    <div style="display: flex; justify-content: space-between;">
      <span style="color: #64748b;">Paid TRX:</span>
      <strong style="color: #1e293b;">\${paidTRX}</strong>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: #64748b;">Written TRX:</span>
      <strong style="color: #1e293b;">\${writtenTRX}</strong>
    </div>
    <div style="display: flex; justify-content: space-between;">
      <span style="color: #64748b;">Percentage:</span>
      <strong style="color: #10b981;">\${percentageValue}%</strong>
    </div>
  </div>
</div>`
  },
  { 
    label: "Comparison", 
    value: `<div style="padding: 16px; font-family: system-ui; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 8px;">
  <div style="text-align: center; margin-bottom: 12px;">
    <span style="font-size: 24px; font-weight: 700; color: #667eea;">\${hoveredCategory}</span>
  </div>
  <div style="display: flex; gap: 16px; justify-content: center;">
    <div style="text-align: center; padding: 8px 16px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="font-size: 20px; font-weight: 700; color: #10b981;">\${hoveredValue}</div>
      <div style="font-size: 11px; color: #64748b;">Current</div>
    </div>
    <div style="text-align: center; padding: 8px 16px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="font-size: 20px; font-weight: 700; color: #f59e0b;">\${previousValue}</div>
      <div style="font-size: 11px; color: #64748b;">Previous</div>
    </div>
  </div>
</div>`
  },
  { 
    label: "Status Badge", 
    value: `<div style="padding: 12px; font-family: system-ui; text-align: center;">
  <div style="display: inline-block; padding: 4px 12px; background: #22c55e20; color: #22c55e; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 8px;">
    \${status}
  </div>
  <h3 style="margin: 8px 0; color: #1e293b;">\${hoveredCategory}</h3>
  <div style="font-size: 28px; font-weight: 700; color: #667eea;">\${hoveredValue}</div>
  <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Last updated: \${lastUpdated}</div>
</div>`
  },
];

// 🔥 Interactive Layout Editor Component - Visual drag/resize like main dashboard
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface InteractiveTooltipLayoutEditorProps {
  tooltipCards: TooltipCardConfig[];
  onLayoutChange: (cards: TooltipCardConfig[]) => void;
  selectedCardIndex: number;
  onSelectCard: (index: number) => void;
  allowAddRemove?: boolean;
  height?: number;
}

const InteractiveTooltipLayoutEditor: React.FC<InteractiveTooltipLayoutEditorProps> = ({
  tooltipCards,
  onLayoutChange,
  selectedCardIndex,
  onSelectCard,
  allowAddRemove = true,
  height = 200,
}) => {
  const GRID_COLS = 12;
  const GRID_ROWS = 12;
  const MIN_SIZE = 1 / GRID_COLS;
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasOverlap, setHasOverlap] = useState(false);
  
  const [resizing, setResizing] = useState<{
    cardIndex: number;
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startLayout: TooltipCardLayout;
  } | null>(null);

  const [dragging, setDragging] = useState<{
    cardIndex: number;
    startX: number;
    startY: number;
    startLayout: TooltipCardLayout;
  } | null>(null);

  const getContainerRect = () => containerRef.current?.getBoundingClientRect() || { width: 400, height: 300 };

  const cardsOverlap = (a: TooltipCardLayout, b: TooltipCardLayout): boolean => {
    const tolerance = 0.001;
    return !(a.x + a.w <= b.x + tolerance || b.x + b.w <= a.x + tolerance || 
             a.y + a.h <= b.y + tolerance || b.y + b.h <= a.y + tolerance);
  };

  const hasCollision = (layout: TooltipCardLayout, cardIndex: number, cards: TooltipCardConfig[]): boolean => {
    return cards.some((other, i) => i !== cardIndex && cardsOverlap(layout, other.layout));
  };

  const snapToGrid = (value: number): number => Math.round(value * GRID_COLS) / GRID_COLS;
  const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

  // 🔥 Fix any overlaps in the current layout by repositioning cards
  const fixOverlaps = (cards: TooltipCardConfig[]): TooltipCardConfig[] => {
    if (cards.length <= 1) return cards;
    
    const result = cards.map(card => ({ ...card, layout: { ...card.layout } }));
    
    // Process cards one by one
    for (let i = 1; i < result.length; i++) {
      const currentCard = result[i];
      let currentLayout = currentCard.layout;
      
      // Check if this card overlaps with any previous card
      const hasOverlapWithPrevious = () => {
        for (let j = 0; j < i; j++) {
          if (cardsOverlap(currentLayout, result[j].layout)) {
            return true;
          }
        }
        return false;
      };
      
      if (hasOverlapWithPrevious()) {
        // Try to find a valid position
        let found = false;
        
        // Try positions in a grid pattern
        for (let y = 0; y < GRID_ROWS && !found; y++) {
          for (let x = 0; x < GRID_COLS && !found; x++) {
            const testX = snapToGrid(x / GRID_COLS);
            const testY = snapToGrid(y / GRID_ROWS);
            
            // Skip if would go out of bounds
            if (testX + currentLayout.w > 1 || testY + currentLayout.h > 1) continue;
            
            const testLayout = { ...currentLayout, x: testX, y: testY };
            
            // Check against all previous cards
            let valid = true;
            for (let j = 0; j < i; j++) {
              if (cardsOverlap(testLayout, result[j].layout)) {
                valid = false;
                break;
              }
            }
            
            if (valid) {
              currentLayout = testLayout;
              found = true;
            }
          }
        }
        
        // If still not found, shrink the card and try again
        if (!found) {
          const smallerLayout = {
            ...currentLayout,
            w: Math.max(MIN_SIZE * 2, currentLayout.w / 2),
            h: Math.max(MIN_SIZE * 2, currentLayout.h / 2),
          };
          
          for (let y = 0; y < GRID_ROWS && !found; y++) {
            for (let x = 0; x < GRID_COLS && !found; x++) {
              const testX = snapToGrid(x / GRID_COLS);
              const testY = snapToGrid(y / GRID_ROWS);
              
              if (testX + smallerLayout.w > 1 || testY + smallerLayout.h > 1) continue;
              
              const testLayout = { ...smallerLayout, x: testX, y: testY };
              
              let valid = true;
              for (let j = 0; j < i; j++) {
                if (cardsOverlap(testLayout, result[j].layout)) {
                  valid = false;
                  break;
                }
              }
              
              if (valid) {
                currentLayout = testLayout;
                found = true;
              }
            }
          }
        }
        
        result[i] = { ...currentCard, layout: currentLayout };
      }
    }
    
    return result;
  };

  // 🔥 Helper: check if any overlap exists
  const hasAnyOverlapTooltip = (cards: TooltipCardConfig[]): boolean => {
    for (let i = 0; i < cards.length; i++) {
      const layout = cards[i].layout;
      if (layout.x < 0 || layout.y < 0 || layout.x + layout.w > 1 || layout.y + layout.h > 1) return true;
      for (let j = i + 1; j < cards.length; j++) {
        if (cardsOverlap(layout, cards[j].layout)) return true;
      }
    }
    return false;
  };

  // 🔥 Auto-layout helper for tooltip cards
  const applyAutoLayoutTooltip = (cards: TooltipCardConfig[]): TooltipCardConfig[] => {
    const count = cards.length;
    if (count === 1) {
      return cards.map(c => ({ ...c, layout: { ...c.layout, x: 0, y: 0, w: 1, h: 1 } }));
    }
    if (count === 2) {
      const layouts = [
        { x: 0, y: 0, w: 0.5, h: 1 },
        { x: 0.5, y: 0, w: 0.5, h: 1 },
      ];
      return cards.map((c, idx) => ({ ...c, layout: { ...c.layout, ...layouts[idx] } }));
    }
    if (count === 3) {
      const layouts = [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 1, h: 0.5 },
      ];
      return cards.map((c, idx) => ({ ...c, layout: { ...c.layout, ...layouts[idx] } }));
    }
    if (count >= 4) {
      const layouts = [
        { x: 0, y: 0, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0, w: 0.5, h: 0.5 },
        { x: 0, y: 0.5, w: 0.5, h: 0.5 },
        { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      ];
      return cards.map((c, idx) => ({ ...c, layout: { ...c.layout, ...layouts[Math.min(idx, 3)] } }));
    }
    return cards;
  };

  // 🔥 Ensure no overlap; if overlap exists, auto-layout
  const ensureNoOverlapTooltip = (cards: TooltipCardConfig[]): TooltipCardConfig[] => {
    if (!hasAnyOverlapTooltip(cards)) return cards;
    return applyAutoLayoutTooltip(cards);
  };

  // 🔥 Find the nearest valid position that doesn't overlap with any other card
  const findNearestValidPosition = (
    movingCardIndex: number,
    targetLayout: TooltipCardLayout,
    cards: TooltipCardConfig[]
  ): TooltipCardLayout | null => {
    // First check if target position is already valid
    if (!hasCollision(targetLayout, movingCardIndex, cards)) {
      return targetLayout;
    }
    
    // Try to find a valid position by adjusting slightly
    const gridStep = 1 / GRID_COLS;
    const maxSteps = 6; // Search up to 6 grid steps in each direction
    
    for (let step = 1; step <= maxSteps; step++) {
      const offset = step * gridStep;
      
      // Try different directions: right, left, down, up, diagonals
      const directions = [
        { dx: offset, dy: 0 },      // right
        { dx: -offset, dy: 0 },     // left
        { dx: 0, dy: offset },      // down
        { dx: 0, dy: -offset },     // up
        { dx: offset, dy: offset }, // down-right
        { dx: -offset, dy: offset },// down-left
        { dx: offset, dy: -offset },// up-right
        { dx: -offset, dy: -offset }// up-left
      ];
      
      for (const { dx, dy } of directions) {
        const testLayout = {
          ...targetLayout,
          x: snapToGrid(clamp(targetLayout.x + dx, 0, 1 - targetLayout.w)),
          y: snapToGrid(clamp(targetLayout.y + dy, 0, 1 - targetLayout.h)),
        };
        
        if (!hasCollision(testLayout, movingCardIndex, cards)) {
          return testLayout;
        }
      }
    }
    
    // No valid position found
    return null;
  };

  // Handle resize
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      const deltaX = (e.clientX - resizing.startX) / rect.width;
      const deltaY = (e.clientY - resizing.startY) / rect.height;
      
      const newCards = [...tooltipCards];
      const card = newCards[resizing.cardIndex];
      const start = resizing.startLayout;
      let newLayout = { ...card.layout };

      switch (resizing.edge) {
        case 'e': newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x)); break;
        case 'w': 
          const newX_w = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_w));
          newLayout.x = newX_w;
          break;
        case 's': newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y)); break;
        case 'n':
          const newY_n = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_n));
          newLayout.y = newY_n;
          break;
        case 'se':
          newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x));
          newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y));
          break;
        case 'sw':
          const newX_sw = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_sw));
          newLayout.x = newX_sw;
          newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y));
          break;
        case 'ne':
          newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x));
          const newY_ne = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_ne));
          newLayout.y = newY_ne;
          break;
        case 'nw':
          const newX_nw = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_nw));
          newLayout.x = newX_nw;
          const newY_nw = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_nw));
          newLayout.y = newY_nw;
          break;
      }

      // 🔥 Check for collision and find nearest valid position
      const wouldCollide = hasCollision(newLayout, resizing.cardIndex, newCards);
      
      if (wouldCollide) {
        // Try to find a valid nearby position
        const validPosition = findNearestValidPosition(resizing.cardIndex, newLayout, newCards);
        if (validPosition) {
          newCards[resizing.cardIndex] = { ...card, layout: validPosition };
          onLayoutChange(newCards);
          setHasOverlap(false);
        } else {
          // No valid position - show overlap indicator and don't apply
          setHasOverlap(true);
        }
      } else {
        // No collision - apply directly
        newCards[resizing.cardIndex] = { ...card, layout: newLayout };
        onLayoutChange(newCards);
        setHasOverlap(false);
      }
    };

    const handleMouseUp = () => {
      setResizing(null);
      setHasOverlap(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, tooltipCards, onLayoutChange]);

  // Handle drag
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      const deltaX = (e.clientX - dragging.startX) / rect.width;
      const deltaY = (e.clientY - dragging.startY) / rect.height;
      
      const newCards = [...tooltipCards];
      const card = newCards[dragging.cardIndex];
      
      let newX = snapToGrid(clamp(dragging.startLayout.x + deltaX, 0, 1 - card.layout.w));
      let newY = snapToGrid(clamp(dragging.startLayout.y + deltaY, 0, 1 - card.layout.h));

      const newLayout = { ...card.layout, x: newX, y: newY };
      
      // 🔥 Check for collision - block if overlapping
      const wouldCollide = hasCollision(newLayout, dragging.cardIndex, newCards);
      
      if (wouldCollide) {
        // Try to find a valid nearby position
        const validPosition = findNearestValidPosition(dragging.cardIndex, newLayout, newCards);
        if (validPosition) {
          newCards[dragging.cardIndex] = { ...card, layout: validPosition };
          onLayoutChange(newCards);
          setHasOverlap(false);
        } else {
          // No valid position - show overlap indicator and don't apply
          setHasOverlap(true);
        }
      } else {
        // No collision - apply directly
        newCards[dragging.cardIndex] = { ...card, layout: newLayout };
        onLayoutChange(newCards);
        setHasOverlap(false);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setHasOverlap(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, tooltipCards, onLayoutChange]);

  const findAvailablePosition = (): { x: number; y: number; w: number; h: number } => {
    const defaultSize = { w: 3 / GRID_COLS, h: 3 / GRID_ROWS };
    
    // Strategy 1: Try grid positions to find a free spot
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const testLayout = { id: 'test', x: x / GRID_COLS, y: y / GRID_ROWS, w: defaultSize.w, h: defaultSize.h };
        if (testLayout.x + testLayout.w > 1 || testLayout.y + testLayout.h > 1) continue;
        const hasAnyCollision = tooltipCards.some(card => cardsOverlap(testLayout, card.layout));
        if (!hasAnyCollision) return { x: testLayout.x, y: testLayout.y, ...defaultSize };
      }
    }
    
    // Strategy 2: Try smaller sizes
    const smallerSizes = [
      { w: 2 / GRID_COLS, h: 2 / GRID_ROWS },
      { w: 2 / GRID_COLS, h: 3 / GRID_ROWS },
      { w: 3 / GRID_COLS, h: 2 / GRID_ROWS },
    ];
    
    for (const size of smallerSizes) {
      for (let y = 0; y <= GRID_ROWS - (size.h * GRID_ROWS); y++) {
        for (let x = 0; x <= GRID_COLS - (size.w * GRID_COLS); x++) {
          const testLayout = { id: 'test', x: x / GRID_COLS, y: y / GRID_ROWS, w: size.w, h: size.h };
          const hasAnyCollision = tooltipCards.some(card => cardsOverlap(testLayout, card.layout));
          if (!hasAnyCollision) return { x: testLayout.x, y: testLayout.y, ...size };
        }
      }
    }
    
    // Strategy 3: Find the first row with space at the bottom
    const cardBottoms = tooltipCards.map(c => c.layout.y + c.layout.h);
    const lowestBottom = Math.max(...cardBottoms, 0);
    
    if (lowestBottom + defaultSize.h <= 1) {
      return { x: 0, y: snapToGrid(lowestBottom), ...defaultSize };
    }
    
    // Strategy 4: Place next to existing cards
    for (const card of tooltipCards) {
      // Try right of each card
      const rightX = card.layout.x + card.layout.w;
      if (rightX + defaultSize.w <= 1) {
        const testLayout = { id: 'test', x: rightX, y: card.layout.y, ...defaultSize };
        const hasAnyCollision = tooltipCards.some(c => cardsOverlap(testLayout, c.layout));
        if (!hasAnyCollision) return { x: snapToGrid(rightX), y: snapToGrid(card.layout.y), ...defaultSize };
      }
      
      // Try below each card
      const belowY = card.layout.y + card.layout.h;
      if (belowY + defaultSize.h <= 1) {
        const testLayout = { id: 'test', x: card.layout.x, y: belowY, ...defaultSize };
        const hasAnyCollision = tooltipCards.some(c => cardsOverlap(testLayout, c.layout));
        if (!hasAnyCollision) return { x: snapToGrid(card.layout.x), y: snapToGrid(belowY), ...defaultSize };
      }
    }
    
    // Strategy 5: Use a grid-based layout
    const numCards = tooltipCards.length;
    if (numCards === 1) {
      return { x: 0.5, y: 0, w: 0.5, h: 0.5 };
    } else if (numCards === 2) {
      return { x: 0, y: 0.5, w: 0.5, h: 0.5 };
    } else if (numCards === 3) {
      return { x: 0.5, y: 0.5, w: 0.5, h: 0.5 };
    }
    
    // Final fallback
    return { x: 0, y: 0, w: MIN_SIZE * 3, h: MIN_SIZE * 3 };
  };

  const handleAddCard = () => {
    if (tooltipCards.length >= 4) return;
    const position = findAvailablePosition();
    const newCard = createDefaultTooltipCard(`tooltip-card-${tooltipCards.length + 1}`, { id: `tooltip-card-${tooltipCards.length + 1}`, ...position });
    // Apply fixOverlaps to ensure no overlap occurs; if still overlap, auto-layout
    const newCards = ensureNoOverlapTooltip([...tooltipCards, newCard]);
    onLayoutChange(newCards);
  };

  const handleRemoveCard = (index: number) => {
    if (tooltipCards.length <= 1) return;
    const newCards = tooltipCards.filter((_, i) => i !== index);
    onLayoutChange(newCards);
    if (selectedCardIndex >= newCards.length) onSelectCard(Math.max(0, newCards.length - 1));
  };

  const getResizeHandleStyle = (edge: ResizeEdge): React.CSSProperties => {
    const base: React.CSSProperties = { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.5)', zIndex: 10 };
    switch (edge) {
      case 'n': return { ...base, top: 0, left: '20%', right: '20%', height: 4, cursor: 'ns-resize', borderRadius: '0 0 2px 2px' };
      case 's': return { ...base, bottom: 0, left: '20%', right: '20%', height: 4, cursor: 'ns-resize', borderRadius: '2px 2px 0 0' };
      case 'e': return { ...base, right: 0, top: '20%', bottom: '20%', width: 4, cursor: 'ew-resize', borderRadius: '2px 0 0 2px' };
      case 'w': return { ...base, left: 0, top: '20%', bottom: '20%', width: 4, cursor: 'ew-resize', borderRadius: '0 2px 2px 0' };
      case 'ne': return { ...base, top: 0, right: 0, width: 8, height: 8, cursor: 'nesw-resize', borderRadius: '0 0 0 4px' };
      case 'nw': return { ...base, top: 0, left: 0, width: 8, height: 8, cursor: 'nwse-resize', borderRadius: '0 0 4px 0' };
      case 'se': return { ...base, bottom: 0, right: 0, width: 8, height: 8, cursor: 'nwse-resize', borderRadius: '4px 0 0 0' };
      case 'sw': return { ...base, bottom: 0, left: 0, width: 8, height: 8, cursor: 'nesw-resize', borderRadius: '0 4px 0 0' };
      default: return base;
    }
  };

  return (
    <Box>
      {allowAddRemove && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddCard}
            disabled={tooltipCards.length >= 4}
            sx={{ fontSize: '0.7rem', py: 0.25, borderColor: '#667eea', color: '#667eea' }}
          >
            Add
          </Button>
          <Chip 
            label={`${tooltipCards.length}/4`}
            size="small"
            sx={{ height: 20, fontSize: '0.65rem', bgcolor: tooltipCards.length >= 4 ? 'rgba(239,68,68,0.1)' : 'rgba(102,126,234,0.1)', color: tooltipCards.length >= 4 ? '#ef4444' : '#667eea' }}
          />
          {hasOverlap && <Chip label="⚠ Overlap" size="small" sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444' }} />}
        </Box>
      )}

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: height,
          bgcolor: 'rgba(0,0,0,0.02)',
          borderRadius: 1.5,
          border: hasOverlap ? '2px solid #ef4444' : '2px dashed rgba(102, 126, 234, 0.3)',
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'default',
        }}
      >
        {/* Grid lines */}
        <Box sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: `linear-gradient(rgba(102,126,234,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(102,126,234,0.06) 1px, transparent 1px)`,
          backgroundSize: `${100/GRID_COLS}% ${100/GRID_ROWS}%`,
        }} />

        {/* Cards */}
        {tooltipCards.map((card, index) => (
          <Box
            key={card.id}
            onClick={() => onSelectCard(index)}
            sx={{
              position: 'absolute',
              left: `${card.layout.x * 100}%`,
              top: `${card.layout.y * 100}%`,
              width: `${card.layout.w * 100}%`,
              height: `${card.layout.h * 100}%`,
              p: 0.25,
              boxSizing: 'border-box',
              zIndex: dragging?.cardIndex === index || resizing?.cardIndex === index ? 100 : (selectedCardIndex === index ? 10 : 1),
            }}
          >
            <Paper
              elevation={dragging?.cardIndex === index || resizing?.cardIndex === index ? 6 : (selectedCardIndex === index ? 4 : 1)}
              sx={{
                height: '100%',
                borderRadius: 1,
                bgcolor: card.type === 'chart' ? '#667eea' : card.type === 'table' ? '#10b981' : '#f59e0b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                cursor: 'grab',
                userSelect: 'none',
                border: selectedCardIndex === index ? '2px solid rgba(255,255,255,0.9)' : '2px solid transparent',
                transition: (dragging?.cardIndex === index || resizing?.cardIndex === index) ? 'none' : 'all 0.15s',
                '&:hover': { boxShadow: 4, '& .resize-handle': { opacity: 1 } },
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).dataset.resize) return;
                setDragging({ cardIndex: index, startX: e.clientX, startY: e.clientY, startLayout: { ...card.layout } });
              }}
            >
              {allowAddRemove && tooltipCards.length > 1 && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleRemoveCard(index); }}
                  sx={{ position: 'absolute', top: 2, right: 2, p: 0.15, bgcolor: 'rgba(0,0,0,0.3)', color: 'white', zIndex: 20, '&:hover': { bgcolor: 'rgba(239,68,68,0.9)' } }}
                >
                  <CloseIcon sx={{ fontSize: 12 }} />
                </IconButton>
              )}

              <OpenWithIcon sx={{ fontSize: 16, opacity: 0.8, mb: 0.25 }} />
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.65rem' }}>
                {index + 1}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.5rem', opacity: 0.8, textTransform: 'capitalize' }}>
                {card.type}
              </Typography>

              {/* Resize handles */}
              {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
                <Box
                  key={edge}
                  data-resize={edge}
                  className="resize-handle"
                  sx={{ ...getResizeHandleStyle(edge), opacity: 0.4, transition: 'opacity 0.15s', '&:hover': { opacity: 1, bgcolor: 'rgba(255,255,255,0.8)' } }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizing({ cardIndex: index, edge, startX: e.clientX, startY: e.clientY, startLayout: { ...card.layout } });
                  }}
                />
              ))}
            </Paper>
          </Box>
        ))}

        {tooltipCards.length === 0 && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <AddIcon sx={{ fontSize: 24, color: '#9ca3af' }} />
            <Typography variant="caption" color="#9ca3af">Click "Add" to add cards</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

// Safe parse helper
const safeParse = (value: any): any => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

// 🔥 Confirmation Dialog for destructive layout changes
interface LayoutChangeDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentCardCount: number;
  newCardCount: number;
  presetLabel: string;
}

const LayoutChangeDialog: React.FC<LayoutChangeDialogProps> = ({
  open,
  onClose,
  onConfirm,
  currentCardCount,
  newCardCount,
  presetLabel,
}) => {
  const cardsToRemove = currentCardCount - newCardCount;
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WarningIcon sx={{ color: '#f59e0b' }} />
        <span>Confirm Layout Change</span>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <AlertTitle>Cards Will Be Removed</AlertTitle>
          Switching to <strong>"{presetLabel}"</strong> layout will remove{' '}
          <strong>{cardsToRemove} card{cardsToRemove > 1 ? 's' : ''}</strong>.
          Any configuration on removed cards will be lost.
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Current: {currentCardCount} cards → New: {newCardCount} cards
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<CloseIcon />}>
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          variant="contained" 
          color="warning"
          startIcon={<CheckIcon />}
        >
          Apply Change
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function MultiCardTooltipConfigTab() {
  const { id } = useParams<{ id: string }>();
  
  // State
  const [selectedChildCardId, setSelectedChildCardId] = useState<string | null>(null);
  const [selectedTooltipCardIndex, setSelectedTooltipCardIndex] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | false>('content');
  const [testValues, setTestValues] = useState<Record<string, any>>({});
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [showCustomLayout, setShowCustomLayout] = useState(false);
  const [variableSearch, setVariableSearch] = useState<string>('');
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  
  // 🔥 Pending layout state for confirmation dialog
  const [pendingLayoutCards, setPendingLayoutCards] = useState<TooltipCardConfig[] | null>(null);
  const [pendingLayoutPreset, setPendingLayoutPreset] = useState<string | null>(null);
  
  // 🔥 Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    presetKey: string;
    presetLabel: string;
    newCardCount: number;
  }>({ open: false, presetKey: '', presetLabel: '', newCardCount: 0 });
  
  // Recoil state
  const [tooltipConfigs, setTooltipConfigs] = useRecoilState(childCardTooltipConfigState);
  const parentCardConfigs = useRecoilValue(childCardConfigState);
  const parentConfig = parentCardConfigs[id || ''];
  const arrayOfObjectsVariables = useRecoilValue(hooksArrayOfObjectsSelector);
  const variableNames = useRecoilValue(variableNamesState);
  const filterNames = useRecoilValue(filterNamesState);
  const parameterNames = useRecoilValue(parameterNamesState);

  // Get child cards from parent config
  const childCards = useMemo(() => {
    return parentConfig?.childCards || [];
  }, [parentConfig]);

  // Set first child card as selected by default
  useEffect(() => {
    if (childCards.length > 0 && !selectedChildCardId) {
      setSelectedChildCardId(childCards[0].id);
    }
  }, [childCards, selectedChildCardId]);

  // Get tooltip config for selected child card
  const childCardKey = selectedChildCardId ? `${id}_${selectedChildCardId}` : null;
  const tooltipConfig: ChildCardTooltipConfig = useMemo(() => {
    if (!childCardKey) return defaultChildCardTooltipConfig;
    return tooltipConfigs[childCardKey] || defaultChildCardTooltipConfig;
  }, [tooltipConfigs, childCardKey]);

  // Update tooltip config
  const updateTooltipConfig = useCallback((updates: Partial<ChildCardTooltipConfig>) => {
    if (!childCardKey) return;
    setTooltipConfigs(prev => ({
      ...prev,
      [childCardKey]: {
        ...defaultChildCardTooltipConfig,
        ...prev[childCardKey],
        ...updates,
      },
    }));
  }, [childCardKey, setTooltipConfigs]);

  // Get current layout preset key
  const currentPresetKey = useMemo(() => {
    const cards = tooltipConfig.tooltipCards || [];
    if (cards.length === 0 || cards.length === 1) return 'single';
    if (cards.length === 2) {
      const firstCard = cards[0];
      if (firstCard.layout.w === 0.5) return 'twoHorizontal';
      return 'twoVertical';
    }
    if (cards.length === 3) {
      const firstCard = cards[0];
      if (firstCard.layout.w === 1) return 'threeTopOne';
      return 'threeBottomOne';
    }
    return 'fourGrid';
  }, [tooltipConfig.tooltipCards]);

  // Handle layout preset change
  // 🔥 Handle layout preset change with confirmation dialog
  const handleLayoutPresetChange = useCallback((presetKey: string) => {
    const preset = TOOLTIP_LAYOUT_PRESETS[presetKey as keyof typeof TOOLTIP_LAYOUT_PRESETS];
    if (!preset) return;

    const existingCards = tooltipConfig.tooltipCards || [];
    const currentCardCount = existingCards.length;
    const newCardCount = preset.length;
    
    // Build new cards (preserving existing config where possible)
    const newCards: TooltipCardConfig[] = preset.map((layout, index) => {
      const existingCard = existingCards[index];
      if (existingCard) {
        return { ...existingCard, id: layout.id, layout: { ...layout } };
      }
      return createDefaultTooltipCard(layout.id, layout);
    });
    
    // If this would remove cards, show confirmation dialog
    if (currentCardCount > newCardCount) {
      const presetOption = layoutPresetOptions.find(p => p.key === presetKey);
      setPendingLayoutCards(newCards);
      setPendingLayoutPreset(presetKey);
      setConfirmDialog({
        open: true,
        presetKey,
        presetLabel: presetOption?.label || presetKey,
        newCardCount,
      });
      return;
    }
    
    // Otherwise apply immediately
    updateTooltipConfig({ tooltipCards: newCards, useMultiCard: true });
    setSelectedTooltipCardIndex(0);
  }, [tooltipConfig.tooltipCards, updateTooltipConfig]);
  
  // 🔥 Apply pending layout after confirmation
  const applyPendingLayout = useCallback(() => {
    if (pendingLayoutCards) {
      updateTooltipConfig({ tooltipCards: pendingLayoutCards, useMultiCard: true });
      setSelectedTooltipCardIndex(0);
    }
    setPendingLayoutCards(null);
    setPendingLayoutPreset(null);
    setConfirmDialog({ open: false, presetKey: '', presetLabel: '', newCardCount: 0 });
  }, [pendingLayoutCards, updateTooltipConfig]);
  
  // 🔥 Cancel pending layout change
  const cancelPendingLayout = useCallback(() => {
    setPendingLayoutCards(null);
    setPendingLayoutPreset(null);
    setConfirmDialog({ open: false, presetKey: '', presetLabel: '', newCardCount: 0 });
  }, []);

  // Handle adding a new tooltip card
  const handleAddTooltipCard = useCallback(() => {
    const cards = tooltipConfig.tooltipCards || [];
    if (cards.length >= 4) return;
    
    const newCardId = `tooltip-card-${cards.length + 1}`;
    const newLayout: TooltipCardLayout = {
      id: newCardId,
      x: 0,
      y: 0,
      w: 1,
      h: 1 / (cards.length + 1),
    };
    
    const newCard = createDefaultTooltipCard(newCardId, newLayout);
    updateTooltipConfig({ tooltipCards: [...cards, newCard] });
    setSelectedTooltipCardIndex(cards.length);
  }, [tooltipConfig.tooltipCards, updateTooltipConfig]);

  // Handle removing a tooltip card
  const handleRemoveTooltipCard = useCallback((index: number) => {
    const cards = tooltipConfig.tooltipCards || [];
    if (cards.length <= 1) return;
    
    const newCards = cards.filter((_, i) => i !== index);
    updateTooltipConfig({ tooltipCards: newCards });
    setSelectedTooltipCardIndex(Math.min(index, newCards.length - 1));
  }, [tooltipConfig.tooltipCards, updateTooltipConfig]);

  // Update a specific tooltip card
  const updateTooltipCard = useCallback((index: number, updates: Partial<TooltipCardConfig>) => {
    const cards = [...(tooltipConfig.tooltipCards || [])];
    if (!cards[index]) return;
    cards[index] = { ...cards[index], ...updates };
    updateTooltipConfig({ tooltipCards: cards });
  }, [tooltipConfig.tooltipCards, updateTooltipConfig]);

  // Data extraction handlers
  const addDataExtraction = useCallback(() => {
    const newExtraction: TooltipDataExtraction = {
      id: `ext-${Date.now()}`,
      sourceKey: '',
      extractionType: 'hover',
      targetVariable: '',
    };
    updateTooltipConfig({
      dataExtractions: [...(tooltipConfig.dataExtractions || []), newExtraction],
    });
  }, [tooltipConfig.dataExtractions, updateTooltipConfig]);

  const updateDataExtraction = useCallback((index: number, updates: Partial<TooltipDataExtraction>) => {
    const extractions = [...(tooltipConfig.dataExtractions || [])];
    extractions[index] = { ...extractions[index], ...updates };
    updateTooltipConfig({ dataExtractions: extractions });
  }, [tooltipConfig.dataExtractions, updateTooltipConfig]);

  const removeDataExtraction = useCallback((index: number) => {
    const extractions = (tooltipConfig.dataExtractions || []).filter((_, i) => i !== index);
    updateTooltipConfig({ dataExtractions: extractions });
  }, [tooltipConfig.dataExtractions, updateTooltipConfig]);

  // Calculation binding handlers
  const addCalculationBinding = useCallback(() => {
    const newBinding: TooltipCalculationBinding = {
      id: `calc-${Date.now()}`,
      outputVariable: '',
      inlineLogic: '// Write your calculation logic here\n// Available variables: extracted data + all global variables\n\nreturn [];',
    };
    updateTooltipConfig({
      calculationBindings: [...(tooltipConfig.calculationBindings || []), newBinding],
    });
  }, [tooltipConfig.calculationBindings, updateTooltipConfig]);

  const updateCalculationBinding = useCallback((index: number, updates: Partial<TooltipCalculationBinding>) => {
    const bindings = [...(tooltipConfig.calculationBindings || [])];
    bindings[index] = { ...bindings[index], ...updates };
    updateTooltipConfig({ calculationBindings: bindings });
  }, [tooltipConfig.calculationBindings, updateTooltipConfig]);

  const removeCalculationBinding = useCallback((index: number) => {
    const bindings = (tooltipConfig.calculationBindings || []).filter((_, i) => i !== index);
    updateTooltipConfig({ calculationBindings: bindings });
  }, [tooltipConfig.calculationBindings, updateTooltipConfig]);

  // Run preview calculation
  const runPreview = useRecoilCallback(({ snapshot }) => async () => {
    setPreviewError(null);
    
    try {
      const context: Record<string, any> = {};
      
      // Add all existing variables
      for (const varName of Array.from(variableNames)) {
        try {
          const loadable = snapshot.getLoadable(variableAtomFamily(varName));
          if (loadable.state === 'hasValue' && loadable.contents !== undefined) {
            context[varName] = safeParse(loadable.contents);
          }
        } catch { /* ignore */ }
      }

      // Add test values
      Object.entries(testValues).forEach(([key, value]) => {
        context[key] = value;
      });

      const results: Record<string, any> = {};

      // Execute each calculation binding
      for (const binding of (tooltipConfig.calculationBindings || [])) {
        if (!binding.inlineLogic || !binding.outputVariable) continue;

        try {
          const variableDeclarations = Object.entries(context)
            .filter(([name]) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name))
            .map(([name, value]) => {
              const serialized = value === undefined ? 'undefined' : value === null ? 'null' : JSON.stringify(value);
              return `const ${name} = ${serialized};`;
            })
            .join('\n');

          const funcString = `(function() {
            ${variableDeclarations}
            ${binding.inlineLogic}
          })()`;

          const result = eval(funcString);
          results[binding.outputVariable] = result;
          context[binding.outputVariable] = result;
        } catch (error: any) {
          setPreviewError(`Error in "${binding.outputVariable}": ${error.message}`);
          results[binding.outputVariable] = null;
        }
      }

      setPreviewResult(results);
    } catch (error: any) {
      setPreviewError(error.message);
    }
  }, [variableNames, testValues, tooltipConfig.calculationBindings]);

  // Get selected tooltip card
  const selectedTooltipCard = (tooltipConfig.tooltipCards || [])[selectedTooltipCardIndex];

  // Available variables for suggestions (simple array)
  const availableVariables = useMemo(() => {
    const vars = new Set<string>();
    variableNames.forEach(v => vars.add(v));
    (tooltipConfig.dataExtractions || []).forEach(e => e.targetVariable && vars.add(e.targetVariable));
    (tooltipConfig.calculationBindings || []).forEach(b => b.outputVariable && vars.add(b.outputVariable));
    return Array.from(vars);
  }, [variableNames, tooltipConfig.dataExtractions, tooltipConfig.calculationBindings]);

  // Available variables as Record for editor autocomplete
  const availableVariablesRecord = useMemo(() => {
    const record: Record<string, any> = {};
    
    // Add extracted variables with placeholder values
    (tooltipConfig.dataExtractions || []).forEach(e => {
      if (e.targetVariable) {
        record[e.targetVariable] = testValues[e.targetVariable] ?? `(${e.targetVariable})`;
      }
    });
    
    // Add calculation output variables
    (tooltipConfig.calculationBindings || []).forEach(b => {
      if (b.outputVariable) {
        record[b.outputVariable] = previewResult?.[b.outputVariable] ?? [];
      }
    });
    
    // Add global variables, filters, parameters
    variableNames.forEach(name => {
      if (!record[name]) {
        record[name] = `(${name})`;
      }
    });
    filterNames.forEach(name => {
      record[name] = `(${name})`;
    });
    parameterNames.forEach(name => {
      record[name] = `(${name})`;
    });
    
    return record;
  }, [tooltipConfig.dataExtractions, tooltipConfig.calculationBindings, testValues, previewResult, variableNames, filterNames, parameterNames]);

  // Table columns from selected tooltip card's data source
  const tooltipTableColumns = useMemo(() => {
    if (!selectedTooltipCard || selectedTooltipCard.type !== 'table') return [];
    const dataSourceName = selectedTooltipCard.tableDataSource;
    if (!dataSourceName) return [];
    // Try to get columns from preview data
    const data = previewResult?.[dataSourceName];
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      return Object.keys(data[0]);
    }
    return [];
  }, [selectedTooltipCard, previewResult]);

  // Effective table settings for the selected tooltip card
  const effectiveTableSettings: TableSettings = useMemo(() => {
    if (!selectedTooltipCard || selectedTooltipCard.type !== 'table') {
      return defaultTableSettings;
    }
    return {
      ...defaultTableSettings,
      ...(selectedTooltipCard.tableSettings || {}),
    };
  }, [selectedTooltipCard]);

  // Helper to update table settings
  const updateTableSettings = useCallback((settings: Partial<TableSettings>) => {
    if (!selectedTooltipCard || selectedTooltipCard.type !== 'table') return;
    updateTooltipCard(selectedTooltipCardIndex, {
      tableSettings: { ...effectiveTableSettings, ...settings }
    });
  }, [selectedTooltipCard, selectedTooltipCardIndex, effectiveTableSettings, updateTooltipCard]);

  // Grouped variables for the Available Variables panel
  const groupedVariables = useMemo(() => {
    const groups: {
      extraction: Array<{ name: string; value: any }>;
      calculation: Array<{ name: string; value: any }>;
      global: Array<{ name: string }>;
      filter: Array<{ name: string }>;
      parameter: Array<{ name: string }>;
    } = {
      extraction: [],
      calculation: [],
      global: [],
      filter: [],
      parameter: [],
    };

    // Add extracted variables
    (tooltipConfig.dataExtractions || []).forEach(ext => {
      if (ext.targetVariable) {
        groups.extraction.push({
          name: ext.targetVariable,
          value: testValues[ext.targetVariable] ?? null,
        });
      }
    });

    // Add inline calculation outputs
    (tooltipConfig.calculationBindings || []).forEach(binding => {
      if (binding.outputVariable) {
        groups.calculation.push({
          name: binding.outputVariable,
          value: previewResult?.[binding.outputVariable] ?? null,
        });
      }
    });

    // Add global variables (from calculation tab)
    variableNames.forEach(name => {
      // Skip if already in extraction or calculation
      if (!groups.extraction.some(e => e.name === name) && 
          !groups.calculation.some(c => c.name === name)) {
        groups.global.push({ name });
      }
    });

    // Add filters
    filterNames.forEach(name => {
      groups.filter.push({ name });
    });

    // Add parameters
    parameterNames.forEach(name => {
      groups.parameter.push({ name });
    });

    return groups;
  }, [tooltipConfig.dataExtractions, tooltipConfig.calculationBindings, testValues, previewResult, variableNames, filterNames, parameterNames]);

  // Filter variables based on search
  const filteredGroupedVariables = useMemo(() => {
    if (!variableSearch) return groupedVariables;
    const search = variableSearch.toLowerCase();
    return {
      extraction: groupedVariables.extraction.filter(v => v.name.toLowerCase().includes(search)),
      calculation: groupedVariables.calculation.filter(v => v.name.toLowerCase().includes(search)),
      global: groupedVariables.global.filter(v => v.name.toLowerCase().includes(search)),
      filter: groupedVariables.filter.filter(v => v.name.toLowerCase().includes(search)),
      parameter: groupedVariables.parameter.filter(v => v.name.toLowerCase().includes(search)),
    };
  }, [groupedVariables, variableSearch]);

  // Copy variable name handler
  const handleVariableCopy = useCallback((varName: string) => {
    navigator.clipboard.writeText(`\${${varName}}`);
    setCopiedVariable(varName);
    setTimeout(() => setCopiedVariable(null), 1500);
  }, []);

  // Calculate tooltip stats for the info panel (must be before early return)
  const tooltipStats = useMemo(() => {
    const enabledCount = childCards.filter(child => {
      const key = `${id}_${child.id}`;
      return tooltipConfigs[key]?.enabled;
    }).length;
    const totalExtractions = tooltipConfig.dataExtractions?.length || 0;
    const totalCalculations = tooltipConfig.calculationBindings?.length || 0;
    const totalTooltipCards = tooltipConfig.tooltipCards?.length || 0;
    return { enabledCount, totalExtractions, totalCalculations, totalTooltipCards };
  }, [childCards, id, tooltipConfigs, tooltipConfig]);

  // If no child cards exist, show message
  if (childCards.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <TouchAppIcon sx={{ fontSize: 64, color: '#cbd5e1', mb: 2 }} />
        <Typography variant="h6" color="#64748b" gutterBottom>
          No Child Cards Available
        </Typography>
        <Typography variant="body2" color="#94a3b8">
          Please configure child cards in the "MultiCard Viz Config" tab first,
          then return here to set up tooltips for each child card.
        </Typography>
      </Box>
    );
  }

  return (
    <>
    {/* 🔥 Confirmation Dialog for layout changes */}
    <LayoutChangeDialog
      open={confirmDialog.open}
      onClose={cancelPendingLayout}
      onConfirm={applyPendingLayout}
      currentCardCount={(tooltipConfig.tooltipCards || []).length}
      newCardCount={confirmDialog.newCardCount}
      presetLabel={confirmDialog.presetLabel}
    />
    
    <Box sx={{ display: 'flex', height: 'calc(100vh - 200px)', minHeight: 600 }}>
      {/* SECTION 1: LEFT - Select Child Card + Stats */}
      <Box sx={{ 
        width: 220, 
        flexShrink: 0, 
        borderRight: '1px solid rgba(102, 126, 234, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'rgba(102, 126, 234, 0.02)',
      }}>
        {/* Child Card Selector */}
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(102, 126, 234, 0.15)' }}>
          <Typography variant="subtitle2" fontWeight={700} color="#667eea" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            📊 Select Child Card
            <Chip label={childCards.length} size="small" sx={{ height: 16, fontSize: '0.55rem', bgcolor: '#667eea20', color: '#667eea' }} />
          </Typography>
          <Stack spacing={0.5}>
            {childCards.map((child, index) => {
              const key = `${id}_${child.id}`;
              const config = tooltipConfigs[key];
              const isEnabled = config?.enabled;
              const isSelected = selectedChildCardId === child.id;
              
              return (
                <Paper
                  key={child.id}
                  onClick={() => setSelectedChildCardId(child.id)}
                  elevation={0}
                  sx={{
                    p: 1,
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #667eea' : '1px solid rgba(102, 126, 234, 0.15)',
                    bgcolor: isSelected ? 'rgba(102, 126, 234, 0.1)' : 'white',
                    borderRadius: 1,
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#667eea', bgcolor: 'rgba(102, 126, 234, 0.05)' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Typography sx={{ fontSize: '1.1rem' }}>
                        {child.type === 'chart' ? '📊' : child.type === 'table' ? '📋' : '📝'}
                      </Typography>
                      <Box>
                        <Typography variant="caption" fontWeight={isSelected ? 700 : 500} sx={{ display: 'block', lineHeight: 1.2 }}>
                          Card {index + 1}
                        </Typography>
                        <Typography variant="caption" color="#94a3b8" sx={{ fontSize: '0.6rem', textTransform: 'capitalize' }}>
                          {child.type}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      label={isEnabled ? '✓' : '○'}
                      size="small"
                      sx={{
                        height: 18,
                        width: 18,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        bgcolor: isEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                        color: isEnabled ? '#22c55e' : '#94a3b8',
                        '& .MuiChip-label': { px: 0 },
                      }}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
        
        {/* Stats & Info Panel - Fill remaining space */}
        <Box sx={{ flex: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {/* Quick Stats */}
          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'white' }}>
            <Typography variant="caption" fontWeight={700} color="#667eea" sx={{ mb: 1, display: 'block' }}>
              📈 Tooltip Stats
            </Typography>
            <Stack spacing={0.75}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="#64748b">Enabled</Typography>
                <Chip label={`${tooltipStats.enabledCount}/${childCards.length}`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#22c55e20', color: '#22c55e', fontWeight: 700 }} />
              </Box>
              {selectedChildCardId && tooltipConfig.enabled && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="#64748b">Cards</Typography>
                    <Chip label={tooltipStats.totalTooltipCards} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#667eea20', color: '#667eea', fontWeight: 700 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="#64748b">Extractions</Typography>
                    <Chip label={tooltipStats.totalExtractions} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f59e0b20', color: '#f59e0b', fontWeight: 700 }} />
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="#64748b">Calculations</Typography>
                    <Chip label={tooltipStats.totalCalculations} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#8b5cf620', color: '#8b5cf6', fontWeight: 700 }} />
                  </Box>
                </>
              )}
            </Stack>
          </Paper>
          
          {/* Current Selection Info */}
          {selectedChildCardId && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 1.5, border: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'white' }}>
              <Typography variant="caption" fontWeight={700} color="#667eea" sx={{ mb: 1, display: 'block' }}>
                🎯 Selected Card
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>
                  {childCards.find(c => c.id === selectedChildCardId)?.type === 'chart' ? '📊' 
                    : childCards.find(c => c.id === selectedChildCardId)?.type === 'table' ? '📋' : '📝'}
                </Typography>
                <Box>
                  <Typography variant="body2" fontWeight={600}>
                    Card {childCards.findIndex(c => c.id === selectedChildCardId) + 1}
                  </Typography>
                  <Typography variant="caption" color="#94a3b8" sx={{ textTransform: 'capitalize' }}>
                    {childCards.find(c => c.id === selectedChildCardId)?.type}
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 0.5, 
                p: 0.75, 
                borderRadius: 1, 
                bgcolor: tooltipConfig.enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(148, 163, 184, 0.1)' 
              }}>
                <Box sx={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  bgcolor: tooltipConfig.enabled ? '#22c55e' : '#94a3b8',
                  animation: tooltipConfig.enabled ? 'pulse 2s infinite' : 'none',
                  '@keyframes pulse': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
                }} />
                <Typography variant="caption" fontWeight={600} color={tooltipConfig.enabled ? '#22c55e' : '#94a3b8'}>
                  Tooltip {tooltipConfig.enabled ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
            </Paper>
          )}
          
          {/* Help tip */}
          <Box sx={{ mt: 'auto', p: 1, bgcolor: 'rgba(102, 126, 234, 0.05)', borderRadius: 1, border: '1px dashed rgba(102, 126, 234, 0.2)' }}>
            <Typography variant="caption" color="#667eea" sx={{ display: 'block', fontWeight: 600, mb: 0.25 }}>
              💡 Quick Tip
            </Typography>
            <Typography variant="caption" color="#64748b" sx={{ fontSize: '0.6rem', lineHeight: 1.3 }}>
              Each child card can have its own multi-card tooltip. Configure extractions to pass hover data to tooltip cards.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* SECTION 2: MIDDLE - Tooltip Configuration (larger section) */}
      <Box sx={{ 
        flex: 1, 
        borderRight: '1px solid rgba(102, 126, 234, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Section Header - Enable Toggle */}
        {selectedChildCardId && (
          <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'rgba(102, 126, 234, 0.02)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TouchAppIcon sx={{ color: '#667eea', fontSize: 22 }} />
                <Typography variant="subtitle1" fontWeight={700} color="#667eea">
                  Tooltip Configuration
                </Typography>
                {tooltipConfig.enabled && (
                  <Chip
                    label={`${(tooltipConfig.tooltipCards || []).length} card${(tooltipConfig.tooltipCards || []).length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#22c55e20', color: '#22c55e', fontWeight: 600 }}
                  />
                )}
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={tooltipConfig.enabled}
                    onChange={(e) => updateTooltipConfig({ enabled: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: '#667eea' },
                    }}
                  />
                }
                label={<Typography variant="caption" fontWeight={600} color={tooltipConfig.enabled ? '#667eea' : '#64748b'}>{tooltipConfig.enabled ? 'Enabled' : 'Disabled'}</Typography>}
                sx={{ mr: 0 }}
              />
            </Box>
          </Box>
        )}
        
        {/* Main Config Content */}
        {selectedChildCardId && tooltipConfig.enabled && (
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {/* Layout Controls - Two Column Layout */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, border: '1px solid rgba(102, 126, 234, 0.15)', borderRadius: 2, bgcolor: 'rgba(102, 126, 234, 0.02)' }}>
              <Box sx={{ display: 'flex', gap: 3 }}>
                {/* LEFT HALF - Layout Presets (Bigger buttons like MultiCard Viz Config) */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#667eea" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📐 Layout Preset
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                    {layoutPresetOptions.map((option) => {
                      const isSelected = (option.key === 'custom' && showCustomLayout) || 
                        (option.key !== 'custom' && !showCustomLayout && currentPresetKey === option.key);
                      return (
                        <Tooltip key={option.key} title={option.description} arrow placement="top">
                          <Button
                            fullWidth
                            variant={isSelected ? 'contained' : 'outlined'}
                            onClick={() => {
                              if (option.key === 'custom') {
                                setShowCustomLayout(true);
                              } else {
                                setShowCustomLayout(false);
                                handleLayoutPresetChange(option.key);
                              }
                            }}
                            sx={{
                              py: 1.5,
                              px: 0.5,
                              minWidth: 0,
                              flexDirection: 'column',
                              borderColor: 'rgba(102, 126, 234, 0.3)',
                              color: isSelected ? 'white' : '#667eea',
                              background: isSelected 
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                                : 'white',
                              boxShadow: isSelected ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none',
                              '&:hover': {
                                borderColor: '#667eea',
                                background: isSelected 
                                  ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                                  : 'rgba(102, 126, 234, 0.08)',
                              },
                            }}
                          >
                            <Typography sx={{ fontSize: '1.5rem', mb: 0.25, lineHeight: 1 }}>{option.icon}</Typography>
                            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontWeight: 600, lineHeight: 1.1 }}>{option.label}</Typography>
                          </Button>
                        </Tooltip>
                      );
                    })}
                  </Box>
                  
                  {/* Custom Layout Builder (row-based) */}
                  {showCustomLayout && (
                    <CustomTooltipLayoutBuilder
                      tooltipCards={tooltipConfig.tooltipCards || []}
                      onCardsChange={(cards) => updateTooltipConfig({ tooltipCards: cards, useMultiCard: true })}
                      selectedCardIndex={selectedTooltipCardIndex}
                      setSelectedCardIndex={setSelectedTooltipCardIndex}
                    />
                  )}
                </Box>
                
                {/* RIGHT HALF - Size Controls */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#667eea" sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    📏 Tooltip Size
                  </Typography>
                  <Stack spacing={2}>
                    {/* Gap */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="#64748b">Card Gap</Typography>
                        <Chip label={`${tooltipConfig.gap ?? 4}px`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#667eea20', color: '#667eea', fontWeight: 700 }} />
                      </Box>
                      <Slider 
                        value={tooltipConfig.gap ?? 4} 
                        min={0} 
                        max={16} 
                        step={2} 
                        onChange={(_, value) => updateTooltipConfig({ gap: value as number })} 
                        size="small" 
                        sx={{ color: '#667eea' }} 
                      />
                    </Box>
                    
                    {/* Width */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="#64748b">Width</Typography>
                        <Chip label={`${tooltipConfig.width ?? 400}px`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#10b98120', color: '#10b981', fontWeight: 700 }} />
                      </Box>
                      <Slider 
                        value={tooltipConfig.width ?? 400} 
                        min={200} 
                        max={800} 
                        step={50} 
                        onChange={(_, value) => updateTooltipConfig({ width: value as number })} 
                        size="small" 
                        sx={{ color: '#10b981' }} 
                      />
                    </Box>
                    
                    {/* Height */}
                    <Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="#64748b">Height</Typography>
                        <Chip label={`${tooltipConfig.height ?? 300}px`} size="small" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#f59e0b20', color: '#f59e0b', fontWeight: 700 }} />
                      </Box>
                      <Slider 
                        value={tooltipConfig.height ?? 300} 
                        min={150} 
                        max={1000} 
                        step={50} 
                        onChange={(_, value) => updateTooltipConfig({ height: value as number })} 
                        size="small" 
                        sx={{ color: '#f59e0b' }} 
                      />
                    </Box>
                  </Stack>
                </Box>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              {/* Interactive Drag & Resize Layout Editor */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#667eea">
                    🖱️ Interactive Layout Editor
                  </Typography>
                  <Typography variant="caption" color="#94a3b8">
                    Drag to move • Drag edges to resize • Click to select
                  </Typography>
                </Box>
                <InteractiveTooltipLayoutEditor
                  tooltipCards={tooltipConfig.tooltipCards || []}
                  onLayoutChange={(cards) => updateTooltipConfig({ tooltipCards: cards, useMultiCard: true })}
                  selectedCardIndex={selectedTooltipCardIndex}
                  onSelectCard={setSelectedTooltipCardIndex}
                  allowAddRemove={true}
                  height={160}
                />
              </Box>
            </Paper>

            {/* 🎯 Quick Switch - Tooltip Cards (like MultiCard Viz Config) */}
            {(tooltipConfig.tooltipCards || []).length > 0 && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 2,
                  borderRadius: 2,
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={700} color="#667eea">
                    🎯 Quick Switch: Card {selectedTooltipCardIndex + 1} of {(tooltipConfig.tooltipCards || []).length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {(tooltipConfig.tooltipCards || []).map((card, index) => (
                    <Chip
                      key={`quick-${card.id}-${index}`}
                      label={`Card ${index + 1} (${card.type})`}
                      icon={
                        card.type === 'chart' ? <ChartIcon sx={{ fontSize: '14px !important' }} /> :
                        card.type === 'table' ? <TableIcon sx={{ fontSize: '14px !important' }} /> :
                        <HtmlIcon sx={{ fontSize: '14px !important' }} />
                      }
                      onClick={() => setSelectedTooltipCardIndex(index)}
                      sx={{
                        cursor: 'pointer',
                        fontWeight: selectedTooltipCardIndex === index ? 700 : 500,
                        bgcolor: selectedTooltipCardIndex === index 
                          ? (card.type === 'chart' ? '#667eea' : card.type === 'table' ? '#10b981' : '#f59e0b')
                          : 'white',
                        color: selectedTooltipCardIndex === index 
                          ? 'white'
                          : (card.type === 'chart' ? '#667eea' : card.type === 'table' ? '#10b981' : '#f59e0b'),
                        border: selectedTooltipCardIndex === index 
                          ? 'none'
                          : `2px solid ${card.type === 'chart' ? '#667eea' : card.type === 'table' ? '#10b981' : '#f59e0b'}`,
                        '&:hover': {
                          bgcolor: selectedTooltipCardIndex === index 
                            ? (card.type === 'chart' ? '#5568d3' : card.type === 'table' ? '#0ea572' : '#e08e0a')
                            : (card.type === 'chart' ? 'rgba(102, 126, 234, 0.15)' : card.type === 'table' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                        },
                      }}
                    />
                  ))}
                </Box>
              </Paper>
            )}

          {/* Data Extraction Section */}
          <Accordion
            expanded={expandedSection === 'extraction'}
            onChange={(_, expanded) => setExpandedSection(expanded ? 'extraction' : false)}
            sx={{ mt: 2, boxShadow: 'none', border: '1px solid rgba(102, 126, 234, 0.15)', '&:before': { display: 'none' }, borderRadius: '8px !important' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <DataObjectIcon sx={{ color: '#667eea', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>Data Extraction</Typography>
                <Chip label={(tooltipConfig.dataExtractions || []).length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#667eea20', color: '#667eea' }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                <Typography variant="caption">
                  Extract data from the hovered chart point. Use paths like <code>category</code>, <code>y</code>, <code>options.custom.data</code>
                </Typography>
              </Alert>

              {(tooltipConfig.dataExtractions || []).map((extraction, index) => (
                <Paper key={extraction.id} elevation={0} sx={{ p: 1.5, mb: 1, bgcolor: 'rgba(102, 126, 234, 0.02)', border: '1px solid rgba(102, 126, 234, 0.1)', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 110 }}>
                      <InputLabel>Source</InputLabel>
                      <Select
                        value={extraction.extractionType}
                        label="Source"
                        onChange={(e) => updateDataExtraction(index, { extractionType: e.target.value as 'hover' | 'config' })}
                      >
                        <MenuItem value="hover">Hover Point</MenuItem>
                        <MenuItem value="config">Chart Config</MenuItem>
                      </Select>
                    </FormControl>

                    <Autocomplete
                      freeSolo
                      options={AVAILABLE_HOVER_KEYS.map(k => k.key)}
                      value={extraction.sourceKey}
                      onChange={(_, newValue) => updateDataExtraction(index, { sourceKey: newValue || '' })}
                      onInputChange={(_, newValue) => updateDataExtraction(index, { sourceKey: newValue })}
                      renderInput={(params) => (
                        <TextField {...params} size="small" label="Source Path" placeholder="e.g., category" sx={{ minWidth: 150 }} />
                      )}
                      sx={{ flex: 1 }}
                    />

                    <Typography color="#64748b">→</Typography>

                    <TextField
                      size="small"
                      label="Variable Name"
                      value={extraction.targetVariable}
                      onChange={(e) => updateDataExtraction(index, { targetVariable: e.target.value })}
                      placeholder="e.g., hoveredCategory"
                      sx={{ flex: 1, minWidth: 140 }}
                    />

                    <IconButton size="small" onClick={() => removeDataExtraction(index)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Paper>
              ))}

              <Button size="small" startIcon={<AddIcon />} onClick={addDataExtraction} sx={{ textTransform: 'none' }}>
                Add Extraction
              </Button>
            </AccordionDetails>
          </Accordion>

          {/* Available Variables Section */}
          <Accordion
            expanded={expandedSection === 'variables'}
            onChange={(_, expanded) => setExpandedSection(expanded ? 'variables' : false)}
            sx={{ mt: 1, boxShadow: 'none', border: '1px solid rgba(34, 197, 94, 0.15)', '&:before': { display: 'none' }, borderRadius: '8px !important' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon sx={{ color: '#22c55e', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>Available Variables</Typography>
                <Chip 
                  label={availableVariables.length} 
                  size="small" 
                  sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#22c55e20', color: '#22c55e' }} 
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                <Typography variant="caption">
                  Click any variable to copy <code>${'{variableName}'}</code> syntax. Use in chart templates and HTML.
                </Typography>
              </Alert>

              {/* Search */}
              <TextField
                size="small"
                placeholder="Search variables..."
                value={variableSearch}
                onChange={(e) => setVariableSearch(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: '#64748b', fontSize: 18 }} />,
                }}
                fullWidth
                sx={{ mb: 1.5 }}
              />

              {/* Extracted Variables */}
              {filteredGroupedVariables.extraction.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ display: 'block', mb: 0.5 }}>
                    🎯 Extracted (from hover):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {filteredGroupedVariables.extraction.map(v => (
                      <Tooltip key={v.name} title={`Value: ${v.value ?? '(set on hover)'}`} arrow>
                        <Chip
                          label={v.name}
                          size="small"
                          icon={copiedVariable === v.name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                          onClick={() => handleVariableCopy(v.name)}
                          sx={{
                            height: 24,
                            fontSize: '0.7rem',
                            fontFamily: 'monospace',
                            bgcolor: 'rgba(102, 126, 234, 0.12)',
                            color: '#667eea',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.2)' },
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Inline Calculated Variables */}
              {filteredGroupedVariables.calculation.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 0.5 }}>
                    📊 Inline Calculated:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {filteredGroupedVariables.calculation.map(v => {
                      const hasResult = v.value !== null && v.value !== undefined;
                      return (
                        <Tooltip key={v.name} title={hasResult ? `Value: ${JSON.stringify(v.value)?.substring(0, 100)}` : 'Run preview to see value'} arrow>
                          <Chip
                            label={v.name}
                            size="small"
                            icon={copiedVariable === v.name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                            onClick={() => handleVariableCopy(v.name)}
                            sx={{
                              height: 24,
                              fontSize: '0.7rem',
                              fontFamily: 'monospace',
                              bgcolor: hasResult ? 'rgba(6, 182, 212, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                              color: hasResult ? '#06b6d4' : '#f59e0b',
                              border: `1px solid ${hasResult ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
                              cursor: 'pointer',
                              '&:hover': { bgcolor: hasResult ? 'rgba(6, 182, 212, 0.2)' : 'rgba(245, 158, 11, 0.2)' },
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>
              )}

              {/* Global Variables (from calculation tab) */}
              {filteredGroupedVariables.global.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="#8b5cf6" sx={{ display: 'block', mb: 0.5 }}>
                    🔢 Global Variables:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 80, overflowY: 'auto' }}>
                    {filteredGroupedVariables.global.slice(0, 20).map(v => (
                      <Chip
                        key={v.name}
                        label={v.name}
                        size="small"
                        icon={copiedVariable === v.name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                        onClick={() => handleVariableCopy(v.name)}
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          fontFamily: 'monospace',
                          bgcolor: 'rgba(139, 92, 246, 0.1)',
                          color: '#8b5cf6',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(139, 92, 246, 0.18)' },
                        }}
                      />
                    ))}
                    {filteredGroupedVariables.global.length > 20 && (
                      <Typography variant="caption" color="#94a3b8">+{filteredGroupedVariables.global.length - 20} more</Typography>
                    )}
                  </Box>
                </Box>
              )}

              {/* Filters */}
              {filteredGroupedVariables.filter.length > 0 && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography variant="caption" fontWeight={600} color="#ec4899" sx={{ display: 'block', mb: 0.5 }}>
                    🔽 Filters:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {filteredGroupedVariables.filter.map(v => (
                      <Chip
                        key={v.name}
                        label={v.name}
                        size="small"
                        icon={copiedVariable === v.name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                        onClick={() => handleVariableCopy(v.name)}
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          fontFamily: 'monospace',
                          bgcolor: 'rgba(236, 72, 153, 0.1)',
                          color: '#ec4899',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(236, 72, 153, 0.18)' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Parameters */}
              {filteredGroupedVariables.parameter.length > 0 && (
                <Box>
                  <Typography variant="caption" fontWeight={600} color="#f59e0b" sx={{ display: 'block', mb: 0.5 }}>
                    ⚙️ Parameters:
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {filteredGroupedVariables.parameter.map(v => (
                      <Chip
                        key={v.name}
                        label={v.name}
                        size="small"
                        icon={copiedVariable === v.name ? <CheckIcon sx={{ fontSize: 14 }} /> : undefined}
                        onClick={() => handleVariableCopy(v.name)}
                        sx={{
                          height: 22,
                          fontSize: '0.65rem',
                          fontFamily: 'monospace',
                          bgcolor: 'rgba(245, 158, 11, 0.1)',
                          color: '#f59e0b',
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.18)' },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </AccordionDetails>
          </Accordion>

          {/* Inline Calculations Section */}
          <Accordion
            expanded={expandedSection === 'calculation'}
            onChange={(_, expanded) => setExpandedSection(expanded ? 'calculation' : false)}
            sx={{ mt: 1, boxShadow: 'none', border: '1px solid rgba(139, 92, 246, 0.15)', '&:before': { display: 'none' }, borderRadius: '8px !important' }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CodeIcon sx={{ color: '#8b5cf6', fontSize: 20 }} />
                <Typography variant="subtitle2" fontWeight={700}>Inline Calculations</Typography>
                <Chip label={(tooltipConfig.calculationBindings || []).length} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#8b5cf620', color: '#8b5cf6' }} />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                <Typography variant="caption">
                  Calculations run at hover time. Use extracted variables and all global data.
                </Typography>
              </Alert>

              {/* Show inline calculated output variables */}
              {(tooltipConfig.calculationBindings || []).filter(b => b.outputVariable).length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    mb: 1.5,
                    border: '1px solid rgba(6, 182, 212, 0.2)',
                    borderRadius: 1,
                    bgcolor: 'rgba(6, 182, 212, 0.03)',
                  }}
                >
                  <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 0.5 }}>
                    📤 Output Variables (use in templates):
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(tooltipConfig.calculationBindings || [])
                      .filter(b => b.outputVariable)
                      .map(binding => {
                        const hasResult = previewResult?.[binding.outputVariable] !== undefined;
                        return (
                          <Tooltip key={binding.id} title={hasResult ? `Value: ${JSON.stringify(previewResult[binding.outputVariable])?.substring(0, 100)}` : 'Run preview to compute'}>
                            <Chip
                              label={`\${${binding.outputVariable}}`}
                              size="small"
                              icon={copiedVariable === binding.outputVariable ? <CheckIcon sx={{ fontSize: 14 }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
                              onClick={() => handleVariableCopy(binding.outputVariable)}
                              sx={{
                                height: 24,
                                fontSize: '0.7rem',
                                fontFamily: 'monospace',
                                bgcolor: hasResult ? 'rgba(6, 182, 212, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: hasResult ? '#06b6d4' : '#f59e0b',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: hasResult ? 'rgba(6, 182, 212, 0.25)' : 'rgba(245, 158, 11, 0.25)' },
                              }}
                            />
                          </Tooltip>
                        );
                      })}
                  </Box>
                </Paper>
              )}

              {(tooltipConfig.calculationBindings || []).map((binding, index) => (
                <Paper key={binding.id} elevation={0} sx={{ p: 1.5, mb: 1.5, bgcolor: 'rgba(139, 92, 246, 0.02)', border: '1px solid rgba(139, 92, 246, 0.1)', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                    <TextField
                      size="small"
                      label="Output Variable"
                      value={binding.outputVariable}
                      onChange={(e) => updateCalculationBinding(index, { outputVariable: e.target.value })}
                      placeholder="e.g., tooltipChartData"
                      sx={{ flex: 1 }}
                    />
                    {previewResult?.[binding.outputVariable] !== undefined && (
                      <Chip 
                        label="✓ Computed" 
                        size="small" 
                        sx={{ height: 20, fontSize: '0.6rem', bgcolor: '#22c55e20', color: '#22c55e' }} 
                      />
                    )}
                    <IconButton size="small" onClick={() => removeCalculationBinding(index)} sx={{ color: '#ef4444' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Typography variant="caption" fontWeight={600} color="#8b5cf6" sx={{ mb: 0.5, display: 'block' }}>
                    Inline Logic:
                  </Typography>
                  <Box sx={{ border: '1px solid rgba(139, 92, 246, 0.2)', borderRadius: 1, overflow: 'hidden' }}>
                    <CalculationEditor
                      value={binding.inlineLogic || ''}
                      onChange={(value) => updateCalculationBinding(index, { inlineLogic: value })}
                      height={150}
                    />
                  </Box>
                </Paper>
              ))}

              <Button size="small" startIcon={<AddIcon />} onClick={addCalculationBinding} sx={{ textTransform: 'none' }}>
                Add Calculation
              </Button>
            </AccordionDetails>
          </Accordion>

          {/* Selected Card Configuration */}
          {selectedTooltipCard ? (
            <Paper elevation={0} sx={{ p: 2, border: '1px solid rgba(102, 126, 234, 0.15)', borderRadius: 2, mt: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#1e293b">
                    Card {selectedTooltipCardIndex + 1} Config
                  </Typography>
                  <Chip
                    label={selectedTooltipCard.type}
                    size="small"
                    sx={{ height: 20, bgcolor: 'rgba(102, 126, 234, 0.1)', color: '#667eea', fontWeight: 600, fontSize: '0.65rem' }}
                  />
                </Box>
                {(tooltipConfig.tooltipCards || []).length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveTooltipCard(selectedTooltipCardIndex)}
                    sx={{ color: '#ef4444', p: 0.5 }}
                  >
                    <DeleteIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Box>

              {/* Card Type Selector */}
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="#64748b" sx={{ mb: 1, display: 'block' }}>
                  Card Type
                </Typography>
                <ToggleButtonGroup
                  value={selectedTooltipCard.type}
                  exclusive
                  onChange={(_, value) => value && updateTooltipCard(selectedTooltipCardIndex, { type: value })}
                  size="small"
                  sx={{ 
                    '& .MuiToggleButton-root': {
                      px: 2, py: 0.75, textTransform: 'none', fontWeight: 600,
                      '&.Mui-selected': { bgcolor: 'rgba(102, 126, 234, 0.15)', color: '#667eea' },
                    }
                  }}
                >
                  <ToggleButton value="chart"><ChartIcon sx={{ mr: 0.5, fontSize: 18 }} /> Chart</ToggleButton>
                  <ToggleButton value="table"><TableIcon sx={{ mr: 0.5, fontSize: 18 }} /> Table</ToggleButton>
                  <ToggleButton value="html"><HtmlIcon sx={{ mr: 0.5, fontSize: 18 }} /> HTML</ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Card Title */}
              <Box sx={{ mb: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={selectedTooltipCard.showTitle || false}
                      onChange={(e) => updateTooltipCard(selectedTooltipCardIndex, { showTitle: e.target.checked })}
                      size="small"
                    />
                  }
                  label={<Typography variant="body2" fontWeight={600} color="#64748b">Show Title</Typography>}
                />
                {selectedTooltipCard.showTitle && (
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Card title..."
                    value={selectedTooltipCard.title || ''}
                    onChange={(e) => updateTooltipCard(selectedTooltipCardIndex, { title: e.target.value })}
                    sx={{ mt: 1 }}
                  />
                )}
              </Box>

              {/* Content Configuration */}
              <Accordion
                expanded={expandedSection === 'content'}
                onChange={(_, expanded) => setExpandedSection(expanded ? 'content' : false)}
                sx={{ boxShadow: 'none', border: '1px solid rgba(102, 126, 234, 0.15)', '&:before': { display: 'none' }, borderRadius: '8px !important' }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ color: '#667eea', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Content Configuration</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {selectedTooltipCard.type === 'chart' && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="#64748b">Chart Template (JSON)</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          {chartTemplatePresets.map((preset) => (
                            <Chip
                              key={preset.label}
                              label={preset.label}
                              size="small"
                              onClick={() => updateTooltipCard(selectedTooltipCardIndex, { chartTemplate: preset.value })}
                              sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(102, 126, 234, 0.1)', color: '#667eea', cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                      <Box sx={{ border: '1px solid rgba(102, 126, 234, 0.2)', borderRadius: 1, overflow: 'hidden' }}>
                        <JsonEditor
                          value={selectedTooltipCard.chartTemplate || ''}
                          onChange={(value) => updateTooltipCard(selectedTooltipCardIndex, { chartTemplate: value })}
                          height={300}
                          availableVariables={availableVariablesRecord}
                          placeholder="Enter Highcharts JSON config. Use ${variableName} for dynamic values."
                        />
                      </Box>
                      {/* Available Variables Quick Reference */}
                      <Paper elevation={0} sx={{ mt: 1, p: 1, bgcolor: 'rgba(102, 126, 234, 0.03)', border: '1px solid rgba(102, 126, 234, 0.1)', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ display: 'block', mb: 0.5 }}>
                          📋 Available Variables (click to copy):
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 60, overflowY: 'auto' }}>
                          {availableVariables.slice(0, 15).map(varName => (
                            <Chip
                              key={varName}
                              label={`\${${varName}}`}
                              size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(`\${${varName}}`);
                                setCopiedVariable(varName);
                                setTimeout(() => setCopiedVariable(null), 1500);
                              }}
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                fontFamily: 'monospace',
                                bgcolor: copiedVariable === varName ? '#22c55e20' : 'rgba(102, 126, 234, 0.08)',
                                color: copiedVariable === varName ? '#22c55e' : '#667eea',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.15)' },
                              }}
                            />
                          ))}
                          {availableVariables.length > 15 && (
                            <Typography variant="caption" color="#94a3b8">+{availableVariables.length - 15} more</Typography>
                          )}
                        </Box>
                      </Paper>
                      <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                        <Typography variant="caption">
                          Use <code>${'{varName}'}</code> for ALL values - strings are auto-quoted! Type <code>$</code> for autocomplete.
                        </Typography>
                      </Alert>
                    </Box>
                  )}

                  {selectedTooltipCard.type === 'table' && (
                      <Stack spacing={1.5}>
                        {/* Select Data Source */}
                        <Paper
                          sx={{
                            p: 1.5,
                            borderRadius: 1.5,
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                          }}
                        >
                          <Typography 
                            variant="caption" 
                            fontWeight={700} 
                            sx={{ mb: 1, color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}
                          >
                            <TableIcon sx={{ fontSize: 16 }} />
                            Select Data Source
                          </Typography>
                          <FormControl fullWidth size="small">
                            <InputLabel>Calculation Variable</InputLabel>
                            <Select
                              value={selectedTooltipCard.tableDataSource || ''}
                              label="Calculation Variable"
                              onChange={(e) => updateTooltipCard(selectedTooltipCardIndex, { tableDataSource: e.target.value })}
                              sx={{ bgcolor: 'white', borderRadius: 1 }}
                            >
                              <MenuItem value=""><em>Select a variable...</em></MenuItem>
                              {/* Inline calculation outputs */}
                              {(tooltipConfig.calculationBindings || [])
                                .filter(b => b.outputVariable)
                                .map(b => (
                                  <MenuItem key={b.outputVariable} value={b.outputVariable}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Chip size="small" label="Calc" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#22c55e20', color: '#22c55e' }} />
                                      {b.outputVariable}
                                    </Box>
                                  </MenuItem>
                                ))
                              }
                              {/* Array variables */}
                              {arrayOfObjectsVariables.map((varName: string) => (
                                <MenuItem key={varName} value={varName}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip size="small" label="Array" sx={{ height: 18, fontSize: '0.6rem', bgcolor: '#10b98120', color: '#10b981' }} />
                                    {varName}
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {selectedTooltipCard.tableDataSource && tooltipTableColumns.length > 0 && (
                            <Typography variant="caption" color="#10b981" sx={{ mt: 0.5, display: 'block' }}>
                              ✓ {tooltipTableColumns.length} columns available
                            </Typography>
                          )}
                        </Paper>

                        {/* Display Mode */}
                        <Accordion 
                          defaultExpanded
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PreviewIcon sx={{ fontSize: 16 }} />
                              Display Mode
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <RadioGroup
                              value={effectiveTableSettings.displayMode}
                              onChange={(e) => updateTableSettings({ displayMode: e.target.value as TableDisplayMode })}
                            >
                              <FormControlLabel
                                value="pagination"
                                control={<Radio size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' }, p: 0.5 }} />}
                                label={<Typography variant="caption">Pagination</Typography>}
                              />
                              <FormControlLabel
                                value="scroll"
                                control={<Radio size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' }, p: 0.5 }} />}
                                label={<Typography variant="caption">Scroll Content</Typography>}
                              />
                              <FormControlLabel
                                value="lazyLoad"
                                control={<Radio size="small" sx={{ color: '#10b981', '&.Mui-checked': { color: '#10b981' }, p: 0.5 }} />}
                                label={<Typography variant="caption">Lazy Load</Typography>}
                              />
                            </RadioGroup>
                            {effectiveTableSettings.displayMode === 'pagination' && (
                              <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Rows Per Page</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.rowsPerPage}
                                    label="Rows Per Page"
                                    onChange={(e) => updateTableSettings({ rowsPerPage: Number(e.target.value) })}
                                    sx={{ bgcolor: 'white' }}
                                  >
                                    {[5, 10, 15, 20, 25, 50].map(n => (
                                      <MenuItem key={n} value={n}>{n} rows</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Box>
                            )}
                            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid rgba(16, 185, 129, 0.15)' }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={effectiveTableSettings.showHeader !== false}
                                    onChange={(e) => updateTableSettings({ showHeader: e.target.checked })}
                                    size="small"
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' } }}
                                  />
                                }
                                label={<Typography variant="caption">Show Table Header</Typography>}
                              />
                            </Box>
                          </AccordionDetails>
                        </Accordion>

                        {/* Sorting */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <SortIcon sx={{ fontSize: 16 }} />
                              Sorting {(effectiveTableSettings.sorting?.columns?.length || 0) > 0 && `(${effectiveTableSettings.sorting?.columns?.length})`}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={effectiveTableSettings.sorting?.enabled || false}
                                  onChange={(e) => updateTableSettings({
                                    sorting: { 
                                      ...effectiveTableSettings.sorting, 
                                      enabled: e.target.checked,
                                      columns: e.target.checked ? (effectiveTableSettings.sorting?.columns || []) : []
                                    }
                                  })}
                                  size="small"
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' } }}
                                />
                              }
                              label={<Typography variant="caption">Enable Sorting</Typography>}
                            />
                            {effectiveTableSettings.sorting?.enabled && tooltipTableColumns.length > 0 && (
                              <Box sx={{ mt: 1 }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Add Sort Column</InputLabel>
                                  <Select
                                    value=""
                                    label="Add Sort Column"
                                    onChange={(e) => {
                                      const currentColumns = effectiveTableSettings.sorting?.columns || [];
                                      updateTableSettings({
                                        sorting: {
                                          ...effectiveTableSettings.sorting,
                                          columns: [...currentColumns, { column: e.target.value as string, direction: 'asc' }]
                                        }
                                      });
                                    }}
                                    sx={{ bgcolor: 'white' }}
                                  >
                                    {tooltipTableColumns
                                      .filter(col => !(effectiveTableSettings.sorting?.columns || []).some(s => s.column === col))
                                      .map(col => (
                                        <MenuItem key={col} value={col}>{col}</MenuItem>
                                      ))}
                                  </Select>
                                </FormControl>
                                {(effectiveTableSettings.sorting?.columns || []).map((sortCol, idx) => (
                                  <Box 
                                    key={sortCol.column} 
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, p: 0.5, bgcolor: 'white', borderRadius: 0.5, border: '1px solid #e2e8f0' }}
                                  >
                                    <Typography variant="caption" sx={{ flex: 1 }}>{sortCol.column}</Typography>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => {
                                        const newColumns = (effectiveTableSettings.sorting?.columns || []).map(s =>
                                          s.column === sortCol.column ? { ...s, direction: s.direction === 'asc' ? 'desc' as const : 'asc' as const } : s
                                        );
                                        updateTableSettings({ sorting: { ...effectiveTableSettings.sorting, columns: newColumns } });
                                      }}
                                      sx={{ p: 0.25, color: '#10b981' }}
                                    >
                                      {sortCol.direction === 'asc' ? <ArrowUpwardIcon sx={{ fontSize: 14 }} /> : <ArrowDownwardIcon sx={{ fontSize: 14 }} />}
                                    </IconButton>
                                    <IconButton 
                                      size="small" 
                                      onClick={() => {
                                        const newColumns = (effectiveTableSettings.sorting?.columns || []).filter(s => s.column !== sortCol.column);
                                        updateTableSettings({ sorting: { ...effectiveTableSettings.sorting, columns: newColumns } });
                                      }}
                                      sx={{ p: 0.25, color: '#ef4444' }}
                                    >
                                      <DeleteIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            {effectiveTableSettings.sorting?.enabled && tooltipTableColumns.length === 0 && (
                              <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                                <Typography variant="caption">Run preview to load columns</Typography>
                              </Alert>
                            )}
                          </AccordionDetails>
                        </Accordion>

                        {/* Columns */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ColumnIcon sx={{ fontSize: 16 }} />
                              Columns ({effectiveTableSettings.columns?.filter(c => c.visible).length || tooltipTableColumns.length}/{effectiveTableSettings.columns?.length || tooltipTableColumns.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            {tooltipTableColumns.length > 0 ? (
                              <Box sx={{ maxHeight: 150, overflow: 'auto' }}>
                                {(effectiveTableSettings.columns?.length > 0 
                                  ? [...effectiveTableSettings.columns].sort((a, b) => a.order - b.order) 
                                  : tooltipTableColumns.map((col, idx) => ({ name: col, visible: true, order: idx }))
                                ).map((col, idx) => (
                                  <Box 
                                    key={col.name} 
                                    sx={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: 0.5, 
                                      py: 0.25,
                                      px: 0.5,
                                      '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.05)' },
                                      borderRadius: 0.5,
                                    }}
                                  >
                                    <DragIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                                    <Checkbox
                                      checked={col.visible}
                                      onChange={() => {
                                        const currentColumns = effectiveTableSettings.columns?.length > 0 
                                          ? effectiveTableSettings.columns 
                                          : tooltipTableColumns.map((c, i) => ({ name: c, visible: true, order: i }));
                                        const newColumns = currentColumns.map(c =>
                                          c.name === col.name ? { ...c, visible: !c.visible } : c
                                        );
                                        updateTableSettings({ columns: newColumns });
                                      }}
                                      size="small"
                                      sx={{ p: 0.25, color: '#10b981', '&.Mui-checked': { color: '#10b981' } }}
                                    />
                                    <Typography 
                                      variant="caption" 
                                      sx={{ 
                                        flex: 1, 
                                        color: col.visible ? '#1e293b' : '#94a3b8',
                                        textDecoration: col.visible ? 'none' : 'line-through',
                                      }}
                                    >
                                      {col.name}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            ) : (
                              <Alert severity="info" sx={{ py: 0 }}>
                                <Typography variant="caption">Run preview to load columns</Typography>
                              </Alert>
                            )}
                          </AccordionDetails>
                        </Accordion>

                        {/* Theme & Styling */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <PaletteIcon sx={{ fontSize: 16 }} />
                              Theme & Styling
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <Stack spacing={1}>
                              {/* Header Colors */}
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" color="#64748b" sx={{ fontSize: '0.6rem' }}>Header BG</Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <input
                                      type="color"
                                      value={effectiveTableSettings.theme?.headerBgColor || '#e0e7ff'}
                                      onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, headerBgColor: e.target.value } })}
                                      style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                    />
                                    <TextField
                                      size="small"
                                      value={effectiveTableSettings.theme?.headerBgColor || '#e0e7ff'}
                                      onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, headerBgColor: e.target.value } })}
                                      sx={{ flex: 1 }}
                                      inputProps={{ style: { padding: '2px 6px', fontSize: '0.65rem' } }}
                                    />
                                  </Box>
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" color="#64748b" sx={{ fontSize: '0.6rem' }}>Header Text</Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <input
                                      type="color"
                                      value={effectiveTableSettings.theme?.headerTextColor || '#1e293b'}
                                      onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, headerTextColor: e.target.value } })}
                                      style={{ width: 24, height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                    />
                                    <TextField
                                      size="small"
                                      value={effectiveTableSettings.theme?.headerTextColor || '#1e293b'}
                                      onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, headerTextColor: e.target.value } })}
                                      sx={{ flex: 1 }}
                                      inputProps={{ style: { padding: '2px 6px', fontSize: '0.65rem' } }}
                                    />
                                  </Box>
                                </Box>
                              </Box>
                              {/* Row Colors */}
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" color="#64748b" sx={{ fontSize: '0.6rem' }}>Even Row</Typography>
                                  <input
                                    type="color"
                                    value={effectiveTableSettings.theme?.rowBgColor || '#ffffff'}
                                    onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, rowBgColor: e.target.value } })}
                                    style={{ width: '100%', height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="caption" color="#64748b" sx={{ fontSize: '0.6rem' }}>Odd Row</Typography>
                                  <input
                                    type="color"
                                    value={effectiveTableSettings.theme?.rowAltBgColor || '#f8fafc'}
                                    onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, rowAltBgColor: e.target.value } })}
                                    style={{ width: '100%', height: 24, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                  />
                                </Box>
                              </Box>
                              {/* Cell Padding & Font Size */}
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <FormControl size="small" sx={{ flex: 1 }}>
                                  <InputLabel sx={{ fontSize: '0.7rem' }}>Padding</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.theme?.cellPadding || 'normal'}
                                    label="Padding"
                                    onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, cellPadding: e.target.value as any } })}
                                    sx={{ bgcolor: 'white', fontSize: '0.7rem' }}
                                  >
                                    <MenuItem value="compact">Compact</MenuItem>
                                    <MenuItem value="normal">Normal</MenuItem>
                                    <MenuItem value="comfortable">Comfortable</MenuItem>
                                  </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ flex: 1 }}>
                                  <InputLabel sx={{ fontSize: '0.7rem' }}>Font Size</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.theme?.fontSize || 'medium'}
                                    label="Font Size"
                                    onChange={(e) => updateTableSettings({ theme: { ...effectiveTableSettings.theme, fontSize: e.target.value as any } })}
                                    sx={{ bgcolor: 'white', fontSize: '0.7rem' }}
                                  >
                                    <MenuItem value="small">Small</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="large">Large</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                            </Stack>
                          </AccordionDetails>
                        </Accordion>

                        {/* Summary Row */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                            bgcolor: 'rgba(16, 185, 129, 0.02)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                            <Typography variant="caption" fontWeight={700} sx={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <InsertChartIcon sx={{ fontSize: 16 }} />
                              Summary Row
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails sx={{ pt: 0 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={effectiveTableSettings.summaryRow?.enabled || false}
                                  onChange={(e) => updateTableSettings({
                                    summaryRow: { ...effectiveTableSettings.summaryRow, enabled: e.target.checked }
                                  })}
                                  size="small"
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' } }}
                                />
                              }
                              label={<Typography variant="caption">Enable Summary Row</Typography>}
                            />
                            {effectiveTableSettings.summaryRow?.enabled && tooltipTableColumns.length > 0 && (
                              <Box sx={{ mt: 1, maxHeight: 120, overflow: 'auto' }}>
                                {tooltipTableColumns.map((col) => (
                                  <Box key={col} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ flex: 1, minWidth: 80 }}>{col}</Typography>
                                    <Select
                                      size="small"
                                      value={effectiveTableSettings.summaryRow?.calculations?.[col] || 'none'}
                                      onChange={(e) => updateTableSettings({
                                        summaryRow: {
                                          ...effectiveTableSettings.summaryRow,
                                          calculations: {
                                            ...effectiveTableSettings.summaryRow?.calculations,
                                            [col]: e.target.value as SummaryCalculation
                                          }
                                        }
                                      })}
                                      sx={{ flex: 1, bgcolor: 'white', fontSize: '0.65rem' }}
                                    >
                                      <MenuItem value="none">None</MenuItem>
                                      <MenuItem value="sum">Sum</MenuItem>
                                      <MenuItem value="avg">Average</MenuItem>
                                      <MenuItem value="min">Min</MenuItem>
                                      <MenuItem value="max">Max</MenuItem>
                                      <MenuItem value="count">Count</MenuItem>
                                    </Select>
                                  </Box>
                                ))}
                              </Box>
                            )}
                            {effectiveTableSettings.summaryRow?.enabled && tooltipTableColumns.length === 0 && (
                              <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                                <Typography variant="caption">Run preview to load columns</Typography>
                              </Alert>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      </Stack>
                  )}

                  {selectedTooltipCard.type === 'html' && (
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="#64748b">HTML Template</Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {htmlTemplatePresets.map((preset) => (
                            <Chip
                              key={preset.label}
                              label={preset.label}
                              size="small"
                              onClick={() => updateTooltipCard(selectedTooltipCardIndex, { htmlTemplate: preset.value })}
                              sx={{ height: 20, fontSize: '0.6rem', bgcolor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', cursor: 'pointer' }}
                            />
                          ))}
                        </Box>
                      </Box>
                      <Box sx={{ border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 1, overflow: 'hidden' }}>
                        <HtmlEditor
                          value={selectedTooltipCard.htmlTemplate || ''}
                          onChange={(value) => updateTooltipCard(selectedTooltipCardIndex, { htmlTemplate: value })}
                          height={300}
                          availableVariables={availableVariablesRecord}
                          placeholder="Enter HTML template. Use ${variableName} for dynamic values."
                        />
                      </Box>
                      {/* Available Variables Quick Reference */}
                      <Paper elevation={0} sx={{ mt: 1, p: 1, bgcolor: 'rgba(245, 158, 11, 0.03)', border: '1px solid rgba(245, 158, 11, 0.1)', borderRadius: 1 }}>
                        <Typography variant="caption" fontWeight={600} color="#f59e0b" sx={{ display: 'block', mb: 0.5 }}>
                          📋 Available Variables (click to copy):
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 60, overflowY: 'auto' }}>
                          {availableVariables.slice(0, 15).map(varName => (
                            <Chip
                              key={varName}
                              label={`\${${varName}}`}
                              size="small"
                              onClick={() => {
                                navigator.clipboard.writeText(`\${${varName}}`);
                                setCopiedVariable(varName);
                                setTimeout(() => setCopiedVariable(null), 1500);
                              }}
                              sx={{
                                height: 20,
                                fontSize: '0.6rem',
                                fontFamily: 'monospace',
                                bgcolor: copiedVariable === varName ? '#22c55e20' : 'rgba(245, 158, 11, 0.08)',
                                color: copiedVariable === varName ? '#22c55e' : '#f59e0b',
                                cursor: 'pointer',
                                '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.15)' },
                              }}
                            />
                          ))}
                          {availableVariables.length > 15 && (
                            <Typography variant="caption" color="#94a3b8">+{availableVariables.length - 15} more</Typography>
                          )}
                        </Box>
                      </Paper>
                      <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                        <Typography variant="caption">
                          Use <code>${'{varName}'}</code> for ALL values. Type <code>$</code> for autocomplete.
                        </Typography>
                      </Alert>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>

            </Paper>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 150, color: '#64748b', mt: 2 }}>
              <Typography variant="body2" fontWeight={600}>Select a layout preset to add cards</Typography>
            </Box>
          )}
          </Box>
        )}
        
        {/* Empty state when tooltip disabled */}
        {selectedChildCardId && !tooltipConfig.enabled && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <TouchAppIcon sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
            <Typography variant="body1" fontWeight={600}>Tooltip Disabled</Typography>
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              Enable the toggle above to configure
            </Typography>
          </Box>
        )}
        
        {/* Empty state when no child card selected */}
        {!selectedChildCardId && (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <Typography variant="body1" fontWeight={600}>Select a Child Card</Typography>
            <Typography variant="caption" sx={{ mt: 0.5 }}>
              Choose a card from the left panel
            </Typography>
          </Box>
        )}
      </Box>
      
      {/* SECTION 3: RIGHT - Live Preview (like TooltipConfigPanel) */}
      <Box sx={{ 
        width: 380, 
        flexShrink: 0, 
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: '#fafbfc',
        borderLeft: '1px solid rgba(102, 126, 234, 0.15)',
      }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid rgba(102, 126, 234, 0.15)', bgcolor: 'rgba(102, 126, 234, 0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon sx={{ color: '#667eea', fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} color="#667eea">
                Live Preview
              </Typography>
            </Box>
            {selectedChildCardId && tooltipConfig.enabled && selectedTooltipCard && (
              <Chip 
                label={`Card ${selectedTooltipCardIndex + 1} • ${selectedTooltipCard.type}`} 
                size="small" 
                sx={{ 
                  height: 20, 
                  fontSize: '0.6rem', 
                  bgcolor: selectedTooltipCard.type === 'chart' ? '#667eea20' 
                         : selectedTooltipCard.type === 'table' ? '#10b98120' : '#f59e0b20',
                  color: selectedTooltipCard.type === 'chart' ? '#667eea' 
                         : selectedTooltipCard.type === 'table' ? '#10b981' : '#f59e0b',
                }} 
              />
            )}
          </Box>
        </Box>
        
        <Box sx={{ flex: 1, overflow: 'auto', p: 1.5 }}>
          {selectedChildCardId && tooltipConfig.enabled && (tooltipConfig.tooltipCards || []).length > 0 ? (
            <>
              {/* Test Values Input - Like TooltipConfigPanel */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  mb: 2,
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                  borderRadius: 1.5,
                  bgcolor: 'rgba(102, 126, 234, 0.02)',
                }}
              >
                <Typography variant="subtitle2" fontWeight={600} gutterBottom sx={{ fontSize: '0.8rem' }}>
                  Test Values (Simulate Hover Data)
                </Typography>
                
                {(tooltipConfig.dataExtractions || []).length === 0 ? (
                  <Alert severity="warning" sx={{ py: 0.5 }}>
                    <Typography variant="caption">
                      No data extractions configured. Add extractions to test with simulated values.
                    </Typography>
                  </Alert>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                    {(tooltipConfig.dataExtractions || []).map((extraction) => (
                      <TextField
                        key={extraction.id}
                        size="small"
                        label={extraction.targetVariable || 'Variable'}
                        value={testValues[extraction.targetVariable] || ''}
                        onChange={(e) => setTestValues(prev => ({
                          ...prev,
                          [extraction.targetVariable]: e.target.value,
                        }))}
                        placeholder={`Test value for ${extraction.targetVariable}`}
                        fullWidth
                        sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem' } }}
                      />
                    ))}
                  </Box>
                )}

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, gap: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
                    onClick={() => {
                      setTestValues({});
                      setPreviewResult(null);
                      setPreviewError(null);
                    }}
                    sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                  >
                    Reset
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<PlayIcon sx={{ fontSize: 14 }} />}
                    onClick={runPreview}
                    sx={{ 
                      textTransform: 'none',
                      fontSize: '0.7rem',
                      bgcolor: '#667eea',
                      '&:hover': { bgcolor: '#5567d5' },
                    }}
                  >
                    Run Preview
                  </Button>
                </Box>
              </Paper>

              {/* Error Display */}
              {previewError && (
                <Alert severity="error" sx={{ mb: 2, py: 0.5 }}>
                  <Typography variant="caption" fontFamily="monospace" sx={{ fontSize: '0.7rem' }}>
                    {previewError}
                  </Typography>
                </Alert>
              )}

              {/* Calculation Results */}
              {previewResult && Object.keys(previewResult).length > 0 && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    mb: 2,
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: 1.5,
                    bgcolor: 'rgba(34, 197, 94, 0.02)',
                  }}
                >
                  <Typography variant="subtitle2" fontWeight={600} color="#22c55e" gutterBottom sx={{ fontSize: '0.8rem' }}>
                    ✅ Calculation Results
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {Object.entries(previewResult).map(([key, value]) => (
                      <Tooltip
                        key={key}
                        title={
                          <pre style={{ margin: 0, maxWidth: 300, overflow: 'auto', fontSize: 10 }}>
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        }
                      >
                        <Chip
                          label={`${key}: ${Array.isArray(value) ? `[${(value as any[]).length} items]` : typeof value}`}
                          size="small"
                          sx={{
                            height: 22,
                            bgcolor: '#22c55e15',
                            color: '#22c55e',
                            border: '1px solid #22c55e30',
                            fontFamily: 'monospace',
                            fontSize: '0.65rem',
                          }}
                        />
                      </Tooltip>
                    ))}
                  </Box>
                </Paper>
              )}

              {/* Preview Container - Renders actual content */}
              <Paper
                elevation={0}
                sx={{
                  flex: 1,
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 250,
                }}
              >
                {/* Preview Header */}
                {selectedTooltipCard?.showTitle && (
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      px: 1.5,
                      py: 1,
                      borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight={700} color="#667eea" sx={{ fontSize: '0.85rem' }}>
                      {(() => {
                        // Replace variables in title
                        let title = selectedTooltipCard.title || 'Details';
                        if (previewResult) {
                          Object.entries(previewResult).forEach(([key, value]) => {
                            title = title.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
                            title = title.replace(new RegExp(`\\(${key}\\)`, 'g'), String(value));
                          });
                        }
                        Object.entries(testValues).forEach(([key, value]) => {
                          title = title.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value));
                          title = title.replace(new RegExp(`\\(${key}\\)`, 'g'), String(value));
                        });
                        return title;
                      })()}
                    </Typography>
                    <Typography variant="caption" color="#94a3b8">
                      {selectedTooltipCard.type}
                    </Typography>
                  </Box>
                )}

                {/* Preview Content */}
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 180, p: 1 }}>
                  {selectedTooltipCard && (() => {
                    // Build available variables for replacement - include ALL variables with defaults
                    const allVars: Record<string, any> = {};
                    
                    // Add extracted variables with test values or placeholders
                    (tooltipConfig.dataExtractions || []).forEach(ext => {
                      if (ext.targetVariable) {
                        // Use test value if provided, otherwise use a sample placeholder
                        allVars[ext.targetVariable] = testValues[ext.targetVariable] || `Sample_${ext.targetVariable}`;
                      }
                    });
                    
                    // Add calculation output variables
                    (tooltipConfig.calculationBindings || []).forEach(binding => {
                      if (binding.outputVariable) {
                        // Use preview result if available, otherwise empty array (for data) or placeholder
                        allVars[binding.outputVariable] = previewResult?.[binding.outputVariable] ?? [];
                      }
                    });
                    
                    // Override with actual test values
                    Object.entries(testValues).forEach(([key, value]) => {
                      if (value !== undefined && value !== '') {
                        allVars[key] = value;
                      }
                    });
                    
                    // Override with preview results
                    if (previewResult) {
                      Object.entries(previewResult).forEach(([key, value]) => {
                        allVars[key] = value;
                      });
                    }

                    // Replace variables in template - handles both JSON and HTML
                    // 🔥 Smart replacement: ${varName} works for ALL types - strings get auto-quoted!
                    const replaceVariables = (template: string, isHtml: boolean = false): string => {
                      let result = template;
                      
                      Object.entries(allVars).forEach(([name, value]) => {
                        if (isHtml) {
                          // For HTML: simple string replacement (no quotes needed)
                          const replacement = value === null || value === undefined 
                            ? '' 
                            : typeof value === 'object' 
                              ? JSON.stringify(value) 
                              : String(value);
                          
                          result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), replacement);
                        } else {
                          // For JSON: context-aware replacement
                          
                          // Pattern 1: "${varName}" (quoted) - replace with proper JSON value
                          result = result.replace(new RegExp(`"\\$\\{${name}\\}"`, 'g'), () => {
                            if (value === null || value === undefined) return '""';
                            if (typeof value === 'string') return JSON.stringify(value); // Adds quotes
                            return JSON.stringify(value); // For objects/arrays/numbers
                          });
                          
                          // Pattern 2: ${varName} (unquoted) - smart replacement based on type
                          // 🔥 KEY: Strings automatically get quotes added!
                          result = result.replace(new RegExp(`\\$\\{${name}\\}`, 'g'), () => {
                            if (value === null || value === undefined) return 'null';
                            if (typeof value === 'string') return JSON.stringify(value); // 🔥 Auto-quotes for strings!
                            if (typeof value === 'number' || typeof value === 'boolean') return String(value);
                            return JSON.stringify(value); // Arrays/objects
                          });
                        }
                      });
                      
                      // Replace any remaining unreplaced variables with safe defaults
                      if (isHtml) {
                        result = result.replace(/\$\{[^}]+\}/g, '');
                      } else {
                        // For JSON: "${var}" -> "", ${var} -> []
                        result = result.replace(/"\\$\\{[^}]+\\}"/g, '""');
                        result = result.replace(/\$\{[^}]+\}/g, '[]');
                      }
                      
                      return result;
                    };

                    if (selectedTooltipCard.type === 'chart') {
                      if (!selectedTooltipCard.chartTemplate) {
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                            <ChartIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                            <Typography variant="caption">No chart template configured</Typography>
                          </Box>
                        );
                      }
                      try {
                        const processedTemplate = replaceVariables(selectedTooltipCard.chartTemplate);
                        const chartOptions = JSON.parse(processedTemplate);
                        if (chartOptions.series) {
                          chartOptions.series = chartOptions.series.map((s: any) => ({
                            ...s,
                            data: Array.isArray(s.data) ? s.data : [],
                          }));
                        }
                        return (
                          <Box sx={{ width: '100%', height: '100%', minHeight: 200 }}>
                            <ResizableChart options={chartOptions} />
                          </Box>
                        );
                      } catch (error: any) {
                        // Check for unreplaced variables
                        const unreplacedVars = selectedTooltipCard.chartTemplate.match(/\$\{([^}]+)\}/g) || [];
                        const missingVars = unreplacedVars.filter(v => {
                          const varName = v.replace(/\$\{|\}/g, '');
                          return !allVars[varName];
                        });
                        
                        return (
                          <Box sx={{ p: 1.5 }}>
                            <Alert severity="error" sx={{ py: 0.5 }}>
                              <Typography variant="caption" fontWeight={600}>
                                Chart Error: {error.message}
                              </Typography>
                              {missingVars.length > 0 && (
                                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#f59e0b' }}>
                                  ⚠️ Missing variables: {missingVars.join(', ')}
                                </Typography>
                              )}
                            </Alert>
                            <Typography variant="caption" color="#94a3b8" sx={{ display: 'block', mt: 1 }}>
                              💡 Enter test values above or run Preview.
                              <br />
                              📝 Use unified syntax: <code>"text": $&#123;name&#125;</code> (strings auto-quoted!)
                              <br />
                              📊 Same for arrays: <code>"data": $&#123;data&#125;</code>
                            </Typography>
                          </Box>
                        );
                      }
                    }

                    if (selectedTooltipCard.type === 'table') {
                      const dataSourceName = selectedTooltipCard.tableDataSource;
                      if (!dataSourceName) {
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                            <TableIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                            <Typography variant="caption">No data source selected</Typography>
                          </Box>
                        );
                      }
                      const tableData = allVars[dataSourceName];
                      if (!Array.isArray(tableData) || tableData.length === 0) {
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                            <TableIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                            <Typography variant="caption">No data available</Typography>
                            <Typography variant="caption" color="#94a3b8" sx={{ mt: 0.5 }}>
                              Run Preview to compute "{dataSourceName}"
                            </Typography>
                          </Box>
                        );
                      }
                      return <DashboardTable dataSource="" directData={tableData} />;
                    }

                    if (selectedTooltipCard.type === 'html') {
                      if (!selectedTooltipCard.htmlTemplate) {
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
                            <HtmlIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
                            <Typography variant="caption">No HTML template configured</Typography>
                          </Box>
                        );
                      }
                      const processedHtml = replaceVariables(selectedTooltipCard.htmlTemplate, true);
                      return (
                        <Box 
                          sx={{ height: '100%', overflow: 'auto' }}
                          dangerouslySetInnerHTML={{ __html: processedHtml }}
                        />
                      );
                    }

                    return null;
                  })()}
                </Box>
              </Paper>
            </>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', p: 2 }}>
              <Box sx={{ 
                width: 80, 
                height: 80, 
                borderRadius: '50%', 
                bgcolor: 'rgba(34, 197, 94, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                mb: 2,
              }}>
                <VisibilityIcon sx={{ fontSize: 36, color: '#22c55e', opacity: 0.5 }} />
              </Box>
              <Typography variant="body2" fontWeight={600} color="#64748b" textAlign="center">
                {!selectedChildCardId 
                  ? 'Select a Child Card'
                  : !tooltipConfig.enabled 
                    ? 'Enable Tooltip'
                    : 'Add Cards to Preview'}
              </Typography>
              <Typography variant="caption" color="#94a3b8" textAlign="center" sx={{ mt: 0.5 }}>
                {!selectedChildCardId 
                  ? 'Choose a card from the left panel to configure its tooltip'
                  : !tooltipConfig.enabled 
                    ? 'Toggle the switch in the config panel'
                    : 'Select a layout preset to add tooltip cards'}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
    </>
  );
}

