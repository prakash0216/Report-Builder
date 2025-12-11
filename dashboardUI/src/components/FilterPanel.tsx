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
} from '@mui/material';
import { 
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
} from '@mui/icons-material';
import Draggable from 'react-draggable';
import { allFiltersSelector, filterNamesState, filterConfigFamily } from "../recoil/FiltersFamily";
import { liveFilterFamily } from "../recoil/LiveFilterFamily";
import { atom } from 'recoil';
import { IsEditModeState } from "../recoil/IsEditeMode";

interface FilterPanelProps {
  showFilters: boolean;
  topOffset?: string;
}

interface FilterPosition {
  x: number;
  y: number;
}

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

  const selectedValues = tempValue || [];
  const options = filterConfig.availableOptions || [];

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

  const handleCancel = () => {
    setTempValue(liveValue || []);
    handleClose();
  };

  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'params':
        return { bgcolor: '#f0fdf4', color: '#16a34a', borderColor: '#4ade80' };
      case 'data-source':
        return { bgcolor: '#faf5ff', color: '#9333ea', borderColor: '#c084fc' };
      case 'hooks':
        return { bgcolor: '#fff7ed', color: '#ea580c', borderColor: '#fb923c' };
      default:
        return { bgcolor: '#f8fafc', color: '#64748b', borderColor: '#cbd5e1' };
    }
  };

  const categoryColor = getCategoryColor(filterConfig.category);

  // Format display text
  const getDisplayText = () => {
    if (selectedValues.length === 0) return '(All)';
    if (selectedValues.length === options.length) return '(All)';
    if (selectedValues.length === 1) return selectedValues[0].label;
    return `${selectedValues.length} selected`;
  };

  // Single selection (Radio)
  const renderSingleSelect = () => {
    const selectedValue = selectedValues.length > 0 ? selectedValues[0].value : '';

    const handleChange = (option: any) => {
      setTempValue([option]);
    };

    return (
      <Box sx={{ width: 280, maxHeight: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ flexGrow: 1, overflow: 'auto', px: 1.5, py: 1, maxHeight: 'calc(400px - 60px)' }}>
          <RadioGroup value={selectedValue}>
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={<Radio size="small" sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }} />}
                label={
                  <Typography 
                    variant="body2"
                    sx={{ 
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%',
                    }}
                    title={option.label}
                  >
                    {option.label}
                  </Typography>
                }
                onChange={() => handleChange(option)}
                sx={{ 
                  py: 0.25,
                  mr: 0,
                  width: '100%',
                  '&:hover': { bgcolor: '#f0f4ff' },
                  borderRadius: 1,
                  '& .MuiFormControlLabel-label': {
                    width: 'calc(100% - 32px)',
                    overflow: 'hidden',
                  }
                }}
              />
            ))}
          </RadioGroup>
        </Box>
        <Box sx={{ p: 1.5, pt: 1, borderTop: 1, borderColor: '#e2e8f0', display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            fullWidth
            onClick={handleCancel}
            sx={{
              borderColor: '#cbd5e1',
              color: '#64748b',
              '&:hover': {
                borderColor: '#94a3b8',
                bgcolor: '#f8fafc',
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            fullWidth
            onClick={handleApply}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
              }
            }}
          >
            Apply
          </Button>
        </Box>
      </Box>
    );
  };

  // Multi selection (Checkboxes)
  const renderMultiSelect = () => {
    const handleToggle = (option: any) => {
      const isSelected = selectedValues.some((v: any) => v.value === option.value);
      if (isSelected) {
        setTempValue(selectedValues.filter((v: any) => v.value !== option.value));
      } else {
        setTempValue([...selectedValues, option]);
      }
    };

    const handleSelectAll = () => {
      if (selectedValues.length === options.length) {
        setTempValue([]);
      } else {
        setTempValue(options);
      }
    };

    const allSelected = selectedValues.length === options.length;
    const someSelected = selectedValues.length > 0 && selectedValues.length < options.length;

    return (
      <Box sx={{ width: 280, maxHeight: 400, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Select All Checkbox Header */}
        <Box sx={{ 
          px: 1.5, 
          py: 0.75, 
          borderBottom: 1, 
          borderColor: '#e2e8f0',
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
        }}>
          <FormControlLabel
            control={
              <Checkbox 
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
                sx={{ 
                  color: '#667eea', 
                  '&.Mui-checked': { color: '#667eea' },
                  '&.MuiCheckbox-indeterminate': { color: '#667eea' }
                }}
              />
            }
            label={<Typography variant="body2" fontWeight="600">(All)</Typography>}
            sx={{ 
              mr: 0,
              width: '100%',
              '& .MuiFormControlLabel-label': {
                width: '100%',
              }
            }}
          />
        </Box>

        {/* Scrollable Options */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', px: 1.5, py: 1, maxHeight: 'calc(400px - 100px)' }}>
          <FormGroup sx={{ width: '100%' }}>
            {options.map((option) => {
              const isSelected = selectedValues.some((v: any) => v.value === option.value);
              return (
                <FormControlLabel
                  key={option.value}
                  control={
                    <Checkbox 
                      size="small"
                      checked={isSelected}
                      onChange={() => handleToggle(option)}
                      sx={{ 
                        color: '#667eea', 
                        '&.Mui-checked': { color: '#667eea' }
                      }}
                    />
                  }
                  label={
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        width: '100%',
                      }}
                      title={option.label}
                    >
                      {option.label}
                    </Typography>
                  }
                  sx={{ 
                    py: 0.25,
                    mr: 0,
                    width: '100%',
                    '&:hover': { bgcolor: '#f0f4ff' },
                    borderRadius: 1,
                    '& .MuiFormControlLabel-label': {
                      width: 'calc(100% - 32px)',
                      overflow: 'hidden',
                    }
                  }}
                />
              );
            })}
          </FormGroup>
        </Box>
        
        {/* Apply/Cancel Buttons */}
        <Box sx={{ p: 1.5, pt: 1, borderTop: 1, borderColor: '#e2e8f0', display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            fullWidth
            onClick={handleCancel}
            sx={{
              borderColor: '#cbd5e1',
              color: '#64748b',
              '&:hover': {
                borderColor: '#94a3b8',
                bgcolor: '#f8fafc',
              }
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            fullWidth
            onClick={handleApply}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
              }
            }}
          >
            Apply
          </Button>
        </Box>
      </Box>
    );
  };

  const filterCard = (
    <Paper
      ref={nodeRef}
      className="local-filter-card"
      elevation={0}
      sx={{
        position: isInlineVariant && !position ? 'relative' : 'absolute', // Relative if inline and no saved position (flexbox), otherwise absolute
        width: 280,
        maxWidth: '100%', // Ensure it doesn't exceed container width
        flexShrink: 0, // Don't shrink in flexbox
        background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(102, 126, 234, 0.2)',
        borderRadius: 2,
        overflow: 'hidden',
        boxShadow: isInlineVariant ? '0 6px 20px rgba(102, 126, 234, 0.12)' : '0 8px 32px rgba(102, 126, 234, 0.15)',
        touchAction: 'none', // Prevent touch scrolling on mobile
        pointerEvents: 'auto', // Ensure pointer events work
        boxSizing: 'border-box', // Include border in width
      }}
      onMouseDown={(e) => {
        // Only prevent grid drag if NOT clicking on drag handle
        const isDragHandle = !!(e.target as HTMLElement)?.closest('.drag-handle');
        console.log('🖱️ [CompactFilterItem] MouseDown on Paper:', {
          variant,
          variableName,
          target: (e.target as HTMLElement)?.className,
          isDragHandle,
        });
        // If clicking on drag handle, let react-draggable handle it
        // Otherwise, prevent grid drag
        if (!isDragHandle) {
          e.stopPropagation();
        }
      }}
    >
      {/* Header with drag handle (shown for both inline and global; drag active in edit mode) */}
      <Box
        className="drag-handle"
        data-draggable-handle="true"
        sx={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderBottom: '1px solid #e2e8f0',
          px: 1,
          py: 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isEditMode ? 'move' : 'default', // always show move cursor in edit mode
          userSelect: 'none', // Prevent text selection during drag
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          position: 'relative',
          zIndex: 10, // Ensure drag handle is above other elements
          pointerEvents: 'auto', // Ensure pointer events work
          '&:hover': {
            background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
          },
        }}
        onMouseDown={(e) => {
          console.log('🖱️ [CompactFilterItem] MouseDown on drag-handle:', {
            variant,
            variableName,
            isEditMode,
            target: (e.target as HTMLElement)?.className,
            currentTarget: (e.currentTarget as HTMLElement)?.className,
            nodeRef: !!nodeRef.current,
          });
          // CRITICAL: Don't stop propagation here - let react-draggable handle it first
          // The grid's draggableCancel will prevent grid drag, and react-draggable needs the event
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          {/* Always show drag indicator in edit mode for visual cue */}
          {isEditMode && <DragIndicatorIcon sx={{ fontSize: 16, mr: 0.5, color: '#667eea' }} />}
          <Typography 
            variant="caption" 
            fontWeight="700" 
            noWrap 
            sx={{ 
              flex: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {filterConfig.displayName}
          </Typography>
        </Box>
        {isEditMode && (
          <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            p: 0.25,
            ml: 0.5,
            color: '#64748b',
            '&:hover': {
              bgcolor: '#fee2e2',
              color: '#dc2626',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
        )}
      </Box>

      {/* Dropdown selector */}
      <Box
        onClick={handleClick}
        sx={{
          px: 1.5,
          py: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          bgcolor: 'white',
          '&:hover': {
            bgcolor: '#f8fafc',
          },
          borderLeft: 3,
          borderColor: categoryColor.borderColor,
        }}
      >
        <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1, fontWeight: 500 }}>
          {getDisplayText()}
        </Typography>
        <KeyboardArrowDownIcon 
          sx={{ 
            fontSize: 18, 
            color: '#667eea',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s',
          }} 
        />
      </Box>

      {/* Dropdown Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        disableAutoFocusItem
        PaperProps={{
          sx: {
            mt: 0.5,
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)',
            maxHeight: 400,
            overflow: 'hidden',
            width: 280,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(102, 126, 234, 0.1)',
            borderRadius: 2,
          },
        }}
        MenuListProps={{
          sx: { p: 0, width: '100%' },
        }}
      >
        {filterConfig.selectionType === 'single' ? renderSingleSelect() : renderMultiSelect()}
      </Menu>
    </Paper>
  );

  // For inline variant: use flexbox layout initially, but allow dragging to reposition
  // Once dragged, switch to absolute positioning
  // For global variant: always use absolute positioning with dragging
  
  // Inline variant: allow dragging even if no saved position (uses defaultPosition)
  // Global variant: controlled position
  const shouldDisableDrag = !isEditMode;
  const draggablePosition = position ? effectivePosition : undefined; // uncontrolled when no saved position
  const draggableDefault = position ? effectivePosition : { x: 0, y: 0 };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={draggablePosition}
      defaultPosition={draggableDefault}
      onStart={(e, data) => {
        console.log('🎯 [CompactFilterItem] Drag START:', {
          variant,
          variableName,
          isEditMode,
          position: effectivePosition,
          dataX: data.x,
          dataY: data.y,
          eventType: e?.type,
          target: (e?.target as HTMLElement)?.className,
          disabled: shouldDisableDrag,
        });
        // prevent parent chart/card drag when moving inline filter
        if (e && typeof e.stopPropagation === 'function') {
          e.stopPropagation();
        }
        // DO NOT call preventDefault() here - let react-draggable handle it
      }}
      onDrag={(e, data) => {
        console.log('🔄 [CompactFilterItem] Drag MOVE:', {
          variant,
          variableName,
          x: data.x,
          y: data.y,
        });
        onPositionChange?.({ x: data.x, y: data.y });
      }}
      onStop={(e, data) => {
        console.log('✅ [CompactFilterItem] Drag STOP:', {
          variant,
          variableName,
          finalX: data.x,
          finalY: data.y,
        });
        onPositionChange?.({ x: data.x, y: data.y });
      }}
      bounds="parent"
      disabled={shouldDisableDrag}
      cancel=".MuiMenu-root, .MuiMenu-paper, .MuiButton-root, .MuiIconButton-root"
    >
      {filterCard}
    </Draggable>
  );
};

// Main FilterPanel
const FilterPanel: React.FC<FilterPanelProps> = ({ 
  showFilters, 
  topOffset = '80px'
}) => {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [tempSelectedFilters, setTempSelectedFilters] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeFilterIds, setActiveFilterIds] = useRecoilState(activeFilterIdsState);
  const [filterPositions, setFilterPositions] = useRecoilState(filterPositionsState);
  
  const allFilters = useRecoilValue(allFiltersSelector);
  const filterNames = useRecoilValue(filterNamesState);

  const isEdit=useRecoilValue(IsEditModeState);

  // Save filter panel state to API when it changes (debounced)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(true);
  const lastSavedRef = useRef<string>('');
  
  useEffect(() => {
    // Skip initial load
    if (initialLoadRef.current) {
      // Mark as initialized after a short delay
      setTimeout(() => {
        initialLoadRef.current = false;
        // Store initial state to compare against
        lastSavedRef.current = JSON.stringify({ filterPositions, activeFilterIds });
      }, 1000);
      return;
    }

    // Check if data actually changed
    const currentState = JSON.stringify({ filterPositions, activeFilterIds });
    if (currentState === lastSavedRef.current) {
      return; // No change, skip save
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(async () => {
      const stateToSave = JSON.stringify({ filterPositions, activeFilterIds });
      if (stateToSave === lastSavedRef.current) {
        return; // Double-check before saving
      }
      
      try {
        await axios.post('http://localhost:3002/api/filter-panel-state', {
          positions: filterPositions,
          activeFilterIds: activeFilterIds,
        });
        lastSavedRef.current = stateToSave;
      } catch (error: any) {
        // Only log if it's a real error, not a queued save
        if (error?.response?.status >= 500) {
          console.warn('Filter panel save warning:', error.message);
        }
      }
    }, 800); // Increased debounce to 800ms

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filterPositions, activeFilterIds]);

  // Get all available filters sorted by category
  const availableFilters = filterNames
    .map(name => allFilters[name])
    .filter(config => config)
    .sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return a.displayName.localeCompare(b.displayName);
    });

  const handleToggleFilter = (filterName: string) => {
    if (filterName === 'ALL') {
      // Toggle all filters
      if (tempSelectedFilters.length === filterNames.length) {
        setTempSelectedFilters([]);
      } else {
        setTempSelectedFilters(filterNames);
      }
    } else {
      // Toggle individual filter
      if (tempSelectedFilters.includes(filterName)) {
        setTempSelectedFilters(tempSelectedFilters.filter(f => f !== filterName));
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

  if (!showFilters) return null;

  return (
    <Paper 
      elevation={0}
      sx={{
        position: 'fixed',
        right: 0,
        top: topOffset,
        height: `calc(100vh - ${topOffset})`,
        width: 320,
        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.98) 0%, rgba(241, 245, 249, 0.95) 100%)',
        backdropFilter: 'blur(10px)',
        borderLeft: '1px solid rgba(102, 126, 234, 0.2)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s',
        transform: showFilters ? 'translateX(0)' : 'translateX(100%)',
        zIndex: 30,
        overflow: 'hidden',
        padding: 0.5,
        paddingBottom:8
      }}
    >
      {/* Header Section */}
      <Box sx={{ p: 2, pt:isEdit?7:3, borderBottom: isEdit? '1px solid #e2e8f0' : 0 }}>
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
            FILTERS
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
            minHeight: '100%', // Changed from height to minHeight
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
    </Paper>
  );
};

export default FilterPanel;