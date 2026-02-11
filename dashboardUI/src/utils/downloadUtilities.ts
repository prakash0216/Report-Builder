import Highcharts from 'highcharts';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import jsPDF from 'jspdf';

// Optional PPT dependency is loaded dynamically in exportAllAsPPT
// to avoid hard dependency when not needed.

export type ChartContentType = 'chart' | 'html' | 'table' | 'tableChart';

export interface TableData {
  columns: string[];
  rows: Array<Record<string, any>>;
}

// Table theme for styling - matches tableTypes.ts
export interface TableThemeForExport {
  headerBgColor: string;
  headerTextColor: string;
  rowBgColor: string;
  rowAltBgColor: string;
  rowTextColor: string;
  borderColor: string;
  cellPadding: 'compact' | 'normal' | 'comfortable';
  fontSize: 'small' | 'medium' | 'large';
}

export interface ChartRef {
  chart: Highcharts.Chart | null;
  chartId: string;
  title: string;
  type: ChartContentType;
  htmlContent?: string;
  containerElement?: HTMLElement;
  tableData?: TableData;
  tableTheme?: TableThemeForExport;
}

export interface ExportFilterSummaryItem {
  name: string;
  value: string;
}

export interface DashboardImageExportOptions {
  dashboardName?: string;
  viewName?: string;
  filters?: ExportFilterSummaryItem[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sanitizeFileName = (name: string) => name.replace(/[<>:"/\\|?*]/g, '').trim();

const ensureOpaqueCanvas = (sourceCanvas: HTMLCanvasElement, background = '#FFFFFF'): HTMLCanvasElement => {
  const opaqueCanvas = document.createElement('canvas');
  opaqueCanvas.width = sourceCanvas.width;
  opaqueCanvas.height = sourceCanvas.height;
  const ctx = opaqueCanvas.getContext('2d');
  if (!ctx) return sourceCanvas;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, opaqueCanvas.width, opaqueCanvas.height);
  ctx.drawImage(sourceCanvas, 0, 0);
  return opaqueCanvas;
};

const splitTextByWidth = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return ['All'];

  const words = normalized.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  const pushHardWrappedWord = (word: string) => {
    let segment = '';
    for (const char of word) {
      const test = `${segment}${char}`;
      if (ctx.measureText(test).width <= maxWidth) {
        segment = test;
      } else {
        if (segment) lines.push(segment);
        segment = char;
      }
    }
    return segment;
  };

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      currentLine = candidate;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = '';
    }

    if (ctx.measureText(word).width <= maxWidth) {
      currentLine = word;
      continue;
    }

    currentLine = pushHardWrappedWord(word);
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : ['All'];
};

const getExportMeta = (fileName: string, options?: DashboardImageExportOptions) => {
  const dashboardName = (options?.dashboardName || fileName || 'Dashboard').trim();
  const viewName = (options?.viewName || '').trim();
  const filters: ExportFilterSummaryItem[] = Array.isArray(options?.filters) ? (options?.filters || []) : [];
  const exportedAt = new Date().toLocaleString();
  return { dashboardName, viewName, filters, exportedAt };
};

const composeTableauStyleDashboardCanvas = (
  baseCanvas: HTMLCanvasElement,
  fallbackTitle: string,
  options?: DashboardImageExportOptions
): HTMLCanvasElement => {
  const { dashboardName: dashboardTitle, viewName, filters, exportedAt } = getExportMeta(fallbackTitle, options);

  const pagePadding = 24;
  const headerHeight = 96;
  const contentX = pagePadding;
  const contentY = headerHeight + pagePadding;
  const panelGap = filters.length > 0 ? 20 : 0;
  const panelWidth = filters.length > 0
    ? Math.min(360, Math.max(280, Math.floor(baseCanvas.width * 0.22)))
    : 0;
  const panelX = contentX + baseCanvas.width + panelGap;
  const panelY = contentY;

  // Estimate panel height from text so the panel looks neat and Tableau-like.
  let estimatedPanelHeight = 150;
  if (filters.length > 0) {
    const measureCanvas = document.createElement('canvas');
    const measureCtx = measureCanvas.getContext('2d');
    if (measureCtx) {
      estimatedPanelHeight = 62; // panel header + top spacing
      measureCtx.font = '12px Arial';
      const valueMaxWidth = panelWidth - 28;
      filters.forEach((filter) => {
        const lines = splitTextByWidth(measureCtx, filter.value || 'All', valueMaxWidth);
        estimatedPanelHeight += 15 + (lines.length * 17) + 6; // name + value lines + gap
      });
      estimatedPanelHeight += 16;
    }
  }

  const panelHeight = filters.length > 0
    ? Math.max(140, Math.min(baseCanvas.height, estimatedPanelHeight))
    : 0;

  const finalWidth = contentX + baseCanvas.width + (filters.length > 0 ? panelGap + panelWidth : 0) + pagePadding;
  const finalHeight = Math.max(
    contentY + baseCanvas.height + pagePadding,
    panelY + panelHeight + pagePadding
  );

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = finalWidth;
  finalCanvas.height = finalHeight;
  const ctx = finalCanvas.getContext('2d');
  if (!ctx) return baseCanvas;

  // Page background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, finalWidth, finalHeight);

  // Header strip
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, finalWidth, headerHeight);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight - 0.5);
  ctx.lineTo(finalWidth, headerHeight - 0.5);
  ctx.stroke();

  // Header text
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 30px Arial';
  ctx.fillText(dashboardTitle, pagePadding, 38);

  if (viewName) {
    ctx.fillStyle = '#334155';
    ctx.font = '600 18px Arial';
    ctx.fillText(`View: ${viewName}`, pagePadding, 64);
  }

  ctx.fillStyle = '#64748B';
  ctx.font = '12px Arial';
  ctx.fillText(`Exported: ${exportedAt}`, pagePadding, 84);

  // Main dashboard image frame
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(contentX - 1, contentY - 1, baseCanvas.width + 2, baseCanvas.height + 2);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(contentX - 1, contentY - 1, baseCanvas.width + 2, baseCanvas.height + 2);
  ctx.drawImage(baseCanvas, contentX, contentY);

  // Right-side filter panel (Tableau-like)
  if (filters.length > 0) {
    const panelBottom = panelY + panelHeight;
    const panelInnerX = panelX + 14;
    const panelInnerMaxWidth = panelWidth - 28;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeStyle = '#CBD5E1';
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);

    ctx.fillStyle = '#0F172A';
    ctx.font = '700 16px Arial';
    ctx.fillText('Applied Filters', panelInnerX, panelY + 24);

    ctx.strokeStyle = '#E2E8F0';
    ctx.beginPath();
    ctx.moveTo(panelInnerX, panelY + 34.5);
    ctx.lineTo(panelX + panelWidth - 14, panelY + 34.5);
    ctx.stroke();

    let cursorY = panelY + 52;
    for (let i = 0; i < filters.length; i++) {
      const filter = filters[i];
      if (cursorY + 28 > panelBottom - 10) {
        const remaining = filters.length - i;
        ctx.fillStyle = '#64748B';
        ctx.font = 'italic 12px Arial';
        ctx.fillText(`... ${remaining} more`, panelInnerX, panelBottom - 10);
        break;
      }

      const filterName = String(filter.name || `Filter ${i + 1}`).trim();
      const filterValue = String(filter.value || 'All').trim();

      ctx.fillStyle = '#334155';
      ctx.font = '600 12px Arial';
      ctx.fillText(filterName, panelInnerX, cursorY);
      cursorY += 15;

      ctx.fillStyle = '#475569';
      ctx.font = '12px Arial';
      const lines = splitTextByWidth(ctx, filterValue, panelInnerMaxWidth);
      for (const line of lines) {
        if (cursorY + 12 > panelBottom - 10) {
          ctx.fillStyle = '#64748B';
          ctx.font = 'italic 12px Arial';
          ctx.fillText('...', panelInnerX, panelBottom - 10);
          cursorY = panelBottom; // stop rendering further lines/filters
          break;
        }
        ctx.fillText(line, panelInnerX, cursorY);
        cursorY += 17;
      }

      if (cursorY >= panelBottom) {
        break;
      }
      cursorY += 6;
    }
  }

  return finalCanvas;
};

// 🔥 OPTIMIZED: Reduced retries and wait times for faster exports
const getChartWithRetry = async (container: HTMLElement, maxRetries = 3): Promise<Highcharts.Chart | null> => {
  for (let i = 0; i < maxRetries; i++) {
    const highchartsContainer = container.querySelector('.highcharts-container') as HTMLElement | null;
    if (highchartsContainer) {
      const chart = Highcharts.charts.find((ch: any) => ch?.renderTo === highchartsContainer) as Highcharts.Chart | null;
      if (chart) return chart;
    }
    // fallback: any chart whose renderTo is inside container
    const chart = Highcharts.charts.find((ch: any) => {
      const renderTo = ch?.renderTo;
      return renderTo && container.contains(renderTo);
    }) as Highcharts.Chart | null;
    if (chart) return chart;
    if (i < maxRetries - 1) await sleep(50); // Only wait between retries
  }
  return null;
};

// 🔥 OPTIMIZED: Minimal wait, parallel processing
const waitForChartsReady = async (chartRefs: ChartRef[]) => {
  // Charts should already be rendered, minimal wait
  await sleep(100);
  const promises = chartRefs
    .filter((r) => r.type === 'chart' && r.containerElement && !r.chart)
    .map(async (r) => {
      r.chart = await getChartWithRetry(r.containerElement!);
    });
  await Promise.all(promises);
};

/**
 * Capture any DOM element as PNG data URL
 * @param el - The element to capture
 * @param highQuality - If true, use higher scale for better quality (PDF/PPTX)
 */
const captureElementAsPng = async (el: HTMLElement, highQuality = false): Promise<string | null> => {
  try {
    const rect = el.getBoundingClientRect();
    
    // Skip if element has no dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('captureElementAsPng: element has no dimensions');
      return null;
    }
    
    // 🔥 FIX: Use scale 2 for high quality (PDF, PPTX), scale 1 for fast capture (images)
    const scale = highQuality ? 2 : 1;
    
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('captureElementAsPng failed', err);
    return null;
  }
};

/**
 * 🔥 NEW: Capture ONLY what's visible on screen for PDF export
 * Clips to scrollable parent viewport if element is inside a scroll container
 * @param el - The element to capture
 */
const captureVisibleAreaAsPng = async (el: HTMLElement): Promise<string | null> => {
  try {
    const rect = el.getBoundingClientRect();
    
    // Skip if element has no dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('captureVisibleAreaAsPng: element has no dimensions');
      return null;
    }
    
    // 🔥 Find scrollable parent (the parent card container with overflow:auto/scroll)
    let scrollParent: HTMLElement | null = el.parentElement;
    let foundScrollParent = false;
    while (scrollParent && !foundScrollParent) {
      const style = window.getComputedStyle(scrollParent);
      const hasOverflow = style.overflow === 'auto' || style.overflow === 'scroll' ||
                         style.overflowY === 'auto' || style.overflowY === 'scroll';
      const hasScroll = scrollParent.scrollHeight > scrollParent.clientHeight;
      
      // Also check for data-chart-id which indicates a dashboard card
      const isCard = scrollParent.hasAttribute('data-chart-id');
      
      if ((hasOverflow && hasScroll) || isCard) {
        foundScrollParent = true;
        break;
      }
      scrollParent = scrollParent.parentElement;
    }
    
    // Calculate visible bounds
    let captureX = 0;
    let captureY = 0;
    let captureWidth = rect.width;
    let captureHeight = rect.height;
    
    if (foundScrollParent && scrollParent) {
      const parentRect = scrollParent.getBoundingClientRect();
      
      // Calculate the visible portion within the scroll parent
      const visibleTop = Math.max(rect.top, parentRect.top);
      const visibleBottom = Math.min(rect.bottom, parentRect.bottom);
      const visibleLeft = Math.max(rect.left, parentRect.left);
      const visibleRight = Math.min(rect.right, parentRect.right);
      
      captureWidth = visibleRight - visibleLeft;
      captureHeight = visibleBottom - visibleTop;
      
      // Calculate offset within the element
      captureX = visibleLeft - rect.left;
      captureY = visibleTop - rect.top;
      
      console.log(`[PDF Capture] Scroll parent found: visible area ${captureWidth}x${captureHeight}px`);
    } else {
      console.log(`[PDF Capture] No scroll parent: full element ${captureWidth}x${captureHeight}px`);
    }
    
    // Capture with clipping
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: 2, // 2x for crisp text
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      x: captureX,
      y: captureY,
      width: captureWidth,
      height: captureHeight,
    });
    return canvas.toDataURL('image/png', 1.0);
  } catch (err) {
    console.warn('captureVisibleAreaAsPng failed', err);
    return null;
  }
};

/**
 * Export entire dashboard as a single image (png/jpeg)
 * Captures the full scrollable content of the dashboard
 */
export const exportDashboardAsImage = async (
  rootEl: HTMLElement,
  format: 'png' | 'jpeg',
  fileName: string,
  options?: DashboardImageExportOptions
) => {
  try {
    // Store original styles so we can restore them
    const originalOverflow = rootEl.style.overflow;
    const originalWidth = rootEl.style.width;
    const originalHeight = rootEl.style.height;
    const originalMaxHeight = rootEl.style.maxHeight;
    const originalPosition = rootEl.style.position;

    // Store original scroll position
    const originalScrollTop = window.scrollY;
    const originalScrollLeft = window.scrollX;
    
    // 🔥 FIX: Temporarily expand the root element to its full scroll dimensions
    // This ensures html2canvas can see ALL content, not just the visible viewport
    const scrollWidth = rootEl.scrollWidth;
    const scrollHeight = rootEl.scrollHeight;
    
    rootEl.style.overflow = 'visible';
    rootEl.style.width = `${scrollWidth}px`;
    rootEl.style.height = `${scrollHeight}px`;
    rootEl.style.maxHeight = 'none';
    
    // Scroll to top-left to capture from beginning
    window.scrollTo(0, 0);
    
    // Brief wait for layout to settle after style changes
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Re-measure after expansion (may have changed)
    const expandedWidth = rootEl.scrollWidth;
    const expandedHeight = rootEl.scrollHeight;
    
    // Cap to prevent canvas memory crashes
    const maxDimension = 10000;
    const width = Math.min(Math.ceil(expandedWidth), maxDimension);
    const height = Math.min(Math.ceil(expandedHeight), maxDimension);
    
    console.log(`[Export] Capturing dashboard: ${width}x${height} (scroll: ${scrollWidth}x${scrollHeight})`);
    
    const canvas = await html2canvas(rootEl, {
      backgroundColor: '#f8fafc',
      scale: 1,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: width,
      height: height,
      windowWidth: Math.max(width, window.innerWidth),
      windowHeight: Math.max(height, window.innerHeight),
      onclone: (clonedDoc: Document) => {
        // Force the cloned root element to its full scroll dimensions
        const allElements = clonedDoc.querySelectorAll('*');
        allElements.forEach((el) => {
          const htmlEl = el as HTMLElement;
          const style = htmlEl.style;
          const computedStyle = clonedDoc.defaultView?.getComputedStyle(htmlEl);
          
          // Remove overflow:hidden/auto from all containers so content is fully visible
          if (computedStyle?.overflow === 'hidden' || computedStyle?.overflow === 'auto' ||
              computedStyle?.overflowX === 'hidden' || computedStyle?.overflowY === 'hidden' ||
              computedStyle?.overflowX === 'auto' || computedStyle?.overflowY === 'auto') {
            style.overflow = 'visible';
            style.overflowX = 'visible';
            style.overflowY = 'visible';
          }
        });
        
        // Force all Highcharts containers to be visible in the clone
        const charts = clonedDoc.querySelectorAll('.highcharts-container');
        charts.forEach((chart) => {
          (chart as HTMLElement).style.overflow = 'visible';
        });
        // Make sure all card content is visible
        const cards = clonedDoc.querySelectorAll('[data-chart-id]');
        cards.forEach((card) => {
          (card as HTMLElement).style.overflow = 'visible';
        });
        // Ensure the react-grid-layout wrapper is also expanded
        const gridLayouts = clonedDoc.querySelectorAll('.react-grid-layout');
        gridLayouts.forEach((grid) => {
          const gridEl = grid as HTMLElement;
          gridEl.style.overflow = 'visible';
          gridEl.style.width = '100%';
        });
      },
      ignoreElements: (element: Element) => {
        // Ignore fixed positioned elements (headers, modals, etc.)
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed') return true;
        if (element.classList.contains('MuiMenu-root')) return true;
        if (element.classList.contains('MuiModal-root')) return true;
        if (element.classList.contains('MuiPopover-root')) return true;
        return false;
      },
    });

    // Restore original styles immediately
    rootEl.style.overflow = originalOverflow;
    rootEl.style.width = originalWidth;
    rootEl.style.height = originalHeight;
    rootEl.style.maxHeight = originalMaxHeight;
    rootEl.style.position = originalPosition;
    
    // Restore original scroll position
    window.scrollTo(originalScrollLeft, originalScrollTop);

    const composedCanvas = composeTableauStyleDashboardCanvas(canvas, fileName, options);
    const outputCanvas = format === 'jpeg'
      ? ensureOpaqueCanvas(composedCanvas, '#FFFFFF')
      : composedCanvas;

    const dataUrl =
      format === 'jpeg'
        ? outputCanvas.toDataURL('image/jpeg', 0.92)
        : outputCanvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `${sanitizeFileName(fileName)}.${format}`;
    link.href = dataUrl;
    link.click();
    
    console.log('[Export] Dashboard image exported successfully');
  } catch (err) {
    console.error('Dashboard image export failed:', err);
    // Attempt to restore styles even on error
    try {
      rootEl.style.overflow = '';
      rootEl.style.width = '';
      rootEl.style.height = '';
      rootEl.style.maxHeight = '';
    } catch { /* ignore */ }
    alert('Image export failed. The dashboard may be too large. Try exporting as PDF instead.');
  }
};

// Lazy-load XLSX browser build to avoid node:fs/node:https resolution issues
const loadXLSX = async (): Promise<any> => {
  // @ts-ignore - dynamic import of browser bundle
  const mod = await import(/* webpackChunkName: "xlsx" */ 'xlsx/dist/xlsx.full.min.js');
  return (mod as any).default || mod;
};

export const exportAllAsPNG = async (chartRefs: ChartRef[]) => {
  await waitForChartsReady(chartRefs);

  for (const ref of chartRefs) {
    try {
      if (ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
        if (!chart) continue;
        const svg = (chart as any).getSVG?.();
        if (!svg) continue;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const png = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `${ref.title || ref.chartId}.png`;
            link.href = png;
            link.click();
            resolve(null);
          };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        });
      } else if (ref.containerElement) {
        const png = await captureElementAsPng(ref.containerElement);
        if (!png) continue;
        const link = document.createElement('a');
        link.download = `${ref.title || ref.chartId}.png`;
        link.href = png;
        link.click();
      }
    } catch (err) {
      console.warn('PNG export failed for', ref.chartId, err);
    }
  }
};

export const exportAllAsJPEG = async (chartRefs: ChartRef[]) => {
  await waitForChartsReady(chartRefs);
  for (const ref of chartRefs) {
    try {
      if (ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
        if (!chart) continue;
        const svg = (chart as any).getSVG?.();
        if (!svg) continue;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            const jpeg = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `${ref.title || ref.chartId}.jpg`;
            link.href = jpeg;
            link.click();
            resolve(null);
          };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        });
      } else if (ref.containerElement) {
        const png = await captureElementAsPng(ref.containerElement);
        if (!png) continue;
        const img = new Image();
        img.src = png;
        await new Promise((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const jpeg = canvas.toDataURL('image/jpeg', 0.95);
            const link = document.createElement('a');
            link.download = `${ref.title || ref.chartId}.jpg`;
            link.href = jpeg;
            link.click();
            resolve(null);
          };
        });
      }
    } catch (err) {
      console.warn('JPEG export failed for', ref.chartId, err);
    }
  }
};

// 🔥 OPTIMIZED: Fast SVG export with better chart detection
export const exportAllAsSVG = async (chartRefs: ChartRef[], fileName = 'Dashboard') => {
  console.log('[SVG Export] Starting with', chartRefs.length, 'cards');
  let exported = 0;
  
  for (const ref of chartRefs) {
    try {
      if (ref.type !== 'chart') continue;
      const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement, 2) : null);
      if (!chart) {
        console.warn('[SVG Export] No chart found for', ref.chartId);
        continue;
      }
      const svg = (chart as any).getSVG?.();
      if (!svg) {
        console.warn('[SVG Export] getSVG failed for', ref.chartId);
        continue;
      }
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${fileName} - ${ref.title || ref.chartId}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      exported++;
    } catch (err) {
      console.warn('SVG export failed for', ref.chartId, err);
    }
  }
  console.log(`[SVG Export] Complete - exported ${exported} charts`);
};

// 🔥 OPTIMIZED: Fast PDF export with better handling of large charts
export const exportAllAsPDF = async (
  chartRefs: ChartRef[],
  fileName = 'Dashboard',
  options?: DashboardImageExportOptions
) => {
  console.log('[PDF Export] Starting with', chartRefs.length, 'cards');
  const { dashboardName, viewName, filters, exportedAt } = getExportMeta(fileName, options);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;
  let cardsExported = 0;

  // Add export summary block (Tableau-style metadata + applied filters)
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(dashboardName, margin, y + 4);
  y += 8;

  if (viewName) {
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`View: ${viewName}`, margin, y + 2);
    y += 6;
  }

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Exported: ${exportedAt}`, margin, y + 2);
  y += 6;

  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.text('Applied Filters', margin, y + 2);
  y += 5;

  const maxTextWidth = pageWidth - margin * 2;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  if (filters.length === 0) {
    pdf.text('All (no active filter restrictions)', margin, y + 2);
    y += 6;
  } else {
    for (const filter of filters) {
      const line = `${filter.name || 'Filter'}: ${filter.value || 'All'}`;
      const wrapped = (pdf as any).splitTextToSize(line, maxTextWidth) as string[];
      const textHeight = Math.max(4, wrapped.length * 4);
      if (y + textHeight > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(wrapped, margin, y + 2);
      y += textHeight + 1;
    }
  }
  y += 3;

  for (let i = 0; i < chartRefs.length; i++) {
    const ref = chartRefs[i];
    
    try {
      let dataUrl: string | undefined;
      
      // 🔥 FIX: Use html2canvas to capture only the visible portion of the card
      // This prevents blur from scaling very tall charts
      if (ref.containerElement) {
        const shot = await captureVisibleAreaAsPng(ref.containerElement);
        dataUrl = shot || undefined;
      }
      
      // Fallback to SVG for charts if container capture failed
      if (!dataUrl && ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement, 2) : null);
        if (chart) {
          const svg = (chart as any).getSVG?.();
          if (svg) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            await new Promise((resolve) => {
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                dataUrl = canvas.toDataURL('image/png');
                resolve(null);
              };
              img.onerror = () => resolve(null);
              img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            });
          }
        }
      }

      if (!dataUrl) continue;

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => {
          const imgRatio = img.width / img.height;
          const availableWidth = pageWidth - margin * 2;
          
          // 🔥 FIX: For tall charts (like Top 50 bar charts), allow multi-page
          let imgWidth = availableWidth;
          let imgHeight = imgWidth / imgRatio;
          
          // If image would be too tall for page, scale down or split
          const maxHeightPerPage = pageHeight - margin * 2 - 15; // Leave room for title
          
          if (imgHeight > maxHeightPerPage) {
            // Scale to fit page width but allow overflow to next page
            // For very tall charts, we'll just use what fits
            imgHeight = maxHeightPerPage;
          }
          
          // Check if we need a new page
          if (y + imgHeight + 15 > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          
          pdf.setFontSize(12);
          pdf.text(ref.title || `Card ${i + 1}`, margin, y + 4);
          y += 8;
          pdf.addImage(dataUrl!, 'PNG', margin, y, imgWidth, imgHeight);
          y += imgHeight + 8;
          cardsExported++;
          resolve(null);
        };
        img.onerror = () => resolve(null);
        img.src = dataUrl!;
      });
    } catch (err) {
      console.warn('[PDF Export] Failed for', ref.chartId, err);
    }
  }

  console.log(`[PDF Export] Complete - exported ${cardsExported} of ${chartRefs.length} cards`);
  pdf.save(`${sanitizeFileName(fileName)}.pdf`);
};

// 🔥 OPTIMIZED: Fast CSV export - no waiting, direct data extraction
export const exportAllAsCSV = async (
  chartRefs: ChartRef[],
  fileName = 'Dashboard',
  options?: DashboardImageExportOptions
) => {
  console.log('[CSV Export] Starting with', chartRefs.length, 'cards');
  const { dashboardName, viewName, filters, exportedAt } = getExportMeta(fileName, options);
  const toCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const sections: string[] = [];

  // Add export summary header
  sections.push(`${toCsvCell('Dashboard')},${toCsvCell(dashboardName)}`);
  sections.push(`${toCsvCell('View')},${toCsvCell(viewName || 'N/A')}`);
  sections.push(`${toCsvCell('Exported At')},${toCsvCell(exportedAt)}`);
  sections.push('');
  sections.push(`${toCsvCell('Applied Filters')}`);
  if (filters.length === 0) {
    sections.push(`${toCsvCell('All (no active filter restrictions)')}`);
  } else {
    sections.push(`${toCsvCell('Filter Name')},${toCsvCell('Value')}`);
    filters.forEach((filter) => {
      sections.push(`${toCsvCell(filter.name || 'Filter')},${toCsvCell(filter.value || 'All')}`);
    });
  }
  sections.push('');

  for (const ref of chartRefs) {
    try {
      const title = ref.title || ref.chartId;
      sections.push(`"--- ${title} ---"`);

      if (ref.type === 'chart') {
        // Try to get chart directly, minimal retry
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement, 2) : null);
        if (chart) {
          // First try getCSV
          let csv = (chart as any).getCSV?.();
          if (!csv || csv.trim().length < 5) {
            // Fallback: build CSV from series data
            const series = (chart as any).series || [];
            const xAxis = (chart as any).xAxis?.[0];
            const categories = xAxis?.categories || [];
            const rows: string[][] = [];
            
            // Header row
            const header: string[] = [];
            if (categories.length) header.push(xAxis?.title?.text || 'Category');
            series.forEach((s: any) => header.push(s.name || 'Series'));
            if (header.length) rows.push(header);
            
            // Data rows
            const maxLen = Math.max(categories.length, ...series.map((s: any) => s.data?.length || 0));
            for (let i = 0; i < maxLen; i++) {
              const row: string[] = [];
              if (categories.length) row.push(String(categories[i] ?? ''));
              series.forEach((s: any) => {
                const pt = s.data?.[i];
                if (pt && typeof pt === 'object' && pt.y !== undefined) row.push(String(pt.y));
                else row.push(String(pt ?? ''));
              });
              rows.push(row);
            }
            csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
          }
          sections.push(csv?.trim() || 'No Data');
        } else {
          sections.push('No Data');
        }
      } else if (ref.type === 'table' && ref.tableData) {
        // Use tableData directly if available
        const { columns, rows } = ref.tableData;
        const csvRows: string[][] = [columns];
        rows.forEach(row => {
          csvRows.push(columns.map(col => String(row[col] ?? '')));
        });
        const csv = csvRows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        sections.push(csv);
      } else if (ref.type === 'html' && ref.htmlContent) {
        // 🔥 FIX: Extract text content from HTML
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = ref.htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        sections.push(`"${textContent.replace(/"/g, '""').replace(/\n/g, ' ')}"`);
      } else if (ref.containerElement) {
        const table = ref.containerElement.querySelector('table');
        if (table) {
          const rows: string[][] = [];
          table.querySelectorAll('tr').forEach((tr) => {
            const row: string[] = [];
            tr.querySelectorAll('th,td').forEach((cell) => row.push(cell.textContent || ''));
            if (row.length) rows.push(row);
          });
          const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
          sections.push(csv || 'No Data');
        } else {
          // 🔥 FIX: Fallback to text content for non-table elements (HTML cards)
          const textContent = ref.containerElement.textContent || ref.containerElement.innerText || '';
          if (textContent.trim()) {
            sections.push(`"${textContent.trim().replace(/"/g, '""').replace(/\n/g, ' ')}"`);
          } else {
            sections.push('No Data');
          }
        }
      }
    } catch (err) {
      console.warn('CSV export failed for', ref.chartId, err);
      sections.push('Export Error');
    }
    sections.push(''); // blank line between sections
  }

  const finalCsv = sections.join('\n');
  const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `${sanitizeFileName(fileName)}.csv`;
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
  console.log('[CSV Export] Complete');
};

// 🔥 OPTIMIZED: Fast Excel export - minimal waiting, direct data extraction
export const exportAllAsExcel = async (
  chartRefs: ChartRef[],
  fileName = 'Dashboard',
  options?: DashboardImageExportOptions
) => {
  console.log('[Excel Export] Starting with', chartRefs.length, 'cards');
  const { dashboardName, viewName, filters, exportedAt } = getExportMeta(fileName, options);
  const XLSX: any = await loadXLSX();
  const workbook = XLSX.utils.book_new();

  // Summary sheet with export context + applied filters
  const summaryRows: any[][] = [
    ['Dashboard', dashboardName],
    ['View', viewName || 'N/A'],
    ['Exported At', exportedAt],
    [],
    ['Applied Filters'],
  ];
  if (filters.length === 0) {
    summaryRows.push(['All (no active filter restrictions)']);
  } else {
    summaryRows.push(['Filter Name', 'Value']);
    filters.forEach((filter) => {
      summaryRows.push([filter.name || 'Filter', filter.value || 'All']);
    });
  }
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  const usedSheetNames = new Set<string>(['Summary']);

  const getUniqueSheetName = (baseName: string) => {
    const normalized = (baseName || 'Sheet').substring(0, 31) || 'Sheet';
    let candidate = normalized;
    let suffix = 1;
    while (usedSheetNames.has(candidate)) {
      const token = `_${suffix}`;
      candidate = `${normalized.substring(0, Math.max(1, 31 - token.length))}${token}`;
      suffix++;
    }
    usedSheetNames.add(candidate);
    return candidate;
  };

  for (const ref of chartRefs) {
    try {
      let sheet: any = null;
      
      if (ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement, 2) : null);
        if (chart) {
          // Build from series data directly (faster than getCSV parsing)
          const series = (chart as any).series || [];
          const xAxis = (chart as any).xAxis?.[0];
          const categories = xAxis?.categories || [];
          const data: any[][] = [];
          const header: string[] = [];
          if (categories.length) header.push(xAxis?.title?.text || 'Category');
          series.forEach((s: any) => header.push(s.name || 'Series'));
          if (header.length) data.push(header);
          const maxLen = Math.max(categories.length, ...series.map((s: any) => s.data?.length || 0));
          for (let i = 0; i < maxLen; i++) {
            const row: any[] = [];
            if (categories.length) row.push(categories[i] ?? '');
            series.forEach((s: any) => {
              const pt = s.data?.[i];
              if (pt && typeof pt === 'object' && pt.y !== undefined) row.push(pt.y);
              else row.push(pt ?? '');
            });
            data.push(row);
          }
          sheet = XLSX.utils.aoa_to_sheet(data.length ? data : [['No Data']]);
        }
      } else if (ref.type === 'table' && ref.tableData) {
        // Use tableData directly (fastest)
        const { columns, rows } = ref.tableData;
        const data: any[][] = [columns];
        rows.forEach(row => {
          data.push(columns.map(col => row[col] ?? ''));
        });
        sheet = XLSX.utils.aoa_to_sheet(data);
      } else if (ref.type === 'html' && ref.htmlContent) {
        // 🔥 FIX: Extract text content from HTML for Excel
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = ref.htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        // Split by newlines to create rows
        const lines = textContent.split(/\n/).filter(line => line.trim());
        const data: any[][] = lines.length > 0 ? lines.map(line => [line.trim()]) : [['No Content']];
        sheet = XLSX.utils.aoa_to_sheet(data);
      } else if (ref.containerElement) {
        const table = ref.containerElement.querySelector('table');
        if (table) {
          sheet = XLSX.utils.table_to_sheet(table as HTMLTableElement);
        } else {
          // 🔥 FIX: Fallback to text content for non-table elements (HTML cards)
          const textContent = ref.containerElement.textContent || ref.containerElement.innerText || '';
          if (textContent.trim()) {
            const lines = textContent.split(/\n/).filter((line: string) => line.trim());
            const data: any[][] = lines.length > 0 ? lines.map((line: string) => [line.trim()]) : [['No Content']];
            sheet = XLSX.utils.aoa_to_sheet(data);
          }
        }
      }
      
      if (!sheet) sheet = XLSX.utils.aoa_to_sheet([['No Data']]);
      const safeName = (ref.title || ref.chartId).substring(0, 31).replace(/[\\/:*?[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, sheet, getUniqueSheetName(safeName || 'Sheet'));
    } catch (err) {
      console.warn('Excel export failed for', ref.chartId, err);
    }
  }
  XLSX.writeFile(workbook, `${sanitizeFileName(fileName)}.xlsx`);
  console.log('[Excel Export] Complete');
};

/**
 * Export all charts/HTML/table as PPTX (one slide per card)
 * Requires `pptxgenjs` dependency. If not installed, user will be prompted.
 */
// Track loading state to prevent multiple simultaneous loads
let pptxLoadPromiseUtil: Promise<any> | null = null;

// Load pptxgenjs via CDN at runtime to avoid bundling node:fs
const loadPptxFromCdn = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Return immediately if already loaded
    if ((window as any).PptxGenJS) return resolve((window as any).PptxGenJS);
    
    // Check if script tag already exists (from previous attempt)
    const existingScript = document.querySelector('script[src*="pptxgen"]');
    if (existingScript) {
      // Script exists but PptxGenJS not ready - wait for it
      const checkReady = (attempts = 0) => {
        if ((window as any).PptxGenJS) {
          resolve((window as any).PptxGenJS);
        } else if (attempts < 50) { // Wait up to 5 seconds
          setTimeout(() => checkReady(attempts + 1), 100);
        } else {
          reject(new Error('PptxGenJS not available after waiting'));
        }
      };
      checkReady();
      return;
    }
    
    // Load fresh script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
    script.async = true;
    script.id = 'pptxgenjs-script-util';
    
    script.onload = () => {
      // Wait a bit for script to initialize
      const checkReady = (attempts = 0) => {
        if ((window as any).PptxGenJS) {
          resolve((window as any).PptxGenJS);
        } else if (attempts < 20) {
          setTimeout(() => checkReady(attempts + 1), 100);
        } else {
          reject(new Error('PptxGenJS not available after load'));
        }
      };
      checkReady();
    };
    
    script.onerror = () => reject(new Error('Failed to load pptxgenjs from CDN'));
    document.body.appendChild(script);
  });
};

const loadPptx = async (): Promise<any> => {
  // Return immediately if already loaded
  if ((window as any).PptxGenJS) return (window as any).PptxGenJS;
  
  // If already loading, wait for existing promise
  if (pptxLoadPromiseUtil) return pptxLoadPromiseUtil;
  
  try {
    pptxLoadPromiseUtil = loadPptxFromCdn();
    const result = await pptxLoadPromiseUtil;
    pptxLoadPromiseUtil = null;
    return result;
  } catch (err) {
    pptxLoadPromiseUtil = null;
    throw err;
  }
};

export const exportAllAsPPT = async (chartRefs: ChartRef[], fileName = 'Dashboard') => {
  await waitForChartsReady(chartRefs);
  let PPTX: any;
  try {
    PPTX = await loadPptx();
  } catch (err) {
    alert('PPTX export requires pptxgenjs. Please ensure internet access or that pptxgenjs is installed.');
    return;
  }

  // PptxGenJS CDN exposes as window.PptxGenJS which is the constructor directly
  const pptx = typeof PPTX === 'function' ? new PPTX() : new (PPTX.default || PPTX)();
  const slideMargin = 0.5;

  for (const ref of chartRefs) {
    try {
      let dataUrl: string | null = null;
      
      // 🔥 FIX: Use high quality html2canvas capture for all content types in PPTX
      if (ref.containerElement) {
        dataUrl = await captureVisibleAreaAsPng(ref.containerElement);
      }
      
      // Fallback to SVG for charts if container capture failed
      if (!dataUrl && ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
        if (chart) {
          const svg = (chart as any).getSVG?.();
          if (svg) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            await new Promise((resolve, reject) => {
              img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                dataUrl = canvas.toDataURL('image/png');
                resolve(null);
              };
              img.onerror = reject;
              img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
            });
          }
        }
      }

      const slide = pptx.addSlide();
      slide.addText(ref.title || ref.chartId, { x: slideMargin, y: slideMargin, fontSize: 18, bold: true });

      if (dataUrl) {
        slide.addImage({
          data: dataUrl,
          x: slideMargin,
          y: 1.0,
          w: 10, // keep a reasonable width; height auto
          sizing: { type: 'contain', w: 10, h: 5.5 },
        });
      } else {
        slide.addText('No image available', { x: slideMargin, y: 1.2, fontSize: 14, color: '888888' });
      }
    } catch (err) {
      console.warn('PPT export failed for', ref.chartId, err);
    }
  }

  const outputFileName = `${sanitizeFileName(fileName)}.pptx`;
  try {
    await pptx.writeFile({ fileName: outputFileName });
  } catch {
    // Fallback: try the older API signature
    await pptx.writeFile(outputFileName);
  }
};

