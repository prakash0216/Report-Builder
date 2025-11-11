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
  Alert, // Added for in-panel alerts
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
        gap: 2,
        p: 2,
        height: '100vh',
      }}
    >
      {/* Data Sources Panel */}
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
          onClick={() => setIsDataSourcesCollapsed(!isDataSourcesCollapsed)}
        >
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Data Sources
          </Typography>
          {isDataSourcesCollapsed ? <ChevronRightIcon /> : <ExpandMoreIcon />}
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
                  p: 2,
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
                    sx={{ mb: 2 }}
                  >
                    {alert.message}
                  </Alert>
                </Collapse>
                {/* ---------------------- */}

                {/* Add new data source */}
                <Paper variant="outlined" sx={{ mb: 2, p: 2 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ mb: 1, fontWeight: 'medium' }}
                  >
                    Add New Source
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
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
                    />
                    <Button
                      variant="contained"
                      onClick={addDataSource}
                      disabled={
                        !newDSName || dataSourceNames.includes(newDSName)
                      }
                      startIcon={<AddIcon />}
                      sx={{ minWidth: 'auto' }}
                    >
                      Add
                    </Button>
                  </Box>
                </Paper>

                {/* List of data sources */}
                <Box sx={{ flex: 1, overflowY: 'auto' }}>
                  {dataSourceNames.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontStyle: 'italic' }}
                    >
                      No data sources yet
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {dataSourceNames.map((ds: string) => (
                        <ListItem
                          key={ds}
                          disablePadding
                          sx={{
                            mb: 1,
                            borderRadius: 1,
                            bgcolor:
                              selectedDS === ds
                                ? 'primary.main'
                                : 'primary.light',
                            color: 'white',
                            '&:hover': { bgcolor: 'primary.dark' },
                            cursor: editingDS === ds ? 'default' : 'pointer',
                          }}
                          onClick={() => editingDS !== ds && setSelectedDS(ds)}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              width: '100%',
                              py: 1,
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
                                      color: 'primary.main',
                                      bgcolor: 'white',
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
                                      color: 'white',
                                      '&:hover': { color: 'success.light' },
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
                                      color: 'white',
                                      '&:hover': { color: 'error.light' },
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
                                      color: 'white',
                                      '&:hover': { color: 'warning.light' },
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
                                      color: 'white',
                                      '&:hover': { color: 'error.light' },
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
          <Box sx={{ p: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {dataSourceNames.map((ds: string) => (
              <Button
                key={ds}
                size="small"
                variant={selectedDS === ds ? 'contained' : 'text'}
                onClick={() => setSelectedDS(ds)}
                sx={{
                  bgcolor:
                    selectedDS === ds ? 'primary.main' : 'primary.light',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                  minWidth: 'auto',
                  px: 2,
                  py: 1,
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
        sx={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {!selectedDS ? (
          /* Empty State - No Data Source Selected */
          <Paper
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              sx={{ textAlign: 'center', color: 'text.secondary', maxWidth: 400 }}
            >
              <DataObjectIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography variant="h5" sx={{ mb: 1, fontWeight: 'medium' }}>
                No Data Source Selected
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Select an existing data source from the left panel or create a
                new one to start building your queries.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Once a data source is selected, you'll be able to write and
                execute SQL queries to interact with your data.
              </Typography>
            </Box>
          </Paper>
        ) : (
          <>
            {/* SQL Query Section */}
            <Paper
              elevation={2}
              sx={{
                p: 3,
                border: 1,
                borderColor: 'primary.light',
                borderRadius: 2,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                {/* Left side: Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DataObjectIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    SQL Query Editor
                    <Typography
                      component="span"
                      color="primary.main"
                      sx={{ ml: 1, fontWeight: 'bold' }}
                    >
                      ({selectedDS})
                    </Typography>
                  </Typography>
                </Box>

                {/* Right side: Controls */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    flexWrap: 'wrap',
                    ml: 'auto',
                  }}
                >
                  {/* Connection Name Dropdown */}
                  <FormControl size="small" sx={{ minWidth: 180 }}>
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
                  <FormControl size="small" sx={{ minWidth: 120 }}>
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
                      fontWeight: 600,
                      boxShadow: 2,
                      '&:hover': {
                        boxShadow: 4,
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
                  border: 2,
                  borderColor: 'grey.300',
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:focus-within': {
                    borderColor: 'primary.main',
                    boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.1)',
                  },
                }}
              >
                {/* Line numbers placeholder - could be enhanced */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 40,
                    bgcolor: 'grey.100',
                    borderRight: 1,
                    borderColor: 'grey.300',
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
                        color: 'text.secondary',
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        lineHeight: 1.5,
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
                      pl: 6,
                      pr: 2,
                      py: 1.5,
                      bgcolor: 'grey.50',
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
                    bottom: 8,
                    right: 8,
                    bgcolor: 'rgba(0, 0, 0, 0.6)',
                    color: 'white',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 1,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  Ctrl + Enter to execute
                </Box>
              </Box>
            </Paper>

            {/* Results Table Section */}
            <Paper
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Header */}
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  borderBottom: 1,
                  borderColor: 'grey.300',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                  Query Results
                </Typography>
                {queryResult && queryResult.success && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 0.5 }}
                  >
                    {queryResult.rowCount} row(s) returned
                  </Typography>
                )}
              </Box>

              {/* Error Display */}
              {error && (
                <Box sx={{ p: 2, bgcolor: 'error.50' }}>
                  <Typography
                    variant="body2"
                    color="error.main"
                    sx={{ fontWeight: 500 }}
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
                    <CircularProgress size={48} />
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mt: 2 }}
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
                  <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                      No query results yet
                    </Typography>
                    <Typography variant="body2">
                      Execute a SQL query to see results here
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Results Table */}
              {queryResult && queryResult.success && !isLoading && (
                <>
                  <TableContainer sx={{ flex: 1 }}>
                    <Table stickyHeader>
                      <TableHead>
                        <TableRow>
                          {tableColumns.map((column) => (
                            <TableCell
                              key={column}
                              sx={{
                                fontWeight: 'bold',
                                bgcolor: 'grey.100',
                                borderBottom: 2,
                                borderColor: 'grey.300',
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
                            sx={{ '&:hover': { bgcolor: 'grey.50' } }}
                          >
                            {tableColumns.map((column) => (
                              <TableCell key={column}>
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
                    sx={{ borderTop: 1, borderColor: 'grey.300' }}
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