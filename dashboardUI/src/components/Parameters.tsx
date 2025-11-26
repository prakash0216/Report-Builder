import React, { useState, useEffect } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { parameterNamesState } from '../recoil/ParameterTracker';
import {
  arrayParameterNamesSelector,
  arrayOfArrayParameterNamesSelector,
  arrayOfObjectsParameterNamesSelector,
} from '../recoil/ParameterTracker';
import axios from 'axios';
import {
  Box,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  IconButton,
  Collapse,
  Divider,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
} from '@mui/icons-material';

interface AlertState {
  show: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

const API_BASE_URL = 'http://localhost:3002';

export default function AddParameterMui() {
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [newParamName, setNewParamName] = useState<string>('');
  const [parameterNames, setParameterNames] =
    useRecoilState(parameterNamesState);
  const [isParamsCollapsed, setIsParamsCollapsed] = useState<boolean>(false);
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editedParamName, setEditedParamName] = useState<string>('');

  const [alert, setAlert] = useState<AlertState>({
    show: false,
    message: '',
    severity: 'success',
  });

  const [parameterValue, setParameterValue] = useRecoilState(
    selectedParam
      ? parameterAtomFamily(selectedParam)
      : parameterAtomFamily('__placeholder__')
  );

  const resetParameterValue = useResetRecoilState(
    parameterAtomFamily(selectedParam)
  );

  const showAlert = (
    message: string,
    severity: AlertState['severity'] = 'success'
  ) => {
    setAlert({ show: true, message, severity });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  const addParameter = async (): Promise<void> => {
    if (newParamName && !parameterNames.includes(newParamName)) {
      try {
        // Create parameter in database with empty value
        await axios.post(`${API_BASE_URL}/api/parameters/${newParamName}`, { value: '' });
        
        // Update local state
        setParameterNames((prev: string[]) => [...prev, newParamName]);
        setSelectedParam(newParamName);
        setNewParamName('');
        showAlert(`Parameter "${newParamName}" added successfully`, 'success');
      } catch (err) {
        console.error('Failed to add parameter', err);
        showAlert('Failed to add parameter', 'error');
      }
    }
  };

  const startEditingParam = (paramName: string): void => {
    setEditingParam(paramName);
    setEditedParamName(paramName);
  };

  const saveEditedParam = async (): Promise<void> => {
    if (!editedParamName.trim() || editedParamName === editingParam) {
      setEditingParam(null);
      return;
    }

    if (parameterNames.includes(editedParamName)) {
      showAlert('Parameter name already exists', 'error');
      return;
    }

    try {
      // Rename parameter in database
      await axios.put(`${API_BASE_URL}/api/parameters/${editingParam}/rename`, {
        newName: editedParamName,
      });

      // Update local state
      setParameterNames((prev: string[]) =>
        prev.map((name) => (name === editingParam ? editedParamName : name))
      );

      if (selectedParam === editingParam) {
        setSelectedParam(editedParamName);
      }

      showAlert(`Parameter renamed to "${editedParamName}"`, 'success');
      setEditingParam(null);
    } catch (err) {
      console.error('Failed to rename parameter', err);
      showAlert('Failed to rename parameter', 'error');
    }
  };

  const cancelEditingParam = (): void => {
    setEditingParam(null);
    setEditedParamName('');
  };

  const removeParameter = async (paramName: string): Promise<void> => {
    try {
      // Delete parameter from database
      await axios.delete(`${API_BASE_URL}/api/parameters/${paramName}`);

      // Update local state
      if (selectedParam === paramName) {
        resetParameterValue();
        setSelectedParam('');
      }
      setParameterNames((prev: string[]) =>
        prev.filter((name) => name !== paramName)
      );
      showAlert(`Parameter "${paramName}" removed successfully`, 'success');
    } catch (err) {
      console.error('Failed to remove parameter', err);
      showAlert('Failed to remove parameter', 'error');
    }
  };

  useEffect(() => {
    if (!selectedParam && parameterNames.length > 0) {
      setSelectedParam(parameterNames[0]);
    }
  }, [parameterNames, selectedParam]);

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 3,
        p: 3,
        height: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      {/* Parameters Panel */}
      <Box
        sx={{
          gridColumn: 'span 3',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(102, 126, 234, 0.2)',
          borderRadius: 3,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2.5,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            cursor: 'pointer',
            borderRadius: '12px 12px 0 0',
            '&:hover': { 
              background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
            },
          }}
          onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', letterSpacing: 0.5 }}>
            Parameters
          </Typography>
          {isParamsCollapsed ? (
            <ChevronRightIcon sx={{ color: 'white' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'white' }} />
          )}
        </Box>

        {/* Collapsible Content */}
        <AnimatePresence>
          {!isParamsCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
              }}
            >
              <Box sx={{ p: 2.5, flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                
                {/* --- In-Panel Alert --- */}
                <Collapse in={alert.show}>
                  <Alert
                    severity={alert.severity}
                    onClose={() => {
                      setAlert((prev) => ({ ...prev, show: false }));
                    }}
                    sx={{ 
                      mb: 2,
                      borderRadius: 2,
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.1)',
                    }}
                  >
                    {alert.message}
                  </Alert>
                </Collapse>
                {/* ---------------------- */}

                {/* Add new parameter */}
                <Box
                  sx={{
                    mb: 2.5,
                    p: 2.5,
                    background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                    borderRadius: 2,
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                  }}
                >
                  <Typography
                    variant="subtitle1"
                    sx={{ 
                      mb: 1.5, 
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    Add New Parameter
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={newParamName}
                      onChange={(e) => setNewParamName(e.target.value)}
                      placeholder="e.g., userId, limit, sortOrder"
                      onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        e.key === 'Enter' && addParameter()
                      }
                      sx={{
                        bgcolor: 'white',
                        borderRadius: 1.5,
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
                      }}
                    />
                    <Button
                      variant="contained"
                      onClick={addParameter}
                      disabled={
                        !newParamName || parameterNames.includes(newParamName)
                      }
                      startIcon={<AddIcon />}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                        },
                        '&.Mui-disabled': {
                          background: '#e2e8f0',
                        },
                        fontWeight: 600,
                        px: 2.5,
                      }}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>

                {/* List of parameters */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {parameterNames.length === 0 ? (
                    <Box
                      sx={{
                        textAlign: 'center',
                        py: 4,
                        px: 2,
                      }}
                    >
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
                        <AddIcon sx={{ fontSize: 32, color: '#667eea', opacity: 0.6 }} />
                      </Box>
                      <Typography
                        variant="body2"
                        color="#64748b"
                        sx={{ fontWeight: 600 }}
                      >
                        No parameters yet
                      </Typography>
                      <Typography variant="caption" color="#94a3b8">
                        Create your first parameter above
                      </Typography>
                    </Box>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {parameterNames.map((param) => (
                        <ListItem
                          key={param}
                          disablePadding
                          sx={{
                            mb: 1.5,
                            borderRadius: 2,
                            background:
                              selectedParam === param
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                            color: selectedParam === param ? 'white' : '#667eea',
                            border: '1px solid',
                            borderColor: selectedParam === param ? 'transparent' : 'rgba(102, 126, 234, 0.3)',
                            boxShadow: selectedParam === param ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                            '&:hover': { 
                              background: selectedParam === param
                                ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                            },
                            cursor:
                              editingParam === param ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() =>
                            editingParam !== param && setSelectedParam(param)
                          }
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              py: 1.5,
                              px: 2,
                              gap: 1,
                            }}
                          >
                            {editingParam === param ? (
                              <>
                                <TextField
                                  size="small"
                                  value={editedParamName}
                                  onChange={(e) =>
                                    setEditedParamName(e.target.value)
                                  }
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyPress={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') saveEditedParam();
                                    if (e.key === 'Escape') cancelEditingParam();
                                  }}
                                  autoFocus
                                  sx={{
                                    flexGrow: 1,
                                    '& .MuiInputBase-root': {
                                      color: '#667eea',
                                      bgcolor: 'white',
                                      fontWeight: 600,
                                    },
                                  }}
                                />
                                <Tooltip title="Save">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveEditedParam();
                                    }}
                                    sx={{
                                      color: '#10b981',
                                      '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' },
                                    }}
                                  >
                                    <CheckIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Cancel">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingParam();
                                    }}
                                    sx={{
                                      color: '#ef4444',
                                      '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                                    }}
                                  >
                                    <CloseIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            ) : (
                              <>
                                <Typography
                                  sx={{
                                    flexGrow: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontWeight: 600,
                                  }}
                                >
                                  {param}
                                </Typography>
                                <Tooltip title="Edit name">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingParam(param);
                                    }}
                                    sx={{
                                      color: 'inherit',
                                      opacity: 0.8,
                                      '&:hover': { opacity: 1, bgcolor: 'rgba(255, 255, 255, 0.1)' },
                                    }}
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Remove">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeParameter(param);
                                    }}
                                    sx={{
                                      color: 'inherit',
                                      opacity: 0.8,
                                      '&:hover': { opacity: 1, bgcolor: 'rgba(255, 255, 255, 0.1)' },
                                    }}
                                  >
                                    <ClearIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </>
                            )}
                          </Box>
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Always visible parameter names when collapsed */}
        <Collapse in={isParamsCollapsed}>
          <Divider sx={{ borderColor: 'rgba(102, 126, 234, 0.2)' }} />
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {parameterNames.map((param) => (
              <Button
                key={param}
                size="small"
                variant={selectedParam === param ? 'contained' : 'outlined'}
                onClick={() => setSelectedParam(param)}
                sx={{
                  background:
                    selectedParam === param 
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'transparent',
                  color: selectedParam === param ? 'white' : '#667eea',
                  borderColor: '#667eea',
                  fontWeight: 600,
                  '&:hover': { 
                    background: selectedParam === param
                      ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                      : 'rgba(102, 126, 234, 0.05)',
                  },
                }}
              >
                {param}
              </Button>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* Main Content Area */}
      <Box
        sx={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {/* Parameter Editor */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            border: '1px solid rgba(102, 126, 234, 0.2)',
            borderRadius: 3,
            p: 3,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
          }}
        >
          {selectedParam ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedParam}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    pb: 2,
                    borderBottom: '2px solid',
                    borderImage: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1',
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                    Editing Parameter:{' '}
                    <Typography
                      component="span"
                      sx={{ 
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {selectedParam}
                    </Typography>
                  </Typography>

                  {/* Auto Saved indicator */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 2,
                      py: 1,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(20, 184, 166, 0.1) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        bgcolor: '#10b981',
                      }}
                    />
                    <Typography variant="body2" sx={{ color: '#059669', fontWeight: 600 }}>
                      Auto-saved to DB
                    </Typography>
                  </Box>
                </Box>

                <Box
                  sx={{
                    mb: 1,
                    p: 1.5,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
                    Available in Hooks as: <code style={{ 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontWeight: 600,
                    }}>{selectedParam}</code>
                  </Typography>
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={15}
                  variant="outlined"
                  value={parameterValue}
                  onChange={(e) => setParameterValue(e.target.value)}
                  placeholder={`Enter a value for ${selectedParam}...

Examples:
- JSON: {"key": "value"}
- String: "example string"
- Number: 123
- Boolean: true`}
                  sx={{ 
                    flex: 1, 
                    fontFamily: 'monospace',
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
                  }}
                  InputProps={{
                    sx: { height: '100%', alignItems: 'flex-start' },
                  }}
                  inputProps={{
                    sx: { height: '100% !important' },
                  }}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%)',
                border: '2px dashed rgba(102, 126, 234, 0.3)',
                borderRadius: 2,
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    margin: '0 auto 24px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <EditIcon sx={{ fontSize: 40, color: '#667eea', opacity: 0.6 }} />
                </Box>
                <Typography 
                  variant="h6" 
                  sx={{ 
                    mb: 1,
                    fontWeight: 700,
                    color: '#475569',
                  }}
                >
                  No parameter selected
                </Typography>
                <Typography variant="body2" color="#94a3b8">
                  Add a new parameter or select an existing one to start editing
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}