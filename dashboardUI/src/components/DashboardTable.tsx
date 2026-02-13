/**
 * DashboardTable — Table renderer for dashboard variables.
 *
 * 🦆 DuckDB-WASM Phase 3:
 * When a variable is backed by DuckDB-WASM (detected via a DuckDB ref in the
 * Recoil atom), pagination, sorting and aggregations are pushed down into
 * DuckDB-WASM in WASM memory. Only the 50-100 rows of the *current page*
 * enter the V8 heap, instead of all 100K+ rows.
 *
 * For small variables or directly-provided data the behaviour is identical to
 * the previous implementation (all data in JS, slice for page).
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useRecoilValue } from 'recoil';
import { variableAtomFamily } from '../recoil/VariableFamily';
import { isDuckDBRef, safeParseVariable, type DuckDBRef } from '../services/VariableStorageService';
import BrowserDuckDB from '../services/BrowserDuckDB';
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DashboardTableProps {
  dataSource: string;
  settings?: TableSettings;
  directData?: any[];
  onRowClick?: (rowData: Record<string, any>, rowIndex: number, columns: string[]) => void;
  highlightEnabled?: boolean;
  highlightedRowIndex?: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const safeParse = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const getCellPadding = (padding: 'compact' | 'normal' | 'comfortable'): number => {
  switch (padding) {
    case 'compact': return 0.5;
    case 'comfortable': return 1.5;
    default: return 1;
  }
};

const getFontSize = (size: 'small' | 'medium' | 'large'): string => {
  switch (size) {
    case 'small': return '0.75rem';
    case 'large': return '0.9rem';
    default: return '0.8rem';
  }
};

/** Fallback batch size — only used if tableSettings.rowsPerPage is not set */
const DEFAULT_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DashboardTable({
  dataSource,
  settings,
  directData,
  onRowClick,
  highlightEnabled,
  highlightedRowIndex,
}: DashboardTableProps) {
  const tableSettings: TableSettings = settings || defaultTableSettings;
  const theme = tableSettings.theme || defaultTableTheme;

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(tableSettings.rowsPerPage || 10);
  /** For lazy load: how many rows to use per batch (uses UI rowsPerPage setting) */
  const lazyBatchSize = tableSettings.rowsPerPage || DEFAULT_BATCH_SIZE;
  const [loadedRowCount, setLoadedRowCount] = useState(lazyBatchSize);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLTableRowElement>(null);

  // -----------------------------------------------------------------------
  // DuckDB-WASM state (Phase 3)
  // -----------------------------------------------------------------------

  /** Are we reading from DuckDB-WASM for this variable? */
  const [isDuckDBMode, setIsDuckDBMode] = useState(false);
  /** Metadata from DuckDB-WASM (row count + column names) */
  const [duckMeta, setDuckMeta] = useState<{ rows: number; columns: string[] } | null>(null);
  /** Page of rows fetched from DuckDB-WASM */
  const [duckPageData, setDuckPageData] = useState<any[]>([]);
  /** Loading flag for DuckDB data */
  const [isDuckLoading, setIsDuckLoading] = useState(false);
  /** Summary aggregates computed inside DuckDB-WASM */
  const [duckSummary, setDuckSummary] = useState<Record<string, { value: string | number; type: SummaryCalculation }> | null>(null);

  // -----------------------------------------------------------------------
  // Sync rowsPerPage with settings
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (tableSettings.rowsPerPage && tableSettings.rowsPerPage !== rowsPerPage) {
      setRowsPerPage(tableSettings.rowsPerPage);
      setPage(0);
    }
  }, [tableSettings.rowsPerPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Read Recoil atom (may be full JSON or a tiny DuckDB ref)
  // -----------------------------------------------------------------------

  const rawDataFromVariable = useRecoilValue(variableAtomFamily(dataSource || ''));
  const rawData = directData !== undefined ? directData : rawDataFromVariable;

  // -----------------------------------------------------------------------
  // Detect DuckDB ref vs plain data
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (directData !== undefined) {
      // Directly-provided data → never use DuckDB mode
      setIsDuckDBMode(false);
      setDuckMeta(null);
      return;
    }

    if (!rawDataFromVariable) {
      setIsDuckDBMode(false);
      setDuckMeta(null);
      return;
    }

    const parsed = typeof rawDataFromVariable === 'string'
      ? safeParseVariable(rawDataFromVariable)
      : rawDataFromVariable;

    if (isDuckDBRef(parsed)) {
      const ref = parsed as DuckDBRef;
      setIsDuckDBMode(true);
      setDuckMeta({ rows: ref.rows, columns: ref.columns });
      setPage(0);
      setLoadedRowCount(lazyBatchSize);
    } else {
      setIsDuckDBMode(false);
      setDuckMeta(null);
    }
  }, [rawDataFromVariable, directData]);

  // -----------------------------------------------------------------------
  // Initialize sort state from settings
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (tableSettings.sorting?.enabled && tableSettings.sorting?.columns?.length > 0) {
      setSortColumn(tableSettings.sorting.columns[0].column);
      setSortDirection(tableSettings.sorting.columns[0].direction);
    }
  }, [tableSettings.sorting]);

  // Reset when data source changes
  useEffect(() => {
    setLoadedRowCount(lazyBatchSize);
    setPage(0);
  }, [dataSource, lazyBatchSize]);

  // -----------------------------------------------------------------------
  // Legacy path: parse plain Recoil data (small variables / directData)
  // -----------------------------------------------------------------------

  const tableData = useMemo(() => {
    if (isDuckDBMode) return []; // not used in DuckDB path
    if (!rawData) return [];

    const parsedData = typeof rawData === 'string' ? safeParse(rawData) : rawData;
    if (!Array.isArray(parsedData) || parsedData.length === 0) return [];
    if (typeof parsedData[0] !== 'object' || parsedData[0] === null) return [];

    return parsedData;
  }, [rawData, isDuckDBMode]);

  // -----------------------------------------------------------------------
  // Column list (works for both modes)
  // -----------------------------------------------------------------------

  const rawColumns = useMemo(() => {
    if (isDuckDBMode && duckMeta?.columns) return duckMeta.columns;
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  }, [isDuckDBMode, duckMeta, tableData]);

  const columns = useMemo(() => {
    if (tableSettings.columns.length === 0) return rawColumns;
    return tableSettings.columns
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order)
      .map((col) => col.name)
      .filter((name) => rawColumns.includes(name));
  }, [tableSettings.columns, rawColumns]);

  // -----------------------------------------------------------------------
  // DuckDB-WASM path: Fetch the page of data we need
  // -----------------------------------------------------------------------

  // Use a ref to track the latest fetch request ID so stale responses are ignored
  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!isDuckDBMode || !dataSource) return;

    const currentFetchId = ++fetchIdRef.current;

    const fetchPage = async () => {
      setIsDuckLoading(true);
      console.log(`[DashboardTable] fetchPage start for "${dataSource}" (fetchId=${currentFetchId}, mode=${tableSettings.displayMode})`);
      try {
        const db = BrowserDuckDB.getInstance();
        // Await DuckDB initialization — don't bail out if it's still loading
        await db.init();
        if (fetchIdRef.current !== currentFetchId) {
          console.log(`[DashboardTable] fetchPage stale (current=${fetchIdRef.current}, mine=${currentFetchId})`);
          return;
        }
        if (!db.isReady()) {
          console.warn(`[DashboardTable] DuckDB not ready for "${dataSource}"`);
          setDuckPageData([]);
          setIsDuckLoading(false);
          return;
        }

        // Verify the table exists in DuckDB before querying
        const tableExists = await db.hasVariable(dataSource);
        if (!tableExists) {
          console.warn(`[DashboardTable] Table for "${dataSource}" not found in DuckDB-WASM, waiting...`);
          // Table might still be ingesting — wait and retry
          await new Promise(r => setTimeout(r, 1000));
          if (fetchIdRef.current !== currentFetchId) return;
          const existsNow = await db.hasVariable(dataSource);
          if (!existsNow) {
            console.warn(`[DashboardTable] Table for "${dataSource}" still not found after retry`);
            setDuckPageData([]);
            setIsDuckLoading(false);
            return;
          }
        }

        // Determine offset / limit based on display mode
        let offset = 0;
        let limit = lazyBatchSize;

        if (tableSettings.displayMode === 'pagination') {
          offset = page * rowsPerPage;
          limit = rowsPerPage;
        } else if (tableSettings.displayMode === 'lazyLoad') {
          offset = 0;
          limit = loadedRowCount;
        } else if (tableSettings.displayMode === 'scroll') {
          offset = 0;
          limit = duckMeta?.rows ?? 100_000;
        } else {
          offset = 0;
          limit = rowsPerPage || 100; // use UI-configured rows per page
        }

        // First try queryVariable (uses DuckDB SQL with sorting)
        let rows: any[] = [];
        try {
          rows = await db.queryVariable(dataSource, {
            offset,
            limit,
            orderBy: sortColumn || undefined,
            orderDirection: sortDirection === 'desc' ? 'DESC' : 'ASC',
          });
        } catch (queryErr) {
          // queryVariable failed — try getVariablePage as fallback
          console.warn(`[DashboardTable] queryVariable failed for "${dataSource}", trying getVariablePage:`, queryErr);
          try {
            rows = await db.getVariablePage(dataSource, offset, limit);
          } catch (pageErr) {
            console.warn(`[DashboardTable] getVariablePage also failed for "${dataSource}":`, pageErr);
          }
        }

        // If we got no rows but metadata says there should be data, retry once
        // (the table may still be ingesting from a concurrent storeVariable call)
        if (rows.length === 0 && duckMeta && duckMeta.rows > 0) {
          console.log(`[DashboardTable] Got 0 rows for "${dataSource}" but meta says ${duckMeta.rows} — retrying in 500ms`);
          await new Promise(r => setTimeout(r, 500));
          if (fetchIdRef.current !== currentFetchId) return; // stale after wait
          try {
            rows = await db.queryVariable(dataSource, {
              offset,
              limit,
              orderBy: sortColumn || undefined,
              orderDirection: sortDirection === 'desc' ? 'DESC' : 'ASC',
            });
          } catch { /* ignore retry errors */ }
        }

        if (fetchIdRef.current === currentFetchId) {
          setDuckPageData(rows);
          setIsDuckLoading(false);
        }
      } catch (err) {
        console.warn(`[DashboardTable] DuckDB page fetch failed for "${dataSource}":`, err);
        if (fetchIdRef.current === currentFetchId) {
          setDuckPageData([]);
          setIsDuckLoading(false);
        }
      }
    };

    fetchPage();
    // No cleanup needed — we use fetchIdRef to ignore stale responses
  }, [isDuckDBMode, dataSource, page, rowsPerPage, loadedRowCount, sortColumn, sortDirection, tableSettings.displayMode, duckMeta?.rows, lazyBatchSize]);

  // -----------------------------------------------------------------------
  // DuckDB-WASM path: Compute summary aggregates inside DuckDB
  // -----------------------------------------------------------------------

  const summaryFetchIdRef = useRef(0);

  useEffect(() => {
    if (!isDuckDBMode || !tableSettings.summaryRow?.enabled || columns.length === 0) {
      setDuckSummary(null);
      return;
    }

    const currentId = ++summaryFetchIdRef.current;

    const computeSummary = async () => {
      const db = BrowserDuckDB.getInstance();
      await db.init();
      if (summaryFetchIdRef.current !== currentId || !db.isReady()) return;
      const aggregations: Record<string, 'sum' | 'avg' | 'min' | 'max' | 'count'> = {};
      for (const col of columns) {
        const calcType = tableSettings.summaryRow?.calculations?.[col];
        if (calcType && calcType !== 'none') {
          aggregations[col] = calcType as 'sum' | 'avg' | 'min' | 'max' | 'count';
        }
      }

      if (Object.keys(aggregations).length === 0) {
        if (summaryFetchIdRef.current === currentId) setDuckSummary(null);
        return;
      }

      try {
        const rawAgg = await db.getVariableAggregates(dataSource, aggregations);
        const summary: Record<string, { value: string | number; type: SummaryCalculation }> = {};

        for (const col of columns) {
          const calcType = tableSettings.summaryRow?.calculations?.[col];
          if (!calcType || calcType === 'none') {
            summary[col] = { value: '', type: 'none' };
            continue;
          }

          const v = rawAgg[col];
          if (v === null || v === undefined || isNaN(v)) {
            summary[col] = { value: '', type: calcType };
          } else {
            const formatted =
              calcType === 'count'
                ? v
                : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
            summary[col] = { value: formatted, type: calcType };
          }
        }

        if (summaryFetchIdRef.current === currentId) setDuckSummary(summary);
      } catch (err) {
        console.warn('[DashboardTable] DuckDB summary failed:', err);
        if (summaryFetchIdRef.current === currentId) setDuckSummary(null);
      }
    };

    computeSummary();
  }, [isDuckDBMode, dataSource, columns, tableSettings.summaryRow]);

  // -----------------------------------------------------------------------
  // Legacy path: sort + paginate in JS (small variables)
  // -----------------------------------------------------------------------

  const handleSort = (column: string) => {
    if (!tableSettings.sorting?.enabled) return;
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(0);
  };

  const handlePageChange = (_event: unknown, newPage: number) => setPage(newPage);

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const loadMoreRows = useCallback(() => {
    if (isLoadingMore) return;
    const total = isDuckDBMode ? (duckMeta?.rows ?? 0) : tableData.length;
    if (loadedRowCount >= total) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      setLoadedRowCount((prev) => Math.min(prev + lazyBatchSize, total));
      setIsLoadingMore(false);
    }, 100);
  }, [isLoadingMore, loadedRowCount, isDuckDBMode, duckMeta?.rows, tableData.length, lazyBatchSize]);

  useEffect(() => {
    if (tableSettings.displayMode !== 'lazyLoad' || !loadMoreTriggerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreRows();
      },
      { root: tableContainerRef.current, rootMargin: '100px', threshold: 0.1 }
    );

    const triggerElement = loadMoreTriggerRef.current;
    if (triggerElement) observer.observe(triggerElement);
    return () => {
      if (triggerElement) observer.unobserve(triggerElement);
    };
  }, [tableSettings.displayMode, loadMoreRows]);

  // Sort (legacy path)
  const sortedData = useMemo(() => {
    if (isDuckDBMode) return []; // DuckDB handles sorting
    if (!tableSettings.sorting?.enabled || !sortColumn) return tableData;

    return [...tableData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [isDuckDBMode, tableData, tableSettings.sorting?.enabled, sortColumn, sortDirection]);

  // Page slice (legacy path)
  const displayedData = useMemo(() => {
    if (isDuckDBMode) return duckPageData; // Already paginated by DuckDB

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
  }, [isDuckDBMode, duckPageData, sortedData, tableSettings.displayMode, page, rowsPerPage, loadedRowCount]);

  // Total row count (unified)
  const totalRowCount = isDuckDBMode ? (duckMeta?.rows ?? 0) : sortedData.length;
  const hasMoreRows =
    tableSettings.displayMode === 'lazyLoad' && loadedRowCount < totalRowCount;

  // -----------------------------------------------------------------------
  // Summary row (legacy path — DuckDB summary handled separately)
  // -----------------------------------------------------------------------

  const summaryRowData = useMemo(() => {
    if (isDuckDBMode) return duckSummary; // DuckDB aggregates
    if (!tableSettings.summaryRow?.enabled) return null;

    const calculations: Record<string, { value: string | number; type: SummaryCalculation }> = {};

    columns.forEach((col) => {
      const calcType = tableSettings.summaryRow?.calculations?.[col];
      if (!calcType || calcType === 'none') {
        calculations[col] = { value: '', type: 'none' };
        return;
      }

      const values = tableData
        .map((row) => row[col])
        .filter((v) => v != null && !isNaN(Number(v)))
        .map((v) => Number(v));

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
          calculatedValue = tableData.filter((row) => row[col] != null).length;
          break;
        default:
          calculatedValue = '';
      }
      calculations[col] = { value: calculatedValue, type: calcType };
    });

    return calculations;
  }, [isDuckDBMode, duckSummary, tableData, columns, tableSettings.summaryRow]);

  // -----------------------------------------------------------------------
  // Empty state
  // -----------------------------------------------------------------------

  // Don't show empty state while DuckDB is still loading or initializing
  if (!dataSource || (totalRowCount === 0 && !isDuckLoading && !isDuckDBMode)) {
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

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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
      {/* DuckDB loading indicator */}
      {isDuckLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 10,
            background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 50%, #3b82f6 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear',
            '@keyframes shimmer': {
              '0%': { backgroundPosition: '200% 0' },
              '100%': { backgroundPosition: '-200% 0' },
            },
          }}
        />
      )}

      <TableContainer
        ref={tableContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0,
          maxHeight: tableSettings.displayMode === 'pagination' ? 'calc(100% - 56px)' : '100%',
        }}
      >
        <Table
          stickyHeader
          size={theme.cellPadding === 'compact' ? 'small' : 'medium'}
          sx={{ tableLayout: 'fixed' }}
        >
          {tableSettings.showHeader !== false && (
            <TableHead>
              <TableRow>
                {columns.map((col) => {
                  const sortableColumns = tableSettings.sorting?.columns || [];
                  const sortConfig = sortableColumns.find((s) => s.column === col);
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
                        '&:hover': canSort
                          ? { backgroundColor: `${theme.headerBgColor}dd !important` }
                          : {},
                      }}
                    >
                      {canSort ? (
                        <TableSortLabel
                          active={isActiveSortColumn}
                          direction={sortDirForCol}
                          sx={{
                            color: `${theme.headerTextColor} !important`,
                            '& .MuiTableSortLabel-icon': { color: `${theme.headerTextColor} !important` },
                            '&.Mui-active': { color: `${theme.headerTextColor} !important` },
                          }}
                        >
                          {col}
                        </TableSortLabel>
                      ) : (
                        col
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
          )}
          <TableBody>
            {/* Show loading placeholder when DuckDB is fetching data */}
            {isDuckDBMode && isDuckLoading && displayedData.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Loading data from DuckDB-WASM…</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {/* Show "fetching" message when DuckDB mode is active but no data yet and not loading */}
            {isDuckDBMode && !isDuckLoading && displayedData.length === 0 && duckMeta && duckMeta.rows > 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} sx={{ textAlign: 'center', py: 4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Querying DuckDB-WASM ({duckMeta.rows.toLocaleString()} rows)…</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            )}
            {displayedData.map((row: any, rowIdx: number) => {
              const isHighlighted = highlightEnabled && highlightedRowIndex === rowIdx;
              return (
                <TableRow
                  key={rowIdx}
                  hover
                  onClick={onRowClick ? () => onRowClick(row, rowIdx, columns) : undefined}
                  sx={{
                    backgroundColor: isHighlighted
                      ? 'rgba(59, 130, 246, 0.15) !important'
                      : rowIdx % 2 === 0
                      ? theme.rowBgColor
                      : theme.rowAltBgColor,
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background-color 0.15s ease',
                    '&:hover': {
                      bgcolor: isHighlighted
                        ? 'rgba(59, 130, 246, 0.22) !important'
                        : `${theme.headerBgColor}22 !important`,
                    },
                    ...(isHighlighted
                      ? {
                          outline: '2px solid rgba(59, 130, 246, 0.4)',
                          outlineOffset: '-2px',
                          borderRadius: '2px',
                        }
                      : {}),
                    ...(highlightEnabled &&
                    highlightedRowIndex !== null &&
                    highlightedRowIndex !== undefined &&
                    !isHighlighted
                      ? { opacity: 0.45 }
                      : {}),
                  }}
                >
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      sx={{
                        fontSize: getFontSize(theme.fontSize),
                        py: getCellPadding(theme.cellPadding),
                        px: getCellPadding(theme.cellPadding) + 0.5,
                        color: isHighlighted ? '#1e40af' : theme.rowTextColor,
                        fontWeight: isHighlighted ? 600 : 'inherit',
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
              );
            })}
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
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                      }}
                    >
                      <CircularProgress size={16} thickness={4} />
                      <Typography variant="caption">Loading more rows...</Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption">
                      Showing {Math.min(loadedRowCount, totalRowCount)} of {totalRowCount} rows
                      &bull; Scroll to load more
                    </Typography>
                  )}
                </TableCell>
              </TableRow>
            )}
            {/* Summary Row */}
            {summaryRowData && (
              <TableRow
                sx={{
                  backgroundColor: `${theme.headerBgColor} !important`,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 1,
                }}
              >
                {columns.map((col) => {
                  const summaryCell = summaryRowData[col];
                  const hasValue =
                    summaryCell && summaryCell.value !== '' && summaryCell.type !== 'none';
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
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-start',
                            fontWeight: 700,
                            color: theme.headerTextColor,
                            gap: 0.5,
                            width: '100%',
                          }}
                        >
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.7rem',
                              opacity: 0.8,
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {getLabel(summaryCell.type)}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
                          >
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
            {loadedRowCount >= totalRowCount
              ? `All ${totalRowCount} rows loaded`
              : `${loadedRowCount} of ${totalRowCount} rows loaded`}
          </Typography>
          {loadedRowCount < totalRowCount && (
            <Typography variant="caption" color="#3b82f6" fontWeight={500}>
              Scroll down to load more
            </Typography>
          )}
        </Box>
      )}

      {tableSettings.displayMode === 'pagination' && (
        <TablePagination
          component="div"
          count={totalRowCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[5, 10, 15, 20, 25, 50, 100]}
          sx={{
            borderTop: '1px solid rgba(59, 130, 246, 0.15)',
            background:
              'linear-gradient(135deg, rgba(59, 130, 246, 0.03) 0%, rgba(37, 99, 235, 0.03) 100%)',
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
