import React, { useState, useCallback, useEffect } from 'react';
import {
    useRecoilState,
    useRecoilValue,
    useSetRecoilState,
    useRecoilCallback
} from 'recoil';
import { variableNamesState, variableUpdateTriggerState } from '../recoil/Variabletracker';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { topNState } from '../recoil/topN';
import { storedLogicsState, StoredLogic } from '../recoil/StoredLogic';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { filterConfigFamily } from '../recoil/FiltersFamily';
import { filterNamesState } from '../recoil/FiltersFamily';
import { parameterNamesState } from '../recoil/ParameterTracker';
import { truncate } from 'lodash';

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

// Tooltip component
const Tooltip = ({ children, content }: { children: React.ReactNode; content: string }) => {
    const [isVisible, setIsVisible] = useState(false);
    return (
        <div
            className="relative inline-block w-full"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            tabIndex={0}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div className="absolute top-full left-0 z-20 mt-2 w-fit min-w-[300px] max-w-[90vw] max-h-[400px] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-gray-200 bg-white text-gray-900 text-xs shadow-xl font-mono p-4">
                    {content}
                </div>
            )}
        </div>
    );
};

// Variable display component
function VariableDisplay({ name }: { name: string }) {
    const rawValue = useRecoilValue(variableAtomFamily(name));
    const parsedValue = safeParse(rawValue);
    const displayString = typeof parsedValue === 'object'
        ? JSON.stringify(parsedValue, null, 2)
        : String(parsedValue);
    const truncatedDisplay = truncateText(displayString, 120);
    const needsTooltip = displayString.length > 120;

    const getType = () => {
        if (Array.isArray(parsedValue)) return 'array';
        if (parsedValue === null) return 'null';
        return typeof parsedValue;
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-800">{name}</h3>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {getType()}
                </span>
            </div>
            <div className="bg-white p-3 rounded border">
                {needsTooltip ? (
                    <Tooltip content={truncateText(displayString, 1000)}>
                        <pre className="text-sm text-gray-700 whitespace-pre-wrap cursor-help" style={{
                                borderBottom: '1px dotted #3b82f6',
                                paddingBottom: '2px',
                                margin: 0
                            }}>
                            {truncatedDisplay}
                        </pre>
                    </Tooltip>
                ) : (
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap" style={{ margin: 0 }}>
                        {truncatedDisplay}
                    </pre>
                )}
            </div>
        </div>
    );
}

// Stored Logic Item component
function StoredLogicItem({ logic, onDelete, onExecute, onDownload }: { 
    logic: StoredLogic; 
    onDelete: (id: string) => void;
    onExecute: (logic: StoredLogic) => Promise<void>;
    onDownload?: (logic: StoredLogic) => void;
}) {
    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-800">{logic.variableName}</h4>
                <div className="flex gap-2">
                    <button
                        onClick={() => onExecute(logic)}
                        className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                    >
                        Execute
                    </button>
                    {onDownload && (
                        <button
                            onClick={() => onDownload(logic)}
                            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                        >
                            Download
                        </button>
                    )}
                    <button
                        onClick={() => onDelete(logic.id)}
                        className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                    >
                        Delete
                    </button>
                </div>
            </div>
            <div className="bg-gray-50 p-2 rounded border text-xs">
                <pre className="font-mono text-gray-700 whitespace-pre-wrap">
                    {truncateText(logic.logic, 200)}
                </pre>
            </div>
            <div className="text-xs text-gray-500 mt-2">
                Created: {new Date(logic.createdAt).toLocaleString()}
                {logic.lastExecuted && (
                    <span className="ml-2">
                        Last executed: {new Date(logic.lastExecuted).toLocaleString()}
                    </span>
                )}
            </div>
        </div>
    );
}

// Parameter display component
function ParameterDisplay({ name }: { name: string }) {
    const rawValue = useRecoilValue(parameterAtomFamily(name));
    const parsedValue = safeParse(rawValue);
    const displayString = typeof parsedValue === 'object'
        ? JSON.stringify(parsedValue, null, 2)
        : String(parsedValue);

    const getType = () => {
        if (Array.isArray(parsedValue)) return 'array';
        if (parsedValue === null) return 'null';
        return typeof parsedValue;
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4 bg-yellow-50">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-800">{name}</h3>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                    {getType()}
                </span>
            </div>
            <div className="bg-white p-3 rounded border">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap" style={{ margin: 0 }}>
                    {displayString}
                </pre>
            </div>
        </div>
    );
}

export default function Hooks() {
    const [variableNames, setVariableNames] = useRecoilState(variableNamesState);
    const setUpdateTrigger = useSetRecoilState(variableUpdateTriggerState);
    const topNValue = useRecoilValue(topNState);
    
    // Use Recoil state for stored logics instead of local state
    const [storedLogics, setStoredLogics] = useRecoilState(storedLogicsState);
    
    const [calculationLogic, setCalculationLogic] = useState('');
    const [variableName, setVariableName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    
    // NEW STATE FOR COLLAPSIBLE LIST
    const [isScopeListExpanded, setIsScopeListExpanded] = useState(false);

    // Recoil hooks for parameters and filters
    const parameterNames = useRecoilValue(parameterNamesState);
    const filterNames = useRecoilValue(filterNamesState);

    // Setter for the variable atom
    const setVariableAtom = useRecoilCallback(({ set }) => (varName: string, value: string) => {
        set(variableAtomFamily(varName), value);
    }, []);

    // Initialize filter default values into parameters on mount
    const initializeFilterDefaults = useRecoilCallback(({ snapshot, set }) => async () => {
        try {
            for (const filterId of filterNames) {
                const filterConfig = await snapshot.getPromise(filterConfigFamily(filterId));
                
                if (filterConfig?.defaultValues && filterConfig.defaultValues.length > 0) {
                    const paramName = filterConfig.variableName;
                    
                    if (paramName) {
                        let defaultValue;
                        
                        if (filterConfig.selectionType === 'single') {
                            // For single selection, use the first primitive value
                            const firstDefault = filterConfig.defaultValues[0];
                            // Extracting the primitive value regardless of the source format
                            defaultValue = firstDefault?.value ?? firstDefault;

                        } else {
                            // For multi selection, extract all primitive values
                            defaultValue = filterConfig.defaultValues.map((item: any) => item.value ?? item);
                        }
                        
                        // Set the parameter atom with the default value (Source of Truth for live filter selection)
                        set(parameterAtomFamily(paramName), JSON.stringify(defaultValue));
                    }
                }
            }
        } catch (err) {
            console.error('Error initializing filter defaults:', err);
        }
    }, [filterNames]);

    // Run initialization on mount
    useEffect(() => {
        initializeFilterDefaults();
    }, [initializeFilterDefaults]);

    // Function to get all variable and parameter values for sending to backend
    const getAllValuesForBackend = useRecoilCallback(({ snapshot }) => () => {
        const allVariables: Record<string, any> = {};
        const allParameters: Record<string, any> = {}; // Holds ONLY explicit Parameters
        const allFilters: Record<string, any> = {};    // Holds ONLY interactive Filter/Hook selections
        
        // Get all variables
        variableNames.forEach(varName => {
            try {
                const rawValue = snapshot.getLoadable(variableAtomFamily(varName)).contents;
                const parsedValue = safeParse(rawValue);
                if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                    allVariables[varName] = parsedValue;
                }
            } catch (err) {
                console.warn(`Failed to load variable ${varName}:`, err);
            }
        });

        const filterNamesSet = new Set(filterNames);
        
        // 1. Get filter values (interactive selections)
        filterNames.forEach(filterId => {
            try {
                // The actual live value is stored in parameterAtomFamily under the filter ID (variableName)
                const rawValue = snapshot.getLoadable(parameterAtomFamily(filterId)).contents;
                const parsedValue = safeParse(rawValue);
                
                if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                    allFilters[filterId] = parsedValue;
                }
            } catch (err) {
                console.warn(`Failed to load filter value for ${filterId}:`, err);
            }
        });

        // 2. Get explicit parameter values, excluding any names claimed by filters
        parameterNames.forEach(paramName => {
            // Skip names that belong to the interactive filter set
            if (filterNamesSet.has(paramName)) return; 

            try {
                const rawValue = snapshot.getLoadable(parameterAtomFamily(paramName)).contents;
                const parsedValue = safeParse(rawValue);
                if (parsedValue !== '' && parsedValue !== undefined && parsedValue !== null) {
                    allParameters[paramName] = parsedValue;
                }
            } catch (err) {
                console.warn(`Failed to load explicit parameter ${paramName}:`, err);
            }
        });
        
        // Always include topN in the available variables
        allVariables['topN'] = topNValue;
        
        // Return them separately to be included in the API payload
        return { variables: allVariables, parameters: allParameters, filters: allFilters };
    }, [variableNames, parameterNames, filterNames, topNValue]);

    // Function to execute a single logic using useRecoilCallback
    const executeSingleLogic = useRecoilCallback(({ set }) => async (logic: StoredLogic) => {
        try {
            const { variables, parameters, filters } = getAllValuesForBackend();
            const response = await fetch('http://localhost:3002/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logic: logic.logic,
                    existingVariables: variables,
                    existingParameters: parameters, // Explicit Parameters (e.g., param1: 5)
                    existingFilters: filters,      // Explicit Filters (e.g., hook_t1: [30])
                    variableName: logic.variableName
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const result = await response.json();
            const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

            // Update the variable atom using the logic's variable name
            set(variableAtomFamily(logic.variableName), JSON.stringify(calculatedValue));

            // Update variable names set
            setVariableNames(prev => {
                const newSet = new Set(prev);
                newSet.add(logic.variableName);
                return newSet;
            });

            // Update last executed time in stored logics
            setStoredLogics(prev => prev.map(l => 
                l.id === logic.id ? { ...l, lastExecuted: Date.now() } : l
            ));

            return { success: true, result: calculatedValue };
        } catch (err) {
            console.error(`Failed to execute logic for ${logic.variableName}:`, err);
            return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
        }
    }, [getAllValuesForBackend, setVariableNames, setStoredLogics]);

    // Manual recalculate all function (for button click)
    const manualRecalculateAll = useCallback(async () => {
        if (storedLogics.length === 0) return;
        
        setIsLoading(true);
        try {
            const results = [];
            for (const logic of storedLogics) {
                const result = await executeSingleLogic(logic);
                results.push({ logic: logic.variableName, ...result });
            }

            setTimeout(() => {
                setUpdateTrigger(prev => prev + 1);
            }, 100);

            console.log('Manual recalculation completed:', results);
        } finally {
            setIsLoading(false);
        }
    }, [storedLogics, executeSingleLogic, setUpdateTrigger]);

    // Function to execute and store new calculation
    const executeCalculation = useCallback(async () => {
        if (!calculationLogic.trim() || !variableName.trim()) {
            setError('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { variables, parameters, filters } = getAllValuesForBackend();
            const response = await fetch('http://localhost:3002/api/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logic: calculationLogic,
                    existingVariables: variables,
                    existingParameters: parameters, // Explicit Parameters
                    existingFilters: filters,      // Explicit Filters
                    variableName
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error ${response.status}`);
            }

            const result = await response.json();
            const calculatedValue = typeof result.value === 'string' ? safeParse(result.value) : result.value;

            // Save in Recoil using the callback
            setVariableAtom(variableName, JSON.stringify(calculatedValue));

            // Update variable names set
            setVariableNames(prev => {
                const newSet = new Set(prev);
                newSet.add(variableName);
                return newSet;
            });

            // Check if logic with same variable name already exists
            const existingLogicIndex = storedLogics.findIndex(logic => logic.variableName === variableName);
            
            if (existingLogicIndex !== -1) {
                // Update existing logic instead of creating new one
                setStoredLogics(prev => prev.map((logic, index) => 
                    index === existingLogicIndex 
                    ? {
                        ...logic,
                        logic: calculationLogic,
                        lastExecuted: Date.now()
                      }
                    : logic
                ));
                setSuccess(`Logic for variable "${variableName}" updated successfully.`);
            } else {
                // Create new logic
                const newLogic: StoredLogic = {
                    id: Date.now().toString(),
                    variableName,
                    logic: calculationLogic,
                    createdAt: Date.now(),
                    lastExecuted: Date.now()
                };

                setStoredLogics(prev => [...prev, newLogic]);
                setSuccess(`Variable "${variableName}" created and logic stored successfully.`);
            }

            setTimeout(() => {
                setUpdateTrigger(prev => prev + 1);
            }, 100);

            // Reset form
            setCalculationLogic('');
            setVariableName('');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed execution');
        } finally {
            setIsLoading(false);
        }
    }, [
        calculationLogic,
        variableName,
        setVariableAtom,
        setVariableNames,
        setUpdateTrigger,
        getAllValuesForBackend,
        setStoredLogics,
        storedLogics
    ]);

    // Delete stored logic
    const deleteStoredLogic = useRecoilCallback(({ reset }) => (id: string) => {
        // Find the logic to get the variable name before deletion
        const logicToDelete = storedLogics.find(logic => logic.id === id);
        
        if (logicToDelete) {
            // Remove the variable from persistent storage
            reset(variableAtomFamily(logicToDelete.variableName));
            
            // Remove from variable names set
            setVariableNames(prev => {
                const newSet = new Set(prev);
                newSet.delete(logicToDelete.variableName);
                return newSet;
            });
        }
        
        // Remove from stored logics
        setStoredLogics(prev => prev.filter(logic => logic.id !== id));
        
        // Trigger update
        setTimeout(() => {
            setUpdateTrigger(prev => prev + 1);
        }, 100);
    }, [storedLogics, setVariableNames, setStoredLogics, setUpdateTrigger]);

    // Execute single stored logic
    const executeStoredLogic = useCallback(async (logic: StoredLogic) => {
        setIsLoading(true);
        try {
            const result = await executeSingleLogic(logic);
            if (result.success) {
                setSuccess(`Logic for "${logic.variableName}" executed successfully.`);
                setTimeout(() => {
                    setUpdateTrigger(prev => prev + 1);
                }, 100);
            } else {
                setError(result.error || 'Execution failed');
            }
        } finally {
            setIsLoading(false);
        }
    }, [executeSingleLogic, setUpdateTrigger]);

    // Download stored logic function
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

    const handleInputChange =
        (setter: React.Dispatch<React.SetStateAction<string>>) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
            setter(e.target.value);
            if (error) setError(null);
            if (success) setSuccess(null);
        };

    return (
        <div className="p-6 w-full">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Dynamic Calculation Engine</h1>
            
            {/* TopN Display */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2">
                    <span className="text-green-700 text-sm font-medium">Current TopN Value:</span>
                    <span className="text-green-800 font-bold">{topNValue}</span>
                    <span className="text-green-600 text-xs">
                        (Calculations now run automatically when topN changes - no need to visit this page!)
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Create Calculation</h2>
                    
                    {/* Available Variables Display */}
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-sm font-medium text-blue-800">
                                Available Variables in Logic (Scope):
                            </div>
                            <button
                                onClick={() => setIsScopeListExpanded(prev => !prev)}
                                className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 transition-all"
                            >
                                {isScopeListExpanded ? 'Hide Details' : 'Show Details'}
                                <span className={`text-sm transform transition-transform ${isScopeListExpanded ? 'rotate-180' : 'rotate-0'}`}>▼</span> 
                            </button>
                        </div>
                        
                        {isScopeListExpanded && (
                            <ul className="text-xs text-gray-700 space-y-1 ml-3 list-disc list-inside mt-2">
                                <li>
                                    <span className="font-semibold text-blue-900">Variables (Output):</span> 
                                    <span className="font-mono text-gray-800">
                                        topN, {variableNames.size > 0 ? Array.from(variableNames).join(', ') : 'None'}
                                    </span>
                                </li>
                                <li>
                                    <span className="font-semibold text-blue-900">Parameters (Explicit):</span> 
                                    <span className="font-mono text-gray-800">
                                        {parameterNames.length > 0 ? Array.from(parameterNames).join(', ') : 'None'}
                                    </span>
                                </li>
                                <li>
                                    <span className="font-semibold text-blue-900">Filters/Hooks (Interactive):</span> 
                                    <span className="font-mono text-gray-800">
                                        {filterNames.length > 0 ? Array.from(filterNames).join(', ') : 'None'}
                                    </span>
                                </li>
                            </ul>
                        )}
                        {!isScopeListExpanded && (
                            <div className="text-xs text-gray-500 italic mt-2">
                                Click 'Show Details' to view {1 + variableNames.size + parameterNames.length + filterNames.length} names available in the scope.
                            </div>
                        )}
                        
                        <Tooltip 
                            content={`All inputs are passed to the backend's /api/calculate endpoint under distinct keys:\n\n1. existingVariables: Custom calculated variables (Variables tab).\n2. existingParameters: Explicitly defined user parameters (Parameters tab).\n3. existingFilters: Interactive selections from the Filter/Hook panel (e.g., 'hook_t2').`}
                        >
                            <div className="text-xs text-blue-500 mt-3 cursor-help hover:text-blue-700 font-semibold inline-block">
                                Use these variable names directly in your calculation logic.
                                <span className="ml-1 underline">View backend injection details.</span>
                            </div>
                        </Tooltip>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Calculation Logic
                            </label>
                            <textarea
                                value={calculationLogic}
                                onChange={handleInputChange(setCalculationLogic)}
                                placeholder={variableNames.size > 0 
                                    ? `Example: ${Array.from(variableNames)[0]}.slice(0, topN).map(x => x * 2)` 
                                    : "Example: [1,2,3,4,5,6,7,8,9,10].slice(0, topN).map(x => x * 2)"}
                                className="w-full p-3 border border-gray-300 rounded-md font-mono text-sm"
                                rows={6}
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Variable Name</label>
                            <input
                                type="text"
                                value={variableName}
                                onChange={handleInputChange(setVariableName)}
                                placeholder="e.g., processedData"
                                className="w-full p-3 border border-gray-300 rounded-md"
                                list="variable-suggestions"
                            />
                            <datalist id="variable-suggestions">
                                {Array.from(variableNames).map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                            {variableName && storedLogics.some(logic => logic.variableName === variableName) && (
                                <div className="text-xs text-orange-600 mt-1">
                                    ⚠️ Variable "{variableName}" already exists. Creating this will update the existing logic.
                                </div>
                            )}
                        </div>

                        {error && <div className="bg-red-50 border text-red-700 px-4 py-3 rounded-md">{error}</div>}
                        {success && <div className="bg-green-50 border text-green-700 px-4 py-3 rounded-md">{success}</div>}

                        <button
                            onClick={executeCalculation}
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isLoading 
                                ? 'Calculating...' 
                                : (variableName && storedLogics.some(logic => logic.variableName === variableName))
                                    ? `Update Logic for "${variableName}"`
                                    : 'Execute & Store Calculation'
                            }
                        </button>

                        {/* Manual Recalculate All Button */}
                        {storedLogics.length > 0 && (
                            <button
                                onClick={manualRecalculateAll}
                                disabled={isLoading}
                                className="w-full bg-orange-600 text-white py-2 px-4 rounded-md hover:bg-orange-700 disabled:opacity-50"
                            >
                                {isLoading ? 'Recalculating...' : `Manual Recalculate All (${storedLogics.length}) with topN=${topNValue}`}
                            </button>
                        )}
                    </div>
                </div>

                {/* Stored Logics Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">
                        Stored Logics ({storedLogics.length})
                    </h2>
                    <div className="text-xs text-gray-500 mb-4">
                        These logics auto-recalculate globally when topN changes to {topNValue}
                    </div>
                    {storedLogics.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 italic">
                            No stored logics yet. Create calculations to see them here.
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[470px] overflow-y-auto">
                            {storedLogics.map(logic => (
                                <StoredLogicItem 
                                    key={logic.id} 
                                    logic={logic} 
                                    onDelete={deleteStoredLogic}
                                    onExecute={executeStoredLogic}
                                    onDownload={downloadStoredLogic}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* All Variables & Parameters Section */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">
                        All Variables & Parameters
                    </h2>
                    <div className="text-xs text-gray-500 mb-4">
                        Variables from all sources (auto-updated globally)
                    </div>
                    <div className="space-y-3 max-h-[480px] overflow-y-auto">
                        {/* Display topN as a special variable */}
                        <div className="border border-gray-200 rounded-lg p-4 bg-green-50">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-medium text-gray-800">topN</h3>
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                    number
                                </span>
                            </div>
                            <div className="bg-white p-3 rounded border">
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap" style={{ margin: 0 }}>
                                    {topNValue}
                                </pre>
                            </div>
                            <div className="text-xs text-green-600 mt-1">
                                Controlled by Filter Panel (Global)
                            </div>
                        </div>

                        {/* Display custom variables */}
                        {variableNames.size === 0 ? (
                            <div className="text-center py-4 text-gray-500 italic">
                                No custom variables yet. Create some calculations first!
                            </div>
                        ) : (
                            Array.from(variableNames).map(name => (
                                <VariableDisplay key={name} name={name} />
                            ))
                        )}

                        {/* Display User Parameters (Explicit) */}
                        {parameterNames.length > 0 && (
                            <>
                                <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 border-b border-gray-200 pb-1">User Parameters ({parameterNames.length})</h3>
                                {Array.from(parameterNames).map(name => (
                                    <ParameterDisplay key={name} name={name} />
                                ))}
                            </>
                        )}
                        
                        {/* Display Filter/Hook Selections (Interactive) */}
                        {filterNames.length > 0 && (
                            <>
                                <h3 className="text-lg font-semibold mt-4 mb-2 text-gray-700 border-b border-gray-200 pb-1">Filter/Hook Selections ({filterNames.length})</h3>
                                {Array.from(filterNames).map(name => (
                                    // These filter IDs are used as Parameter names in the backend
                                    <ParameterDisplay key={name} name={name} /> 
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}