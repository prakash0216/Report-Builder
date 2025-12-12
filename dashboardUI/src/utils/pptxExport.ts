import Highcharts from 'highcharts';
// @ts-ignore
import html2canvas from 'html2canvas';
import { ChartRef, TableData } from './downloadUtilities';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getChartWithRetry = async (container: HTMLElement, maxRetries = 6): Promise<Highcharts.Chart | null> => {
  for (let i = 0; i < maxRetries; i++) {
    const chart = Highcharts.charts.find((ch: any) => {
      const renderTo = ch?.renderTo as HTMLElement | undefined;
      return renderTo && container.contains(renderTo);
    }) as Highcharts.Chart | null;
    if (chart) return chart;
    await sleep(200);
  }
  return null;
};

const captureElementAsPng = async (el: HTMLElement): Promise<string | null> => {
  try {
    const rect = el.getBoundingClientRect();
    
    // Skip if element has no dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('[PPTX] captureElementAsPng: element has no dimensions');
      return null;
    }
    
    // Scroll element into view to ensure it's rendered
    el.scrollIntoView({ behavior: 'auto', block: 'center' });
    await sleep(100);
    
    // Get fresh rect after scroll
    const freshRect = el.getBoundingClientRect();
    
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: freshRect.width,
      height: freshRect.height,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      onclone: (clonedDoc: Document, clonedEl: Element) => {
        // Ensure the cloned element is visible
        (clonedEl as HTMLElement).style.overflow = 'visible';
        // Force visibility on any child elements
        const children = clonedEl.querySelectorAll('*');
        children.forEach(child => {
          const htmlChild = child as HTMLElement;
          if (htmlChild.style) {
            htmlChild.style.visibility = 'visible';
            htmlChild.style.opacity = '1';
          }
        });
      },
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[PPTX] captureElementAsPng failed', err);
    return null;
  }
};

const captureChartAsPng = async (chart: Highcharts.Chart): Promise<string | null> => {
  const svg = (chart as any).getSVG?.();
  if (!svg) return null;
  return await new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  });
};

/**
 * Build table rows for pptxgenjs table
 * Format: Array of rows, where each row is an array of cells
 * First row is header
 */
const buildPptxTableData = (tableData: TableData, maxRows: number = 50): { rows: any[][], hasMore: boolean } => {
  const { columns, rows } = tableData;
  
  if (!columns || columns.length === 0 || !rows || rows.length === 0) {
    return { rows: [], hasMore: false };
  }
  
  // Build header row with styling
  const headerRow = columns.map(col => ({
    text: String(col),
    options: {
      bold: true,
      fill: { color: 'E0E7FF' },
      color: '1E293B',
      fontSize: 9,
      align: 'left',
      valign: 'middle',
    }
  }));
  
  // Build data rows (limit to maxRows for performance)
  const limitedRows = rows.slice(0, maxRows);
  const dataRows = limitedRows.map((row, rowIdx) => 
    columns.map(col => ({
      text: typeof row[col] === 'object' 
        ? JSON.stringify(row[col]) 
        : String(row[col] ?? ''),
      options: {
        fill: { color: rowIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
        color: '475569',
        fontSize: 8,
        align: 'left',
        valign: 'middle',
      }
    }))
  );
  
  return {
    rows: [headerRow, ...dataRows],
    hasMore: rows.length > maxRows
  };
};

/**
 * Calculate optimal column widths for pptxgenjs table
 */
const calculateColumnWidths = (columns: string[], rows: Array<Record<string, any>>, availableWidth: number): number[] => {
  const numCols = columns.length;
  
  // Calculate max content width for each column (approximation)
  const maxLengths = columns.map((col, colIdx) => {
    let maxLen = col.length;
    rows.slice(0, 20).forEach(row => {
      const val = row[col];
      const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
      maxLen = Math.max(maxLen, strVal.length);
    });
    return Math.min(maxLen, 30); // Cap at 30 chars
  });
  
  const totalLen = maxLengths.reduce((a, b) => a + b, 0);
  
  // Distribute width proportionally, with minimum width
  const minColWidth = 0.8;
  return maxLengths.map(len => 
    Math.max(minColWidth, (len / totalLen) * availableWidth)
  );
};

/**
 * pptxgenjs Chart Type Support:
 * 
 * FULLY SUPPORTED (native editable charts):
 * - bar (with barDir: 'bar' for horizontal, 'col' for vertical)
 * - line
 * - area  
 * - pie
 * - doughnut
 * - scatter (XY scatter)
 * 
 * PARTIALLY SUPPORTED (may not match Highcharts exactly):
 * - stacked bar/column (via barGrouping: 'stacked')
 * - 100% stacked (via barGrouping: 'percentStacked')
 * 
 * NOT SUPPORTED (fallback to image):
 * - spline, areaspline (use line/area as fallback or image)
 * - waterfall, funnel, pyramid
 * - gauge, solidgauge
 * - heatmap, treemap, sunburst
 * - bubble (pptxgenjs has limited bubble support)
 * - boxplot, errorbar
 * - sankey, dependencywheel
 * - organization, wordcloud
 * - variwide, vector, windbarb
 */

// Chart types that can be rendered natively in pptxgenjs
const SUPPORTED_CHART_TYPES = new Set([
  'column', 'bar', 'line', 'area', 'pie', 'doughnut', 'scatter'
]);

// Chart types that should fall back to image (complex or unsupported)
const FALLBACK_TO_IMAGE_TYPES = new Set([
  'spline', 'areaspline', 'arearange', 'areasplinerange', 'columnrange',
  'waterfall', 'funnel', 'funnel3d', 'pyramid', 'pyramid3d',
  'gauge', 'solidgauge',
  'heatmap', 'tilemap', 'treemap', 'sunburst',
  'bubble', 'packedbubble',
  'boxplot', 'errorbar',
  'sankey', 'dependencywheel', 'networkgraph',
  'organization', 'wordcloud',
  'variwide', 'vector', 'windbarb', 'xrange',
  'bellcurve', 'histogram', 'pareto',
  'bullet', 'cylinder', 'item', 'lollipop', 'dumbell',
  'venn', 'euler'
]);

interface ChartTypeInfo {
  pptxType: string;
  isSupported: boolean;
  barDir?: 'bar' | 'col';
  barGrouping?: 'clustered' | 'stacked' | 'percentStacked';
}

const mapChartType = (t?: string, stacking?: string): ChartTypeInfo => {
  if (!t) return { pptxType: 'bar', isSupported: true, barDir: 'col' };
  const type = t.toLowerCase();
  
  // Check if this type should fall back to image
  if (FALLBACK_TO_IMAGE_TYPES.has(type)) {
    return { pptxType: type, isSupported: false };
  }
  
  // Map to supported pptxgenjs types
  if (['column', 'col'].includes(type)) {
    const barGrouping = stacking === 'normal' ? 'stacked' : 
                        stacking === 'percent' ? 'percentStacked' : 'clustered';
    return { pptxType: 'bar', isSupported: true, barDir: 'col', barGrouping };
  }
  
  if (type === 'bar') {
    const barGrouping = stacking === 'normal' ? 'stacked' : 
                        stacking === 'percent' ? 'percentStacked' : 'clustered';
    return { pptxType: 'bar', isSupported: true, barDir: 'bar', barGrouping };
  }
  
  if (['line', 'spline'].includes(type)) {
    return { pptxType: 'line', isSupported: true };
  }
  
  if (['area', 'areaspline'].includes(type)) {
    return { pptxType: 'area', isSupported: true };
  }
  
  if (['pie'].includes(type)) {
    return { pptxType: 'pie', isSupported: true };
  }
  
  if (['donut', 'doughnut'].includes(type)) {
    return { pptxType: 'doughnut', isSupported: true };
  }
  
  if (['scatter'].includes(type)) {
    return { pptxType: 'scatter', isSupported: true };
  }
  
  // Default to column chart for unknown types
  return { pptxType: 'bar', isSupported: true, barDir: 'col' };
};

// Helper to convert color to hex (handles rgba, rgb, hex, named colors)
const toHex = (color: string | undefined): string => {
  if (!color) return '4472C4'; // Default blue
  if (color.startsWith('#')) return color.slice(1).toUpperCase();
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      const [r, g, b] = match.map(Number);
      return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }
  }
  // Named colors fallback
  const namedColors: Record<string, string> = {
    red: 'FF0000', blue: '0000FF', green: '00FF00', yellow: 'FFFF00',
    orange: 'FFA500', purple: '800080', pink: 'FFC0CB', black: '000000',
    white: 'FFFFFF', gray: '808080', grey: '808080'
  };
  return namedColors[color.toLowerCase()] || '4472C4';
};

interface ChartDataResult {
  chartTypeInfo: ChartTypeInfo;
  rawChartType: string;
  data: Array<{ name: string; labels: string[]; values: number[] }>;
  categories: string[];
  colors: string[];
  isInverted: boolean;
  xAxisTitle: string;
  yAxisTitle: string;
  stacking?: string;
}

const buildChartData = (chart: Highcharts.Chart): ChartDataResult | null => {
  try {
    const options = chart.options || {};
    const rawChartType = options.chart?.type || (chart.series?.[0] as any)?.type || 'column';
    
    // Get stacking info for bar/column charts
    const stacking = (options.plotOptions as any)?.series?.stacking || 
                     (options.plotOptions as any)?.column?.stacking ||
                     (options.plotOptions as any)?.bar?.stacking;
    
    const chartTypeInfo = mapChartType(rawChartType, stacking);
    
    // Determine if chart is inverted (horizontal bar)
    // Highcharts: inverted=true OR type='bar' means horizontal bars
    const isInverted = options.chart?.inverted === true || rawChartType === 'bar';
    
    // Get categories from xAxis
    let categories: string[] = [];
    if (Array.isArray(chart.xAxis) && chart.xAxis[0]?.categories?.length) {
      categories = chart.xAxis[0].categories as string[];
    }
    
    // Extract colors from Highcharts
    const defaultColors = (options.colors as string[]) || 
      ['#7cb5ec', '#434348', '#90ed7d', '#f7a35c', '#8085e9', '#f15c80', '#e4d354', '#2b908f', '#f45b5b', '#91e8e1'];
    
    // Extract axis titles - handle both single object and array formats
    const xAxisOpts = Array.isArray(options.xAxis) ? options.xAxis[0] : options.xAxis;
    const yAxisOpts = Array.isArray(options.yAxis) ? options.yAxis[0] : options.yAxis;
    const xAxisTitle = (xAxisOpts as any)?.title?.text || '';
    const yAxisTitle = (yAxisOpts as any)?.title?.text || '';
    
    console.log('[PPTX Export] Raw chart type:', rawChartType, 'stacking:', stacking, 'isSupported:', chartTypeInfo.isSupported);
    console.log('[PPTX Export] isInverted:', isInverted, 'xAxisTitle:', xAxisTitle, 'yAxisTitle:', yAxisTitle);

    if (chartTypeInfo.pptxType === 'pie' || chartTypeInfo.pptxType === 'doughnut') {
      const s = chart.series.find((sr) => sr.visible !== false);
      if (!s || !s.data || s.data.length === 0) {
        console.log('[PPTX Export] buildChartData - pie/doughnut chart has no data');
        return null;
      }
      const labels = s.data.map((p: any, idx: number) => String(p.name || categories[idx] || `Slice ${idx + 1}`));
      const values = s.data.map((p: any) => (typeof p.y === 'number' ? p.y : Number(p.y) || 0));
      // Extract pie slice colors
      const colors = s.data.map((p: any, idx: number) => toHex(p.color || defaultColors[idx % defaultColors.length]));
      
      console.log('[PPTX Export] buildChartData - pie/doughnut labels:', labels, 'values:', values);
      return {
        chartTypeInfo,
        rawChartType,
        data: [{ name: s.name || 'Series', labels, values }],
        categories: labels,
        colors,
        isInverted,
        xAxisTitle,
        yAxisTitle,
        stacking,
      };
    }

    // For scatter charts - need x,y pairs
    if (chartTypeInfo.pptxType === 'scatter') {
      const seriesColors: string[] = [];
      const seriesData = chart.series
        .filter((s) => s.visible !== false && s.data && s.data.length > 0)
        .map((s, seriesIdx) => {
          // For scatter, extract x,y pairs
          const values = (s.data || []).map((p: any) => {
            if (typeof p.y === 'number') return p.y;
            if (Array.isArray(p) && p.length >= 2) return p[1];
            return Number(p.y) || 0;
          });
          const labels = (s.data || []).map((p: any, idx: number) => {
            if (typeof p.x === 'number') return String(p.x);
            if (Array.isArray(p) && p.length >= 1) return String(p[0]);
            return categories[idx] || `${idx + 1}`;
          });
          
          const seriesColor = (s as any).color || (s.options as any)?.color || defaultColors[seriesIdx % defaultColors.length];
          seriesColors.push(toHex(seriesColor));
          
          return {
            name: s.name || `Series ${seriesIdx + 1}`,
            labels,
            values,
          };
        })
        .filter((d) => d.values && d.values.length > 0);

      if (!seriesData.length) return null;
      
      return {
        chartTypeInfo,
        rawChartType,
        data: seriesData,
        categories: seriesData[0]?.labels || [],
        colors: seriesColors,
        isInverted,
        xAxisTitle,
        yAxisTitle,
        stacking,
      };
    }

    // For bar/line/area charts - extract series with their colors
    const seriesColors: string[] = [];
    const seriesData = chart.series
      .filter((s) => s.visible !== false && s.data && s.data.length > 0)
      .map((s, seriesIdx) => {
        const values = (s.data || []).map((p: any) => (typeof p.y === 'number' ? p.y : Number(p.y) || 0));
        // Generate labels if categories are empty
        const labels = categories.length > 0 
          ? categories 
          : values.map((_, idx) => `Point ${idx + 1}`);
        
        // Get series color
        const seriesColor = (s as any).color || (s.options as any)?.color || defaultColors[seriesIdx % defaultColors.length];
        seriesColors.push(toHex(seriesColor));
        
        return {
          name: s.name || `Series ${seriesIdx + 1}`,
          labels,
          values,
        };
      })
      .filter((d) => d.values && d.values.length > 0);

    console.log('[PPTX Export] buildChartData - seriesData count:', seriesData.length, 'colors:', seriesColors);

    if (!seriesData.length) {
      console.log('[PPTX Export] buildChartData - no valid series data');
      return null;
    }
    
    return { 
      chartTypeInfo,
      rawChartType,
      data: seriesData, 
      categories: seriesData[0]?.labels || [],
      colors: seriesColors,
      isInverted,
      xAxisTitle,
      yAxisTitle,
      stacking,
    };
  } catch (err) {
    console.error('[PPTX Export] buildChartData error:', err);
    return null;
  }
};

// Load pptxgenjs via CDN only (avoid bundling node:fs deps)
const loadPptx = async (): Promise<any> => {
  if ((window as any).PptxGenJS) return (window as any).PptxGenJS;
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
  script.async = true;
  await new Promise((resolve, reject) => {
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });
  if ((window as any).PptxGenJS) return (window as any).PptxGenJS;
  throw new Error('PptxGenJS not available after CDN load');
};

export const exportDashboardPPTXEditable = async (chartRefs: ChartRef[], fileName = 'Dashboard') => {
  console.log('[PPTX Export] Starting editable PPTX export with', chartRefs.length, 'charts');
  
  if (!chartRefs || chartRefs.length === 0) {
    console.warn('[PPTX Export] No charts to export');
    alert('No charts available to export');
    return;
  }
  
  // Ensure charts are ready
  for (const ref of chartRefs) {
    if (!ref.chart && ref.containerElement) {
      ref.chart = await getChartWithRetry(ref.containerElement);
    }
  }

  let PPTX: any;
  try {
    PPTX = await loadPptx();
    console.log('[PPTX Export] PptxGenJS loaded:', PPTX);
    console.log('[PPTX Export] typeof PPTX:', typeof PPTX);
    console.log('[PPTX Export] PPTX.default:', PPTX?.default);
  } catch (err) {
    console.error('[PPTX Export] Failed to load PptxGenJS:', err);
    alert('PPTX export requires pptxgenjs. Please ensure internet access or that pptxgenjs is installed.');
    throw err;
  }

  // PptxGenJS from CDN: window.PptxGenJS is the constructor directly (a function)
  let pptx: any;
  if (typeof PPTX === 'function') {
    console.log('[PPTX Export] PPTX is a function, calling new PPTX()');
    pptx = new PPTX();
  } else if (PPTX && typeof PPTX.default === 'function') {
    console.log('[PPTX Export] PPTX.default is a function, calling new PPTX.default()');
    pptx = new PPTX.default();
  } else if (PPTX && typeof PPTX === 'object') {
    // Maybe it's already an instance or has a different structure
    console.log('[PPTX Export] PPTX is an object, checking for constructor');
    const Ctor = PPTX.PptxGenJS || PPTX.default || PPTX;
    pptx = typeof Ctor === 'function' ? new Ctor() : PPTX;
  } else {
    throw new Error('PptxGenJS loaded but cannot find constructor');
  }
  
  console.log('[PPTX Export] Created pptx instance:', pptx);
  console.log('[PPTX Export] pptx.addSlide:', typeof pptx?.addSlide);
  const slideMargin = 0.4;

  for (const ref of chartRefs) {
    const slide = pptx.addSlide();
    slide.addText(ref.title || ref.chartId, { x: slideMargin, y: slideMargin, fontSize: 18, bold: true });

    try {
      console.log(`[PPTX Export] Processing card ${ref.chartId}, type: ${ref.type}`);
      
      if (ref.type === 'chart' && ref.chart) {
        const mapped = buildChartData(ref.chart);
        console.log(`[PPTX Export] Chart data mapped:`, mapped ? {
          chartType: mapped.chartTypeInfo.pptxType,
          isSupported: mapped.chartTypeInfo.isSupported,
          rawType: mapped.rawChartType,
          seriesCount: mapped.data.length,
          stacking: mapped.stacking
        } : null);
        
        // Check if chart type is supported for native rendering
        const shouldUseNativeChart = mapped?.chartTypeInfo.isSupported === true;
        
        // Validate chart data before adding
        const isValidChartData = mapped && 
          mapped.data && 
          Array.isArray(mapped.data) && 
          mapped.data.length > 0 &&
          mapped.data.every((d: any) => 
            d.name && 
            Array.isArray(d.labels) && 
            d.labels.length > 0 &&
            Array.isArray(d.values) && 
            d.values.length > 0 &&
            d.labels.length === d.values.length
          );
        
        if (shouldUseNativeChart && isValidChartData) {
          try {
            // Get the pptxgenjs chart type constant
            const typeInfo = mapped.chartTypeInfo;
            let pptxChartType: string;
            
            switch (typeInfo.pptxType) {
              case 'pie':
                pptxChartType = pptx.ChartType?.pie || 'pie';
                break;
              case 'doughnut':
                pptxChartType = pptx.ChartType?.doughnut || 'doughnut';
                break;
              case 'line':
                pptxChartType = pptx.ChartType?.line || 'line';
                break;
              case 'area':
                pptxChartType = pptx.ChartType?.area || 'area';
                break;
              case 'scatter':
                pptxChartType = pptx.ChartType?.scatter || 'scatter';
                break;
              case 'bar':
              default:
                pptxChartType = pptx.ChartType?.bar || 'bar';
                break;
            }
            
            // Determine bar direction from mapping or inversion
            const barDirection = typeInfo.barDir || (mapped.isInverted ? 'bar' : 'col');
            
            console.log(`[PPTX Export] Native chart: ${pptxChartType}, barDir: ${barDirection}, barGrouping: ${typeInfo.barGrouping}`);
            console.log(`[PPTX Export] Axis titles - cat: "${mapped.xAxisTitle}", val: "${mapped.yAxisTitle}"`);
            console.log(`[PPTX Export] Colors:`, mapped.colors);
            
            // Build chart options with exact colors and axis settings
            const chartOptions: any = {
              x: slideMargin,
              y: 0.9,
              w: 9,
              h: 4.5,
              showTitle: false,
              showLegend: true,
              legendPos: 'b',
              // Apply extracted colors
              chartColors: mapped.colors,
              // Additional styling
              showValue: false,
            };
            
            // Add bar-specific options
            if (typeInfo.pptxType === 'bar') {
              chartOptions.barDir = barDirection;
              if (typeInfo.barGrouping && typeInfo.barGrouping !== 'clustered') {
                chartOptions.barGrouping = typeInfo.barGrouping;
              }
            }
            
            // Remove all grid lines
            chartOptions.catGridLine = { style: 'none' };
            chartOptions.valGridLine = { style: 'none' };
            
            // Add axis titles if present
            if (mapped.xAxisTitle) {
              chartOptions.catAxisTitle = mapped.xAxisTitle;
              chartOptions.catAxisTitleColor = '333333';
              chartOptions.catAxisTitleFontSize = 10;
            }
            if (mapped.yAxisTitle) {
              chartOptions.valAxisTitle = mapped.yAxisTitle;
              chartOptions.valAxisTitleColor = '333333';
              chartOptions.valAxisTitleFontSize = 10;
            }
            
            // Axis label formatting
            chartOptions.catAxisLabelColor = '333333';
            chartOptions.catAxisLabelFontSize = 9;
            chartOptions.valAxisLabelColor = '333333';
            chartOptions.valAxisLabelFontSize = 9;
            
            slide.addChart(pptxChartType, mapped.data, chartOptions);
            console.log(`[PPTX Export] ✓ Added native ${typeInfo.pptxType} chart for ${ref.chartId}`);
            continue;
          } catch (chartErr) {
            console.warn(`[PPTX Export] Native chart failed for ${ref.chartId}, falling back to image:`, chartErr);
          }
        } else if (mapped && !mapped.chartTypeInfo.isSupported) {
          console.log(`[PPTX Export] Chart type "${mapped.rawChartType}" not supported in pptxgenjs, using image fallback`);
        } else {
          console.log(`[PPTX Export] Invalid chart data for ${ref.chartId}, falling back to image`);
        }
        
        // Fallback to image if chart type is unsupported or data mapping failed
        console.log(`[PPTX Export] Capturing chart as image for ${ref.chartId}`);
        const dataUrl = await captureChartAsPng(ref.chart);
        if (dataUrl) {
          // Load image to get actual dimensions
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = dataUrl;
          });
          
          // Slide dimensions (default layout is 10" x 7.5")
          const slideWidth = 10;
          const slideHeight = 7.5;
          const margin = 0.5;
          const titleHeight = 0.8;
          
          const availableWidth = slideWidth - (margin * 2);
          const availableHeight = slideHeight - titleHeight - (margin * 2);
          const contentY = titleHeight + margin;
          
          const imgAspect = (img.width && img.height) ? img.width / img.height : 1.5;
          const areaAspect = availableWidth / availableHeight;
          
          let finalWidth: number;
          let finalHeight: number;
          
          if (imgAspect > areaAspect) {
            finalWidth = availableWidth;
            finalHeight = finalWidth / imgAspect;
          } else {
            finalHeight = availableHeight;
            finalWidth = finalHeight * imgAspect;
          }
          
          const xPos = (slideWidth - finalWidth) / 2;
          const yPos = contentY + (availableHeight - finalHeight) / 2;
          
          slide.addImage({ 
            data: dataUrl, 
            x: xPos,
            y: yPos,
            w: finalWidth,
            h: finalHeight
          });
          console.log(`[PPTX Export] ✓ Added chart image (fallback) for ${ref.chartId}`);
          continue;
        }
      }

      // Handle table type with native PPTX table
      if (ref.type === 'table' && ref.tableData && ref.tableData.columns.length > 0 && ref.tableData.rows.length > 0) {
        console.log(`[PPTX Export] Creating native table for ${ref.chartId}, columns: ${ref.tableData.columns.length}, rows: ${ref.tableData.rows.length}`);
        
        try {
          const slideWidth = 10;
          const margin = 0.4;
          const titleHeight = 0.7;
          const availableWidth = slideWidth - (margin * 2);
          
          // Build table data with max 50 rows per slide
          const { rows: tableRows, hasMore } = buildPptxTableData(ref.tableData, 50);
          
          if (tableRows.length > 1) { // At least header + 1 data row
            // Calculate column widths
            const colWidths = calculateColumnWidths(
              ref.tableData.columns, 
              ref.tableData.rows, 
              availableWidth
            );
            
            // Add table to slide
            slide.addTable(tableRows, {
              x: margin,
              y: titleHeight + margin,
              w: availableWidth,
              colW: colWidths,
              border: { pt: 0.5, color: 'CBD5E1' },
              fontFace: 'Arial',
              autoPage: true,
              autoPageRepeatHeader: true,
              autoPageLineWeight: 0.5,
            });
            
            // Add note if there are more rows
            if (hasMore) {
              slide.addText(`Showing first 50 of ${ref.tableData.rows.length} rows`, {
                x: margin,
                y: 6.8,
                fontSize: 8,
                color: '64748B',
                italic: true,
              });
            }
            
            console.log(`[PPTX Export] ✓ Added native table for ${ref.chartId}`);
            continue;
          }
        } catch (tableErr) {
          console.warn(`[PPTX Export] Native table failed for ${ref.chartId}, falling back to image:`, tableErr);
        }
      }

      // HTML or fallback to image
      if (ref.containerElement) {
        console.log(`[PPTX Export] Capturing element as image for ${ref.chartId}`);
        const dataUrl = await captureElementAsPng(ref.containerElement);
        if (dataUrl) {
          // Load image to get actual dimensions
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = dataUrl;
          });
          
          // Slide dimensions (default layout is 10" x 7.5")
          const slideWidth = 10;
          const slideHeight = 5;
          const margin = 0.5;
          const titleHeight = 0.8;
          
          // Available area for content
          const availableWidth = slideWidth - (margin * 2);
          const availableHeight = slideHeight - titleHeight - (margin * 2);
          const contentY = titleHeight + margin;
          
          // Calculate scaled dimensions maintaining aspect ratio
          const imgAspect = (img.width && img.height) ? img.width / img.height : 1.5;
          const areaAspect = availableWidth / availableHeight;
          
          let finalWidth: number;
          let finalHeight: number;
          
          if (imgAspect > areaAspect) {
            finalWidth = availableWidth;
            finalHeight = finalWidth / imgAspect;
          } else {
            finalHeight = availableHeight;
            finalWidth = finalHeight * imgAspect;
          }
          
          // Center horizontally within slide
          const xPos = (slideWidth - finalWidth) / 2;
          // Center vertically within available area
          const yPos = contentY + (availableHeight - finalHeight) / 2;
          
          console.log(`[PPTX Export] Image: ${img.width}x${img.height}, final=${finalWidth.toFixed(2)}x${finalHeight.toFixed(2)}`);
          
          slide.addImage({ 
            data: dataUrl, 
            x: xPos,
            y: yPos,
            w: finalWidth,
            h: finalHeight
          });
          console.log(`[PPTX Export] ✓ Added element image for ${ref.chartId}`);
        } else {
          slide.addText('Content unavailable', { x: slideMargin, y: 1.2, fontSize: 14, color: '888888' });
        }
      } else {
        slide.addText('Content unavailable', { x: slideMargin, y: 1.2, fontSize: 14, color: '888888' });
      }
    } catch (err) {
      console.error('[PPTX Export] Failed for card', ref.chartId, err);
      slide.addText('Export failed for this card', { x: slideMargin, y: 1.2, fontSize: 14, color: 'ff0000' });
    }
  }

  const outputFileName = `${fileName.replace(/[^a-z0-9]/gi, '_')}.pptx`;
  console.log('[PPTX Export] Writing file:', outputFileName);
  
  try {
    await pptx.writeFile({ fileName: outputFileName });
    console.log('[PPTX Export] File written successfully');
  } catch (writeErr) {
    console.error('[PPTX Export] writeFile failed, trying alternative method:', writeErr);
    // Fallback: try the older API signature
    await pptx.writeFile(outputFileName);
  }
};


