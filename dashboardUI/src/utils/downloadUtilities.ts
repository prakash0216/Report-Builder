import Highcharts from 'highcharts';
// @ts-ignore
import html2canvas from 'html2canvas';
// @ts-ignore
import jsPDF from 'jspdf';

// Optional PPT dependency is loaded dynamically in exportAllAsPPT
// to avoid hard dependency when not needed.

export type ChartContentType = 'chart' | 'html' | 'table' | 'tableChart';

export interface ChartRef {
  chart: Highcharts.Chart | null;
  chartId: string;
  title: string;
  type: ChartContentType;
  htmlContent?: string;
  containerElement?: HTMLElement;
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
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',
      scale: Math.max(2, (window.devicePixelRatio || 1)) * 1.5,
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: -window.scrollY,
      width: rect.width,
      height: rect.height,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('captureElementAsPng failed', err);
    return null;
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
  await waitForChartsReady(chartRefs);
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  for (let i = 0; i < chartRefs.length; i++) {
    const ref = chartRefs[i];
    try {
      let dataUrl: string | undefined;
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
            dataUrl = canvas.toDataURL('image/png');
            resolve(null);
          };
          img.onerror = reject;
          img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
        });
      } else if (ref.containerElement) {
        const shot = await captureElementAsPng(ref.containerElement);
        dataUrl = shot || undefined;
      }

      if (!dataUrl) continue;

      const img = new Image();
      await new Promise((resolve) => {
        img.onload = () => {
          const ratio = (pageWidth - margin * 2) / img.width;
          const imgHeight = img.height * ratio;
          if (y + imgHeight > pageHeight - margin) {
            pdf.addPage();
            y = margin;
          }
          pdf.text(ref.title || `Chart ${i + 1}`, margin, y);
          y += 6;
          pdf.addImage(dataUrl!, 'PNG', margin, y, pageWidth - margin * 2, imgHeight);
          y += imgHeight + 10;
          resolve(null);
        };
        img.src = dataUrl!;
      });
    } catch (err) {
      console.warn('PDF export failed for', ref.chartId, err);
    }
  }

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
  try {
    return await loadPptxFromCdn();
  } catch {
    try {
      // @ts-ignore - fallback to bundled browser build if available
      const mod = await import(/* webpackChunkName: "pptxgen" */ 'pptxgenjs/dist/pptxgen.bundle.js');
      return (mod as any).default || mod;
    } catch (err) {
      throw err;
    }
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

  const pptx = new PPTX.default();
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

  await pptx.writeFile(`${fileName.replace(/[^a-z0-9]/gi, '_')}.pptx`);
};

