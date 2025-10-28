import React, { useState, useEffect } from 'react';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { motion, AnimatePresence } from 'framer-motion';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { arrayParameterNamesSelector,arrayOfArrayParameterNamesSelector,arrayOfObjectsParameterNamesSelector } from '../recoil/ParameterTracker';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon,
  Done as DoneIcon,
} from '@mui/icons-material';

export default function AddParameterMui() {
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [newParamName, setNewParamName] = useState<string>('');
  const [parameterNames, setParameterNames] = useRecoilState(parameterNamesState);
  const [isParamsCollapsed, setIsParamsCollapsed] = useState<boolean>(false);


  // Use a special state for the parameter value based on selection
  const [parameterValue, setParameterValue] = useRecoilState(
    selectedParam ? parameterAtomFamily(selectedParam) : parameterAtomFamily('__placeholder__')
  );

  // Use a separate reset hook for cleanup
  const resetParameterValue = useResetRecoilState(parameterAtomFamily(selectedParam));

  const addParameter = (): void => {
    if (newParamName && !parameterNames.includes(newParamName)) {
      setParameterNames((prev: string[]) => [...prev, newParamName]);
      setSelectedParam(newParamName);
      setNewParamName('');
    }
  };

  const removeParameter = (paramName: string): void => {
    if (selectedParam === paramName) {
      resetParameterValue();
      setSelectedParam('');
    }
    setParameterNames((prev: string[]) => prev.filter((name) => name !== paramName));
  };

  // Auto-select first parameter if none are selected
  useEffect(() => {
    if (!selectedParam && parameterNames.length > 0) {
      setSelectedParam(parameterNames[0]);
    }
  }, [parameterNames, selectedParam]);

  // console.log('Array Parameters:', useRecoilValue(arrayParameterNamesSelector));
  // console.log('Array of Array Parameters:', useRecoilValue(arrayOfArrayParameterNamesSelector));
  // console.log('Array of Object Parameters:', useRecoilValue(arrayOfObjectsParameterNamesSelector));

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2, p: 2, height: '100vh' }}>
      {/* Parameters Panel */}
      <Box
        sx={{
          gridColumn: 'span 3',
          bgcolor: 'grey.100',
          border: 1,
          borderColor: 'grey.300',
          borderRadius: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            borderBottom: 1,
            borderColor: 'grey.300',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'grey.200' },
          }}
          onClick={() => setIsParamsCollapsed(!isParamsCollapsed)}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Parameters
          </Typography>
          {isParamsCollapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
        </Box>

        {/* Collapsible Content */}
        <AnimatePresence>
          {!isParamsCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
            >
              <Box sx={{ p: 2, flex: 1, overflow: 'hidden' }}>
                {/* Add new parameter */}
                <Box sx={{ mb: 2, p: 2, bgcolor: 'white', borderRadius: 1, border: 1, borderColor: 'grey.300' }}>
                  <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'medium' }}>
                    Add New Parameter
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={newParamName}
                      onChange={(e) => setNewParamName(e.target.value)}
                      placeholder="e.g., userId, limit, sortOrder"
                      onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && addParameter()}
                    />
                    <Button
                      variant="contained"
                      onClick={addParameter}
                      disabled={!newParamName || parameterNames.includes(newParamName)}
                      startIcon={<AddIcon />}
                    >
                      Add
                    </Button>
                  </Box>
                </Box>

                {/* List of parameters */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {parameterNames.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No parameters yet
                    </Typography>
                  ) : (
                    <List sx={{ p: 0 }}>
                      {parameterNames.map((param) => (
                        <ListItem
                          key={param}
                          disablePadding
                          sx={{
                            mb: 1,
                            borderRadius: 1,
                            bgcolor: selectedParam === param ? 'primary.main' : 'primary.light',
                            color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' },
                            cursor: 'pointer',
                          }}
                          onClick={() => setSelectedParam(param)}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', py: 1, px: 2 }}>
                            <Typography sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {param}
                            </Typography>
                            <IconButton
                              edge="end"
                              aria-label="delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeParameter(param);
                              }}
                              sx={{ color: 'white', '&:hover': { color: 'red' } }}
                            >
                              <ClearIcon fontSize="small" />
                            </IconButton>
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
          <Divider sx={{ my: 1 }} />
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {parameterNames.map((param) => (
              <Button
                key={param}
                size="small"
                variant={selectedParam === param ? 'contained' : 'text'}
                onClick={() => setSelectedParam(param)}
                sx={{
                  bgcolor: selectedParam === param ? 'primary.main' : 'primary.light',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                {param}
              </Button>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Parameter Editor */}
        <Box sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'grey.300', borderRadius: 1, p: 2, bgcolor: 'white' }}>
          {selectedParam ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedParam}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    Editing Parameter:{' '}
                    <Typography component="span" color="primary.main" sx={{ fontWeight: 'bold' }}>
                      {selectedParam}
                    </Typography>
                  </Typography>

                  {/* Always show "Auto Saved" message */}
                  <div className="flex justify-center">
                    <div className="flex items-center space-x-1 bg-green-50 px-3 py-1 rounded-full">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm text-green-700 font-medium">Auto-saved</span>
                    </div>
                </div>
                  <Typography variant="body2" color="text.secondary">
                    Available in Hooks as: <code>{selectedParam}</code>
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={10}
                  variant="outlined"
                  value={parameterValue}
                  onChange={(e) => setParameterValue(e.target.value)}
                  placeholder={`Enter a value for ${selectedParam}...
                    Examples:
                    - JSON: {"key": "value"}
                    - String: "example string"
                    - Number: 123
                    - Boolean: true`}
                  sx={{ flex: 1, fontFamily: 'monospace' }}
                  InputProps={{
                    sx: { height: '100%' },
                  }}
                  inputProps={{
                    sx: { height: '100% !important' },
                  }}
                />
              </motion.div>
            </AnimatePresence>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'grey.50', border: 1, borderColor: 'grey.300', borderRadius: 1 }}>
              <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  No parameter selected
                </Typography>
                <Typography variant="body2">Add a new parameter or select an existing one to start editing</Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}