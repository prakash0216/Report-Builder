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
  Paper,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';

interface TableSettings {
  pagination: boolean;
  scrollContent: boolean;
  lazyLoad: boolean;
}

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

// Lazy load batch size
const LAZY_LOAD_BATCH_SIZE = 50;

export default function DashboardTable({ dataSource, settings }: DashboardTableProps) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loadedRowCount, setLoadedRowCount] = useState(LAZY_LOAD_BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLTableRowElement>(null);
  
  const tableSettings: TableSettings = settings || {
    pagination: true,
    scrollContent: false,
    lazyLoad: false,
  };

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

  // Get columns from first row
  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  }, [tableData]);

  // Reset loaded count when data source changes
  useEffect(() => {
    setLoadedRowCount(LAZY_LOAD_BATCH_SIZE);
    setPage(0);
  }, [dataSource]);

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
    // Simulate async loading with a small delay for smooth UX
    setTimeout(() => {
      setLoadedRowCount(prev => Math.min(prev + LAZY_LOAD_BATCH_SIZE, tableData.length));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, loadedRowCount, tableData.length]);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!tableSettings.lazyLoad || !loadMoreTriggerRef.current) return;

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
  }, [tableSettings.lazyLoad, loadMoreRows]);

  // Get displayed data based on settings
  const displayedData = useMemo(() => {
    if (tableSettings.pagination) {
      return tableData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
    }
    if (tableSettings.lazyLoad) {
      return tableData.slice(0, loadedRowCount);
    }
    if (tableSettings.scrollContent) {
      return tableData; // Show all for scrolling
    }
    // Default: show first 100 rows
    return tableData.slice(0, 100);
  }, [tableData, tableSettings, page, rowsPerPage, loadedRowCount]);

  // Check if more rows can be loaded
  const hasMoreRows = tableSettings.lazyLoad && loadedRowCount < tableData.length;

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
          maxHeight: tableSettings.pagination ? 'calc(100% - 64px)' : '100%',
        }}
      >
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell 
                  key={col}
                  sx={{ 
                    fontWeight: 700, 
                    // Solid background color for sticky header - prevents content showing through
                    backgroundColor: '#e0e7ff !important',
                    background: '#e0e7ff !important',
                    color: '#1e293b',
                    fontSize: '0.8rem',
                    py: 1.5,
                    whiteSpace: 'nowrap',
                    borderBottom: '2px solid rgba(59, 130, 246, 0.3)',
                    // Ensure header stays on top
                    zIndex: 2,
                    position: 'sticky',
                    top: 0,
                  }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {displayedData.map((row: any, rowIdx: number) => (
              <TableRow 
                key={rowIdx} 
                hover
                sx={{
                  '&:nth-of-type(odd)': {
                    bgcolor: 'rgba(59, 130, 246, 0.02)',
                  },
                  '&:hover': {
                    bgcolor: 'rgba(59, 130, 246, 0.06) !important',
                  },
                }}
              >
                {columns.map((col) => (
                  <TableCell 
                    key={col}
                    sx={{ 
                      fontSize: '0.8rem',
                      py: 1,
                      color: '#475569',
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
          </TableBody>
        </Table>
      </TableContainer>

      {/* Lazy load status bar */}
      {tableSettings.lazyLoad && !tableSettings.pagination && (
        <Box 
          sx={{ 
            py: 0.75, 
            px: 2, 
            borderTop: '1px solid rgba(59, 130, 246, 0.15)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(37, 99, 235, 0.03) 100%)',
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
      
      {tableSettings.pagination && (
        <TablePagination
          component="div"
          count={tableData.length}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 25, 50, 100]}
          sx={{
            borderTop: '1px solid rgba(59, 130, 246, 0.15)',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(37, 99, 235, 0.03) 100%)',
            flexShrink: 0,
            '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
              color: '#64748b',
              fontWeight: 600,
              fontSize: '0.75rem',
            },
          }}
        />
      )}
    </Paper>
  );
}

