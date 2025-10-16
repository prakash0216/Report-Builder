import React, { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import {
  Box, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Grid, IconButton, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TablePagination, TextField, Typography, Alert, Select, MenuItem, Chip, InputLabel, FormControl, CircularProgress, Tooltip
} from '@mui/material';
import {
  ArrowBack, Visibility, VisibilityOff, Add, Edit, Delete, CloudUpload, Save, Close, Search, Storage,
  Check, Info, Warning
} from '@mui/icons-material';

import { SelectChangeEvent } from '@mui/material/Select';
import axios from 'axios';

interface SnowflakeConnection {
  id: number;
  connectionName: string;
  account: string;
  username: string;
  authenticator: string;
  privateKey?: File | null;
  privateKeyFileName?: string;
  warehouse: string;
  database: string;
  schema: string;
  type: 'snowflake';
}

interface FormData {
  connectionName: string;
  account: string;
  username: string;
  authenticator: string;
  privateKey: File | null;
  warehouse: string;
  database: string;
  schema: string;
}

interface AlertState {
  show: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

interface ConnectorType {
  id: string;
  name: string;
  description: string;
  color: 'primary' | 'warning' | 'info' | 'success' | 'error' | 'secondary';
}

const connectorTypes: ConnectorType[] = [
  { id: "snowflake", name: "Snowflake", description: "Connect to Snowflake data warehouse", color: "primary" },
  { id: "mysql", name: "MySQL", description: "Connect to MySQL database", color: "warning" },
  { id: "postgresql", name: "PostgreSQL", description: "Connect to PostgreSQL database", color: "info" },
  { id: "mongodb", name: "MongoDB", description: "Connect to MongoDB database", color: "success" },
  { id: "oracle", name: "Oracle", description: "Connect to Oracle database", color: "error" },
  { id: "redshift", name: "Amazon Redshift", description: "Connect to Amazon Redshift", color: "secondary" }
];

const ConnectorManager: React.FC = () => {
  const [currentView, setCurrentView] = useState<'selection' | 'snowflake'>('selection');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedConnectorType, setSelectedConnectorType] = useState<string>('');

  const [formData, setFormData] = useState<FormData>({
    connectionName: '',
    account: '',
    username: '',
    authenticator: '',
    privateKey: null,
    warehouse: '',
    database: '',
    schema: ''
  });

  const [connections, setConnections] = useState<SnowflakeConnection[]>([]);

  const fetchConnections = async () => {
    try {
      const response = await axios.get('http://localhost:3002/snowflake-connections');
      setConnections(response.data.connections);
    } catch (error) {
      console.error('Error fetching connections:', error);
      showAlert('Error fetching connections. Please check if the server is running.', 'error');
    }
  };

  useEffect(() => {
    fetchConnections();
  }, []);

  const [showTable, setShowTable] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<FormData>({
    connectionName: '',
    account: '',
    username: '',
    authenticator: '',
    privateKey: null,
    warehouse: '',
    database: '',
    schema: ''
  });
  const [existingPrivateKeyFileName, setExistingPrivateKeyFileName] = useState<string>('');
  const [openDialog, setOpenDialog] = useState<boolean>(false);
  const [alert, setAlert] = useState<AlertState>({ show: false, message: '', severity: 'success' });
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [isAddingConnection, setIsAddingConnection] = useState<boolean>(false);
  const [isEditingConnection, setIsEditingConnection] = useState<boolean>(false);
  const [isDeletingConnection, setIsDeletingConnection] = useState<number | null>(null);
  const [isCheckingConnection, setIsCheckingConnection] = useState<boolean>(false);
  const [isEditCheckingConnection, setIsEditCheckingConnection] = useState<boolean>(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState<boolean>(false);
  const [connectionToDelete, setConnectionToDelete] = useState<SnowflakeConnection | null>(null);
  const [isSnowflakeConnectionValid, setIsSnowflakeConnectionValid] = useState<boolean>(false);
  const [isEditSnowflakeConnectionValid, setIsEditSnowflakeConnectionValid] = useState<boolean>(false);
  

  const filteredConnectors = connectorTypes.filter((connector) =>
    connector.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    connector.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConnectorSelect = (connectorType: string) => {
    setSelectedConnectorType(connectorType);
    if (connectorType === 'snowflake') {
      setCurrentView('snowflake');
    } else {
      showAlert(`${connectorType} connector is coming soon!`, 'info');
    }
  };

  const handleBackToSelection = () => {
    setCurrentView('selection');
    setSelectedConnectorType('');
    setFormData({
      connectionName: '',
      account: '',
      username: '',
      authenticator: '',
      privateKey: null,
      warehouse: '',
      database: '',
      schema: ''
    });
    setIsSnowflakeConnectionValid(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setIsSnowflakeConnectionValid(false);
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const name = e.target.name;
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsSnowflakeConnectionValid(false);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.der', '.pem', '.key', '.p8'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        showAlert('Invalid file format. Please upload a .der, .pem, .key, or .p8 file.', 'error');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        privateKey: file
      }));
      showAlert(`File "${file.name}" uploaded successfully!`, 'success');
    }
    setIsSnowflakeConnectionValid(false);
  };

  const showAlert = (message: string, severity: AlertState['severity'] = 'success') => {
    setAlert({ show: true, message, severity });
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, 4000);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.connectionName || !formData.account || !formData.username || 
        !formData.authenticator || !formData.warehouse || !formData.database || 
        !formData.schema || !formData.privateKey) {
      showAlert('Please fill in all required fields including the private key file.', 'error');
      return;
    }

    if (!isSnowflakeConnectionValid) {
      showAlert('Please check the connection before adding it.', 'warning');
      return;
    }
    
    setIsAddingConnection(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('connectionName', formData.connectionName);
      formDataToSend.append('account', formData.account);
      formDataToSend.append('username', formData.username);
      formDataToSend.append('authenticator', formData.authenticator);
      formDataToSend.append('privateKey', formData.privateKey);
      formDataToSend.append('warehouse', formData.warehouse);
      formDataToSend.append('database', formData.database);
      formDataToSend.append('schema', formData.schema);
      
      const response = await axios.post('http://localhost:3002/add-snowflake-connection', formDataToSend);
      
      if (response.data.success) {
        setFormData({
          connectionName: '',
          account: '',
          username: '',
          authenticator: '',
          privateKey: null,
          warehouse: '',
          database: '',
          schema: ''
        });
        setIsSnowflakeConnectionValid(false);
        showAlert('Snowflake connection saved successfully!');
        await fetchConnections();
      } else {
        showAlert(response.data.message || 'Failed to save connection.', 'error');
      }
    } catch (error: any) {
      console.error('Error saving connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to save connection. Please try again.';
      showAlert(errorMessage, 'error');
    } finally {
      setIsAddingConnection(false);
    }
  };

  const handleEdit = (connection: SnowflakeConnection) => {
    setEditingId(connection.id);
    setEditData({
      connectionName: connection.connectionName,
      account: connection.account,
      username: connection.username,
      authenticator: connection.authenticator,
      privateKey: null,
      warehouse: connection.warehouse,
      database: connection.database,
      schema: connection.schema
    });
    setExistingPrivateKeyFileName(connection.privateKeyFileName || '');
    setIsEditSnowflakeConnectionValid(false);
    setOpenDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editData.connectionName || !editData.account || 
        !editData.username || !editData.authenticator || !editData.warehouse || 
        !editData.database || !editData.schema) {
      showAlert('Please fill in all required fields.', 'error');
      return;
    }

    if (!editData.privateKey) {
      showAlert('Please upload a new private key file to update the connection.', 'error');
      return;
    }

    if (!isEditSnowflakeConnectionValid) {
      showAlert('Please check the connection before saving changes.', 'warning');
      return;
    }

    setIsEditingConnection(true);

    try {
      const editFormData = new FormData();
      editFormData.append('connectionName', editData.connectionName);
      editFormData.append('account', editData.account);
      editFormData.append('username', editData.username);
      editFormData.append('authenticator', editData.authenticator);
      editFormData.append('privateKey', editData.privateKey);
      editFormData.append('warehouse', editData.warehouse);
      editFormData.append('database', editData.database);
      editFormData.append('schema', editData.schema);
      
      const response = await axios.post(`http://localhost:3002/update-snowflake-connection/${editingId}`, editFormData);
      
      if (response.data.success) {
        setOpenDialog(false);
        setEditingId(null);
        setEditData({
          connectionName: '',
          account: '',
          username: '',
          authenticator: '',
          privateKey: null,
          warehouse: '',
          database: '',
          schema: ''
        });
        setIsEditSnowflakeConnectionValid(false);
        setExistingPrivateKeyFileName('');
        showAlert('Connection updated successfully!');
        await fetchConnections();
      } else {
        showAlert(response.data.message || 'Failed to update connection.', 'error');
      }
    } catch (error: any) {
      console.error('Error updating connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update connection. Please try again.';
      showAlert(errorMessage, 'error');
    } finally {
      setIsEditingConnection(false);
    }
  };

  const handleDeleteClick = (connection: SnowflakeConnection) => {
    setConnectionToDelete(connection);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!connectionToDelete) return;

    setIsDeletingConnection(connectionToDelete.id);
    
    try {
      const response = await axios.delete(`http://localhost:3002/delete-snowflake-connection/${connectionToDelete.id}`);
      
      if (response.data.success) {
        showAlert('Connection deleted successfully!', 'info');
        await fetchConnections();
        setDeleteDialogOpen(false);
        setConnectionToDelete(null);
      } else {
        showAlert(response.data.message || 'Failed to delete connection.', 'error');
      }
    } catch (error: any) {
      console.error('Error deleting connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete connection. Please try again.';
      showAlert(errorMessage, 'error');
    } finally {
      setIsDeletingConnection(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setConnectionToDelete(null);
  };

  const handleEditInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditData((prev) => ({
      ...prev,
      [name]: value
    }));
    setIsEditSnowflakeConnectionValid(false);
  };

  const handleEditSelectChange = (e: SelectChangeEvent) => {
    const name = e.target.name;
    const value = e.target.value;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsEditSnowflakeConnectionValid(false);
  };

  const handleEditFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validExtensions = ['.der', '.pem', '.key', '.p8'];
      const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (!validExtensions.includes(fileExtension)) {
        showAlert('Invalid file format. Please upload a .der, .pem, .key, or .p8 file.', 'error');
        return;
      }

      setEditData(prev => ({
        ...prev,
        privateKey: file
      }));
      setIsEditSnowflakeConnectionValid(false);
      showAlert(`New file "${file.name}" uploaded successfully! Please check the connection before saving.`, 'success');
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const CheckSnowflakeConnection = async () => {
    if (!formData.connectionName || !formData.account || !formData.username || 
        !formData.authenticator || !formData.warehouse || !formData.database || 
        !formData.schema || !formData.privateKey) {
      showAlert('Please fill in all required fields ', 'error');
      return;
    }

    setIsCheckingConnection(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('connectionName', formData.connectionName);
      formDataToSend.append('account', formData.account);
      formDataToSend.append('username', formData.username);
      formDataToSend.append('authenticator', formData.authenticator);
      formDataToSend.append('privateKey', formData.privateKey);
      formDataToSend.append('warehouse', formData.warehouse);
      formDataToSend.append('database', formData.database);
      formDataToSend.append('schema', formData.schema);

      const response = await axios.post('http://localhost:3002/check-snowflake-connection', formDataToSend);

      if (response.data.success) {
        showAlert('Snowflake connection is valid! You can now add this connection.', 'success');
        setIsSnowflakeConnectionValid(true);
      } else {
        showAlert(`Connection check failed: ${response.data.message || 'Invalid credentials or configuration'}`, 'error');
        setIsSnowflakeConnectionValid(false);
      }
    } catch (error: any) {
      console.error('Error checking connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to check connection. Please verify your credentials.';
      showAlert(errorMessage, 'error');
      setIsSnowflakeConnectionValid(false);
    } finally {
      setIsCheckingConnection(false);
    }
  };

  const checkEditSnowFlakeConnection = async () => {
    if (!editData.connectionName || !editData.account || !editData.username || 
        !editData.authenticator || !editData.warehouse || !editData.database || 
        !editData.schema) {
      showAlert('Please fill in all required fields.', 'error');
      return;
    }
    
    if (!editData.privateKey) {
      showAlert('Please upload a new private key file before checking the connection.', 'error');
      return;
    }
    
    setIsEditCheckingConnection(true);

    try {
      const editFormData = new FormData();
      editFormData.append('connectionName', editData.connectionName);
      editFormData.append('account', editData.account);
      editFormData.append('username', editData.username);
      editFormData.append('authenticator', editData.authenticator);
      editFormData.append('privateKey', editData.privateKey);
      editFormData.append('warehouse', editData.warehouse);
      editFormData.append('database', editData.database);
      editFormData.append('schema', editData.schema);

      const response = await axios.post('http://localhost:3002/check-snowflake-connection', editFormData);

      if (response.data.success) {
        showAlert('Snowflake connection is valid! You can now save the changes.', 'success');
        setIsEditSnowflakeConnectionValid(true);
      } else {
        showAlert(`Connection check failed: ${response.data.message || 'Invalid credentials or configuration'}`, 'error');
        setIsEditSnowflakeConnectionValid(false);
      }
    } catch (error: any) {
      console.error('Error checking connection:', error);
      const errorMessage = error.response?.data?.message || 'Failed to check connection. Please verify your credentials.';
      showAlert(errorMessage, 'error');
      setIsEditSnowflakeConnectionValid(false);
    } finally {
      setIsEditCheckingConnection(false);
    }
  };

  const paginatedConnections = connections.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const renderConnectionsTable = () => (
    <Paper sx={{ mt: 2, p: 2 }}>
      <Typography variant="h6" mb={2}>
        Saved Connections ({connections.length} total)
      </Typography>
      <TableContainer sx={{ maxHeight: 400 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>Connection Name</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Account</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Authenticator</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Private Key</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Warehouse</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Database</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Schema</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedConnections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No connections found. Add your first connection above.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedConnections.map((connection) => (
                <TableRow key={connection.id} hover>
                  <TableCell>{connection.connectionName}</TableCell>
                  <TableCell>{connection.account}</TableCell>
                  <TableCell>{connection.username}</TableCell>
                  <TableCell>{connection.authenticator}</TableCell>
                  <TableCell>
                    {connection.privateKeyFileName || 
                     (connection.privateKey?.name) || 
                     'Not Uploaded'}
                  </TableCell>
                  <TableCell>{connection.warehouse}</TableCell>
                  <TableCell>{connection.database}</TableCell>
                  <TableCell>{connection.schema}</TableCell>
                  <TableCell>
                    {connection.type === "snowflake" ? (
                      <Chip label="Snowflake" color="primary" size="small" />
                    ) : (
                      connection.type
                    )}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit connection">
                      <IconButton color="primary" onClick={() => handleEdit(connection)} size="small">
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete connection">
                      <IconButton 
                        color="error" 
                        onClick={() => handleDeleteClick(connection)} 
                        size="small"
                        disabled={isDeletingConnection === connection.id}
                      >
                        {isDeletingConnection === connection.id ? (
                          <CircularProgress size={16} />
                        ) : (
                          <Delete fontSize="small" />
                        )}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {paginatedConnections.length > 0 && (
          <TablePagination
            rowsPerPageOptions={[5, 10, 25, 50]}
            component="div"
            count={connections.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        )}
      </TableContainer>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%', p: 3 }}>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 2 }} onClose={() => setAlert(prev => ({ ...prev, show: false }))}>
          {alert.message}
        </Alert>
      )}

      {currentView === 'selection' && (
        <Box>
          <Paper sx={{ mb: 3, p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Search sx={{ color: 'gray.400', mr: 1 }} />
              <TextField
                fullWidth
                variant="standard"
                placeholder="Search for connectors... (e.g., snowflake, mysql, postgresql)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </Stack>
          </Paper>

          <Grid container spacing={2}>
            {filteredConnectors.map((connector) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={connector.id}>
                <Paper
                  elevation={3}
                  onClick={() => handleConnectorSelect(connector.id)}
                  sx={{
                    p: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.3s',
                    '&:hover': { boxShadow: 6, transform: 'scale(1.03)' }
                  }}
                >
                  <Chip
                    icon={<Storage sx={{ color: '#fff' }} />}
                    label={connector.name}
                    color={connector.color}
                    sx={{ mb: 2, width: 100, height: 40, fontWeight: 700, color: '#fff' }}
                  />
                  <Typography variant="subtitle1" sx={{ mb: 1 }}>
                    {connector.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" textAlign="center">
                    {connector.description}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          {filteredConnectors.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                No connectors found matching "{searchTerm}"
              </Typography>
              <Typography color="text.secondary">
                Try searching for: snowflake, mysql, postgresql, mongodb, oracle, redshift
              </Typography>
            </Box>
          )}

          {connections.length > 0 && (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1} mt={4}>
                <Typography variant="h6">Existing Connections ({connections.length})</Typography>
                <Button
                  variant="outlined"
                  startIcon={showTable ? <VisibilityOff /> : <Visibility />}
                  onClick={() => setShowTable(prev => !prev)}
                >
                  {showTable ? 'Hide' : 'Show'} Connections
                </Button>
              </Stack>
              {showTable && renderConnectionsTable()}
            </>
          )}
        </Box>
      )}

      {currentView === 'snowflake' && (
        <Box>
          <Stack
            direction="row"
            alignItems="center"
            sx={{
              borderBottom: 1,
              borderColor: 'divider',
              pb: 2,
              position: 'relative',
              minHeight: 56,
            }}
          >
            <Button
              onClick={handleBackToSelection}
              startIcon={<ArrowBack />}
              sx={{ position: 'absolute', left: 0 }}
              variant="text"
              color="primary"
            >
              Back to Connectors
            </Button>
            <Typography
              variant="h5"
              fontWeight={600}
              color="text.primary"
              sx={{
                width: '100%',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              Configure Snowflake Connection
            </Typography>
          </Stack>

          <Alert severity="info" icon={<Info />} sx={{ mt: 3, mb: 2 }}>
            <Typography variant="body2" fontWeight="medium" mb={0.5}>
              Important Tips:
            </Typography>
            <Typography variant="body2" component="div">
              • Fill in all required fields before testing the connection<br />
              • Use the <strong>"Check Snowflake Connection"</strong> button to verify your credentials<br />
              • The <strong>"Add Connection"</strong> button will be enabled only after a successful connection check<br />
              • Keep your private key file secure and never share it
            </Typography>
          </Alert>

          <Paper sx={{ mb: 4, p: 3 }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Connection Name"
                    name="connectionName"
                    value={formData.connectionName}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="A unique name to identify this connection"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Account"
                    name="account"
                    value={formData.account}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="Your Snowflake account identifier"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Username"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="Your Snowflake username"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <FormControl fullWidth required>
                    <InputLabel>Authenticator</InputLabel>
                    <Select
                      label="Authenticator"
                      name="authenticator"
                      value={formData.authenticator}
                      onChange={handleSelectChange}
                    >
                      <MenuItem value="SNOWFLAKE_JWT">SNOWFLAKE_JWT</MenuItem>
                      <MenuItem value="SNOWFLAKE">SNOWFLAKE</MenuItem>
                      <MenuItem value="OAUTH">OAUTH</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Box
                    sx={{
                      border: '2px dashed',
                      borderColor: formData.privateKey ? 'primary.main' : 'grey.400',
                      borderRadius: 2,
                      p: 1,
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1,
                      minHeight: 140,
                      bgcolor: formData.privateKey ? 'action.hover' : 'transparent'
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium">
                      Upload Private Key *
                    </Typography>

                    <Button
                      variant="outlined"
                      component="label"
                      sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1, px: 3 }}
                    >
                      <CloudUpload sx={{ fontSize: 20, color: 'grey.500' }} />
                      <Typography variant="body2" fontWeight="medium">
                        Choose File
                      </Typography>
                      <input
                        type="file"
                        accept=".der,.pem,.key,.p8"
                        hidden
                        onChange={handleFileUpload}
                      />
                    </Button>

                    {formData.privateKey && (
                      <Typography variant="caption" color="primary" sx={{ mt: 1, fontWeight: 600 }}>
                        ✓ Selected: {formData.privateKey.name}
                      </Typography>
                    )}

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0 }}>
                      Accepted formats: .der, .pem, .key, .p8
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Warehouse"
                    name="warehouse"
                    value={formData.warehouse}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="Your Snowflake warehouse name"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Database"
                    name="database"
                    value={formData.database}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="Your Snowflake database name"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    required
                    label="Schema"
                    name="schema"
                    value={formData.schema}
                    onChange={handleInputChange}
                    variant="outlined"
                    helperText="Your Snowflake schema name"
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Stack direction="row" spacing={2} flexWrap="wrap" gap={1}>
                    <Tooltip title={!formData.privateKey ? "Please upload a private key file first" : "Test your connection credentials"}>
                      <span>
                        <Button
                          variant='contained'
                          color={isSnowflakeConnectionValid ? 'success' : 'secondary'}
                          type="button" 
                          startIcon={isCheckingConnection ? <CircularProgress size={16} color="inherit" /> : (isSnowflakeConnectionValid ? <Check /> : <Close />)}
                          onClick={CheckSnowflakeConnection}
                          disabled={isCheckingConnection || isAddingConnection || !formData.privateKey || !formData.connectionName || !formData.account || !formData.username || !formData.authenticator || !formData.warehouse || !formData.database || !formData.schema}
                        >
                          {isCheckingConnection ? 'Checking...' : (isSnowflakeConnectionValid ? 'Connection Valid ✓' : 'Check Connection')}
                        </Button>
                      </span>
                    </Tooltip>
                    <Tooltip title={!isSnowflakeConnectionValid ? "Please check connection first" : "Add this connection to your saved connections"}>
                      <span>
                        <Button
                          variant="contained"
                          color="primary"
                          type="submit"
                          startIcon={isAddingConnection ? <CircularProgress size={16} color="inherit" /> : <Add />}
                          disabled={isAddingConnection || !formData.privateKey || !isSnowflakeConnectionValid}
                        >
                          {isAddingConnection ? 'Adding...' : 'Add Connection'}
                        </Button>
                      </span>
                    </Tooltip>
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={showTable ? <VisibilityOff /> : <Visibility />}
                      onClick={() => setShowTable(prev => !prev)}
                    >
                      {showTable ? "Hide" : "Show"} Connections
                    </Button>
                  </Stack>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {showTable && renderConnectionsTable()}
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Edit Connection
          <IconButton
            onClick={() => setOpenDialog(false)}
            sx={{ position: 'absolute', right: 16, top: 16 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium" mb={0.5}>
              Security Requirement:
            </Typography>
            <Typography variant="body2">
              You <strong>must upload a new private key file</strong> to update this connection. This is required for security purposes.<br />
              After uploading, use <strong>"Check Connection"</strong> to verify before saving.
            </Typography>
          </Alert>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Connection Name"
                name="connectionName"
                value={editData.connectionName || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Account"
                name="account"
                value={editData.account || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Username"
                name="username"
                value={editData.username || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required>
                <InputLabel>Authenticator</InputLabel>
                <Select
                  label="Authenticator"
                  name="authenticator"
                  value={editData.authenticator || ''}
                  onChange={handleEditSelectChange}
                >
                  <MenuItem value="SNOWFLAKE_JWT">SNOWFLAKE_JWT</MenuItem>
                  <MenuItem value="SNOWFLAKE">SNOWFLAKE</MenuItem>
                  <MenuItem value="OAUTH">OAUTH</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: editData.privateKey ? 'success.main' : 'warning.main',
                  borderRadius: 2,
                  p: 1,
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  minHeight: 160,
                  bgcolor: editData.privateKey ? 'success.50' : 'warning.50'
                }}
              >
                <Typography variant="body2" fontWeight="bold" color={editData.privateKey ? 'success.main' : 'warning.main'}>
                  {editData.privateKey ? '✓ New Private Key Uploaded' : '⚠ Upload New Private Key (Required) *'}
                </Typography>

                <Button
                  variant="contained"
                  component="label"
                  color={editData.privateKey ? 'success' : 'warning'}
                  sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 1.5, px: 4 }}
                >
                  <CloudUpload sx={{ fontSize: 24, mb: 0.5 }} />
                  <Typography variant="body2" fontWeight="bold">
                    {editData.privateKey ? 'Change File' : 'Choose New File'}
                  </Typography>
                  <input
                    type="file"
                    accept=".der,.pem,.key,.p8"
                    hidden
                    onChange={handleEditFileUpload}
                  />
                </Button>

                {editData.privateKey && (
                  <Box sx={{ mt: 1, p: 1, bgcolor: 'success.100', borderRadius: 1, width: '100%' }}>
                    <Typography variant="body2" color="success.dark" fontWeight="600" textAlign="center">
                      New file: {editData.privateKey.name}
                    </Typography>
                  </Box>
                )}

                {!editData.privateKey && existingPrivateKeyFileName && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Previous file: {existingPrivateKeyFileName} (will be replaced)
                  </Typography>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Accepted formats: .der, .pem, .key, .p8
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Warehouse"
                name="warehouse"
                value={editData.warehouse || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Database"
                name="database"
                value={editData.database || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                required
                label="Schema"
                name="schema"
                value={editData.schema || ''}
                onChange={handleEditInputChange}
                variant="outlined"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDialog(false)} startIcon={<Close />} variant="outlined">
            Cancel
          </Button>
          <Tooltip title={!editData.privateKey ? "Please upload a new private key file first" : "Test your connection before saving"}>
            <span>
              <Button
                variant='contained'
                color={isEditSnowflakeConnectionValid ? 'success' : 'secondary'}
                type="button"
                startIcon={isEditCheckingConnection ? <CircularProgress size={16} color="inherit" /> : (isEditSnowflakeConnectionValid ? <Check /> : <Close />)}
                onClick={checkEditSnowFlakeConnection}
                disabled={isEditCheckingConnection || isEditingConnection || !editData.privateKey ||!editData.account || !editData.username || !editData.authenticator || !editData.warehouse || !editData.database || !editData.schema}
              >
                {isEditCheckingConnection ? 'Checking...' : (isEditSnowflakeConnectionValid ? 'Connection Valid ✓' : 'Check Connection')}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={!editData.privateKey ? "Upload a new private key first" : !isEditSnowflakeConnectionValid ? "Check connection first" : "Save your changes"}>
            <span>
              <Button 
                onClick={handleSaveEdit} 
                startIcon={isEditingConnection ? <CircularProgress size={16} color="inherit" /> : <Save />} 
                variant="contained" 
                color="primary"
                disabled={isEditingConnection || !editData.privateKey || !isEditSnowflakeConnectionValid}
              >
                {isEditingConnection ? 'Saving...' : 'Save Changes'}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'error.main' }}>
          Confirm Delete
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Are you sure you want to delete the connection <strong>"{connectionToDelete?.connectionName}"</strong>?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            This action cannot be undone. All configuration data for this connection will be permanently removed.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} variant="outlined">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirmDelete} 
            color="error" 
            variant="contained"
            startIcon={isDeletingConnection ? <CircularProgress size={16} color="inherit" /> : <Delete />}
            disabled={isDeletingConnection !== null}
          >
            {isDeletingConnection ? 'Deleting...' : 'Delete Connection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConnectorManager;