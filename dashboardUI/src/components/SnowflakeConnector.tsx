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
import { API_BASE_URL } from '../config/api.config';

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
  color: string;
  gradient: string;
}

const connectorTypes: ConnectorType[] = [
  { 
    id: "snowflake", 
    name: "Snowflake", 
    description: "Connect to Snowflake data warehouse", 
    color: "#3B82F6",
    gradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
  },
  { 
    id: "mysql", 
    name: "MySQL", 
    description: "Connect to MySQL database", 
    color: "#f093fb",
    gradient: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
  },
  { 
    id: "postgresql", 
    name: "PostgreSQL", 
    description: "Connect to PostgreSQL database", 
    color: "#4facfe",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
  },
  { 
    id: "mongodb", 
    name: "MongoDB", 
    description: "Connect to MongoDB database", 
    color: "#43e97b",
    gradient: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
  },
  { 
    id: "oracle", 
    name: "Oracle", 
    description: "Connect to Oracle database", 
    color: "#fa709a",
    gradient: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
  },
  { 
    id: "redshift", 
    name: "Amazon Redshift", 
    description: "Connect to Amazon Redshift", 
    color: "#2563EB",
    gradient: "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)"
  }
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
      const response = await axios.get(`${API_BASE_URL}/api/snowflake-connections`);
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
  const [connectionCheckFailed, setConnectionCheckFailed] = useState<boolean>(false);
  const [editConnectionCheckFailed, setEditConnectionCheckFailed] = useState<boolean>(false);
  
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
    setConnectionCheckFailed(false);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
    setIsSnowflakeConnectionValid(false);
    setConnectionCheckFailed(false);
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const name = e.target.name;
    const value = e.target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsSnowflakeConnectionValid(false);
    setConnectionCheckFailed(false);
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
    setConnectionCheckFailed(false);
  };

  const showAlert = (message: string, severity: AlertState['severity'] = 'success') => {
    setAlert({ show: true, message, severity });
    // Longer timeout for errors so users can read the full message
    const timeout = severity === 'error' ? 8000 : severity === 'warning' ? 6000 : 4000;
    setTimeout(() => {
      setAlert((prev) => ({ ...prev, show: false }));
    }, timeout);
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
      
      const response = await axios.post(`${API_BASE_URL}/api/add-snowflake-connection`, formDataToSend);
      
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
      
      const response = await axios.post(`${API_BASE_URL}/api/update-snowflake-connection/${editingId}`, editFormData);
      
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
      const response = await axios.delete(`${API_BASE_URL}/api/delete-snowflake-connection/${connectionToDelete.id}`);
      
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
    setEditConnectionCheckFailed(false);
  };

  const handleEditSelectChange = (e: SelectChangeEvent) => {
    const name = e.target.name;
    const value = e.target.value;
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
    setIsEditSnowflakeConnectionValid(false);
    setEditConnectionCheckFailed(false);
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
      setEditConnectionCheckFailed(false);
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
      showAlert('Please fill in all required fields including the private key file.', 'error');
      return;
    }

    setIsCheckingConnection(true);
    setIsSnowflakeConnectionValid(false);
    setConnectionCheckFailed(false);

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

      const response = await axios.post(`${API_BASE_URL}/api/check-snowflake-connection`, formDataToSend);

      if (response.data.success) {
        showAlert('✓ Snowflake connection is valid! You can now add this connection.', 'success');
        setIsSnowflakeConnectionValid(true);
        setConnectionCheckFailed(false);
      } else {
        const errorMsg = response.data.message || response.data.error || 'Invalid credentials or configuration';
        showAlert(`✗ Connection failed: ${errorMsg}`, 'error');
        setIsSnowflakeConnectionValid(false);
        setConnectionCheckFailed(true);
      }
    } catch (error: any) {
      console.error('Error checking connection:', error);
      // Extract detailed error message from response
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to check connection. Please verify your credentials and try again.';
      const errorDetails = error.response?.data?.details;
      
      let fullErrorMessage = `✗ Connection failed: ${errorMessage}`;
      if (errorDetails && errorDetails !== errorMessage) {
        fullErrorMessage += ` (${errorDetails})`;
      }
      
      showAlert(fullErrorMessage, 'error');
      setIsSnowflakeConnectionValid(false);
      setConnectionCheckFailed(true);
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
    setIsEditSnowflakeConnectionValid(false);
    setEditConnectionCheckFailed(false);

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

      const response = await axios.post(`${API_BASE_URL}/api/check-snowflake-connection`, editFormData);

      if (response.data.success) {
        showAlert('✓ Snowflake connection is valid! You can now save the changes.', 'success');
        setIsEditSnowflakeConnectionValid(true);
        setEditConnectionCheckFailed(false);
      } else {
        const errorMsg = response.data.message || response.data.error || 'Invalid credentials or configuration';
        showAlert(`✗ Connection failed: ${errorMsg}`, 'error');
        setIsEditSnowflakeConnectionValid(false);
        setEditConnectionCheckFailed(true);
      }
    } catch (error: any) {
      console.error('Error checking connection:', error);
      // Extract detailed error message from response
      const errorMessage = error.response?.data?.message 
        || error.response?.data?.error 
        || error.message 
        || 'Failed to check connection. Please verify your credentials and try again.';
      const errorDetails = error.response?.data?.details;
      
      let fullErrorMessage = `✗ Connection failed: ${errorMessage}`;
      if (errorDetails && errorDetails !== errorMessage) {
        fullErrorMessage += ` (${errorDetails})`;
      }
      
      showAlert(fullErrorMessage, 'error');
      setIsEditSnowflakeConnectionValid(false);
      setEditConnectionCheckFailed(true);
    } finally {
      setIsEditCheckingConnection(false);
    }
  };

  const paginatedConnections = connections.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      '& fieldset': { borderColor: 'rgba(102, 126, 234, 0.3)' },
      '&:hover fieldset': { borderColor: '#3B82F6' },
      '&.Mui-focused fieldset': { borderColor: '#3B82F6' },
    },
    '& .MuiInputLabel-root.Mui-focused': { color: '#3B82F6' },
  };

  const renderConnectionsTable = () => (
    <Paper elevation={0} sx={{ mt: 3, p: 3, bgcolor: '#FFFFFF',  border: '1px solid #E5E7EB', borderRadius: 3, boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)' }}>
      <Typography variant="h6" mb={2} sx={{ bgcolor: '#3B82F6', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>
        Saved Connections ({connections.length} total)
      </Typography>
      <TableContainer sx={{ maxHeight: 400, borderRadius: 2 }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {['Connection Name', 'Account', 'Username', 'Authenticator', 'Private Key', 'Warehouse', 'Database', 'Schema', 'Type', 'Actions'].map(header => (
                <TableCell key={header} align={header === 'Actions' ? 'center' : 'left'} sx={{ fontWeight: 700, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', color: '#1e293b' }}>{header}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginatedConnections.length === 0 ? (
              <TableRow><TableCell colSpan={10} align="center"><Box sx={{ py: 4 }}><Box sx={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Storage sx={{ fontSize: 32, color: '#3B82F6', opacity: 0.6 }} /></Box><Typography variant="body2" color="#94a3b8" fontWeight={500}>No connections found. Add your first connection above.</Typography></Box></TableCell></TableRow>
            ) : (
              paginatedConnections.map((connection) => (
                <TableRow key={connection.id} hover sx={{ '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.05)' } }}>
                  <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>{connection.connectionName}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.account}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.username}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.authenticator}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.privateKeyFileName || (connection.privateKey?.name) || 'Not Uploaded'}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.warehouse}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.database}</TableCell>
                  <TableCell sx={{ color: '#475569' }}>{connection.schema}</TableCell>
                  <TableCell>{connection.type === "snowflake" ? <Chip label="Snowflake" size="small" sx={{ bgcolor: '#3B82F6', color: 'white', fontWeight: 600 }} /> : connection.type}</TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit connection"><IconButton onClick={() => handleEdit(connection)} size="small" sx={{ color: '#3B82F6', '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' } }}><Edit fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Delete connection"><IconButton onClick={() => handleDeleteClick(connection)} size="small" disabled={isDeletingConnection === connection.id} sx={{ color: '#ef4444', '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' } }}>{isDeletingConnection === connection.id ? <CircularProgress size={16} sx={{ color: '#ef4444' }} /> : <Delete fontSize="small" />}</IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {paginatedConnections.length > 0 && <TablePagination rowsPerPageOptions={[5, 10, 25, 50]} component="div" count={connections.length} rowsPerPage={rowsPerPage} page={page} onPageChange={handleChangePage} onRowsPerPageChange={handleChangeRowsPerPage} sx={{ '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { color: '#64748b', fontWeight: 500 } }} />}
      </TableContainer>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%', p: 3, bgcolor: '#F8FAFC' }}>
      {alert.show && (
        <Alert severity={alert.severity} sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: alert.severity === 'success' ? 'rgba(16, 185, 129, 0.3)' : alert.severity === 'error' ? 'rgba(239, 68, 68, 0.3)' : alert.severity === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(59, 130, 246, 0.3)', background: alert.severity === 'success' ? 'linear-gradient(135deg, rgba(209, 250, 229, 0.5) 0%, rgba(167, 243, 208, 0.5) 100%)' : alert.severity === 'error' ? 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)' : alert.severity === 'warning' ? 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)' : 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.2)' }} onClose={() => setAlert(prev => ({ ...prev, show: false }))}>{alert.message}</Alert>
      )}

      {currentView === 'selection' && (
        <Box>
          <Paper elevation={0} sx={{ mb: 4, p: 3, bgcolor: '#FFFFFF',  border: '1px solid #E5E7EB', borderRadius: 3, boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)' }}>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)' }}><Search sx={{ color: 'white', fontSize: 24 }} /></Box>
              <TextField fullWidth variant="standard" placeholder="Search for connectors... (e.g., snowflake, mysql, postgresql)" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} sx={{ '& .MuiInput-underline:before': { borderBottomColor: 'rgba(102, 126, 234, 0.3)' }, '& .MuiInput-underline:hover:before': { borderBottomColor: '#3B82F6' }, '& .MuiInput-underline:after': { borderBottomColor: '#3B82F6' } }} />
            </Stack>
          </Paper>

          <Grid container spacing={3}>
            {filteredConnectors.map((connector) => (
              <Grid item xs={12} sm={6} md={4} key={connector.id}>
                <Paper elevation={0} onClick={() => handleConnectorSelect(connector.id)} sx={{ p: 4, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transition: 'all 0.3s', bgcolor: '#FFFFFF',  border: '1px solid #E5E7EB', borderRadius: 3, '&:hover': { boxShadow: '0 12px 40px rgba(102, 126, 234, 0.25)', transform: 'translateY(-4px)', border: '1px solid rgba(102, 126, 234, 0.4)' } }}>
                  <Box sx={{ width: 80, height: 80, borderRadius: 3, background: connector.gradient, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, boxShadow: `0 8px 24px ${connector.color}40` }}><Storage sx={{ color: 'white', fontSize: 40 }} /></Box>
                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 700, color: '#1e293b' }}>{connector.name}</Typography>
                  <Typography variant="body2" color="#64748b" textAlign="center" fontWeight={500}>{connector.description}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          
          {filteredConnectors.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Box sx={{ width: 80, height: 80, margin: '0 auto 24px', borderRadius: '50%', background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Search sx={{ fontSize: 40, color: '#3B82F6', opacity: 0.6 }} /></Box>
              <Typography variant="h6" color="#475569" sx={{ mb: 2, fontWeight: 700 }}>No connectors found matching "{searchTerm}"</Typography>
              <Typography color="#94a3b8" fontWeight={500}>Try searching for: snowflake, mysql, postgresql, mongodb, oracle, redshift</Typography>
            </Box>
          )}

          {connections.length > 0 && (
            <>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2} mt={5}>
                <Typography variant="h6" sx={{ bgcolor: '#3B82F6', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700 }}>Existing Connections ({connections.length})</Typography>
                <Button variant="outlined" startIcon={showTable ? <VisibilityOff /> : <Visibility />} onClick={() => setShowTable(prev => !prev)} sx={{ borderColor: '#3B82F6', color: '#3B82F6', fontWeight: 600, borderRadius: 2, '&:hover': { borderColor: '#2563EB', bgcolor: 'rgba(102, 126, 234, 0.05)' } }}>{showTable ? 'Hide' : 'Show'} Connections</Button>
              </Stack>
              {showTable && renderConnectionsTable()}
            </>
          )}
        </Box>
      )}

      {currentView === 'snowflake' && (
        <Box>
          <Stack direction="row" alignItems="center" sx={{ borderBottom: '2px solid', borderImage: 'linear-gradient(90deg, #3B82F6 0%, #2563EB 100%) 1', pb: 3, position: 'relative', minHeight: 64, mb: 4 }}>
            <Button onClick={handleBackToSelection} startIcon={<ArrowBack />} sx={{ position: 'absolute', left: 0, color: '#3B82F6', fontWeight: 600, borderRadius: 2, '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.05)' } }} variant="text">Back to Connectors</Button>
            <Typography variant="h4" fontWeight={700} sx={{ width: '100%', textAlign: 'center', pointerEvents: 'none', bgcolor: '#3B82F6', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Configure Snowflake Connection</Typography>
          </Stack>

          <Alert severity="info" icon={<Info />} sx={{ mb: 3, borderRadius: 2, border: '1px solid rgba(59, 130, 246, 0.3)', background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)' }}>
            <Typography variant="body2" fontWeight="700" mb={1} color="#0c4a6e">Important Tips:</Typography>
            <Typography variant="body2" component="div" color="#0c4a6e" fontWeight={500}>• Fill in all required fields before testing the connection<br />• Use the <strong>"Check Snowflake Connection"</strong> button to verify your credentials<br />• The <strong>"Add Connection"</strong> button will be enabled only after a successful connection check<br />• Keep your private key file secure and never share it</Typography>
          </Alert>

          <Paper elevation={0} sx={{ mb: 4, p: 4, bgcolor: '#FFFFFF',  border: '1px solid #E5E7EB', borderRadius: 3, boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)' }}>
            <form onSubmit={handleSubmit}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Connection Name" name="connectionName" value={formData.connectionName} onChange={handleInputChange} variant="outlined" helperText="A unique name to identify this connection" sx={inputSx} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Account" name="account" value={formData.account} onChange={handleInputChange} variant="outlined" helperText="Your Snowflake account identifier" sx={inputSx} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Username" name="username" value={formData.username} onChange={handleInputChange} variant="outlined" helperText="Your Snowflake username" sx={inputSx} /></Grid>
                <Grid item xs={12} sm={6}><FormControl fullWidth required sx={inputSx}><InputLabel>Authenticator</InputLabel><Select label="Authenticator" name="authenticator" value={formData.authenticator} onChange={handleSelectChange}><MenuItem value="SNOWFLAKE_JWT">SNOWFLAKE_JWT</MenuItem><MenuItem value="SNOWFLAKE">SNOWFLAKE</MenuItem><MenuItem value="OAUTH">OAUTH</MenuItem></Select></FormControl></Grid>

                <Grid item xs={12}>
                  <Box sx={{ border: '2px dashed', borderColor: formData.privateKey ? '#3B82F6' : 'rgba(102, 126, 234, 0.3)', borderRadius: 3, p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 180, background: formData.privateKey ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)' : 'transparent' }}>
                    <Typography variant="h6" fontWeight="700" color={formData.privateKey ? '#3B82F6' : '#64748b'}>Upload Private Key *</Typography>
                    <Button variant="contained" component="label" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2, px: 5, borderRadius: 2, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}><CloudUpload sx={{ fontSize: 32, mb: 1 }} /><Typography variant="body1" fontWeight="700">Choose File</Typography><input type="file" accept=".der,.pem,.key,.p8" hidden onChange={handleFileUpload} /></Button>
                    {formData.privateKey && <Box sx={{ mt: 1, p: 2, bgcolor: '#3B82F6', borderRadius: 2, width: '100%', maxWidth: 400 }}><Typography variant="body1" sx={{ color: 'white', fontWeight: 700 }}>✓ Selected: {formData.privateKey.name}</Typography></Box>}
                    <Typography variant="caption" color="#94a3b8" fontWeight={500}>Accepted formats: .der, .pem, .key, .p8</Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}><TextField fullWidth required label="Warehouse" name="warehouse" value={formData.warehouse} onChange={handleInputChange} variant="outlined" helperText="Your Snowflake warehouse name" sx={inputSx} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Database" name="database" value={formData.database} onChange={handleInputChange} variant="outlined" helperText="Your Snowflake database name" sx={inputSx} /></Grid>
                <Grid item xs={12} sm={6}><TextField fullWidth required label="Schema" name="schema" value={formData.schema} onChange={handleInputChange} variant="outlined" helperText="Your Snowflake schema name" sx={inputSx} /></Grid>

                <Grid item xs={12}>
                  <Stack direction="row" spacing={2} flexWrap="wrap" gap={2}>
                    <Tooltip title={!formData.privateKey ? "Please upload a private key file first" : "Test your connection credentials"}><span><Button variant='contained' type="button" startIcon={isCheckingConnection ? <CircularProgress size={16} color="inherit" /> : (isSnowflakeConnectionValid ? <Check /> : connectionCheckFailed ? <Warning /> : <Close />)} onClick={CheckSnowflakeConnection} disabled={isCheckingConnection || isAddingConnection || !formData.privateKey || !formData.connectionName || !formData.account || !formData.username || !formData.authenticator || !formData.warehouse || !formData.database || !formData.schema} sx={{ borderRadius: 2, fontWeight: 700, background: isSnowflakeConnectionValid ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' : connectionCheckFailed ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)', '&:hover': { background: isSnowflakeConnectionValid ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' : connectionCheckFailed ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)' } }}>{isCheckingConnection ? 'Checking...' : (isSnowflakeConnectionValid ? 'Connection Valid ✓' : connectionCheckFailed ? 'Connection Failed ✗' : 'Check Connection')}</Button></span></Tooltip>
                    <Tooltip title={!isSnowflakeConnectionValid ? "Please check connection first" : "Add this connection to your saved connections"}><span><Button variant="contained" type="submit" startIcon={isAddingConnection ? <CircularProgress size={16} color="inherit" /> : <Add />} disabled={isAddingConnection || !formData.privateKey || !isSnowflakeConnectionValid} sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}>{isAddingConnection ? 'Adding...' : 'Add Connection'}</Button></span></Tooltip>
                    <Button variant="outlined" startIcon={showTable ? <VisibilityOff /> : <Visibility />} onClick={() => setShowTable(prev => !prev)} sx={{ borderRadius: 2, fontWeight: 700, borderColor: '#3B82F6', color: '#3B82F6', '&:hover': { borderColor: '#2563EB', bgcolor: 'rgba(102, 126, 234, 0.05)' } }}>{showTable ? "Hide" : "Show"} Connections</Button>
                  </Stack>
                </Grid>
              </Grid>
            </form>
          </Paper>

          {showTable && renderConnectionsTable()}
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="lg" fullWidth PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(102, 126, 234, 0.2)' } }}>
        <DialogTitle sx={{ bgcolor: '#3B82F6', color: 'white', fontWeight: 700 }}>Edit Connection<IconButton onClick={() => setOpenDialog(false)} sx={{ position: 'absolute', right: 16, top: 16, color: 'white', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' } }}><Close /></IconButton></DialogTitle>
        <DialogContent dividers sx={{ p: 3 }}>
          <Alert severity="warning" icon={<Warning />} sx={{ mb: 3, borderRadius: 2, border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)' }}><Typography variant="body2" fontWeight="700" mb={1} color="#92400e">Security Requirement:</Typography><Typography variant="body2" color="#92400e" fontWeight={500}>You <strong>must upload a new private key file</strong> to update this connection. This is required for security purposes.<br />After uploading, use <strong>"Check Connection"</strong> to verify before saving.</Typography></Alert>
          
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}><TextField fullWidth required label="Connection Name" name="connectionName" value={editData.connectionName || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth required label="Account" name="account" value={editData.account || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth required label="Username" name="username" value={editData.username || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
            <Grid item xs={12} sm={6}><FormControl fullWidth required sx={inputSx}><InputLabel>Authenticator</InputLabel><Select label="Authenticator" name="authenticator" value={editData.authenticator || ''} onChange={handleEditSelectChange}><MenuItem value="SNOWFLAKE_JWT">SNOWFLAKE_JWT</MenuItem><MenuItem value="SNOWFLAKE">SNOWFLAKE</MenuItem><MenuItem value="OAUTH">OAUTH</MenuItem></Select></FormControl></Grid>
            
            <Grid item xs={12}>
              <Box sx={{ border: '2px dashed', borderColor: editData.privateKey ? '#10b981' : '#f59e0b', borderRadius: 3, p: 4, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 200, background: editData.privateKey ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(20, 184, 166, 0.05) 100%)' : 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)' }}>
                <Typography variant="h6" fontWeight="700" color={editData.privateKey ? '#10b981' : '#f59e0b'}>{editData.privateKey ? '✓ New Private Key Uploaded' : '⚠ Upload New Private Key (Required) *'}</Typography>
                <Button variant="contained" component="label" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2.5, px: 6, borderRadius: 2, background: editData.privateKey ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #f97316 100%)', '&:hover': { background: editData.privateKey ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' : 'linear-gradient(135deg, #ea580c 0%, #dc2626 100%)' } }}><CloudUpload sx={{ fontSize: 36, mb: 1 }} /><Typography variant="body1" fontWeight="700">{editData.privateKey ? 'Change File' : 'Choose New File'}</Typography><input type="file" accept=".der,.pem,.key,.p8" hidden onChange={handleEditFileUpload} /></Button>
                {editData.privateKey && <Box sx={{ mt: 1, p: 2, background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', borderRadius: 2, width: '100%', maxWidth: 500 }}><Typography variant="body1" sx={{ color: 'white', fontWeight: 700 }}>New file: {editData.privateKey.name}</Typography></Box>}
                {!editData.privateKey && existingPrivateKeyFileName && <Typography variant="caption" color="#64748b" fontStyle="italic" fontWeight={500}>Previous file: {existingPrivateKeyFileName} (will be replaced)</Typography>}
                <Typography variant="caption" color="#94a3b8" fontWeight={500}>Accepted formats: .der, .pem, .key, .p8</Typography>
              </Box>
            </Grid>
            
            <Grid item xs={12} sm={6}><TextField fullWidth required label="Warehouse" name="warehouse" value={editData.warehouse || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
            <Grid item xs={12} sm={6}><TextField fullWidth required label="Database" name="database" value={editData.database || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
            <Grid item xs={12}><TextField fullWidth required label="Schema" name="schema" value={editData.schema || ''} onChange={handleEditInputChange} variant="outlined" sx={inputSx} /></Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <Button onClick={() => setOpenDialog(false)} startIcon={<Close />} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: '#cbd5e1', color: '#64748b', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancel</Button>
          <Tooltip title={!editData.privateKey ? "Please upload a new private key file first" : "Test your connection before saving"}><span><Button variant='contained' type="button" startIcon={isEditCheckingConnection ? <CircularProgress size={16} color="inherit" /> : (isEditSnowflakeConnectionValid ? <Check /> : editConnectionCheckFailed ? <Warning /> : <Close />)} onClick={checkEditSnowFlakeConnection} disabled={isEditCheckingConnection || isEditingConnection || !editData.privateKey ||!editData.account || !editData.username || !editData.authenticator || !editData.warehouse || !editData.database || !editData.schema} sx={{ borderRadius: 2, fontWeight: 700, background: isEditSnowflakeConnectionValid ? 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' : editConnectionCheckFailed ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)', '&:hover': { background: isEditSnowflakeConnectionValid ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' : editConnectionCheckFailed ? 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' : 'linear-gradient(135deg, #64748b 0%, #475569 100%)' } }}>{isEditCheckingConnection ? 'Checking...' : (isEditSnowflakeConnectionValid ? 'Connection Valid ✓' : editConnectionCheckFailed ? 'Connection Failed ✗' : 'Check Connection')}</Button></span></Tooltip>
          <Tooltip title={!editData.privateKey ? "Upload a new private key first" : !isEditSnowflakeConnectionValid ? "Check connection first" : "Save your changes"}><span><Button onClick={handleSaveEdit} startIcon={isEditingConnection ? <CircularProgress size={16} color="inherit" /> : <Save />} variant="contained" disabled={isEditingConnection || !editData.privateKey || !isEditSnowflakeConnectionValid} sx={{ borderRadius: 2, fontWeight: 700, bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}>{isEditingConnection ? 'Saving...' : 'Save Changes'}</Button></span></Tooltip>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)' } }}>
        <DialogTitle sx={{ color: '#dc2626', fontWeight: 700 }}>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2, color: '#1e293b' }}>Are you sure you want to delete the connection <strong>"{connectionToDelete?.connectionName}"</strong>?</Typography>
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2, border: '1px solid rgba(245, 158, 11, 0.3)', background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)' }}>This action cannot be undone. All configuration data for this connection will be permanently removed.</Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2.5, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>
          <Button onClick={handleCancelDelete} variant="outlined" sx={{ borderRadius: 2, fontWeight: 600, borderColor: '#cbd5e1', color: '#64748b', '&:hover': { borderColor: '#94a3b8', bgcolor: '#f1f5f9' } }}>Cancel</Button>
          <Button onClick={handleConfirmDelete} variant="contained" startIcon={isDeletingConnection ? <CircularProgress size={16} color="inherit" /> : <Delete />} disabled={isDeletingConnection !== null} sx={{ borderRadius: 2, fontWeight: 700, background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', '&:hover': { background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' } }}>{isDeletingConnection ? 'Deleting...' : 'Delete Connection'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConnectorManager;