import React, { useState, useEffect } from 'react';
import { useRecoilState, useResetRecoilState } from 'recoil';
import { dataSourceAtomFamily } from '../recoil/DataSourceFamily';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { dataSourceNamesState } from '../recoil/DataSourceTracker';
import {
  Box,
  Button,
  TextField,
  Typography,
  List,
  ListItem,
  IconButton,
  Collapse,
  Paper,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Clear as ClearIcon,
  KeyboardArrowDown as ExpandMoreIcon,
  KeyboardArrowRight as ChevronRightIcon,
  PlayArrow as PlayArrowIcon,
  DataObject as DataObjectIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

interface QueryResult {
  success: boolean;
  data?: any[];
  rowCount?: number;
  query?: string;
  message?: string;
  error?: string;
}

interface AlertState {
  show: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export default function AddDataSourceMui() {
  const [selectedDS, setSelectedDS] = useState<string>('');
  const [newDSName, setNewDSName] = useState<string>('');
  const [dataSourceNames, setDataSourceNames] =
    useRecoilState(dataSourceNamesState);
  const [isDataSourcesCollapsed, setIsDataSourcesCollapsed] =
    useState<boolean>(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [alert, setAlert] = useState<AlertState>({
    show: false,
    message: '',
    severity: 'success',
  });

  // Connection dropdowns
  const [connectionNames, setConnectionNames] = useState<[]>([]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<Number | ''>(
    ''
  );
  const [connectionType, setConnectionType] = useState<string>('Live');

  // Edit functionality states
  const [editingDS, setEditingDS] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');

  // Use a conditional Recoil state hook to get/set the query for the selected data source.
  const [sqlQuery, setSqlQuery] = useRecoilState(dataSourceAtomFamily(selectedDS));

  const showAlert = (
    message: string,
    severity: AlertState['severity'] = 'success'
  ) => {
    setAlert({ show: true, message, severity });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  const fetchConnectionNames = async () => {
    try {
      const connectionNames = await axios.get(
        'http://localhost:3002/all-connections'
      );
      const fetchedConnectionNames = connectionNames.data.connections;
      setConnectionNames(fetchedConnectionNames);
      console.log('Fetched connection names', connectionNames.data.connections);
      if (fetchedConnectionNames.length > 0) {
        setSelectedConnectionId(fetchedConnectionNames[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch connection names', err);
      showAlert('Failed to fetch connection names', 'error');
    }
  };

  useEffect(() => {
    fetchConnectionNames();
  }, []);

  const addDataSource = (): void => {
    if (newDSName && !dataSourceNames.includes(newDSName)) {
      setDataSourceNames((prev: string[]) => [...prev, newDSName]);
      setSelectedDS(newDSName);
      setNewDSName('');
      showAlert(`Data source "${newDSName}" added successfully`, 'success');
    }
  };

  const resetDataSource = useResetRecoilState(dataSourceAtomFamily(selectedDS));

  const removeDataSource = async (dsName: string): Promise<void> => {
    try {
      const response = await axios.post(
        'http://localhost:3002/remove-data-source',
        { dsName }
      );
      if (response) {
        setDataSourceNames((prev: string[]) =>
          prev.filter((name) => name !== dsName)
        );
        if (selectedDS === dsName) {
          setSelectedDS(dataSourceNames[0] || '');
        }
        resetDataSource();
        showAlert(`Data source "${dsName}" removed successfully`, 'success');
      }
    } catch (err) {
      console.error('Failed to remove data source', err);
      showAlert('Failed to remove data source', 'error');
    }
  };

  // Edit data source name functionality
  const startEditingDS = (dsName: string): void => {
    setEditingDS(dsName);
    setEditedName(dsName);
  };

  const saveEditedDS = async (): Promise<void> => {
    if (!editedName.trim() || editedName === editingDS) {
      setEditingDS(null);
      return;
    }

    // Check if new name already exists
    if (dataSourceNames.includes(editedName)) {
      showAlert('Data source name already exists', 'error');
      return;
    }

    try {
      // Update in backend if needed
      const response = await axios.post(
        'http://localhost:3002/rename-data-source',
        {
          oldName: editingDS,
          newName: editedName,
        }
      );

      if (response) {
        // Update local state
        setDataSourceNames((prev: string[]) =>
          prev.map((name) => (name === editingDS ? editedName : name))
        );

        // Update selected if it was the one being edited
        if (selectedDS === editingDS) {
          setSelectedDS(editedName);
        }

        showAlert(`Data source renamed to "${editedName}"`, 'success');
        setEditingDS(null);
      }
    } catch (err) {
      console.error('Failed to rename data source', err);
      showAlert('Failed to rename data source', 'error');
    }
  };

  const cancelEditingDS = (): void => {
    setEditingDS(null);
    setEditedName('');
  };

  const executeQuery = async (): Promise<void> => {
    if (!sqlQuery.trim()) {
      setError('Please enter a SQL query');
      return;
    }

    setIsLoading(true);
    setError('');
    setQueryResult(null);
    setPage(0);

    try {
      const response = await axios.post(
        'http://localhost:3002/execute-query',
        {
          query: sqlQuery,
          dataSourceName: selectedDS,
          connectionId: selectedConnectionId,
          connectionType: connectionType,
        }
      );

      const result = response.data;
      if (result.success) {
        setQueryResult(result);
        showAlert('Query executed successfully', 'success');
      } else {
        setError(result.error || 'Query execution failed');
      }
    } catch (err) {
      let errorMessage = 'Failed to execute query';
      if (axios.isAxiosError(err)) {
        errorMessage = err.response?.data?.error || err.message || errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQueryKeyPress = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      executeQuery();
    }
  };

  const handleChangePage = (event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  useEffect(() => {
    if (!selectedDS && dataSourceNames.length > 0) {
      setSelectedDS(dataSourceNames[0]);
    }
  }, [dataSourceNames, selectedDS]);

  const getTableColumns = () => {
    if (!queryResult?.data || queryResult.data.length === 0) return [];
    return Object.keys(queryResult.data[0]);
  };

  const tableColumns = getTableColumns();
  const paginatedData = queryResult?.data
    ? queryResult.data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : [];

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(12, 1fr)',
        gap: 3,
        p: 3,
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
      }}
    >
      {/* Data Sources Panel */}
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
          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)'
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
          onClick={() => setIsDataSourcesCollapsed(!isDataSourcesCollapsed)}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', letterSpacing: 0.5 }}>
            Data Sources
          </Typography>
          {isDataSourcesCollapsed ? (
            <ChevronRightIcon sx={{ color: 'white' }} />
          ) : (
            <ExpandMoreIcon sx={{ color: 'white' }} />
          )}
        </Box>

        {/* Collapsible Content */}
        <AnimatePresence>
          {!isDataSourcesCollapsed && (
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
              <Box
                sx={{
                  p: 2.5,
                  flex: 1,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
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

                {/* Add new data source */}
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
                    Add New Source
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <TextField
                      fullWidth
                      size="small"
                      variant="outlined"
                      value={newDSName}
                      onChange={(e) => setNewDSName(e.target.value)}
                      placeholder="e.g., ds1, ds2, ds3"
                      onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                        e.key === 'Enter' && addDataSource()
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
                      onClick={addDataSource}
                      disabled={
                        !newDSName || dataSourceNames.includes(newDSName)
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

                {/* List of data sources */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {dataSourceNames.length === 0 ? (
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
                        <DataObjectIcon sx={{ fontSize: 32, color: '#667eea', opacity: 0.6 }} />
                      </Box>
                      <Typography
                        variant="body2"
                        color="#64748b"
                        sx={{ fontWeight: 600 }}
                      >
                        No data sources yet
                      </Typography>
                      <Typography variant="caption" color="#94a3b8">
                        Create your first data source above
                      </Typography>
                    </Box>
                  ) : (
                    <List disablePadding>
                      {dataSourceNames.map((ds: string) => (
                        <ListItem
                          key={ds}
                          disablePadding
                          sx={{
                            mb: 1.5,
                            borderRadius: 2,
                            background:
                              selectedDS === ds
                                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                            color: selectedDS === ds ? 'white' : '#667eea',
                            border: '1px solid',
                            borderColor: selectedDS === ds ? 'transparent' : 'rgba(102, 126, 234, 0.3)',
                            boxShadow: selectedDS === ds ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                            '&:hover': {
                              background: selectedDS === ds
                                ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.2) 0%, rgba(118, 75, 162, 0.2) 100%)',
                            },
                            cursor: editingDS === ds ? 'default' : 'pointer',
                            transition: 'all 0.2s',
                          }}
                          onClick={() => editingDS !== ds && setSelectedDS(ds)}
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
                            {editingDS === ds ? (
                              <>
                                <TextField
                                  size="small"
                                  value={editedName}
                                  onChange={(e) => setEditedName(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyPress={(e) => {
                                    e.stopPropagation();
                                    if (e.key === 'Enter') saveEditedDS();
                                    if (e.key === 'Escape') cancelEditingDS();
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
                                      saveEditedDS();
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
                                      cancelEditingDS();
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
                                  {ds}
                                </Typography>
                                <Tooltip title="Edit name">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingDS(ds);
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
                                      removeDataSource(ds);
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

        {/* Always visible data source names when collapsed */}
        <Collapse in={isDataSourcesCollapsed}>
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
            {dataSourceNames.map((ds: string) => (
              <Button
                key={ds}
                size="small"
                variant={selectedDS === ds ? 'contained' : 'outlined'}
                onClick={() => setSelectedDS(ds)}
                sx={{
                  background:
                    selectedDS === ds
                      ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                      : 'transparent',
                  color: selectedDS === ds ? 'white' : '#667eea',
                  borderColor: '#667eea',
                  fontWeight: 600,
                  '&:hover': {
                    background: selectedDS === ds
                      ? 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)'
                      : 'rgba(102, 126, 234, 0.05)',
                  },
                }}
              >
                {ds}
              </Button>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* Right Side Content */}
      <Box
        sx={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {!selectedDS ? (
          
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
              backdropFilter: 'blur(10px)',
              border: '2px dashed rgba(102, 126, 234, 0.3)',
              borderRadius: 3,
              boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
            }}
          >
            <Box
              sx={{ textAlign: 'center', maxWidth: 500, px: 4 }}
            >
              <Box
                sx={{
                  width: 96,
                  height: 96,
                  margin: '0 auto 24px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DataObjectIcon sx={{ fontSize: 48, color: '#667eea', opacity: 0.6 }} />
              </Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  mb: 2, 
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                No Data Source Selected
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: '#64748b' }}>
                Select an existing data source from the left panel or create a
                new one to start building your queries.
              </Typography>
              <Typography variant="body2" color="#94a3b8">
                Once a data source is selected, you'll be able to write and
                execute SQL queries to interact with your data.
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {/* SQL Query Section */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 3,
                  pb: 2,
                  borderBottom: '2px solid',
                  borderImage: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%) 1',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                {/* Left side: Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                    }}
                  >
                    <DataObjectIcon sx={{ color: 'white', fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b' }}>
                      SQL Query Editor
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#667eea',
                        fontWeight: 600,
                      }}
                    >
                      {selectedDS}
                    </Typography>
                  </Box>
                </Box>

                {/* Right side: Controls */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="contained"
                    sx={{ 
                    textTransform: 'none',
                    fontWeight: 700,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                    },
                    }}
                >
                    Generate Queries with AI
                </Button>
                  {/* Connection Name Dropdown */}
                  <FormControl 
                    size="small" 
                    sx={{ 
                      minWidth: 180,
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
                    <InputLabel id="connection-select-label">
                      Connection
                    </InputLabel>
                    <Select
                      labelId="connection-select-label"
                      id="connection-select"
                      value={selectedConnectionId}
                      label="Connection"
                      onChange={(e) =>
                        setSelectedConnectionId(Number(e.target.value))
                      }
                    >
                      {connectionNames.map((conn: any) => (
                        <MenuItem key={conn.id} value={conn.id}>
                          {conn.connectionName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {/* Connection Type Dropdown */}
                  <FormControl 
                    size="small" 
                    sx={{ 
                      minWidth: 120,
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
                    <InputLabel id="connection-type-label">Type</InputLabel>
                    <Select
                      labelId="connection-type-label"
                      id="connection-type"
                      value={connectionType}
                      label="Type"
                      onChange={(e) => setConnectionType(e.target.value)}
                    >
                      <MenuItem value="Live">Live</MenuItem>
                      <MenuItem value="Extract">Extract</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Execute Button */}
                  <Button
                    variant="contained"
                    size="large"
                    onClick={executeQuery}
                    disabled={isLoading || !sqlQuery.trim()}
                    startIcon={
                      isLoading ? (
                        <CircularProgress size={20} color="inherit" />
                      ) : (
                        <PlayArrowIcon />
                      )
                    }
                    sx={{
                      px: 3,
                      py: 1.25,
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                        boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                      },
                      '&.Mui-disabled': {
                        background: '#e2e8f0',
                      },
                    }}
                  >
                    {isLoading ? 'Executing...' : 'Execute'}
                  </Button>
                </Box>
              </Box>

              {/* Query Input with enhanced styling */}
              <Box
                sx={{
                  position: 'relative',
                  border: '2px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:focus-within': {
                    borderColor: '#667eea',
                    boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                {/* Line numbers */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 48,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    borderRight: '1px solid rgba(102, 126, 234, 0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    pt: 1.5,
                    gap: 0.5,
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <Typography
                      key={i + 1}
                      variant="caption"
                      sx={{
                        color: '#94a3b8',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
                        fontWeight: 600,
                      }}
                    >
                      {i + 1}
                    </Typography>
                  ))}
                </Box>

                <TextField
                  fullWidth
                  multiline
                  rows={12}
                  variant="standard"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="Enter your SQL query here...

Example:
SELECT * FROM users 
WHERE age > 18
ORDER BY created_at DESC;

Press Ctrl+Enter to execute"
                  sx={{
                    '& .MuiInputBase-root': {
                      fontFamily: '"Fira Code", "Courier New", monospace',
                      fontSize: '0.9rem',
                      lineHeight: 1.5,
                      pl: 7,
                      pr: 2,
                      py: 1.5,
                      bgcolor: 'white',
                    },
                    '& .MuiInputBase-root:before, & .MuiInputBase-root:after': {
                      display: 'none',
                    },
                  }}
                  onKeyDown={handleQueryKeyPress}
                  InputProps={{
                    disableUnderline: true,
                  }}
                />

                {/* Keyboard shortcut hint */}
                <Box
                  sx={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    px: 2,
                    py: 0.75,
                    borderRadius: 1.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                  }}
                >
                  Ctrl + Enter to execute
                </Box>
              </Box>
            </Paper>

            {/* Results Table Section */}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                maxWidth:'100%',
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.2)',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 2.5,
                  background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Query Results
                </Typography>
                {queryResult && queryResult.success && (
                  <Typography
                    variant="body2"
                    sx={{ mt: 0.5, color: '#64748b', fontWeight: 500 }}
                  >
                    {queryResult.rowCount} row(s) returned
                  </Typography>
                )}
              </Box>

              {/* Error Display */}
              {error && (
                <Box 
                  sx={{ 
                    p: 2.5,
                    background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)',
                    border: '1px solid #fca5a5',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: '#dc2626' }}
                  >
                    <strong>Error:</strong> {error}
                  </Typography>
                </Box>
              )}

              {/* Loading State */}
              {isLoading && (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={56} sx={{ color: '#667eea' }} />
                    <Typography
                      variant="body2"
                      sx={{ mt: 2, color: '#64748b', fontWeight: 600 }}
                    >
                      Executing query...
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Empty State */}
              {!queryResult && !error && !isLoading && (
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
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
                      <PlayArrowIcon sx={{ fontSize: 40, color: '#667eea', opacity: 0.6 }} />
                    </Box>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, color: '#475569' }}>
                      No query results yet
                    </Typography>
                    <Typography variant="body2" color="#94a3b8">
                      Execute a SQL query to see results here
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Results Table */}
              {queryResult && queryResult.success && !isLoading && (
                <>
                  <TableContainer 
                  sx={{ 
                    flex: 1,
                    overflow:'auto',
                    maxWidth: '100%', 
                    '& .MuiTable-root': { 
                      tableLayout: 'fixed', 
                    } 
                    }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          {tableColumns.map((column) => (
                            <TableCell
                              key={column}
                              sx={{
                                fontWeight: 700,
                                background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                borderBottom: '2px solid rgba(102, 126, 234, 0.3)',
                                color: '#1e293b',
                                maxWidth: 200, 
                                overflow: 'hidden',
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap', 
                              }}
                            >
                              {column}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedData.map((row, rowIndex) => (
                          <TableRow
                            key={rowIndex}
                            sx={{ 
                              '&:hover': { 
                                bgcolor: 'rgba(102, 126, 234, 0.05)',
                              } 
                            }}
                          >
                            {tableColumns.map((column) => (
                              <TableCell key={column} 
                                sx={{ color: '#475569',    
                                maxWidth: 200, 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                whiteSpace: 'nowrap',
                             }}>
                                {typeof row[column] === 'object'
                                  ? JSON.stringify(row[column])
                                  : String(row[column] ?? '')}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <TablePagination
                    component="div"
                    count={queryResult.data?.length || 0}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[5, 10, 25, 50, 100]}
                    sx={{ 
                      borderTop: '1px solid rgba(102, 126, 234, 0.2)',
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                      '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                        color: '#64748b',
                        fontWeight: 600,
                      }
                    }}
                  />
                </>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}