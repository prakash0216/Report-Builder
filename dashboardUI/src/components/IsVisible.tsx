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
    <Box sx={{ p: 3 }}>
      {/* Success Message */}
      {successMessage && (
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3,
            borderRadius: 2,
            border: '1px solid rgba(16, 185, 129, 0.3)',
            background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.5) 0%, rgba(167, 243, 208, 0.5) 100%)',
          }}
        >
          {successMessage}
        </Alert>
      )}

      <Paper 
        elevation={0} 
        sx={{ 
          p: 4, 
          mb: 3,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              mr: 2,
            }}
          >
            <VisibilityIcon sx={{ color: 'white', fontSize: 32 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography 
              variant="h5" 
              fontWeight={700}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Chart Visibility Control
            </Typography>
            <Typography variant="body2" color="#64748b" sx={{ mt: 0.5, fontWeight: 500 }}>
              Chart ID: <Chip 
                label={id || 'Not specified'} 
                size="small"
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  fontWeight: 600,
                }}
              />
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 4, borderColor: 'rgba(102, 126, 234, 0.2)' }} />

        {/* Instructions */}
        <Alert 
          severity="info" 
          sx={{ 
            mb: 4,
            borderRadius: 2,
            border: '1px solid rgba(59, 130, 246, 0.3)',
            background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
          }}
        >
          <Typography variant="subtitle1" fontWeight={700} gutterBottom color="#0c4a6e">
            📌 How it works:
          </Typography>
          <Typography variant="body2" component="div" color="#0c4a6e" fontWeight={500}>
            • Select a <strong>boolean variable</strong> from your calculations
            <br />
            • When the variable is <code style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: 4 }}>true</code> → Chart is <strong>HIDDEN</strong>
            <br />
            • When the variable is <code style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '2px 6px', borderRadius: 4 }}>false</code> → Chart is <strong>VISIBLE</strong>
            <br />
            • By default (no variable selected) → Chart is always <strong>VISIBLE</strong>
          </Typography>
        </Alert>

        {/* Selection Form */}
        <Card 
          variant="outlined" 
          sx={{ 
            mb: 4, 
            borderRadius: 2,
            border: '2px solid rgba(102, 126, 234, 0.3)',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography 
              variant="h6" 
              fontWeight={700} 
              gutterBottom
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Select Visibility Variable
            </Typography>
            
            {booleanVariables.length === 0 ? (
              <Alert 
                severity="warning" 
                sx={{ 
                  mt: 2,
                  borderRadius: 2,
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)',
                }}
              >
                <Typography variant="body2" fontWeight={500}>
                  No boolean variables found. Please create boolean variables in the <strong>Hooks</strong> section first.
                </Typography>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Example: Create a calculation like <code style={{ background: 'rgba(245, 158, 11, 0.2)', padding: '2px 6px', borderRadius: 4 }}>param_metric === "MOP"</code> that returns true/false
                </Typography>
              </Alert>
            ) : (
              <>
                <FormControl 
                  fullWidth 
                  sx={{ 
                    mt: 2,
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover fieldset': {
                        borderColor: '#667eea',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#667eea',
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#667eea',
                    },
                  }}
                >
                  <InputLabel>Boolean Variable</InputLabel>
                  <Select
                    value={selectedVariable}
                    label="Boolean Variable"
                    onChange={(e) => setSelectedVariable(e.target.value)}
                    sx={{ bgcolor: 'white', borderRadius: 1.5 }}
                  >
                    <MenuItem value="">
                      <em>None - Always Visible</em>
                    </MenuItem>
                    {booleanVariables.map((variable) => (
                      <MenuItem key={variable.name} value={variable.name}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                          <Typography sx={{ flex: 1, fontWeight: 500 }}>{variable.name}</Typography>
                          <Chip
                            label={variable.currentValue ? 'true' : 'false'}
                            size="small"
                            icon={variable.currentValue ? <CheckCircleIcon /> : <CancelIcon />}
                            sx={{
                              ml: 1,
                              background: variable.currentValue 
                                ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
                                : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                              color: 'white',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography variant="caption" color="#64748b" sx={{ mt: 1, display: 'block', fontWeight: 500 }}>
                  💡 Showing only boolean variables ({booleanVariables.length} found)
                </Typography>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current Selection Preview */}
        {selectedVariable && (
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 4, 
              borderRadius: 2,
              border: '2px solid rgba(16, 185, 129, 0.3)',
              background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.3) 0%, rgba(167, 243, 208, 0.3) 100%)',
            }}
          >
            <CardContent>
              <Typography 
                variant="subtitle1" 
                fontWeight={700} 
                gutterBottom
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                📋 Current Rule Preview
              </Typography>
              <Box 
                sx={{ 
                  mt: 2, 
                  p: 2, 
                  bgcolor: 'white', 
                  borderRadius: 2, 
                  border: '2px dashed rgba(16, 185, 129, 0.5)',
                }}
              >
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>When:</Typography>
                    <Chip 
                      label={selectedVariable}
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                    <Typography variant="body2" fontWeight={700}>=</Typography>
                    <Chip 
                      label="true"
                      size="small" 
                      icon={<CheckCircleIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>Then:</Typography>
                    <Typography variant="body2" fontWeight={700} color="#ef4444">
                      Chart {id} will be HIDDEN
                    </Typography>
                  </Box>
                  <Divider sx={{ borderColor: 'rgba(16, 185, 129, 0.3)' }} />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>When:</Typography>
                    <Chip 
                      label={selectedVariable}
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                    <Typography variant="body2" fontWeight={700}>=</Typography>
                    <Chip 
                      label="false"
                      size="small" 
                      icon={<CancelIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" fontWeight={700}>Then:</Typography>
                    <Typography variant="body2" fontWeight={700} color="#10b981">
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
          <Card 
            variant="outlined" 
            sx={{ 
              mb: 4,
              borderRadius: 2,
              border: '1px solid rgba(102, 126, 234, 0.2)',
            }}
          >
            <CardContent>
              <Typography 
                variant="subtitle1" 
                fontWeight={700} 
                gutterBottom
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
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
            size="large"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            fullWidth
            sx={{ 
              py: 1.5,
              fontWeight: 700,
              borderRadius: 2,
              background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              },
            }}
          >
            Save Visibility Rule
          </Button>
          {selectedVariable && (
            <Button
              variant="outlined"
              size="large"
              startIcon={<ClearIcon />}
              onClick={handleClear}
              sx={{
                borderRadius: 2,
                fontWeight: 700,
                borderColor: '#f59e0b',
                color: '#f59e0b',
                '&:hover': {
                  borderColor: '#d97706',
                  bgcolor: 'rgba(245, 158, 11, 0.05)',
                },
              }}
            >
              Clear
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Documentation */}
      <Paper 
        elevation={0} 
        sx={{ 
          p: 4,
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          borderRadius: 3,
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
        }}
      >
        <Typography 
          variant="h6" 
          fontWeight={700} 
          gutterBottom
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          📚 Examples
        </Typography>
        
        <Stack spacing={3} sx={{ mt: 3 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#667eea" gutterBottom>
              Example 1: Hide chart when MOP is selected
            </Typography>
            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.2)',
              }}
            >
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0, color: '#475569' }}>
                {`// In Hooks, create this variable:
Variable Name: hideForMOP
Logic: param_metric === "MOP"

Then select "hideForMOP" in this screen
Result: Chart hides when metric filter = "MOP"`}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#667eea" gutterBottom>
              Example 2: Hide for multiple conditions
            </Typography>
            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.2)',
              }}
            >
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0, color: '#475569' }}>
                {`// In Hooks, create this variable:
Variable Name: hideForSpecificMetrics
Logic: ["MOP", "PAYER_NAME"].includes(param_metric)

Then select "hideForSpecificMetrics"
Result: Chart hides when metric is MOP OR PAYER_NAME`}
              </Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" fontWeight={700} color="#667eea" gutterBottom>
              Example 3: Complex condition
            </Typography>
            <Paper 
              sx={{ 
                p: 2, 
                bgcolor: 'white',
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.2)',
              }}
            >
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace', m: 0, color: '#475569' }}>
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
          borderRadius: 2,
          border: '2px solid',
          borderColor: isBoolean 
            ? (currentValue ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)')
            : 'rgba(148, 163, 184, 0.5)',
          background: isBoolean 
            ? (currentValue 
                ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.3) 0%, rgba(254, 202, 202, 0.3) 100%)'
                : 'linear-gradient(135deg, rgba(209, 250, 229, 0.3) 0%, rgba(167, 243, 208, 0.3) 100%)')
            : 'linear-gradient(135deg, rgba(241, 245, 249, 0.5) 0%, rgba(226, 232, 240, 0.5) 100%)',
        }}
      >
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              Variable:
            </Typography>
            <Chip 
              label={variableName}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              Current Value:
            </Typography>
            <Chip
              label={String(currentValue)}
              icon={isBoolean ? (currentValue ? <CheckCircleIcon /> : <CancelIcon />) : undefined}
              sx={{
                background: isBoolean 
                  ? (currentValue 
                      ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)')
                  : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" fontWeight={700}>
              Type:
            </Typography>
            <Chip 
              label={typeof currentValue} 
              size="small"
              sx={{
                borderColor: '#667eea',
                color: '#667eea',
                fontWeight: 600,
              }}
              variant="outlined"
            />
          </Box>
          
          {isBoolean && (
            <Alert 
              severity={currentValue ? 'error' : 'success'} 
              sx={{ 
                mt: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: currentValue ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)',
                background: currentValue
                  ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)'
                  : 'linear-gradient(135deg, rgba(209, 250, 229, 0.5) 0%, rgba(167, 243, 208, 0.5) 100%)',
              }}
            >
              <Typography variant="body2" fontWeight={700}>
                {currentValue 
                  ? '❌ Chart is currently HIDDEN (variable is true)'
                  : '✅ Chart is currently VISIBLE (variable is false)'
                }
              </Typography>
            </Alert>
          )}
          
          {!isBoolean && (
            <Alert 
              severity="warning" 
              sx={{ 
                mt: 2,
                borderRadius: 2,
                border: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)',
              }}
            >
              <Typography variant="body2" fontWeight={500}>
                ⚠️ This variable is not boolean. It may not work as expected for visibility control.
              </Typography>
            </Alert>
          )}
        </Stack>
      </Paper>
    </Box>
  );
}