import { useState, useRef, useEffect, useCallback } from "react";
import { useRecoilState } from 'recoil';
import { topNState } from "../recoil/topN"; // Import the topN atom
import axios from 'axios';

interface MultiSelectFilterProps {
  label: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  onApply: (selectedValues: string[]) => void;
  appliedValues: string[];
  placeholder?: string;
  className?: string;
  isLoading?: boolean;
}

// Single Select Dropdown for TopN
interface SingleSelectDropdownProps {
  label: string;
  options: Array<{
    value: number;
    label: string;
  }>;
  selectedValue: number;
  onChange: (value: number) => void;
  className?: string;
}

const SingleSelectDropdown: React.FC<SingleSelectDropdownProps> = ({
  label,
  options,
  selectedValue,
  onChange,
  className = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionSelect = (value: number) => {
    onChange(value);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    const option = options.find(opt => opt.value === selectedValue);
    return option ? option.label : `Top ${selectedValue}`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
      >
        <span className="block truncate text-sm text-gray-700">
          {getDisplayText()}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-[200px] overflow-auto">
          <div className="py-1">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleOptionSelect(option.value)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${
                  selectedValue === option.value ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const client = axios.create();

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  onApply,
  appliedValues,
  placeholder = "(All)",
  className = "",
  isLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option.value));
    }
  };

  const handleOptionToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter(v => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (appliedValues.length === 0 || appliedValues.length === options.length) {
      return placeholder;
    }
    if (appliedValues.length === 1) {
      const option = options.find(opt => opt.value === appliedValues[0]);
      return option ? option.label : appliedValues[0];
    }
    return `${appliedValues.length} selected`;
  };

  const hasChanges = JSON.stringify([...selectedValues].sort()) !== JSON.stringify([...appliedValues].sort());

  const handleApply = () => {
    onApply(selectedValues);
    setIsOpen(false);
  };

  if (isLoading) {
    return (
      <div className={`relative ${className}`}>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
        <div className="relative w-full bg-gray-100 border border-gray-300 rounded-md shadow-sm px-3 py-2">
          <span className="block truncate text-sm text-gray-500">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
      >
        <span className="block truncate text-sm text-gray-700">
          {getDisplayText()}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-[600px] overflow-auto">
          <div className="px-3 py-2 border-b border-gray-200">
            <label className="flex items-center cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
              <input
                type="checkbox"
                checked={selectedValues.length === options.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">(All)</span>
            </label>
          </div>

          <div className="py-1">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={() => handleOptionToggle(option.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="border-t border-gray-200 px-3 py-2 sticky bottom-0 bg-white z-10">
            <div className="flex space-x-2">
              <button
                onClick={handleApply}
                disabled={!hasChanges}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  hasChanges 
                    ? 'text-white bg-blue-500 hover:bg-blue-600' 
                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }`}
              >
                Apply
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
            {hasChanges && (
              <div className="mt-1 text-xs text-orange-600 text-center">
                Click Apply to save changes
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Filter Selector Component
interface FilterSelectorProps {
  onApply: (selectedFilters: string[]) => void;
  className?: string;
}

const FilterSelector: React.FC<FilterSelectorProps> = ({ onApply, className = "" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Available filter options
  const availableFilterOptions = [
    { value: "mop", label: "Method of Payment" },
    { value: "payer_name", label: "Payer Name" },
    { value: "brand_generic_flag", label: "Brand Generic Flag" },
    { value: "f_month_2", label: "Date" }
  ];

  // Initialize with all filters selected
  const [selectedFilters, setSelectedFilters] = useState<string[]>(
    availableFilterOptions.map(option => option.value)
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-apply on component mount with all filters selected
  useEffect(() => {
    onApply(availableFilterOptions.map(option => option.value));
  }, [onApply]);

  const handleFilterToggle = (filterValue: string) => {
    if (selectedFilters.includes(filterValue)) {
      setSelectedFilters(selectedFilters.filter(f => f !== filterValue));
    } else {
      setSelectedFilters([...selectedFilters, filterValue]);
    }
  };

  const handleSelectAll = () => {
    if (selectedFilters.length === availableFilterOptions.length) {
      setSelectedFilters([]);
    } else {
      setSelectedFilters(availableFilterOptions.map(option => option.value));
    }
  };

  const handleApply = () => {
    onApply(selectedFilters);
    setIsOpen(false);
  };

  const getDisplayText = () => {
    if (selectedFilters.length === 0) {
      return "No Filters Selected";
    }
    if (selectedFilters.length === availableFilterOptions.length) {
      return "All Filters Selected";
    }
    if (selectedFilters.length === 1) {
      const option = availableFilterOptions.find(opt => opt.value === selectedFilters[0]);
      return option ? option.label : selectedFilters[0];
    }
    return `${selectedFilters.length} filters selected`;
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Column Filters to Display
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-left cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 hover:border-gray-400 transition-colors"
      >
        <span className="block truncate text-sm text-gray-700">
          {getDisplayText()}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <svg
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg">
          <div className="px-3 py-2 border-b border-gray-200">
            <label className="flex items-center cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-1 rounded">
              <input
                type="checkbox"
                checked={selectedFilters.length === availableFilterOptions.length}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="ml-2 text-sm font-medium text-gray-900">Select All</span>
            </label>
          </div>

          <div className="py-1">
            {availableFilterOptions.map((option) => (
              <label
                key={option.value}
                className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedFilters.includes(option.value)}
                  onChange={() => handleFilterToggle(option.value)}
                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
                />
                <span className="ml-2 text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="border-t border-gray-200 px-3 py-2 bg-white">
            <div className="flex space-x-2">
              <button
                onClick={handleApply}
                className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              >
                Apply
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Updated FilterPanel with TopN Filter
interface FilterPanelProps {
  showFilters: boolean;
  onFiltersChange?: (filters: any) => void;
  topOffset?: string;
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterData {
  [key: string]: string[] | any;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ 
  showFilters, 
  onFiltersChange, 
  topOffset = '80px',
}) => {
  // TopN state using Recoil
  const [topNValue, setTopNValue] = useRecoilState(topNState);

  // TopN options - you can customize these values
  const topNOptions = [
    { value: 10, label: 'Top 10' },
    { value: 15, label: 'Top 15' },
    { value: 20, label: 'Top 20' },
    { value: 25, label: 'Top 25' },
    { value: 50, label: 'Top 50' }
  ];

  // Loading states
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  // Dynamic filter options from API
  const [filterOptions, setFilterOptions] = useState<Record<string, FilterOption[]>>({});
  const [activeFilters, setActiveFilters] = useState<string[]>([]); // Which filters to show

  // STAGED SELECTIONS (user is selecting but not applied yet)
  const [stagedFilters, setStagedFilters] = useState<Record<string, string[]>>({});

  // APPLIED FILTERS (actually sent to parent and used for filtering)
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string[]>>({});

  // API call to fetch filter options for selected filters
  const fetchFilterOptions = useCallback(async (selectedFilters: string[]) => {
    if (selectedFilters.length === 0) {
      setFilterOptions({});
      setActiveFilters([]);
      return;
    }

    setIsLoadingFilters(true);
    setFilterError(null);

    try {
      const response = await client.post('/api/report-builder/get-filters', {
        post_data: {
          filters: selectedFilters.join(",")
        }
      });

      const result = response.data;
      
      if (result.ok && result.data) {
        const processedOptions: Record<string, FilterOption[]> = {};

        // Process the API response
        result.data.forEach((filterObj: Record<string, FilterData>) => {
          Object.entries(filterObj).forEach(([filterKey, filterData]) => {
            // Convert the filter data to options format
            if (Array.isArray(filterData)) {
              processedOptions[filterKey] = filterData.map((item: string) => ({
                value: item,
                label: item.charAt(0).toUpperCase() + item.slice(1).replace(/_/g, ' ')
              }));
            } else if (typeof filterData === 'object') {
              // Handle object-based filter data if needed
              processedOptions[filterKey] = Object.keys(filterData).map(key => ({
                value: key,
                label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
              }));
            }
          });
        });

        setFilterOptions(processedOptions);
        setActiveFilters(selectedFilters);

        // Initialize staged and applied filters with ALL OPTIONS SELECTED for new filters
        const initialFilters: Record<string, string[]> = { ...stagedFilters, ...appliedFilters };
        selectedFilters.forEach(key => {
          if (!(key in initialFilters)) {
            // Set all options as selected by default
            initialFilters[key] = processedOptions[key] ? processedOptions[key].map(opt => opt.value) : [];
          }
        });
        
        setStagedFilters(prev => ({ ...prev, ...initialFilters }));
        setAppliedFilters(prev => {
          const newAppliedFilters = { ...prev, ...initialFilters };
          
          // Notify parent component with all filters selected
          if (onFiltersChange) {
            onFiltersChange(newAppliedFilters);
          }
          
          return newAppliedFilters;
        });

      } else {
        throw new Error(result.error || 'Failed to fetch filters');
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
      setFilterError(error instanceof Error ? error.message : 'Failed to load filters');
    } finally {
      setIsLoadingFilters(false);
    }
  }, [onFiltersChange]);

  // Handle filter selector apply
  const handleFilterSelectorApply = useCallback((selectedFilters: string[]) => {
    fetchFilterOptions(selectedFilters);
  }, [fetchFilterOptions]);

  // Individual apply handlers for each filter
  const handleFilterApply = useCallback((filterKey: string, values: string[]) => {
    setAppliedFilters(prev => {
      const updated = { ...prev, [filterKey]: values };
      
      // Notify parent component
      if (onFiltersChange) {
        onFiltersChange(updated);
      }
      
      return updated;
    });
  }, [onFiltersChange]);

  // Update staged filter values
  const handleFilterChange = useCallback((filterKey: string, values: string[]) => {
    setStagedFilters(prev => ({
      ...prev,
      [filterKey]: values
    }));
  }, []);

  // Handle TopN change
  const handleTopNChange = useCallback((value: number) => {
    setTopNValue(value);
    console.log(`TopN changed to: ${value}`);
  }, [setTopNValue]);

  // Check if there are any applied filters
  const hasActiveFilters = Object.values(appliedFilters).some(filterArray => 
    Array.isArray(filterArray) && filterArray.length > 0
  );

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const clearedFilters: Record<string, string[]> = {};
    activeFilters.forEach(key => {
      clearedFilters[key] = [];
    });
    
    setStagedFilters(clearedFilters);
    setAppliedFilters(clearedFilters);

    if (onFiltersChange) {
      onFiltersChange(clearedFilters);
    }
  }, [activeFilters, onFiltersChange]);

  // Get friendly label for filter key
  const getFilterLabel = (filterKey: string): string => {
    const labelMap: Record<string, string> = {
      // Map actual API filter names to display labels
      mop: "Method of Payment",
      payer_name: "Payer Name", 
      brand_generic_flag: "Brand Generic Flag",
      f_month_2: "Date"
    };
    return labelMap[filterKey] || filterKey.charAt(0).toUpperCase() + filterKey.slice(1).replace(/_/g, ' ');
  };

  // Don't render if filters are hidden
  if (!showFilters) return null;

  return (
    <div 
      className="fixed right-0 w-80 bg-white border-l border-gray-200 shadow-lg z-30 overflow-y-auto transition-transform duration-300 px-[10px]"
      style={{
        top: topOffset,
        height: `calc(100vh - ${topOffset})`,
        transform: showFilters ? 'translateX(0)' : 'translateX(100%)'
      }}
    >
      <div className="p-4">
        <div className="bg-gray-400 text-white text-center py-2 -mx-4 mb-4 rounded-t-lg relative">
          <h2 className="text-sm font-medium">Filters</h2>
        </div>

        {/* TopN Filter */}
        <div className="mb-6 p-3 bg-green-50 rounded-lg border border-green-200">
          <SingleSelectDropdown
            label="Top N Records"
            options={topNOptions}
            selectedValue={topNValue}
            onChange={handleTopNChange}
          />
        </div>

        {/* Filter Selector */}
        <div className="mb-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <FilterSelector onApply={handleFilterSelectorApply} />
        </div>

        {/* Error Message */}
        {filterError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{filterError}</p>
            <button
              onClick={() => fetchFilterOptions(activeFilters)}
              className="mt-2 text-xs text-red-700 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
        
        {/* Dynamic Filter Sections */}
        {activeFilters.length > 0 && (
          <div className="space-y-4">
            {activeFilters.map((filterKey) => (
              <MultiSelectFilter
                key={filterKey}
                label={getFilterLabel(filterKey)}
                options={filterOptions[filterKey] || []}
                selectedValues={stagedFilters[filterKey] || []}
                appliedValues={appliedFilters[filterKey] || []}
                onChange={(values) => handleFilterChange(filterKey, values)}
                onApply={(values) => handleFilterApply(filterKey, values)}
                placeholder="(All)"
                isLoading={isLoadingFilters}
              />
            ))}
          </div>
        )}

        {/* No filters selected message */}
        {activeFilters.length === 0 && !isLoadingFilters && (
          <div className="text-center py-8">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.707A1 1 0 013 7V4z" />
            </svg>
            <p className="text-sm text-gray-600">Select filters above to start filtering your data</p>
          </div>
        )}

        {/* Loading indicator */}
        {isLoadingFilters && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Loading filter options...</p>
          </div>
        )}

        {/* Clear All Filters - only show if there are applied filters */}
        {hasActiveFilters && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={clearAllFilters}
              className="w-full px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;