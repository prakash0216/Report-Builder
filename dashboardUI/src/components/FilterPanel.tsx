import { useState, useEffect, useRef } from "react";
import { useRecoilValue, useRecoilState } from 'recoil';
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
});

export const activeFilterIdsState = atom<string[]>({
  key: 'activeFilterIdsState',
  default: [],
});

// Compact Filter Item with Dropdown
const CompactFilterItem: React.FC<{ 
  variableName: string; 
  onRemove: () => void;
  position: FilterPosition;
  onPositionChange: (pos: FilterPosition) => void;
}> = ({ variableName, onRemove, position, onPositionChange }) => {
  const filterConfig = useRecoilValue(filterConfigFamily(variableName));
  const [liveValue, setLiveValue] = useRecoilState(liveFilterFamily(variableName));
  const [tempValue, setTempValue] = useState<any[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const nodeRef = useRef(null);

  const isOpen = Boolean(anchorEl);

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
        return { bgcolor: '#e8f5e9', color: '#2e7d32', borderColor: '#4caf50' };
      case 'data-source':
        return { bgcolor: '#f3e5f5', color: '#9c27b0', borderColor: '#ab47bc' };
      case 'hooks':
        return { bgcolor: '#fff3e0', color: '#ed6c02', borderColor: '#ff9800' };
      default:
        return { bgcolor: '#f5f5f5', color: '#616161', borderColor: '#9e9e9e' };
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
                control={<Radio size="small" />}
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
                  '&:hover': { bgcolor: 'action.hover' },
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
        <Box sx={{ p: 1.5, pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            fullWidth
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            fullWidth
            onClick={handleApply}
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
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}>
          <FormControlLabel
            control={
              <Checkbox 
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={handleSelectAll}
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
                    '&:hover': { bgcolor: 'action.hover' },
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
        <Box sx={{ p: 1.5, pt: 1, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            fullWidth
            onClick={handleCancel}
          >
            Cancel
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            fullWidth
            onClick={handleApply}
          >
            Apply
          </Button>
        </Box>
      </Box>
    );
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      handle=".drag-handle"
      position={position}
      onStop={(e, data) => {
        onPositionChange({ x: data.x, y: data.y });
      }}
      bounds="parent"
    >
      <Paper
        ref={nodeRef}
        elevation={2}
        sx={{
          position: 'absolute',
          width: 280, // Match the width of the add filter section
          bgcolor: 'white',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        {/* Header with drag handle */}
        <Box
          className="drag-handle"
          sx={{
            bgcolor: '#f5f5f5',
            borderBottom: 1,
            borderColor: 'divider',
            px: 1,
            py: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'move',
            '&:hover': {
              bgcolor: '#eeeeee',
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <DragIndicatorIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
            <Typography variant="caption" fontWeight="600" noWrap sx={{ flex: 1 }}>
              {filterConfig.displayName}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            sx={{
              p: 0.25,
              ml: 0.5,
              '&:hover': {
                bgcolor: 'error.light',
                color: 'error.main',
              },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
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
              bgcolor: 'action.hover',
            },
            borderLeft: 3,
            borderColor: categoryColor.borderColor,
          }}
        >
          <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>
            {getDisplayText()}
          </Typography>
          <KeyboardArrowDownIcon 
            sx={{ 
              fontSize: 18, 
              color: 'text.secondary',
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
              boxShadow: 3,
              maxHeight: 400,
              overflow: 'hidden',
              width: 280,
            },
          }}
          MenuListProps={{
            sx: { p: 0, width: '100%' },
          }}
        >
          {filterConfig.selectionType === 'single' ? renderSingleSelect() : renderMultiSelect()}
        </Menu>
      </Paper>
    </Draggable>
  );
};

// Main FilterPanel
const FilterPanel: React.FC<FilterPanelProps> = ({ 
  showFilters, 
  topOffset = '80px'
}) => {
  const [selectedFilter, setSelectedFilter] = useState<string>("");
  const [activeFilterIds, setActiveFilterIds] = useRecoilState(activeFilterIdsState);
  const [filterPositions, setFilterPositions] = useRecoilState(filterPositionsState);
  
  const allFilters = useRecoilValue(allFiltersSelector);
  const filterNames = useRecoilValue(filterNamesState);

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

  const handleAddFilter = () => {
    if (!selectedFilter) return;

    // Check if filter already exists
    if (activeFilterIds.includes(selectedFilter)) {
      alert('This filter is already added!');
      return;
    }

    // Add to active filters
    setActiveFilterIds([...activeFilterIds, selectedFilter]);

    // Set initial position (stagger vertically)
    if (!filterPositions[selectedFilter]) {
      setFilterPositions({
        ...filterPositions,
        [selectedFilter]: {
          x: 10,
          y: 10 + (activeFilterIds.length * 80),
        },
      });
    }

    setSelectedFilter("");
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
      elevation={3}
      sx={{
        position: 'fixed',
        right: 0,
        top: topOffset,
        height: `calc(100vh - ${topOffset})`,
        width: 320,
        borderLeft: 1,
        borderColor: 'divider',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.3s',
        transform: showFilters ? 'translateX(0)' : 'translateX(100%)',
        zIndex: 30,
        overflow: 'hidden',
        padding: 0.5,
      }}
    >
      {/* Header Section */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
        <Box 
          sx={{ 
            bgcolor: 'primary.main', 
            color: 'white', 
            textAlign: 'center', 
            py: 1,
            mx: -2,
            mt: -2,
            mb: 2,
          }}
        >
          <Typography variant="subtitle2" fontWeight="600">
            Filters
          </Typography>
        </Box>

        {/* Filter Selector */}
        <Paper sx={{ p: 2, bgcolor: '#e3f2fd', border: 1, borderColor: 'primary.light' }}>
          <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
            <InputLabel>Add Filter</InputLabel>
            <Select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              label="Add Filter"
              sx={{ bgcolor: 'white' }}
              renderValue={(selected) => {
                if (!selected) return <em>-- Select a filter --</em>;
                const config = allFilters[selected];
                return config?.displayName || selected;
              }}
            >
              <MenuItem value="">
                <em>-- Select a filter --</em>
              </MenuItem>
              {availableFilters.map((config) => {
                const getCategoryChipColor = (category: string) => {
                  switch (category.toLowerCase()) {
                    case 'params':
                      return { bgcolor: '#e8f5e9', color: '#2e7d32' };
                    case 'data-source':
                      return { bgcolor: '#f3e5f5', color: '#9c27b0' };
                    case 'hooks':
                      return { bgcolor: '#fff3e0', color: '#ed6c02' };
                    default:
                      return { bgcolor: '#f5f5f5', color: '#616161' };
                  }
                };
                
                return (
                  <MenuItem key={config.variableName} value={config.variableName}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Chip 
                        label={config.category} 
                        size="small"
                        sx={{ 
                          ...getCategoryChipColor(config.category),
                          fontSize: '0.65rem',
                          height: 20,
                          fontWeight: 600,
                        }}
                      />
                      <Typography variant="body2">
                        {config.displayName}
                      </Typography>
                    </Box>
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
          
          <Button
            fullWidth
            variant="contained"
            onClick={handleAddFilter}
            disabled={!selectedFilter}
            size="small"
          >
            Add Filter
          </Button>
        </Paper>
      </Box>

      {/* Draggable Filters Area */}
      <Box 
        sx={{ 
          flexGrow: 1,
          overflow: 'hidden',
          bgcolor: 'grey.50',
          position: 'relative',
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
              <svg 
                style={{ width: 48, height: 48, margin: '0 auto 8px', opacity: 0.4 }} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
              </svg>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No filters added yet
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Select a filter above to add
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ position: 'relative', width: '100%', height: '100%', p: 1 }}>
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

      {/* Instructions Footer */}
      <Box 
        sx={{ 
          p: 1.5, 
          bgcolor: '#fff3e0', 
          borderTop: 1, 
          borderColor: 'warning.light' 
        }}
      >
        <Typography variant="caption" fontWeight="600" color="warning.dark" display="block" mb={0.5}>
          💡 Tips
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2, fontSize: '0.7rem', color: 'warning.dark' }}>
          <li>Drag filters by header</li>
          <li>Click to open dropdown menu</li>
          <li>Apply changes with Apply button</li>
        </Box>
      </Box>
    </Paper>
  );
};

export default FilterPanel;