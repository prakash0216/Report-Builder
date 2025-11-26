import React, { useEffect, useState } from 'react';
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
    InputLabel,
    CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useRecoilState, useRecoilValue, useSetRecoilState, useRecoilCallback } from 'recoil';
import { filterConfigFamily, filterNamesState, allFiltersSelector, FilterConfig } from '../recoil/FiltersFamily';
import { arrayParameterNamesSelector, arrayOfArrayParameterNamesSelector, arrayOfObjectsParameterNamesSelector } from '../recoil/ParameterTracker';
import { parameterAtomFamily } from '../recoil/ParameterFamliy';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { hooksArraySelector,hooksArrayOfArraySelector,hooksArrayOfObjectsSelector } from '../recoil/Variabletracker';
import axios from 'axios';

// Utility function to format dates to yyyy-mm-dd
// Only formats actual dates, not numbers that happen to be small
const formatDateToYYYYMMDD = (value: any): string => {
  if (!value && value !== 0) return String(value);
  
  // If it's already a string in yyyy-mm-dd format, return as is
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value;
  }
  
  // For numbers, only treat as timestamp if it's a reasonable date (after 1970-01-01 and before 2100)
  // Small numbers like 10, 20, 30 are NOT timestamps
  if (typeof value === 'number') {
    // Only treat as timestamp if it's a reasonable date timestamp (milliseconds since epoch)
    // Timestamps for dates are typically > 0 and < 4102444800000 (year 2100)
    // Small numbers like 10, 20, 30 are just numbers, not timestamps
    if (value > 0 && value < 4102444800000 && value > 86400000) { // At least 1 day in milliseconds
      const date = new Date(value);
      if (!isNaN(date.getTime()) && date.getFullYear() >= 1970 && date.getFullYear() <= 2100) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    // Not a valid timestamp, return as number string
    return String(value);
  }
  
  // Try to parse as Date for strings
  let date: Date | null = null;
  
  if (value instanceof Date) {
    date = value;
  } else if (typeof value === 'string') {
    // Try parsing the string as a date
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1970 && parsed.getFullYear() <= 2100) {
      date = parsed;
    }
  }
  
  if (date && !isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // If not a date, return as string
  return String(value);
};

type Category = 'params' | 'filters' | 'hooks';

interface DefaultValueOption {
    label: string;
    value: string | number;
}

interface SavedFilterConfig {
    id: string;
    category: string;
    paramName: string;
    displayName: string;
    variableName: string;
    selectionType: 'single' | 'multi';
    defaultValues: DefaultValueOption[];
    availableOptions: DefaultValueOption[];
    dsName?: string;
    labelIndex?: number;
    valueIndex?: number;
    labelKey?: string;
    valueKey?: string;
}

const CascadingDropdown: React.FC = () => {
    
    // ==================== LOCAL UI STATE ====================
    const [editingId, setEditingId] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string>('');
    const [expandedFilters, setExpandedFilters] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState<string>('');
    
    // ==================== CATEGORY & TYPE SELECTION ====================
    const [mainCategory, setMainCategory] = useState<string>('');
    const [paramType, setParamType] = useState<string>('');
    
    // ==================== PARAMETER/FILTER SELECTION ====================
    const [selectedParamName, setSelectedParamName] = useState<string>('');
    const [selectedFilterColumn, setSelectedFilterColumn] = useState<string>('');
    const [selectedHookName, setSelectedHookName] = useState<string>('');
    
    // ==================== FILTER-SPECIFIC STATE ====================
    const [selectedDataSource, setSelectedDataSource] = useState<string>('');
    const [availableDataSources, setAvailableDataSources] = useState<string[]>([]);
    const [availableFilterColumns, setAvailableFilterColumns] = useState<string[]>([]);
    const [availableFilterColumnValues, setAvailableFilterColumnValues] = useState<string[]>([]);

    // ==================== HOOK-SPECIFIC STATE ====================
    const [hookType,sethookType]=useState<string>('');
    
    // ==================== CONFIGURATION STATE ====================
    const [displayName, setDisplayName] = useState<string>('');
    const [variableName, setVariableName] = useState<string>('');
    const [selectionType, setSelectionType] = useState<'single' | 'multi'>('single');
    const [defaultSingleValue, setDefaultSingleValue] = useState<string | number>('');
    const [defaultMultiValues, setDefaultMultiValues] = useState<(string | number)[]>([]);

    // ==================== LOADING STATES ====================
    const [isLoadingDataSources, setIsLoadingDataSources] = useState<boolean>(false);
    const [isLoadingFilterColumns, setIsLoadingFilterColumns] = useState<boolean>(false);
    const [isLoadingColumnValues, setIsLoadingColumnValues] = useState<boolean>(false);

    // ==================== RECOIL STATE ====================
    const allFilters = useRecoilValue(allFiltersSelector);
    const [filterNames, setFilterNames] = useRecoilState(filterNamesState);
    
    const arrayParameters = useRecoilValue(arrayParameterNamesSelector);
    const arrayOfArrayParameters = useRecoilValue(arrayOfArrayParameterNamesSelector);
    const arrayOfObjectParameters = useRecoilValue(arrayOfObjectsParameterNamesSelector);

    const hooksArrayVariables=useRecoilValue(hooksArraySelector);
    const hooksArrayOfArrayVariables=useRecoilValue(hooksArrayOfArraySelector);
    const hooksArrayOfObjectVariables=useRecoilValue(hooksArrayOfObjectsSelector);

    // ==================== PARAMS CATEGORY: COMPLEX TYPE MAPPINGS ====================
    const [arrayOfArrayLabelIndex, setArrayOfArrayLabelIndex] = useState<number | ''>('');
    const [arrayOfArrayValueIndex, setArrayOfArrayValueIndex] = useState<number | ''>('');
    const [arrayOfObjectLabelKey, setArrayOfObjectLabelKey] = useState<string>('');
    const [arrayOfObjectValueKey, setArrayOfObjectValueKey] = useState<string>('');

    // ==================== Hooks CATEGORY: COMPLEX TYPE MAPPINGS ====================
    const [hooksArrayOfArrayLabelIndex, setHooksArrayOfArrayLabelIndex] = useState<number | ''>('');
    const [hooksArrayOfArrayValueIndex, setHooksArrayOfArrayValueIndex] = useState<number | ''>('');
    const [hooksArrayOfObjectLabelKey, setHooksArrayOfObjectLabelKey] = useState<string>('');
    const [hooksArrayOfObjectValueKey, setHooksArrayOfObjectValueKey] = useState<string>('');

    const paramValueToInspect = useRecoilValue(parameterAtomFamily(selectedParamName));
    const hooksValueToInspect=useRecoilValue(variableAtomFamily(selectedHookName));

    const setSpecificConfig = useSetRecoilState(filterConfigFamily(variableName));

    const clearFilterConfig = useRecoilCallback(({ set }) => (variableName: string) => {
        set(filterConfigFamily(variableName), null);
    }, []);    

    // ==================== UTILITY FUNCTIONS ====================
    const lengthOfFirstElementOfArrayOfArrayParameter = (): number => {
        const valueToCheck = mainCategory === 'hooks' ? hooksValueToInspect : paramValueToInspect;
        const typeToCheck = mainCategory === 'hooks' ? hookType : paramType;
        
        if ((typeToCheck !== 'arrayOfArray') || !valueToCheck) return 0;
        try{
            const parsedValue = JSON.parse(valueToCheck);
            if(Array.isArray(parsedValue) && parsedValue.length > 0 && Array.isArray(parsedValue[0])){
                return parsedValue[0].length;
            }
        }catch(err){
            console.error("Error parsing Array of Array value:", err);
        }
        return 0;
    };
    
    const getObjectKeysForArrayOfObjects = (): string[] => {
        const valueToCheck = mainCategory === 'hooks' ? hooksValueToInspect : paramValueToInspect;
        const typeToCheck = mainCategory === 'hooks' ? hookType : paramType;
        
        if(typeToCheck !== 'arrayOfObjects' || !valueToCheck) return [];
        try{
            const parsedValue = JSON.parse(valueToCheck);
            if(Array.isArray(parsedValue) && parsedValue.length > 0 && typeof parsedValue[0] === 'object' && parsedValue[0] !== null){
                return Object.keys(parsedValue[0]);
            }
        }catch(err){
            console.error("Error parsing Array of Objects value:", err);
        }
        return [];
    };

    const lengthOfFirstElementOfArrayOfArray = lengthOfFirstElementOfArrayOfArrayParameter();
    const arrayOfObjectKeys = getObjectKeysForArrayOfObjects();
    
    // ==================== RESET FUNCTIONS ====================
    const resetComplexTypeMappings = () => {
        setArrayOfArrayLabelIndex('');
        setArrayOfArrayValueIndex('');
        setArrayOfObjectLabelKey('');
        setArrayOfObjectValueKey('');
        setHooksArrayOfArrayLabelIndex('');
        setHooksArrayOfArrayValueIndex('');
        setHooksArrayOfObjectLabelKey('');
        setHooksArrayOfObjectValueKey('');
    };

    const resetConfigurationFields = () => {
        setDisplayName('');
        setVariableName('');
        setSelectionType('single');
        setDefaultSingleValue('');
        setDefaultMultiValues([]);
        resetComplexTypeMappings();
    };

    const resetAllSelections = () => {
        setMainCategory('');
        setParamType('');
        sethookType('');
        setSelectedParamName('');
        setSelectedFilterColumn('');
        setSelectedHookName('');
        setSelectedDataSource('');
        setAvailableFilterColumns([]);
        setAvailableFilterColumnValues([]);
        resetConfigurationFields();
        setEditingId(null);
    };

    // ==================== API FUNCTIONS ====================
    const fetchDataSources = async () => {
        setIsLoadingDataSources(true);
        try {
            const response = await axios.get("http://localhost:3002/get-all-ds-names");
            if (response && response.data.data_source_names) {
                setAvailableDataSources(response.data.data_source_names);
            }
        } catch (error) {
            console.error("Error fetching data source names:", error);
            setAvailableDataSources(['Customer_DB', 'Sales_Data', 'HR_Records']); 
        } finally {
            setIsLoadingDataSources(false);
        }
    };

    const fetchFilterColumns = async (dsName: string) => {
        if (!dsName) return;
        
        setIsLoadingFilterColumns(true);
        setAvailableFilterColumns([]);
        
        try {
            const response = await axios.post("http://localhost:3002/get-ds-column-names", { ds_name: dsName });
            if (response && response.data.column_names) {
                setAvailableFilterColumns(response.data.column_names);
            }
        } catch (err) {
            console.error("Error fetching column names for DS:", err);
            if (dsName === 'Customer_DB') {
                setAvailableFilterColumns(['region_id', 'segment', 'is_active']);
            } else if (dsName === 'Sales_Data') {
                setAvailableFilterColumns(['product_type', 'sales_rep_id']);
            } else {
                setAvailableFilterColumns([]);
            }
        } finally {
            setIsLoadingFilterColumns(false);
        }
    };

    const fetchFilterColumnValues = async (dsName: string, columnName: string) => {
        if (!dsName || !columnName) return;
        
        setIsLoadingColumnValues(true);
        setAvailableFilterColumnValues([]);
        
        try {
            const response = await axios.post("http://localhost:3002/get-distinct-column-values", {
                ds_name: dsName,
                column_name: columnName
            });
            if (response && response.data.distinct_column_values) {
                setAvailableFilterColumnValues(response.data.distinct_column_values);
            }
        } catch (err) {
            console.error("Error fetching distinct column values:", err);
            if (columnName === 'region_id') {
                setAvailableFilterColumnValues(['North', 'South', 'East', 'West']);
            } else if (columnName === 'product_type') {
                setAvailableFilterColumnValues(['Widget', 'Gadget', 'Thingamajig']);
            } else {
                setAvailableFilterColumnValues(['true', 'false', 'N/A']);
            }
        } finally {
            setIsLoadingColumnValues(false);
        }
    };

    // ==================== EFFECT HOOKS ====================
    useEffect(() => {
        fetchDataSources();
    }, []);

    useEffect(() => {
        resetComplexTypeMappings();
    }, [selectedParamName, paramType]);

    useEffect(() => {
        resetComplexTypeMappings();
    }, [selectedHookName, hookType]);

    useEffect(() => {
        if (mainCategory === 'data-source' && selectedDataSource) {
            setAvailableFilterColumns([]);
            const timeoutId = setTimeout(() => {
                fetchFilterColumns(selectedDataSource);
            }, 200);
            
            return () => clearTimeout(timeoutId);
        } else {
            setAvailableFilterColumns([]);
        }
    }, [selectedDataSource, mainCategory]);

    useEffect(() => {
        if (mainCategory === 'data-source' && selectedDataSource && selectedFilterColumn) {
            setAvailableFilterColumnValues([]);
            const timeoutId = setTimeout(() => {
                fetchFilterColumnValues(selectedDataSource, selectedFilterColumn);
            }, 300);
            
            return () => clearTimeout(timeoutId);
        } else {
            setAvailableFilterColumnValues([]);
        }
    }, [selectedDataSource, selectedFilterColumn, mainCategory]);

    // ==================== HANDLERS ====================
    const handleMainCategoryChange = (event: SelectChangeEvent<string>) => {
        const newCategory = event.target.value;
        setMainCategory(newCategory);
        setParamType('');
        sethookType(''); 
        setSelectedParamName('');
        setSelectedFilterColumn('');
        setSelectedHookName('');
        setSelectedDataSource('');
        setAvailableFilterColumns([]);
        setAvailableFilterColumnValues([]);
        resetConfigurationFields();
    };

    const handleParamTypeChange = (event: SelectChangeEvent<string>) => {
        setParamType(event.target.value);
        setSelectedParamName('');
        resetConfigurationFields();
    };

    const handleHookTypeChange = (event: SelectChangeEvent<string>) => {
        sethookType(event.target.value);
        setSelectedHookName('');
        resetConfigurationFields();
    };

    const handleDataSourceChange = (event: SelectChangeEvent<string>) => {
        const newDs = event.target.value;
        setSelectedDataSource(newDs);
        setSelectedFilterColumn('');
        setAvailableFilterColumns([]);
        setAvailableFilterColumnValues([]);
        resetConfigurationFields();
        setVariableName(prev => prev.startsWith('ds_') ? `ds_${newDs}_filter_` : '');
        setDisplayName('');
    };

    const handleParamNameChange = (event: SelectChangeEvent<string>) => {
        const param = event.target.value;
        setSelectedParamName(param);
        
        const newVariableName = `param_${param}`;
        setVariableName(newVariableName);
        setDisplayName(
            param.charAt(0).toUpperCase() +
            param.slice(1).replace(/([A-Z])/g, ' $1').trim()
        );
        
        setDefaultSingleValue('');
        setDefaultMultiValues([]);
    };

    const handleFilterColumnChange = (event: SelectChangeEvent<string>) => {
        const column = event.target.value;
        setSelectedFilterColumn(column);
        
        const newVariableName = `data_source_${selectedDataSource}_${column}`;
        setVariableName(newVariableName);
        setDisplayName(column.charAt(0).toUpperCase() + column.slice(1).replace(/_/g, ' '));
        
        setDefaultSingleValue('');
        setDefaultMultiValues([]);
    };

    const handleHookNameChange = (event: SelectChangeEvent<string>) => {
        const hook = event.target.value;
        setSelectedHookName(hook);
        
        const newVariableName = `hook_${hook}`;
        setVariableName(newVariableName);
        setDisplayName(
            hook.charAt(0).toUpperCase() +
            hook.slice(1).replace(/([A-Z])/g, ' $1').trim()
        );
        
        setDefaultSingleValue('');
        setDefaultMultiValues([]);
    };
    
    // ==================== COMPLEX TYPE MAPPING HANDLERS ====================
    const handleArrayOfArrayLabelChange = (event: SelectChangeEvent<number>) => {
        setArrayOfArrayLabelIndex(Number(event.target.value));
    };

    const handleArrayOfArrayValueChange = (event: SelectChangeEvent<number>) => {
        setArrayOfArrayValueIndex(Number(event.target.value));
    };

    const handleArrayOfObjectLabelChange = (event: SelectChangeEvent<string>) => {
        setArrayOfObjectLabelKey(event.target.value);
    };

    const handleArrayOfObjectValueChange = (event: SelectChangeEvent<string>) => {
        setArrayOfObjectValueKey(event.target.value);
    };

    const handleHooksArrayOfArrayLabelChange = (event: SelectChangeEvent<number>) => {
        setHooksArrayOfArrayLabelIndex(Number(event.target.value));
    };

    const handleHooksArrayOfArrayValueChange = (event: SelectChangeEvent<number>) => {
        setHooksArrayOfArrayValueIndex(Number(event.target.value));
    };

    const handleHooksArrayOfObjectLabelChange = (event: SelectChangeEvent<string>) => {
        setHooksArrayOfObjectLabelKey(event.target.value);
    };

    const handleHooksArrayOfObjectValueChange = (event: SelectChangeEvent<string>) => {
        setHooksArrayOfObjectValueKey(event.target.value);
    };

    const handleMultiSelectChange = (value: string | number) => {
        setDefaultMultiValues((prev) =>
            prev.includes(value)
                ? prev.filter((v) => v !== value)
                : [...prev, value]
        );
    };

    // ==================== GET AVAILABLE VALUES ====================
    const getAvailableValues = (): DefaultValueOption[] => {
        if (mainCategory === 'data-source' && selectedFilterColumn) {
            if (availableFilterColumnValues.length > 0) {
                return availableFilterColumnValues.map(item => {
                    const formattedLabel = formatDateToYYYYMMDD(item);
                    return { 
                        label: formattedLabel, 
                        value: item 
                    };
                });
            }
            return [];
        } 
        
        else if (mainCategory === 'hooks') {
            if (!hooksValueToInspect || !selectedHookName) {
                return [];
            }
            try{
                const parsedOptions = JSON.parse(hooksValueToInspect);
                if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
                    return [];
                }
                
                if (hookType === 'array') {
                    return parsedOptions.map((item: string | number) => ({
                        label: String(item), // Don't format numbers as dates - just show the value
                        value: item,
                    }));

                } else if (hookType === 'arrayOfArray') {
                    if (hooksArrayOfArrayLabelIndex !== '' && hooksArrayOfArrayValueIndex !== '') {
                        return parsedOptions.map((item: any[]) => {
                            const labelValue = item[hooksArrayOfArrayLabelIndex as number];
                            const valueValue = item[hooksArrayOfArrayValueIndex as number];
                            // Show the value index value in dropdown (what user sees), store label index in label field, and value index in value field
                            return {
                                label: String(valueValue !== undefined && valueValue !== null ? valueValue : 'N/A'),
                                value: valueValue,
                            };
                        });
                    }
                } else if (hookType === 'arrayOfObjects') {
                    if (hooksArrayOfObjectLabelKey && hooksArrayOfObjectValueKey) {
                        return parsedOptions.map((item: Record<string, any>) => {
                            const labelValue = item[hooksArrayOfObjectLabelKey];
                            const valueValue = item[hooksArrayOfObjectValueKey];
                            // Show the value key value (e.g., age) in dropdown (what user sees), store label key in label field, and value key in value field
                            return {
                                label: String(valueValue !== undefined && valueValue !== null ? valueValue : 'N/A'),
                                value: valueValue,
                            };
                        });
                    }
                }
            }catch(e){
                console.error(`Failed to parse available options string for hooks ${hookType}:`, e);
            }
        }

        if (!paramValueToInspect || !selectedParamName || mainCategory !== 'params') {
            return [];
        }

        try {
            const parsedOptions = JSON.parse(paramValueToInspect);
            if (!Array.isArray(parsedOptions) || parsedOptions.length === 0) {
                return [];
            }
            
            if (paramType === 'array') {
                return parsedOptions.map((item: string | number) => ({
                    label: String(item), // Don't format numbers as dates - just show the value
                    value: item,
                }));

            } else if (paramType === 'arrayOfArray') {
                if (arrayOfArrayLabelIndex !== '' && arrayOfArrayValueIndex !== '') {
                    return parsedOptions.map((item: any[]) => {
                        const labelValue = item[arrayOfArrayLabelIndex as number];
                        const valueValue = item[arrayOfArrayValueIndex as number];
                        // Show the value index value in dropdown (what user sees), store label index in label field, and value index in value field
                        return {
                            label: String(valueValue !== undefined && valueValue !== null ? valueValue : 'N/A'),
                            value: valueValue,
                        };
                    });
                }
            } else if (paramType === 'arrayOfObjects') {
                if (arrayOfObjectLabelKey && arrayOfObjectValueKey) {
                    return parsedOptions.map((item: Record<string, any>) => {
                        const labelValue = item[arrayOfObjectLabelKey];
                        const valueValue = item[arrayOfObjectValueKey];
                        // Show the value key value (e.g., age) in dropdown (what user sees), store label key in label field, and value key in value field
                        return {
                            label: String(valueValue !== undefined && valueValue !== null ? valueValue : 'N/A'),
                            value: valueValue,
                        };
                    });
                }
            }

        } catch (e) {
            console.error(`Failed to parse available options string for ${paramType}:`, e);
        }
        
        return [];
    };

    const showSuccess = (message: string) => {
        setSuccessMessage(message);
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const showError = (message: string) => {
        setSuccessMessage(`Error: ${message}`);
        setTimeout(() => setSuccessMessage(''), 5000);
    };

    // ==================== SAVE CONFIGURATION ====================
    const handleSaveConfiguration = async () => {
        const availableOptions = getAvailableValues(); 
        
        let actualSelectedName = '';
        if (mainCategory === 'params') {
            actualSelectedName = selectedParamName;
        } else if (mainCategory === 'data-source') {
            actualSelectedName = selectedFilterColumn;
        } else if (mainCategory === 'hooks') {
            actualSelectedName = selectedHookName;
        }

        const selectedPrimitiveValues = selectionType === 'single'
            ? (defaultSingleValue ? [defaultSingleValue] : [])
            : defaultMultiValues;
        
        // Helper function to get label index/key value for array of arrays/objects
        const getLabelValueForSavedOption = (selectedValue: any): string => {
            try {
                if (mainCategory === 'params' && paramType === 'arrayOfArray' && arrayOfArrayLabelIndex !== '' && arrayOfArrayValueIndex !== '') {
                    const parsedOptions = JSON.parse(paramValueToInspect || '[]');
                    const foundItem = parsedOptions.find((item: any[]) => item[arrayOfArrayValueIndex as number] === selectedValue);
                    if (foundItem) {
                        const labelValue = foundItem[arrayOfArrayLabelIndex as number];
                        return String(labelValue !== undefined && labelValue !== null ? labelValue : 'N/A');
                    }
                } else if (mainCategory === 'params' && paramType === 'arrayOfObjects' && arrayOfObjectLabelKey && arrayOfObjectValueKey) {
                    const parsedOptions = JSON.parse(paramValueToInspect || '[]');
                    const foundItem = parsedOptions.find((item: Record<string, any>) => item[arrayOfObjectValueKey] === selectedValue);
                    if (foundItem) {
                        const labelValue = foundItem[arrayOfObjectLabelKey];
                        return String(labelValue !== undefined && labelValue !== null ? labelValue : 'N/A');
                    }
                } else if (mainCategory === 'hooks' && hookType === 'arrayOfArray' && hooksArrayOfArrayLabelIndex !== '' && hooksArrayOfArrayValueIndex !== '') {
                    const parsedOptions = JSON.parse(hooksValueToInspect || '[]');
                    const foundItem = parsedOptions.find((item: any[]) => item[hooksArrayOfArrayValueIndex as number] === selectedValue);
                    if (foundItem) {
                        const labelValue = foundItem[hooksArrayOfArrayLabelIndex as number];
                        return String(labelValue !== undefined && labelValue !== null ? labelValue : 'N/A');
                    }
                } else if (mainCategory === 'hooks' && hookType === 'arrayOfObjects' && hooksArrayOfObjectLabelKey && hooksArrayOfObjectValueKey) {
                    const parsedOptions = JSON.parse(hooksValueToInspect || '[]');
                    const foundItem = parsedOptions.find((item: Record<string, any>) => item[hooksArrayOfObjectValueKey] === selectedValue);
                    if (foundItem) {
                        const labelValue = foundItem[hooksArrayOfObjectLabelKey];
                        return String(labelValue !== undefined && labelValue !== null ? labelValue : 'N/A');
                    }
                }
            } catch (e) {
                console.error('Error getting label value for saved option:', e);
            }
            // Fallback: use the value as label if we can't find the label index/key value
            return String(selectedValue);
        };
        
        const defaultValues: DefaultValueOption[] = selectedPrimitiveValues
            .map(selectedValue => {
                const foundOption = availableOptions.find(opt => opt.value === selectedValue);
                if (foundOption) {
                    // For array of arrays/objects, replace label with label index/key value
                    const labelValue = getLabelValueForSavedOption(selectedValue);
                    return {
                        label: labelValue,
                        value: selectedValue,
                    };
                }
                return { label: selectedValue.toString(), value: selectedValue };
            }); 

        const configId = variableName;
        const newConfig: FilterConfig = {
            id: configId,
            category: mainCategory,
            paramName: actualSelectedName,
            displayName,
            variableName: configId,
            selectionType,
            defaultValues,
            availableOptions,
            dsName: mainCategory === 'data-source' ? selectedDataSource : undefined,
            ...(paramType === 'arrayOfArray' && {
                labelIndex: arrayOfArrayLabelIndex as number,
                valueIndex: arrayOfArrayValueIndex as number,
            }),
            ...(paramType === 'arrayOfObjects' && {
                labelKey: arrayOfObjectLabelKey,
                valueKey: arrayOfObjectValueKey,
            }),
            ...(hookType === 'arrayOfArray' && {
                labelIndex: hooksArrayOfArrayLabelIndex as number,
                valueIndex: hooksArrayOfArrayValueIndex as number,
            }),
            ...(hookType === 'arrayOfObjects' && {
                labelKey: hooksArrayOfObjectLabelKey,
                valueKey: hooksArrayOfObjectValueKey,
            }),
        };

        try {
            const filterData = {
                variableName: newConfig.variableName,
                category: newConfig.category,
                paramName: newConfig.paramName,
                displayName: newConfig.displayName,
                selectionType: newConfig.selectionType,
                dsName: newConfig.dsName,
                labelIndex: newConfig.labelIndex,
                valueIndex: newConfig.valueIndex,
                labelKey: newConfig.labelKey,
                valueKey: newConfig.valuekey,
                availableOptions: newConfig.availableOptions,
                defaultValues: newConfig.defaultValues,
            };

            if (editingId) {
                // Update existing filter by variable name
                await axios.put(`http://localhost:3002/api/filters/${configId}`, filterData);
            } else {
                // Create new filter
                await axios.post('http://localhost:3002/api/filters', filterData);
                if (!filterNames.includes(configId)) {
                    setFilterNames(prev => [...prev, configId]);
                }
            }

            // Update local state
            setSpecificConfig(newConfig);
            
            // Reload filters from database to ensure consistency
            const reloadResponse = await axios.get('http://localhost:3002/api/filters');
            if (reloadResponse.data.success && reloadResponse.data.filters) {
                const reloadedFilterNames = reloadResponse.data.filters.map((f: any) => f.variable_name);
                setFilterNames(reloadedFilterNames);
            }

            showSuccess(editingId ? 'Filter updated successfully!' : 'Filter created successfully!');
            resetAllSelections();
        } catch (error: any) {
            console.error('Failed to save filter:', error);
            showError(error.response?.data?.error || 'Failed to save filter');
        }
    };

    const handleEditFilter = (config: SavedFilterConfig) => { 
        setEditingId(config.variableName);
        setMainCategory(config.category);
        setSelectedDataSource(config.dsName || '');
    
        let resolvedParamType = '';
        if (config.category === 'params') {
            resolvedParamType = 
                (config.labelKey || config.valueKey) ? 'arrayOfObjects' :
                (config.labelIndex !== undefined || config.valueIndex !== undefined) ? 'arrayOfArray' :
                'array';
            setParamType(resolvedParamType);
            setSelectedParamName(config.paramName);
            
            setArrayOfArrayLabelIndex(config.labelIndex !== undefined ? config.labelIndex : '');
            setArrayOfArrayValueIndex(config.valueIndex !== undefined ? config.valueIndex : '');
            setArrayOfObjectLabelKey(config.labelKey || '');
            setArrayOfObjectValueKey(config.valueKey || '');
        } else if (config.category === 'data-source') {
            setSelectedFilterColumn(config.paramName);
        } else if (config.category === 'hooks') {
            const resolvedHookType = 
                (config.labelKey || config.valueKey) ? 'arrayOfObjects' :
                (config.labelIndex !== undefined || config.valueIndex !== undefined) ? 'arrayOfArray' :
                'array';
            sethookType(resolvedHookType);
            setSelectedHookName(config.paramName);
            
            setHooksArrayOfArrayLabelIndex(config.labelIndex !== undefined ? config.labelIndex : '');
            setHooksArrayOfArrayValueIndex(config.valueIndex !== undefined ? config.valueIndex : '');
            setHooksArrayOfObjectLabelKey(config.labelKey || '');
            setHooksArrayOfObjectValueKey(config.valueKey || '');
        }
        
        setDisplayName(config.displayName);
        setVariableName(config.variableName);
        setSelectionType(config.selectionType);
    
        const defaultPrimitiveValues = config.defaultValues.map((item: DefaultValueOption) => item.value);
    
        if (config.selectionType === 'single') {
            setDefaultSingleValue(defaultPrimitiveValues[0] || '');
            setDefaultMultiValues([]);
        } else {
            setDefaultMultiValues(defaultPrimitiveValues);
            setDefaultSingleValue('');
        }
    
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteFilter = async (variableName: string) => {
        try {
            // Delete from database
            await axios.delete(`http://localhost:3002/api/filters/${variableName}`);
            
            // Update local state
            setFilterNames(prev => prev.filter(name => name !== variableName));
            clearFilterConfig(variableName);
            
            // Reload filters from database to ensure consistency
            const reloadResponse = await axios.get('http://localhost:3002/api/filters');
            if (reloadResponse.data.success && reloadResponse.data.filters) {
                const reloadedFilterNames = reloadResponse.data.filters.map((f: any) => f.variable_name);
                setFilterNames(reloadedFilterNames);
            }
            
            showSuccess('Filter deleted successfully!');
        } catch (error: any) {
            console.error('Failed to delete filter:', error);
            showError(error.response?.data?.error || 'Failed to delete filter');
        }
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
        resetAllSelections();
    };
    
    // ==================== VALIDATION ====================
    const isConfigValid = (): boolean => {
        const filterIds = Object.keys(allFilters);
        const isDuplicate = !editingId && filterIds.includes(variableName);
        
        if (!mainCategory || !displayName.trim() || !variableName.trim() || isDuplicate) {
            return false;
        }
    
        if (mainCategory === 'params' && !selectedParamName) return false;
        if (mainCategory === 'data-source' && (!selectedDataSource || !selectedFilterColumn)) return false;
        if (mainCategory === 'hooks' && !selectedHookName) return false;
    
        if (mainCategory === 'params') {
            if (!paramType) return false;
            
            let isComplexMappingValid = true;
            if (paramType === 'arrayOfArray') {
                isComplexMappingValid = arrayOfArrayLabelIndex !== '' && arrayOfArrayValueIndex !== '';
            } else if (paramType === 'arrayOfObjects') {
                isComplexMappingValid = !!arrayOfObjectLabelKey && !!arrayOfObjectValueKey;
            }
            
            if (!isComplexMappingValid) return false;
        }
    
        if (mainCategory === 'hooks') {
            if (!hookType) return false;
            
            let isComplexMappingValid = true;
            if (hookType === 'arrayOfArray') {
                isComplexMappingValid = hooksArrayOfArrayLabelIndex !== '' && hooksArrayOfArrayValueIndex !== '';
            } else if (hookType === 'arrayOfObjects') {
                isComplexMappingValid = !!hooksArrayOfObjectLabelKey && !!hooksArrayOfObjectValueKey;
            }
            
            if (!isComplexMappingValid) return false;
        }
    
        const availableOptions = getAvailableValues();
        const needsOptions = mainCategory === 'params' || mainCategory === 'data-source' || mainCategory === 'hooks';
        
        if (needsOptions && availableOptions.length === 0) {
            return false;
        }
    
        const isDefaultValueSelected = selectionType === 'single' 
            ? defaultSingleValue !== ''
            : defaultMultiValues.length > 0;
        
        if (needsOptions && !isDefaultValueSelected) {
            return false;
        }
        
        return true;
    };

    const getCategoryColor = (category: string) => {
        return category === 'params' ? '#667eea' :
               category === 'data-source' ? '#f093fb' :
               category === 'hooks' ? '#4facfe' : '#94a3b8';
    };

    const savedConfigs = Object.values(allFilters);

    const filteredConfigs = savedConfigs.filter(config =>
        config.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.paramName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        config.variableName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ==================== HELPER COMPONENTS ====================
    const ComplexMappingDropdowns = () => {
        const inProp = mainCategory === 'params' && !!selectedParamName && (paramType === 'arrayOfArray' || paramType === 'arrayOfObjects');
        
        if (paramType === 'arrayOfArray') {
            const indexOptions = Array.from({ length: lengthOfFirstElementOfArrayOfArray }, (_, i) => i);
            
            return (
                <Collapse in={inProp}>
                    <Box
                        sx={{
                            p: 2.5,
                            background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                            borderRadius: 2,
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                        }}
                    >
                        <Typography 
                            variant="body2" 
                            fontWeight={700} 
                            mb={2}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Array Mapping Configuration
                        </Typography>
                        
                        {(arrayOfArrayLabelIndex === '' || arrayOfArrayValueIndex === '') && (
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 2,
                                    borderRadius: 2,
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                }}
                            >
                                Please select both the <strong>Label Index</strong> and the <strong>Value Index</strong> for the dropdown options to become active.
                            </Alert>
                        )}

                        <Box display="flex" gap={2}>
                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="array-of-array-label-dropdown-label">Label Index *</InputLabel>
                                <Select
                                    label="Label Index *"
                                    labelId="array-of-array-label-dropdown-label"
                                    value={arrayOfArrayLabelIndex === '' ? '' : arrayOfArrayLabelIndex}
                                    onChange={(e) => handleArrayOfArrayLabelChange(e as SelectChangeEvent<number>)}
                                    disabled={!lengthOfFirstElementOfArrayOfArray}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Label Index</MenuItem>
                                    {indexOptions.map((i) => (
                                        <MenuItem key={`label-${i}`} value={i}>
                                            Index {i} (Label)
                                        </MenuItem>
                                    ))}
                                </Select>
                                {!lengthOfFirstElementOfArrayOfArray && (
                                    <Typography variant="caption" color="error.main" mt={1}>
                                        Cannot find array length.
                                    </Typography>
                                )}
                            </FormControl>

                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="array-of-array-value-dropdown-label">Value Index *</InputLabel>
                                <Select
                                    label="Value Index *"
                                    labelId="array-of-array-value-dropdown-label"
                                    value={arrayOfArrayValueIndex === '' ? '' : arrayOfArrayValueIndex}
                                    onChange={(e) => handleArrayOfArrayValueChange(e as SelectChangeEvent<number>)}
                                    disabled={!lengthOfFirstElementOfArrayOfArray}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Value Index</MenuItem>
                                    {indexOptions.map((i) => (
                                        <MenuItem key={`value-${i}`} value={i}>
                                            Index {i} (Value)
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </Collapse>
            );
        } else if (paramType === 'arrayOfObjects') {
            const keyOptions = arrayOfObjectKeys;
            
            return (
                <Collapse in={inProp}>
                    <Box
                        sx={{
                            p: 2.5,
                            background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                            borderRadius: 2,
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                        }}
                    >
                        <Typography 
                            variant="body2" 
                            fontWeight={700} 
                            mb={2}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Array Mapping Configuration
                        </Typography>
                            
                        {(!arrayOfObjectLabelKey || !arrayOfObjectValueKey) && (
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 2,
                                    borderRadius: 2,
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                }}
                            >
                                Please select both the <strong>Label Key</strong> and the <strong>Value Key</strong> for the dropdown options to become active.
                            </Alert>
                        )}

                        <Box display="flex" gap={2}>
                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="array-of-objects-label-dropdown-label">Label Key *</InputLabel>
                                <Select
                                    label="Label Key *"
                                    labelId="array-of-objects-label-dropdown-label"
                                    value={arrayOfObjectLabelKey}
                                    onChange={handleArrayOfObjectLabelChange}
                                    disabled={keyOptions.length === 0}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Label Key</MenuItem>
                                    {keyOptions.map((key) => (
                                        <MenuItem key={`label-${key}`} value={key}>
                                            {key}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {keyOptions.length === 0 && (
                                    <Typography variant="caption" color="error.main" mt={1}>
                                        Cannot find object keys.
                                    </Typography>
                                )}
                            </FormControl>

                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="array-of-objects-value-dropdown-label">Value Key *</InputLabel>
                                <Select
                                    label="Value Key *"
                                    labelId="array-of-objects-value-dropdown-label"
                                    value={arrayOfObjectValueKey}
                                    onChange={handleArrayOfObjectValueChange}
                                    disabled={keyOptions.length === 0}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Value Key</MenuItem>
                                    {keyOptions.map((key) => (
                                        <MenuItem key={`value-${key}`} value={key}>
                                            {key}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </Collapse>
            );
        }
        return null;
    };

    const ComplexHookMappingDropdowns = () => {
        const inProp = mainCategory === 'hooks' && !!selectedHookName && (hookType === 'arrayOfArray' || hookType === 'arrayOfObjects');
        
        if (hookType === 'arrayOfArray') {
            const indexOptions = Array.from({ length: lengthOfFirstElementOfArrayOfArray }, (_, i) => i);
            
            return (
                <Collapse in={inProp}>
                    <Box
                        sx={{
                            p: 2.5,
                            background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                            borderRadius: 2,
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                        }}
                    >
                        <Typography 
                            variant="body2" 
                            fontWeight={700} 
                            mb={2}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Array Mapping Configuration
                        </Typography>
                        
                        {(hooksArrayOfArrayLabelIndex === '' || hooksArrayOfArrayValueIndex === '') && (
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 2,
                                    borderRadius: 2,
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                }}
                            >
                                Please select both the <strong>Label Index</strong> and the <strong>Value Index</strong> for the dropdown options to become active.
                            </Alert>
                        )}

                        <Box display="flex" gap={2}>
                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="hooks-array-of-array-label-dropdown-label">Label Index *</InputLabel>
                                <Select
                                    label="Label Index *"
                                    labelId="hooks-array-of-array-label-dropdown-label"
                                    value={hooksArrayOfArrayLabelIndex === '' ? '' : hooksArrayOfArrayLabelIndex}
                                    onChange={(e) => handleHooksArrayOfArrayLabelChange(e as SelectChangeEvent<number>)}
                                    disabled={!lengthOfFirstElementOfArrayOfArray}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Label Index</MenuItem>
                                    {indexOptions.map((i) => (
                                        <MenuItem key={`label-${i}`} value={i}>
                                            Index {i} (Label)
                                        </MenuItem>
                                    ))}
                                </Select>
                                {!lengthOfFirstElementOfArrayOfArray && (
                                    <Typography variant="caption" color="error.main" mt={1}>
                                        Cannot find array length.
                                    </Typography>
                                )}
                            </FormControl>

                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="hooks-array-of-array-value-dropdown-label">Value Index *</InputLabel>
                                <Select
                                    label="Value Index *"
                                    labelId="hooks-array-of-array-value-dropdown-label"
                                    value={hooksArrayOfArrayValueIndex === '' ? '' : hooksArrayOfArrayValueIndex}
                                    onChange={(e) => handleHooksArrayOfArrayValueChange(e as SelectChangeEvent<number>)}
                                    disabled={!lengthOfFirstElementOfArrayOfArray}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Value Index</MenuItem>
                                    {indexOptions.map((i) => (
                                        <MenuItem key={`value-${i}`} value={i}>
                                            Index {i} (Value)
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </Collapse>
            );
        } else if (hookType === 'arrayOfObjects') {
            const keyOptions = arrayOfObjectKeys;
            
            return (
                <Collapse in={inProp}>
                    <Box
                        sx={{
                            p: 2.5,
                            background: 'linear-gradient(135deg, rgba(224, 231, 255, 0.3) 0%, rgba(199, 210, 254, 0.3) 100%)',
                            borderRadius: 2,
                            border: '1px solid rgba(102, 126, 234, 0.3)',
                        }}
                    >
                        <Typography 
                            variant="body2" 
                            fontWeight={700} 
                            mb={2}
                            sx={{
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                backgroundClip: 'text',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}
                        >
                            Array Mapping Configuration
                        </Typography>
                            
                        {(!hooksArrayOfObjectLabelKey || !hooksArrayOfObjectValueKey) && (
                            <Alert 
                                severity="info" 
                                sx={{ 
                                    mb: 2,
                                    borderRadius: 2,
                                    border: '1px solid rgba(59, 130, 246, 0.3)',
                                    background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                }}
                            >
                                Please select both the <strong>Label Key</strong> and the <strong>Value Key</strong> for the dropdown options to become active.
                            </Alert>
                        )}

                        <Box display="flex" gap={2}>
                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="hooks-array-of-objects-label-dropdown-label">Label Key *</InputLabel>
                                <Select
                                    label="Label Key *"
                                    labelId="hooks-array-of-objects-label-dropdown-label"
                                    value={hooksArrayOfObjectLabelKey}
                                    onChange={handleHooksArrayOfObjectLabelChange}
                                    disabled={keyOptions.length === 0}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Label Key</MenuItem>
                                    {keyOptions.map((key) => (
                                        <MenuItem key={`label-${key}`} value={key}>
                                            {key}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {keyOptions.length === 0 && (
                                    <Typography variant="caption" color="error.main" mt={1}>
                                        Cannot find object keys.
                                    </Typography>
                                )}
                            </FormControl>

                            <FormControl 
                                fullWidth
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
                            >
                                <InputLabel id="hooks-array-of-objects-value-dropdown-label">Value Key *</InputLabel>
                                <Select
                                    label="Value Key *"
                                    labelId="hooks-array-of-objects-value-dropdown-label"
                                    value={hooksArrayOfObjectValueKey}
                                    onChange={handleHooksArrayOfObjectValueChange}
                                    disabled={keyOptions.length === 0}
                                    sx={{ bgcolor: 'white' }}
                                >
                                    <MenuItem value="" disabled>Select Value Key</MenuItem>
                                    {keyOptions.map((key) => (
                                        <MenuItem key={`value-${key}`} value={key}>
                                            {key}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </Collapse>
            );
        }
        return null;
    };

    const availableOptions: DefaultValueOption[] = getAvailableValues();

    // ==================== RENDER ====================
    return (
        <Container 
            maxWidth={false} 
            disableGutters 
            sx={{ 
                py: 3, 
                px: 3, 
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                minHeight: '100vh' 
            }}
        >
            <Fade in={!!successMessage}>
                <Alert 
                    severity="success" 
                    sx={{ 
                        mb: 3, 
                        display: successMessage ? 'flex' : 'none',
                        borderRadius: 2,
                        boxShadow: '0 4px 15px rgba(102, 126, 234, 0.2)',
                    }}
                    icon={<CheckCircleIcon />}
                >
                    {successMessage}
                </Alert>
            </Fade>

            <Grid container spacing={3}>
                {/* LEFT COLUMN - CREATE/EDIT FORM */}
                <Grid size={{xs:12,md:6}}>
                    <Card 
                        elevation={0}
                        sx={{ 
                            position: 'sticky', 
                            top: 16,
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            borderRadius: 3,
                            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                        }}
                    >
                        <CardContent sx={{ p: 3 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                                <Typography 
                                    variant="h5" 
                                    fontWeight={700}
                                    sx={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    {editingId ? 'Edit Filter' : 'Create New Filter'}
                                </Typography>
                                {editingId && (
                                    <Button
                                        size="small"
                                        onClick={handleCancelEdit}
                                        sx={{ 
                                            textTransform: 'none',
                                            color: '#667eea',
                                            fontWeight: 600,
                                            '&:hover': {
                                                bgcolor: 'rgba(102, 126, 234, 0.05)',
                                            }
                                        }}
                                    >
                                        Cancel Edit
                                    </Button>
                                )}
                            </Box>
                            
                            <Box display="flex" flexDirection="column" gap={3}>
                                
                                {/* 1. MAIN CATEGORY SELECTION */}
                                <FormControl fullWidth>
                                    <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                        Main Category *
                                    </FormLabel>
                                    <Select
                                        value={mainCategory}
                                        onChange={handleMainCategoryChange}
                                        displayEmpty
                                        sx={{ 
                                            bgcolor: 'white',
                                            '& .MuiOutlinedInput-notchedOutline': {
                                                borderColor: 'rgba(102, 126, 234, 0.3)',
                                            },
                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#667eea',
                                            },
                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                borderColor: '#667eea',
                                            },
                                        }}
                                    >
                                        <MenuItem value="" disabled>Select a category...</MenuItem>
                                        <MenuItem value="params">📊 Params</MenuItem>
                                        <MenuItem value="data-source">🔍 Data Source</MenuItem>
                                        <MenuItem value="hooks">⚡ Calculations</MenuItem>
                                    </Select>
                                </FormControl>

                                {/* 2A. PARAMS CATEGORY - PARAMETER TYPE */}
                                {mainCategory === 'params' && (
                                    <Collapse in={mainCategory === 'params'}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Parameter Type *
                                            </FormLabel>
                                            <Select
                                                value={paramType}
                                                onChange={handleParamTypeChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose a Parameter type...</MenuItem>
                                                <MenuItem value="array">Array</MenuItem>
                                                <MenuItem value="arrayOfArray">Array of Array</MenuItem>
                                                <MenuItem value="arrayOfObjects">Array of Objects</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Collapse>
                                )}

                                {/* Parameter selection fields for each type */}
                                {mainCategory === 'params' && paramType === 'array' && (
                                    <Collapse in={!!paramType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array Parameter *
                                            </FormLabel>
                                            <Select
                                                value={selectedParamName}
                                                onChange={handleParamNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array parameter...</MenuItem>
                                                {arrayParameters.map((param:string) => (
                                                    <MenuItem key={param} value={param}>
                                                        {param}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {arrayParameters.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array parameters available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'params' && paramType === 'arrayOfArray' && (
                                    <Collapse in={!!paramType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array of Array Param *
                                            </FormLabel>
                                            <Select
                                                value={selectedParamName}
                                                onChange={handleParamNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array of array parameter...</MenuItem>
                                                {arrayOfArrayParameters.map((param:string) => (
                                                    <MenuItem key={param} value={param}>
                                                        {param}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {arrayOfArrayParameters.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array of array parameters available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'params' && paramType === 'arrayOfObjects' && (
                                    <Collapse in={!!paramType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array of Objects Parameter *
                                            </FormLabel>
                                            <Select
                                                value={selectedParamName}
                                                onChange={handleParamNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array of objects Parameter...</MenuItem>
                                                {arrayOfObjectParameters.map((param: string) => (
                                                    <MenuItem key={param} value={param}>
                                                        {param}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {arrayOfObjectParameters.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array of objects parameters available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {/* DATA SOURCE CATEGORY */}
                                {mainCategory === 'data-source' && (
                                    <Collapse in={mainCategory === 'data-source'}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Data Source *
                                            </FormLabel>
                                            <Select
                                                value={selectedDataSource}
                                                onChange={handleDataSourceChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                                disabled={isLoadingDataSources}
                                            >
                                                <MenuItem value="" disabled>
                                                    {isLoadingDataSources ? 'Loading data sources...' : 'Choose a Data Source...'}
                                                </MenuItem>
                                                {availableDataSources.map((ds) => (
                                                    <MenuItem key={ds} value={ds}>
                                                        {ds}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {isLoadingDataSources && (
                                                <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                    <CircularProgress size={16} sx={{ color: '#667eea' }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        Loading data sources...
                                                    </Typography>
                                                </Box>
                                            )}
                                            {!isLoadingDataSources && availableDataSources.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No data sources available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'data-source' && selectedDataSource && (
                                    <Collapse in={!!selectedDataSource}>
                                        <Box>
                                            <FormControl fullWidth>
                                                <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                    Select Filter Column *
                                                </FormLabel>
                                                <Select
                                                    value={selectedFilterColumn}
                                                    onChange={handleFilterColumnChange}
                                                    displayEmpty
                                                    sx={{ 
                                                        bgcolor: 'white',
                                                        '& .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: 'rgba(102, 126, 234, 0.3)',
                                                        },
                                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#667eea',
                                                        },
                                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                            borderColor: '#667eea',
                                                        },
                                                    }}
                                                    disabled={isLoadingFilterColumns || availableFilterColumns.length === 0}
                                                >
                                                    <MenuItem value="" disabled>
                                                        {isLoadingFilterColumns ? 'Loading columns...' : 'Choose a filter column...'}
                                                    </MenuItem>
                                                    {availableFilterColumns.map((column) => (
                                                        <MenuItem key={column} value={column}>
                                                            {column}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                                {isLoadingFilterColumns && (
                                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                        <CircularProgress size={16} sx={{ color: '#667eea' }} />
                                                        <Typography variant="caption" color="text.secondary">
                                                            Loading columns...
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {!isLoadingFilterColumns && availableFilterColumns.length === 0 && (
                                                    <Typography variant="caption" color="error.main" mt={1}>
                                                        No filterable columns found for <strong>{selectedDataSource}</strong>.
                                                    </Typography>
                                                )}
                                            </FormControl>
                                            {!selectedFilterColumn && !isLoadingFilterColumns && availableFilterColumns.length > 0 && (
                                                <Alert 
                                                    severity="info" 
                                                    sx={{ 
                                                        mt: 2, 
                                                        py: 0.5, 
                                                        px: 1,
                                                        borderRadius: 2,
                                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                                        background: 'linear-gradient(135deg, rgba(224, 242, 254, 0.5) 0%, rgba(186, 230, 253, 0.5) 100%)',
                                                    }}
                                                >
                                                    <Typography variant="caption">
                                                        Select a column name to fetch its distinct values and enable the <strong>Default Value</strong> section.
                                                    </Typography>
                                                </Alert>
                                            )}
                                        </Box>
                                    </Collapse>
                                )}

                                {/* HOOKS CATEGORY */}
                                {mainCategory === 'hooks' && (
                                    <Collapse in={mainCategory === 'hooks'}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Calculation Type *
                                            </FormLabel>
                                            <Select
                                                value={hookType}
                                                onChange={handleHookTypeChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose a calculation type...</MenuItem>
                                                <MenuItem value="array">Array</MenuItem>
                                                <MenuItem value="arrayOfArray">Array of Array</MenuItem>
                                                <MenuItem value="arrayOfObjects">Array of Objects</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'hooks' && hookType === 'array' && (
                                    <Collapse in={!!hookType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array Calculation *
                                            </FormLabel>
                                            <Select
                                                value={selectedHookName}
                                                onChange={handleHookNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array calculation...</MenuItem>
                                                {hooksArrayVariables.map((hook:string) => (
                                                    <MenuItem key={hook} value={hook}>
                                                        {hook}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {hooksArrayVariables.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array calculations available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'hooks' && hookType === 'arrayOfArray' && (
                                    <Collapse in={!!hookType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array of Array Calculation *
                                            </FormLabel>
                                            <Select
                                                value={selectedHookName}
                                                onChange={handleHookNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array of array hook...</MenuItem>
                                                {hooksArrayOfArrayVariables.map((hook:string) => (
                                                    <MenuItem key={hook} value={hook}>
                                                        {hook}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {hooksArrayOfArrayVariables.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array of array calculations available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {mainCategory === 'hooks' && hookType === 'arrayOfObjects' && (
                                    <Collapse in={!!hookType}>
                                        <FormControl fullWidth>
                                            <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                Select Array of Objects Calculations *
                                            </FormLabel>
                                            <Select
                                                value={selectedHookName}
                                                onChange={handleHookNameChange}
                                                displayEmpty
                                                sx={{ 
                                                    bgcolor: 'white',
                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: 'rgba(102, 126, 234, 0.3)',
                                                    },
                                                    '&:hover .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                        borderColor: '#667eea',
                                                    },
                                                }}
                                            >
                                                <MenuItem value="" disabled>Choose an array of objects calculations...</MenuItem>
                                                {hooksArrayOfObjectVariables.map((hook: string) => (
                                                    <MenuItem key={hook} value={hook}>
                                                        {hook}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                            {hooksArrayOfObjectVariables.length === 0 && (
                                                <Typography variant="caption" color="error.main" mt={1}>
                                                    No array of objects calculations available.
                                                </Typography>
                                            )}
                                        </FormControl>
                                    </Collapse>
                                )}

                                {/* COMPLEX MAPPING DROPDOWNS */}
                                {ComplexMappingDropdowns()}
                                {ComplexHookMappingDropdowns()}

                                {/* CONFIGURATION FIELDS */}
                                {((mainCategory === 'params' && selectedParamName) || 
                                  (mainCategory === 'data-source' && selectedFilterColumn) || 
                                  (mainCategory === 'hooks' && selectedHookName && hookType)) && (
                                    <Collapse in={true}>
                                        <Box display="flex" flexDirection="column" gap={3}>
                                            <FormControl fullWidth>
                                                <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                    Display Name *
                                                </FormLabel>
                                                <TextField
                                                    value={displayName}
                                                    onChange={(e) => setDisplayName(e.target.value)}
                                                    placeholder="e.g., Top Payer"
                                                    fullWidth
                                                    sx={{ 
                                                        bgcolor: 'white',
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
                                                <Typography variant="caption" color="text.secondary" mt={0.5}>
                                                    User-facing label for this filter
                                                </Typography>
                                            </FormControl>

                                            <FormControl fullWidth>
                                                <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                    Variable Name (ID) *
                                                </FormLabel>
                                                <TextField
                                                    value={variableName}
                                                    onChange={(e) => setVariableName(e.target.value)}
                                                    fullWidth
                                                    sx={{ 
                                                        bgcolor: editingId ? 'grey.100' : 'white',
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
                                                    slotProps={{
                                                        input: {
                                                            startAdornment: (
                                                                <Typography
                                                                    component="span"
                                                                    fontWeight={700}
                                                                    sx={{
                                                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                        backgroundClip: 'text',
                                                                        WebkitBackgroundClip: 'text',
                                                                        WebkitTextFillColor: 'transparent',
                                                                        mr: 0.5
                                                                    }}
                                                                >
                                                                    $
                                                                </Typography>
                                                            ),
                                                        },
                                                    }}
                                                />
                                                <Typography 
                                                    variant="caption" 
                                                    color={
                                                        !editingId && Object.keys(allFilters).includes(variableName) && variableName
                                                            ? 'error.main'
                                                            : 'text.secondary'
                                                    } 
                                                    mt={0.5}
                                                >
                                                    {!editingId && Object.keys(allFilters).includes(variableName) && variableName
                                                        ? '⚠️ Variable name already exists!'
                                                        : `Reference in code: \${${variableName}} • Must be unique`}
                                                </Typography>
                                            </FormControl>

                                            <FormControl>
                                                <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
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
                                                        control={<Radio sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }} />}
                                                        label="Single Select"
                                                        sx={{ 
                                                            bgcolor: selectionType === 'single' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                                                            borderRadius: 2,
                                                            px: 2,
                                                            mr: 2,
                                                            border: '1px solid',
                                                            borderColor: selectionType === 'single' ? '#667eea' : 'transparent',
                                                        }}
                                                    />
                                                    <FormControlLabel
                                                        value="multi"
                                                        control={<Radio sx={{ color: '#667eea', '&.Mui-checked': { color: '#667eea' } }} />}
                                                        label="Multi Select"
                                                        sx={{ 
                                                            bgcolor: selectionType === 'multi' ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
                                                            borderRadius: 2,
                                                            px: 2,
                                                            border: '1px solid',
                                                            borderColor: selectionType === 'multi' ? '#667eea' : 'transparent',
                                                        }}
                                                    />
                                                </RadioGroup>
                                            </FormControl>

                                            <FormControl fullWidth>
                                                <FormLabel sx={{ mb: 1, fontWeight: 700, fontSize: '0.875rem', color: '#1e293b' }}>
                                                    Default Value(s) *
                                                </FormLabel>
                                                {isLoadingColumnValues ? (
                                                    <Box display="flex" alignItems="center" gap={2} p={2} bgcolor="white" borderRadius={2} border="1px solid rgba(102, 126, 234, 0.3)">
                                                        <CircularProgress size={24} sx={{ color: '#667eea' }} />
                                                        <Typography variant="body2" color="text.secondary">
                                                            Loading column values...
                                                        </Typography>
                                                    </Box>
                                                ) : availableOptions.length === 0 ? (
                                                    <Alert 
                                                        severity="warning"
                                                        sx={{
                                                            borderRadius: 2,
                                                            border: '1px solid rgba(245, 158, 11, 0.3)',
                                                            background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.3) 0%, rgba(253, 224, 71, 0.3) 100%)',
                                                        }}
                                                    >
                                                        No options available for default value selection. Select the necessary mappings/parameters first.
                                                    </Alert>
                                                ) : selectionType === 'single' ? (
                                                    <Select
                                                        value={defaultSingleValue}
                                                        onChange={(e) => setDefaultSingleValue(e.target.value)}
                                                        displayEmpty
                                                        sx={{ 
                                                            bgcolor: 'white',
                                                            '& .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: 'rgba(102, 126, 234, 0.3)',
                                                            },
                                                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: '#667eea',
                                                            },
                                                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                                                borderColor: '#667eea',
                                                            },
                                                        }}
                                                        disabled={availableOptions.length === 0}
                                                    >
                                                        <MenuItem value="" disabled>Select default value...</MenuItem>
                                                        {availableOptions.map((option, index) => (
                                                            <MenuItem key={index} value={option.value}>
                                                                {option.label}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                ) : (
                                                    <Box
        sx={{
            bgcolor: 'white',
            borderRadius: 2,
            border: '1px solid rgba(102, 126, 234, 0.3)',
            overflow: 'hidden',
        }}
    >
        {/* Select All Header */}
        <Box
            sx={{
                px: 2,
                py: 1,
                borderBottom: '1px solid rgba(102, 126, 234, 0.2)',
                bgcolor: 'rgba(102, 126, 234, 0.05)',
            }}
        >
            <FormControlLabel
                control={
                    <Checkbox
                        checked={defaultMultiValues.length === availableOptions.length && availableOptions.length > 0}
                        indeterminate={defaultMultiValues.length > 0 && defaultMultiValues.length < availableOptions.length}
                        onChange={(e) => {
                            if (e.target.checked) {
                                // Select all
                                setDefaultMultiValues(availableOptions.map(opt => opt.value));
                            } else {
                                // Deselect all
                                setDefaultMultiValues([]);
                            }
                        }}
                        sx={{ 
                            color: '#667eea', 
                            '&.Mui-checked': { color: '#667eea' },
                            '&.MuiCheckbox-indeterminate': { color: '#667eea' }
                        }}
                    />
                }
                label={
                    <Typography variant="body2" fontWeight={700} color="#667eea">
                        (All)
                    </Typography>
                }
            />
        </Box>
        
        {/* Scrollable Options */}
        <FormGroup
            sx={{
                p: 2,
                maxHeight: 200,
                overflow: 'auto',
            }}
        >
            {availableOptions.map((option, index) => (
                <FormControlLabel
                    key={index}
                    control={
                        <Checkbox
                            checked={defaultMultiValues.includes(option.value)}
                            onChange={() => handleMultiSelectChange(option.value)}
                            sx={{ 
                                color: '#667eea', 
                                '&.Mui-checked': { color: '#667eea' } 
                            }}
                        />
                    }
                    label={option.label.toString()}
                    sx={{
                        '&:hover': {
                            bgcolor: 'rgba(102, 126, 234, 0.05)',
                            borderRadius: 1,
                        }
                    }}
                />
            ))}
        </FormGroup>
    </Box>
                                                )}
                                                <Typography variant="caption" color="text.secondary" mt={0.5}>
                                                    {selectionType === 'single' 
                                                        ? 'Choose one default option' 
                                                        : `${defaultMultiValues.length} option(s) selected`}
                                                </Typography>
                                            </FormControl>

                                            <Button
                                                variant="contained"
                                                onClick={handleSaveConfiguration}
                                                disabled={!isConfigValid()}
                                                fullWidth
                                                size="large"
                                                sx={{ 
                                                    mt: 1, 
                                                    py: 1.5,
                                                    fontWeight: 700,
                                                    fontSize: '1rem',
                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    '&:hover': {
                                                        background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
                                                    },
                                                    '&.Mui-disabled': {
                                                        background: '#e2e8f0',
                                                    },
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

                {/* RIGHT COLUMN - SAVED FILTERS LIST */}
                <Grid size={{xs:12,md:6}}>
                    <Card 
                        elevation={0}
                        sx={{
                            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(102, 126, 234, 0.2)',
                            borderRadius: 3,
                            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.1)',
                        }}
                    >
                        <CardContent sx={{ p: 3 }}>
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography 
                                    variant="h5" 
                                    fontWeight={700}
                                    sx={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        backgroundClip: 'text',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                    }}
                                >
                                    Saved Filters
                                </Typography>
                                <Chip 
                                    label={filteredConfigs.length} 
                                    size="small"
                                    sx={{ 
                                        fontWeight: 700,
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                    }}
                                />
                            </Box>

                            {Object.keys(allFilters).length > 3 && (
                                <TextField
                                    placeholder="Search filters..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    fullWidth
                                    size="small"
                                    sx={{ 
                                        mb: 2, 
                                        bgcolor: 'white',
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
                            )}

                            {filteredConfigs.length === 0 ? (
                                <Box textAlign="center" py={8}>
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
                                        <Typography sx={{ fontSize: 40 }}>🔍</Typography>
                                    </Box>
                                    <Typography variant="h6" fontWeight={600} mb={1} color="#475569">
                                        {searchTerm ? 'No filters found' : 'No filters configured yet'}
                                    </Typography>
                                    <Typography variant="body2" color="#94a3b8">
                                        {searchTerm 
                                            ? 'Try a different search term' 
                                            : 'Create your first filter using the form'}
                                    </Typography>
                                </Box>
                            ) : (
                                <Box sx={{ maxHeight: '78vh', overflowY: 'auto', pr: 1 }}>
                                    <Box display="flex" flexDirection="column" gap={2}>
                                        {filteredConfigs.map((config: SavedFilterConfig) => {
                                            const categoryColor = getCategoryColor(config.category);
                                            return (
                                                <Card
                                                    key={config.variableName}
                                                    variant="outlined"
                                                    sx={{
                                                        bgcolor: 'white',
                                                        border: '2px solid',
                                                        borderColor: editingId === config.variableName ? '#667eea' : 'rgba(102, 126, 234, 0.2)',
                                                        borderRadius: 2,
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.2)',
                                                            borderColor: '#667eea',
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
                                                                <Typography variant="h6" fontWeight={700} mb={0.5} color="#1e293b">
                                                                    {config.displayName}
                                                                </Typography>
                                                                <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                                                                    <Chip
                                                                        label={config.category}
                                                                        size="small"
                                                                        sx={{ 
                                                                            fontSize: '0.75rem', 
                                                                            height: 22, 
                                                                            fontWeight: 600,
                                                                            background: `linear-gradient(135deg, ${categoryColor} 0%, ${categoryColor}dd 100%)`,
                                                                            color: 'white',
                                                                        }}
                                                                    />
                                                                   
                                                                    {config.category === 'filters' && config.dsName && (
                                                                        <Chip
                                                                            label={`DS: ${config.dsName}`}
                                                                            size="small"
                                                                            sx={{ 
                                                                                fontSize: '0.75rem', 
                                                                                height: 22,
                                                                                bgcolor: 'rgba(102, 126, 234, 0.1)',
                                                                                color: '#667eea',
                                                                                fontWeight: 600,
                                                                            }}
                                                                        />
                                                                    )}
                                                                    <Typography variant="caption" color="text.secondary" fontWeight={500}>
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
                                                                            bgcolor: 'rgba(102, 126, 234, 0.1)',
                                                                            color: '#667eea',
                                                                            '&:hover': { bgcolor: 'rgba(102, 126, 234, 0.2)' },
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
                                                                            bgcolor: 'rgba(239, 68, 68, 0.1)',
                                                                            color: '#ef4444',
                                                                            '&:hover': { bgcolor: 'rgba(239, 68, 68, 0.2)' },
                                                                        }}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => toggleFilterExpanded(config.variableName)}
                                                                    sx={{
                                                                        color: '#667eea',
                                                                    }}
                                                                >
                                                                    {expandedFilters.has(config.variableName) ? (
                                                                        <ExpandLessIcon fontSize="small" />
                                                                    ) : (
                                                                        <ExpandMoreIcon fontSize="small" />
                                                                    )}
                                                                </IconButton>
                                                            </Box>
                                                        </Box>

                                                        <Divider sx={{ my: 1.5, borderColor: 'rgba(102, 126, 234, 0.2)' }} />

                                                        <Box display="flex" flexDirection="column" gap={1}>
                                                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                                                <Box display="flex" alignItems="center" gap={1} flex={1}>
                                                                    <Typography
                                                                        variant="body2"
                                                                        fontWeight={700}
                                                                        color="#64748b"
                                                                        sx={{ minWidth: 70 }}
                                                                    >
                                                                        Variable:
                                                                    </Typography>
                                                                    <Typography
                                                                        component="code"
                                                                        variant="body2"
                                                                        sx={{
                                                                            px: 1.5,
                                                                            py: 0.5,
                                                                            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
                                                                            borderRadius: 1,
                                                                            fontFamily: 'monospace',
                                                                            fontSize: '0.8rem',
                                                                            color: '#667eea',
                                                                            fontWeight: 600,
                                                                        }}
                                                                    >
                                                                        {`\${${config.variableName}}`}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>

                                                            <Collapse in={expandedFilters.has(config.variableName)}>
                                                                <Box display="flex" flexDirection="column" gap={1} mt={1}>
                                                                    <Box display="flex" alignItems="center" gap={1}>
                                                                        <Typography
                                                                            variant="body2"
                                                                            fontWeight={700}
                                                                            color="#64748b"
                                                                            sx={{ minWidth: 70 }}
                                                                        >
                                                                            Type:
                                                                        </Typography>
                                                                        <Chip
                                                                            label={config.selectionType === 'single' ? 'Single Select' : 'Multi Select'}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{ 
                                                                                fontSize: '0.75rem', 
                                                                                height: 22,
                                                                                borderColor: '#667eea',
                                                                                color: '#667eea',
                                                                                fontWeight: 600,
                                                                            }}
                                                                        />
                                                                    </Box>

                                                                    <Box display="flex" alignItems="flex-start" gap={1}>
                                                                        <Typography
                                                                            variant="body2"
                                                                            fontWeight={700}
                                                                            color="#64748b"
                                                                            sx={{ minWidth: 70, mt: 0.5 }}
                                                                        >
                                                                            Defaults:
                                                                        </Typography>
                                                                        <Box display="flex" flexWrap="wrap" gap={0.75}>
                                                                            {config.defaultValues.map((val: DefaultValueOption, index: number) => (
                                                                                <Chip
                                                                                    key={index}
                                                                                    label={JSON.stringify(val)}
                                                                                    size="small"
                                                                                    sx={{ 
                                                                                        fontSize: '0.75rem', 
                                                                                        height: 22, 
                                                                                        mt: 0.5,
                                                                                        background: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)',
                                                                                        color: 'white',
                                                                                        fontWeight: 600,
                                                                                    }}
                                                                                />
                                                                            ))}
                                                                        </Box>
                                                                    </Box>

                                                                    <Box display="flex" alignItems="flex-start" gap={1}>
                                                                        <Typography
                                                                            variant="body2"
                                                                            fontWeight={700}
                                                                            color="#64748b"
                                                                            sx={{ minWidth: 70, mt: 0.5 }}
                                                                        >
                                                                            Options:
                                                                        </Typography>
                                                                        <Typography variant="body2" color="text.secondary" sx={{mt:0.5, fontWeight: 600}}>
                                                                            {config.availableOptions.length} available
                                                                        </Typography>
                                                                    </Box>
                                                                </Box>
                                                            </Collapse>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </Box>
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