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

// Helper to safely parse stored strings into arrays/objects/values
const safeParse = (value: string): any => {
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

// Variable Display Component
function VariableDisplay({ name }: { name: string }) {
    const theme = useTheme();
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
                color: 'primary' as const,
            };
        }
        if (type === 'object') return { label: 'Object', color: 'secondary' as const };
        if (type === 'number') return { label: 'Number', color: 'success' as const };
        if (type === 'string') return { label: 'String', color: 'info' as const };
        return { label: type, color: 'default' as const };
    };

    const typeInfo = getTypeInfo();

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: theme.shadows[4],
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="600" color="primary.dark">
                        {name}
                    </Typography>
                    <Chip label={typeInfo.label} size="small" color={typeInfo.color} />
                </Box>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        bgcolor: alpha(theme.palette.grey[50], 0.5),
                        borderRadius: 1.5,
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
                                color: 'text.secondary',
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
    const theme = useTheme();
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
                color: 'info' as const,
            };
        }
        return { label: type, color: 'info' as const };
    };

    const typeInfo = getTypeInfo();

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.info.light, 0.08),
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: theme.shadows[4],
                    transform: 'translateY(-2px)',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="subtitle1" fontWeight="600" color="info.dark">
                        {name}
                    </Typography>
                    <Chip label={typeInfo.label} size="small" color={typeInfo.color} variant="outlined" />
                </Box>
                <Paper
                    variant="outlined"
                    sx={{
                        p: 2,
                        bgcolor: 'white',
                        borderRadius: 1.5,
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
                            color: 'text.secondary',
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
    const theme = useTheme();

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderRadius: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    boxShadow: theme.shadows[6],
                    borderColor: 'primary.main',
                },
            }}
        >
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6" fontWeight="600" color="primary">
                        {logic.variableName}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit Logic" arrow>
                            <IconButton
                                size="small"
                                sx={{
                                    color: 'primary.main',
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) },
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
                                    color: 'success.main',
                                    '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.1) },
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
                                        color: 'info.main',
                                        '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.1) },
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
                                    color: 'error.main',
                                    '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.1) },
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
                        bgcolor: alpha(theme.palette.grey[50], 0.5),
                        borderRadius: 1.5,
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
                            color: 'text.secondary',
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
                    />
                    {logic.lastExecuted && (
                        <Chip
                            icon={<PlayArrowIcon fontSize="small" />}
                            label={`Last run: ${new Date(logic.lastExecuted).toLocaleString()}`}
                            size="small"
                            variant="outlined"
                            color="success"
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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

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
                                allFilters[filterConfig.variableName] = selectedOptions;

                                console.log(`✅ [Hooks] Loaded filter: ${filterConfig.variableName}`, selectedOptions);
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
                                allFilters[filterConfig.variableName] = selectedOptions;
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

                    const existingLogicIndex = storedLogics.findIndex((logic) => logic.variableName === variableName);

                    if (existingLogicIndex !== -1) {
                        setStoredLogics((prev) =>
                            prev.map((logic, index) =>
                                index === existingLogicIndex
                                    ? {
                                          ...logic,
                                          logic: calculationLogic,
                                          lastExecuted: Date.now(),
                                      }
                                    : logic
                            )
                        );
                        setSuccess(`Logic for variable "${variableName}" updated successfully.`);
                    } else {
                        const newLogic: StoredLogic = {
                            id: Date.now().toString(),
                            variableName,
                            logic: calculationLogic,
                            createdAt: Date.now(),
                            lastExecuted: Date.now(),
                        };

                        setStoredLogics((prev) => [...prev, newLogic]);
                        setSuccess(`Variable "${variableName}" created and logic stored successfully.`);
                    }

                    setTimeout(() => {
                        setUpdateTrigger((prev) => prev + 1);
                    }, 100);

                    setCalculationLogic('');
                    setVariableName('');
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Failed execution');
                } finally {
                    setIsLoading(false);
                }
            },
        [
            calculationLogic,
            variableName,
            variableNames,
            parameterNames,
            filterNames,
            setVariableAtom,
            setVariableNames,
            setUpdateTrigger,
            setStoredLogics,
            storedLogics,
        ]
    );

    const editStoredLogic = useCallback((logic: StoredLogic) => {
        setCalculationLogic(logic.logic);
        setVariableName(logic.variableName);
        setTabValue(0);
        setError(null);
        setSuccess(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const deleteStoredLogic = useRecoilCallback(
        ({ reset }) =>
            (id: string) => {
                const logicToDelete = storedLogics.find((logic) => logic.id === id);

                if (logicToDelete) {
                    reset(variableAtomFamily(logicToDelete.variableName));

                    setVariableNames((prev) => {
                        const newSet = new Set(prev);
                        newSet.delete(logicToDelete.variableName);
                        return newSet;
                    });
                }

                setStoredLogics((prev) => prev.filter((logic) => logic.id !== id));

                setTimeout(() => {
                    setUpdateTrigger((prev) => prev + 1);
                }, 100);

                setSuccess(`Logic "${logicToDelete?.variableName}" deleted successfully.`);
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
        <Box sx={{ width: '100%', p: { xs: 2, md: 4 }, mx: 'auto' }}>
            {/* Header */}
            <Box mb={4}>
                <Typography variant="h4" fontWeight="700" gutterBottom color="primary">
                    Dynamic Calculation Engine
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Create, manage, and execute dynamic calculations with live data
                </Typography>
            </Box>

            {/* Tabs */}
            <Paper
                elevation={0}
                sx={{
                    borderRadius: 2,
                    border: `1px solid ${theme.palette.divider}`
                }}
            >
                <Tabs
                    value={tabValue}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.95rem',
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
                <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}
            {success && (
                <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            {/* Tab 1: Create Calculation */}
            <TabPanel value={tabValue} index={0}>
                <Paper elevation={1} sx={{ p: 4, borderRadius: 2,boxShadow: 3 }}>
                    <Typography variant="h6" fontWeight="600" gutterBottom>
                        Create or Update Calculation
                    </Typography>

                    {/* Scope Accordion */}
                    <Accordion
                        expanded={isScopeExpanded}
                        onChange={() => setIsScopeExpanded(!isScopeExpanded)}
                        sx={{ mt: 3, mb: 3, boxShadow: 'none', border: `1px solid ${theme.palette.divider}` }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="subtitle2" fontWeight="600" color="primary">
                                📚 Available Variables in Logic (Scope)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Stack spacing={2}>
                                <Box>
                                    <Typography variant="body2" fontWeight="600" color="primary.dark" gutterBottom>
                                        Variables (Calculated):
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        component="div"
                                        sx={{
                                            fontFamily: 'monospace',
                                            bgcolor: alpha(theme.palette.grey[100], 0.5),
                                            p: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {variableNames.size > 0 ? Array.from(variableNames).join(', ') : 'None'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" fontWeight="600" color="primary.dark" gutterBottom>
                                        Parameters (Static):
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        component="div"
                                        sx={{
                                            fontFamily: 'monospace',
                                            bgcolor: alpha(theme.palette.grey[100], 0.5),
                                            p: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {parameterNames.length > 0 ? Array.from(parameterNames).join(', ') : 'None'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body2" fontWeight="600" color="primary.dark" gutterBottom>
                                        Filters (Interactive):
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        component="div"
                                        sx={{
                                            fontFamily: 'monospace',
                                            bgcolor: alpha(theme.palette.grey[100], 0.5),
                                            p: 1,
                                            borderRadius: 1,
                                        }}
                                    >
                                        {filterNames.length > 0 ? Array.from(filterNames).join(', ') : 'None'}
                                    </Typography>
                                </Box>
                            </Stack>
                        </AccordionDetails>
                    </Accordion>

                    {/* Form Fields */}
                    <Stack spacing={3}>

                        <TextField
                            label="Calculation Logic"
                            fullWidth
                            multiline
                            rows={10}
                            value={calculationLogic}
                            onChange={(e) => setCalculationLogic(e.target.value)}
                            placeholder={
                                variableNames.size > 0
                                    ? `Example: ${Array.from(variableNames)[0]}.map(x => x * 2)`
                                    : 'Example: [1, 2, 3, 4, 5].map(x => x * 2)'
                            }
                            helperText="Write your JavaScript calculation logic here"
                            InputProps={{
                                sx: {
                                    fontFamily: '"Fira Code", "Courier New", monospace',
                                    fontSize: '0.9rem',
                                    borderRadius: 1.5,
                                },
                            }}
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
                            InputProps={{
                                sx: { borderRadius: 1.5 },
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
                                sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
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
                                    sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600 }}
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
                <Paper elevation={1} sx={{ p: 4, borderRadius: 2,boxShadow: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                        <Box>
                            <Typography variant="h6" fontWeight="600">
                                Stored Logics ({storedLogics.length})
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Auto-recalculate when filters change
                            </Typography>
                        </Box>
                        {storedLogics.length > 0 && (
                            <Button
                                variant="contained"
                                onClick={manualRecalculateAll}
                                disabled={isLoading}
                                startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                                sx={{ borderRadius: 1.5, textTransform: 'none' }}
                            >
                                Recalculate All
                            </Button>
                        )}
                    </Box>

                    {storedLogics.length === 0 ? (
                        <Box textAlign="center" py={10}>
                            <StorageIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                No Stored Logics Yet
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3}>
                                Create your first calculation in the "Create Calculation" tab
                            </Typography>
                            <Button variant="contained" onClick={() => setTabValue(0)} sx={{ borderRadius: 1.5 }}>
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
                            <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 3 }}>
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
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%', boxShadow: 3 }}>
                            <Typography variant="h6" fontWeight="600" gutterBottom>
                                Variables ({variableNames.size})
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3}>
                                Calculated values from your logics
                            </Typography>
                            <Box sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1 }}>
                                {variableNames.size === 0 ? (
                                    <Box textAlign="center" py={8}>
                                        <CodeIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                        <Typography variant="body2" color="text.secondary">
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
                        <Paper elevation={1} sx={{ p: 3, borderRadius: 2, height: '100%', boxShadow: 3 }}>
                            <Typography variant="h6" fontWeight="600" gutterBottom>
                                Active Filters ({filterNames.length})
                            </Typography>
                            <Typography variant="body2" color="text.secondary" mb={3}>
                                Current filter selections
                            </Typography>
                            <Box sx={{ maxHeight: '70vh', overflowY: 'auto', pr: 1 }}>
                                {filterNames.length === 0 ? (
                                    <Box textAlign="center" py={8}>
                                        <FilterListIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                        <Typography variant="body2" color="text.secondary">
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

