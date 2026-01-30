import { useState, useEffect, useRef, useCallback } from "react";
import { useRecoilValue, useRecoilState } from 'recoil';
import axios from "axios";
import { 
  Box, 
  Select, 
  MenuItem, 
  Button, 
  Paper, 
  Typography, 
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Checkbox,
  FormGroup,
  FormControlLabel,
  Radio,
  RadioGroup,
  ListItemText,
  Menu,
  Tooltip,
  Badge,
} from '@mui/material';
import { 
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  FilterAlt as FilterAltIcon,
} from '@mui/icons-material';
import Draggable from 'react-draggable';
import { allFiltersSelector, filterNamesState, filterConfigFamily } from "../recoil/FiltersFamily";
import { liveFilterFamily } from "../recoil/LiveFilterFamily";
import { atom } from 'recoil';
import { IsEditModeState } from "../recoil/IsEditeMode";
import { shouldBlockSave } from "../recoil/initializationState";
import { currentViewContextState } from "../recoil/ViewContext";
import { API_BASE_URL } from '../config/api.config';

// Type for filter options
interface DefaultValueOption {
  label: string;
  value: string | number;
}

interface FilterPanelProps {
  showFilters: boolean;
  topOffset?: string;
  onToggle?: () => void;
}

interface FilterPosition {
  x: number;
  y: number;
}

// Recoil state for filter panel expanded/collapsed
export const filterPanelExpandedState = atom<boolean>({
  key: 'filterPanelExpandedState',
  default: false,
});

// Recoil state for filter positions
// NOTE: Loading is handled by DataInitializer to avoid race conditions
export const filterPositionsState = atom<Record<string, FilterPosition>>({
  key: 'filterPositionsState',
  default: {},
});

// Recoil state for active filter IDs
// NOTE: Loading is handled by DataInitializer to avoid race conditions
export const activeFilterIdsState = atom<string[]>({
  key: 'activeFilterIdsState',
  default: [],
});

// Compact Filter Item with Dropdown (exported for card-level reuse)
export const CompactFilterItem: React.FC<{ 
  variableName: string; 
  onRemove: () => void;
  position?: FilterPosition;
  onPositionChange?: (pos: FilterPosition) => void;
  variant?: 'global' | 'inline';
}> = ({ variableName, onRemove, position, onPositionChange, variant = 'global' }) => {
  const filterConfig = useRecoilValue(filterConfigFamily(variableName));
  const [liveValue, setLiveValue] = useRecoilState(liveFilterFamily(variableName));
  const [tempValue, setTempValue] = useState<any[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const nodeRef = useRef(null);

  const isOpen = Boolean(anchorEl);
  const isInlineVariant = variant === 'inline';
  const effectivePosition = position || { x: 0, y: 0 };
  const isEditMode=useRecoilValue(IsEditModeState);

  // Initialize with default values
  useEffect(() => {
    if (!liveValue && filterConfig?.defaultValues && filterConfig.defaultValues.length > 0) {
      setLiveValue(filterConfig.defaultValues);
      setTempValue(filterConfig.defaultValues);
    } else if (liveValue) {
      setTempValue(liveValue);
    }
  }, [liveValue, filterConfig, setLiveValue]);

  if (!filterConfig) return null;

  const selectedValues: DefaultValueOption[] = tempValue || [];
  const options: DefaultValueOption[] = filterConfig.availableOptions || [];
  
  // Helper to check if a value is selected
  const isValueSelected = (optionValue: string | number) => {
    return selectedValues.some((sv: DefaultValueOption) => sv.value === optionValue);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    setLiveValue(tempValue);
    handleClose();
  };

  const handleReset = () => {
    const defaultVals = filterConfig?.defaultValues || [];
    setTempValue(defaultVals);
    setLiveValue(defaultVals);
    handleClose();
  };

  const handleSelectAll = () => {
    setTempValue([...options]);
  };

  const handleClearAll = () => {
    setTempValue([]);
  };

  const handleToggleOption = (option: DefaultValueOption) => {
    if (isValueSelected(option.value)) {
      setTempValue(tempValue.filter((v: DefaultValueOption) => v.value !== option.value));
    } else {
      setTempValue([...tempValue, option]);
    }
  };

  const handleRadioChange = (option: DefaultValueOption) => {
    setTempValue([option]);
  };

  const displayValue = selectedValues.length === 0 
    ? 'Select...'
    : selectedValues.length === 1 
      ? selectedValues[0].label
      : selectedValues.length === options.length
        ? 'All'
        : `${selectedValues.length} selected`;

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'params':
        return { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' };
      case 'data-source':
        return { bg: '#faf5ff', text: '#9333ea', border: '#d8b4fe' };
      case 'hooks':
        return { bg: '#fff7ed', text: '#ea580c', border: '#fdba74' };
      default:
        return { bg: '#f8fafc', text: '#64748b', border: '#cbd5e1' };
    }
  };

  const categoryColors = getCategoryColor(filterConfig.category);

  // Simple drag stop handler - just update position
  const handleDragStop = (_e: any, data: { x: number; y: number }) => {
    if (variant === 'global' && onPositionChange) {
      // Ensure minimum margins
      const newPos = {
        x: Math.max(8, data.x),
        y: Math.max(8, data.y),
      };
      onPositionChange(newPos);
    }
  };

  // Inline variant - draggable filter within card (same as global but styled for cards)
  // Handle drag stop for inline variant
  const handleInlineDragStop = (_e: any, data: { x: number; y: number }) => {
    if (onPositionChange) {
      const newPos = {
        x: Math.max(0, data.x),
        y: Math.max(0, data.y),
      };
      onPositionChange(newPos);
    }
  };

  // Check if filter has a valid stored position (for absolute positioning)
  const hasValidPosition = position && typeof position.x === 'number' && typeof position.y === 'number' && position.x >= 0 && position.y >= 0;

  if (isInlineVariant) {
    // If no valid position yet (not dragged), use flex layout; once dragged, switch to absolute
    const filterContent = (
      <Paper
        ref={nodeRef}
        elevation={2}
        className="compact-filter-item"
        sx={{
          // Use absolute positioning only if dragged (has valid position)
          position: hasValidPosition ? 'absolute' : 'relative',
          // Apply left/top when we have a valid position (for non-edit mode)
          // In edit mode, Draggable handles positioning via transform
          ...(hasValidPosition && !isEditMode ? {
            left: position!.x,
            top: position!.y,
          } : {}),
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.75,
          pl: 1,
          pr: 0.5,
          borderRadius: 2,
          bgcolor: 'white',
          border: '1px solid #e2e8f0',
          width: 220,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          transition: hasValidPosition ? 'none' : 'all 0.2s ease',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderColor: '#3B82F6',
          },
          // CSS for when being dragged (applied by react-draggable)
          '&.react-draggable-dragging': {
            zIndex: 1000,
            boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
            border: '2px solid #3B82F6',
          },
        }}
      >
        {/* Drag Handle - Only visible in edit mode */}
        {isEditMode && (
          <Box 
            className="drag-handle-inline"
            sx={{ 
              cursor: 'grab',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              mr: 0.5,
              '&:hover': { color: '#3B82F6' },
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        )}

        {/* Filter Info */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <Typography 
              variant="caption" 
              fontWeight={600} 
              color="#334155"
              title={filterConfig.displayName}
              sx={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                minWidth: 0,
                fontSize: '0.7rem',
              }}
            >
              {filterConfig.displayName}
            </Typography>
            <Chip 
              label={filterConfig.category}
              size="small"
              sx={{
                bgcolor: categoryColors.bg,
                color: categoryColors.text,
                border: `1px solid ${categoryColors.border}`,
                fontSize: '0.5rem',
                height: 14,
                fontWeight: 700,
                flexShrink: 0,
                '& .MuiChip-label': { px: 0.5 },
              }}
            />
          </Box>
          
          {/* Value Display - Clickable */}
          <Box 
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 0.75,
              py: 0.35,
              borderRadius: 1,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              '&:hover': {
                borderColor: '#3B82F6',
                bgcolor: '#f0f4ff',
              },
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: selectedValues.length ? '#334155' : '#94a3b8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                fontSize: '0.7rem',
              }}
            >
              {displayValue}
            </Typography>
            <KeyboardArrowDownIcon sx={{ color: '#94a3b8', fontSize: 14, ml: 0.5 }} />
          </Box>
        </Box>

        {/* Remove Button - Only visible in edit mode */}
        {isEditMode && (
          <IconButton 
            size="small" 
            onClick={onRemove}
            sx={{ 
              color: '#94a3b8',
              p: 0.25,
              '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}

        {/* Dropdown Menu */}
        <Menu
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{
            sx: {
              mt: 0.5,
              borderRadius: 2,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              width: 220,
              maxWidth: 220,
              maxHeight: 350,
              display: 'flex',
              flexDirection: 'column',
            }
          }}
        >
          {filterConfig.selectionType === 'single' ? (
            <Box sx={{ maxHeight: 200, overflow: 'auto', flex: 1 }}>
              <RadioGroup value={selectedValues[0]?.value || ''}>
                {options.map((option: DefaultValueOption) => (
                  <MenuItem 
                    key={String(option.value)} 
                    onClick={() => handleRadioChange(option)}
                    sx={{ py: 0.5 }}
                  >
                    <Radio 
                      size="small" 
                      checked={isValueSelected(option.value)}
                      sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
                    />
                    <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</Typography>
                  </MenuItem>
                ))}
              </RadioGroup>
            </Box>
          ) : (
            <>
              {/* Select All Checkbox */}
              <MenuItem 
                onClick={() => {
                  if (selectedValues.length === options.length) {
                    handleClearAll();
                  } else {
                    handleSelectAll();
                  }
                }}
                sx={{ 
                  py: 0.75, 
                  borderBottom: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                  '&:hover': { bgcolor: '#f0f4ff' }
                }}
              >
                <Checkbox 
                  size="small" 
                  checked={selectedValues.length === options.length}
                  indeterminate={selectedValues.length > 0 && selectedValues.length < options.length}
                  sx={{ 
                    color: '#3B82F6', 
                    '&.Mui-checked': { color: '#3B82F6' },
                    '&.MuiCheckbox-indeterminate': { color: '#3B82F6' }
                  }}
                />
                <Typography variant="body2" fontWeight={600} color="#475569">Select All</Typography>
              </MenuItem>
              <Box sx={{ maxHeight: 200, overflow: 'auto', flex: 1 }}>
                {options.map((option: DefaultValueOption) => (
                  <MenuItem 
                    key={String(option.value)} 
                    onClick={() => handleToggleOption(option)}
                    sx={{ py: 0.5 }}
                  >
                    <Checkbox 
                      size="small" 
                      checked={isValueSelected(option.value)}
                      sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
                    />
                    <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</Typography>
                  </MenuItem>
                ))}
              </Box>
            </>
          )}
          <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button 
              fullWidth 
              size="small" 
              variant="outlined"
              onClick={handleReset}
              sx={{ 
                borderColor: '#cbd5e1', 
                color: '#64748b',
                textTransform: 'none',
                fontSize: '0.75rem',
                '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' }
              }}
            >
              Reset
            </Button>
            <Button 
              fullWidth 
              size="small" 
              variant="contained"
              onClick={handleApply}
              sx={{ 
                bgcolor: '#3B82F6', 
                textTransform: 'none',
                fontSize: '0.75rem',
                '&:hover': { bgcolor: '#2563EB' } 
              }}
            >
              Apply
            </Button>
          </Box>
        </Menu>
      </Paper>
    );

    // Wrap with Draggable for edit mode
    if (isEditMode) {
      return (
        <Draggable
          nodeRef={nodeRef}
          handle=".drag-handle-inline"
          position={hasValidPosition ? position : { x: 0, y: 0 }}
          onStop={handleInlineDragStop}
          bounds="parent"
        >
          {filterContent}
        </Draggable>
      );
    }

    // Non-edit mode - render without drag
    return filterContent;
  }

  // Global variant - draggable filter chip
  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={effectivePosition}
      onStop={handleDragStop}
      bounds="parent"
      disabled={!isEditMode}
    >
      <Paper
        ref={nodeRef}
        elevation={2}
        sx={{
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          p: 0.75,
          pl: 1,
          pr: 0.5,
          borderRadius: 2,
          bgcolor: 'white',
          border: '1px solid #e2e8f0',
          width: 240,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            borderColor: '#3B82F6',
          },
          // CSS for when being dragged (applied by react-draggable)
          '&.react-draggable-dragging': {
            zIndex: 1000,
            boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
            border: '2px solid #3B82F6',
          },
        }}
      >
        {/* Drag Handle - Only visible in edit mode */}
        {isEditMode && (
          <Box 
            className="drag-handle"
            sx={{ 
              cursor: 'grab',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              mr: 0.5,
              '&:hover': { color: '#3B82F6' },
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        )}

        {/* Filter Info */}
        <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
            <Typography 
              variant="caption" 
              fontWeight={600} 
              color="#334155"
              title={filterConfig.displayName}
              sx={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
            >
              {filterConfig.displayName}
            </Typography>
            <Chip 
              label={filterConfig.category}
              size="small"
              sx={{
                bgcolor: categoryColors.bg,
                color: categoryColors.text,
                border: `1px solid ${categoryColors.border}`,
                fontSize: '0.55rem',
                height: 16,
                fontWeight: 700,
                flexShrink: 0,
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
          
          {/* Value Display - Clickable */}
          <Box 
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              bgcolor: '#f8fafc',
              border: '1px solid #e2e8f0',
              cursor: 'pointer',
              '&:hover': {
                borderColor: '#3B82F6',
                bgcolor: '#f0f4ff',
              },
            }}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                color: selectedValues.length ? '#334155' : '#94a3b8',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              }}
            >
              {displayValue}
            </Typography>
            <KeyboardArrowDownIcon sx={{ color: '#94a3b8', fontSize: 16, ml: 0.5 }} />
          </Box>
        </Box>

        {/* Remove Button - Only visible in edit mode */}
        {isEditMode && (
          <IconButton 
            size="small" 
            onClick={onRemove}
            sx={{ 
              color: '#94a3b8',
              p: 0.25,
              '&:hover': { color: '#ef4444', bgcolor: '#fef2f2' },
            }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}

        {/* Dropdown Menu */}
        <Menu
          anchorEl={anchorEl}
          open={isOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{
            sx: {
              mt: 0.5,
              borderRadius: 2,
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
              border: '1px solid #e2e8f0',
              width: 240, // Fixed width to match filter
              maxWidth: 240,
              maxHeight: 350,
              display: 'flex',
              flexDirection: 'column',
            }
          }}
        >
          {filterConfig.selectionType === 'single' ? (
            <Box sx={{ maxHeight: 200, overflow: 'auto', flex: 1 }}>
              <RadioGroup value={selectedValues[0]?.value || ''}>
                {options.map((option: DefaultValueOption) => (
                  <MenuItem 
                    key={String(option.value)} 
                    onClick={() => handleRadioChange(option)}
                    sx={{ py: 0.5 }}
                  >
                    <Radio 
                      size="small" 
                      checked={isValueSelected(option.value)}
                      sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
                    />
                    <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</Typography>
                  </MenuItem>
                ))}
              </RadioGroup>
            </Box>
          ) : (
            <>
              {/* Select All Checkbox */}
              <MenuItem 
                onClick={() => {
                  if (selectedValues.length === options.length) {
                    handleClearAll();
                  } else {
                    handleSelectAll();
                  }
                }}
                sx={{ 
                  py: 0.75, 
                  borderBottom: '1px solid #e2e8f0',
                  bgcolor: '#f8fafc',
                  '&:hover': { bgcolor: '#f0f4ff' }
                }}
              >
                <Checkbox 
                  size="small" 
                  checked={selectedValues.length === options.length}
                  indeterminate={selectedValues.length > 0 && selectedValues.length < options.length}
                  sx={{ 
                    color: '#3B82F6', 
                    '&.Mui-checked': { color: '#3B82F6' },
                    '&.MuiCheckbox-indeterminate': { color: '#3B82F6' }
                  }}
                />
                <Typography variant="body2" fontWeight={600} color="#475569">Select All</Typography>
              </MenuItem>
              <Box sx={{ maxHeight: 200, overflow: 'auto', flex: 1 }}>
                {options.map((option: DefaultValueOption) => (
                  <MenuItem 
                    key={String(option.value)} 
                    onClick={() => handleToggleOption(option)}
                    sx={{ py: 0.5 }}
                  >
                    <Checkbox 
                      size="small" 
                      checked={isValueSelected(option.value)}
                      sx={{ color: '#3B82F6', '&.Mui-checked': { color: '#3B82F6' } }}
                    />
                    <Typography variant="body2" noWrap sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{option.label}</Typography>
                  </MenuItem>
                ))}
              </Box>
            </>
          )}
          <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button 
              fullWidth 
              size="small" 
              variant="outlined"
              onClick={handleReset}
              sx={{ 
                borderColor: '#cbd5e1', 
                color: '#64748b',
                textTransform: 'none',
                '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc' }
              }}
            >
              Reset
            </Button>
            <Button 
              fullWidth 
              size="small" 
              variant="contained"
              onClick={handleApply}
              sx={{ 
                bgcolor: '#3B82F6', 
                textTransform: 'none',
                '&:hover': { bgcolor: '#2563EB' } 
              }}
            >
              Apply
            </Button>
          </Box>
        </Menu>
      </Paper>
    </Draggable>
  );
};

// ============================================
// ENTERPRISE COLLAPSIBLE FILTER PANEL
// ============================================

const COLLAPSED_WIDTH = 48;
const EXPANDED_WIDTH = 320;

export const FilterPanel: React.FC<FilterPanelProps> = ({ 
  showFilters, 
  topOffset = '0px',
  onToggle 
}) => {
  const isEdit = useRecoilValue(IsEditModeState);
  const filterNames = useRecoilValue(filterNamesState);
  const allFilters = useRecoilValue(allFiltersSelector);
  const [activeFilterIds, setActiveFilterIds] = useRecoilState(activeFilterIdsState);
  const [filterPositions, setFilterPositions] = useRecoilState(filterPositionsState);
  
  // Get current dashboard context for scoped saves
  const viewContext = useRecoilValue(currentViewContextState);
  
  // Shared expanded state - allows parent components to react to panel state
  const [isExpanded, setIsExpanded] = useRecoilState(filterPanelExpandedState);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [tempSelectedFilters, setTempSelectedFilters] = useState<string[]>([]);

  // Filter configurations for the dropdown
  const availableFilters: { variableName: string; displayName: string; category: string; }[] = Object.values(allFilters).map((f) => ({
    variableName: f.variableName,
    displayName: f.displayName || f.variableName,
    category: f.category || 'Other',
  }));

  // Save filter state to database whenever active filters or positions change
  // Filter panel state is DASHBOARD-SCOPED (shared across all views in a dashboard)
  useEffect(() => {
    // Don't save during data initialization (prevents overwriting with empty/stale values)
    if (shouldBlockSave()) {
      console.log('⏭️ [FilterPanel] Skipping save - data initialization in progress');
      return;
    }
    
    // Don't save if no dashboard context yet
    if (!viewContext.dashboardId) {
      console.log('⏭️ [FilterPanel] Skipping save - no dashboard context');
      return;
    }
    
    // Don't save if no filters are active and no positions exist
    // This prevents saving empty state when first mounting before data loads
    if (activeFilterIds.length === 0 && Object.keys(filterPositions).length === 0) {
      return;
    }
    
    const saveState = async () => {
      try {
        await axios.post(`${API_BASE_URL}/api/filter-panel-state`, {
          dashboardId: viewContext.dashboardId,
          activeFilterIds,
          positions: filterPositions,
        });
        console.log('💾 [FilterPanel] Saved filter state for dashboard', viewContext.dashboardId, ':', { activeFilterIds: activeFilterIds.length, positions: Object.keys(filterPositions).length });
      } catch (err) {
        console.error('Failed to save filter panel state:', err);
      }
    };
    
    // Debounce save
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [activeFilterIds, filterPositions, viewContext.dashboardId]);

  const handleToggleFilter = (filterName: string) => {
    if (filterName === 'ALL') {
      // Toggle all filters
      if (tempSelectedFilters.length === filterNames.length) {
        setTempSelectedFilters([]);
      } else {
        setTempSelectedFilters([...filterNames]);
      }
    } else {
      // Toggle individual filter
      if (tempSelectedFilters.includes(filterName)) {
        setTempSelectedFilters(tempSelectedFilters.filter(name => name !== filterName));
      } else {
        setTempSelectedFilters([...tempSelectedFilters, filterName]);
      }
    }
  };

  const handleApplyFilters = () => {
    // Find filters to add (in tempSelectedFilters but not in activeFilterIds)
    const filtersToAdd = tempSelectedFilters.filter(name => !activeFilterIds.includes(name));
    
    // Find filters to remove (in activeFilterIds but not in tempSelectedFilters)
    const filtersToRemove = activeFilterIds.filter(name => !tempSelectedFilters.includes(name));

    // Update active filters
    const newActiveFilters = tempSelectedFilters.filter(name => filterNames.includes(name));
    setActiveFilterIds(newActiveFilters);

    // Set initial positions for new filters - stack them vertically with consistent spacing
    const newPositions = { ...filterPositions };
    const FILTER_HEIGHT = 70; // Approximate height of each filter
    const FILTER_SPACING = 8; // Gap between filters
    const INITIAL_X = 12; // Left margin
    const INITIAL_Y = 8; // Top margin
    
    // Calculate starting Y position based on existing filters
    const existingFiltersCount = newActiveFilters.filter(id => filterPositions[id]).length;
    let yOffset = INITIAL_Y + (existingFiltersCount * (FILTER_HEIGHT + FILTER_SPACING));
    
    filtersToAdd.forEach((filterId) => {
      if (!newPositions[filterId]) {
        newPositions[filterId] = {
          x: INITIAL_X,
          y: yOffset,
        };
        yOffset += FILTER_HEIGHT + FILTER_SPACING;
      }
    });

    // Remove positions for removed filters
    filtersToRemove.forEach((filterId) => {
      delete newPositions[filterId];
    });
    
    setFilterPositions(newPositions);
    setDropdownOpen(false);
  };

  const handleCancelFilters = () => {
    setTempSelectedFilters(activeFilterIds);
    setDropdownOpen(false);
  };

  const handleRemoveFilter = (filterId: string) => {
    setActiveFilterIds(activeFilterIds.filter(id => id !== filterId));
    const newPositions = { ...filterPositions };
    delete newPositions[filterId];
    setFilterPositions(newPositions);
  };

  const handlePositionChange = (filterId: string, position: FilterPosition) => {
    setFilterPositions({
      ...filterPositions,
      [filterId]: position,
    });
  };

  // Simple position update - no complex repositioning during drag for better performance
  const handleFinalPosition = useCallback((movedFilterId: string, newPosition: FilterPosition) => {
    setFilterPositions(prev => ({
      ...prev,
      [movedFilterId]: newPosition,
    }));
    
    // Save to database (debounced by the useEffect above)
  }, [setFilterPositions]);

  // Reset all filter positions to default stacked layout
  const handleResetPositions = () => {
    const FILTER_HEIGHT = 70;
    const FILTER_SPACING = 8;
    const INITIAL_X = 12;
    const INITIAL_Y = 8;
    
    const newPositions: Record<string, FilterPosition> = {};
    activeFilterIds.forEach((filterId, index) => {
      newPositions[filterId] = {
        x: INITIAL_X,
        y: INITIAL_Y + (index * (FILTER_HEIGHT + FILTER_SPACING)),
      };
    });
    
    setFilterPositions(newPositions);
    
    // Save to database
    axios.post(`${API_BASE_URL}/api/filter-panel-state`, {
      activeFilterIds,
      positions: newPositions,
    }).catch(err => console.error('Failed to save reset positions:', err));
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Always render the panel (collapsed or expanded)
  // No footer in the new UI design
  const FOOTER_HEIGHT = 0;
  
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        top: topOffset,
        height: `calc(100vh - ${topOffset} - ${FOOTER_HEIGHT}px)`,
        width: isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        display: 'flex',
        zIndex: 30,
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Collapse/Expand Toggle Bar */}
      <Box
        sx={{
          width: COLLAPSED_WIDTH,
          height: '100%',
          bgcolor: '#F8FAFC',
          borderLeft: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pt: 0,
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {/* Filter Icon with Badge and Text - Toggle Button */}
        <Tooltip title={isExpanded ? "Collapse Filters" : "Expand Filters"} placement="left" arrow>
          <Box
            onClick={toggleExpanded}
            sx={{
              width: COLLAPSED_WIDTH,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'rgba(59, 130, 246, 0.08)',
              },
            }}
          >
            <Badge 
              badgeContent={activeFilterIds.length} 
              color="error"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.6rem',
                  height: 14,
                  minWidth: 14,
                  bgcolor: '#ef4444',
                  top: 2,
                  right: 2,
                }
              }}
            >
              <FilterAltIcon sx={{ color: '#3B82F6', fontSize: 22 }} />
            </Badge>
            <Typography
              sx={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                color: '#374151',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: 1,
                mt: 1.5,
              }}
            >
              Filters
            </Typography>
          </Box>
        </Tooltip>
      </Box>

      {/* Expanded Panel Content */}
      <Box
        sx={{
          flex: 1,
          bgcolor: '#F8FAFC',
          borderLeft: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'translateX(0)' : 'translateX(100%)',
          transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isExpanded ? 'auto' : 'none',
        }}
      >
        {/* Header Section */}
        <Box sx={{ p: 2, pt: isEdit ? 2 : 2, borderBottom: isEdit ? '1px solid #E5E7EB' : 0 }}>
          <Box 
            sx={{ 
              bgcolor: '#3B82F6',
              color: 'white', 
              textAlign: 'center',
              py: 1.25,
              mx: -2,
              mt: -2,
              mb: isEdit ? 2 : -1.5,
            }}
          >
            <Typography variant="subtitle2" fontWeight="700" letterSpacing={0.5}>
              Filters
            </Typography>
          </Box>

          {/* Filter Selector */}
          {isEdit && (
            <Paper 
              elevation={0}
              sx={{ 
                p: 2, 
                background: '#F8FAFC',
                border: '1px solid #E5E7EB',
                borderRadius: 2,
              }}
            >
              {/* Reset Layout Button - only show when there are active filters */}
              {activeFilterIds.length > 0 && (
                <Box sx={{ mb: 1.5, display: 'flex', justifyContent: 'flex-end' }}>
                  <Tooltip title="Reset all filters to default stacked layout" placement="left">
                    <Button
                      size="small"
                      variant="text"
                      onClick={handleResetPositions}
                      sx={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        textTransform: 'none',
                        '&:hover': {
                          bgcolor: 'rgba(102, 126, 234, 0.1)',
                          color: '#3B82F6',
                        }
                      }}
                    >
                      Reset Layout
                    </Button>
                  </Tooltip>
                </Box>
              )}
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#3B82F6', '&.Mui-focused': { color: '#3B82F6' } }}>
                  Add Filters
                </InputLabel>
                <Select
                  multiple
                  value={tempSelectedFilters}
                  open={dropdownOpen}
                  onOpen={() => {
                    setTempSelectedFilters(activeFilterIds);
                    setDropdownOpen(true);
                  }}
                  onClose={() => {}} // Prevent auto-close
                  label="Add Filters"
                  renderValue={(selected) => {
                    if (selected.length === 0) return <em>No filters selected</em>;
                    if (selected.length === filterNames.length) return `All Filters (${selected.length})`;
                    return `${selected.length} filter${selected.length > 1 ? 's' : ''} selected`;
                  }}
                  sx={{ 
                    bgcolor: 'white',
                    borderRadius: 1.5,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3B82F6',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3B82F6',
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 400,
                        width: 240, // Fixed width to fit panel
                        maxWidth: 260,
                        display: 'flex',
                        flexDirection: 'column',
                        '& .MuiList-root': {
                          pt: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          flex: 1,
                          overflow: 'hidden',
                        }
                      }
                    },
                    autoFocus: false,
                  }}
                >
                  {/* Select All Option - Sticky at top */}
                  <MenuItem
                    value="ALL"
                    onClick={() => handleToggleFilter('ALL')}
                    sx={{
                      borderBottom: '1px solid #e2e8f0',
                      bgcolor: '#f8fafc',
                      position: 'sticky',
                      top: 0,
                      zIndex: 2,
                      '&:hover': {
                        bgcolor: '#f0f4ff',
                      }
                    }}
                  >
                    <Checkbox
                      size="small"
                      checked={tempSelectedFilters.length === filterNames.length}
                      indeterminate={tempSelectedFilters.length > 0 && tempSelectedFilters.length < filterNames.length}
                      sx={{ 
                        color: '#3B82F6', 
                        '&.Mui-checked': { color: '#3B82F6' },
                        '&.MuiCheckbox-indeterminate': { color: '#3B82F6' },
                        ml: -0.5,
                      }}
                    />
                    <Typography variant="body2" fontWeight={600}>
                      Select All
                    </Typography>
                  </MenuItem>

                  {/* Individual Filter Options - Scrollable */}
                  <Box sx={{ maxHeight: 250, overflow: 'auto', flex: 1 }}>
                    {availableFilters.map((config) => {
                      const getCategoryChipColor = (category: string) => {
                        switch (category.toLowerCase()) {
                          case 'params':
                            return { bgcolor: '#f0fdf4', color: '#16a34a', border: '1px solid #86efac' };
                          case 'data-source':
                            return { bgcolor: '#faf5ff', color: '#9333ea', border: '1px solid #d8b4fe' };
                          case 'hooks':
                            return { bgcolor: '#fff7ed', color: '#ea580c', border: '1px solid #fdba74' };
                          default:
                            return { bgcolor: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' };
                        }
                      };
                      
                      const chipColor = getCategoryChipColor(config.category);
                      const isChecked = tempSelectedFilters.includes(config.variableName);
                      
                      return (
                        <MenuItem
                          key={config.variableName}
                          value={config.variableName}
                          onClick={() => handleToggleFilter(config.variableName)}
                          sx={{
                            py: 0.75,
                            '&:hover': {
                              bgcolor: '#f0f4ff',
                            },
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={isChecked}
                            sx={{ 
                              color: '#3B82F6', 
                              '&.Mui-checked': { color: '#3B82F6' },
                              p: 0.5,
                              mr: 0.5,
                            }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1, minWidth: 0 }}>
                            <Chip 
                              label={config.category} 
                              size="small"
                              sx={{ 
                                ...chipColor,
                                fontSize: '0.6rem',
                                height: 18,
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            />
                            <Typography 
                              variant="body2" 
                              fontWeight={500}
                              sx={{ 
                                flex: 1, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                                fontSize: '0.8rem',
                              }}
                            >
                              {config.displayName}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Box>

                  {/* Apply and Cancel Buttons inside dropdown */}
                  <Box 
                    sx={{ 
                      p: 1.5, 
                      pt: 1, 
                      borderTop: '2px solid #e2e8f0',
                      display: 'flex', 
                      gap: 1,
                      position: 'sticky',
                      bottom: 0,
                      bgcolor: 'white',
                      zIndex: 1,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={handleCancelFilters}
                      size="small"
                      sx={{
                        borderColor: '#cbd5e1',
                        color: '#64748b',
                        fontWeight: 600,
                        borderRadius: 1.5,
                        '&:hover': {
                          borderColor: '#94a3b8',
                          bgcolor: '#f8fafc',
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={handleApplyFilters}
                      size="small"
                      sx={{
                        bgcolor: '#3B82F6',
                        fontWeight: 600,
                        borderRadius: 1.5,
                        '&:hover': {
                          bgcolor: '#2563EB',
                        }
                      }}
                    >
                      Apply ({tempSelectedFilters.length})
                    </Button>
                  </Box>
                </Select>
              </FormControl>
            </Paper>
          )}
        </Box>

        {/* Draggable Filters Area */}
        <Box 
          sx={{ 
            flexGrow: 1,
            overflow: 'auto',
            bgcolor: '#F8FAFC',
            position: 'relative',
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(102, 126, 234, 0.3)',
              borderRadius: '10px',
              '&:hover': {
                background: 'rgba(102, 126, 234, 0.5)',
              },
            },
          }}
        >
          {activeFilterIds.length === 0 ? (
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                height: '100%',
                textAlign: 'center',
                p: 3,
              }}
            >
              <Box>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 16px',
                    borderRadius: '50%',
                    bgcolor: 'rgba(59, 130, 246, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg 
                    style={{ width: 32, height: 32, opacity: 0.6 }} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="#3B82F6"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
                  </svg>
                </Box>
                <Typography variant="body2" color="#475569" gutterBottom fontWeight={600}>
                  No filters added yet
                </Typography>
                <Typography variant="caption" color="#94a3b8">
                  Select a filter above to add
                </Typography>
              </Box>
            </Box>
          ) : (
            <Box sx={{ 
              position: 'relative', 
              width: '100%', 
              minHeight: activeFilterIds.length * 78 + 20,
              p: 1,
              pb: 3, // Extra bottom padding for last filter visibility
            }}>
              {activeFilterIds.map((filterId, index) => {
                const defaultPosition = {
                  x: 12,
                  y: 8 + (index * 78),
                };
                return (
                  <CompactFilterItem
                    key={filterId}
                    variableName={filterId}
                    onRemove={() => handleRemoveFilter(filterId)}
                    position={filterPositions[filterId] || defaultPosition}
                    onPositionChange={(pos) => handleFinalPosition(filterId, pos)}
                  />
                );
              })}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default FilterPanel;
