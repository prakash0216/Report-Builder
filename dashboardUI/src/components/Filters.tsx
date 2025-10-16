import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  Grid,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  Chip,
  Alert,
  Collapse,
  Divider,
  Tooltip,
  Fade,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useRecoilState, useRecoilValue } from 'recoil';
import { allFiltersAtom, FilterConfig } from '../recoil/FilterState';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { parameterNamesState } from '../recoil/ParameterTracker';

type Category = 'params' | 'filters' | 'hooks';

const CascadingDropdown: React.FC = () => {
  const [allFilters, setAllFilters] = useRecoilState(allFiltersAtom);
  
  // Local UI state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [mainCategory, setMainCategory] = useState<string>('');
  const [selectedParam, setSelectedParam] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [variableName, setVariableName] = useState<string>('');
  const [selectionType, setSelectionType] = useState<'single' | 'multi'>('single');
  const [defaultSingleValue, setDefaultSingleValue] = useState<string>('');
  const [defaultMultiValues, setDefaultMultiValues] = useState<(string | number)[]>([]);

  const parameterNames = useRecoilValue(parameterNamesState);

  const categories: Record<Category, string[]> = {
    params: parameterNames,
    filters: ['statusFilter', 'typeFilter', 'priorityFilter'],
    hooks: ['beforeLoad', 'afterLoad', 'onError'],
  };

  const paramValues: Record<string, (string | number)[]> = {
    topN: [5, 10, 20, 50, 100],
    test: ['Option A', 'Option B', 'Option C'],
    category: ['Sales', 'Marketing', 'Engineering', 'HR'],
    dateRange: ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'Custom'],
    statusFilter: ['Active', 'Inactive', 'Pending', 'Archived'],
    typeFilter: ['Type A', 'Type B', 'Type C', 'Type D'],
    priorityFilter: ['Low', 'Medium', 'High', 'Critical'],
    beforeLoad: ['validateData', 'checkAuth', 'setLoading'],
    afterLoad: ['processData', 'updateCache', 'notify'],
    onError: ['logError', 'showAlert', 'retry'],
  };

  const handleMainCategoryChange = (event: SelectChangeEvent<string>) => {
    setMainCategory(event.target.value);
    setSelectedParam('');
    resetParamConfig();
  };

  const handleParamChange = (event: SelectChangeEvent<string>) => {
    const param = event.target.value;
    setSelectedParam(param);
    setVariableName(`f_${param}`);
    setDisplayName(
      param.charAt(0).toUpperCase() +
        param.slice(1).replace(/([A-Z])/g, ' $1').trim()
    );
    setDefaultSingleValue('');
    setDefaultMultiValues([]);
  };

  const resetParamConfig = () => {
    setDisplayName('');
    setVariableName('');
    setSelectionType('single');
    setDefaultSingleValue('');
    setDefaultMultiValues([]);
  };

  const handleMultiSelectChange = (value: string | number) => {
    setDefaultMultiValues((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const getAvailableValues = (): (string | number)[] => {
    return paramValues[selectedParam] || [];
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const handleSaveConfiguration = () => {
    const defaultValues =
      selectionType === 'single'
        ? defaultSingleValue
          ? [defaultSingleValue]
          : []
        : defaultMultiValues;

    const configId = variableName;
    const newConfig: FilterConfig = {
      id: configId,
      category: mainCategory,
      paramName: selectedParam,
      displayName,
      variableName: configId,
      selectionType,
      defaultValues,
      availableOptions: getAvailableValues()
    };

    // Save to atom (filterId as key)
    setAllFilters(prev => ({
      ...prev,
      [configId]: newConfig
    }));

    showSuccess(editingId ? 'Filter updated successfully!' : 'Filter created successfully!');
    
    // Reset form
    setMainCategory('');
    setSelectedParam('');
    resetParamConfig();
    setEditingId(null);
  };

  const handleEditFilter = (config: FilterConfig) => {
    setEditingId(config.variableName);
    setMainCategory(config.category);
    setSelectedParam(config.paramName);
    setDisplayName(config.displayName);
    setVariableName(config.variableName);
    setSelectionType(config.selectionType);
    
    if (config.selectionType === 'single') {
      setDefaultSingleValue(config.defaultValues[0]?.toString() || '');
      setDefaultMultiValues([]);
    } else {
      setDefaultMultiValues(config.defaultValues);
      setDefaultSingleValue('');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteFilter = (variableName: string) => {
    // Remove from atom
    setAllFilters(prev => {
      const { [variableName]: removed, ...rest } = prev;
      return rest;
    });
    
    showSuccess('Filter deleted successfully!');
  };

  const toggleFilterExpanded = (variableName: string) => {
    setExpandedFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(variableName)) {
        newSet.delete(variableName);
      } else {
        newSet.add(variableName);
      }
      return newSet;
    });
  };

  const handleCancelEdit = () => {
    setMainCategory('');
    setSelectedParam('');
    resetParamConfig();
    setEditingId(null);
  };

  const isConfigValid = (): boolean => {
    const filterIds = Object.keys(allFilters);
    const isDuplicate = !editingId && filterIds.includes(variableName);
    
    return !!(
      mainCategory &&
      selectedParam &&
      displayName.trim() &&
      variableName.trim() &&
      !isDuplicate &&
      (selectionType === 'single' ? defaultSingleValue : defaultMultiValues.length > 0)
    );
  };

  const getCategoryColor = (category: string): 'primary' | 'secondary' | 'info' | 'default' => {
    const colors: Record<string, 'primary' | 'secondary' | 'info' | 'default'> = {
      params: 'primary',
      filters: 'secondary',
      hooks: 'info',
    };
    return colors[category] || 'default';
  };

  // Get all filter IDs and configs
  const filterIds = Object.keys(allFilters);
  const savedConfigs = Object.values(allFilters);

  // Filter by search term
  const filteredConfigs = savedConfigs.filter(config =>
    config.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    config.paramName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    config.variableName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Container maxWidth={false} disableGutters sx={{ py: 3, px: 3, bgcolor: 'grey.50', minHeight: '100vh' }}>
      <Fade in={!!successMessage}>
        <Alert 
          severity="success" 
          sx={{ 
            mb: 3, 
            display: successMessage ? 'flex' : 'none',
            boxShadow: 2,
          }}
          icon={<CheckCircleIcon />}
        >
          {successMessage}
        </Alert>
      </Fade>

      <Grid container spacing={3}>
        {/* Configuration Form */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={3} sx={{ position: 'sticky', top: 16 }}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  {editingId ? 'Edit Filter' : 'Create New Filter'}
                </Typography>
                {editingId && (
                  <Button
                    size="small"
                    onClick={handleCancelEdit}
                    sx={{ textTransform: 'none' }}
                  >
                    Cancel Edit
                  </Button>
                )}
              </Box>

              <Box display="flex" flexDirection="column" gap={3}>
                {/* Main Category */}
                <FormControl fullWidth>
                  <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                    Main Category *
                  </FormLabel>
                  <Select
                    value={mainCategory}
                    onChange={handleMainCategoryChange}
                    displayEmpty
                    sx={{ bgcolor: 'white' }}
                  >
                    <MenuItem value="" disabled>Select a category...</MenuItem>
                    <MenuItem value="params">📊 Params</MenuItem>
                    <MenuItem value="filters">🔍 Filters</MenuItem>
                    <MenuItem value="hooks">⚡ Hooks</MenuItem>
                  </Select>
                </FormControl>

                {/* Select Parameter */}
                {mainCategory && (
                  <Collapse in={!!mainCategory}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                        Select Parameter *
                      </FormLabel>
                      <Select
                        value={selectedParam}
                        onChange={handleParamChange}
                        displayEmpty
                        sx={{ bgcolor: 'white' }}
                      >
                        <MenuItem value="" disabled>Choose a parameter...</MenuItem>
                        {categories[mainCategory as Category]?.map((param) => (
                          <MenuItem key={param} value={param}>
                            {param}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Collapse>
                )}

                {/* Additional Fields */}
                {selectedParam && (
                  <Collapse in={!!selectedParam}>
                    <Box display="flex" flexDirection="column" gap={3}>
                      {/* Display Name */}
                      <FormControl fullWidth>
                        <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                          Display Name *
                        </FormLabel>
                        <TextField
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="e.g., Top Payer"
                          fullWidth
                          sx={{ bgcolor: 'white' }}
                        />
                        <Typography variant="caption" color="text.secondary" mt={0.5}>
                          User-facing label for this filter
                        </Typography>
                      </FormControl>

                      {/* Variable Name */}
                      <FormControl fullWidth>
                        <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                          Variable Name (ID) *
                        </FormLabel>
                        <TextField
                          value={variableName}
                          onChange={(e) => setVariableName(e.target.value)}
                          fullWidth
                          sx={{ bgcolor: editingId ? 'grey.100' : 'white' }}
                          slotProps={{
                            input: {
                              startAdornment: (
                                <Typography
                                  component="span"
                                  fontWeight={700}
                                  color="primary.main"
                                  mr={0.5}
                                >
                                  $
                                </Typography>
                              ),
                            },
                          }}
                        />
                        <Typography variant="caption" color={
                          !editingId && filterIds.includes(variableName) && variableName
                            ? 'error.main'
                            : 'text.secondary'
                        } mt={0.5}>
                          {!editingId && filterIds.includes(variableName) && variableName
                            ? '⚠️ Variable name already exists!'
                            : `Reference in code: \${${variableName}} • Must be unique`}
                        </Typography>
                      </FormControl>

                      {/* Selection Type */}
                      <FormControl>
                        <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                          Selection Type *
                        </FormLabel>
                        <RadioGroup
                          row
                          value={selectionType}
                          onChange={(e) => {
                            setSelectionType(e.target.value as 'single' | 'multi');
                            setDefaultSingleValue('');
                            setDefaultMultiValues([]);
                          }}
                        >
                          <FormControlLabel
                            value="single"
                            control={<Radio />}
                            label="Single Select"
                            sx={{ 
                              bgcolor: selectionType === 'single' ? 'primary.50' : 'transparent',
                              borderRadius: 1,
                              px: 1,
                              mr: 2,
                            }}
                          />
                          <FormControlLabel
                            value="multi"
                            control={<Radio />}
                            label="Multi Select"
                            sx={{ 
                              bgcolor: selectionType === 'multi' ? 'primary.50' : 'transparent',
                              borderRadius: 1,
                              px: 1,
                            }}
                          />
                        </RadioGroup>
                      </FormControl>

                      {/* Default Value(s) */}
                      <FormControl fullWidth>
                        <FormLabel sx={{ mb: 1, fontWeight: 600, fontSize: '0.875rem', color: 'text.primary' }}>
                          Default Value(s) *
                        </FormLabel>
                        {selectionType === 'single' ? (
                          <Select
                            value={defaultSingleValue}
                            onChange={(e) => setDefaultSingleValue(e.target.value)}
                            displayEmpty
                            sx={{ bgcolor: 'white' }}
                          >
                            <MenuItem value="" disabled>Select default value...</MenuItem>
                            {getAvailableValues().map((value) => (
                              <MenuItem key={value} value={value}>
                                {value}
                              </MenuItem>
                            ))}
                          </Select>
                        ) : (
                          <FormGroup
                            sx={{
                              p: 2,
                              bgcolor: 'white',
                              borderRadius: 1,
                              border: 1,
                              borderColor: 'grey.300',
                              maxHeight: 200,
                              overflow: 'auto',
                            }}
                          >
                            {getAvailableValues().map((value) => (
                              <FormControlLabel
                                key={value}
                                control={
                                  <Checkbox
                                    checked={defaultMultiValues.includes(value)}
                                    onChange={() => handleMultiSelectChange(value)}
                                  />
                                }
                                label={value.toString()}
                              />
                            ))}
                          </FormGroup>
                        )}
                        <Typography variant="caption" color="text.secondary" mt={0.5}>
                          {selectionType === 'single' 
                            ? 'Choose one default option' 
                            : `${defaultMultiValues.length} option(s) selected`}
                        </Typography>
                      </FormControl>

                      {/* Save Button */}
                      <Button
                        variant="contained"
                        onClick={handleSaveConfiguration}
                        disabled={!isConfigValid()}
                        fullWidth
                        size="large"
                        sx={{ 
                          mt: 1, 
                          py: 1.5,
                          fontWeight: 600,
                          fontSize: '1rem',
                        }}
                      >
                        {editingId ? 'Update Filter' : 'Save Configuration'}
                      </Button>
                    </Box>
                  </Collapse>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Saved Configurations */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={3}>
            <CardContent sx={{ p: 3 }}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  Saved Filters
                </Typography>
                <Chip 
                  label={filteredConfigs.length} 
                  color="primary" 
                  size="small"
                  sx={{ fontWeight: 600 }}
                />
              </Box>

              {savedConfigs.length > 3 && (
                <TextField
                  placeholder="Search filters..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 2, bgcolor: 'white' }}
                />
              )}

              {filteredConfigs.length === 0 ? (
                <Box textAlign="center" py={8} color="text.secondary">
                  <Typography variant="h6" fontWeight={500} mb={1}>
                    {searchTerm ? 'No filters found' : 'No filters configured yet'}
                  </Typography>
                  <Typography variant="body2">
                    {searchTerm 
                      ? 'Try a different search term' 
                      : 'Create your first filter using the form'}
                  </Typography>
                </Box>
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {filteredConfigs.map((config) => (
                    <Card
                      key={config.variableName}
                      variant="outlined"
                      sx={{
                        bgcolor: 'white',
                        border: 2,
                        borderColor: editingId === config.variableName ? 'primary.main' : 'grey.200',
                        transition: 'all 0.2s',
                        '&:hover': {
                          boxShadow: 3,
                          borderColor: 'primary.light',
                        },
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          mb={1.5}
                        >
                          <Box flex={1}>
                            <Typography variant="h6" fontWeight={700} mb={0.5}>
                              {config.displayName}
                            </Typography>
                            <Box display="flex" gap={1} alignItems="center">
                              <Chip
                                label={config.category}
                                size="small"
                                color={getCategoryColor(config.category)}
                                sx={{ fontSize: '0.75rem', height: 22 }}
                              />
                              <Typography variant="caption" color="text.secondary">
                                {config.paramName}
                              </Typography>
                            </Box>
                          </Box>
                          <Box display="flex" gap={0.5}>
                            <Tooltip title="Edit">
                              <IconButton
                                size="small"
                                onClick={() => handleEditFilter(config)}
                                sx={{
                                  bgcolor: 'primary.50',
                                  color: 'primary.main',
                                  '&:hover': { bgcolor: 'primary.100' },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteFilter(config.variableName)}
                                sx={{
                                  bgcolor: 'error.50',
                                  color: 'error.main',
                                  '&:hover': { bgcolor: 'error.100' },
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        <Box display="flex" flexDirection="column" gap={1}>
                          <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Box display="flex" alignItems="center" gap={1} flex={1}>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                color="text.secondary"
                                sx={{ minWidth: 70 }}
                              >
                                Variable:
                              </Typography>
                              <Typography
                                component="code"
                                variant="body2"
                                sx={{
                                  px: 1,
                                  py: 0.5,
                                  bgcolor: 'grey.100',
                                  borderRadius: 0.5,
                                  fontFamily: 'monospace',
                                  fontSize: '0.8rem',
                                }}
                              >
                                ${`{${config.variableName}}`}
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              onClick={() => toggleFilterExpanded(config.variableName)}
                            >
                              {expandedFilters.has(config.variableName) ? (
                                <ExpandLessIcon fontSize="small" />
                              ) : (
                                <ExpandMoreIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Box>

                          <Collapse in={expandedFilters.has(config.variableName)}>
                            <Box display="flex" flexDirection="column" gap={1} mt={1}>
                              <Box display="flex" alignItems="center" gap={1}>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color="text.secondary"
                                  sx={{ minWidth: 70 }}
                                >
                                  Type:
                                </Typography>
                                <Chip
                                  label={config.selectionType === 'single' ? 'Single Select' : 'Multi Select'}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.75rem', height: 22 }}
                                />
                              </Box>

                              <Box display="flex" alignItems="flex-start" gap={1}>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color="text.secondary"
                                  sx={{ minWidth: 70, mt: 0.5 }}
                                >
                                  Defaults:
                                </Typography>
                                <Box display="flex" flexWrap="wrap" gap={0.75}>
                                  {config.defaultValues.map((val) => (
                                    <Chip
                                      key={val}
                                      label={val}
                                      size="small"
                                      color="success"
                                      sx={{ fontSize: '0.75rem', height: 22, mt :0.5 }}
                                    />
                                  ))}
                                </Box>
                              </Box>

                              <Box display="flex" alignItems="flex-start" gap={1}>
                                <Typography
                                  variant="body2"
                                  fontWeight={600}
                                  color="text.secondary"
                                  sx={{ minWidth: 70, mt: 0.5 }}
                                >
                                  Options:
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{mt:0.5}}>
                                  {config.availableOptions.length} available
                                </Typography>
                              </Box>
                            </Box>
                          </Collapse>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
};

export default CascadingDropdown;
