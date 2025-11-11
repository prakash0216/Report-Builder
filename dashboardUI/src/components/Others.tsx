import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue } from 'recoil';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  Chip,
  IconButton,
  List,
  ListItem,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  Save as SaveIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { filterNamesState } from '../recoil/FiltersFamily';
import {
  chartVisibilityConditionsState,
  ChartVisibilityCondition,
} from '../recoil/DashboardVisibility';

export function Others() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const filterNames = useRecoilValue(filterNamesState);
  
  const [allConditions, setAllConditions] = useRecoilState(chartVisibilityConditionsState);
  
  const [selectedFilter, setSelectedFilter] = useState<string>('');
  const [filterValue, setFilterValue] = useState<string>('');
  const [localConditions, setLocalConditions] = useState<ChartVisibilityCondition[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Load existing conditions for this chart
  useEffect(() => {
    if (id && allConditions[id]) {
      setLocalConditions(allConditions[id]);
    } else {
      setLocalConditions([]);
    }
  }, [id, allConditions]);

  const handleAddCondition = () => {
    if (!selectedFilter || !filterValue.trim()) {
      alert('Please select a filter and enter a value');
      return;
    }

    const newCondition: ChartVisibilityCondition = {
      filterName: selectedFilter,
      filterValue: filterValue.trim(),
    };

    setLocalConditions([...localConditions, newCondition]);
    setSelectedFilter('');
    setFilterValue('');
  };

  const handleRemoveCondition = (index: number) => {
    setLocalConditions(localConditions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!id) {
      alert('No chart ID found');
      return;
    }

    setAllConditions({
      ...allConditions,
      [id]: localConditions,
    });

    setSuccessMessage('Visibility rules saved successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleClearAll = () => {
    if (!id) return;
    
    const updated = { ...allConditions };
    delete updated[id];
    setAllConditions(updated);
    setLocalConditions([]);
    setSuccessMessage('All conditions cleared!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', bgcolor: 'grey.50' }}>
      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <VisibilityIcon sx={{ mr: 2, color: 'primary.main', fontSize: 32 }} />
          <Box>
            <Typography variant="h5" fontWeight={600}>
              Chart Visibility Control
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Chart ID: <strong>{id || 'Not specified'}</strong>
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            How it works:
          </Typography>
          <Typography variant="body2">
            • Add conditions to hide this chart when specific filter values are selected
            <br />
            • Example: Hide when <code>param_metric = "MOP"</code>
            <br />
            • If ANY condition matches → Chart will be HIDDEN
            <br />
            • If NO conditions match → Chart will be VISIBLE
          </Typography>
        </Alert>

        {/* Add Condition Form */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.50', border: 1, borderColor: 'primary.light' }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Add New Condition
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Select Filter</InputLabel>
              <Select
                value={selectedFilter}
                label="Select Filter"
                onChange={(e) => setSelectedFilter(e.target.value)}
                sx={{ bgcolor: 'white' }}
              >
                {filterNames.map((filter: string) => (
                  <MenuItem key={filter} value={filter}>
                    {filter}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Filter Value"
              placeholder='e.g., "MOP"'
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              sx={{ bgcolor: 'white' }}
              helperText="Enter the exact value that should trigger hiding"
            />
          </Box>

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddCondition}
            disabled={!selectedFilter || !filterValue.trim()}
            fullWidth
          >
            Add Condition
          </Button>
        </Paper>

        {/* Current Conditions */}
        <Paper sx={{ mb: 3 }}>
          <Box sx={{ p: 2, bgcolor: 'grey.100', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" fontWeight={600}>
              Active Conditions ({localConditions.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Chart will be HIDDEN when ANY of these conditions match
            </Typography>
          </Box>

          {localConditions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No conditions defined. Chart will always be visible.
              </Typography>
            </Box>
          ) : (
            <List>
              {localConditions.map((condition, index) => (
                <ListItem
                  key={index}
                  secondaryAction={
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveCondition(index)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  }
                  divider={index < localConditions.length - 1}
                >
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                    <Chip label={condition.filterName} color="primary" size="small" />
                    <Typography variant="body2" fontWeight={600}>==</Typography>
                    <Chip label={`"${condition.filterValue}"`} color="success" size="small" />
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                      Hide when {condition.filterName} equals "{condition.filterValue}"
                    </Typography>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
          >
            Save Visibility Rules
          </Button>
          {localConditions.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="large"
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
        </Box>
      </Paper>

      {/* Documentation */}
      <Paper elevation={1} sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Examples
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          Example 1: Hide when MOP is selected
        </Typography>
        <Box sx={{ pl: 2, mb: 2 }}>
          <Typography variant="body2">
            Filter: <code>param_metric</code> | Value: <code>MOP</code>
            <br />
            <em>Chart will hide when user selects MOP in the metric filter</em>
          </Typography>
        </Box>

        <Typography variant="subtitle2" gutterBottom>
          Example 2: Hide for multiple values
        </Typography>
        <Box sx={{ pl: 2 }}>
          <Typography variant="body2">
            Condition 1: <code>param_metric == "MOP"</code>
            <br />
            Condition 2: <code>param_metric == "PAYER_NAME"</code>
            <br />
            <em>Chart will hide when user selects either MOP or PAYER_NAME</em>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}