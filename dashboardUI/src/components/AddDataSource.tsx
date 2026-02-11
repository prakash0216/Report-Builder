import React, { useState, useEffect, useRef } from 'react';
import { useRecoilState, useResetRecoilState } from 'recoil';
import { dataSourceAtomFamily } from '../recoil/DataSourceFamily';
import { motion } from 'framer-motion';
import axios from 'axios';
import { dataSourceNamesState } from '../recoil/DataSourceTracker';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Chip,
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
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/api.config';

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

  // Connection dropdowns - now unified to handle both Snowflake and CSV connectors
  const [connectors, setConnectors] = useState<any[]>([]);
  const [selectedConnectorId, setSelectedConnectorId] = useState<string | number | ''>('');
  const [selectedConnectorType, setSelectedConnectorType] = useState<'snowflake' | 'csv'>('snowflake');
  const [connectionType, setConnectionType] = useState<string>('Live');
  
  // Legacy state for backward compatibility
  const [connectionNames, setConnectionNames] = useState<any[]>([]);

  // Edit functionality states
  const [editingDS, setEditingDS] = useState<string | null>(null);
  const [editedName, setEditedName] = useState<string>('');

  // Scheduler states
  const [refreshIntervalDays, setRefreshIntervalDays] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState<boolean>(false);
  const [nextRunDateTime, setNextRunDateTime] = useState<string>('');
  const [schedulerExpanded, setSchedulerExpanded] = useState<boolean>(false);

  // Use a conditional Recoil state hook to get/set the query for the selected data source.
  const [sqlQuery, setSqlQuery] = useRecoilState(dataSourceAtomFamily(selectedDS));
  
  // Monaco Editor ref
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  // Monaco Editor mount handler
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Register SQL keywords for autocomplete
    monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model, position) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        
        // SQL Keywords
        const sqlKeywords = [
          'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
          'JOIN', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL JOIN', 'CROSS JOIN',
          'ON', 'AS', 'ORDER BY', 'GROUP BY', 'HAVING', 'LIMIT', 'OFFSET',
          'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'ALTER', 'DROP',
          'TABLE', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
          'DISTINCT', 'ALL', 'TOP', 'PERCENT',
          'ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST',
          'UNION', 'UNION ALL', 'INTERSECT', 'EXCEPT',
          'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
          'NULL', 'IS NULL', 'IS NOT NULL',
          'TRUE', 'FALSE',
          'WITH', 'RECURSIVE', 'CTE',
        ];
        
        // SQL Functions
        const sqlFunctions = [
          'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'FLOOR', 'CEIL', 'ABS',
          'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'LENGTH', 'SUBSTRING', 'CONCAT',
          'COALESCE', 'NULLIF', 'CAST', 'CONVERT', 'IFNULL', 'NVL', 'IIF',
          'DATE', 'DATETIME', 'TIME', 'YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND',
          'DATEADD', 'DATEDIFF', 'GETDATE', 'NOW', 'CURRENT_DATE', 'CURRENT_TIMESTAMP',
          'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD',
          'PARTITION BY', 'OVER',
          'STRING_AGG', 'GROUP_CONCAT', 'LISTAGG',
          'JSON_VALUE', 'JSON_QUERY', 'JSON_EXTRACT',
        ];
        
        // Data Types
        const dataTypes = [
          'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT',
          'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL', 'DOUBLE',
          'CHAR', 'VARCHAR', 'TEXT', 'NCHAR', 'NVARCHAR', 'NTEXT',
          'DATE', 'DATETIME', 'DATETIME2', 'TIME', 'TIMESTAMP',
          'BOOLEAN', 'BIT',
          'BINARY', 'VARBINARY', 'BLOB',
          'JSON', 'XML',
        ];
        
        const suggestions: any[] = [];
        
        // Add keywords
        sqlKeywords.forEach((keyword) => {
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: keyword,
            range: range,
            detail: 'SQL Keyword',
          });
        });
        
        // Add functions with snippets
        sqlFunctions.forEach((func) => {
          suggestions.push({
            label: func,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: func + '($0)',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range: range,
            detail: 'SQL Function',
          });
        });
        
        // Add data types
        dataTypes.forEach((type) => {
          suggestions.push({
            label: type,
            kind: monaco.languages.CompletionItemKind.TypeParameter,
            insertText: type,
            range: range,
            detail: 'Data Type',
          });
        });
        
        return { suggestions };
      },
    });
    
    // Add Ctrl+Enter command to execute query
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      executeQuery();
    });
  };

  const showAlert = (
    message: string,
    severity: AlertState['severity'] = 'success'
  ) => {
    setAlert({ show: true, message, severity });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  const fetchConnectors = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/all-connectors`);
      const fetchedConnectors = response.data.connectors || [];
      setConnectors(fetchedConnectors);
      
      // Also set legacy connectionNames for backward compatibility
      const snowflakeConnectors = fetchedConnectors.filter((c: any) => c.type === 'snowflake');
      setConnectionNames(snowflakeConnectors.map((c: any) => ({ id: c.snowflakeConnectionId, connectionName: c.name })));
      
      console.log('Fetched connectors:', fetchedConnectors);
      if (fetchedConnectors.length > 0) {
        const firstConnector = fetchedConnectors[0];
        setSelectedConnectorId(firstConnector.id);
        setSelectedConnectorType(firstConnector.type);
        // For CSV connectors, default to Extract mode
        if (firstConnector.type === 'csv') {
          setConnectionType('Extract');
        }
      }
    } catch (err) {
      console.error('Failed to fetch connectors', err);
      showAlert('Failed to fetch connectors', 'error');
    }
  };

  // Legacy function for backward compatibility
  const fetchConnectionNames = async () => {
    await fetchConnectors();
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  // Fetch schedule when Extract data source is selected
  useEffect(() => {
    if (selectedDS && connectionType === 'Extract') {
      fetchSchedule();
      // Initialize next run date-time to current date-time
      const now = new Date();
      const formattedDateTime = now.toISOString().slice(0, 16);
      setNextRunDateTime(formattedDateTime);
    } else {
      setRefreshIntervalDays(null);
      setLastRefreshed(null);
      setNextRunDateTime('');
    }
  }, [selectedDS, connectionType]);

  const fetchSchedule = async () => {
    if (!selectedDS) return;
    setIsLoadingSchedule(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/data-sources/${selectedDS}/schedule`
      );
      if (response.data.success) {
        setRefreshIntervalDays(response.data.refresh_interval_days);
        setLastRefreshed(response.data.last_refreshed);
      }
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Failed to fetch schedule', err);
      }
      // 404 is fine - means no schedule set yet
      setRefreshIntervalDays(null);
      setLastRefreshed(null);
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  const saveSchedule = async (days: number | null) => {
    if (!selectedDS) return;
    setIsLoadingSchedule(true);
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/data-sources/${selectedDS}/schedule`,
        { refresh_interval_days: days }
      );
      if (response.data.success) {
        setRefreshIntervalDays(days);
        showAlert(
          days 
            ? `Refresh schedule set to ${days} day(s)` 
            : 'Refresh schedule disabled',
          'success'
        );
      }
    } catch (err) {
      console.error('Failed to save schedule', err);
      showAlert('Failed to save schedule', 'error');
    } finally {
      setIsLoadingSchedule(false);
    }
  };

  // Note: Data sources are now automatically loaded from database via Recoil effect
  // No need for manual fetching here

  const addDataSource = async (): Promise<void> => {
    if (newDSName && !dataSourceNames.includes(newDSName)) {
      if (!selectedConnectorId || !connectionType) {
        showAlert('Please select a connector and connection type', 'error');
        return;
      }

      const selectedConn = connectors.find(c => c.id === selectedConnectorId);

      try {
        // Store data source in database immediately
        const response = await axios.post(
          `${API_BASE_URL}/api/datasources`,
          {
            dataSourceName: newDSName,
            connectionId: selectedConn?.type === 'snowflake' ? selectedConn.snowflakeConnectionId : null,
            csvConnectorId: selectedConn?.type === 'csv' ? selectedConn.csvConnectorId : null,
            connectionType: selectedConn?.type === 'csv' ? 'Extract' : connectionType,
            query: '' // Empty query initially
          }
        );

        if (response.data.success) {
          // Update local Recoil state
          setDataSourceNames((prev: string[]) => [...prev, newDSName]);
          setSelectedDS(newDSName);
          setNewDSName('');
          showAlert(`Data source "${newDSName}" added successfully`, 'success');
        }
      } catch (err) {
        console.error('Failed to add data source', err);
        showAlert('Failed to add data source', 'error');
      }
    }
  };

  const resetDataSource = useResetRecoilState(dataSourceAtomFamily(selectedDS));

  const removeDataSource = async (dsName: string): Promise<void> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/remove-data-source`,
        { dsName }
      );
      if (response) {
        // Also delete the parameter from database
        await axios.delete(`${API_BASE_URL}/api/parameters/${dsName}`);
        
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
      // Update in backend
      const response = await axios.post(
        `${API_BASE_URL}/api/rename-data-source`,
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
      // Find the selected connector to determine its type
      const selectedConnector = connectors.find(c => c.id === selectedConnectorId);
      const isCsvConnector = selectedConnector?.type === 'csv' || selectedConnectorType === 'csv';
      
      // Build request body based on connector type
      const requestBody: any = {
        query: sqlQuery,
        dataSourceName: selectedDS,
      };
      
      if (isCsvConnector) {
        // CSV connector - pass csvConnectorId
        requestBody.connectorType = 'csv';
        requestBody.csvConnectorId = selectedConnector?.csvConnectorId;
        requestBody.connectionType = 'Extract'; // CSV always uses Extract mode
      } else {
        // Snowflake connector
        requestBody.connectionId = selectedConnector?.snowflakeConnectionId || selectedConnectorId;
        requestBody.connectionType = connectionType;
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/api/execute-query`,
        requestBody
      );

      const result = response.data;
      if (result.success) {
        setQueryResult(result);
        
        // After successful query execution, ensure the data source name is in the list
        if (!dataSourceNames.includes(selectedDS)) {
          setDataSourceNames((prev: string[]) => [...prev, selectedDS]);
        }
        
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

  // Load data source details when a data source is selected
  useEffect(() => {
    const loadDataSourceDetails = async () => {
      if (!selectedDS) return;

      try {
        const response = await axios.get(`${API_BASE_URL}/api/datasources/${selectedDS}`);
        if (response.data.success && response.data.dataSource) {
          const ds = response.data.dataSource;
          
          // Handle CSV connector if csv_connector_id exists
          if (ds.csvConnectorId && connectors.length > 0) {
            const csvConnector = connectors.find(c => c.type === 'csv' && c.csvConnectorId === ds.csvConnectorId);
            if (csvConnector) {
              setSelectedConnectorId(csvConnector.id);
              setSelectedConnectorType('csv');
              setConnectionType('Extract');
              return;
            }
          }
          
          // Handle Snowflake connection if connectionId exists
          if (ds.connectionId && connectors.length > 0) {
            const snowflakeConnector = connectors.find(c => c.type === 'snowflake' && c.snowflakeConnectionId === ds.connectionId);
            if (snowflakeConnector) {
              setSelectedConnectorId(snowflakeConnector.id);
              setSelectedConnectorType('snowflake');
            } else if (connectors.length > 0) {
              // Connection doesn't exist, use first available
              const firstConn = connectors[0];
              setSelectedConnectorId(firstConn.id);
              setSelectedConnectorType(firstConn.type);
            }
          } else if (connectors.length > 0) {
            // No connection set, use first available
            const firstConn = connectors[0];
            setSelectedConnectorId(firstConn.id);
            setSelectedConnectorType(firstConn.type);
          }
          
          if (ds.connectionType) {
            setConnectionType(ds.connectionType);
          }
        }
      } catch (err) {
        // Data source might not exist yet (newly created), that's okay
        console.log('Data source details not found, using defaults');
        // Set default connector if available
        if (connectors.length > 0 && !selectedConnectorId) {
          const firstConn = connectors[0];
          setSelectedConnectorId(firstConn.id);
          setSelectedConnectorType(firstConn.type);
        }
      }
    };

    loadDataSourceDetails();
  }, [selectedDS, connectors]);

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
        bgcolor: '#F8FAFC',
      }}
    >
      {/* Data Sources Panel */}
      <Box
        sx={{
          gridColumn: 'span 3',
          bgcolor: '#FFFFFF',
          border: '1px solid #E5E7EB',
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
            bgcolor: '#3B82F6',
            cursor: 'pointer',
            borderRadius: '12px 12px 0 0',
            '&:hover': {
              bgcolor: '#2563EB',
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
                      bgcolor: '#3B82F6',
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
                            borderColor: '#3B82F6',
                          },
                          '&.Mui-focused fieldset': {
                            borderColor: '#3B82F6',
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
                        bgcolor: '#3B82F6',
                        '&:hover': {
                          bgcolor: '#2563EB',
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
                        <DataObjectIcon sx={{ fontSize: 32, color: '#3B82F6', opacity: 0.6 }} />
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
                                ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                                : 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                            color: selectedDS === ds ? 'white' : '#3B82F6',
                            border: '1px solid',
                            borderColor: selectedDS === ds ? 'transparent' : 'rgba(102, 126, 234, 0.3)',
                            boxShadow: selectedDS === ds ? '0 4px 15px rgba(102, 126, 234, 0.3)' : 'none',
                            '&:hover': {
                              background: selectedDS === ds
                                ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
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
                                      color: '#3B82F6',
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
                      ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                      : 'transparent',
                  color: selectedDS === ds ? 'white' : '#3B82F6',
                  borderColor: '#3B82F6',
                  fontWeight: 600,
                  '&:hover': {
                    background: selectedDS === ds
                      ? 'linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)'
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

      {/* Right Side Content - Same as before, just continuing... */}
      <Box
        sx={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: 3 }}
      >
        {dataSourceNames.length === 0 ? (
          // No data sources exist at all
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#FFFFFF',
              border: '2px dashed #D1D5DB',
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
                <DataObjectIcon sx={{ fontSize: 48, color: '#3B82F6', opacity: 0.6 }} />
              </Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  mb: 2, 
                  fontWeight: 700,
                  bgcolor: '#3B82F6',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                No Data Sources
              </Typography>
              <Typography variant="body1" sx={{ mb: 2, color: '#64748b' }}>
                You haven't created any data sources yet. Create your first data source
                using the panel on the left to start building your queries.
              </Typography>
              <Typography variant="body2" color="#94a3b8">
                Data sources allow you to connect to your databases and execute
                SQL queries to interact with your data.
              </Typography>
            </Box>
          </Box>
        ) : !selectedDS ? (
          // Data sources exist but none selected
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: '#FFFFFF',
              border: '2px dashed #D1D5DB',
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
                <DataObjectIcon sx={{ fontSize: 48, color: '#3B82F6', opacity: 0.6 }} />
              </Box>
              <Typography 
                variant="h5" 
                sx={{ 
                  mb: 2, 
                  fontWeight: 700,
                  bgcolor: '#3B82F6',
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
            {/* SQL Query Section - continuing from previous component... */}
            <Paper
              elevation={0}
              sx={{
                p: 3,
                bgcolor: '#FFFFFF',
                border: '1px solid #E5E7EB',
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
                  borderImage: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%) 1',
                  flexWrap: 'wrap',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: '#3B82F6',
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
                        color: '#3B82F6',
                        fontWeight: 600,
                      }}
                    >
                      {selectedDS}
                    </Typography>
                  </Box>
                </Box>

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
                    bgcolor: '#3B82F6',
                    '&:hover': {
                        bgcolor: '#2563EB',
                    },
                    }}
                >
                    Generate Queries with AI
                </Button>
                  <FormControl 
                    size="small" 
                    sx={{ 
                      minWidth: 220,
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(102, 126, 234, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: '#3B82F6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#3B82F6',
                        },
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#3B82F6',
                      },
                    }}
                  >
                    <InputLabel id="connector-select-label">
                      Connector
                    </InputLabel>
                    <Select
                      labelId="connector-select-label"
                      id="connector-select"
                      value={selectedConnectorId}
                      label="Connector"
                      onChange={async (e) => {
                        const newConnectorId = e.target.value;
                        setSelectedConnectorId(newConnectorId);
                        
                        // Find the selected connector to get its type
                        const selectedConn = connectors.find(c => c.id === newConnectorId);
                        if (selectedConn) {
                          setSelectedConnectorType(selectedConn.type);
                          // CSV connectors only support Extract mode
                          if (selectedConn.type === 'csv') {
                            setConnectionType('Extract');
                          }
                        }
                        
                        // Save connector change to database
                        if (selectedDS && selectedConn) {
                          try {
                            await axios.post(`${API_BASE_URL}/api/datasources`, {
                              dataSourceName: selectedDS,
                              connectionId: selectedConn.type === 'snowflake' ? selectedConn.snowflakeConnectionId : null,
                              csvConnectorId: selectedConn.type === 'csv' ? selectedConn.csvConnectorId : null,
                              connectionType: selectedConn.type === 'csv' ? 'Extract' : connectionType,
                              query: sqlQuery || ''
                            });
                          } catch (err) {
                            console.error('Failed to update connector', err);
                          }
                        }
                      }}
                      renderValue={(selected) => {
                        const connector = connectors.find(c => c.id === selected);
                        if (!connector) return '';
                        return (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <span>{connector.name}</span>
                            <Chip 
                              label={connector.type === 'csv' ? 'CSV' : 'Snowflake'} 
                              size="small" 
                              sx={{ 
                                height: 20,
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                bgcolor: connector.type === 'csv' ? '#10b981' : '#3B82F6', 
                                color: 'white' 
                              }} 
                            />
                          </Box>
                        );
                      }}
                    >
                      {connectors.map((conn: any) => (
                        <MenuItem key={conn.id} value={conn.id}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'space-between' }}>
                            <span>{conn.name}</span>
                            <Chip 
                              label={conn.type === 'csv' ? 'CSV' : 'Snowflake'} 
                              size="small" 
                              sx={{ 
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                bgcolor: conn.type === 'csv' ? '#10b981' : '#3B82F6', 
                                color: 'white' 
                              }} 
                            />
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl 
                    size="small" 
                    sx={{ 
                      minWidth: 120,
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(102, 126, 234, 0.3)',
                        },
                        '&:hover fieldset': {
                          borderColor: '#3B82F6',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#3B82F6',
                        },
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#3B82F6',
                      },
                    }}
                  >
                    <InputLabel id="connection-type-label">Type</InputLabel>
                    <Select
                      labelId="connection-type-label"
                      id="connection-type"
                      value={connectionType}
                      label="Type"
                      disabled={selectedConnectorType === 'csv'} // CSV only supports Extract
                      onChange={async (e) => {
                        const newType = e.target.value;
                        setConnectionType(newType);
                        // Save connection type change to database
                        if (selectedDS) {
                          const selectedConn = connectors.find(c => c.id === selectedConnectorId);
                          try {
                            await axios.post(`${API_BASE_URL}/api/datasources`, {
                              dataSourceName: selectedDS,
                              connectionId: selectedConn?.type === 'snowflake' ? selectedConn.snowflakeConnectionId : null,
                              csvConnectorId: selectedConn?.type === 'csv' ? selectedConn.csvConnectorId : null,
                              connectionType: newType,
                              query: sqlQuery || ''
                            });
                          } catch (err) {
                            console.error('Failed to update connection type', err);
                          }
                        }
                      }}
                    >
                      <MenuItem value="Live" disabled={selectedConnectorType === 'csv'}>Live</MenuItem>
                      <MenuItem value="Extract">Extract</MenuItem>
                    </Select>
                  </FormControl>

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
                      bgcolor: '#3B82F6',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                      '&:hover': {
                        bgcolor: '#2563EB',
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
 
                
                {/* Scheduler Section - Collapsible at Top - Only for Extract type */}
                {/* {selectedDS && connectionType === 'Extract' && (
                  <Accordion
                    expanded={schedulerExpanded}
                    onChange={(_, isExpanded) => setSchedulerExpanded(isExpanded)}
                    sx={{
                      mt: 2,
                      mb: 0,
                      boxShadow: 'none',
                      border: '1px solid #E5E7EB',
                      borderRadius: 2,
                      '&:before': {
                        display: 'none',
                      },
                      '&.Mui-expanded': {
                        margin: '16px 0 0 0',
                      },
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon sx={{ color: '#3B82F6' }} />}
                      sx={{
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                        borderRadius: schedulerExpanded ? '8px 8px 0 0' : '8px',
                        minHeight: 56,
                        '&.Mui-expanded': {
                          minHeight: 56,
                        },
                        '& .MuiAccordionSummary-content': {
                          margin: '12px 0',
                          '&.Mui-expanded': {
                            margin: '12px 0',
                          },
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                        <ScheduleIcon sx={{ color: '#3B82F6', fontSize: 22 }} />
                        <Typography
                          variant="subtitle1"
                          sx={{
                            fontWeight: 700,
                            color: '#3B82F6',
                            flex: 1,
                          }}
                        >
                          Extract Refresh Scheduler
                        </Typography>
                        {refreshIntervalDays && (
                          <Chip
                            label={`Every ${refreshIntervalDays} day(s)`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(102, 126, 234, 0.1)',
                              color: '#3B82F6',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          />
                        )}
                        {nextRunDateTime && !refreshIntervalDays && (
                          <Chip
                            label={`Next: ${new Date(nextRunDateTime).toLocaleDateString()}`}
                            size="small"
                            sx={{
                              bgcolor: 'rgba(102, 126, 234, 0.1)',
                              color: '#3B82F6',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                            }}
                          />
                        )}
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails
                      sx={{
                        p: 3,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)',
                      }}
                    > */}
                      {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}> */}
                        {/* How It Works Info */}
                        {/* <Alert 
                          severity="info" 
                          icon={<ScheduleIcon />}
                          sx={{ 
                            fontSize: '0.8rem',
                            '& .MuiAlert-message': {
                              width: '100%',
                            },
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                            How it works:
                          </Typography>
                          <Typography variant="caption" component="div">
                            • <strong>Next Run Date & Time:</strong> Schedule a one-time extract refresh at a specific date/time
                            <br />
                            • <strong>Recurring Interval:</strong> Set up automatic refresh every N days (runs after the next scheduled run)
                            <br />
                            • When refresh runs: Base table and materialized views are deleted, cache is cleared
                          </Typography>
                        </Alert>

                        <Divider /> */}

                        {/* Next Run Date & Time Section */}
                        {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 700,
                                color: '#475569',
                                fontSize: '0.9rem',
                              }}
                            >
                              Next Run Date & Time
                            </Typography>
                            <Chip 
                              label="One-time" 
                              size="small" 
                              sx={{ 
                                height: 20, 
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(102, 126, 234, 0.1)',
                                color: '#3B82F6',
                              }} 
                            />
                          </Box>
                          <TextField
                            type="datetime-local"
                            size="small"
                            value={nextRunDateTime}
                            onChange={(e) => {
                              const selectedDateTime = e.target.value;
                              if (!selectedDateTime) {
                                setNextRunDateTime('');
                                return;
                              }
                              
                              const selectedDate = new Date(selectedDateTime);
                              const now = new Date();
                              now.setSeconds(0, 0);
                              
                              if (selectedDate >= now) {
                                setNextRunDateTime(selectedDateTime);
                              } else {
                                showAlert('Please select today or a future date and time', 'warning');
                                const formattedDateTime = now.toISOString().slice(0, 16);
                                setNextRunDateTime(formattedDateTime);
                              }
                            }}
                            disabled={isLoadingSchedule}
                            inputProps={{
                              min: (() => {
                                const now = new Date();
                                return now.toISOString().slice(0, 16);
                              })(),
                            }}
                            sx={{
                              maxWidth: 320,
                              '& .MuiOutlinedInput-root': {
                                bgcolor: 'white',
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                                '& fieldset': {
                                  borderColor: 'rgba(102, 126, 234, 0.3)',
                                  borderWidth: 2,
                                },
                                '&:hover fieldset': {
                                  borderColor: '#3B82F6',
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#3B82F6',
                                  borderWidth: 2,
                                },
                              },
                              '& .MuiInputLabel-root': {
                                color: '#64748b',
                                fontWeight: 500,
                              },
                              '& .MuiInputLabel-root.Mui-focused': {
                                color: '#3B82F6',
                              },
                            }}
                            InputLabelProps={{
                              shrink: true,
                            }}
                            label="Select Date & Time"
                            helperText="Choose when to run the next extract refresh (today or future)"
                          />
                        </Box>

                        <Divider /> */}

                        {/* Recurring Interval Section */}
                        {/* <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography
                              variant="subtitle2"
                              sx={{
                                fontWeight: 700,
                                color: '#475569',
                                fontSize: '0.9rem',
                              }}
                            >
                              Recurring Interval
                            </Typography>
                            <Chip 
                              label="Optional" 
                              size="small" 
                              sx={{ 
                                height: 20, 
                                fontSize: '0.7rem',
                                bgcolor: 'rgba(148, 163, 184, 0.1)',
                                color: '#64748b',
                              }} 
                            />
                          </Box>
                          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                            <TextField
                              size="small"
                              type="number"
                              label="Refresh every (days)"
                              value={refreshIntervalDays || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setRefreshIntervalDays(val === '' ? null : parseInt(val, 10));
                              }}
                              disabled={isLoadingSchedule}
                              inputProps={{ min: 1 }}
                              sx={{
                                minWidth: 200,
                                '& .MuiOutlinedInput-root': {
                                  bgcolor: 'white',
                                  '& fieldset': {
                                    borderColor: 'rgba(102, 126, 234, 0.3)',
                                  },
                                  '&:hover fieldset': {
                                    borderColor: '#3B82F6',
                                  },
                                  '&.Mui-focused fieldset': {
                                    borderColor: '#3B82F6',
                                  },
                                },
                              }}
                              helperText="Runs automatically after the next scheduled run"
                            />

                            <Button
                              size="small"
                              variant="contained"
                              onClick={() => saveSchedule(refreshIntervalDays)}
                              disabled={isLoadingSchedule}
                              sx={{
                                bgcolor: '#3B82F6',
                                '&:hover': {
                                  bgcolor: '#2563EB',
                                },
                                fontWeight: 600,
                                mt: 0.5,
                              }}
                            >
                              {isLoadingSchedule ? 'Saving...' : 'Save Schedule'}
                            </Button>

                            {refreshIntervalDays && (
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => saveSchedule(null)}
                                disabled={isLoadingSchedule}
                                sx={{
                                  borderColor: 'rgba(239, 68, 68, 0.5)',
                                  color: '#ef4444',
                                  '&:hover': {
                                    borderColor: '#ef4444',
                                    bgcolor: 'rgba(239, 68, 68, 0.05)',
                                  },
                                  mt: 0.5,
                                }}
                              >
                                Disable
                              </Button>
                            )}
                          </Box>
                        </Box> */}

                        {/* Status Information */}
                        {/* {(lastRefreshed || nextRunDateTime) && (
                          <>
                            <Divider />
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              {lastRefreshed && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    color: '#64748b',
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>Last refreshed:</span>
                                  {new Date(lastRefreshed).toLocaleString()}
                                </Typography>
                              )}
                              
                              {nextRunDateTime && (
                                <Typography
                                  variant="caption"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                    color: '#3B82F6',
                                    fontWeight: 600,
                                    fontSize: '0.8rem',
                                  }}
                                >
                                  <span>Next run scheduled:</span>
                                  {new Date(nextRunDateTime).toLocaleString()}
                                </Typography>
                              )}
                            </Box>
                          </>
                        )}
                      </Box>
                    </AccordionDetails>
                  </Accordion>
                )} */}

              </Box>

              {/* Monaco SQL Editor */}
              <Box
                sx={{
                  position: 'relative',
                  border: '2px solid rgba(102, 126, 234, 0.3)',
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:focus-within': {
                    borderColor: '#3B82F6',
                    boxShadow: '0 0 0 3px rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                <Box
                  sx={{
                    height: 350,
                    '.monaco-editor': {
                      borderRadius: '8px',
                    },
                    '.monaco-editor .margin': {
                      background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    },
                  }}
                >
                  <Editor
                    height="100%"
                    defaultLanguage="sql"
                    language="sql"
                    value={sqlQuery}
                    onChange={(value) => setSqlQuery(value || '')}
                    onMount={handleEditorDidMount}
                    theme="vs"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      fontFamily: '"Fira Code", "JetBrains Mono", "Cascadia Code", Consolas, monospace',
                      fontLigatures: true,
                      lineNumbers: 'on',
                      lineNumbersMinChars: 3,
                      folding: true,
                      wordWrap: 'on',
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      renderLineHighlight: 'all',
                      suggestOnTriggerCharacters: true,
                      quickSuggestions: {
                        other: true,
                        comments: false,
                        strings: true,
                      },
                      acceptSuggestionOnEnter: 'on',
                      tabCompletion: 'on',
                      snippetSuggestions: 'top',
                      suggest: {
                        showKeywords: true,
                        showFunctions: true,
                        showSnippets: true,
                        insertMode: 'insert',
                        filterGraceful: true,
                        localityBonus: true,
                        shareSuggestSelections: true,
                      },
                      padding: { top: 12, bottom: 12 },
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      formatOnPaste: true,
                      formatOnType: true,
                      autoClosingBrackets: 'always',
                      autoClosingQuotes: 'always',
                      matchBrackets: 'always',
                      bracketPairColorization: { enabled: true },
                      guides: {
                        indentation: true,
                        bracketPairs: true,
                      },
                      placeholder: `-- Enter your SQL query here...

-- Example:
SELECT * 
FROM users 
WHERE age > 18
ORDER BY created_at DESC;

-- Press Ctrl+Enter to execute`,
                    }}
                  />
                </Box>

                {/* <Box
                  sx={{
                    position: 'absolute',
                    bottom: 12,
                    right: 12,
                    bgcolor: '#3B82F6',
                    color: 'white',
                    px: 2,
                    py: 0.75,
                    borderRadius: 1.5,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                    zIndex: 10,
                  }}
                >
                  Ctrl + Enter to execute
                </Box> */}
              </Box>
            </Paper>

            {/* Results Table Section - Same as before */}
            <Paper
              elevation={0}
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                maxWidth:'100%',
                bgcolor: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: 3,
                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
              }}
            >
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
                    bgcolor: '#3B82F6',
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
                    <CircularProgress size={56} sx={{ color: '#3B82F6' }} />
                    <Typography
                      variant="body2"
                      sx={{ mt: 2, color: '#64748b', fontWeight: 600 }}
                    >
                      Executing query...
                    </Typography>
                  </Box>
                </Box>
              )}

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
                      <PlayArrowIcon sx={{ fontSize: 40, color: '#3B82F6', opacity: 0.6 }} />
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
