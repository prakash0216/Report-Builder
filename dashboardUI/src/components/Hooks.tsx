import React, { useState, useCallback, useEffect } from 'react';
import {
    useRecoilState,
    useRecoilValue,
    useSetRecoilState,
    useRecoilCallback,
} from 'recoil';
import {
    Box,
    Tabs,
    Tab,
    TextField,
    Button,
    Typography,
    Paper,
    Card,
    CardContent,
    Chip,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Alert,
    CircularProgress,
    Tooltip,
    Stack,
    Grid,
    alpha,
    useTheme,
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    PlayArrow as PlayArrowIcon,
    Delete as DeleteIcon,
    Download as DownloadIcon,
    Edit as EditIcon,
    Refresh as RefreshIcon,
    Code as CodeIcon,
    Storage as StorageIcon,
    Visibility as VisibilityIcon,
    Info as InfoIcon,
    FilterList as FilterListIcon,
} from '@mui/icons-material';

import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { storedLogicsState, StoredLogic } from '../recoil/StoredLogic';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily } from '../recoil/FiltersFamily';
import { filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { liveFilterFamily } from '../recoil/LiveFilterFamily';
import { CalculationEditor } from './CalculationEditor';
import { getCurrentDashboardId } from '../recoil/ViewContext';

// Helper to safely parse stored strings into arrays/objects/values
const safeParse = (value: string): any => {
    // If it's a string that looks like a formatted number (contains commas), return as-is
    if (typeof value === 'string' && /^[\d,]+$/.test(value)) {
      return value;
    }
    
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

// Helper to truncate text with ellipsis
const truncateText = (text: string, maxLength: number = 150): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

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
            id={`tabpanel-${index}`}
            aria-labelledby={`tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
        </div>
    );
}

// Variable Chip with Tooltip - shows value on hover
function VariableChipWithTooltip({ 
    name, 
    type,
    bgColor,
    textColor,
    borderColor,
}: { 
    name: string; 
    type: 'variable' | 'parameter' | 'filter';
    bgColor: string;
    textColor: string;
    borderColor: string;
}) {
    // Use different atoms based on type
    const variableValue = useRecoilValue(variableAtomFamily(name));
    const parameterValue = useRecoilValue(parameterAtomFamily(name));
    const filterConfig = useRecoilValue(filterConfigFamily(name));
    const liveFilterValue = useRecoilValue(liveFilterFamily(name));
    
    // Get the appropriate value based on type
    const getRawValue = () => {
        if (type === 'variable') return variableValue;
        if (type === 'parameter') return parameterValue;
        if (type === 'filter') return liveFilterValue ?? filterConfig?.defaultValues;
        return null;
    };
    
    const rawValue = getRawValue();
    const parsedValue = safeParse(rawValue);
    
    const getDisplayValue = () => {
        if (parsedValue === undefined || parsedValue === null || parsedValue === '') {
            return '(empty)';
        }
        if (Array.isArray(parsedValue)) {
            const preview = parsedValue.slice(0, 5);
            return JSON.stringify(preview, null, 2) + (parsedValue.length > 5 ? `\n... +${parsedValue.length - 5} more` : '');
        }
        if (typeof parsedValue === 'object') {
            const str = JSON.stringify(parsedValue, null, 2);
            return str.length > 300 ? str.substring(0, 300) + '\n...' : str;
        }
        return String(parsedValue);
    };

    const getTypeLabel = () => {
        if (parsedValue === undefined || parsedValue === null) return 'empty';
        if (Array.isArray(parsedValue)) return `Array[${parsedValue.length}]`;
        if (typeof parsedValue === 'object') return 'Object';
        if (typeof parsedValue === 'number') return 'Number';
        if (typeof parsedValue === 'string') return 'String';
        if (typeof parsedValue === 'boolean') return 'Boolean';
        return typeof parsedValue;
    };

    const getTypeIcon = () => {
        if (type === 'variable') return '📊';
        if (type === 'parameter') return '⚙️';
        if (type === 'filter') return '🔽';
        return '📦';
    };

    const getTypeColor = () => {
        if (type === 'variable') return '#06b6d4';
        if (type === 'parameter') return '#f59e0b';
        if (type === 'filter') return '#ec4899';
        return '#64748b';
    };

    return (
        <Tooltip
            title={
                <Box sx={{ width: 280 }}>
                    {/* Header */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 1, 
                        pb: 1, 
                        mb: 1, 
                        borderBottom: '1px solid rgba(255,255,255,0.15)' 
                    }}>
                        <Box sx={{ 
                            fontSize: '0.9rem',
                            width: 24,
                            height: 24,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            bgcolor: 'rgba(255,255,255,0.1)',
                            flexShrink: 0,
                        }}>
                            {getTypeIcon()}
                        </Box>
                        <Box sx={{ overflow: 'hidden', flex: 1 }}>
                            <Typography 
                                variant="subtitle2" 
                                fontWeight={700} 
                                sx={{ 
                                    color: getTypeColor(),
                                    fontFamily: 'monospace',
                                    fontSize: '0.8rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.65rem' }}>
                                {type.charAt(0).toUpperCase() + type.slice(1)} • {getTypeLabel()}
                            </Typography>
                        </Box>
                    </Box>
                    
                    {/* Value Preview */}
                    <Box
                        component="pre"
                        sx={{
                            fontSize: '0.7rem',
                            fontFamily: '"Consolas", "Monaco", monospace',
                            bgcolor: 'rgba(0,0,0,0.5)',
                            p: 1,
                            borderRadius: 1,
                            maxHeight: 150,
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            m: 0,
                            color: '#e2e8f0',
                            lineHeight: 1.4,
                        }}
                    >
                        {getDisplayValue()}
                    </Box>
                    
                    {/* Footer */}
                    <Box sx={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        mt: 1, 
                        pt: 0.75, 
                        borderTop: '1px solid rgba(255,255,255,0.1)' 
                    }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem' }}>
                            📋 Click to copy
                        </Typography>
                        {Array.isArray(parsedValue) && (
                            <Typography variant="caption" sx={{ color: getTypeColor(), fontSize: '0.6rem', fontWeight: 600 }}>
                                {parsedValue.length} items
                            </Typography>
                        )}
                    </Box>
                </Box>
            }
            arrow
            placement="top"
            slotProps={{
                tooltip: {
                    sx: {
                        bgcolor: '#1e293b',
                        border: '1px solid rgba(102, 126, 234, 0.25)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                        borderRadius: 1.5,
                        p: 1.5,
                        maxWidth: 'none',
                        '& .MuiTooltip-arrow': {
                            color: '#1e293b',
                            '&::before': {
                                border: '1px solid rgba(102, 126, 234, 0.25)',
                            },
                        },
                    },
                },
            }}
        >
            <Chip
                label={name}
                size="small"
                onClick={() => {
                    navigator.clipboard.writeText(name);
                }}
                sx={{
                    height: 24,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    bgcolor: bgColor,
                    color: textColor,
                    border: `1px solid ${borderColor}`,
                    cursor: 'pointer',
                    '&:hover': {
                        bgcolor: bgColor.replace('0.12', '0.25'),
                        transform: 'translateY(-1px)',
                        boxShadow: `0 4px 12px ${borderColor}`,
                    },
                    transition: 'all 0.2s ease',
                }}
            />
        </Tooltip>
    );
}

// Variable Display Component
function VariableDisplay({ name }: { name: string }) {
    const rawValue = useRecoilValue(variableAtomFamily(name));
    const parsedValue = safeParse(rawValue);
    const displayString = typeof parsedValue === 'object'
        ? JSON.stringify(parsedValue, null, 2)
        : String(parsedValue);
    const truncatedDisplay = truncateText(displayString, 250);

    const getType = () => {
        if (Array.isArray(parsedValue)) return 'array';
        if (parsedValue === null) return 'null';
        return typeof parsedValue;
    };

    const getTypeInfo = () => {
        const type = getType();
        if (type === 'array') {
            return {
                label: `Array (${parsedValue.length})`,
                gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            };
        }
        if (type === 'object') return { label: 'Object', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' };
        if (type === 'number') return { label: 'Number', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' };
        if (type === 'string') return { label: 'String', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' };
        return { label: type, gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' };
    };

    const typeInfo = getTypeInfo();

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.2)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                    transform: 'translateY(-2px)',
                    borderColor: '#667eea',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography 
                        variant="subtitle1" 
                        fontWeight="700"
                        sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        {name}
                    </Typography>
                    <Chip 
                        label={typeInfo.label} 
                        size="small" 
                        sx={{
                            background: typeInfo.gradient,
                            color: 'white',
                            fontWeight: 600,
                        }}
                    />
                </Box>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%)',
                        borderRadius: 2,
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        maxHeight: 200,
                        overflow: 'auto',
                    }}
                >
                    <Tooltip title={displayString.length > 250 ? displayString : ''} arrow placement="top">
                        <Typography
                            component="pre"
                            variant="body2"
                            sx={{
                                fontFamily: '"Fira Code", "Courier New", monospace',
                                fontSize: '0.8rem',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                m: 0,
                                cursor: displayString.length > 250 ? 'help' : 'default',
                                color: '#475569',
                            }}
                        >
                            {truncatedDisplay}
                        </Typography>
                    </Tooltip>
                </Paper>
            </CardContent>
        </Card>
    );
}

// Filter Display Component
function FilterDisplay({ name }: { name: string }) {
    const parsedValue = useRecoilValue(liveFilterFamily(name));
    const displayString = parsedValue !== undefined && parsedValue !== null
        ? (typeof parsedValue === 'object' ? JSON.stringify(parsedValue, null, 2) : String(parsedValue))
        : 'N/A';

    const getType = () => {
        if (Array.isArray(parsedValue)) return 'array';
        if (parsedValue === null) return 'null';
        if (parsedValue === undefined) return 'undefined';
        return typeof parsedValue;
    };

    const getTypeInfo = () => {
        const type = getType();
        if (type === 'array') {
            return {
                label: `Array (${parsedValue.length})`,
                gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            };
        }
        return { label: type, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' };
    };

    const typeInfo = getTypeInfo();

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid rgba(79, 172, 254, 0.3)',
                background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.05) 0%, rgba(0, 242, 254, 0.05) 100%)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: '0 8px 24px rgba(79, 172, 254, 0.2)',
                    transform: 'translateY(-2px)',
                    borderColor: '#4facfe',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography 
                        variant="subtitle1" 
                        fontWeight="700"
                        sx={{
                            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        {name}
                    </Typography>
                    <Chip 
                        label={typeInfo.label} 
                        size="small"
                        sx={{
                            background: typeInfo.gradient,
                            color: 'white',
                            fontWeight: 600,
                        }}
                    />
                </Box>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 2,
                        border: '1px solid rgba(79, 172, 254, 0.2)',
                        maxHeight: 200,
                        overflow: 'auto',
                    }}
                >
                    <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                            fontFamily: '"Fira Code", "Courier New", monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            m: 0,
                            color: '#475569',
                        }}
                    >
                        {displayString}
                    </Typography>
                </Paper>
            </CardContent>
        </Card>
    );
}

// Stored Logic Item Component
function StoredLogicItem({
    logic,
    onEdit,
    onDelete,
    onExecute,
    onDownload,
}: {
    logic: StoredLogic;
    onEdit: (logic: StoredLogic) => void;
    onDelete: (id: string) => void;
    onExecute: (logic: StoredLogic) => Promise<void>;
    onDownload?: (logic: StoredLogic) => void;
}) {
    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                border: '1px solid rgba(102, 126, 234, 0.2)',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: '0 8px 24px rgba(102, 126, 234, 0.2)',
                    borderColor: '#667eea',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography 
                        variant="h6" 
                        fontWeight="700"
                        sx={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        {logic.variableName}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit Logic" arrow>
                            <IconButton
                                size="small"
                                sx={{
                                    color: '#667eea',
                                    '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.1)' },
                                }}
                                onClick={() => onEdit(logic)}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Execute Now" arrow>
                            <IconButton
                                size="small"
                                sx={{
                                    color: '#10b981',
                                    '&:hover': { bgcolor: 'rgba(16, 185, 129, 0.1)' },
                                }}
                                onClick={() => onExecute(logic)}
                            >
                                <PlayArrowIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        {onDownload && (
                            <Tooltip title="Download Logic" arrow>
                                <IconButton
                                    size="small"
                                    sx={{
                                        color: '#4facfe',
                                        '&:hover': { bgcolor: 'rgba(79, 172, 254, 0.1)' },
                                    }}
                                    onClick={() => onDownload(logic)}
                                >
                                    <DownloadIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title="Delete Logic" arrow>
                            <IconButton
                                size="small"
                                sx={{
                                    color: '#ef4444',
                                    '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.1)' },
                                }}
                                onClick={() => onDelete(logic.id)}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </Box>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.5) 0%, rgba(241, 245, 249, 0.5) 100%)',
                        borderRadius: 2,
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        maxHeight: 150,
                        overflow: 'auto',
                    }}
                >
                    <Typography
                        component="pre"
                        variant="body2"
                        sx={{
                            fontFamily: '"Fira Code", "Courier New", monospace',
                            fontSize: '0.8rem',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            m: 0,
                            color: '#475569',
                        }}
                    >
                        {truncateText(logic.logic, 400)}
                    </Typography>
                </Paper>
                <Box mt={2} display="flex" gap={2} flexWrap="wrap">
                    <Chip
                        icon={<InfoIcon fontSize="small" />}
                        label={`Created: ${new Date(logic.createdAt).toLocaleDateString()}`}
                        size="small"
                        variant="outlined"
                        sx={{
                            borderColor: '#667eea',
                            color: '#667eea',
                            fontWeight: 600,
                        }}
                    />
                    {logic.lastExecuted && (
                        <Chip
                            icon={<PlayArrowIcon fontSize="small" />}
                            label={`Last run: ${new Date(logic.lastExecuted).toLocaleString()}`}
                            size="small"
                            sx={{
                                background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                                color: 'white',
                                fontWeight: 600,
                            }}
                        />
                    )}
                </Box>
            </CardContent>
        </Card>
    );
}

export default function Hooks() {
    const theme = useTheme();
    const [tabValue, setTabValue] = useState(0);
    const [variableNames, setVariableNames] = useRecoilState(variableNamesState);
    const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);

    const [storedLogics, setStoredLogics] = useRecoilState(storedLogicsState);

    const [calculationLogic, setCalculationLogic] = useState('');
    const [variableName, setVariableName] = useState('');
    const [editingCalculationId, setEditingCalculationId] = useState<string | null>(null);
    const [oldVariableName, setOldVariableName] = useState<string | null>(null); // Track old variable name when editing
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Helper function to reload calculations from database
    const reloadCalculations = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:3002/api/calculations');
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.calculations) {
                    const updatedLogics = data.calculations.map((dbCalc: any) => ({
                        id: dbCalc.id.toString(),
                        variableName: dbCalc.variable_name,
                        logic: dbCalc.logic,
                        createdAt: new Date(dbCalc.created_at).getTime(),
                        lastExecuted: dbCalc.last_executed ? new Date(dbCalc.last_executed).getTime() : undefined,
                    }));
                    setStoredLogics(updatedLogics);
                    return updatedLogics;
                }
            }
        } catch (err) {
            console.error('Failed to reload calculations:', err);
        }
        return null;
    }, [setStoredLogics]);

    const [isScopeExpanded, setIsScopeExpanded] = useState(false);

    const parameterNames = useRecoilValue(parameterNamesState);
    const filterNames = useRecoilValue(filterNamesState);

    const setVariableAtom = useRecoilCallback(
        ({ set }) =>
            (varName: string, value: string) => {
                set(variableAtomFamily(varName), value);
            },
        []
    );

    const resetVariableAtom = useRecoilCallback(
        ({ reset }) =>
            (varName: string) => {
                reset(variableAtomFamily(varName));
            },
        []
    );

    const initializeFilterDefaults = useRecoilCallback(
        ({ snapshot, set }) =>
            async () => {
                try {
                    for (const filterId of filterNames) {
                        const filterConfig = await snapshot.getPromise(filterConfigFamily(filterId));

                        if (
                            filterConfig?.defaultValues &&
                            filterConfig.defaultValues.length > 0 &&
                            filterConfig.variableName
                        ) {
                            set(liveFilterFamily(filterConfig.variableName), filterConfig.defaultValues);
                            console.log(`✅ Initialized filter: ${filterConfig.variableName}`, filterConfig.defaultValues);
                        }
                    }
                } catch (err) {
                    console.error('Error initializing filter defaults:', err);
                }
            },
        [filterNames]
    );

    useEffect(() => {
        initializeFilterDefaults();
    }, [initializeFilterDefaults]);

    const executeSingleLogic = useRecoilCallback(
        ({ set, snapshot }) =>
            async (logic: StoredLogic) => {
                try {
                    const allVariables: Record<string, any> = {};
                    const allParameters: Record<string, any> = {};
                    const allFilters: Record<string, any> = {};

                    variableNames.forEach((varName) => {
                        try {
                            const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
                            const parsedValue = safeParse(rawValue);
                            if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                                allVariables[varName] = parsedValue;
                            }
                        } catch (err) {
                            console.warn(`[Hooks] Failed to load variable ${varName}:`, err);
                        }
                    });

                    const filterNamesSet = new Set(filterNames);

                    parameterNames.forEach((paramName) => {
                        if (!filterNamesSet.has(paramName)) {
                            try {
                                const rawValue = snapshot.getLoadable(parameterAtomFamily(paramName)).contents;
                                const parsedValue = safeParse(rawValue);
                                if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                                    allParameters[paramName] = parsedValue;
                                }
                            } catch (err) {
                                console.warn(`[Hooks] Failed to load explicit parameter ${paramName}:`, err);
                            }
                        }
                    });

                    filterNames.forEach((filterId) => {
                        try {
                          const filterConfig = snapshot.getLoadable(filterConfigFamily(filterId)).contents;
                      
                          if (filterConfig && filterConfig.variableName) {
                            const selectedOptions = snapshot.getLoadable(
                              liveFilterFamily(filterConfig.variableName)
                            ).contents;
                      
                            // 🔥 Calculate metadata
                            const totalOptions = filterConfig.availableOptions?.length || 0;
                            const selectedCount = selectedOptions?.length || 0;
                            const isAll = selectedCount === totalOptions && totalOptions > 0;
                      
                            // 🔥 FIXED: Create a plain object that will serialize properly
                            const filterData = {
                              values: selectedOptions || [],  // The actual array
                              isAll: isAll,
                              total: totalOptions,
                              columnName: filterConfig.variableName
                            };
                            
                            allFilters[filterConfig.variableName] = filterData;
                      
                            console.log(`✅ [Hooks] Loaded filter: ${filterConfig.variableName}`, {
                              selected: selectedCount,
                              total: totalOptions,
                              isAll: isAll
                            });
                          }
                        } catch (err) {
                          console.warn(`[Hooks] Failed to load live filter value for ${filterId}:`, err);
                        }
                      });


                    console.log(`🔄 [Hooks] Executing logic for: ${logic.variableName}`);
                    console.log(`📦 [Hooks] Fresh variables:`, Object.keys(allVariables));
                    console.log(`📦 [Hooks] Fresh parameters:`, Object.keys(allParameters));
                    console.log(`📦 [Hooks] Fresh filters:`, Object.keys(allFilters));

                    const response = await fetch('http://localhost:3002/api/calculate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            logic: logic.logic,
                            existingVariables: allVariables,
                            existingParameters: allParameters,
                            existingFilters: allFilters,
                            variableName: logic.variableName,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `HTTP error ${response.status}`);
                    }

                    const result = await response.json();
                    const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

                    console.log(
                        `✅ [Hooks] Success for ${logic.variableName}:`,
                        Array.isArray(calculatedValue) ? `Array with ${calculatedValue.length} items` : calculatedValue
                    );

                    set(variableAtomFamily(logic.variableName), JSON.stringify(calculatedValue));

                    setVariableNames((prev) => {
                        const newSet = new Set(prev);
                        newSet.add(logic.variableName);
                        return newSet;
                    });

                    // Update last_executed timestamp in database
                    try {
                        await fetch(`http://localhost:3002/api/calculations/${logic.id}/execute`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                        });
                    } catch (err) {
                        console.warn('Failed to update execution timestamp:', err);
                    }

                    // Update local state
                    setStoredLogics((prev) =>
                        prev.map((l) => (l.id === logic.id ? { ...l, lastExecuted: Date.now() } : l))
                    );

                    return { success: true, result: calculatedValue };
                } catch (err) {
                    console.error(`❌ [Hooks] Failed to execute logic for ${logic.variableName}:`, err);
                    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
                }
            },
        [variableNames, parameterNames, filterNames, setVariableNames, setStoredLogics]
    );

    const manualRecalculateAll = useCallback(async () => {
        if (storedLogics.length === 0) return;

        setIsLoading(true);
        setError(null);
        try {
            console.log(`🚀 [Hooks] Manual recalculation starting for ${storedLogics.length} logics...`);

            const sortedLogics = [...storedLogics].sort((a, b) => a.createdAt - b.createdAt);
            console.log(
                `📋 [Hooks] Execution order:`,
                sortedLogics.map((l) => l.variableName)
            );

            const results = [];
            for (const logic of sortedLogics) {
                const result = await executeSingleLogic(logic);
                results.push({ logic: logic.variableName, ...result });
            }

            setTimeout(() => {
                setUpdateTrigger((prev) => prev + 1);
            }, 100);

            console.log('✅ [Hooks] Manual recalculation completed:', results);
            setSuccess('All calculations completed successfully!');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Recalculation failed');
        } finally {
            setIsLoading(false);
        }
    }, [storedLogics, executeSingleLogic, setUpdateTrigger]);

    const executeCalculation = useRecoilCallback(
        ({ snapshot }) =>
            async () => {
                if (!calculationLogic.trim() || !variableName.trim()) {
                    setError('Please fill in all fields');
                    return;
                }

                setIsLoading(true);
                setError(null);
                setSuccess(null);

                try {
                    const allVariables: Record<string, any> = {};
                    const allParameters: Record<string, any> = {};
                    const allFilters: Record<string, any> = {};

                    variableNames.forEach((varName) => {
                        try {
                            const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
                            const parsedValue = safeParse(rawValue);
                            if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                                allVariables[varName] = parsedValue;
                            }
                        } catch (err) {
                            console.warn(`[Hooks] Failed to load variable ${varName}:`, err);
                        }
                    });

                    const filterNamesSet = new Set(filterNames);

                    parameterNames.forEach((paramName) => {
                        if (!filterNamesSet.has(paramName)) {
                            try {
                                const rawValue = snapshot.getLoadable(parameterAtomFamily(paramName)).contents;
                                const parsedValue = safeParse(rawValue);
                                if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                                    allParameters[paramName] = parsedValue;
                                }
                            } catch (err) {
                                console.warn(`[Hooks] Failed to load explicit parameter ${paramName}:`, err);
                            }
                        }
                    });

                    filterNames.forEach((filterId) => {
                        try {
                          const filterConfig = snapshot.getLoadable(filterConfigFamily(filterId)).contents;
                      
                          if (filterConfig && filterConfig.variableName) {
                            const selectedOptions = snapshot.getLoadable(
                              liveFilterFamily(filterConfig.variableName)
                            ).contents;
                      
                            // 🔥 Calculate metadata
                            const totalOptions = filterConfig.availableOptions?.length || 0;
                            const selectedCount = selectedOptions?.length || 0;
                            const isAll = selectedCount === totalOptions && totalOptions > 0;
                      
                            // 🔥 FIXED: Create a plain object that will serialize properly
                            const filterData = {
                              values: selectedOptions || [],  // The actual array
                              isAll: isAll,
                              total: totalOptions,
                              columnName: filterConfig.variableName
                            };
                            
                            allFilters[filterConfig.variableName] = filterData;
                      
                            console.log(`✅ [Hooks] Loaded filter: ${filterConfig.variableName}`, {
                              selected: selectedCount,
                              total: totalOptions,
                              isAll: isAll
                            });
                          }
                        } catch (err) {
                          console.warn(`[Hooks] Failed to load live filter value for ${filterId}:`, err);
                        }
                      });

                    const response = await fetch('http://localhost:3002/api/calculate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            logic: calculationLogic,
                            existingVariables: allVariables,
                            existingParameters: allParameters,
                            existingFilters: allFilters,
                            variableName,
                        }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || `HTTP error ${response.status}`);
                    }

                    const result = await response.json();
                    const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

                    setVariableAtom(variableName, JSON.stringify(calculatedValue));

                    setVariableNames((prev) => {
                        const newSet = new Set(prev);
                        newSet.add(variableName);
                        return newSet;
                    });

                    // 🔑 FIX: Check if we're editing an existing calculation by ID
                    if (editingCalculationId) {
                        // Update existing calculation by ID (regardless of variable name change)
                        try {
                            // If variable name changed, clean up old variable
                            if (oldVariableName && oldVariableName !== variableName) {
                                // Remove old variable name from set
                                setVariableNames((prev) => {
                                    const newSet = new Set(prev);
                                    newSet.delete(oldVariableName);
                                    return newSet;
                                });
                                
                                // Reset old variable atom
                                resetVariableAtom(oldVariableName);
                                console.log(`🧹 Cleaned up old variable: ${oldVariableName}`);
                            }

                            const updateResponse = await fetch(`http://localhost:3002/api/calculations/${editingCalculationId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    variableName, // Allow variable name to be updated too
                                    logic: calculationLogic,
                                }),
                            });

                            if (!updateResponse.ok) {
                                throw new Error('Failed to update calculation');
                            }

                            // Update execution timestamp
                            await fetch(`http://localhost:3002/api/calculations/${editingCalculationId}/execute`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                            });

                            // Reload calculations from database
                            await reloadCalculations();
                            
                            // Clear editing state
                            setEditingCalculationId(null);
                            setOldVariableName(null);
                        } catch (err) {
                            console.error('Failed to update calculation:', err);
                            throw err;
                        }
                        setSuccess(`Logic for variable "${variableName}" updated successfully.`);
                    } else {
                        // Not editing - check if variable name already exists (for new calculations)
                        const existingLogicIndex = storedLogics.findIndex((logic) => logic.variableName === variableName);

                        if (existingLogicIndex !== -1) {
                            // Variable name exists - update it
                            const existingLogic = storedLogics[existingLogicIndex];
                            try {
                                const updateResponse = await fetch(`http://localhost:3002/api/calculations/${existingLogic.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        logic: calculationLogic,
                                    }),
                                });

                                if (!updateResponse.ok) {
                                    throw new Error('Failed to update calculation');
                                }

                                // Update execution timestamp
                                await fetch(`http://localhost:3002/api/calculations/${existingLogic.id}/execute`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                });

                                // Reload calculations from database
                                await reloadCalculations();
                            } catch (err) {
                                console.error('Failed to update calculation:', err);
                                throw err;
                            }
                            setSuccess(`Logic for variable "${variableName}" updated successfully.`);
                        } else {
                        // Create new calculation in database
                        try {
                            const dashboardId = getCurrentDashboardId();
                            const createResponse = await fetch('http://localhost:3002/api/calculations', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    variableName,
                                    logic: calculationLogic,
                                    dashboardId,
                                }),
                            });

                            if (!createResponse.ok) {
                                const errorData = await createResponse.json();
                                throw new Error(errorData.error || 'Failed to create calculation');
                            }

                            // Reload calculations to get the new one with its ID
                            const updatedLogics = await reloadCalculations();
                            
                            // Find the newly created calculation and update execution timestamp
                            if (updatedLogics) {
                                const newCalc = updatedLogics.find((c: StoredLogic) => c.variableName === variableName);
                                if (newCalc) {
                                    await fetch(`http://localhost:3002/api/calculations/${newCalc.id}/execute`, {
                                        method: 'PUT',
                                        headers: { 'Content-Type': 'application/json' },
                                    });
                                    // Reload one more time to get the updated timestamp
                                    await reloadCalculations();
                                }
                            }
                        } catch (err) {
                            console.error('Failed to create calculation:', err);
                            throw err;
                        }
                            setSuccess(`Variable "${variableName}" created and logic stored successfully.`);
                        }
                    }

                    setTimeout(() => {
                        setUpdateTrigger((prev) => prev + 1);
                    }, 100);

                    setCalculationLogic('');
                    setVariableName('');
                    setEditingCalculationId(null); // Clear editing state
                    setOldVariableName(null); // Clear old variable name
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed execution');
                } finally {
                    setIsLoading(false);
                }
            },
        [
            calculationLogic,
            variableName,
            editingCalculationId, // Include editingCalculationId in dependencies
            oldVariableName, // Include oldVariableName in dependencies
            variableNames,
            parameterNames,
            filterNames,
            setVariableAtom,
            resetVariableAtom, // Include resetVariableAtom in dependencies
            setVariableNames,
            setUpdateTrigger,
            setStoredLogics,
            storedLogics,
            reloadCalculations,
        ]
    );

    const editStoredLogic = useCallback((logic: StoredLogic) => {
        setCalculationLogic(logic.logic);
        setVariableName(logic.variableName);
        setEditingCalculationId(logic.id); // Track which calculation we're editing
        setOldVariableName(logic.variableName); // Track old variable name to clean up if changed
        setTabValue(0);
        setError(null);
        setSuccess(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const deleteStoredLogic = useRecoilCallback(
        ({ reset }) =>
            async (id: string) => {
                const logicToDelete = storedLogics.find((logic) => logic.id === id);

                if (!logicToDelete) {
                    return;
                }

                try {
                    // Delete from database
                    const deleteResponse = await fetch(`http://localhost:3002/api/calculations/${id}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                    });

                    if (!deleteResponse.ok) {
                        throw new Error('Failed to delete calculation');
                    }

                    // Reset variable atom
                    reset(variableAtomFamily(logicToDelete.variableName));

                    // Remove from variable names
                    setVariableNames((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(logicToDelete.variableName);
                        return newSet;
                    });

                    // Reload calculations from database
                    await reloadCalculations();

                    setTimeout(() => {
                        setUpdateTrigger((prev) => prev + 1);
                    }, 100);

                    setSuccess(`Logic "${logicToDelete.variableName}" deleted successfully.`);
                } catch (err) {
                    console.error('Failed to delete calculation:', err);
                    setError(err instanceof Error ? err.message : 'Failed to delete calculation');
                }
            },
        [storedLogics, setVariableNames, setStoredLogics, setUpdateTrigger]
    );

    const executeStoredLogic = useCallback(
        async (logic: StoredLogic) => {
            setIsLoading(true);
            setError(null);
            try {
                const result = await executeSingleLogic(logic);
                if (result.success) {
                    setSuccess(`Logic for "${logic.variableName}" executed successfully.`);
                    setTimeout(() => {
                        setUpdateTrigger((prev) => prev + 1);
                    }, 100);
                } else {
                    setError(result.error || 'Execution failed');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Execution failed');
            } finally {
                setIsLoading(false);
            }
        },
        [executeSingleLogic, setUpdateTrigger]
    );

    const downloadStoredLogic = useCallback((logic: StoredLogic) => {
        const dataBlob = new Blob([logic.logic], { type: 'text/plain' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${logic.variableName}_logic.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
        setError(null);
        setSuccess(null);
    };

    const sortedLogicsForDisplay = [...storedLogics].sort((a, b) => a.createdAt - b.createdAt);

    return (
        <Box 
            sx={{ 
                width: '100%', 
                p: { xs: 2, md: 4 }, 
                mx: 'auto',
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                minHeight: '100vh',
            }}
        >
            {/* Header */}
            <Box mb={4}>
                <Typography 
                    variant="h4" 
                    fontWeight="700" 
                    gutterBottom
                    sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}
                >
                    Dynamic Calculation Engine
                </Typography>
                <Typography variant="body2" color="#64748b" fontWeight={500}>
                    Create, manage, and execute dynamic calculations with live data
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 3,
                    border: '1px solid rgba(102, 126, 234, 0.2)',
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                }}
            >
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.95rem',
                            color: '#64748b',
                            '&.Mui-selected': {
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            },
                        },
                        '& .MuiTabs-indicator': {
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            height: 3,
                        },
                    }}
                >
                    <Tab icon={<CodeIcon />} label="Create Calculation" iconPosition="start" />
                    <Tab icon={<StorageIcon />} label={`Stored Logics (${storedLogics.length})`} iconPosition="start" />
                    <Tab icon={<VisibilityIcon />} label="View Data" iconPosition="start" />
                </Tabs>
            </Paper>

            {/* Global Alerts */}
            {error && (
                <Alert 
                    severity="error" 
                    onClose={() => setError(null)} 
                    sx={{ 
                        mb: 2, 
                        mt: 2,
                        borderRadius: 2,
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        background: 'linear-gradient(135deg, rgba(254, 226, 226, 0.5) 0%, rgba(254, 202, 202, 0.5) 100%)',
                    }}
                >
                    {error}
                </Alert>
            )}
            {success && (
                <Alert 
                    severity="success" 
                    onClose={() => setSuccess(null)} 
                    sx={{ 
                        mb: 2, 
                        mt: 2,
                        borderRadius: 2,
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        background: 'linear-gradient(135deg, rgba(209, 250, 229, 0.5) 0%, rgba(167, 243, 208, 0.5) 100%)',
                    }}
                >
                    {success}
                </Alert>
            )}

            {/* Tab 1: Create Calculation */}
            <TabPanel value={tabValue} index={0}>
                <Paper 
                    elevation={0} 
                    sx={{ 
                        p: 4, 
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                    }}
                >
                    <Box
                        sx={{
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'space-between'
                        }}
                        >
                        <Typography 
                            variant="h6" 
                            fontWeight="700" 
                            gutterBottom
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Create or Update Calculation
                        </Typography>

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
                            Generate Calculations with AI
                        </Button>
                    </Box>

                    {/* Scope Accordion */}
                    <Accordion
                        expanded={isScopeExpanded}
                        onChange={() => setIsScopeExpanded(!isScopeExpanded)}
                        sx={{ 
                            mt: 3, 
                            mb: 3, 
                            boxShadow: 'none', 
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            borderRadius: '8px !important',
                            '&:before': { display: 'none' },
                        }}
                    >
                        <AccordionSummary 
                            expandIcon={<ExpandMoreIcon sx={{ color: '#667eea' }} />}
                            sx={{
                                '&:hover': {
                                    bgcolor: 'rgba(102, 126, 234, 0.05)',
                                },
                            }}
                        >
                            <Typography 
                                variant="subtitle2" 
                                fontWeight="700"
                                sx={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                📚 Available Variables in Logic (Scope)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ pt: 2 }}>
                            <Stack spacing={2}>
                                {/* Variables (Calculated) */}
                                <Box>
                                    <Typography variant="caption" fontWeight={600} color="#06b6d4" sx={{ display: 'block', mb: 0.5 }}>
                                        📊 Variables (Calculated):
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {variableNames.size > 0 ? Array.from(variableNames).map((name) => (
                                            <VariableChipWithTooltip
                                                key={name}
                                                name={name}
                                                type="variable"
                                                bgColor="rgba(6, 182, 212, 0.12)"
                                                textColor="#06b6d4"
                                                borderColor="rgba(6, 182, 212, 0.25)"
                                            />
                                        )) : (
                                            <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                                No calculated variables yet
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Parameters (Static) */}
                                <Box>
                                    <Typography variant="caption" fontWeight={600} color="#f59e0b" sx={{ display: 'block', mb: 0.5 }}>
                                        ⚙️ Parameters (Static):
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {parameterNames.length > 0 ? Array.from(parameterNames).map((name) => (
                                            <VariableChipWithTooltip
                                                key={name as string}
                                                name={name as string}
                                                type="parameter"
                                                bgColor="rgba(245, 158, 11, 0.12)"
                                                textColor="#f59e0b"
                                                borderColor="rgba(245, 158, 11, 0.25)"
                                            />
                                        )) : (
                                            <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                                No parameters defined
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Filters (Interactive) */}
                                <Box>
                                    <Typography variant="caption" fontWeight={600} color="#ec4899" sx={{ display: 'block', mb: 0.5 }}>
                                        🔽 Filters (Interactive):
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                        {filterNames.length > 0 ? Array.from(filterNames).map((name) => (
                                            <VariableChipWithTooltip
                                                key={name}
                                                name={name}
                                                type="filter"
                                                bgColor="rgba(236, 72, 153, 0.12)"
                                                textColor="#ec4899"
                                                borderColor="rgba(236, 72, 153, 0.25)"
                                            />
                                        )) : (
                                            <Typography variant="caption" color="#94a3b8" fontStyle="italic">
                                                No filters defined
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>

                                {/* Hint */}
                                <Typography variant="caption" color="#64748b" sx={{ pt: 1, borderTop: '1px solid rgba(102, 126, 234, 0.1)' }}>
                                    💡 Hover to see value, click to copy. Use these variables in your calculation logic.
                                </Typography>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>

                    {/* Form Fields */}
                    <Stack spacing={3}>

                        <CalculationEditor
                            label="Calculation Logic"
                            value={calculationLogic}
                            onChange={setCalculationLogic}
                            height={280}
                            helperText="Type @ to autocomplete variables, parameters, and filters. Use Ctrl+Space for suggestions."
                        />

                          <TextField
                            label="Variable Name"
                            fullWidth
                            value={variableName}
                            onChange={(e) => setVariableName(e.target.value)}
                            placeholder="e.g., processedData"
                            helperText={
                                variableName && storedLogics.some((logic) => logic.variableName === variableName)
                                    ? `⚠️ Variable "${variableName}" exists. This will update it.`
                                    : 'Enter a unique name for your variable'
                            }
                            sx={{
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
                        />

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                            <Button
                                variant="contained"
                                fullWidth
                                size="large"
                                onClick={executeCalculation}
                                disabled={isLoading}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <PlayArrowIcon />}
                                sx={{ 
                                    borderRadius: 2, 
                                    textTransform: 'none', 
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                                    },
                                    '&.Mui-disabled': {
                                        background: '#e2e8f0',
                                    },
                                }}
                            >
                                {isLoading
                                    ? 'Executing...'
                                    : variableName && storedLogics.some((logic) => logic.variableName === variableName)
                                    ? `Update "${variableName}"`
                                    : 'Execute & Store'}
                            </Button>

                            {storedLogics.length > 0 && (
                                <Button
                                    variant="outlined"
                                    fullWidth
                                    size="large"
                                    onClick={manualRecalculateAll}
                                    disabled={isLoading}
                                    startIcon={<RefreshIcon />}
                                    sx={{ 
                                        borderRadius: 2, 
                                        textTransform: 'none', 
                                        fontWeight: 700,
                                        borderColor: '#667eea',
                                        color: '#667eea',
                                        '&:hover': {
                                            borderColor: '#5568d3',
                                            bgcolor: 'rgba(102, 126, 234, 0.05)',
                                        },
                                    }}
                                >
                                    Recalculate All ({storedLogics.length})
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Paper>
            </TabPanel>

            {/* Tab 2: Stored Logics */}
            <TabPanel value={tabValue} index={1}>
                <Paper 
                    elevation={0} 
                    sx={{ 
                        p: 4, 
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(102, 126, 234, 0.2)',
                        boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                    }}
                >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Box>
                            <Typography 
                                variant="h6" 
                                fontWeight="700"
                                sx={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Stored Logics ({storedLogics.length})
                            </Typography>
                            <Typography variant="body2" color="#64748b" fontWeight={500}>
                                Auto-recalculate when filters change
                            </Typography>
                        </Box>
                        {storedLogics.length > 0 && (
                            <Button
                                variant="contained"
                                onClick={manualRecalculateAll}
                                disabled={isLoading}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                                sx={{ 
                                    borderRadius: 2, 
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                                    },
                                }}
                            >
                                Recalculate All
                            </Button>
                        )}
                    </Box>

                    {storedLogics.length === 0 ? (
                        <Box textAlign="center" py={10}>
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
                                <StorageIcon sx={{ fontSize: 48, color: '#667eea', opacity: 0.6 }} />
                            </Box>
                            <Typography variant="h6" color="#475569" gutterBottom fontWeight={700}>
                                No Stored Logics Yet
                            </Typography>
                            <Typography variant="body2" color="#94a3b8" mb={3}>
                                Create your first calculation in the "Create Calculation" tab
                            </Typography>
                            <Button 
                                variant="contained" 
                                onClick={() => setTabValue(0)} 
                                sx={{ 
                                    borderRadius: 2,
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    '&:hover': {
                                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                                    },
                                }}
                            >
                                Create Calculation
                            </Button>
                        </Box>
                    ) : (
                        <>
                            <Box sx={{ maxHeight: '65vh', overflowY: 'auto', pr: 1 }}>
                                {sortedLogicsForDisplay.map((logic) => (
                                    <StoredLogicItem
                                        key={logic.id}
                                        logic={logic}
                                        onEdit={editStoredLogic}
                                        onDelete={deleteStoredLogic}
                                        onExecute={executeStoredLogic}
                                        onDownload={downloadStoredLogic}
                                    />
                                ))}
                            </Box>
                            <Alert 
                                severity="info" 
                                icon={<InfoIcon />} 
                                sx={{ 
                                    mt: 3,
                                    borderRadius: 2,
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                }}
                            >
                                Logics execute in creation order. Later variables can reference earlier ones.
                            </Alert>
                        </>
                    )}
                </Paper>
            </TabPanel>

            {/* Tab 3: View Data - Only Variables and Filters */}
            <TabPanel value={tabValue} index={2}>
                <Grid container spacing={3}>
                    {/* Variables Column */}
                    <Grid size={{xs:12,md:6}}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                p: 3, 
                                borderRadius: 3, 
                                height: '100%',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(102, 126, 234, 0.2)',
                                boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                            }}
                        >
                            <Typography 
                                variant="h6" 
                                fontWeight="700" 
                                gutterBottom
                                sx={{
                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Variables ({variableNames.size})
                            </Typography>
                            <Typography variant="body2" color="#64748b" mb={3} fontWeight={500}>
                                Calculated values from your logics
                            </Typography>
                            <Box sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1 }}>
                                {variableNames.size === 0 ? (
                                    <Box textAlign="center" py={8}>
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
                                            <CodeIcon sx={{ fontSize: 32, color: '#667eea', opacity: 0.6 }} />
                                        </Box>
                                        <Typography variant="body2" color="#94a3b8" fontWeight={500}>
                                            No variables yet. Create calculations to see them here!
                                        </Typography>
                                    </Box>
                                ) : (
                                    Array.from(variableNames).map((name) => <VariableDisplay key={name} name={name} />)
                                )}
                            </Box>
                        </Paper>
                    </Grid>

                    {/* Filters Column */}
                    <Grid size={{xs:12,md:6}}>
                        <Paper 
                            elevation={0} 
                            sx={{ 
                                p: 3, 
                                borderRadius: 3, 
                                height: '100%',
                                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(79, 172, 254, 0.2)',
                                boxShadow: '0 8px 32px rgba(79, 172, 254, 0.1)',
                            }}
                        >
                            <Typography 
                                variant="h6" 
                                fontWeight="700" 
                                gutterBottom
                                sx={{
                                    background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                                    backgroundClip: 'text',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            >
                                Active Filters ({filterNames.length})
                            </Typography>
                            <Typography variant="body2" color="#64748b" mb={3} fontWeight={500}>
                                Current filter selections
                            </Typography>
                            <Box sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1 }}>
                                {filterNames.length === 0 ? (
                                    <Box textAlign="center" py={8}>
                                        <Box
                                            sx={{
                                                width: 64,
                                                height: 64,
                                                margin: '0 auto 16px',
                                                borderRadius: '50%',
                                                background: 'linear-gradient(135deg, rgba(79, 172, 254, 0.1) 0%, rgba(0, 242, 254, 0.1) 100%)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            <FilterListIcon sx={{ fontSize: 32, color: '#4facfe', opacity: 0.6 }} />
                                        </Box>
                                        <Typography variant="body2" color="#94a3b8" fontWeight={500}>
                                            No filters configured
                                        </Typography>
                                    </Box>
                                ) : (
                                    Array.from(filterNames).map((name) => <FilterDisplay key={name} name={name} />)
                                )}
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>
            </TabPanel>
        </Box>
    );
}