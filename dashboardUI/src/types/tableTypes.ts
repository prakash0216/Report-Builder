// Table display mode - only one can be active
export type TableDisplayMode = 'pagination' | 'scroll' | 'lazyLoad';

// Summary row calculation types
export type SummaryCalculation = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'none';

// Column configuration for ordering and visibility
export interface ColumnConfig {
  name: string;
  visible: boolean;
  order: number;
}

// Sort column configuration for multi-column sorting
export interface SortColumn {
  column: string;
  direction: 'asc' | 'desc';
}

// Summary row configuration
export interface SummaryRowConfig {
  enabled: boolean;
  calculations: Record<string, SummaryCalculation>; // column name -> calculation type
}

// Table theme/styling options
export interface TableTheme {
  headerBgColor: string;
  headerTextColor: string;
  rowBgColor: string;
  rowAltBgColor: string;
  rowTextColor: string;
  borderColor: string;
  cellPadding: 'compact' | 'normal' | 'comfortable';
  fontSize: 'small' | 'medium' | 'large';
}

// Complete table settings
export interface TableSettings {
  displayMode: TableDisplayMode;
  rowsPerPage: number; // Configurable rows per page for pagination
  sorting: {
    enabled: boolean;
    columns: SortColumn[]; // Multi-column sorting
  };
  columns: ColumnConfig[];
  theme: TableTheme;
  showHeader: boolean; // Option to show/hide header
  summaryRow: SummaryRowConfig; // Summary row with calculations
}

// Default table theme
export const defaultTableTheme: TableTheme = {
  headerBgColor: '#e0e7ff',
  headerTextColor: '#1e293b',
  rowBgColor: '#ffffff',
  rowAltBgColor: '#f8fafc',
  rowTextColor: '#475569',
  borderColor: '#e2e8f0',
  cellPadding: 'normal',
  fontSize: 'medium',
};

// Default table settings
export const defaultTableSettings: TableSettings = {
  displayMode: 'pagination',
  rowsPerPage: 10,
  sorting: {
    enabled: false,
    columns: [],
  },
  columns: [],
  theme: defaultTableTheme,
  showHeader: true,
  summaryRow: {
    enabled: false,
    calculations: {},
  },
};
