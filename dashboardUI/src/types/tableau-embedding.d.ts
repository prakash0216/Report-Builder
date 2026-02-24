/* Tableau Embedding API v3 — minimal type declarations */

interface TableauSheetInfo {
  name: string;
  sheetType: string;
  index: number;
  isActive: boolean;
  isHidden: boolean;
  url: string;
}

interface TableauWorkbook {
  name: string;
  publishedSheetsInfo: TableauSheetInfo[];
  activeSheet: TableauSheet;
  activateSheetAsync(sheetNameOrIndex: string | number): Promise<TableauSheet>;
  revertAllAsync(): Promise<void>;
}

interface TableauSheet {
  name: string;
  sheetType: string;
}

interface TableauVizElement extends HTMLElement {
  src: string;
  token?: string;
  hideTabs?: boolean;
  hideToolbar?: boolean;
  toolbar?: string;
  width?: string | number;
  height?: string | number;
  workbook: TableauWorkbook;
  exportImageAsync(): Promise<void>;
  displayDialogAsync(dialogType: string): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

declare namespace JSX {
  interface IntrinsicElements {
    'tableau-viz': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        id?: string;
        src?: string;
        token?: string;
        'hide-tabs'?: boolean | string;
        'hide-toolbar'?: boolean | string;
        toolbar?: string;
        width?: string | number;
        height?: string | number;
      },
      HTMLElement
    >;
  }
}
