import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilCallback } from 'recoil';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Card,
  CardContent,
  Stack,
  IconButton,
  List,
  ListItem,
  Divider,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ViewModule as ViewModuleIcon,
} from '@mui/icons-material';
import { variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { cardDimensionConditionsState,DimensionCondition } from '../recoil/Carddimensionstate ';

const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    try {
      return Function('"use strict";return (' + value + ')')();
    } catch {
      return value;
    }
  }
};

interface BooleanVariable {
  name: string;
  currentValue: boolean;
}

export function CardArrangement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [dimensionConditions, setDimensionConditions] = useRecoilState(
    cardDimensionConditionsState
  );

  const [booleanVariables, setBooleanVariables] = useState<BooleanVariable[]>([]);
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form state for new condition
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [expectedValue, setExpectedValue] = useState<boolean>(true);
  const [width, setWidth] = useState<number>(6);
  const [height, setHeight] = useState<number>(2);

  // Local conditions for this chart
  const [localConditions, setLocalConditions] = useState<DimensionCondition[]>([]);

  // Load existing conditions for this chart
  useEffect(() => {
    if (id && dimensionConditions[id]) {
      setLocalConditions(
        [...dimensionConditions[id]].sort((a, b) => a.priority - b.priority)
      );
    } else {
      setLocalConditions([]);
    }
  }, [id, dimensionConditions]);

  // Get all boolean variables using Recoil callback
  const loadBooleanVariables = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const variableNames = await snapshot.getPromise(variableNamesState);
        const boolVars: BooleanVariable[] = [];

        for (const varName of Array.from(variableNames)) {
          try {
            const rawValue = await snapshot.getPromise(variableAtomFamily(varName));
            const parsedValue = safeParse(rawValue);

            if (typeof parsedValue === 'boolean') {
              boolVars.push({
                name: varName,
                currentValue: parsedValue,
              });
            }
          } catch (e) {
            console.warn(`Could not check variable ${varName}:`, e);
          }
        }

        return boolVars;
      },
    []
  );

  // Load boolean variables on mount
  useEffect(() => {
    loadBooleanVariables().then(setBooleanVariables);
  }, [loadBooleanVariables]);

  const handleAddCondition = () => {
    if (!selectedVariable) {
      alert('Please select a boolean variable');
      return;
    }

    if (width < 1 || width > 12) {
      alert('Width must be between 1 and 12');
      return;
    }

    if (height < 1 || height > 10) {
      alert('Height must be between 1 and 10');
      return;
    }

    const newCondition: DimensionCondition = {
      id: Date.now().toString(),
      variableName: selectedVariable,
      expectedValue,
      width,
      height,
      priority: localConditions.length + 1, // Add at end
    };

    setLocalConditions([...localConditions, newCondition]);

    // Reset form
    setSelectedVariable('');
    setExpectedValue(true);
    setWidth(6);
    setHeight(2);
  };

  const handleRemoveCondition = (conditionId: string) => {
    const filtered = localConditions.filter((c) => c.id !== conditionId);
    // Reorder priorities
    const reordered = filtered.map((c, index) => ({
      ...c,
      priority: index + 1,
    }));
    setLocalConditions(reordered);
  };

  const handleMovePriority = (conditionId: string, direction: 'up' | 'down') => {
    const index = localConditions.findIndex((c) => c.id === conditionId);
    if (index === -1) return;

    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localConditions.length - 1) return;

    const newConditions = [...localConditions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Swap
    [newConditions[index], newConditions[targetIndex]] = [
      newConditions[targetIndex],
      newConditions[index],
    ];

    // Reorder priorities
    const reordered = newConditions.map((c, idx) => ({
      ...c,
      priority: idx + 1,
    }));

    setLocalConditions(reordered);
  };

  const handleSave = () => {
    if (!id) {
      alert('No chart ID found');
      return;
    }

    setDimensionConditions({
      ...dimensionConditions,
      [id]: localConditions,
    });

    setSuccessMessage('Dimension conditions saved successfully!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleClearAll = () => {
    if (!id) return;

    const updated = { ...dimensionConditions };
    delete updated[id];
    setDimensionConditions(updated);
    setLocalConditions([]);
    setSuccessMessage('All dimension conditions cleared!');
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <Box sx={{bgcolor: 'grey.50' }}>
      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 4, mb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <ViewModuleIcon sx={{ mr: 2, color: 'primary.main', fontSize: 40 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={600}>
              Card Dimension Control
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Chart ID: <Chip label={id || 'Not specified'} size="small" color="primary" />
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight={600} gutterBottom>
            📐 How it works:
          </Typography>
          <Typography variant="body2" component="div">
            • Add conditions with boolean variables to dynamically change card size
            <br />
            • When a variable matches the expected value → Card resizes to specified
            dimensions
            <br />
            • Conditions are evaluated by priority (top to bottom)
            <br />• First matching condition wins (lower priority conditions are ignored)
          </Typography>
        </Alert>

        {/* Add Condition Form */}
        <Paper
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'primary.50',
            border: 1,
            borderColor: 'primary.light',
          }}
        >
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Add New Dimension Condition
          </Typography>

          {booleanVariables.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No boolean variables found. Create boolean variables in the Hooks section first.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {/* Variable Selection */}
              <FormControl fullWidth>
                <InputLabel>Boolean Variable</InputLabel>
                <Select
                  value={selectedVariable}
                  label="Boolean Variable"
                  onChange={(e) => setSelectedVariable(e.target.value)}
                  sx={{ bgcolor: 'white' }}
                >
                  {booleanVariables.map((variable) => (
                    <MenuItem key={variable.name} value={variable.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <Typography sx={{ flex: 1 }}>{variable.name}</Typography>
                        <Chip
                          label={variable.currentValue ? 'true' : 'false'}
                          size="small"
                          color={variable.currentValue ? 'success' : 'default'}
                          icon={
                            variable.currentValue ? <CheckCircleIcon /> : <CancelIcon />
                          }
                        />
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Expected Value */}
              <FormControl fullWidth>
                <InputLabel>When Variable Equals</InputLabel>
                <Select
                  value={expectedValue ? 'true' : 'false'}
                  label="When Variable Equals"
                  onChange={(e) => setExpectedValue(e.target.value === 'true')}
                  sx={{ bgcolor: 'white' }}
                >
                  <MenuItem value="true">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography>True</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem value="false">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CancelIcon color="disabled" fontSize="small" />
                      <Typography>False</Typography>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>

              {/* Width & Height */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Width (Grid Columns)"
                  value={width}
                  onChange={(e) => setWidth(parseInt(e.target.value) || 6)}
                  inputProps={{ min: 1, max: 12 }}
                  sx={{ bgcolor: 'white' }}
                  helperText="1-12 columns"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Height (Grid Rows)"
                  value={height}
                  onChange={(e) => setHeight(parseInt(e.target.value) || 2)}
                  inputProps={{ min: 1, max: 10 }}
                  sx={{ bgcolor: 'white' }}
                  helperText="1-10 rows"
                />
              </Box>

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleAddCondition}
                disabled={!selectedVariable}
                fullWidth
              >
                Add Condition
              </Button>
            </Stack>
          )}
        </Paper>

        {/* Current Conditions with Priority */}
        <Paper sx={{ mb: 3 }}>
          <Box
            sx={{
              p: 2,
              bgcolor: 'grey.100',
              borderBottom: 1,
              borderColor: 'divider',
            }}
          >
            <Typography variant="h6" fontWeight={600}>
              Dimension Conditions ({localConditions.length})
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Higher priority conditions are checked first. First match wins.
            </Typography>
          </Box>

          {localConditions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No dimension conditions defined. Card will use default layout size.
              </Typography>
            </Box>
          ) : (
            <List>
              {localConditions.map((condition, index) => (
                <ListItem
                  key={condition.id}
                  divider={index < localConditions.length - 1}
                  sx={{ py: 2 }}
                >
                  <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 2 }}>
                    {/* Priority Badge */}
                    <Chip
                      label={`P${condition.priority}`}
                      color="primary"
                      size="small"
                      sx={{ fontWeight: 700, minWidth: 45 }}
                    />

                    {/* Condition Details */}
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" fontWeight={600}>
                          When
                        </Typography>
                        <Chip label={condition.variableName} size="small" color="info" />
                        <Typography variant="body2" fontWeight={600}>
                          =
                        </Typography>
                        <Chip
                          label={condition.expectedValue ? 'true' : 'false'}
                          size="small"
                          color={condition.expectedValue ? 'success' : 'default'}
                          icon={
                            condition.expectedValue ? (
                              <CheckCircleIcon />
                            ) : (
                              <CancelIcon />
                            )
                          }
                        />
                        <Typography variant="body2" fontWeight={600}>
                          →
                        </Typography>
                        <Chip
                          label={`W: ${condition.width}`}
                          size="small"
                          variant="outlined"
                        />
                        <Chip
                          label={`H: ${condition.height}`}
                          size="small"
                          variant="outlined"
                        />
                      </Stack>
                    </Box>

                    {/* Priority Controls */}
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="Increase Priority (Move Up)">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMovePriority(condition.id, 'up')}
                            disabled={index === 0}
                            color="primary"
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Decrease Priority (Move Down)">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleMovePriority(condition.id, 'down')}
                            disabled={index === localConditions.length - 1}
                            color="primary"
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete Condition">
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveCondition(condition.id)}
                          color="error"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Box>
                </ListItem>
              ))}
            </List>
          )}
        </Paper>

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
          >
            Save Dimension Conditions
          </Button>
          {localConditions.length > 0 && (
            <Button
              variant="outlined"
              color="error"
              size="large"
              startIcon={<ClearIcon />}
              onClick={handleClearAll}
            >
              Clear All
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Documentation */}
      <Paper elevation={1} sx={{ p: 4, bgcolor: 'grey.50' }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          📚 Examples
        </Typography>

        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="primary.main"
              gutterBottom
            >
              Example 1: Make chart full-width when specific metric selected
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'white' }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{ fontFamily: 'monospace', m: 0 }}
              >
{`Variable: isFullWidthMetric = (param_metric === "REVENUE")
When: isFullWidthMetric = true
Dimensions: Width = 12, Height = 3
Result: Chart becomes full-width when REVENUE is selected`}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Typography
              variant="subtitle2"
              fontWeight={600}
              color="primary.main"
              gutterBottom
            >
              Example 2: Multiple size variations with priority
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'white' }}>
              <Typography
                variant="body2"
                component="pre"
                sx={{ fontFamily: 'monospace', m: 0 }}
              >
{`Priority 1: isDetailView = true → Width: 12, Height: 4
Priority 2: isCompactView = true → Width: 4, Height: 2

If isDetailView is true, uses 12x4 (ignores Priority 2)
If only isCompactView is true, uses 4x2`}
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}