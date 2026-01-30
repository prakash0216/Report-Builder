import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useRecoilState } from 'recoil';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Card,
  CardContent,
  Chip,
  IconButton,
  Alert,
  Tooltip,
  Stack,
  alpha,
  useTheme,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Switch,
  Tabs,
  Tab,
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Functions as FunctionsIcon,
  ContentCopy as ContentCopyIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';

import {
  predefinedFunctionsState,
  PredefinedFunction,
  FunctionParameter,
  FUNCTION_CATEGORIES,
  BUILT_IN_FUNCTIONS,
  createDefaultFunction,
  isValidFunctionName,
  testFunction,
} from '../recoil/PredefinedFunctionsState';

// Tab Panel Component
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`function-tabpanel-${index}`}
      aria-labelledby={`function-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

// Function Editor Dialog
interface FunctionEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (fn: PredefinedFunction) => void;
  initialFunction?: PredefinedFunction;
  existingNames: string[];
}

const FunctionEditorDialog: React.FC<FunctionEditorDialogProps> = ({
  open,
  onClose,
  onSave,
  initialFunction,
  existingNames,
}) => {
  const theme = useTheme();
  const [func, setFunc] = useState<PredefinedFunction>(initialFunction || createDefaultFunction());
  const [testInputs, setTestInputs] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<{ success: boolean; result?: any; error?: string } | null>(null);
  const [nameError, setNameError] = useState<string>('');

  useEffect(() => {
    if (open) {
      setFunc(initialFunction || createDefaultFunction());
      setTestInputs({});
      setTestResult(null);
      setNameError('');
    }
  }, [open, initialFunction]);

  const validateName = useCallback((name: string) => {
    if (!name) {
      setNameError('Function name is required');
      return false;
    }
    if (!isValidFunctionName(name)) {
      setNameError('Invalid function name. Must be a valid JavaScript identifier.');
      return false;
    }
    if (existingNames.includes(name) && name !== initialFunction?.name) {
      setNameError('A function with this name already exists');
      return false;
    }
    setNameError('');
    return true;
  }, [existingNames, initialFunction?.name]);

  const handleNameChange = (name: string) => {
    setFunc(prev => ({ ...prev, name }));
    validateName(name);
  };

  const handleAddParameter = () => {
    setFunc(prev => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        { name: '', type: 'any', description: '', required: true },
      ],
    }));
  };

  const handleUpdateParameter = (index: number, updates: Partial<FunctionParameter>) => {
    setFunc(prev => ({
      ...prev,
      parameters: prev.parameters.map((p, i) => i === index ? { ...p, ...updates } : p),
    }));
  };

  const handleRemoveParameter = (index: number) => {
    setFunc(prev => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  };

  const handleTest = () => {
    const inputs: Record<string, any> = {};
    func.parameters.forEach(p => {
      const val = testInputs[p.name];
      if (val !== undefined && val !== '') {
        try {
          inputs[p.name] = JSON.parse(val);
        } catch {
          inputs[p.name] = val;
        }
      }
    });
    const result = testFunction(func, inputs);
    setTestResult(result);
  };

  const handleSave = () => {
    if (!validateName(func.name)) return;
    if (!func.body.trim()) {
      return;
    }
    onSave({
      ...func,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  const generateSignature = () => {
    const params = func.parameters.map(p => {
      // Show optional params with ? or default value
      if (p.required === false) {
        return p.defaultValue ? `${p.name} = ${p.defaultValue}` : `${p.name}?`;
      }
      return p.name;
    }).join(', ');
    return `${func.name}(${params})`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}>
        <FunctionsIcon />
        {initialFunction ? 'Edit Function' : 'Create New Function'}
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {/* Left Column - Function Definition */}
          <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
            <Stack spacing={2}>
              {/* Basic Info */}
              <TextField
                label="Function Name"
                value={func.name}
                onChange={(e) => handleNameChange(e.target.value)}
                error={!!nameError}
                helperText={nameError || 'Must be a valid JavaScript identifier (e.g., formatCurrency)'}
                fullWidth
                size="small"
              />
              
              <TextField
                label="Description"
                value={func.description}
                onChange={(e) => setFunc(prev => ({ ...prev, description: e.target.value }))}
                multiline
                rows={2}
                fullWidth
                size="small"
                placeholder="What does this function do?"
              />

              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={func.category || 'Custom'}
                    label="Category"
                    onChange={(e) => setFunc(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {FUNCTION_CATEGORIES.map(cat => (
                      <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel>Return Type</InputLabel>
                  <Select
                    value={func.returnType || 'any'}
                    label="Return Type"
                    onChange={(e) => setFunc(prev => ({ ...prev, returnType: e.target.value }))}
                  >
                    <MenuItem value="string">string</MenuItem>
                    <MenuItem value="number">number</MenuItem>
                    <MenuItem value="boolean">boolean</MenuItem>
                    <MenuItem value="array">array</MenuItem>
                    <MenuItem value="object">object</MenuItem>
                    <MenuItem value="any">any</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Parameters */}
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" fontWeight={600}>Parameters</Typography>
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddParameter}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Parameter
                  </Button>
                </Box>
                
                {func.parameters.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    No parameters defined. Click "Add Parameter" to add one.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {func.parameters.map((param, index) => (
                      <Paper key={index} sx={{ p: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03) }}>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {/* Row 1: Name, Type, Delete */}
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <TextField
                              label="Name"
                              value={param.name}
                              onChange={(e) => handleUpdateParameter(index, { name: e.target.value })}
                              size="small"
                              sx={{ flex: 2 }}
                            />
                            <FormControl size="small" sx={{ flex: 1.5 }}>
                              <InputLabel>Type</InputLabel>
                              <Select
                                value={param.type}
                                label="Type"
                                onChange={(e) => handleUpdateParameter(index, { type: e.target.value as any })}
                              >
                                <MenuItem value="string">string</MenuItem>
                                <MenuItem value="number">number</MenuItem>
                                <MenuItem value="boolean">boolean</MenuItem>
                                <MenuItem value="array">array</MenuItem>
                                <MenuItem value="object">object</MenuItem>
                                <MenuItem value="any">any</MenuItem>
                              </Select>
                            </FormControl>
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveParameter(index)}
                              sx={{ color: 'error.main' }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                          {/* Row 2: Required toggle, Default value, Description */}
                          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'nowrap' }}>
                            {/* Required/Optional Toggle with Chip */}
                            <Box sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: 0.5,
                              bgcolor: param.required !== false ? alpha('#ef4444', 0.08) : alpha('#64748b', 0.08),
                              borderRadius: 2,
                              px: 1,
                              py: 0.25,
                              border: `1px solid ${param.required !== false ? alpha('#ef4444', 0.3) : alpha('#64748b', 0.2)}`,
                              minWidth: 140,
                              flexShrink: 0,
                            }}>
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: param.required === false ? '#64748b' : 'text.secondary',
                                  fontWeight: param.required === false ? 600 : 400,
                                  fontSize: '0.7rem',
                                }}
                              >
                                Optional
                              </Typography>
                              <Switch
                                size="small"
                                checked={param.required !== false}
                                onChange={(e) => handleUpdateParameter(index, { required: e.target.checked })}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': {
                                    color: '#ef4444',
                                  },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                    backgroundColor: '#ef4444',
                                  },
                                }}
                              />
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: param.required !== false ? '#ef4444' : 'text.secondary',
                                  fontWeight: param.required !== false ? 600 : 400,
                                  fontSize: '0.7rem',
                                }}
                              >
                                Required
                              </Typography>
                            </Box>
                            <TextField
                              label="Default"
                              value={param.defaultValue || ''}
                              onChange={(e) => handleUpdateParameter(index, { defaultValue: e.target.value })}
                              size="small"
                              placeholder={param.required !== false ? '-' : 'Value'}
                              sx={{ 
                                width: 100,
                                flexShrink: 0,
                                '& .MuiOutlinedInput-root': {
                                  '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
                                },
                              }}
                              InputProps={{
                                sx: { fontSize: '0.85rem' }
                              }}
                            />
                            <TextField
                              label="Description"
                              value={param.description || ''}
                              onChange={(e) => handleUpdateParameter(index, { description: e.target.value })}
                              size="small"
                              placeholder="Parameter description"
                              sx={{ 
                                flex: 1,
                                minWidth: 150,
                                '& .MuiOutlinedInput-root': {
                                  '& fieldset': { borderColor: 'rgba(0,0,0,0.15)' },
                                },
                              }}
                              InputProps={{
                                sx: { fontSize: '0.85rem' }
                              }}
                            />
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Box>

              {/* Function Signature Preview */}
              <Paper sx={{ p: 1.5, bgcolor: alpha(theme.palette.info.main, 0.05), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                <Typography variant="caption" color="text.secondary">Function Signature:</Typography>
                <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary">
                  {generateSignature()}
                </Typography>
              </Paper>
            </Stack>
          </Box>

          {/* Right Column - Function Body & Testing */}
          <Box sx={{ flex: '1 1 400px', minWidth: 300 }}>
            <Stack spacing={2}>
              {/* Function Body */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Function Body
                </Typography>
                <TextField
                  value={func.body}
                  onChange={(e) => setFunc(prev => ({ ...prev, body: e.target.value }))}
                  multiline
                  rows={8}
                  fullWidth
                  placeholder="// Write your function logic here&#10;// Parameters are available as variables&#10;// Use 'return' to return a value&#10;&#10;return null;"
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    },
                  }}
                />
              </Box>

              {/* Example Usage */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Example Usage <Typography component="span" variant="caption" color="text.secondary">(shown in info tooltip)</Typography>
                </Typography>
                <TextField
                  value={func.example || ''}
                  onChange={(e) => setFunc(prev => ({ ...prev, example: e.target.value }))}
                  multiline
                  rows={4}
                  fullWidth
                  placeholder={`// Example 1: Basic usage\n${func.name || 'myFunction'}(value1, value2)\n// Output: "result"\n\n// Example 2: With options\n${func.name || 'myFunction'}(123, "option")\n// Output: "123 - option"`}
                  sx={{
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                    },
                  }}
                />
              </Box>

              {/* Test Section */}
              <Divider />
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  Test Function
                </Typography>
                
                {func.parameters.length > 0 && (
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {func.parameters.map((param, index) => (
                      <TextField
                        key={index}
                        label={`${param.name} (${param.type})`}
                        value={testInputs[param.name] || ''}
                        onChange={(e) => setTestInputs(prev => ({ ...prev, [param.name]: e.target.value }))}
                        size="small"
                        fullWidth
                        placeholder={param.defaultValue || `Enter ${param.type} value`}
                      />
                    ))}
                  </Stack>
                )}

                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleTest}
                  sx={{
                    background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                    textTransform: 'none',
                  }}
                >
                  Run Test
                </Button>

                {testResult && (
                  <Paper sx={{ 
                    mt: 2, 
                    p: 2, 
                    bgcolor: testResult.success 
                      ? alpha(theme.palette.success.main, 0.05) 
                      : alpha(theme.palette.error.main, 0.05),
                    border: `1px solid ${testResult.success ? theme.palette.success.main : theme.palette.error.main}`,
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {testResult.success ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="error" fontSize="small" />
                      )}
                      <Typography variant="subtitle2" fontWeight={600}>
                        {testResult.success ? 'Success' : 'Error'}
                      </Typography>
                    </Box>
                    <Typography 
                      variant="body2" 
                      fontFamily="monospace"
                      sx={{ 
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {testResult.success 
                        ? JSON.stringify(testResult.result, null, 2)
                        : testResult.error}
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Stack>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={!!nameError || !func.name || !func.body.trim()}
          sx={{
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            textTransform: 'none',
          }}
        >
          {initialFunction ? 'Update Function' : 'Create Function'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Function Info Dialog Component
interface FunctionInfoDialogProps {
  open: boolean;
  onClose: () => void;
  func: PredefinedFunction;
  isBuiltIn: boolean;
}

const FunctionInfoDialog: React.FC<FunctionInfoDialogProps> = ({
  open,
  onClose,
  func,
  isBuiltIn,
}) => {
  const theme = useTheme();
  const signature = useMemo(() => {
    const params = func.parameters.map(p => p.name).join(', ');
    return `${func.name}(${params})`;
  }, [func]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ 
        background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}>
        <FunctionsIcon />
        {func.name}
        {isBuiltIn && (
          <Chip label="Built-in" size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', ml: 1 }} />
        )}
      </DialogTitle>
      <DialogContent sx={{ mt: 2 }}>
        <Stack spacing={3}>
          {/* Description */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Description
            </Typography>
            <Typography variant="body1">
              {func.description}
            </Typography>
          </Box>

          {/* Signature */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Signature
            </Typography>
            <Paper sx={{ 
              p: 2, 
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            }}>
              <Typography variant="body1" fontFamily="monospace" color="primary.main" fontWeight={600}>
                {signature}
              </Typography>
            </Paper>
          </Box>

          {/* Parameters */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Parameters
            </Typography>
            {func.parameters.length === 0 ? (
              <Typography variant="body2" color="text.secondary" fontStyle="italic">
                No parameters
              </Typography>
            ) : (
              <Paper sx={{ overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
                {func.parameters.map((param, index) => (
                  <Box 
                    key={param.name}
                    sx={{ 
                      p: 1.5, 
                      borderBottom: index < func.parameters.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                      bgcolor: index % 2 === 0 ? 'transparent' : alpha(theme.palette.primary.main, 0.02),
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary.main">
                        {param.name}
                      </Typography>
                      <Chip label={param.type} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                      {param.required !== false ? (
                        <Chip label="required" size="small" color="error" sx={{ height: 18, fontSize: '0.65rem' }} />
                      ) : (
                        <Chip label="optional" size="small" color="default" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                      )}
                      {param.defaultValue && (
                        <Typography variant="caption" color="text.secondary">
                          default: <code>{param.defaultValue}</code>
                        </Typography>
                      )}
                    </Box>
                    {param.description && (
                      <Typography variant="body2" color="text.secondary">
                        {param.description}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Paper>
            )}
          </Box>

          {/* Return Type */}
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Returns
            </Typography>
            <Chip 
              label={func.returnType || 'any'} 
              color="success" 
              variant="outlined"
              sx={{ fontFamily: 'monospace' }}
            />
          </Box>

          {/* Example */}
          {func.example && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Example Usage
              </Typography>
              <Paper sx={{ 
                p: 2, 
                bgcolor: '#1e1e1e',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
              }}>
                <Typography 
                  component="pre" 
                  sx={{ 
                    m: 0, 
                    fontFamily: 'monospace', 
                    fontSize: '0.85rem',
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                    '& code': {
                      color: '#9cdcfe',
                    },
                  }}
                >
                  {func.example}
                </Typography>
              </Paper>
            </Box>
          )}

          {/* Function Body (for custom functions) */}
          {!isBuiltIn && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Function Body
              </Typography>
              <Paper sx={{ 
                p: 2, 
                bgcolor: '#1e1e1e',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 2,
                maxHeight: 200,
                overflow: 'auto',
              }}>
                <Typography 
                  component="pre" 
                  sx={{ 
                    m: 0, 
                    fontFamily: 'monospace', 
                    fontSize: '0.85rem',
                    color: '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {func.body}
                </Typography>
              </Paper>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Button onClick={onClose} variant="contained" sx={{ 
          background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
          textTransform: 'none' 
        }}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Function Card Component
interface FunctionCardProps {
  func: PredefinedFunction;
  isBuiltIn: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: (enabled: boolean) => void;
}

const FunctionCard: React.FC<FunctionCardProps> = ({
  func,
  isBuiltIn,
  onEdit,
  onDelete,
  onToggle,
}) => {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const signature = useMemo(() => {
    const params = func.parameters.map(p => p.name).join(', ');
    return `${func.name}(${params})`;
  }, [func]);

  const handleCopy = () => {
    navigator.clipboard.writeText(signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
    <Card sx={{ 
      border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
      opacity: func.isEnabled ? 1 : 0.6,
      transition: 'all 0.2s ease',
      height: '100%',
      '&:hover': {
        borderColor: alpha(theme.palette.primary.main, 0.3),
        boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.1)}`,
      },
    }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FunctionsIcon sx={{ color: 'primary.main', fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={600} fontFamily="monospace">
              {func.name}
            </Typography>
            {isBuiltIn && (
              <Chip label="Built-in" size="small" color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
            )}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Info Icon - Shows detailed info dialog */}
            <Tooltip title="View details & examples">
              <IconButton 
                size="small" 
                onClick={() => setInfoOpen(true)}
                sx={{ 
                  color: '#3B82F6',
                  '&:hover': { bgcolor: alpha('#3B82F6', 0.1) }
                }}
              >
                <InfoIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {!isBuiltIn && onToggle && (
              <Tooltip title={func.isEnabled ? 'Disable' : 'Enable'}>
                <Switch
                  size="small"
                  checked={func.isEnabled}
                  onChange={(e) => onToggle(e.target.checked)}
                />
              </Tooltip>
            )}
            <Tooltip title={copied ? 'Copied!' : 'Copy signature'}>
              <IconButton size="small" onClick={handleCopy}>
                {copied ? <CheckCircleIcon fontSize="small" color="success" /> : <ContentCopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            {!isBuiltIn && onEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={onEdit}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {!isBuiltIn && onDelete && (
              <Tooltip title="Delete">
                <IconButton size="small" onClick={onDelete} sx={{ color: 'error.main' }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {func.description || 'No description'}
        </Typography>

        <Box sx={{ 
          p: 1, 
          bgcolor: alpha(theme.palette.primary.main, 0.05), 
          borderRadius: 1,
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          mb: 1,
        }}>
          <Typography variant="caption" color="text.secondary">Signature:</Typography>
          <Typography variant="body2" fontFamily="monospace" color="primary.main">
            {signature}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip 
            label={func.category || 'Custom'} 
            size="small" 
            icon={<CategoryIcon sx={{ fontSize: 14 }} />}
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          <Chip 
            label={`→ ${func.returnType || 'any'}`} 
            size="small" 
            variant="outlined"
            sx={{ height: 22, fontSize: '0.7rem' }}
          />
          {func.parameters.length > 0 && (
            <Chip 
              label={`${func.parameters.length} param${func.parameters.length > 1 ? 's' : ''}`} 
              size="small" 
              variant="outlined"
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </CardContent>
    </Card>
    
    {/* Function Info Dialog */}
    <FunctionInfoDialog
      open={infoOpen}
      onClose={() => setInfoOpen(false)}
      func={func}
      isBuiltIn={isBuiltIn}
    />
    </>
  );
};

// Delete Confirmation Dialog
interface DeleteConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  functionName: string;
}

const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onClose,
  onConfirm,
  functionName,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Function</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete the function <strong>{functionName}</strong>? This action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained"
          sx={{ textTransform: 'none' }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Main Component
const PredefinedFunctions: React.FC = () => {
  const theme = useTheme();
  const [userFunctions, setUserFunctions] = useRecoilState(predefinedFunctionsState);
  const [tabValue, setTabValue] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFunction, setEditingFunction] = useState<PredefinedFunction | undefined>(undefined);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [functionToDelete, setFunctionToDelete] = useState<PredefinedFunction | null>(null);

  // Combine built-in and user functions
  const allFunctions = useMemo(() => {
    return [...BUILT_IN_FUNCTIONS, ...userFunctions];
  }, [userFunctions]);

  // Get existing function names for validation
  const existingNames = useMemo(() => {
    return allFunctions.map(f => f.name);
  }, [allFunctions]);

  // Filter functions by category
  const filteredBuiltIn = useMemo(() => {
    if (filterCategory === 'All') return BUILT_IN_FUNCTIONS;
    return BUILT_IN_FUNCTIONS.filter(f => f.category === filterCategory);
  }, [filterCategory]);

  const filteredUser = useMemo(() => {
    if (filterCategory === 'All') return userFunctions;
    return userFunctions.filter(f => f.category === filterCategory);
  }, [userFunctions, filterCategory]);

  const handleCreateNew = () => {
    setEditingFunction(undefined);
    setEditorOpen(true);
  };

  const handleEdit = (func: PredefinedFunction) => {
    setEditingFunction(func);
    setEditorOpen(true);
  };

  const handleSave = (func: PredefinedFunction) => {
    if (editingFunction) {
      // Update existing
      setUserFunctions(prev => prev.map(f => f.id === func.id ? func : f));
    } else {
      // Add new
      setUserFunctions(prev => [...prev, func]);
    }
  };

  const handleDeleteClick = (func: PredefinedFunction) => {
    setFunctionToDelete(func);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (functionToDelete) {
      setUserFunctions(prev => prev.filter(f => f.id !== functionToDelete.id));
    }
    setDeleteDialogOpen(false);
    setFunctionToDelete(null);
  };

  const handleToggle = (funcId: string, enabled: boolean) => {
    setUserFunctions(prev => prev.map(f => f.id === funcId ? { ...f, isEnabled: enabled } : f));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ 
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Predefined Functions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Global reusable functions available in all calculations across all dashboards
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNew}
            sx={{
              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create Function
          </Button>
        </Box>

        {/* Category Filter */}
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Category</InputLabel>
          <Select
            value={filterCategory}
            label="Filter by Category"
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <MenuItem value="All">All Categories</MenuItem>
            {FUNCTION_CATEGORIES.map(cat => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Info Alert */}
      <Alert 
        severity="info" 
        icon={<InfoIcon />}
        sx={{ mb: 3, borderRadius: 2 }}
      >
        <Typography variant="body2">
          <strong>How to use:</strong> In the Calculations editor, type <code>@</code> to see available functions. 
          Or simply call them by name: <code>formatCurrency(1234.56)</code> → <code>$1,234.56</code>
        </Typography>
      </Alert>

      {/* Tabs */}
      <Tabs 
        value={tabValue} 
        onChange={(_, v) => setTabValue(v)}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Built-in Functions
              <Chip label={filteredBuiltIn.length} size="small" sx={{ height: 20 }} />
            </Box>
          } 
        />
        <Tab 
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              My Functions
              <Chip label={filteredUser.length} size="small" color="primary" sx={{ height: 20 }} />
            </Box>
          } 
        />
      </Tabs>

      {/* Built-in Functions Tab */}
      <TabPanel value={tabValue} index={0}>
        {filteredBuiltIn.length === 0 ? (
          <Typography color="text.secondary" textAlign="center" py={4}>
            No built-in functions in this category
          </Typography>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
            gap: 2 
          }}>
            {filteredBuiltIn.map(func => (
              <FunctionCard key={func.id} func={func} isBuiltIn={true} />
            ))}
          </Box>
        )}
      </TabPanel>

      {/* User Functions Tab */}
      <TabPanel value={tabValue} index={1}>
        {filteredUser.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
            <FunctionsIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No custom functions yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Create your first reusable function to use across all calculations
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleCreateNew}
              sx={{ textTransform: 'none' }}
            >
              Create Your First Function
            </Button>
          </Paper>
        ) : (
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
            gap: 2 
          }}>
            {filteredUser.map(func => (
              <FunctionCard
                key={func.id}
                func={func}
                isBuiltIn={false}
                onEdit={() => handleEdit(func)}
                onDelete={() => handleDeleteClick(func)}
                onToggle={(enabled) => handleToggle(func.id, enabled)}
              />
            ))}
          </Box>
        )}
      </TabPanel>

      {/* Function Editor Dialog */}
      <FunctionEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        initialFunction={editingFunction}
        existingNames={existingNames}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setFunctionToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        functionName={functionToDelete?.name || ''}
      />
    </Box>
  );
};

export default PredefinedFunctions;
