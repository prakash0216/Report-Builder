import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { variableAtomFamily } from '../recoil/VariableFamily';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Paper,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';
import { 
  TableSettings, 
  defaultTableSettings, 
  defaultTableTheme,
  SummaryCalculation,
} from '../types/tableTypes';
import { InsertChart as InsertChartIcon } from '@mui/icons-material';

interface DashboardTableProps {
  dataSource: string;
  settings?: TableSettings;
}

const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Get cell padding based on setting
const getCellPadding = (padding: 'compact' | 'normal' | 'comfortable'): number => {
  switch (padding) {
    case 'compact': return 0.5;
    case 'comfortable': return 1.5;
    default: return 1;
  }
};

// Get font size based on setting
const getFontSize = (size: 'small' | 'medium' | 'large'): string => {
  switch (size) {
    case 'small': return '0.75rem';
    case 'large': return '0.9rem';
    default: return '0.8rem';
  }
};

// Lazy load batch size
const LAZY_LOAD_BATCH_SIZE = 50;

export default function DashboardTable({ dataSource, settings }: DashboardTableProps) {
  const tableSettings: TableSettings = settings || defaultTableSettings;
  const theme = tableSettings.theme || defaultTableTheme;
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(tableSettings.rowsPerPage || 10);
  const [loadedRowCount, setLoadedRowCount] = useState(LAZY_LOAD_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLTableRowElement>(null);
  
  // Sync rowsPerPage with settings when it changes
  useEffect(() => {
    if (tableSettings.rowsPerPage && tableSettings.rowsPerPage !== rowsPerPage) {
      setRowsPerPage(tableSettings.rowsPerPage);
      setPage(0); // Reset to first page when rows per page changes
    }
  }, [tableSettings.rowsPerPage]);

  // Get the variable data
  const rawData = useRecoilValue(variableAtomFamily(dataSource));
  
  // Parse and validate data
  const tableData = useMemo(() => {
    if (!rawData) return [];
    
    const parsedData = typeof rawData === 'string' ? safeParse(rawData) : rawData;
    
    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      return [];
    }
    
    // Verify it's an array of objects
    if (typeof parsedData[0] !== 'object' || parsedData[0] === null) {
      return [];
    }
    
    return parsedData;
  }, [rawData]);

  // Get raw columns from first row
  const rawColumns = useMemo(() => {
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  }, [tableData]);

  // Get visible and ordered columns based on settings
  const columns = useMemo(() => {
    if (tableSettings.columns.length === 0) {
      return rawColumns;
    }
    return tableSettings.columns
      .filter(col => col.visible)
      .sort((a, b) => a.order - b.order)
      .map(col => col.name)
      .filter(name => rawColumns.includes(name));
  }, [tableSettings.columns, rawColumns]);

  // Initialize sort state from settings (use first column from multi-sort array)
  useEffect(() => {
    if (tableSettings.sorting?.enabled && tableSettings.sorting?.columns?.length > 0) {
      setSortColumn(tableSettings.sorting.columns[0].column);
      setSortDirection(tableSettings.sorting.columns[0].direction);
    }
  }, [tableSettings.sorting]);

  // Reset loaded count when data source changes
  useEffect(() => {
    setLoadedRowCount(LAZY_LOAD_BATCH_SIZE);
    setPage(0);
  }, [dataSource]);

  // Handle sorting
  const handleSort = (column: string) => {
    if (!tableSettings.sorting?.enabled) return;
    
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(0);
  };

  // Handle pagination
  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Lazy load more rows when scrolling near the bottom
  const loadMoreRows = useCallback(() => {
    if (isLoadingMore || loadedRowCount >= tableData.length) return;
    
    setIsLoadingMore(true);
    setTimeout(() => {
      setLoadedRowCount(prev => Math.min(prev + LAZY_LOAD_BATCH_SIZE, tableData.length));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, loadedRowCount, tableData.length]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (tableSettings.displayMode !== 'lazyLoad' || !loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreRows();
        }
      },
      {
        root: tableContainerRef.current,
        rootMargin: '100px',
        threshold: 0.1,
      }
    );

    const triggerElement = loadMoreTriggerRef.current;
    if (triggerElement) {
      observer.observe(triggerElement);
    }

    return () => {
      if (triggerElement) {
        observer.unobserve(triggerElement);
      }
    };
  }, [tableSettings.displayMode, loadMoreRows]);

  // Sort data if sorting is enabled
  const sortedData = useMemo(() => {
    if (!tableSettings.sorting?.enabled || !sortColumn) {
      return tableData;
    }
    
    return [...tableData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      
      // Compare values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr) 
        : bStr.localeCompare(aStr);
    });
  }, [tableData, tableSettings.sorting?.enabled, sortColumn, sortDirection]);

  // Get displayed data based on settings
  const displayedData = useMemo(() => {
    const data = sortedData;
    
    switch (tableSettings.displayMode) {
      case 'pagination':
        return data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
      case 'lazyLoad':
        return data.slice(0, loadedRowCount);
      case 'scroll':
        return data;
      default:
        return data.slice(0, 100);
    }
  }, [sortedData, tableSettings.displayMode, page, rowsPerPage, loadedRowCount]);

  // Check if more rows can be loaded
  const hasMoreRows = tableSettings.displayMode === 'lazyLoad' && loadedRowCount < tableData.length;

  // Calculate summary row values
  const summaryRowData = useMemo(() => {
    if (!tableSettings.summaryRow?.enabled) return null;
    
    const calculations: Record<string, { value: string | number; type: SummaryCalculation }> = {};
    
    columns.forEach(col => {
      const calcType = tableSettings.summaryRow?.calculations?.[col];
      if (!calcType || calcType === 'none') {
        calculations[col] = { value: '', type: 'none' };
        return;
      }
      
      const values = tableData
        .map(row => row[col])
        .filter(v => v != null && !isNaN(Number(v)))
        .map(v => Number(v));
      
      // If column has no numeric values, leave the summary blank to avoid misalignment/noise
      if (values.length === 0) {
        calculations[col] = { value: '', type: calcType };
        return;
      }
      
      let calculatedValue: string | number;
      switch (calcType) {
        case 'sum':
          calculatedValue = values.reduce((a, b) => a + b, 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'avg':
          calculatedValue = (values.reduce((a, b) => a + b, 0) / values.length).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'min':
          calculatedValue = Math.min(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'max':
          calculatedValue = Math.max(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
          break;
        case 'count':
          calculatedValue = tableData.filter(row => row[col] != null).length;
          break;
        default:
          calculatedValue = '';
      }
      
      calculations[col] = { value: calculatedValue, type: calcType };
    });
    
    return calculations;
  }, [tableData, columns, tableSettings.summaryRow]);

  // No data state
  if (!dataSource || tableData.length === 0) {
    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: 'rgba(248, 250, 252, 0.5)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <svg 
            className="h-12 w-12 mx-auto mb-3 text-slate-400" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={1.5}
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
            />
          </svg>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            {!dataSource ? 'No data source configured' : 'No data available'}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Paper 
      elevation={0}
      sx={{ 
        height: '100%', 
        width: '100%',
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: 2,
        border: '1px solid rgba(59, 130, 246, 0.15)',
        position: 'relative',
        minHeight: 0,
        maxHeight: '100%',
      }}
    >
      <TableContainer 
        ref={tableContainerRef}
        sx={{ 
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          // Reserve space for pagination footer (52px for the component + some padding)
          maxHeight: tableSettings.displayMode === 'pagination' ? 'calc(100% - 56px)' : '100%',
        }}
      >
        <Table
          stickyHeader
          size={theme.cellPadding === 'compact' ? 'small' : 'medium'}
          sx={{ tableLayout: 'fixed' }}
        >
          {(tableSettings.showHeader !== false) && (
          <TableHead>
            <TableRow>
              {columns.map((col) => {
                // Check if this column is in the configured sort columns
                const sortableColumns = tableSettings.sorting?.columns || [];
                const sortConfig = sortableColumns.find(s => s.column === col);
                const isSortableColumn = !!sortConfig;
                const isActiveSortColumn = sortColumn === col;
                const sortDirForCol = sortConfig?.direction || 'asc';
                const canSort = tableSettings.sorting?.enabled && isSortableColumn;
                
                return (
                  <TableCell 
                    key={col}
                    onClick={() => canSort && handleSort(col)}
                    sx={{ 
                      fontWeight: 700, 
                      backgroundColor: `${theme.headerBgColor} !important`,
                      background: `${theme.headerBgColor} !important`,
                      color: theme.headerTextColor,
                      fontSize: getFontSize(theme.fontSize),
                      py: getCellPadding(theme.cellPadding),
                      whiteSpace: 'nowrap',
                      borderBottom: `2px solid ${theme.borderColor}`,
                      zIndex: 2,
                      position: 'sticky',
                      top: 0,
                      cursor: canSort ? 'pointer' : 'default',
                      '&:hover': canSort ? {
                        backgroundColor: `${theme.headerBgColor}dd !important`,
                      } : {},
                    }}
                  >
                    {canSort ? (
                      <TableSortLabel
                        active={isActiveSortColumn}
                        direction={sortDirForCol}
                        sx={{
                          color: `${theme.headerTextColor} !important`,
                          '& .MuiTableSortLabel-icon': {
                            color: `${theme.headerTextColor} !important`,
                          },
                          '&.Mui-active': {
                            color: `${theme.headerTextColor} !important`,
                          },
                        }}
                      >
                        {col}
                      </TableSortLabel>
                    ) : col}
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>
          )}
          <TableBody>
            {displayedData.map((row: any, rowIdx: number) => (
              <TableRow 
                key={rowIdx} 
                hover
                sx={{
                  backgroundColor: rowIdx % 2 === 0 ? theme.rowBgColor : theme.rowAltBgColor,
                  '&:hover': {
                    bgcolor: `${theme.headerBgColor}22 !important`,
                  },
                }}
              >
                {columns.map((col) => (
                  <TableCell 
                    key={col}
                    sx={{ 
                      fontSize: getFontSize(theme.fontSize),
                      py: getCellPadding(theme.cellPadding),
                      px: getCellPadding(theme.cellPadding) + 0.5,
                      color: theme.rowTextColor,
                      borderBottom: `1px solid ${theme.borderColor}`,
                      maxWidth: 250,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {typeof row[col] === 'object' 
                      ? JSON.stringify(row[col]) 
                      : String(row[col] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {/* Lazy load trigger row */}
            {hasMoreRows && (
              <TableRow ref={loadMoreTriggerRef}>
                <TableCell 
                  colSpan={columns.length} 
                  sx={{ 
                    textAlign: 'center', 
                    py: 2,
                    color: '#64748b',
                    borderBottom: 'none',
                  }}
                >
                  {isLoadingMore ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                      <CircularProgress size={16} thickness={4} />
                      <Typography variant="caption">Loading more rows...</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption">
                      Showing {loadedRowCount} of {tableData.length} rows • Scroll to load more
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
            {/* Summary Row */}
            {summaryRowData && (
              <TableRow sx={{ 
                backgroundColor: `${theme.headerBgColor} !important`,
                position: 'sticky',
                bottom: 0,
                zIndex: 1,
              }}>
                {columns.map((col, idx) => {
                  const summaryCell = summaryRowData[col];
                  const hasValue = summaryCell && summaryCell.value && summaryCell.type !== 'none';
                  const getLabel = (type: SummaryCalculation) => {
                    switch (type) {
                      case 'sum': return 'Sum:';
                      case 'avg': return 'Avg:';
                      case 'min': return 'Min:';
                      case 'max': return 'Max:';
                      case 'count': return 'Count:';
                      default: return '';
                    }
                  };
                  
                  return (
                    <TableCell 
                      key={col}
                      sx={{
                        fontWeight: 700,
                        fontSize: getFontSize(theme.fontSize),
                        py: getCellPadding(theme.cellPadding),
                        px: getCellPadding(theme.cellPadding) + 0.5,
                        color: theme.headerTextColor,
                        borderTop: `2px solid ${theme.borderColor}`,
                        borderBottom: `1px solid ${theme.borderColor}`,
                        maxWidth: 250,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        backgroundColor: `${theme.headerBgColor} !important`,
                        position: 'sticky',
                        bottom: 0,
                        textAlign: 'left',
                      }}
                    >
                      {hasValue ? (
                        // Show calculation label and value for columns with calculations
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'flex-start',
                          fontWeight: 700,
                          color: theme.headerTextColor,
                          gap: 0.5,
                          width: '100%',
                        }}>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 600,
                            fontSize: '0.7rem',
                            opacity: 0.8,
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap',
                          }}>
                            {getLabel(summaryCell.type)}
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}>
                            {summaryCell.value}
                          </Typography>
                        </Box>
                      ) : null}
                    </TableCell>
                  );
                })}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Lazy load status bar */}
      {tableSettings.displayMode === 'lazyLoad' && (
        <Box 
          sx={{ 
            py: 0.75, 
            px: 2, 
            borderTop: `1px solid ${theme.borderColor}`,
            background: `${theme.headerBgColor}11`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" color="#64748b" fontWeight={600}>
            {loadedRowCount >= tableData.length 
              ? `All ${tableData.length} rows loaded`
              : `${loadedRowCount} of ${tableData.length} rows loaded`
            }
          </Typography>
          {loadedRowCount < tableData.length && (
            <Typography variant="caption" color="#3b82f6" fontWeight={500}>
              Scroll down to load more
            </Typography>
          )}
        </Box>
      )}
      
      {tableSettings.displayMode === 'pagination' && (
        <TablePagination
          component="div"
          count={sortedData.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 15, 20, 25, 50, 100]}
          sx={{
            borderTop: '1px solid rgba(59, 130, 246, 0.15)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(37, 99, 235, 0.03) 100%)',
            flexShrink: 0,
            minHeight: 52,
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
            },
            '.MuiTablePagination-toolbar': {
              minHeight: 52,
            },
          }}
        />
      )}
    </Paper>
  );
}

