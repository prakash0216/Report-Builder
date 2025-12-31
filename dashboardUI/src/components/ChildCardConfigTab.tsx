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
  MenuItem,
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
  Radio,
  RadioGroup,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Fab,
  Zoom,
  Fade,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  ShowChart as ChartIcon,
  TableChart as TableIcon,
  Html as HtmlIcon,
  ViewModule as GridIcon,
  ViewColumn as ColumnIcon,
  ViewStream as RowIcon,
  Tune as CustomIcon,
  Visibility as PreviewIcon,
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as CopyIcon,
  DragIndicator as DragIcon,
  InsertChart as InsertChartIcon,
  Code as CodeIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  Sort as SortIcon,
  Palette as PaletteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  OpenWith as OpenWithIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  Link as LinkIcon,
  TouchApp as TouchAppIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { AreaChartIcon, Columns3Icon, DonutIcon, ScatterChartIcon } from "lucide-react";
import {
  childCardConfigState,
  ParentCardConfig,
  ChildCardConfig,
  ChildCardLayout,
  LAYOUT_PRESETS,
  defaultParentCardConfig,
  createDefaultChildCard,
} from '../recoil/ChildCardState';
import {
  childCardTooltipConfigState,
  ChildCardTooltipConfig,
  TooltipDataExtraction,
  TooltipCalculationBinding,
  defaultChildCardTooltipConfig,
  AVAILABLE_HOVER_KEYS,
} from '../recoil/ChildCardTooltipState';
import { storedLogicsState } from '../recoil/StoredLogic';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { hooksArrayOfObjectsSelector, variableNamesState } from '../recoil/Variabletracker';
import { TableSettings, defaultTableSettings, SummaryCalculation, TableDisplayMode } from '../types/tableTypes';
import { JsonEditor } from './JsonEditor';
import { HtmlEditor } from './HtmlEditor';
import ParentCardContainer from './ParentCardContainer';
import ChildCard from './ChildCard';
import TooltipConfigPanel from './TooltipConfigPanel';

// Layout preset icons
const layoutPresetOptions = [
  { key: 'single', label: '1 Card', icon: '▢' },
  { key: 'twoHorizontal', label: '2 Side by Side', icon: '◫' },
  { key: 'twoVertical', label: '2 Stacked', icon: '▤' },
  { key: 'threeTopOne', label: '1 Top + 2 Bottom', icon: '⬓' },
  { key: 'threeBottomOne', label: '2 Top + 1 Bottom', icon: '⬔' },
  { key: 'fourGrid', label: '2×2 Grid', icon: '⊞' },
  { key: 'custom', label: 'Custom', icon: '✎' },
];

// Chart template presets with icons
const chartTemplatePresets = [
  {
    label: "Custom/Manual",
    icon: <CodeIcon fontSize="small" />,
    value: null,
  },
  {
    label: "Line Chart",
    icon: <ChartIcon fontSize="small" />,
    value: {
      chart: { type: "line" },
      title: { text: "Line Chart Example" },
      xAxis: { categories: ["Jan", "Feb", "Mar", "Apr", "May"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Series 1", data: [10, 20, 15, 25, 30] }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Area Chart",
    icon: <AreaChartIcon size={16} />,
    value: {
      chart: { type: "area" },
      title: { text: "Area Chart Example" },
      xAxis: { categories: ["A", "B", "C", "D", "E"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Data Set 1", data: [5, 9, 12, 8, 15] }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Bar Chart",
    icon: <BarChartIcon fontSize="small" />,
    value: {
      chart: { type: "bar" },
      title: { text: "Bar Chart Example" },
      xAxis: { categories: ["Category A", "Category B", "Category C"] },
      yAxis: { title: { text: "Values" } },
      series: [{ name: "Data", data: [100, 80, 120] }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Column Chart",
    icon: <Columns3Icon size={16} />,
    value: {
      chart: { type: "column" },
      title: { text: "Column Chart Example" },
      xAxis: { categories: ["Apples", "Bananas", "Oranges"] },
      yAxis: { title: { text: "Count" } },
      series: [{ name: "Sales", data: [100, 80, 120] }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Pie Chart",
    icon: <PieChartIcon fontSize="small" />,
    value: {
      chart: { type: "pie" },
      title: { text: "Pie Chart Example" },
      plotOptions: {
        pie: {
          dataLabels: {
            enabled: true,
            format: "{point.name}: {point.percentage:.1f}%"
          }
        }
      },
      series: [{
        name: "Data",
        colorByPoint: true,
        data: [
          { name: "Category A", y: 60 },
          { name: "Category B", y: 30 },
          { name: "Category C", y: 10 }
        ]
      }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Donut Chart",
    icon: <DonutIcon size={16} />,
    value: {
      chart: { type: "pie" },
      title: { text: "Donut Chart Example" },
      plotOptions: {
        pie: {
          innerSize: '60%',
          dataLabels: {
            enabled: true,
            format: "{point.name}: {point.percentage:.1f}%"
          }
        }
      },
      series: [{
        name: "Distribution",
        colorByPoint: true,
        data: [
          { name: "Major", y: 45 },
          { name: "Minor", y: 35 },
          { name: "Other", y: 20 }
        ]
      }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  },
  {
    label: "Scatter Chart",
    icon: <ScatterChartIcon size={16} />,
    value: {
      chart: { type: "scatter", zoomType: "xy" },
      title: { text: "Scatter Chart Example" },
      xAxis: { title: { text: "X-Axis Value" } },
      yAxis: { title: { text: "Y-Axis Value" } },
      series: [{
        name: "Observations",
        data: [
          [161.2, 51.6], [167.5, 59.0], [159.5, 49.2], [157.0, 63.2],
          [170.2, 80.1], [180.1, 90.1], [165.2, 55.6], [168.5, 65.0]
        ]
      }],
      credits: { enabled: false },
      exporting: { enabled: true }
    }
  }
];

// Custom Layout Builder Component
interface CustomLayoutBuilderProps {
  parentConfig: ParentCardConfig;
  setParentConfig: (config: ParentCardConfig) => void;
  saveConfig: (config: ParentCardConfig) => void;
  parentId: string;
  getNextChildNumber: (cards: ChildCardConfig[]) => number;
  selectedChildIndex: number;
  setSelectedChildIndex: (index: number) => void;
}

const CustomLayoutBuilder: React.FC<CustomLayoutBuilderProps> = ({
  parentConfig,
  setParentConfig,
  saveConfig,
  parentId,
  getNextChildNumber,
  selectedChildIndex,
  setSelectedChildIndex,
}) => {
  const [topRowCards, setTopRowCards] = useState<number>(1);
  const [bottomRowCards, setBottomRowCards] = useState<number>(0);
  const [useThreeRows, setUseThreeRows] = useState<boolean>(false);
  const [middleRowCards, setMiddleRowCards] = useState<number>(0);

  // Initialize from existing config
  useEffect(() => {
    const cards = parentConfig.childCards;
    if (cards.length === 0) return;
    
    // Detect current layout
    const topCards = cards.filter(c => c.layout.y < 0.33);
    const middleCards = cards.filter(c => c.layout.y >= 0.33 && c.layout.y < 0.66);
    const bottomCards = cards.filter(c => c.layout.y >= 0.66 || (middleCards.length === 0 && c.layout.y >= 0.33));
    
    if (middleCards.length > 0) {
      setUseThreeRows(true);
      setTopRowCards(topCards.length || 1);
      setMiddleRowCards(middleCards.length);
      setBottomRowCards(bottomCards.length);
    } else {
      setUseThreeRows(false);
      setTopRowCards(topCards.length || cards.length);
      setBottomRowCards(bottomCards.length);
    }
  }, []);

  const applyCustomLayout = () => {
    const totalCards = topRowCards + middleRowCards + bottomRowCards;
    if (totalCards < 1 || totalCards > 4) return;

    const newCards: ChildCardConfig[] = [];
    let cardIndex = 0;

    // Calculate row heights
    const numRows = useThreeRows ? 3 : (bottomRowCards > 0 ? 2 : 1);
    const rowHeight = 1 / numRows;

    // Top row
    for (let i = 0; i < topRowCards; i++) {
      const existingCard = parentConfig.childCards[cardIndex];
      const nextNum = existingCard ? parseInt(existingCard.id.match(/_child(\d+)$/)?.[1] || '0') : getNextChildNumber(newCards);
      const childId = existingCard?.id || `${parentId}_child${nextNum}`;
      const layout: ChildCardLayout = {
        id: childId,
        x: i * (1 / topRowCards),
        y: 0,
        w: 1 / topRowCards,
        h: rowHeight,
      };
      if (existingCard) {
        newCards.push({ ...existingCard, layout });
      } else {
        newCards.push(createDefaultChildCard(childId, layout));
      }
      cardIndex++;
    }

    // Middle row (if 3 rows)
    if (useThreeRows && middleRowCards > 0) {
      for (let i = 0; i < middleRowCards; i++) {
        const existingCard = parentConfig.childCards[cardIndex];
        const nextNum = existingCard ? parseInt(existingCard.id.match(/_child(\d+)$/)?.[1] || '0') : getNextChildNumber(newCards);
        const childId = existingCard?.id || `${parentId}_child${nextNum}`;
        const layout: ChildCardLayout = {
          id: childId,
          x: i * (1 / middleRowCards),
          y: rowHeight,
          w: 1 / middleRowCards,
          h: rowHeight,
        };
        if (existingCard) {
          newCards.push({ ...existingCard, layout });
        } else {
          newCards.push(createDefaultChildCard(childId, layout));
        }
        cardIndex++;
      }
    }

    // Bottom row
    if (bottomRowCards > 0) {
      const bottomY = useThreeRows ? rowHeight * 2 : rowHeight;
      for (let i = 0; i < bottomRowCards; i++) {
        const existingCard = parentConfig.childCards[cardIndex];
        const nextNum = existingCard ? parseInt(existingCard.id.match(/_child(\d+)$/)?.[1] || '0') : getNextChildNumber(newCards);
        const childId = existingCard?.id || `${parentId}_child${nextNum}`;
        const layout: ChildCardLayout = {
          id: childId,
          x: i * (1 / bottomRowCards),
          y: bottomY,
          w: 1 / bottomRowCards,
          h: rowHeight,
        };
        if (existingCard) {
          newCards.push({ ...existingCard, layout });
        } else {
          newCards.push(createDefaultChildCard(childId, layout));
        }
        cardIndex++;
      }
    }

    const newConfig = { ...parentConfig, childCards: newCards };
    setParentConfig(newConfig);
    saveConfig(newConfig);
    if (selectedChildIndex >= newCards.length) {
      setSelectedChildIndex(Math.max(0, newCards.length - 1));
    }
  };

  const totalCards = topRowCards + (useThreeRows ? middleRowCards : 0) + bottomRowCards;
  const isValid = totalCards >= 1 && totalCards <= 4;

  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 2,
        border: '2px solid rgba(102, 126, 234, 0.3)',
        bgcolor: 'rgba(102, 126, 234, 0.02)',
      }}
    >
      <Typography variant="subtitle2" fontWeight={600} gutterBottom color="#667eea">
        Custom Layout Builder
      </Typography>
      
      <Stack spacing={2}>
        {/* Top Row */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Top Row Cards:
          </Typography>
          <ToggleButtonGroup
            value={topRowCards}
            exclusive
            onChange={(_, val) => val !== null && setTopRowCards(val)}
            size="small"
            sx={{ 
              bgcolor: 'white',
              '& .MuiToggleButton-root': {
                px: 2, py: 0.5,
                '&.Mui-selected': { bgcolor: '#667eea', color: 'white' },
              },
            }}
          >
            <ToggleButton value={0}>0</ToggleButton>
            <ToggleButton value={1}>1</ToggleButton>
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={3}>3</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Three rows toggle */}
        <FormControlLabel
          control={
            <Switch
              checked={useThreeRows}
              onChange={(e) => {
                setUseThreeRows(e.target.checked);
                if (!e.target.checked) setMiddleRowCards(0);
              }}
              size="small"
            />
          }
          label={<Typography variant="caption">Use 3 rows</Typography>}
        />

        {/* Middle Row (if enabled) */}
        {useThreeRows && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Middle Row Cards:
            </Typography>
            <ToggleButtonGroup
              value={middleRowCards}
              exclusive
              onChange={(_, val) => val !== null && setMiddleRowCards(val)}
              size="small"
              sx={{ 
                bgcolor: 'white',
                '& .MuiToggleButton-root': {
                  px: 2, py: 0.5,
                  '&.Mui-selected': { bgcolor: '#10b981', color: 'white' },
                },
              }}
            >
              <ToggleButton value={0}>0</ToggleButton>
              <ToggleButton value={1}>1</ToggleButton>
              <ToggleButton value={2}>2</ToggleButton>
              <ToggleButton value={3}>3</ToggleButton>
              <ToggleButton value={4}>4</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Bottom Row */}
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
            Bottom Row Cards:
          </Typography>
          <ToggleButtonGroup
            value={bottomRowCards}
            exclusive
            onChange={(_, val) => val !== null && setBottomRowCards(val)}
            size="small"
            sx={{ 
              bgcolor: 'white',
              '& .MuiToggleButton-root': {
                px: 2, py: 0.5,
                '&.Mui-selected': { bgcolor: '#f59e0b', color: 'white' },
              },
            }}
          >
            <ToggleButton value={0}>0</ToggleButton>
            <ToggleButton value={1}>1</ToggleButton>
            <ToggleButton value={2}>2</ToggleButton>
            <ToggleButton value={3}>3</ToggleButton>
            <ToggleButton value={4}>4</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Preview & Apply */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pt: 1 }}>
          <Chip 
            label={`Total: ${totalCards} card${totalCards !== 1 ? 's' : ''}`}
            color={isValid ? 'primary' : 'error'}
            size="small"
          />
          {!isValid && (
            <Typography variant="caption" color="error">
              Must have 1-4 cards total
            </Typography>
          )}
          <Button
            variant="contained"
            size="small"
            disabled={!isValid}
            onClick={applyCustomLayout}
            sx={{
              ml: 'auto',
              bgcolor: '#667eea',
              '&:hover': { bgcolor: '#5568d3' },
            }}
          >
            Apply Layout
          </Button>
        </Box>

        {/* Visual Preview */}
        <Box 
          sx={{ 
            mt: 1, 
            p: 1, 
            bgcolor: 'rgba(0,0,0,0.03)', 
            borderRadius: 1,
            border: '1px dashed rgba(102, 126, 234, 0.3)',
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Preview:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, height: 80 }}>
            {/* Top Row Preview */}
            {topRowCards > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                {Array.from({ length: topRowCards }).map((_, i) => (
                  <Box 
                    key={`top-${i}`}
                    sx={{ 
                      flex: 1, 
                      bgcolor: '#667eea', 
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </Box>
                ))}
              </Box>
            )}
            {/* Middle Row Preview */}
            {useThreeRows && middleRowCards > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                {Array.from({ length: middleRowCards }).map((_, i) => (
                  <Box 
                    key={`mid-${i}`}
                    sx={{ 
                      flex: 1, 
                      bgcolor: '#10b981', 
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                    }}
                  >
                    {topRowCards + i + 1}
                  </Box>
                ))}
              </Box>
            )}
            {/* Bottom Row Preview */}
            {bottomRowCards > 0 && (
              <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                {Array.from({ length: bottomRowCards }).map((_, i) => (
                  <Box 
                    key={`bot-${i}`}
                    sx={{ 
                      flex: 1, 
                      bgcolor: '#f59e0b', 
                      borderRadius: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '0.6rem',
                      fontWeight: 600,
                    }}
                  >
                    {topRowCards + (useThreeRows ? middleRowCards : 0) + i + 1}
                  </Box>
                ))}
              </Box>
            )}
            {totalCards === 0 && (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="caption" color="text.secondary">No cards configured</Typography>
              </Box>
            )}
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
};

// HTML template presets
const htmlTemplatePresets = [
  { label: "Custom", value: "" },
  {
    label: "KPI Card",
    value: `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; color: white; text-align: center;">
  <h2 style="font-size: 48px; font-weight: bold; margin: 0;">$1.2M</h2>
  <p style="font-size: 18px; margin: 8px 0 0 0; opacity: 0.9;">Total Revenue</p>
  <div style="margin-top: 16px; display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.2); padding: 8px 16px; border-radius: 20px;">
    <span style="font-size: 24px;">↑</span>
    <span style="font-size: 16px; font-weight: 600;">23.5%</span>
  </div>
</div>`
  },
  {
    label: "Info Card",
    value: `<div style="background: linear-gradient(135deg, #e0e7ff 0%, #ddd6fe 100%); border-radius: 12px; padding: 24px; height: 100%; display: flex; flex-direction: column;">
  <h3 style="margin: 0; font-size: 20px; font-weight: bold; color: #1e293b;">Dashboard Stats</h3>
  <p style="margin: 4px 0 16px 0; font-size: 14px; color: #64748b;">Updated just now</p>
  <div style="flex: 1; display: flex; flex-direction: column; gap: 12px;">
    <div style="background: white; border-radius: 8px; padding: 16px; border-left: 4px solid #667eea;">
      <p style="margin: 0; font-size: 14px; color: #64748b;">Active Users</p>
      <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: bold; color: #1e293b;">1,234</p>
    </div>
  </div>
</div>`
  },
  {
    label: "Metric Grid",
    value: `<div style="padding: 20px; height: 100%; background: white; border-radius: 12px;">
  <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: bold; color: #1e293b;">Key Metrics</h3>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Sales</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">$45K</p>
    </div>
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 16px; color: white;">
      <p style="margin: 0; font-size: 12px; opacity: 0.9;">Orders</p>
      <p style="margin: 8px 0 0 0; font-size: 28px; font-weight: bold;">328</p>
    </div>
  </div>
</div>`
  }
];

// 🔥 Interactive Layout Editor Component - Visual drag/resize like main dashboard
type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

interface InteractiveLayoutEditorProps {
  pendingCards: ChildCardConfig[];
  onLayoutChange: (cards: ChildCardConfig[]) => void;
  parentId: string;
  getNextChildNumber: (cards: ChildCardConfig[]) => number;
  allowAddRemove?: boolean;
  height?: number;
}

const InteractiveLayoutEditor: React.FC<InteractiveLayoutEditorProps> = ({
  pendingCards,
  onLayoutChange,
  parentId,
  getNextChildNumber,
  allowAddRemove = false,
  height = 280,
}) => {
  const GRID_COLS = 12;
  const GRID_ROWS = 12;
  const MIN_SIZE = 1 / GRID_COLS; // Minimum size in grid units
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasOverlap, setHasOverlap] = useState(false);
  
  const [resizing, setResizing] = useState<{
    cardIndex: number;
    edge: ResizeEdge;
    startX: number;
    startY: number;
    startLayout: ChildCardLayout;
  } | null>(null);

  const [dragging, setDragging] = useState<{
    cardIndex: number;
    startX: number;
    startY: number;
    startLayout: ChildCardLayout;
  } | null>(null);

  // Get container dimensions
  const getContainerRect = () => containerRef.current?.getBoundingClientRect() || { width: 400, height: 300 };

  // 🔥 Check if two cards overlap
  const cardsOverlap = (a: ChildCardLayout, b: ChildCardLayout): boolean => {
    const aRight = a.x + a.w;
    const aBottom = a.y + a.h;
    const bRight = b.x + b.w;
    const bBottom = b.y + b.h;
    
    // Check if they don't overlap (with small tolerance for floating point)
    const tolerance = 0.001;
    return !(aRight <= b.x + tolerance || bRight <= a.x + tolerance || 
             aBottom <= b.y + tolerance || bBottom <= a.y + tolerance);
  };

  // 🔥 Check if a card overlaps with any other card
  const hasCollision = (layout: ChildCardLayout, cardIndex: number, cards: ChildCardConfig[]): boolean => {
    return cards.some((other, i) => {
      if (i === cardIndex) return false;
      return cardsOverlap(layout, other.layout);
    });
  };

  // 🔥 Snap value to grid
  const snapToGrid = (value: number): number => {
    return Math.round(value * GRID_COLS) / GRID_COLS;
  };

  // 🔥 Clamp value between min and max
  const clamp = (value: number, min: number, max: number): number => {
    return Math.max(min, Math.min(max, value));
  };

  // Handle mouse move for resize - with ALL edges support
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      const deltaX = (e.clientX - resizing.startX) / rect.width;
      const deltaY = (e.clientY - resizing.startY) / rect.height;
      
      const newCards = [...pendingCards];
      const card = newCards[resizing.cardIndex];
      const start = resizing.startLayout;
      let newLayout = { ...card.layout };

      // Handle each edge/corner
      switch (resizing.edge) {
        case 'e': // Right edge
          newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x));
          break;
        case 'w': // Left edge
          const newX_w = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_w));
          newLayout.x = newX_w;
          break;
        case 's': // Bottom edge
          newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y));
          break;
        case 'n': // Top edge
          const newY_n = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_n));
          newLayout.y = newY_n;
          break;
        case 'se': // Bottom-right corner
          newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x));
          newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y));
          break;
        case 'sw': // Bottom-left corner
          const newX_sw = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_sw));
          newLayout.x = newX_sw;
          newLayout.h = snapToGrid(clamp(start.h + deltaY, MIN_SIZE, 1 - start.y));
          break;
        case 'ne': // Top-right corner
          newLayout.w = snapToGrid(clamp(start.w + deltaX, MIN_SIZE, 1 - start.x));
          const newY_ne = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_ne));
          newLayout.y = newY_ne;
          break;
        case 'nw': // Top-left corner
          const newX_nw = snapToGrid(clamp(start.x + deltaX, 0, start.x + start.w - MIN_SIZE));
          newLayout.w = snapToGrid(start.w + (start.x - newX_nw));
          newLayout.x = newX_nw;
          const newY_nw = snapToGrid(clamp(start.y + deltaY, 0, start.y + start.h - MIN_SIZE));
          newLayout.h = snapToGrid(start.h + (start.y - newY_nw));
          newLayout.y = newY_nw;
          break;
      }

      // Check for collision
      const wouldCollide = hasCollision(newLayout, resizing.cardIndex, newCards);
      setHasOverlap(wouldCollide);
      
      // Only apply if no collision
      if (!wouldCollide) {
        newCards[resizing.cardIndex] = { ...card, layout: newLayout };
        onLayoutChange(newCards);
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
  }, [resizing, pendingCards, onLayoutChange]);

  // Handle mouse move for drag with collision detection
  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = getContainerRect();
      const deltaX = (e.clientX - dragging.startX) / rect.width;
      const deltaY = (e.clientY - dragging.startY) / rect.height;
      
      const newCards = [...pendingCards];
      const card = newCards[dragging.cardIndex];
      
      let newX = snapToGrid(clamp(dragging.startLayout.x + deltaX, 0, 1 - card.layout.w));
      let newY = snapToGrid(clamp(dragging.startLayout.y + deltaY, 0, 1 - card.layout.h));

      const newLayout = { ...card.layout, x: newX, y: newY };
      
      // Check for collision
      const wouldCollide = hasCollision(newLayout, dragging.cardIndex, newCards);
      setHasOverlap(wouldCollide);
      
      // Only apply if no collision
      if (!wouldCollide) {
        newCards[dragging.cardIndex] = { ...card, layout: newLayout };
        onLayoutChange(newCards);
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
  }, [dragging, pendingCards, onLayoutChange]);

  // Get display number from card ID
  const getDisplayNum = (cardId: string, index: number) => {
    const match = cardId.match(/_child(\d+)$/);
    return match ? parseInt(match[1], 10) : index + 1;
  };

  // 🔥 Find non-overlapping position for new card
  // Default size is 3/12 grid (25%) as requested
  const findAvailablePosition = (): { x: number; y: number; w: number; h: number } => {
    const defaultSize = { w: 3 / GRID_COLS, h: 3 / GRID_ROWS }; // 3/12 = 0.25 (25%)
    
    // Try grid positions to find a free spot
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const testLayout = {
          id: 'test',
          x: x / GRID_COLS,
          y: y / GRID_ROWS,
          w: defaultSize.w,
          h: defaultSize.h,
        };
        
        // Ensure it fits within bounds
        if (testLayout.x + testLayout.w > 1) continue;
        if (testLayout.y + testLayout.h > 1) continue;
        
        // Check collision with all existing cards
        const hasAnyCollision = pendingCards.some(card => cardsOverlap(testLayout, card.layout));
        if (!hasAnyCollision) {
          return { x: testLayout.x, y: testLayout.y, ...defaultSize };
        }
      }
    }
    
    // Fallback: smaller size at origin
    return { x: 0, y: 0, w: 3 / GRID_COLS, h: 3 / GRID_ROWS };
  };

  // 🔥 Add a new card to the layout
  const handleAddCard = () => {
    if (pendingCards.length >= 4) return;
    
    const nextNum = getNextChildNumber(pendingCards);
    const childId = `${parentId}_child${nextNum}`;
    const position = findAvailablePosition();
    
    const newLayout: ChildCardLayout = {
      id: childId,
      ...position,
    };
    
    const newCard = createDefaultChildCard(childId, newLayout);
    onLayoutChange([...pendingCards, newCard]);
  };

  // 🔥 Remove a card from the layout
  const handleRemoveCard = (index: number) => {
    if (pendingCards.length <= 1) return;
    const newCards = pendingCards.filter((_, i) => i !== index);
    onLayoutChange(newCards);
  };

  // Resize handle styles
  const getResizeHandleStyle = (edge: ResizeEdge): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      backgroundColor: 'rgba(255,255,255,0.4)',
      zIndex: 10,
    };
    
    switch (edge) {
      case 'n': return { ...base, top: 0, left: '20%', right: '20%', height: 6, cursor: 'ns-resize', borderRadius: '0 0 3px 3px' };
      case 's': return { ...base, bottom: 0, left: '20%', right: '20%', height: 6, cursor: 'ns-resize', borderRadius: '3px 3px 0 0' };
      case 'e': return { ...base, right: 0, top: '20%', bottom: '20%', width: 6, cursor: 'ew-resize', borderRadius: '3px 0 0 3px' };
      case 'w': return { ...base, left: 0, top: '20%', bottom: '20%', width: 6, cursor: 'ew-resize', borderRadius: '0 3px 3px 0' };
      case 'ne': return { ...base, top: 0, right: 0, width: 12, height: 12, cursor: 'nesw-resize', borderRadius: '0 0 0 6px' };
      case 'nw': return { ...base, top: 0, left: 0, width: 12, height: 12, cursor: 'nwse-resize', borderRadius: '0 0 6px 0' };
      case 'se': return { ...base, bottom: 0, right: 0, width: 12, height: 12, cursor: 'nwse-resize', borderRadius: '6px 0 0 0' };
      case 'sw': return { ...base, bottom: 0, left: 0, width: 12, height: 12, cursor: 'nesw-resize', borderRadius: '0 6px 0 0' };
      default: return base;
    }
  };

  return (
    <Box>
      {/* 🔥 Add/Remove Controls */}
      {allowAddRemove && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleAddCard}
            disabled={pendingCards.length >= 4}
            sx={{
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': { borderColor: '#5568d3', bgcolor: 'rgba(102,126,234,0.05)' },
            }}
          >
            Add Card
          </Button>
          <Chip 
            label={`${pendingCards.length}/4 cards`}
            size="small"
            sx={{ 
              bgcolor: pendingCards.length >= 4 ? 'rgba(239,68,68,0.1)' : 'rgba(102,126,234,0.1)',
              color: pendingCards.length >= 4 ? '#ef4444' : '#667eea',
            }}
          />
          {hasOverlap && (
            <Chip 
              label="⚠ Cards cannot overlap"
              size="small"
              sx={{ bgcolor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            />
          )}
        </Box>
      )}

      <Box
        ref={containerRef}
        sx={{
          position: 'relative',
          width: '100%',
          height: height,
          bgcolor: 'rgba(0,0,0,0.03)',
          borderRadius: 2,
          border: hasOverlap ? '2px solid #ef4444' : '2px dashed rgba(102, 126, 234, 0.3)',
          overflow: 'hidden',
          cursor: dragging ? 'grabbing' : 'default',
          transition: 'border-color 0.2s',
        }}
      >
        {/* Grid lines for visual guidance */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(102,126,234,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(102,126,234,0.08) 1px, transparent 1px)
            `,
            backgroundSize: `${100/GRID_COLS}% ${100/GRID_ROWS}%`,
            pointerEvents: 'none',
          }}
        />

        {/* Cards */}
        {pendingCards.map((card, index) => (
          <Box
            key={card.id}
            sx={{
              position: 'absolute',
              left: `${card.layout.x * 100}%`,
              top: `${card.layout.y * 100}%`,
              width: `${card.layout.w * 100}%`,
              height: `${card.layout.h * 100}%`,
              p: 0.5,
              boxSizing: 'border-box',
              zIndex: dragging?.cardIndex === index || resizing?.cardIndex === index ? 100 : 1,
            }}
          >
            <Paper
              elevation={dragging?.cardIndex === index || resizing?.cardIndex === index ? 8 : 2}
              sx={{
                height: '100%',
                borderRadius: 1.5,
                bgcolor: card.type === 'chart' ? '#667eea' :
                         card.type === 'table' ? '#10b981' : '#f59e0b',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                position: 'relative',
                transition: (dragging?.cardIndex === index || resizing?.cardIndex === index) ? 'none' : 'box-shadow 0.2s',
                cursor: 'grab',
                userSelect: 'none',
                border: (dragging?.cardIndex === index || resizing?.cardIndex === index) 
                  ? '2px solid rgba(255,255,255,0.8)' 
                  : '2px solid transparent',
                '&:hover': { 
                  boxShadow: 6,
                  '& .resize-handle': { opacity: 1 },
                },
              }}
              onMouseDown={(e) => {
                if ((e.target as HTMLElement).dataset.resize) return;
                setDragging({
                  cardIndex: index,
                  startX: e.clientX,
                  startY: e.clientY,
                  startLayout: { ...card.layout },
                });
              }}
            >
              {/* 🔥 Delete button (only in add/remove mode) */}
              {allowAddRemove && pendingCards.length > 1 && (
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveCard(index);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    p: 0.25,
                    bgcolor: 'rgba(0,0,0,0.3)',
                    color: 'white',
                    zIndex: 20,
                    '&:hover': { bgcolor: 'rgba(239,68,68,0.9)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}

              <OpenWithIcon sx={{ fontSize: 20, opacity: 0.7, mb: 0.5 }} />
              <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
                Card {getDisplayNum(card.id, index)}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.6rem', opacity: 0.8, textTransform: 'capitalize' }}>
                {card.type}
              </Typography>

              {/* 🔥 ALL 8 resize handles */}
              {(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as ResizeEdge[]).map((edge) => (
                <Box
                  key={edge}
                  data-resize={edge}
                  className="resize-handle"
                  sx={{
                    ...getResizeHandleStyle(edge),
                    opacity: 0.5,
                    transition: 'opacity 0.2s, background-color 0.2s',
                    '&:hover': { 
                      opacity: 1, 
                      bgcolor: 'rgba(255,255,255,0.7)' 
                    },
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setResizing({
                      cardIndex: index,
                      edge,
                      startX: e.clientX,
                      startY: e.clientY,
                      startLayout: { ...card.layout },
                    });
                  }}
                />
              ))}
            </Paper>
          </Box>
        ))}

        {/* Empty state */}
        {pendingCards.length === 0 && (
          <Box sx={{ 
            position: 'absolute', 
            inset: 0, 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            gap: 1,
          }}>
            <AddIcon sx={{ fontSize: 32, color: '#9ca3af' }} />
            <Typography variant="body2" color="text.secondary">
              {allowAddRemove ? 'Click "Add Card" to start building your layout' : 'No cards to preview'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
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

export default function ChildCardConfigTab() {
  const { id } = useParams<{ id: string }>();
  const [childCardConfigs, setChildCardConfigs] = useRecoilState(childCardConfigState);
  const [tooltipConfigs, setTooltipConfigs] = useRecoilState(childCardTooltipConfigState);
  const storedLogics = useRecoilValue(storedLogicsState);
  const arrayOfObjectsVariables = useRecoilValue(hooksArrayOfObjectsSelector);
  const variableNames = useRecoilValue(variableNamesState);
  
  // 🔥 Convert Set to sorted array for dropdowns
  const variableNamesList = useMemo(() => {
    return Array.from(variableNames).sort();
  }, [variableNames]);
  
  // Get available calculations for tooltip
  const availableCalculations = useMemo(() => {
    return storedLogics.map(logic => ({
      id: logic.variableName,
      name: logic.variableName,
    }));
  }, [storedLogics]);
  
  // Local state for editing
  const [parentConfig, setParentConfig] = useState<ParentCardConfig>(defaultParentCardConfig);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(0);
  const [expandedAccordion, setExpandedAccordion] = useState<string | false>('layout');
  const [showPreview, setShowPreview] = useState<boolean>(true);
  const [tableColumns, setTableColumns] = useState<string[]>([]);
  const [availableVariables, setAvailableVariables] = useState<Record<string, any>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>('Custom/Manual');
  const [selectedHtmlTemplate, setSelectedHtmlTemplate] = useState<string>('Custom');
  const [selectedLayoutPreset, setSelectedLayoutPreset] = useState<string>('single');
  const [jsonError, setJsonError] = useState<string | null>(null);
  
  // 🔥 NEW: Pending layout state for preview mode
  const [pendingLayoutCards, setPendingLayoutCards] = useState<ChildCardConfig[] | null>(null);
  const [pendingLayoutPreset, setPendingLayoutPreset] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  
  // 🔥 NEW: Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    presetKey: string;
    presetLabel: string;
    newCardCount: number;
  }>({ open: false, presetKey: '', presetLabel: '', newCardCount: 0 });
  
  // 🔥 NEW: Fullscreen preview state
  const [isFullscreenPreview, setIsFullscreenPreview] = useState<boolean>(false);
  
  // 🔥 NEW: Draggable FAB state
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number }>({ x: 16, y: 16 });
  const [isDraggingFab, setIsDraggingFab] = useState<boolean>(false);
  const fabDragStartRef = useRef<{ x: number; y: number; fabX: number; fabY: number } | null>(null);

  // Helper to get table columns
  const getTableColumns = React.useCallback(async (varName: string, snapshot: any) => {
    try {
      const loadable = snapshot.getLoadable(variableAtomFamily(varName));
      if (loadable.state === 'hasValue') {
        const value = loadable.contents;
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        if (Array.isArray(data) && data.length > 0) {
          return Object.keys(data[0]);
        }
      }
    } catch (e) {
      // ignore
    }
    return [];
  }, []);

  // useRecoilCallback to fetch columns
  const fetchColumns = useRecoilCallback(({ snapshot }) => async (varName: string) => {
    const cols = await getTableColumns(varName, snapshot);
    setTableColumns(cols);
  }, [getTableColumns]);

  // Fetch all variable values for auto-completion
  const fetchAllVariables = useRecoilCallback(({ snapshot }) => async () => {
    const vars: Record<string, any> = {};
    for (const name of Array.from(variableNames)) {
      try {
        const loadable = snapshot.getLoadable(variableAtomFamily(name));
        if (loadable.state === 'hasValue') {
          const value = loadable.contents;
          try {
            vars[name] = JSON.parse(value);
          } catch {
            vars[name] = value;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    setAvailableVariables(vars);
  }, [variableNames]);

  // Load variables on mount and when variableNames change
  useEffect(() => {
    fetchAllVariables();
  }, [fetchAllVariables, variableNames]);

  // Reset template selection and clear errors when switching cards
  useEffect(() => {
    setSelectedTemplate('Custom/Manual');
    setSelectedHtmlTemplate('Custom');
    setJsonError(null); // Clear any JSON errors when switching cards
  }, [selectedChildIndex]);

  // 🔥 IMPROVED: Helper function to detect layout preset from child cards
  // Returns 'custom' if layout doesn't match any standard preset
  const detectLayoutPreset = (childCards: ChildCardConfig[]): string => {
    if (!childCards || childCards.length === 0) return 'single';
    
    const count = childCards.length;
    
    // Helper to check if layouts match a preset
    const matchesPreset = (presetKey: keyof typeof LAYOUT_PRESETS): boolean => {
      const preset = LAYOUT_PRESETS[presetKey];
      if (preset.length !== count) return false;
      
      // Check each card position/size matches (with tolerance for floating point)
      const tolerance = 0.05;
      return childCards.every((card, i) => {
        const presetLayout = preset[i];
        return (
          Math.abs(card.layout.x - presetLayout.x) < tolerance &&
          Math.abs(card.layout.y - presetLayout.y) < tolerance &&
          Math.abs(card.layout.w - presetLayout.w) < tolerance &&
          Math.abs(card.layout.h - presetLayout.h) < tolerance
        );
      });
    };
    
    // Check against all presets
    if (count === 1 && matchesPreset('single')) return 'single';
    if (count === 2) {
      if (matchesPreset('twoHorizontal')) return 'twoHorizontal';
      if (matchesPreset('twoVertical')) return 'twoVertical';
    }
    if (count === 3) {
      if (matchesPreset('threeTopOne')) return 'threeTopOne';
      if (matchesPreset('threeBottomOne')) return 'threeBottomOne';
    }
    if (count === 4 && matchesPreset('fourGrid')) return 'fourGrid';
    
    // If no preset matches, it's a custom layout
    return 'custom';
  };

  // Load saved config (preserve current selection after first load)
  const hasInitializedRef = useRef(false);
  useEffect(() => {
    if (id && childCardConfigs[id]) {
      const config = childCardConfigs[id];
      setParentConfig(config);
      
      // Detect and set the layout preset
      if (config.childCards && config.childCards.length > 0) {
        const detectedPreset = detectLayoutPreset(config.childCards);
        setSelectedLayoutPreset(detectedPreset);
      }

      setSelectedChildIndex(prev => {
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true;
          return 0;
        }
        const safeIndex = Math.min(prev, Math.max(0, (config.childCards?.length || 1) - 1));
        return safeIndex;
      });
    } else {
      setParentConfig({ ...defaultParentCardConfig, isContainer: false });
      setSelectedLayoutPreset('single');
      if (!hasInitializedRef.current) {
        setSelectedChildIndex(0);
      }
    }
  }, [id, childCardConfigs]);

  // Save config whenever it changes
  const saveConfig = useCallback((config: ParentCardConfig) => {
    if (!id) return;
    
    setChildCardConfigs(prev => ({
      ...prev,
      [id]: config,
    }));
  }, [id, setChildCardConfigs]);

  // Helper function to get the next child number for ID generation
  const getNextChildNumber = (existingCards: ChildCardConfig[]): number => {
    const existingNumbers = existingCards.map(card => {
      const match = card.id.match(/_child(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    return existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
  };

  // Helper function to extract the display number from child card ID (e.g., "17_child2" -> "2")
  const getChildDisplayNumber = (childId: string, fallbackIndex: number): number => {
    const match = childId.match(/_child(\d+)$/);
    return match ? parseInt(match[1], 10) : fallbackIndex + 1;
  };

  // Handle enabling container mode
  const handleEnableContainer = (enabled: boolean) => {
    if (enabled) {
      // Generate unique ID based on parent card ID: parentId_child1
      const childId = `${id}_child1`;
      // Default card size: 3/12 grid (25%)
      const defaultLayout: ChildCardLayout = { 
        id: childId, 
        x: 0, 
        y: 0, 
        w: 3 / 12, // 25% width
        h: 3 / 12, // 25% height
      };
      const newConfig = {
        ...parentConfig,
        isContainer: true,
        containerLayout: 'custom' as const,
        childCards: parentConfig.childCards.length === 0 
          ? [createDefaultChildCard(childId, defaultLayout)]
          : parentConfig.childCards,
      };
      setParentConfig(newConfig);
      saveConfig(newConfig);
      // Set to custom preset and open layout accordion
      setSelectedLayoutPreset('custom');
      setExpandedAccordion('layout');
    } else {
      const newConfig = {
        ...parentConfig,
        isContainer: false,
      };
      setParentConfig(newConfig);
      saveConfig(newConfig);
    }
  };

  // 🔥 Generate pending cards for a preset (for preview)
  const generatePendingCardsForPreset = (presetKey: string): ChildCardConfig[] => {
    if (presetKey === 'custom') {
      // For custom, keep existing or create one default with 3/12 size
      if (parentConfig.childCards.length === 0) {
        const childId = `${id}_child1`;
        const newLayout: ChildCardLayout = { 
          id: childId, 
          x: 0, 
          y: 0, 
          w: 3 / 12, // 25% width (3/12 grid)
          h: 3 / 12, // 25% height (3/12 grid)
        };
        return [createDefaultChildCard(childId, newLayout)];
      }
      return [...parentConfig.childCards];
    }
    
    const preset = LAYOUT_PRESETS[presetKey as keyof typeof LAYOUT_PRESETS];
    if (!preset) return [...parentConfig.childCards];

    // Create child cards based on preset
    return preset.map((layout, index) => {
      // Preserve existing child card data if it exists
      const existingChild = parentConfig.childCards[index];
      if (existingChild) {
        return { ...existingChild, layout: { ...layout, id: existingChild.id } };
      } else {
        // Generate unique ID based on parent card ID: parentId_child{n}
        const childNumber = getNextChildNumber(parentConfig.childCards.slice(0, index));
        const childId = `${id}_child${childNumber}`;
        return createDefaultChildCard(childId, { ...layout, id: childId });
      }
    });
  };

  // 🔥 Handle layout preset selection - NOW WITH PREVIEW MODE
  const handleLayoutPresetChange = (presetKey: string) => {
    const preset = LAYOUT_PRESETS[presetKey as keyof typeof LAYOUT_PRESETS];
    const newCardCount = presetKey === 'custom' 
      ? Math.max(1, parentConfig.childCards.length) 
      : (preset?.length || 1);
    const currentCardCount = parentConfig.childCards.length;
    
    // If this would remove cards, show confirmation dialog
    if (currentCardCount > newCardCount && currentCardCount > 0) {
      const presetOption = layoutPresetOptions.find(p => p.key === presetKey);
      setConfirmDialog({
        open: true,
        presetKey,
        presetLabel: presetOption?.label || presetKey,
        newCardCount,
      });
      return;
    }
    
    // Generate pending layout for preview
    const pendingCards = generatePendingCardsForPreset(presetKey);
    setPendingLayoutCards(pendingCards);
    setPendingLayoutPreset(presetKey);
    setIsPreviewMode(true);
  };

  // 🔥 Apply pending layout changes
  const applyPendingLayout = () => {
    if (!pendingLayoutCards || !pendingLayoutPreset) return;
    
    const newConfig = {
      ...parentConfig,
      containerLayout: pendingLayoutPreset === 'single' ? 'grid' : 'custom' as any,
      childCards: pendingLayoutCards,
    };
    
    setParentConfig(newConfig);
    saveConfig(newConfig);
    setSelectedLayoutPreset(pendingLayoutPreset);
    setSelectedChildIndex(0);
    
    // Clear preview mode
    setPendingLayoutCards(null);
    setPendingLayoutPreset(null);
    setIsPreviewMode(false);
  };

  // 🔥 Cancel pending layout changes
  const cancelPendingLayout = () => {
    setPendingLayoutCards(null);
    setPendingLayoutPreset(null);
    setIsPreviewMode(false);
  };

  // 🔥 Handle confirmation dialog confirm
  const handleConfirmLayoutChange = () => {
    const pendingCards = generatePendingCardsForPreset(confirmDialog.presetKey);
    setPendingLayoutCards(pendingCards);
    setPendingLayoutPreset(confirmDialog.presetKey);
    setIsPreviewMode(true);
    setConfirmDialog({ ...confirmDialog, open: false });
  };

  // 🔥 Update pending layout from interactive editor
  const handlePendingLayoutChange = (cards: ChildCardConfig[]) => {
    setPendingLayoutCards(cards);
    // When manually editing, mark as custom
    setPendingLayoutPreset('custom');
  };

  // Handle adding a new child card
  const handleAddChildCard = () => {
    if (parentConfig.childCards.length >= 4) return;

    // Generate unique ID based on parent card ID: parentId_child{n}
    const nextChildNumber = getNextChildNumber(parentConfig.childCards);
    const childId = `${id}_child${nextChildNumber}`;
    const newLayout: ChildCardLayout = {
      id: childId,
      x: 0,
      y: parentConfig.childCards.length * 0.25,
      w: 1,
      h: 0.25,
    };

    const newChild = createDefaultChildCard(childId, newLayout);
    const newConfig = {
      ...parentConfig,
      childCards: [...parentConfig.childCards, newChild],
    };

    setParentConfig(newConfig);
    saveConfig(newConfig);
    setSelectedChildIndex(newConfig.childCards.length - 1);
  };

  // Handle removing a child card
  const handleRemoveChildCard = async (index: number) => {
    if (parentConfig.childCards.length <= 1) return;

    const removedChildCard = parentConfig.childCards[index];
    const childCardKey = `${id}_${removedChildCard.id}`;

    const newChildCards = parentConfig.childCards.filter((_, i) => i !== index);
    const newConfig = {
      ...parentConfig,
      childCards: newChildCards,
    };

    setParentConfig(newConfig);
    saveConfig(newConfig);
    setSelectedChildIndex(Math.min(index, newChildCards.length - 1));

    // 🔥 Also delete the tooltip config for this child card
    try {
      await fetch(`http://localhost:3002/api/child-card-tooltip-configs/${encodeURIComponent(childCardKey)}`, {
        method: 'DELETE',
      });
      console.log(`✅ Tooltip config for ${childCardKey} deleted from database`);
    } catch (err) {
      console.warn(`Warning: Failed to delete tooltip config for ${childCardKey}:`, err);
    }

    // Update frontend state
    setTooltipConfigs(prev => {
      const updated = { ...prev };
      delete updated[childCardKey];
      return updated;
    });
  };

  // Handle child card property change
  const handleChildCardChange = (index: number, updates: Partial<ChildCardConfig>) => {
    const newChildCards = [...parentConfig.childCards];
    newChildCards[index] = { ...newChildCards[index], ...updates };

    const newConfig = {
      ...parentConfig,
      childCards: newChildCards,
    };

    setParentConfig(newConfig);
    saveConfig(newConfig);
  };

  // 🔥 TOOLTIP CONFIG HANDLERS
  // Get the tooltip key for a child card
  const getTooltipKey = useCallback((childId: string) => {
    return id ? `${id}_${childId}` : '';
  }, [id]);

  // Get tooltip config for current child
  const currentTooltipConfig = useMemo(() => {
    const selectedChild = parentConfig.childCards[selectedChildIndex];
    if (!selectedChild || !id) return defaultChildCardTooltipConfig;
    const key = getTooltipKey(selectedChild.id);
    return tooltipConfigs[key] || defaultChildCardTooltipConfig;
  }, [parentConfig.childCards, selectedChildIndex, id, tooltipConfigs, getTooltipKey]);

  // Update tooltip config for current child
  const updateTooltipConfig = useCallback((updates: Partial<ChildCardTooltipConfig>) => {
    const selectedChild = parentConfig.childCards[selectedChildIndex];
    if (!selectedChild || !id) return;
    
    const key = getTooltipKey(selectedChild.id);
    setTooltipConfigs(prev => ({
      ...prev,
      [key]: {
        ...defaultChildCardTooltipConfig,
        ...prev[key],
        ...updates,
      },
    }));
  }, [parentConfig.childCards, selectedChildIndex, id, getTooltipKey, setTooltipConfigs]);

  // Add data extraction
  const addDataExtraction = useCallback(() => {
    const newExtraction: TooltipDataExtraction = {
      id: `extraction-${Date.now()}`,
      sourceKey: '',
      extractionType: 'hover',
      targetVariable: '',
    };
    updateTooltipConfig({
      dataExtractions: [...currentTooltipConfig.dataExtractions, newExtraction],
    });
  }, [currentTooltipConfig.dataExtractions, updateTooltipConfig]);

  // Update data extraction
  const updateDataExtraction = useCallback((index: number, updates: Partial<TooltipDataExtraction>) => {
    const newExtractions = [...currentTooltipConfig.dataExtractions];
    newExtractions[index] = { ...newExtractions[index], ...updates };
    updateTooltipConfig({ dataExtractions: newExtractions });
  }, [currentTooltipConfig.dataExtractions, updateTooltipConfig]);

  // Remove data extraction
  const removeDataExtraction = useCallback((index: number) => {
    const newExtractions = currentTooltipConfig.dataExtractions.filter((_, i) => i !== index);
    updateTooltipConfig({ dataExtractions: newExtractions });
  }, [currentTooltipConfig.dataExtractions, updateTooltipConfig]);

  // Add calculation binding
  const addCalculationBinding = useCallback(() => {
    const newBinding: TooltipCalculationBinding = {
      id: `calc-${Date.now()}`,
      outputVariable: '',
      inlineLogic: '// Your calculation logic here\n// Available variables: extracted data + all existing variables\n// Example:\n// const filtered = allSalesData.filter(item => item.category === hoveredCategory);\n// return filtered.map(item => ({ name: item.region, y: item.sales }));',
      description: '',
    };
    updateTooltipConfig({
      calculationBindings: [...currentTooltipConfig.calculationBindings, newBinding],
    });
  }, [currentTooltipConfig.calculationBindings, updateTooltipConfig]);

  // Update calculation binding
  const updateCalculationBinding = useCallback((index: number, updates: Partial<TooltipCalculationBinding>) => {
    const newBindings = [...currentTooltipConfig.calculationBindings];
    newBindings[index] = { ...newBindings[index], ...updates };
    updateTooltipConfig({ calculationBindings: newBindings });
  }, [currentTooltipConfig.calculationBindings, updateTooltipConfig]);

  // Remove calculation binding
  const removeCalculationBinding = useCallback((index: number) => {
    const newBindings = currentTooltipConfig.calculationBindings.filter((_, i) => i !== index);
    updateTooltipConfig({ calculationBindings: newBindings });
  }, [currentTooltipConfig.calculationBindings, updateTooltipConfig]);

  // Handle layout change for a specific child
  const handleLayoutChange = (index: number, layoutUpdates: Partial<ChildCardLayout>) => {
    const newChildCards = [...parentConfig.childCards];
    newChildCards[index] = {
      ...newChildCards[index],
      layout: { ...newChildCards[index].layout, ...layoutUpdates },
    };

    const newConfig = {
      ...parentConfig,
      childCards: newChildCards,
    };

    setParentConfig(newConfig);
    saveConfig(newConfig);
  };

  // Handle parent config changes
  const handleParentConfigChange = (updates: Partial<ParentCardConfig>) => {
    const newConfig = { ...parentConfig, ...updates };
    setParentConfig(newConfig);
    saveConfig(newConfig);
  };

  // Get the currently selected child card
  const selectedChild = parentConfig.childCards[selectedChildIndex];
  const effectiveTableSettings: TableSettings = selectedChild?.tableSettings || defaultTableSettings;

  // Fetch columns when data source changes
  useEffect(() => {
    if (selectedChild?.type === 'table' && selectedChild.tableDataSource) {
      fetchColumns(selectedChild.tableDataSource);
    } else {
      setTableColumns([]);
    }
  }, [selectedChild?.type, selectedChild?.tableDataSource, fetchColumns]);

  // Get available data sources for tables
  // arrayOfObjectsVariables is an array of variable names that contain arrays of objects
  const availableDataSources = useMemo(() => {
    if (!Array.isArray(arrayOfObjectsVariables)) return [];
    return arrayOfObjectsVariables.map((varName: string) => ({
      value: varName,
      label: varName,
    }));
  }, [arrayOfObjectsVariables]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Enable Container Toggle */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          border: '1px solid rgba(102, 126, 234, 0.2)',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
        }}
      >
        <FormControlLabel
          control={
            <Switch
              checked={parentConfig.isContainer}
              onChange={(e) => handleEnableContainer(e.target.checked)}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#667eea',
                  '&:hover': { backgroundColor: 'rgba(102, 126, 234, 0.08)' },
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#667eea',
                },
              }}
            />
          }
          label={
            <Box>
              <Typography variant="subtitle1" fontWeight={600} color="#374151">
                Enable Multi-Card Container
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Turn this card into a container that holds up to 4 child cards (charts, tables, or HTML)
              </Typography>
            </Box>
          }
        />
      </Paper>

      {/* Container Configuration (only shown when enabled) */}
      {parentConfig.isContainer && (
        <Box sx={{ display: 'flex', flex: 1, gap: 2, minHeight: 0 }}>
          {/* Left Panel - Configuration */}
          <Box sx={{ width: '55%', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
            {/* Scrollable config area */}
            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              overflowX: 'visible', 
              pr: 1,
              // Ensure Monaco autocomplete widgets can escape the scroll container
              '& .monaco-editor .suggest-widget': {
                zIndex: 9999,
              },
            }}>
            {/* Layout Presets */}
            <Accordion
              expanded={expandedAccordion === 'layout'}
              onChange={(_, isExpanded) => setExpandedAccordion(isExpanded ? 'layout' : false)}
              sx={{
                mb: 1,
                '&:before': { display: 'none' },
                borderRadius: '8px !important',
                overflow: 'hidden',
                border: '1px solid rgba(102, 126, 234, 0.15)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600} color="#667eea">
                  <GridIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                  Layout Presets
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {/* 🔥 Preview Mode Alert */}
                {isPreviewMode && (
                  <Alert 
                    severity="info" 
                    sx={{ mb: 2 }}
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button 
                          size="small" 
                          color="inherit" 
                          onClick={cancelPendingLayout}
                          startIcon={<CloseIcon />}
                        >
                          Cancel
                        </Button>
                        <Button 
                          size="small" 
                          variant="contained"
                          color="success"
                          onClick={applyPendingLayout}
                          startIcon={<CheckIcon />}
                        >
                          Apply
                        </Button>
                      </Stack>
                    }
                  >
                    <AlertTitle>Preview Mode</AlertTitle>
                    Drag and resize cards below, then click Apply to save changes.
                  </Alert>
                )}

                <Grid container spacing={1}>
                  {layoutPresetOptions.map((preset) => {
                    // Determine if this preset is selected (considering preview mode)
                    const isSelected = isPreviewMode 
                      ? pendingLayoutPreset === preset.key 
                      : selectedLayoutPreset === preset.key;
                    
                    return (
                      <Grid key={preset.key} size={{ xs: 4 }}>
                        <Button
                          fullWidth
                          variant={isSelected ? 'contained' : 'outlined'}
                          onClick={() => handleLayoutPresetChange(preset.key)}
                          disabled={isPreviewMode && pendingLayoutPreset !== preset.key}
                          sx={{
                            py: 1.5,
                            flexDirection: 'column',
                            borderColor: 'rgba(102, 126, 234, 0.3)',
                            color: isSelected ? 'white' : '#667eea',
                            background: isSelected 
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                              : 'transparent',
                            '&:hover': {
                              borderColor: '#667eea',
                              background: isSelected 
                                ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                                : 'rgba(102, 126, 234, 0.05)',
                            },
                            '&.Mui-disabled': {
                              opacity: 0.5,
                            },
                          }}
                        >
                          <Typography variant="h5" sx={{ mb: 0.5 }}>{preset.icon}</Typography>
                          <Typography variant="caption">{preset.label}</Typography>
                        </Button>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* Interactive Layout Editor moved to right panel for better UX */}

                {/* Container Settings */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" fontWeight={600} gutterBottom color="#4b5563">
                    Container Settings
                  </Typography>
                  <Stack spacing={2}>
                    {/* 🔥 Enable Container Scroll Toggle */}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={parentConfig.enableContainerScroll || false}
                          onChange={(e) => handleParentConfigChange({ enableContainerScroll: e.target.checked })}
                          size="small"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="body2">Enable Container Scroll</Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                            {parentConfig.enableContainerScroll 
                              ? 'All cards scroll together with one scrollbar'
                              : 'Charts compress to fit container (no scrolling)'
                            }
                          </Typography>
                        </Box>
                      }
                    />
                    
                    {/* 🔥 Card Height - shown when scrolling is enabled */}
                    {parentConfig.enableContainerScroll && (
                      <Box >
                        {/* 🔥 Dynamic Height Toggle */}
                        <FormControlLabel
                          control={
                            <Switch
                              checked={parentConfig.useDynamicHeight || false}
                              onChange={(e) => handleParentConfigChange({ useDynamicHeight: e.target.checked })}
                              size="small"
                              sx={{ ml:1,'& .MuiSwitch-switchBase.Mui-checked': { color: '#10b981' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#10b981' } }}
                            />
                          }
                          label={
                            <Box >
                              <Typography variant="body2" fontWeight={500} color={parentConfig.useDynamicHeight ? '#10b981' : 'text.primary'}>
                                Dynamic Height
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                                {parentConfig.useDynamicHeight 
                                  ? 'Height auto-calculates based on data count'
                                  : 'Use fixed content height'
                                }
                              </Typography>
                            </Box>
                          }
                          sx={{ mb: 1 }}
                        />

                        {/* 🔥 Dynamic Height Settings */}
                        {parentConfig.useDynamicHeight ? (
                          <Box sx={{ 
                            p: 1.5, 
                            bgcolor: 'rgba(16, 185, 129, 0.05)', 
                            borderRadius: 1.5, 
                            border: '1px solid rgba(16, 185, 129, 0.2)',
                          }}>
                            <Stack spacing={1.5}>
                              {/* Height Variable - user calculates this in their own logic */}
                              <FormControl size="small" fullWidth>
                                <InputLabel sx={{ fontSize: '0.75rem' }}>Height Variable</InputLabel>
                                <Select
                                  value={parentConfig.heightDataSource || ''}
                                  onChange={(e) => handleParentConfigChange({ heightDataSource: e.target.value })}
                                  label="Height Variable"
                                  sx={{ fontSize: '0.8rem' }}
                                >
                                  <MenuItem value="" disabled>
                                    <em>Select a variable...</em>
                                  </MenuItem>
                                  {variableNamesList.map((varName) => (
                                    <MenuItem key={varName} value={varName} sx={{ fontSize: '0.8rem' }}>
                                      ${'{'}${varName}{'}'}
                                    </MenuItem>
                                  ))}
                                </Select>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '0.6rem' }}>
                                  Select a variable containing the calculated height value (in pixels)
                                </Typography>
                              </FormControl>

                              {/* Info about how to use */}
                              <Alert severity="info" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
                                Calculate the height in your logic (e.g., <code>dataCount * 35 + 100</code>) and store it in a variable.
                              </Alert>
                            </Stack>
                          </Box>
                        ) : (
                          /* Fixed Height Slider */
                          <Box>
                            <Typography variant="caption" color="text.secondary" gutterBottom display="block">
                              Content Height: {parentConfig.cardMinHeight || 800}px
                            </Typography>
                            <Slider
                              value={parentConfig.cardMinHeight || 800}
                              onChange={(_, value) => handleParentConfigChange({ cardMinHeight: value as number })}
                              min={400}
                              max={2000}
                              step={100}
                              marks={[
                                { value: 400, label: '400' },
                                { value: 800, label: '800' },
                                { value: 1200, label: '1200' },
                                { value: 1600, label: '1600' },
                                { value: 2000, label: '2000' },
                              ]}
                              size="small"
                              sx={{ color: '#667eea', mt: 1 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                              Fixed height for chart content. Set higher than container to enable scrolling.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                    
                    <Box>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Gap Between Cards: {parentConfig.gap}px
                      </Typography>
                      <Slider
                        value={parentConfig.gap}
                        onChange={(_, value) => handleParentConfigChange({ gap: value as number })}
                        min={0}
                        max={24}
                        step={2}
                        size="small"
                        sx={{ color: '#667eea' }}
                      />
                    </Box>
                  </Stack>
                </Box>
              </AccordionDetails>
            </Accordion>

            {/* Child Cards List */}
            <Accordion
              expanded={expandedAccordion === 'cards'}
              onChange={(_, isExpanded) => setExpandedAccordion(isExpanded ? 'cards' : false)}
              sx={{
                mb: 1,
                '&:before': { display: 'none' },
                borderRadius: '8px !important',
                overflow: 'hidden',
                border: '1px solid rgba(102, 126, 234, 0.15)',
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600} color="#667eea">
                  <DragIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 20 }} />
                  Child Cards ({parentConfig.childCards.length}/4)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1}>
                  {parentConfig.childCards.map((child, index) => (
                    <Paper
                      key={child.id}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        border: selectedChildIndex === index 
                          ? '2px solid #667eea' 
                          : '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 1.5,
                        transition: 'all 0.2s',
                        '&:hover': {
                          borderColor: '#667eea',
                          bgcolor: 'rgba(102, 126, 234, 0.02)',
                        },
                      }}
                      onClick={() => setSelectedChildIndex(index)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            label={child.type.toUpperCase()}
                            icon={
                              child.type === 'chart' ? <ChartIcon sx={{ fontSize: 14 }} /> :
                              child.type === 'table' ? <TableIcon sx={{ fontSize: 14 }} /> :
                              <HtmlIcon sx={{ fontSize: 14 }} />
                            }
                            sx={{
                              bgcolor: child.type === 'chart' ? 'rgba(102, 126, 234, 0.1)' :
                                       child.type === 'table' ? 'rgba(16, 185, 129, 0.1)' :
                                       'rgba(245, 158, 11, 0.1)',
                              color: child.type === 'chart' ? '#667eea' :
                                     child.type === 'table' ? '#10b981' :
                                     '#f59e0b',
                              fontWeight: 600,
                              fontSize: '0.65rem',
                            }}
                          />
                          <Typography variant="body2" fontWeight={500}>
                            {child.title || `Card ${getChildDisplayNumber(child.id, index)}`}
                          </Typography>
                        </Box>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveChildCard(index);
                          }}
                          disabled={parentConfig.childCards.length <= 1}
                          sx={{ color: '#ef4444' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
                
                {parentConfig.childCards.length < 4 && (
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={handleAddChildCard}
                    sx={{
                      mt: 2,
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                      color: '#667eea',
                      '&:hover': {
                        borderColor: '#667eea',
                        bgcolor: 'rgba(102, 126, 234, 0.05)',
                      },
                    }}
                  >
                    Add Child Card
                  </Button>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Quick Child Card Selector - Between Child Cards and Configure */}
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 1,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                border: '2px solid rgba(102, 126, 234, 0.25)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700} color="#667eea">
                  🎯 Quick Switch: Card {selectedChild ? getChildDisplayNumber(selectedChild.id, selectedChildIndex) : selectedChildIndex + 1} of {parentConfig.childCards.length}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {parentConfig.childCards.map((child, index) => (
                  <Chip
                    key={`quick-${child.id}-${index}`}
                    label={`${child.title || `Card ${getChildDisplayNumber(child.id, index)}`} (${child.type})`}
                    icon={
                      child.type === 'chart' ? <ChartIcon sx={{ fontSize: '14px !important' }} /> :
                      child.type === 'table' ? <TableIcon sx={{ fontSize: '14px !important' }} /> :
                      <HtmlIcon sx={{ fontSize: '14px !important' }} />
                    }
                    onClick={() => setSelectedChildIndex(index)}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: selectedChildIndex === index ? 700 : 500,
                      bgcolor: selectedChildIndex === index 
                        ? (child.type === 'chart' ? '#667eea' : child.type === 'table' ? '#10b981' : '#f59e0b')
                        : 'white',
                      color: selectedChildIndex === index 
                        ? 'white'
                        : (child.type === 'chart' ? '#667eea' : child.type === 'table' ? '#10b981' : '#f59e0b'),
                      border: selectedChildIndex === index 
                        ? 'none'
                        : `2px solid ${child.type === 'chart' ? '#667eea' : child.type === 'table' ? '#10b981' : '#f59e0b'}`,
                      '&:hover': {
                        bgcolor: selectedChildIndex === index 
                          ? (child.type === 'chart' ? '#5568d3' : child.type === 'table' ? '#0ea572' : '#e08e0a')
                          : (child.type === 'chart' ? 'rgba(102, 126, 234, 0.15)' : child.type === 'table' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'),
                      },
                    }}
                  />
                ))}
              </Box>
            </Paper>

            {/* Selected Child Configuration */}
            {selectedChild && (
              <>
              <Accordion
                expanded={expandedAccordion === 'childConfig'}
                onChange={(_, isExpanded) => setExpandedAccordion(isExpanded ? 'childConfig' : false)}
                sx={{
                  mb: 1,
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  border: '1px solid rgba(102, 126, 234, 0.15)',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600} color="#667eea">
                    Configure: {selectedChild.title || `Card ${getChildDisplayNumber(selectedChild.id, selectedChildIndex)}`}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {/* Title */}
                    <TextField
                      label="Card Title"
                      value={selectedChild.title || ''}
                      onChange={(e) => handleChildCardChange(selectedChildIndex, { title: e.target.value })}
                      placeholder={`Card ${getChildDisplayNumber(selectedChild.id, selectedChildIndex)}`}
                      size="small"
                      fullWidth
                    />
                    
                    <FormControlLabel
                      control={
                        <Switch
                          checked={selectedChild.showTitle || false}
                          onChange={(e) => handleChildCardChange(selectedChildIndex, { showTitle: e.target.checked })}
                          size="small"
                        />
                      }
                      label="Show Title Bar"
                    />

                    {/* Type Selection */}
                    <Box>
                      <Typography variant="subtitle2" gutterBottom color="#4b5563">
                        Content Type
                      </Typography>
                      <ToggleButtonGroup
                        value={selectedChild.type}
                        exclusive
                        onChange={(_, newType) => newType && handleChildCardChange(selectedChildIndex, { type: newType })}
                        fullWidth
                        size="small"
                      >
                        <ToggleButton value="chart">
                          <ChartIcon sx={{ mr: 0.5, fontSize: 16 }} />
                          Chart
                        </ToggleButton>
                        <ToggleButton value="table">
                          <TableIcon sx={{ mr: 0.5, fontSize: 16 }} />
                          Table
                        </ToggleButton>
                        <ToggleButton value="html">
                          <HtmlIcon sx={{ mr: 0.5, fontSize: 16 }} />
                          HTML
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>

                    <Divider />

                    {/* Type-specific Configuration */}
                    {selectedChild.type === 'chart' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Header with Title and Chart Type Dropdown */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2" color="#4b5563" fontWeight={600}>
                            Highcharts JSON Configuration
                          </Typography>
                          
                          {/* Chart Type Dropdown - beside title */}
                          <TextField
                            select
                            size="small"
                            value={selectedTemplate}
                            onChange={(e) => {
                              const templateLabel = e.target.value;
                              setSelectedTemplate(templateLabel);
                              if (templateLabel === "Custom/Manual") return;
                              const template = chartTemplatePresets.find(t => t.label === templateLabel);
                              if (template && template.value) {
                                const templateJson = JSON.stringify(template.value, null, 2);
                                handleChildCardChange(selectedChildIndex, { template: templateJson });
                              }
                            }}
                            label="Chart Type"
                            sx={{ 
                              bgcolor: 'white', 
                              minWidth: 160,
                              '& .MuiInputBase-root': { height: 32 }
                            }}
                          >
                            {chartTemplatePresets.map((preset) => (
                              <MenuItem key={preset.label} value={preset.label}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  {preset.icon}
                                  <Typography variant="body2">{preset.label}</Typography>
                                </Box>
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                        
                        {/* Available Variables - Fixed header, scrollable chips */}
                        {Object.keys(availableVariables).length > 0 && (
                          <Paper 
                            variant="outlined" 
                            sx={{ 
                              p: 1.5, 
                              borderRadius: 1.5, 
                              border: '1px solid rgba(102, 126, 234, 0.2)',
                              bgcolor: 'rgba(102, 126, 234, 0.02)',
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              sx={{ 
                                display: 'block', 
                                mb: 1,
                                fontWeight: 600,
                              }}
                            >
                              Available Variables ({Object.keys(availableVariables).length}):
                            </Typography>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 0.5, 
                                maxHeight: 80, 
                                overflowY: 'auto',
                              }}
                            >
                              {Object.keys(availableVariables).map(name => (
                                <Chip
                                  key={name}
                                  label={`\${${name}}`}
                                  size="small"
                                  sx={{
                                    fontSize: '0.65rem',
                                    height: 20,
                                    bgcolor: 'rgba(102, 126, 234, 0.08)',
                                    color: '#667eea',
                                    fontFamily: 'monospace',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.15)' },
                                  }}
                                  onClick={() => {
                                    const currentTemplate = selectedChild.template || '';
                                    handleChildCardChange(selectedChildIndex, { 
                                      template: currentTemplate + `\${${name}}` 
                                    });
                                  }}
                                />
                              ))}
                            </Box>
                          </Paper>
                        )}
                        
                        {/* JSON Error Display */}
                        {jsonError && (
                          <Alert 
                            severity="error" 
                            sx={{ 
                              mb: 1,
                              py: 0.5,
                              borderRadius: 2,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)',
                            }}
                          >
                            <AlertTitle sx={{ fontWeight: 700, mb: 0, fontSize: '0.85rem' }}>Configuration Error</AlertTitle>
                            <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{jsonError}</Typography>
                          </Alert>
                        )}
                        
                        {/* JSON Editor - matching HighChartField structure */}
                        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'visible', zIndex: 5 }}>
                          <JsonEditor
                            value={selectedChild.template || ''}
                            onChange={(value) => {
                              handleChildCardChange(selectedChildIndex, { template: value });
                              
                              // Validate JSON and show error if invalid - AGGRESSIVE validation
                              if (!value || value.trim() === '') {
                                setJsonError(null);
                                return;
                              }
                              
                              try {
                                // Replace ${variableName} with placeholder values for validation
                                // This handles both single-line and multi-line variable placeholders
                                // Pattern: ${...} where ... can span multiple lines
                                let testValue = value;
                                
                                // First, normalize multi-line ${var\nname} to single line
                                // Replace any ${...} pattern that might span lines (using [\s\S] to match any char including newlines)
                                testValue = testValue.replace(/\$\{[\s\S]*?\}/g, '"__VARIABLE_PLACEHOLDER__"');
                                
                                // Also catch incomplete ${...} patterns at end of string (still being typed)
                                // This prevents errors while user is still typing the variable name
                                testValue = testValue.replace(/\$\{[^}]*$/g, '"__INCOMPLETE_VAR__"');
                                
                                // Try to parse the processed JSON
                                const parsed = JSON.parse(testValue);
                                
                                // Additional validation - check for required chart structure
                                if (!parsed.chart && !parsed.series) {
                                  setJsonError('Missing "chart" or "series" configuration');
                                  return;
                                }
                                
                                setJsonError(null);
                              } catch (e: any) {
                                // Show error immediately - no delay, no minimum length requirement
                                const errorMsg = e.message || 'Invalid JSON';
                                setJsonError(errorMsg);
                              }
                            }}
                            availableVariables={availableVariables}
                            height={jsonError ? 320 : 380}
                            error={jsonError || undefined}
                            placeholder="Enter Highcharts JSON configuration. Use ${variableName} syntax for variables."
                          />
                        </Box>
                      </Box>
                    )}

                    {selectedChild.type === 'table' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Data Source Selection */}
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 2,
                            borderRadius: 2,
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                          }}
                        >
                          <Typography 
                            variant="subtitle2" 
                            fontWeight={700} 
                            sx={{ mb: 1.5, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}
                          >
                            <TableIcon fontSize="small" />
                            Select Data Source
                          </Typography>
                          <FormControl fullWidth size="small">
                            <InputLabel id="table-data-source-label">Calculation Variable</InputLabel>
                            <Select
                              labelId="table-data-source-label"
                              value={selectedChild.tableDataSource || ''}
                              label="Calculation Variable"
                              onChange={(e) => handleChildCardChange(selectedChildIndex, { tableDataSource: e.target.value })}
                              sx={{
                                bgcolor: 'white',
                                borderRadius: 1.5,
                                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(59, 130, 246, 0.3)' },
                                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#3b82f6' },
                              }}
                            >
                              <MenuItem value=""><em>Select a variable...</em></MenuItem>
                              {availableDataSources.map((ds) => (
                                <MenuItem key={ds.value} value={ds.value}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Chip size="small" label="Array" sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }} />
                                    <Typography variant="body2" fontWeight={500}>{ds.label}</Typography>
                                  </Box>
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                          {availableDataSources.length === 0 && (
                            <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                              <Typography variant="caption">No array-of-objects variables found. Create a calculation that returns an array of objects first.</Typography>
                            </Alert>
                          )}
                          {selectedChild.tableDataSource && tableColumns.length > 0 && (
                            <Typography variant="caption" color="#64748b" sx={{ mt: 1, display: 'block' }}>
                              {tableColumns.length} columns available
                            </Typography>
                          )}
                        </Paper>

                        {/* Display Mode Accordion */}
                        <Accordion 
                          defaultExpanded 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PreviewIcon fontSize="small" />
                              Display Mode
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <RadioGroup
                              value={effectiveTableSettings.displayMode}
                              onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                tableSettings: { ...effectiveTableSettings, displayMode: e.target.value as TableDisplayMode }
                              })}
                            >
                              <FormControlLabel
                                value="pagination"
                                control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                                label={
                                  <Box>
                                    <Typography variant="body2" fontWeight={600} color="#1e293b">Pagination</Typography>
                                    <Typography variant="caption" color="#64748b">Show page controls at the bottom</Typography>
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                value="scroll"
                                control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                                label={
                                  <Box>
                                    <Typography variant="body2" fontWeight={600} color="#1e293b">Scroll Content</Typography>
                                    <Typography variant="caption" color="#64748b">Scroll through all rows</Typography>
                                  </Box>
                                }
                              />
                              <FormControlLabel
                                value="lazyLoad"
                                control={<Radio size="small" sx={{ color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }} />}
                                label={
                                  <Box>
                                    <Typography variant="body2" fontWeight={600} color="#1e293b">Lazy Load</Typography>
                                    <Typography variant="caption" color="#64748b">Load rows as you scroll</Typography>
                                  </Box>
                                }
                              />
                            </RadioGroup>
                            {effectiveTableSettings.displayMode === 'pagination' && (
                              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Rows Per Page</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.rowsPerPage}
                                    label="Rows Per Page"
                                    onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                      tableSettings: { ...effectiveTableSettings, rowsPerPage: Number(e.target.value) }
                                    })}
                                    sx={{ bgcolor: 'white' }}
                                  >
                                    {[5, 10, 15, 20, 25, 50, 100].map(n => (
                                      <MenuItem key={n} value={n}>{n} rows</MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Box>
                            )}
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={effectiveTableSettings.showHeader !== false}
                                    onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                      tableSettings: { ...effectiveTableSettings, showHeader: e.target.checked }
                                    })}
                                    size="small"
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                                  />
                                }
                                label={<Typography variant="body2" fontWeight={600} color="#1e293b">Show Table Header</Typography>}
                              />
                            </Box>
                          </AccordionDetails>
                        </Accordion>

                        {/* Sorting Accordion */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <SortIcon fontSize="small" />
                              Sorting {(effectiveTableSettings.sorting?.columns?.length || 0) > 0 && `(${effectiveTableSettings.sorting?.columns?.length})`}
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={effectiveTableSettings.sorting?.enabled || false}
                                  onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                    tableSettings: {
                                      ...effectiveTableSettings,
                                      sorting: { ...effectiveTableSettings.sorting, enabled: e.target.checked, columns: e.target.checked ? (effectiveTableSettings.sorting?.columns || []) : [] }
                                    }
                                  })}
                                  size="small"
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                                />
                              }
                              label={<Typography variant="body2" fontWeight={600} color="#1e293b">Enable Sorting</Typography>}
                              sx={{ mb: 2 }}
                            />
                            {effectiveTableSettings.sorting?.enabled && tableColumns.length > 0 && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {/* Select All / Deselect All */}
                                <FormControlLabel
                                  control={
                                    <Checkbox
                                      checked={(effectiveTableSettings.sorting?.columns?.length || 0) === tableColumns.length}
                                      indeterminate={(effectiveTableSettings.sorting?.columns?.length || 0) > 0 && (effectiveTableSettings.sorting?.columns?.length || 0) < tableColumns.length}
                                      onChange={(e) => {
                                        const newColumns = e.target.checked ? tableColumns.map(col => ({ column: col, direction: 'asc' as const })) : [];
                                        handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, sorting: { ...effectiveTableSettings.sorting, columns: newColumns } }
                                        });
                                      }}
                                      size="small"
                                      sx={{ p: 0.5, color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }}
                                    />
                                  }
                                  label={<Typography variant="body2" fontWeight={500} color="#475569">Select All Columns</Typography>}
                                />
                                {/* Current sort columns with direction toggle */}
                                {(effectiveTableSettings.sorting?.columns?.length || 0) > 0 && (
                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Typography variant="caption" color="#64748b" fontWeight={600}>Sortable Columns:</Typography>
                                    {(effectiveTableSettings.sorting?.columns || []).map((sortCol, idx) => (
                                      <Box 
                                        key={sortCol.column} 
                                        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'white', borderRadius: 1, border: '1px solid rgba(59, 130, 246, 0.2)' }}
                                      >
                                        <Typography variant="caption" sx={{ width: 20, color: '#64748b', fontWeight: 600 }}>{idx + 1}.</Typography>
                                        <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>{sortCol.column}</Typography>
                                        <IconButton 
                                          size="small" 
                                          onClick={() => {
                                            const newColumns = (effectiveTableSettings.sorting?.columns || []).map(s =>
                                              s.column === sortCol.column ? { ...s, direction: s.direction === 'asc' ? 'desc' as const : 'asc' as const } : s
                                            );
                                            handleChildCardChange(selectedChildIndex, {
                                              tableSettings: { ...effectiveTableSettings, sorting: { ...effectiveTableSettings.sorting, columns: newColumns } }
                                            });
                                          }}
                                          sx={{ color: '#3b82f6' }}
                                          title={sortCol.direction === 'asc' ? 'Ascending (click to change)' : 'Descending (click to change)'}
                                        >
                                          {sortCol.direction === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
                                        </IconButton>
                                        <IconButton 
                                          size="small" 
                                          onClick={() => {
                                            const newColumns = (effectiveTableSettings.sorting?.columns || []).filter(s => s.column !== sortCol.column);
                                            handleChildCardChange(selectedChildIndex, {
                                              tableSettings: { ...effectiveTableSettings, sorting: { ...effectiveTableSettings.sorting, columns: newColumns } }
                                            });
                                          }}
                                          sx={{ color: '#ef4444' }}
                                          title="Remove from sorting"
                                        >
                                          <VisibilityOffIcon fontSize="small" />
                                        </IconButton>
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                                {/* Add new sort column */}
                                {tableColumns.filter(col => !(effectiveTableSettings.sorting?.columns || []).some(s => s.column === col)).length > 0 && (
                                  <FormControl fullWidth size="small">
                                    <InputLabel>Add Sort Column</InputLabel>
                                    <Select
                                      value=""
                                      label="Add Sort Column"
                                      onChange={(e) => {
                                        const currentColumns = effectiveTableSettings.sorting?.columns || [];
                                        handleChildCardChange(selectedChildIndex, {
                                          tableSettings: {
                                            ...effectiveTableSettings,
                                            sorting: { ...effectiveTableSettings.sorting, columns: [...currentColumns, { column: e.target.value as string, direction: 'asc' }] }
                                          }
                                        });
                                      }}
                                      sx={{ bgcolor: 'white' }}
                                    >
                                      {tableColumns
                                        .filter(col => !(effectiveTableSettings.sorting?.columns || []).some(s => s.column === col))
                                        .map(col => (
                                          <MenuItem key={col} value={col}>{col}</MenuItem>
                                        ))}
                                    </Select>
                                  </FormControl>
                                )}
                              </Box>
                            )}
                          </AccordionDetails>
                        </Accordion>

                        {/* Column Configuration Accordion */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <ColumnIcon fontSize="small" />
                              Columns ({effectiveTableSettings.columns?.filter(c => c.visible).length || tableColumns.length}/{effectiveTableSettings.columns?.length || tableColumns.length})
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Typography variant="caption" color="#64748b" sx={{ mb: 1, display: 'block' }}>
                              Toggle visibility and drag to reorder columns
                            </Typography>
                            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                              {(effectiveTableSettings.columns?.length > 0 ? [...effectiveTableSettings.columns].sort((a, b) => a.order - b.order) : tableColumns.map((col, idx) => ({ name: col, visible: true, order: idx }))).map((col, idx) => (
                                <Box 
                                  key={`col-config-${idx}-${col.name}`} 
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', idx.toString());
                                    (e.currentTarget as HTMLElement).style.opacity = '0.5';
                                  }}
                                  onDragEnd={(e) => {
                                    (e.currentTarget as HTMLElement).style.opacity = '1';
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                                  }}
                                  onDragLeave={(e) => {
                                    (e.currentTarget as HTMLElement).style.backgroundColor = '';
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    (e.currentTarget as HTMLElement).style.backgroundColor = '';
                                    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                    if (dragIndex === idx) return;
                                    // Reorder columns
                                    const currentColumns = effectiveTableSettings.columns?.length > 0 
                                      ? [...effectiveTableSettings.columns].sort((a, b) => a.order - b.order)
                                      : tableColumns.map((c, i) => ({ name: c, visible: true, order: i }));
                                    const [draggedColumn] = currentColumns.splice(dragIndex, 1);
                                    currentColumns.splice(idx, 0, draggedColumn);
                                    const newColumns = currentColumns.map((c, i) => ({ ...c, order: i }));
                                    handleChildCardChange(selectedChildIndex, {
                                      tableSettings: { ...effectiveTableSettings, columns: newColumns }
                                    });
                                  }}
                                  sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 1, 
                                    py: 0.5,
                                    px: 1,
                                    borderRadius: 1,
                                    cursor: 'grab',
                                    '&:hover': { bgcolor: 'rgba(59, 130, 246, 0.05)' },
                                    '&:active': { cursor: 'grabbing' },
                                  }}
                                >
                                  <DragIcon fontSize="small" sx={{ color: '#94a3b8', cursor: 'grab' }} />
                                  <Checkbox
                                    checked={col.visible}
                                    onChange={() => {
                                      const currentColumns = effectiveTableSettings.columns?.length > 0 
                                        ? effectiveTableSettings.columns 
                                        : tableColumns.map((c, i) => ({ name: c, visible: true, order: i }));
                                      const newColumns = currentColumns.map(c =>
                                        c.name === col.name ? { ...c, visible: !c.visible } : c
                                      );
                                      handleChildCardChange(selectedChildIndex, {
                                        tableSettings: { ...effectiveTableSettings, columns: newColumns }
                                      });
                                    }}
                                    size="small"
                                    sx={{ p: 0.5, color: '#3b82f6', '&.Mui-checked': { color: '#3b82f6' } }}
                                  />
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      flex: 1, 
                                      color: col.visible ? '#1e293b' : '#94a3b8',
                                      textDecoration: col.visible ? 'none' : 'line-through',
                                    }}
                                  >
                                    {col.name}
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: '#94a3b8', minWidth: 20, textAlign: 'right' }}>
                                    #{idx + 1}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </AccordionDetails>
                        </Accordion>

                        {/* Theme & Styling Accordion */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <PaletteIcon fontSize="small" />
                              Theme & Styling
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {/* Header Colors */}
                              <Box>
                                <Typography variant="caption" fontWeight={600} color="#475569" sx={{ mb: 1, display: 'block' }}>Header</Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Background</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.headerBgColor || '#f1f5f9'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, headerBgColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.headerBgColor || '#f1f5f9'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, headerBgColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Text</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.headerTextColor || '#1e293b'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, headerTextColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.headerTextColor || '#1e293b'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, headerTextColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                              {/* Row Colors */}
                              <Box>
                                <Typography variant="caption" fontWeight={600} color="#475569" sx={{ mb: 1, display: 'block' }}>Rows</Typography>
                                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Even Row</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.rowBgColor || '#ffffff'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowBgColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.rowBgColor || '#ffffff'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowBgColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Odd Row</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.rowAltBgColor || '#f8fafc'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowAltBgColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.rowAltBgColor || '#f8fafc'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowAltBgColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Text Color</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.rowTextColor || '#475569'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowTextColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.rowTextColor || '#475569'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, rowTextColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                  <Box sx={{ flex: 1 }}>
                                    <Typography variant="caption" color="#64748b">Border</Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <input
                                        type="color"
                                        value={effectiveTableSettings.theme?.borderColor || '#e2e8f0'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, borderColor: e.target.value } }
                                        })}
                                        style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
                                      />
                                      <TextField
                                        size="small"
                                        value={effectiveTableSettings.theme?.borderColor || '#e2e8f0'}
                                        onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                          tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, borderColor: e.target.value } }
                                        })}
                                        sx={{ flex: 1 }}
                                        inputProps={{ style: { padding: '4px 8px', fontSize: '0.75rem' } }}
                                      />
                                    </Box>
                                  </Box>
                                </Box>
                              </Box>
                              {/* Cell Padding & Font Size */}
                              <Box sx={{ display: 'flex', gap: 2 }}>
                                <FormControl size="small" sx={{ flex: 1 }}>
                                  <InputLabel>Cell Padding</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.theme?.cellPadding || 'normal'}
                                    label="Cell Padding"
                                    onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                      tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, cellPadding: e.target.value } }
                                    })}
                                    sx={{ bgcolor: 'white' }}
                                  >
                                    <MenuItem value="compact">Compact</MenuItem>
                                    <MenuItem value="normal">Normal</MenuItem>
                                    <MenuItem value="comfortable">Comfortable</MenuItem>
                                  </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ flex: 1 }}>
                                  <InputLabel>Font Size</InputLabel>
                                  <Select
                                    value={effectiveTableSettings.theme?.fontSize || 'medium'}
                                    label="Font Size"
                                    onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                      tableSettings: { ...effectiveTableSettings, theme: { ...effectiveTableSettings.theme, fontSize: e.target.value } }
                                    })}
                                    sx={{ bgcolor: 'white' }}
                                  >
                                    <MenuItem value="small">Small</MenuItem>
                                    <MenuItem value="medium">Medium</MenuItem>
                                    <MenuItem value="large">Large</MenuItem>
                                  </Select>
                                </FormControl>
                              </Box>
                            </Box>
                          </AccordionDetails>
                        </Accordion>

                        {/* Summary Row Accordion */}
                        <Accordion 
                          sx={{ 
                            borderRadius: '8px !important', 
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            bgcolor: 'rgba(224, 242, 254, 0.1)',
                            '&:before': { display: 'none' },
                            boxShadow: 'none',
                          }}
                        >
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 1 }}>
                              <InsertChartIcon fontSize="small" />
                              Summary Row
                            </Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={effectiveTableSettings.summaryRow?.enabled || false}
                                  onChange={(e) => handleChildCardChange(selectedChildIndex, {
                                    tableSettings: { ...effectiveTableSettings, summaryRow: { ...effectiveTableSettings.summaryRow, enabled: e.target.checked } }
                                  })}
                                  size="small"
                                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#3b82f6' }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#3b82f6' } }}
                                />
                              }
                              label={<Typography variant="body2" fontWeight={600} color="#1e293b">Show Summary Row</Typography>}
                              sx={{ mb: 2 }}
                            />
                            {effectiveTableSettings.summaryRow?.enabled && tableColumns.length > 0 && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 200, overflow: 'auto' }}>
                                <Typography variant="caption" color="#64748b" sx={{ mb: 0.5 }}>Select calculation for each column:</Typography>
                                {tableColumns.map(col => (
                                  <Box key={col} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" sx={{ flex: 1, fontWeight: 500, color: '#475569' }}>{col}</Typography>
                                    <FormControl size="small" sx={{ minWidth: 100 }}>
                                      <Select
                                        value={effectiveTableSettings.summaryRow?.calculations?.[col] || 'none'}
                                        onChange={(e) => {
                                          const newCalculations = { ...effectiveTableSettings.summaryRow?.calculations };
                                          if (e.target.value === 'none') {
                                            delete newCalculations[col];
                                          } else {
                                            newCalculations[col] = e.target.value as SummaryCalculation;
                                          }
                                          handleChildCardChange(selectedChildIndex, {
                                            tableSettings: { ...effectiveTableSettings, summaryRow: { ...effectiveTableSettings.summaryRow, calculations: newCalculations } }
                                          });
                                        }}
                                        sx={{ bgcolor: 'white', fontSize: '0.75rem' }}
                                      >
                                        <MenuItem value="none"><em>None</em></MenuItem>
                                        <MenuItem value="sum">Sum</MenuItem>
                                        <MenuItem value="avg">Average</MenuItem>
                                        <MenuItem value="min">Min</MenuItem>
                                        <MenuItem value="max">Max</MenuItem>
                                        <MenuItem value="count">Count</MenuItem>
                                      </Select>
                                    </FormControl>
                                  </Box>
                                ))}
                              </Box>
                            )}
                          </AccordionDetails>
                        </Accordion>
                      </Box>
                    )}

                    {selectedChild.type === 'html' && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        {/* Header with Title and Template Dropdown */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Typography variant="subtitle2" color="#4b5563" fontWeight={600}>
                            HTML Content
                          </Typography>
                          
                          {/* HTML Template Dropdown - beside title */}
                          <TextField
                            select
                            size="small"
                            value={selectedHtmlTemplate}
                            onChange={(e) => {
                              const templateLabel = e.target.value;
                              setSelectedHtmlTemplate(templateLabel);
                              if (templateLabel === "Custom") return;
                              const template = htmlTemplatePresets.find(t => t.label === templateLabel);
                              if (template && template.value) {
                                handleChildCardChange(selectedChildIndex, { htmlContent: template.value });
                              }
                            }}
                            label="HTML Template"
                            sx={{ 
                              bgcolor: 'white', 
                              minWidth: 160,
                              '& .MuiInputBase-root': { height: 32 }
                            }}
                          >
                            {htmlTemplatePresets.map((preset) => (
                              <MenuItem key={preset.label} value={preset.label}>
                                {preset.label}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                        
                        {/* Available Variables - Fixed header, scrollable chips */}
                        {Object.keys(availableVariables).length > 0 && (
                          <Paper 
                            variant="outlined" 
                            sx={{ 
                              p: 1.5, 
                              borderRadius: 1.5, 
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              bgcolor: 'rgba(245, 158, 11, 0.02)',
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              color="text.secondary" 
                              sx={{ 
                                display: 'block', 
                                mb: 1,
                                fontWeight: 600,
                              }}
                            >
                              Available Variables ({Object.keys(availableVariables).length}) - Use {'{{'}varName{'}}'}:
                            </Typography>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                flexWrap: 'wrap', 
                                gap: 0.5, 
                                maxHeight: 80, 
                                overflowY: 'auto',
                              }}
                            >
                              {Object.keys(availableVariables).map(name => (
                                <Chip
                                  key={name}
                                  label={`{{${name}}}`}
                                  size="small"
                                  sx={{
                                    fontSize: '0.65rem',
                                    height: 20,
                                    bgcolor: 'rgba(245, 158, 11, 0.1)',
                                    color: '#f59e0b',
                                    fontFamily: 'monospace',
                                    cursor: 'pointer',
                                    '&:hover': { bgcolor: 'rgba(245, 158, 11, 0.2)' },
                                  }}
                                  onClick={() => {
                                    const currentHtml = selectedChild.htmlContent || '';
                                    handleChildCardChange(selectedChildIndex, { 
                                      htmlContent: currentHtml + `{{${name}}}` 
                                    });
                                  }}
                                />
                              ))}
                            </Box>
                          </Paper>
                        )}
                        
                        {/* HTML Editor - matching HighChartField structure */}
                        <Box sx={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'visible', zIndex: 5 }}>
                          <HtmlEditor
                            value={selectedChild.htmlContent || ''}
                            onChange={(value) => handleChildCardChange(selectedChildIndex, { htmlContent: value })}
                            availableVariables={availableVariables}
                            height={380}
                            placeholder="Enter HTML content. Use {{variableName}} syntax for variables."
                          />
                        </Box>
                      </Box>
                    )}
                    {/* Position & Size removed - use Interactive Layout Editor in preview panel instead */}
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* 🔥 TOOLTIP CONFIGURATION - Using Enhanced Panel */}
              <Paper
                elevation={0}
                sx={{
                  borderRadius: '12px',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  overflow: 'hidden',
                }}
              >
                <TooltipConfigPanel
                  config={currentTooltipConfig}
                  onChange={updateTooltipConfig}
                  parentChartConfig={selectedChild?.template}
                  arrayOfObjectsVariables={arrayOfObjectsVariables}
                />
              </Paper>
              {/* Legacy tooltip config preserved for reference - START */}
              {false && (
              <Accordion
                expanded={expandedAccordion === 'tooltip'}
                onChange={(_, expanded) => setExpandedAccordion(expanded ? 'tooltip' : false)}
                sx={{
                  borderRadius: '12px !important',
                  border: '1px solid rgba(102, 126, 234, 0.2)',
                  overflow: 'hidden',
                  '&:before': { display: 'none' },
                  '&.Mui-expanded': {
                    margin: '0 !important',
                    border: '1px solid rgba(102, 126, 234, 0.4)',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                  },
                }}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon sx={{ color: '#667eea' }} />}
                  sx={{
                    backgroundColor: 'rgba(102, 126, 234, 0.05)',
                    minHeight: '48px !important',
                    '& .MuiAccordionSummary-content': { my: '8px !important' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <TouchAppIcon sx={{ color: '#667eea', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#667eea' }}>
                      Tooltip Configuration
                    </Typography>
                    {currentTooltipConfig.enabled && (
                      <Chip
                        label="Enabled"
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.7rem',
                          bgcolor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10b981',
                        }}
                      />
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 2 }}>
                  <Stack spacing={2.5}>
                    {/* Enable Toggle */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={600}>Enable Tooltip</Typography>
                        <Typography variant="caption" color="#64748b">
                          Show custom tooltip on chart hover
                        </Typography>
                      </Box>
                      <Switch
                        checked={currentTooltipConfig.enabled}
                        onChange={(e) => updateTooltipConfig({ enabled: e.target.checked })}
                        sx={{
                          '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                          '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#667eea' },
                        }}
                      />
                    </Box>

                    {currentTooltipConfig.enabled && (
                      <>
                        <Divider />
                        
                        {/* Tooltip Type */}
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Tooltip Content Type
                          </Typography>
                          <ToggleButtonGroup
                            value={currentTooltipConfig.type}
                            exclusive
                            onChange={(_, value) => value && updateTooltipConfig({ type: value })}
                            size="small"
                            fullWidth
                            sx={{
                              '& .MuiToggleButton-root': {
                                textTransform: 'none',
                                py: 1,
                                '&.Mui-selected': {
                                  bgcolor: 'rgba(102, 126, 234, 0.15)',
                                  color: '#667eea',
                                  fontWeight: 600,
                                },
                              },
                            }}
                          >
                            <ToggleButton value="chart">
                              <ChartIcon sx={{ mr: 0.5, fontSize: 18 }} />
                              Chart
                            </ToggleButton>
                            <ToggleButton value="table">
                              <TableIcon sx={{ mr: 0.5, fontSize: 18 }} />
                              Table
                            </ToggleButton>
                            <ToggleButton value="html">
                              <HtmlIcon sx={{ mr: 0.5, fontSize: 18 }} />
                              HTML
                            </ToggleButton>
                          </ToggleButtonGroup>
                        </Box>

                        {/* Data Extraction Section */}
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              Data Extraction
                            </Typography>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={addDataExtraction}
                              sx={{ textTransform: 'none' }}
                            >
                              Add
                            </Button>
                          </Box>
                          
                          <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                            <Typography variant="caption">
                              Extract data from hovered points or chart config to use in tooltip.
                            </Typography>
                          </Alert>

                          {currentTooltipConfig.dataExtractions.map((extraction, index) => (
                            <Paper
                              key={extraction.id}
                              elevation={0}
                              sx={{
                                p: 1.5,
                                mb: 1,
                                border: '1px solid rgba(102, 126, 234, 0.2)',
                                borderRadius: 1,
                              }}
                            >
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                  <InputLabel>Type</InputLabel>
                                  <Select
                                    value={extraction.extractionType}
                                    label="Type"
                                    onChange={(e) => updateDataExtraction(index, { 
                                      extractionType: e.target.value as 'hover' | 'config' 
                                    })}
                                  >
                                    <MenuItem value="hover">Hover Data</MenuItem>
                                    <MenuItem value="config">Chart Config</MenuItem>
                                  </Select>
                                </FormControl>
                                
                                {extraction.extractionType === 'hover' ? (
                                  <FormControl size="small" sx={{ flex: 1 }}>
                                    <InputLabel>Source Key</InputLabel>
                                    <Select
                                      value={extraction.sourceKey}
                                      label="Source Key"
                                      onChange={(e) => updateDataExtraction(index, { sourceKey: e.target.value })}
                                    >
                                      {AVAILABLE_HOVER_KEYS.map((key) => (
                                        <MenuItem key={key.key} value={key.key}>
                                          <Box>
                                            <Typography variant="body2">{key.key}</Typography>
                                            <Typography variant="caption" color="#64748b">
                                              {key.description}
                                            </Typography>
                                          </Box>
                                        </MenuItem>
                                      ))}
                                    </Select>
                                  </FormControl>
                                ) : (
                                  <TextField
                                    size="small"
                                    label="Path"
                                    value={extraction.sourceKey}
                                    onChange={(e) => updateDataExtraction(index, { sourceKey: e.target.value })}
                                    placeholder="e.g., series[0].name"
                                    sx={{ flex: 1 }}
                                  />
                                )}
                                
                                <TextField
                                  size="small"
                                  label="Variable Name"
                                  value={extraction.targetVariable}
                                  onChange={(e) => updateDataExtraction(index, { targetVariable: e.target.value })}
                                  placeholder="e.g., selectedCategory"
                                  sx={{ flex: 1 }}
                                />
                                
                                <IconButton
                                  size="small"
                                  onClick={() => removeDataExtraction(index)}
                                  sx={{ color: '#ef4444' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Paper>
                          ))}
                        </Box>

                        {/* Calculation Bindings Section */}
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600}>
                              Calculation Bindings
                            </Typography>
                            <Button
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={addCalculationBinding}
                              sx={{ textTransform: 'none' }}
                            >
                              Add
                            </Button>
                          </Box>
                          
                          <Alert severity="info" sx={{ py: 0.5, mb: 1.5 }}>
                            <Typography variant="caption">
                              <strong>Inline calculations</strong> run at hover time when extracted data is available.
                              Results are stored as variables for use in tooltip content.
                            </Typography>
                          </Alert>

                          {currentTooltipConfig.calculationBindings.map((binding, index) => (
                            <Paper
                              key={binding.id || index}
                              elevation={0}
                              sx={{
                                p: 1.5,
                                mb: 1.5,
                                border: '1px solid rgba(102, 126, 234, 0.2)',
                                borderRadius: 1,
                                bgcolor: 'rgba(102, 126, 234, 0.02)',
                              }}
                            >
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1.5 }}>
                                <TextField
                                  size="small"
                                  label="Output Variable Name"
                                  value={binding.outputVariable}
                                  onChange={(e) => updateCalculationBinding(index, { outputVariable: e.target.value })}
                                  placeholder="e.g., tooltipChartData"
                                  sx={{ flex: 1 }}
                                  helperText="Variable name to store calculation result"
                                />
                                
                                <IconButton
                                  size="small"
                                  onClick={() => removeCalculationBinding(index)}
                                  sx={{ color: '#ef4444' }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              
                              <TextField
                                size="small"
                                label="Description (optional)"
                                value={binding.description || ''}
                                onChange={(e) => updateCalculationBinding(index, { description: e.target.value })}
                                placeholder="What this calculation does..."
                                fullWidth
                                sx={{ mb: 1.5 }}
                              />
                              
                              <Typography variant="caption" fontWeight={600} color="#667eea" sx={{ mb: 0.5, display: 'block' }}>
                                Inline Logic (runs at hover time):
                              </Typography>
                              <TextField
                                multiline
                                rows={6}
                                fullWidth
                                value={binding.inlineLogic || ''}
                                onChange={(e) => updateCalculationBinding(index, { inlineLogic: e.target.value })}
                                placeholder="// Your calculation logic here&#10;// Available: extracted data + all existing variables + filters&#10;// Example:&#10;const filtered = allSalesData.filter(item => item.category === hoveredCategory);&#10;return filtered.map(item => ({ name: item.region, y: item.sales }));"
                                sx={{
                                  '& .MuiInputBase-root': {
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    bgcolor: '#1e1e2e',
                                    color: '#cdd6f4',
                                  },
                                  '& .MuiInputBase-input': {
                                    color: '#cdd6f4',
                                  },
                                }}
                              />
                              
                              <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                                <Typography variant="caption">
                                  <strong>Available at hover:</strong> Extracted variables (e.g., <code>hoveredCategory</code>) + 
                                  all your existing variables (e.g., <code>allSalesData</code>) + filters + parameters
                                </Typography>
                              </Alert>
                            </Paper>
                          ))}
                        </Box>

                        <Divider />

                        {/* Tooltip Content Based on Type */}
                        {currentTooltipConfig.type === 'chart' && (
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                              Chart Template
                            </Typography>
                            <Alert severity="info" sx={{ py: 0.5, mb: 1 }}>
                              <Typography variant="caption">
                                Use <code>${'{'}variableName{'}'}</code> for extracted data.
                              </Typography>
                            </Alert>
                            <Box sx={{ height: 200 }}>
                              <JsonEditor
                                value={currentTooltipConfig.chartTemplate || ''}
                                onChange={(value) => updateTooltipConfig({ chartTemplate: value })}
                                height={180}
                                placeholder="Enter Highcharts JSON config..."
                                availableVariables={availableVariables}
                              />
                            </Box>
                          </Box>
                        )}

                        {currentTooltipConfig.type === 'table' && (
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                              Table Data Source
                            </Typography>
                            <FormControl fullWidth size="small">
                              <InputLabel>Variable or Calculation Output</InputLabel>
                              <Select
                                value={currentTooltipConfig.tableDataSource || ''}
                                label="Variable or Calculation Output"
                                onChange={(e) => updateTooltipConfig({ tableDataSource: e.target.value })}
                              >
                                <MenuItem value="">
                                  <em>Select...</em>
                                </MenuItem>
                                {arrayOfObjectsVariables.map((varName: string) => (
                                  <MenuItem key={varName} value={varName}>{varName}</MenuItem>
                                ))}
                                {currentTooltipConfig.calculationBindings
                                  .filter(b => b.outputVariable)
                                  .map(b => (
                                    <MenuItem key={b.outputVariable} value={b.outputVariable}>
                                      {b.outputVariable} (calc)
                                    </MenuItem>
                                  ))
                                }
                              </Select>
                            </FormControl>
                          </Box>
                        )}

                        {currentTooltipConfig.type === 'html' && (
                          <Box>
                            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                              HTML Template
                            </Typography>
                            <Alert severity="info" sx={{ py: 0.5, mb: 1 }}>
                              <Typography variant="caption">
                                Use <code>{'{{'}variableName{'}}'}</code> for extracted data.
                              </Typography>
                            </Alert>
                            <Box sx={{ height: 200 }}>
                              <HtmlEditor
                                value={currentTooltipConfig.htmlTemplate || ''}
                                onChange={(value) => updateTooltipConfig({ htmlTemplate: value })}
                                height={180}
                                placeholder="Enter HTML template..."
                                availableVariables={availableVariables}
                              />
                            </Box>
                          </Box>
                        )}

                        <Divider />

                        {/* Appearance Settings */}
                        <Box>
                          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                            Appearance
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="#64748b">
                                Width: {currentTooltipConfig.width}px
                              </Typography>
                              <Slider
                                value={currentTooltipConfig.width}
                                onChange={(_, value) => updateTooltipConfig({ width: value as number })}
                                min={200}
                                max={800}
                                step={50}
                                size="small"
                                sx={{ color: '#667eea' }}
                              />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="#64748b">
                                Height: {currentTooltipConfig.height}px
                              </Typography>
                              <Slider
                                value={currentTooltipConfig.height}
                                onChange={(_, value) => updateTooltipConfig({ height: value as number })}
                                min={150}
                                max={600}
                                step={50}
                                size="small"
                                sx={{ color: '#667eea' }}
                              />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <Typography variant="caption" color="#64748b">
                                Hide Delay: {currentTooltipConfig.hideDelay}ms
                              </Typography>
                              <Slider
                                value={currentTooltipConfig.hideDelay}
                                onChange={(_, value) => updateTooltipConfig({ hideDelay: value as number })}
                                min={0}
                                max={1000}
                                step={50}
                                size="small"
                                sx={{ color: '#667eea' }}
                              />
                            </Grid>
                            <Grid size={{ xs: 6 }}>
                              <FormControlLabel
                                control={
                                  <Switch
                                    checked={currentTooltipConfig.showHeader}
                                    onChange={(e) => updateTooltipConfig({ showHeader: e.target.checked })}
                                    size="small"
                                    sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' } }}
                                  />
                                }
                                label={<Typography variant="caption">Show Header</Typography>}
                              />
                            </Grid>
                            {currentTooltipConfig.showHeader && (
                              <Grid size={{ xs: 12 }}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Header Title"
                                  value={currentTooltipConfig.headerTitle || ''}
                                  onChange={(e) => updateTooltipConfig({ headerTitle: e.target.value })}
                                  placeholder="Details"
                                />
                              </Grid>
                            )}
                          </Grid>
                        </Box>
                      </>
                    )}
                  </Stack>
                </AccordionDetails>
              </Accordion>
              )}
              {/* Legacy tooltip config preserved for reference - END */}
              </>
            )}
            </Box> {/* End scrollable config area */}
          </Box>

          {/* Right Panel - Context-aware Preview */}
          <Box sx={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 2, position: 'relative' }}>
            
            {/* 🔥 MODE 1: Layout Editor + Full Preview (when in layout preset mode) */}
            {(expandedAccordion === 'layout' || isPreviewMode) && (
              <Fade in={true} timeout={300}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                  {/* Interactive Layout Editor */}
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      border: isPreviewMode 
                        ? '2px solid rgba(16, 185, 129, 0.4)' 
                        : '1px solid rgba(102, 126, 234, 0.2)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                        background: isPreviewMode 
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.03) 100%)'
                          : 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600} color={isPreviewMode ? '#10b981' : '#667eea'}>
                        <OpenWithIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                        {isPreviewMode ? 'Preview Mode - Drag & Resize' : 'Layout Editor'}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {isPreviewMode && (
                          <>
                            <Button 
                              size="small" 
                              variant="outlined"
                              onClick={cancelPendingLayout}
                              startIcon={<CloseIcon />}
                              sx={{ 
                                borderColor: '#9ca3af', 
                                color: '#6b7280',
                                py: 0.25,
                                fontSize: '0.75rem',
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              size="small" 
                              variant="contained"
                              onClick={applyPendingLayout}
                              startIcon={<CheckIcon />}
                              sx={{ 
                                bgcolor: '#10b981', 
                                '&:hover': { bgcolor: '#059669' },
                                py: 0.25,
                                fontSize: '0.75rem',
                              }}
                            >
                              Apply
                            </Button>
                          </>
                        )}
                        <Chip
                          size="small"
                          label={`${(isPreviewMode && pendingLayoutCards ? pendingLayoutCards.length : parentConfig.childCards.length)} card${(isPreviewMode && pendingLayoutCards ? pendingLayoutCards.length : parentConfig.childCards.length) !== 1 ? 's' : ''}`}
                          sx={{ bgcolor: 'rgba(102, 126, 234, 0.1)', color: '#667eea' }}
                        />
                      </Stack>
                    </Box>
                    <Box sx={{ p: 1.5, bgcolor: '#fafbfc' }}>
                      <InteractiveLayoutEditor
                        pendingCards={isPreviewMode && pendingLayoutCards ? pendingLayoutCards : parentConfig.childCards}
                        onLayoutChange={isPreviewMode ? handlePendingLayoutChange : (newCards) => {
                          const newConfig = { ...parentConfig, childCards: newCards };
                          setParentConfig(newConfig);
                          saveConfig(newConfig);
                          if (selectedChildIndex >= newCards.length) {
                            setSelectedChildIndex(Math.max(0, newCards.length - 1));
                          }
                        }}
                        parentId={id || ''}
                        getNextChildNumber={getNextChildNumber}
                        allowAddRemove={selectedLayoutPreset === 'custom' || pendingLayoutPreset === 'custom'}
                        height={220}
                      />
                    </Box>
                  </Paper>

                  {/* Full Container Preview */}
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      border: '1px solid rgba(102, 126, 234, 0.2)',
                      overflow: 'hidden',
                      minHeight: 200,
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600} color="#667eea">
                        <PreviewIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                        Container Preview
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, overflow: 'hidden', bgcolor: '#f8fafc', position: 'relative' }}>
                      <ParentCardContainer
                        parentCardId={id || 'preview'}
                        config={isPreviewMode && pendingLayoutCards 
                          ? { ...parentConfig, childCards: pendingLayoutCards }
                          : parentConfig
                        }
                        showExport={false}
                      />
                    </Box>
                  </Paper>
                </Box>
              </Fade>
            )}

            {/* 🔥 MODE 2: Single Card Preview (when editing individual card configuration) */}
            {(expandedAccordion === 'childConfig' || expandedAccordion === 'cards') && !isPreviewMode && selectedChild && (
              <Fade in={true} timeout={300}>
                <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <Paper
                    elevation={0}
                    sx={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 2,
                      border: '2px solid rgba(102, 126, 234, 0.3)',
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        p: 1.5,
                        borderBottom: '1px solid rgba(102, 126, 234, 0.15)',
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600} color="#667eea">
                        <PreviewIcon sx={{ mr: 1, verticalAlign: 'middle', fontSize: 18 }} />
                        Card {getChildDisplayNumber(selectedChild.id, selectedChildIndex)} Preview
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          size="small"
                          icon={selectedChild.type === 'chart' ? <ChartIcon sx={{ fontSize: 14 }} /> : 
                                selectedChild.type === 'table' ? <TableIcon sx={{ fontSize: 14 }} /> : 
                                <HtmlIcon sx={{ fontSize: 14 }} />}
                          label={selectedChild.type}
                          sx={{ 
                            bgcolor: selectedChild.type === 'chart' ? 'rgba(102, 126, 234, 0.1)' :
                                     selectedChild.type === 'table' ? 'rgba(16, 185, 129, 0.1)' : 
                                     'rgba(245, 158, 11, 0.1)',
                            color: selectedChild.type === 'chart' ? '#667eea' :
                                   selectedChild.type === 'table' ? '#10b981' : '#f59e0b',
                            textTransform: 'capitalize',
                          }}
                        />
                      </Stack>
                    </Box>
                    {/* 🔥 FULL-SIZE PREVIEW - occupies entire area */}
                    <Box 
                      sx={{ 
                        flex: 1, 
                        overflow: 'hidden', 
                        bgcolor: 'white', 
                        position: 'relative',
                        minHeight: 400,
                      }}
                    >
                      <ChildCard
                        config={selectedChild}
                        parentCardId={id}  // 🔥 FIX: Pass parentCardId for tooltip to work
                        showExport={true}
                        isFullSizePreview={true} // 🔥 NEW: Render at full size!
                      />
                    </Box>
                  </Paper>
                </Box>
              </Fade>
            )}

            {/* 🔥 Draggable Floating Action Button for Fullscreen Preview - ALWAYS VISIBLE */}
            <Zoom in={true} timeout={300}>
              <Fab
                color="primary"
                size="medium"
                onClick={(e) => {
                  // Only trigger click if not dragging
                  if (!isDraggingFab) {
                    setIsFullscreenPreview(true);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingFab(false);
                  fabDragStartRef.current = {
                    x: e.clientX,
                    y: e.clientY,
                    fabX: fabPosition.x,
                    fabY: fabPosition.y,
                  };
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    if (!fabDragStartRef.current) return;
                    
                    const deltaX = moveEvent.clientX - fabDragStartRef.current.x;
                    const deltaY = moveEvent.clientY - fabDragStartRef.current.y;
                    
                    // Only start dragging if moved more than 5px
                    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
                      setIsDraggingFab(true);
                      
                      // Calculate new position (from bottom-right)
                      const newX = fabDragStartRef.current.fabX - deltaX;
                      const newY = fabDragStartRef.current.fabY - deltaY;
                      
                      // Constrain to viewport
                      setFabPosition({
                        x: Math.max(16, Math.min(newX, window.innerWidth - 72)),
                        y: Math.max(16, Math.min(newY, window.innerHeight - 72)),
                      });
                    }
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    fabDragStartRef.current = null;
                    // Reset dragging state after a short delay to allow click to be blocked
                    setTimeout(() => setIsDraggingFab(false), 100);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                sx={{
                  position: 'fixed', // 🔥 Changed to fixed for global positioning
                  bottom: fabPosition.y,
                  right: fabPosition.x,
                  zIndex: 9999,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  boxShadow: isDraggingFab 
                    ? '0 8px 30px rgba(102, 126, 234, 0.6)' 
                    : '0 4px 20px rgba(102, 126, 234, 0.4)',
                  cursor: isDraggingFab ? 'grabbing' : 'grab',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                    boxShadow: '0 6px 25px rgba(102, 126, 234, 0.5)',
                    transform: isDraggingFab ? 'none' : 'scale(1.1)',
                  },
                  transition: isDraggingFab ? 'none' : 'all 0.2s ease-in-out',
                  userSelect: 'none',
                }}
              >
                <Tooltip 
                  title={
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="caption" fontWeight={600}>View Full Container</Typography>
                      <Typography variant="caption" display="block" sx={{ opacity: 0.7, fontSize: '0.65rem' }}>
                        Drag to reposition
                      </Typography>
                    </Box>
                  } 
                  placement="left"
                >
                  <FullscreenIcon />
                </Tooltip>
              </Fab>
            </Zoom>
          </Box>
        </Box>
      )}

      {/* 🔥 Fullscreen Preview Dialog with animation */}
      <Dialog
        open={isFullscreenPreview}
        onClose={() => setIsFullscreenPreview(false)}
        maxWidth={false}
        fullScreen
        TransitionComponent={Fade}
        transitionDuration={{ enter: 400, exit: 300 }}
        PaperProps={{
          sx: {
            bgcolor: '#0f172a',
            backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(102, 126, 234, 0.15) 0%, transparent 50%)',
          }
        }}
      >
        <Fade in={isFullscreenPreview} timeout={600}>
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100vh',
            p: 3,
          }}>
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mb: 3,
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <GridIcon sx={{ color: 'white', fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h5" color="white" fontWeight={700}>
                    Multi-Card Container Preview
                  </Typography>
                  <Typography variant="body2" color="rgba(255,255,255,0.6)">
                    {parentConfig.childCards.length} card{parentConfig.childCards.length !== 1 ? 's' : ''} • Full-size preview
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="contained"
                startIcon={<FullscreenExitIcon />}
                onClick={() => setIsFullscreenPreview(false)}
                sx={{ 
                  bgcolor: 'rgba(255,255,255,0.1)', 
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                  px: 3,
                }}
              >
                Exit Fullscreen
              </Button>
            </Box>
            <Box sx={{ 
              flex: 1, 
              bgcolor: 'white', 
              borderRadius: 3, 
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            }}>
              {/* 🔥 ALWAYS show full multi-card container in fullscreen */}
              <ParentCardContainer
                parentCardId={id || 'preview'}
                config={isPreviewMode && pendingLayoutCards 
                  ? { ...parentConfig, childCards: pendingLayoutCards }
                  : parentConfig
                }
                showExport={false}
              />
            </Box>
          </Box>
        </Fade>
      </Dialog>

      {/* Empty state when container is disabled */}
      {!parentConfig.isContainer && (
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 2,
            borderRadius: 2,
            border: '2px dashed rgba(102, 126, 234, 0.3)',
            bgcolor: 'rgba(102, 126, 234, 0.02)',
          }}
        >
          <GridIcon sx={{ fontSize: 48, color: '#9ca3af' }} />
          <Typography color="text.secondary" textAlign="center">
            Enable Multi-Card Container above to configure child cards
          </Typography>
          <Typography variant="caption" color="text.secondary" textAlign="center" maxWidth={400}>
            A container card can hold up to 4 child visualizations (charts, tables, or HTML) 
            that share the same local filters and can scroll together.
          </Typography>
        </Paper>
      )}

      {/* 🔥 Confirmation Dialog for destructive layout changes */}
      <LayoutChangeDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog({ ...confirmDialog, open: false })}
        onConfirm={handleConfirmLayoutChange}
        currentCardCount={parentConfig.childCards.length}
        newCardCount={confirmDialog.newCardCount}
        presetLabel={confirmDialog.presetLabel}
      />
    </Box>
  );
}

