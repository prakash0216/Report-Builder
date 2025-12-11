import Highcharts from 'highcharts';
// @ts-ignore
import html2canvas from 'html2canvas';
import { ChartRef } from './downloadUtilities';

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

const mapChartType = (t?: string): string => {
  if (!t) return 'column';
  const type = t.toLowerCase();
  if (['column', 'col'].includes(type)) return 'column';
  if (['bar'].includes(type)) return 'bar';
  if (['line', 'spline', 'areaspline'].includes(type)) return 'line';
  if (['area'].includes(type)) return 'area';
  if (['pie', 'donut', 'doughnut'].includes(type)) return 'pie';
  return 'column';
};

const buildChartData = (chart: Highcharts.Chart) => {
  try {
    const options = chart.options || {};
    const chartType = mapChartType(options.chart?.type || (chart.series?.[0] as any)?.type);
    
    // Get categories from xAxis
    let categories: string[] = [];
    if (Array.isArray(chart.xAxis) && chart.xAxis[0]?.categories?.length) {
      categories = chart.xAxis[0].categories as string[];
    }
    
    console.log('[PPTX Export] buildChartData - chartType:', chartType, 'categories:', categories);

    if (chartType === 'pie') {
      const s = chart.series.find((sr) => sr.visible !== false);
      if (!s || !s.data || s.data.length === 0) {
        console.log('[PPTX Export] buildChartData - pie chart has no data');
        return null;
      }
      const labels = s.data.map((p: any, idx: number) => String(p.name || categories[idx] || `Slice ${idx + 1}`));
      const values = s.data.map((p: any) => (typeof p.y === 'number' ? p.y : Number(p.y) || 0));
      console.log('[PPTX Export] buildChartData - pie labels:', labels, 'values:', values);
      return {
        chartType,
        data: [{ name: s.name || 'Series', labels, values }],
        categories: labels,
      };
    }

    // For bar/line/area charts
    const seriesData = chart.series
      .filter((s) => s.visible !== false && s.data && s.data.length > 0)
      .map((s, seriesIdx) => {
        const values = (s.data || []).map((p: any) => (typeof p.y === 'number' ? p.y : Number(p.y) || 0));
        // Generate labels if categories are empty
        const labels = categories.length > 0 
          ? categories 
          : values.map((_, idx) => `Point ${idx + 1}`);
        return {
          name: s.name || `Series ${seriesIdx + 1}`,
          labels,
          values,
        };
      })
      .filter((d) => d.values && d.values.length > 0);

    console.log('[PPTX Export] buildChartData - seriesData:', seriesData);

    if (!seriesData.length) {
      console.log('[PPTX Export] buildChartData - no valid series data');
      return null;
    }
    
    return { 
      chartType, 
      data: seriesData, 
      categories: seriesData[0]?.labels || [] 
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
      console.log(`[PPTX Export] Processing card ${ref.chartId}, type: ${ref.type}, hasChart: ${!!ref.chart}`);
      
      if (ref.type === 'chart' && ref.chart) {
        const mapped = buildChartData(ref.chart);
        console.log(`[PPTX Export] Chart data mapped:`, JSON.stringify(mapped, null, 2));
        
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
        
        if (isValidChartData) {
          try {
            // Map chart type to pptxgenjs chart type string
            const pptxChartType = mapped.chartType === 'pie' ? pptx.ChartType?.pie || 'pie' 
              : mapped.chartType === 'line' ? pptx.ChartType?.line || 'line'
              : mapped.chartType === 'area' ? pptx.ChartType?.area || 'area'
              : mapped.chartType === 'bar' ? pptx.ChartType?.bar || 'bar'
              : pptx.ChartType?.bar || 'bar'; // default to bar/column
            
            console.log(`[PPTX Export] Using chart type: ${pptxChartType}, data:`, mapped.data);
            
            slide.addChart(pptxChartType, mapped.data, {
              x: slideMargin,
              y: 0.9,
              w: 9,
              h: 4.5,
              showTitle: false,
              showLegend: true,
              legendPos: 'b',
            });
            console.log(`[PPTX Export] Added native chart for ${ref.chartId}`);
            continue;
          } catch (chartErr) {
            console.warn(`[PPTX Export] Native chart failed for ${ref.chartId}, falling back to image:`, chartErr);
          }
        } else {
          console.log(`[PPTX Export] Invalid chart data for ${ref.chartId}, falling back to image`);
        }
        
        // Fallback to image if chart data mapping failed or native chart failed
        console.log(`[PPTX Export] Capturing chart as image for ${ref.chartId}`);
        const dataUrl = await captureChartAsPng(ref.chart);
        if (dataUrl) {
          slide.addImage({ data: dataUrl, x: slideMargin, y: 0.9, w: 10, sizing: { type: 'contain', w: 10, h: 5.5 } });
          console.log(`[PPTX Export] Added chart image for ${ref.chartId}`);
          continue;
        }
      }

      // HTML/table or fallback to image
      if (ref.containerElement) {
        console.log(`[PPTX Export] Capturing element as image for ${ref.chartId}`);
        const dataUrl = await captureElementAsPng(ref.containerElement);
        if (dataUrl) {
          slide.addImage({ data: dataUrl, x: slideMargin, y: 0.9, w: 9, sizing: { type: 'contain', w: 9, h: 4.5 } });
          console.log(`[PPTX Export] Added element image for ${ref.chartId}`);
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


