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
export const filterPositionsState = atom<Record<string, FilterPosition>>({
  key: 'filterPositionsState',
  default: {},
  effects: [
    ({ setSelf }) => {
      // Load filter positions from API on initialization
      axios.get('http://localhost:3002/api/filter-panel-state')
        .then(response => {
          if (response.data.success && response.data.positions) {
            setSelf(response.data.positions);
          }
        })
        .catch(error => {
          console.error('Failed to load filter positions:', error);
        });
    },
  ]
});

export const activeFilterIdsState = atom<string[]>({
  key: 'activeFilterIdsState',
  default: [],
  effects: [
    ({ setSelf }) => {
      // Load active filter IDs from API on initialization
      axios.get('http://localhost:3002/api/filter-panel-state')
        .then(response => {
          if (response.data.success && response.data.activeFilterIds) {
            setSelf(response.data.activeFilterIds);
          }
        })
        .catch(error => {
          console.error('Failed to load active filter IDs:', error);
        });
    },
  ]
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

  // Debug: Log when component mounts or edit mode changes
  useEffect(() => {
    console.log('🔍 [CompactFilterItem] Component state:', {
      variant,
      variableName,
      isEditMode,
      position: effectivePosition,
      disabled: !isEditMode,
    });
    
    // Verify drag handle exists
    if (nodeRef.current) {
      const dragHandle = (nodeRef.current as HTMLElement).querySelector('.drag-handle');
      console.log('🔍 [CompactFilterItem] Drag handle check:', {
        nodeRefExists: !!nodeRef.current,
        dragHandleExists: !!dragHandle,
        dragHandleElement: dragHandle,
      });
    }
  }, [variant, variableName, isEditMode, effectivePosition]);

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

  const handleDrag = (_e: any, data: { x: number; y: number }) => {
    if (onPositionChange && variant === 'global') {
      onPositionChange({ x: data.x, y: data.y });
    }
  };

  const handleDragStop = (_e: any, data: { x: number; y: number }) => {
    if (onPositionChange && variant === 'global') {
      onPositionChange({ x: data.x, y: data.y });
      // Save position to database
      axios.post('http://localhost:3002/api/filter-panel-state', {
        positions: { [variableName]: { x: data.x, y: data.y } }
      }).catch(err => console.error('Failed to save filter position:', err));
    }
  };

  // Inline variant - simple non-draggable filter
  if (isInlineVariant) {
    return (
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Chip 
            label={filterConfig.category}
            size="small"
            sx={{
              bgcolor: categoryColors.bg,
              color: categoryColors.text,
              border: `1px solid ${categoryColors.border}`,
              fontSize: '0.6rem',
              height: 18,
              fontWeight: 700,
            }}
          />
          <Typography variant="caption" fontWeight={600} color="#334155">
            {filterConfig.displayName}
          </Typography>
        </Box>
        
        <Box 
          onClick={handleClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 1,
            borderRadius: 1.5,
            bgcolor: 'white',
            border: '1px solid #e2e8f0',
            cursor: 'pointer',
            '&:hover': {
              borderColor: '#667eea',
              bgcolor: '#f8fafc',
            },
          }}
        >
          <Typography variant="body2" sx={{ color: selectedValues.length ? '#334155' : '#94a3b8' }}>
            {displayValue}
          </Typography>
          <KeyboardArrowDownIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
        </Box>

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
              minWidth: 200,
              maxHeight: 300,
            }
          }}
        >
          {filterConfig.selectionType === 'single' ? (
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
                    sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }}
                  />
                  <Typography variant="body2">{option.label}</Typography>
                </MenuItem>
              ))}
            </RadioGroup>
          ) : (
            <>
              <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
                <Button size="small" onClick={handleSelectAll} sx={{ fontSize: '0.7rem' }}>All</Button>
                <Button size="small" onClick={handleClearAll} sx={{ fontSize: '0.7rem' }}>None</Button>
              </Box>
              {options.map((option: DefaultValueOption) => (
                <MenuItem 
                  key={String(option.value)} 
                  onClick={() => handleToggleOption(option)}
                  sx={{ py: 0.5 }}
                >
                  <Checkbox 
                    size="small" 
                    checked={isValueSelected(option.value)}
                    sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }}
                  />
                  <Typography variant="body2">{option.label}</Typography>
                </MenuItem>
              ))}
            </>
          )}
          <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
            <Button 
              fullWidth 
              size="small" 
              variant="outlined"
              onClick={handleReset}
              sx={{ borderColor: '#cbd5e1', color: '#64748b' }}
            >
              Reset
            </Button>
            <Button 
              fullWidth 
              size="small" 
              variant="contained"
              onClick={handleApply}
              sx={{ bgcolor: '#667eea', '&:hover': { bgcolor: '#5568d3' } }}
            >
              Apply
            </Button>
          </Box>
        </Menu>
      </Box>
    );
  }

  // Global variant - draggable filter chip
  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={effectivePosition}
      onDrag={handleDrag}
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
          minWidth: 180,
          maxWidth: 280,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          transition: 'box-shadow 0.2s, border-color 0.2s',
          '&:hover': {
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            borderColor: '#667eea',
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
              '&:hover': { color: '#667eea' },
              '&:active': { cursor: 'grabbing' },
            }}
          >
            <DragIndicatorIcon sx={{ fontSize: 16 }} />
          </Box>
        )}

        {/* Filter Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
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
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
            <Typography 
              variant="caption" 
              fontWeight={600} 
              color="#334155"
              sx={{ 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap' 
              }}
            >
              {filterConfig.displayName}
            </Typography>
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
                borderColor: '#667eea',
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
              minWidth: 220,
              maxHeight: 350,
            }
          }}
        >
          {filterConfig.selectionType === 'single' ? (
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
                    sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }}
                  />
                  <Typography variant="body2">{option.label}</Typography>
                </MenuItem>
              ))}
            </RadioGroup>
          ) : (
            <>
              <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
                <Button size="small" onClick={handleSelectAll} sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Select All</Button>
                <Button size="small" onClick={handleClearAll} sx={{ fontSize: '0.7rem', textTransform: 'none' }}>Clear</Button>
              </Box>
              <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
                {options.map((option: DefaultValueOption) => (
                  <MenuItem 
                    key={String(option.value)} 
                    onClick={() => handleToggleOption(option)}
                    sx={{ py: 0.5 }}
                  >
                    <Checkbox 
                      size="small" 
                      checked={isValueSelected(option.value)}
                      sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }}
                    />
                    <Typography variant="body2">{option.label}</Typography>
                  </MenuItem>
                ))}
              </Box>
            </>
          )}
          <Box sx={{ p: 1.5, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1 }}>
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
                bgcolor: '#667eea', 
                textTransform: 'none',
                '&:hover': { bgcolor: '#5568d3' } 
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
  useEffect(() => {
    const saveState = async () => {
      try {
        await axios.post('http://localhost:3002/api/filter-panel-state', {
          activeFilterIds,
          positions: filterPositions,
        });
      } catch (err) {
        console.error('Failed to save filter panel state:', err);
      }
    };
    
    // Debounce save
    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [activeFilterIds, filterPositions]);

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

    // Set initial positions for new filters
    const newPositions = { ...filterPositions };
    let yOffset = 6 + (newActiveFilters.filter(id => filterPositions[id]).length * 80);
    
    filtersToAdd.forEach((filterId) => {
      if (!newPositions[filterId]) {
        newPositions[filterId] = {
          x: 6,
          y: yOffset,
        };
        yOffset += 80;
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

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Always render the panel (collapsed or expanded)
  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        top: topOffset,
        height: `calc(100vh - ${topOffset})`,
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
          background: 'linear-gradient(180deg, #64748b 0%, #475569 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pt: 0,
          boxShadow: '-4px 0 20px rgba(71, 85, 105, 0.2)',
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
                bgcolor: 'rgba(65, 61, 61, 0.35)',
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
              <FilterAltIcon sx={{ color: 'white', fontSize: 22 }} />
            </Badge>
            <Typography
              sx={{
                writingMode: 'vertical-lr',
                textOrientation: 'mixed',
                color: 'white',
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
          background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          borderLeft: '1px solid rgba(102, 126, 234, 0.1)',
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
        <Box sx={{ p: 2, pt: isEdit ? 2 : 2, borderBottom: isEdit ? '1px solid #e2e8f0' : 0 }}>
          <Box 
            sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white', 
              textAlign: 'center',
              py: 1.25,
              mx: -2,
              mt: -2,
              mb: isEdit ? 2 : -1.5,
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
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
                background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
                borderRadius: 2,
              }}
            >
              <FormControl fullWidth size="small">
                <InputLabel sx={{ color: '#667eea', '&.Mui-focused': { color: '#667eea' } }}>
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
                      borderColor: '#667eea',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#667eea',
                    }
                  }}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 400,
                        '& .MuiList-root': {
                          pt: 0,
                        }
                      }
                    },
                    autoFocus: false,
                  }}
                >
                  {/* Select All Option */}
                  <MenuItem
                    value="ALL"
                    onClick={() => handleToggleFilter('ALL')}
                    sx={{
                      borderBottom: '1px solid #e2e8f0',
                      bgcolor: '#f8fafc',
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
                        color: '#667eea', 
                        '&.Mui-checked': { color: '#667eea' },
                        '&.MuiCheckbox-indeterminate': { color: '#667eea' }
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip 
                        label="ALL" 
                        size="small"
                        sx={{ 
                          bgcolor: '#ede9fe',
                          color: '#7c3aed',
                          border: '1px solid #c4b5fd',
                          fontSize: '0.65rem',
                          height: 20,
                          fontWeight: 700,
                        }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        All Filters
                      </Typography>
                    </Box>
                  </MenuItem>

                  {/* Individual Filter Options */}
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
                          '&:hover': {
                            bgcolor: '#f0f4ff',
                          },
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={isChecked}
                          sx={{ 
                            color: '#667eea', 
                            '&.Mui-checked': { color: '#667eea' }
                          }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                          <Chip 
                            label={config.category} 
                            size="small"
                            sx={{ 
                              ...chipColor,
                              fontSize: '0.65rem',
                              height: 20,
                              fontWeight: 700,
                            }}
                          />
                          <Typography 
                            variant="body2" 
                            fontWeight={500}
                            sx={{ flex: 1 }}
                          >
                            {config.displayName}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}

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
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        fontWeight: 600,
                        borderRadius: 1.5,
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
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

        {/* Draggable Filters Area - Now Scrollable */}
        <Box 
          sx={{ 
            flexGrow: 1,
            overflow: 'auto',
            background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%)',
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
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <svg 
                    style={{ width: 32, height: 32, opacity: 0.6 }} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="#667eea"
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
              minHeight: '100%',
              p: 1 
            }}>
              {activeFilterIds.map((filterId) => (
                <CompactFilterItem
                  key={filterId}
                  variableName={filterId}
                  onRemove={() => handleRemoveFilter(filterId)}
                  position={filterPositions[filterId] || { x: 10, y: 10 }}
                  onPositionChange={(pos) => handlePositionChange(filterId, pos)}
                />
              ))}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default FilterPanel;
