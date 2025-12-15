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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const getChartWithRetry = async (container: HTMLElement, maxRetries = 8): Promise<Highcharts.Chart | null> => {
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
    await sleep(200);
  }
  return null;
};

const waitForChartsReady = async (chartRefs: ChartRef[]) => {
  // small delay to allow rendering
  await sleep(600);
  const promises = chartRefs
    .filter((r) => r.type === 'chart' && r.containerElement && !r.chart)
    .map(async (r) => {
      r.chart = await getChartWithRetry(r.containerElement!);
    });
  await Promise.all(promises);
};

/**
 * Capture any DOM element as PNG data URL
 */
const captureElementAsPng = async (el: HTMLElement): Promise<string | null> => {
  try {
    const rect = el.getBoundingClientRect();
    
    // Skip if element has no dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn('captureElementAsPng: element has no dimensions');
      return null;
    }
    
    // Scroll element into view to ensure it's rendered
    //@ts-ignore
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    await new Promise(resolve => setTimeout(resolve, 100));
    
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
    console.warn('captureElementAsPng failed', err);
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
  fileName: string
) => {
  try {
    // Store original scroll position
    const originalScrollTop = window.scrollY;
    const originalScrollLeft = window.scrollX;
    
    // Scroll to top to capture from beginning
    window.scrollTo(0, 0);
    
    // Brief wait for scroll to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get the full dimensions of the content
    const rect = rootEl.getBoundingClientRect();
    const scrollWidth = rootEl.scrollWidth || rect.width;
    const scrollHeight = rootEl.scrollHeight || rect.height;
    
    // Calculate dimensions - use full scroll dimensions but cap to prevent crashes
    const maxDimension = 8000; // Maximum canvas dimension to prevent crashes
    const width = Math.min(Math.ceil(scrollWidth), maxDimension);
    const height = Math.min(Math.ceil(scrollHeight), maxDimension);
    
    console.log(`[Export] Capturing dashboard: ${width}x${height}`);
    
    // Use scale of 1 to prevent memory issues with large dashboards
    const scale = 1;
    
    const canvas = await html2canvas(rootEl, {
      backgroundColor: '#f8fafc',
      scale: scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: width,
      height: height,
      windowWidth: width,
      windowHeight: height,
      // Clone the document and wait for images/SVGs to load
      onclone: (clonedDoc: Document) => {
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

    // Restore original scroll position
    window.scrollTo(originalScrollLeft, originalScrollTop);

    const dataUrl =
      format === 'jpeg'
        ? canvas.toDataURL('image/jpeg', 0.92)
        : canvas.toDataURL('image/png');

    const link = document.createElement('a');
    link.download = `${fileName.replace(/[^a-z0-9]/gi, '_')}.${format}`;
    link.href = dataUrl;
    link.click();
    
    console.log('[Export] Dashboard image exported successfully');
  } catch (err) {
    console.error('Dashboard image export failed:', err);
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

export const exportAllAsSVG = async (chartRefs: ChartRef[]) => {
  await waitForChartsReady(chartRefs);
  for (const ref of chartRefs) {
    try {
      if (ref.type !== 'chart') continue;
      const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
      if (!chart) continue;
      const svg = (chart as any).getSVG?.();
      if (!svg) continue;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `${ref.title || ref.chartId}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('SVG export failed for', ref.chartId, err);
    }
  }
};

export const exportAllAsPDF = async (chartRefs: ChartRef[], fileName = 'Dashboard') => {
  console.log('[PDF Export] Starting with', chartRefs.length, 'cards');
  await waitForChartsReady(chartRefs);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;
  let cardsExported = 0;

  for (let i = 0; i < chartRefs.length; i++) {
    const ref = chartRefs[i];
    console.log(`[PDF Export] Processing card ${ref.chartId}, type: ${ref.type}, hasContainer: ${!!ref.containerElement}`);
    
    try {
      let dataUrl: string | undefined;
      
      if (ref.type === 'chart') {
        // For chart type, try to get SVG first
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
        // Fallback to container capture if SVG failed
        if (!dataUrl && ref.containerElement) {
          console.log(`[PDF Export] Chart SVG failed for ${ref.chartId}, trying container capture`);
          const shot = await captureElementAsPng(ref.containerElement);
          dataUrl = shot || undefined;
        }
      } else {
        // For HTML/table/other types, capture the container element
        if (ref.containerElement) {
          console.log(`[PDF Export] Capturing container for ${ref.chartId} (type: ${ref.type})`);
          const shot = await captureElementAsPng(ref.containerElement);
          dataUrl = shot || undefined;
        }
      }

      if (!dataUrl) {
        console.warn(`[PDF Export] No image data for ${ref.chartId}, skipping`);
        continue;
      }

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => {
          const ratio = (pageWidth - margin * 2) / img.width;
          const imgHeight = Math.min(img.height * ratio, pageHeight - margin * 2 - 10); // Cap height to fit page
          if (y + imgHeight + 10 > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(ref.title || `Card ${i + 1}`, margin, y);
          y += 6;
          pdf.addImage(dataUrl!, 'PNG', margin, y, pageWidth - margin * 2, imgHeight);
          y += imgHeight + 10;
          cardsExported++;
          console.log(`[PDF Export] Added ${ref.chartId} to PDF`);
          resolve(null);
        };
        img.onerror = () => {
          console.warn(`[PDF Export] Failed to load image for ${ref.chartId}`);
          resolve(null);
        };
        img.src = dataUrl!;
      });
    } catch (err) {
      console.warn('[PDF Export] Failed for', ref.chartId, err);
    }
  }

  console.log(`[PDF Export] Complete - exported ${cardsExported} of ${chartRefs.length} cards`);
  pdf.save(`${fileName.replace(/[^a-z0-9]/gi, '_')}.pdf`);
};

export const exportAllAsCSV = async (chartRefs: ChartRef[]) => {
  await waitForChartsReady(chartRefs);
  const sections: string[] = [];

  for (const ref of chartRefs) {
    try {
      const title = ref.title || ref.chartId;
      sections.push(`"--- ${title} ---"`);

      if (ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
        if (!chart) continue;
        const csv = (chart as any).getCSV?.();
        if (csv && csv.trim().length > 0) {
          sections.push(csv.trim());
        } else {
          sections.push('No Data');
        }
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
          const text = ref.containerElement.innerText || '';
          sections.push(text.trim() || 'No Data');
        }
      }
    } catch (err) {
      console.warn('CSV export failed for', ref.chartId, err);
    }
    sections.push(''); // blank line between sections
  }

  const finalCsv = sections.join('\n');
  const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = 'dashboard.csv';
  link.href = url;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportAllAsExcel = async (chartRefs: ChartRef[], fileName = 'Dashboard') => {
  await waitForChartsReady(chartRefs);
  const XLSX: any = await loadXLSX();
  const workbook = XLSX.utils.book_new();

  for (const ref of chartRefs) {
    try {
      let sheet: any = null;
      if (ref.type === 'chart') {
        const chart = ref.chart || (ref.containerElement ? await getChartWithRetry(ref.containerElement) : null);
        if (chart) {
          let csv = (chart as any).getCSV?.();
          if (!csv || csv.length < 5) {
            // fallback: build from series
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
          } else {
            const lines = csv.split('\n').filter((l: string) => l.trim().length);
            const data = lines.map((line: string) => {
              const out: string[] = [];
              let cur = '';
              let inQ = false;
              for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (ch === '"') inQ = !inQ;
                else if (ch === ',' && !inQ) {
                  out.push(cur);
                  cur = '';
                } else cur += ch;
              }
              out.push(cur);
              return out;
            });
            sheet = XLSX.utils.aoa_to_sheet(data.length ? data : [['No Data']]);
          }
        }
      } else if (ref.containerElement) {
        const table = ref.containerElement.querySelector('table');
        if (table) {
          sheet = XLSX.utils.table_to_sheet(table as HTMLTableElement);
        } else {
          const text = ref.containerElement.innerText || '';
          const lines = text.split('\n').filter((l) => l.trim().length);
          sheet = XLSX.utils.aoa_to_sheet(lines.length ? lines.map((l) => [l]) : [['No Data']]);
        }
      }
      if (!sheet) sheet = XLSX.utils.aoa_to_sheet([['No Data']]);
      const safeName = (ref.title || ref.chartId).substring(0, 31).replace(/[\\/:*?[\]]/g, '_');
      XLSX.utils.book_append_sheet(workbook, sheet, safeName || 'Sheet');
    } catch (err) {
      console.warn('Excel export failed for', ref.chartId, err);
    }
  }
  XLSX.writeFile(workbook, `${fileName.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
};

/**
 * Export all charts/HTML/table as PPTX (one slide per card)
 * Requires `pptxgenjs` dependency. If not installed, user will be prompted.
 */
// Load pptxgenjs via CDN at runtime to avoid bundling node:fs
const loadPptxFromCdn = (): Promise<any> => {
  return new Promise((resolve, reject) => {
    if ((window as any).PptxGenJS) return resolve((window as any).PptxGenJS);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/pptxgenjs@4.0.1/dist/pptxgen.bundle.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).PptxGenJS) resolve((window as any).PptxGenJS);
      else reject(new Error('PptxGenJS not available after load'));
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

const loadPptx = async (): Promise<any> => {
  // CDN-only to avoid bundling node:fs dependencies
  if ((window as any).PptxGenJS) return (window as any).PptxGenJS;
  try {
    return await loadPptxFromCdn();
  } catch (err) {
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
      if (ref.type === 'chart') {
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
      } else if (ref.containerElement) {
        dataUrl = await captureElementAsPng(ref.containerElement);
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

  const outputFileName = `${fileName.replace(/[^a-z0-9]/gi, '_')}.pptx`;
  try {
    await pptx.writeFile({ fileName: outputFileName });
  } catch {
    // Fallback: try the older API signature
    await pptx.writeFile(outputFileName);
  }
};

