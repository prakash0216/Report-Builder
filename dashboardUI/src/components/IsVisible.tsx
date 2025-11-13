import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useRecoilCallback } from 'recoil';
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
  Divider,
  Card,
  CardContent,
  Stack,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { variableNamesState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { chartVisibilityVariableState } from '../recoil/DashboardVisibility';

// Helper to safely parse variable values
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

export function IsVisible() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const variableNames = useRecoilValue(variableNamesState);
  const [visibilityVariables, setVisibilityVariables] = useRecoilState(chartVisibilityVariableState);
  
  const [selectedVariable, setSelectedVariable] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [booleanVariables, setBooleanVariables] = useState<BooleanVariable[]>([]);

  // Load existing variable for this chart
  useEffect(() => {
    if (id && visibilityVariables[id]) {
      setSelectedVariable(visibilityVariables[id]);
    } else {
      setSelectedVariable('');
    }
  }, [id, visibilityVariables]);

  // Get all boolean variables using Recoil callback
  const loadBooleanVariables = useRecoilCallback(
    ({ snapshot }) => async () => {
      const boolVars: BooleanVariable[] = [];
      
      for (const varName of Array.from(variableNames)) {
        try {
          const rawValue = await snapshot.getPromise(variableAtomFamily(varName));
          const parsedValue = safeParse(rawValue);
          
          // Only include if it's a boolean type
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
    [variableNames]
  );

  // Load boolean variables when component mounts or variableNames changes
  useEffect(() => {
    loadBooleanVariables().then(setBooleanVariables);
  }, [loadBooleanVariables]);

  const handleSave = () => {
    if (!id) {
      alert('No chart ID found');
      return;
    }

    if (!selectedVariable) {
      // Clear visibility rule
      const updated = { ...visibilityVariables };
      delete updated[id];
      setVisibilityVariables(updated);
      setSuccessMessage('Visibility rule cleared - chart will always be visible');
    } else {
      // Set visibility rule
      setVisibilityVariables({
        ...visibilityVariables,
        [id]: selectedVariable,
      });
      setSuccessMessage(`Visibility rule saved: Chart will hide when "${selectedVariable}" is true`);
    }
    
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const handleClear = () => {
    setSelectedVariable('');
    if (id) {
      const updated = { ...visibilityVariables };
      delete updated[id];
      setVisibilityVariables(updated);
      setSuccessMessage('Visibility rule cleared - chart will always be visible');
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', bgcolor: 'grey.50' }} >
      {/* Success Message */}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 3 }}>
          {successMessage}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 4, mb: 3,  }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <VisibilityIcon sx={{ mr: 2, color: 'primary.main', fontSize: 40 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight={600}>
              Chart Visibility Control
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Chart ID: <Chip label={id || 'Not specified'} size="small" color="primary" />
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4 }} />

        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            📌 How it works:
          </Typography>
          <Typography variant="body2" component="div">
            • Select a <strong>boolean variable</strong> from your calculations
            <br />
            • When the variable is <code>true</code> → Chart is <strong>HIDDEN</strong>
            <br />
            • When the variable is <code>false</code> → Chart is <strong>VISIBLE</strong>
            <br />
            • By default (no variable selected) → Chart is always <strong>VISIBLE</strong>
          </Typography>
        </Alert>

        {/* Selection Form */}
        <Card 
          variant="outlined" 
          sx={{ 
            mb: 4, 
            bgcolor: 'primary.50', 
            borderColor: 'primary.light',
            borderWidth: 2,
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom color="primary.dark">
              Select Visibility Variable
            </Typography>
            
            {booleanVariables.length === 0 ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  No boolean variables found. Please create boolean variables in the <strong>Hooks</strong> section first.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Example: Create a calculation like <code>param_metric === "MOP"</code> that returns true/false
                </Typography>
              </Alert>
            ) : (
              <>
                <FormControl fullWidth sx={{ mt: 2 }}>
                  <InputLabel>Boolean Variable</InputLabel>
                  <Select
                    value={selectedVariable}
                    label="Boolean Variable"
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    sx={{ bgcolor: 'white' }}
                  >
                    <MenuItem value="">
                      <em>None - Always Visible</em>
                    </MenuItem>
                    {booleanVariables.map((variable) => (
                      <MenuItem key={variable.name} value={variable.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <Typography sx={{ flex: 1 }}>{variable.name}</Typography>
                          <Chip
                            label={variable.currentValue ? 'true' : 'false'}
                            size="small"
                            color={variable.currentValue ? 'success' : 'default'}
                            icon={variable.currentValue ? <CheckCircleIcon /> : <CancelIcon />}
                            sx={{ ml: 1 }}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  💡 Showing only boolean variables ({booleanVariables.length} found)
                </Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current Selection Preview */}
        {selectedVariable && (
          <Card variant="outlined" sx={{ mb: 4, bgcolor: 'success.50', borderColor: 'success.light' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} color="success.dark" gutterBottom>
                📋 Current Rule Preview
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 1, border: '1px dashed', borderColor: 'success.main' }}>
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={600}>When:</Typography>
                    <Chip label={selectedVariable} color="primary" size="small" />
                    <Typography variant="body2" fontWeight={600}>=</Typography>
                    <Chip label="true" color="success" size="small" icon={<CheckCircleIcon />} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={600}>Then:</Typography>
                    <Typography variant="body2" color="error.main" fontWeight={600}>
                      Chart {id} will be HIDDEN
                    </Typography>
                  </Box>
                  <Divider />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={600}>When:</Typography>
                    <Chip label={selectedVariable} color="primary" size="small" />
                    <Typography variant="body2" fontWeight={600}>=</Typography>
                    <Chip label="false" color="default" size="small" icon={<CancelIcon />} />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={600}>Then:</Typography>
                    <Typography variant="body2" color="success.main" fontWeight={600}>
                      Chart {id} will be VISIBLE
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Current Variable Value */}
        {selectedVariable && (
          <Card variant="outlined" sx={{ mb: 4 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                🔍 Current Value
              </Typography>
              <VariableValueDisplay variableName={selectedVariable} />
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            color="success"
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
            sx={{ py: 1.5 }}
          >
            Save Visibility Rule
          </Button>
          {selectedVariable && (
            <Button
              variant="outlined"
              color="warning"
              size="large"
              startIcon={<ClearIcon />}
              onClick={handleClear}
            >
              Clear
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
            <Typography variant="subtitle2" fontWeight={600} color="primary.main" gutterBottom>
              Example 1: Hide chart when MOP is selected
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'white' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0 }}>
                {`// In Hooks, create this variable:
Variable Name: hideForMOP
Logic: param_metric === "MOP"

Then select "hideForMOP" in this screen
Result: Chart hides when metric filter = "MOP"`}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="primary.main" gutterBottom>
              Example 2: Hide for multiple conditions
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'white' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0 }}>
                {`// In Hooks, create this variable:
Variable Name: hideForSpecificMetrics
Logic: ["MOP", "PAYER_NAME"].includes(param_metric)

Then select "hideForSpecificMetrics"
Result: Chart hides when metric is MOP OR PAYER_NAME`}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={600} color="primary.main" gutterBottom>
              Example 3: Complex condition
            </Typography>
            <Paper sx={{ p: 2, bgcolor: 'white' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0 }}>
                {`// In Hooks, create this variable:
Variable Name: hideForAdvancedCondition
Logic: param_metric === "MOP" && param_region.includes("North")

Result: Chart hides only when BOTH conditions are true`}
              </Typography>
            </Paper>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

// Component to display current variable value with details
function VariableValueDisplay({ variableName }: { variableName: string }) {
  const rawValue = useRecoilValue(variableAtomFamily(variableName));
  const parsedValue = safeParse(rawValue);
  
  const isBoolean = typeof parsedValue === 'boolean';
  const currentValue = parsedValue;
  
  return (
    <Box sx={{ mt: 2 }}>
      <Paper 
        sx={{ 
          p: 3, 
          bgcolor: isBoolean 
            ? (currentValue ? 'error.50' : 'success.50')
            : 'grey.100',
          border: 2,
          borderColor: isBoolean
            ? (currentValue ? 'error.main' : 'success.main')
            : 'grey.300',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Variable:
            </Typography>
            <Chip label={variableName} color="primary" />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Current Value:
            </Typography>
            <Chip
              label={String(currentValue)}
              color={isBoolean ? (currentValue ? 'error' : 'success') : 'default'}
              icon={isBoolean ? (currentValue ? <CheckCircleIcon /> : <CancelIcon />) : undefined}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={600}>
              Type:
            </Typography>
            <Chip label={typeof currentValue} size="small" />
          </Box>
          
          {isBoolean && (
            <Alert severity={currentValue ? 'error' : 'success'} sx={{ mt: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {currentValue 
                  ? '❌ Chart is currently HIDDEN (variable is true)'
                  : '✅ Chart is currently VISIBLE (variable is false)'
                }
              </Typography>
            </Alert>
          )}
          
          {!isBoolean && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="body2">
                ⚠️ This variable is not boolean. It may not work as expected for visibility control.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}