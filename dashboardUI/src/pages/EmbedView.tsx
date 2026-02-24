import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useRecoilState } from 'recoil';
import { authState } from '../recoil/AuthState';
import {
  Box,
  Paper,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Avatar,
  CircularProgress,
  Breadcrumbs,
  Link,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  LibraryBooks as LibraryBooksIcon,
  Storage as StorageIcon,
  Functions as FunctionsIcon,
  Description as DocsIcon,
  Help as HelpIcon,
  OpenInNew as OpenInNewIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ChevronRight as ChevronRightIcon,
  Download as DownloadIcon,
  Add as AddIcon,
  NavigateNext as NavigateNextIcon,
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/api.config';

const API_BASE = API_BASE_URL || '';

// ─── Tableau script loader ─────────────────────────────────────

let tableauScriptPromise: Promise<void> | null = null;

function loadTableauScript(serverBase: string): Promise<void> {
  if (customElements.get('tableau-viz')) return Promise.resolve();
  if (tableauScriptPromise) return tableauScriptPromise;

  const scriptUrl = `${serverBase}/javascripts/api/tableau.embedding.3.latest.min.js`;
  if (document.querySelector(`script[src="${scriptUrl}"]`)) {
    tableauScriptPromise = Promise.resolve();
    return tableauScriptPromise;
  }

  tableauScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = scriptUrl;
    script.onload = () => resolve();
    script.onerror = () => {
      tableauScriptPromise = null;
      reject(new Error(`Failed to load Tableau script from ${serverBase}`));
    };
    document.head.appendChild(script);
  });

  return tableauScriptPromise;
}

// ─── Tableau URL helpers ───────────────────────────────────────

function parseTableauUrl(url: string): {
  serverBase: string;
  site: string;
  workbook: string;
  sheet: string;
} | null {
  try {
    const parsed = new URL(url);
    const serverBase = `${parsed.protocol}//${parsed.host}`;
    let pathname = parsed.hash
      ? parsed.hash.replace(/^#\/?/, '/')
      : parsed.pathname;

    pathname = pathname.replace(/\/trusted\/(?:[^/]+\/)?(?=t\/|views\/)/, '/');

    const siteMatch = pathname.match(/\/(?:t|site)\/([^/]+)\/views\/([^/?#&]+)(?:\/([^/?#&]+))?/);
    if (siteMatch) {
      return {
        serverBase,
        site: decodeURIComponent(siteMatch[1]),
        workbook: decodeURIComponent(siteMatch[2]),
        sheet: siteMatch[3] ? decodeURIComponent(siteMatch[3]) : '',
      };
    }

    const defaultMatch = pathname.match(/\/views\/([^/?#&]+)(?:\/([^/?#&]+))?/);
    if (defaultMatch) {
      return {
        serverBase,
        site: '',
        workbook: decodeURIComponent(defaultMatch[1]),
        sheet: defaultMatch[2] ? decodeURIComponent(defaultMatch[2]) : '',
      };
    }
  } catch { /* invalid URL */ }
  return null;
}

function sanitizeSheetForUrl(name: string): string {
  return name.replace(/\s+/g, '').replace(/[&?#%]/g, '');
}

function buildTableauViewUrl(serverBase: string, site: string, workbook: string, sheet: string): string {
  const safeSheet = sanitizeSheetForUrl(sheet);
  const sheetPart = safeSheet ? `/${encodeURIComponent(safeSheet)}` : '';
  return site
    ? `${serverBase}/t/${encodeURIComponent(site)}/views/${encodeURIComponent(workbook)}${sheetPart}`
    : `${serverBase}/views/${encodeURIComponent(workbook)}${sheetPart}`;
}

// ─── Interfaces ────────────────────────────────────────────────

interface EmbedData {
  name: string;
  embedType: 'iframe' | 'tableau' | '';
  embedLink: string;
  dashboardName?: string;
  dashboardId?: string;
  isViewLevel?: boolean;
}

interface SiblingView {
  id: string;
  name: string;
  slug: string;
  embedType: '' | 'iframe' | 'tableau';
  embedLink: string;
}

interface TableauSheetTab {
  name: string;
  index: number;
  isAutoCreated?: boolean;
}

// ─── Component ─────────────────────────────────────────────────

const EmbedView: React.FC = () => {
  const { dashboardSlug } = useParams<{ dashboardSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewSlug = searchParams.get('view') || undefined;
  const syncRequested = searchParams.get('sync') === 'true';
  const syncRequestedRef = useRef(syncRequested);
  syncRequestedRef.current = syncRequested;
  const [auth] = useRecoilState(authState);
  const dashboardSlugRef = useRef(dashboardSlug);
  dashboardSlugRef.current = dashboardSlug;
  // Track whether a viewSlug change came from an internal tab switch (skip re-fetch)
  const internalTabSwitchRef = useRef(false);

  const [embedData, setEmbedData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Non-Tableau iframe
  const [iframeLoading, setIframeLoading] = useState(true);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  // Tableau Embedding API v3
  const [tableauReady, setTableauReady] = useState(false);
  const [tableauSheets, setTableauSheets] = useState<TableauSheetTab[]>([]);
  const [activeTableauSheet, setActiveTableauSheet] = useState<string>('');
  const vizMapRef = useRef<Map<string, HTMLElement>>(new Map());
  const [loadedSheets, setLoadedSheets] = useState<Set<string>>(new Set());
  const [trustedTicket, setTrustedTicket] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const [tableauParts, setTableauParts] = useState<{
    serverBase: string; site: string; workbook: string; sheet: string;
  } | null>(null);
  const tableauPartsRef = useRef(tableauParts);
  tableauPartsRef.current = tableauParts;
  const tableauPartsKey = tableauParts
    ? `${tableauParts.serverBase}|${tableauParts.site}|${tableauParts.workbook}|${tableauParts.sheet}`
    : '';

  // Sibling views from DB (custom + previously auto-created)
  const [siblingViews, setSiblingViews] = useState<SiblingView[]>([]);
  const siblingViewsRef = useRef<SiblingView[]>([]);
  siblingViewsRef.current = siblingViews;

  // ─── Fetch trusted ticket (stable ref — never triggers re-mount) ──

  const authEmailRef = useRef(auth.email);
  authEmailRef.current = auth.email;

  const fetchTrustedTicket = useCallback(async (site: string, serverBase: string): Promise<string | null> => {
    const username = authEmailRef.current || '';
    try {
      const params = new URLSearchParams({ username });
      if (serverBase) params.set('server', serverBase);
      const resp = await fetch(
        `${API_BASE}/api/tableau-ticket/${encodeURIComponent(site || 'MAAS')}?${params.toString()}`,
      );
      const data = await resp.json();
      if (data.ok && data.ticket_id) return data.ticket_id;
      console.error('Tableau ticket fetch failed:', data.error);
    } catch (err) {
      console.error('Error fetching Tableau ticket:', err);
    }
    return null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auto-create views in DB from discovered Tableau sheets ─

  const autoCreateViewsFromSheets = useCallback(async (
    dashboardId: string,
    sheets: { name: string }[],
    parts: { serverBase: string; site: string; workbook: string },
    existingViews: SiblingView[],
  ) => {
    const existingNames = new Set(existingViews.map(v => v.name.toLowerCase()));
    const newSheets = sheets.filter(s => !existingNames.has(s.name.toLowerCase()));

    if (newSheets.length > 0) {
      for (let i = 0; i < newSheets.length; i++) {
        const s = newSheets[i];
        const embedUrl = buildTableauViewUrl(parts.serverBase, parts.site, parts.workbook, s.name);
        try {
          await fetch(`${API_BASE}/api/dashboards/${dashboardId}/views`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: s.name,
              description: 'Auto-created from Tableau workbook',
              icon: 'view_module',
              is_default: existingViews.length === 0 && i === 0,
              display_order: existingViews.length + i,
              embedType: 'tableau',
              embedLink: embedUrl,
              iconType: 'text',
              iconText: (s.name || '').substring(0, 5),
            }),
          });
        } catch (err) {
          console.warn(`Failed to auto-create view "${s.name}":`, err);
        }
      }
    }

    // Mark dashboard as synced
    try {
      await fetch(`${API_BASE}/api/dashboards/${dashboardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableauSyncedAt: new Date().toISOString() }),
      });
    } catch { /* ignore */ }

    // Re-fetch views to update sibling list
    try {
      const slug = dashboardSlugRef.current;
      const resp = await fetch(`${API_BASE}/api/dashboards/${slug}/views`);
      const data = await resp.json();
      if (data.success && data.views) {
        setSiblingViews(data.views.map((v: any) => ({
          id: v.id.toString(),
          name: v.name,
          slug: v.slug,
          embedType: v.embed_type || v.embedType || '',
          embedLink: v.embed_link || v.embedLink || '',
        })));
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Fetch embed data from DB ──────────────────────────────

  // Track previous dashboardSlug to detect cross-dashboard navigation
  const prevDashboardSlugRef = useRef(dashboardSlug);

  useEffect(() => {
    // Skip re-fetch when viewSlug changed from an internal tab switch (CSS swap only)
    if (internalTabSwitchRef.current) {
      internalTabSwitchRef.current = false;
      return;
    }

    const isSameDashboard = prevDashboardSlugRef.current === dashboardSlug;
    prevDashboardSlugRef.current = dashboardSlug;

    const fetchEmbedData = async () => {
      // Only show full loading on first load or cross-dashboard navigation
      if (!isSameDashboard || !embedData) {
        setLoading(true);
      }
      setError(null);
      setResolvedSrc(null);
      setTableauReady(false);
      setTableauSheets([]);
      setActiveTableauSheet('');
      setLoadedSheets(new Set());
      setTrustedTicket(null);
      setTableauParts(null);
      setScriptLoaded(false);

      try {
        let resolved: EmbedData | null = null;
        let siblings: SiblingView[] = [];

        if (viewSlug) {
          // Navigated to a specific view — reuse siblings if same dashboard
          if (isSameDashboard && siblingViewsRef.current.length > 0) {
            siblings = siblingViewsRef.current;
          } else {
            const response = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}/views`);
            const data = await response.json();
            if (data.success && data.views) {
              siblings = data.views.map((v: any) => ({
                id: v.id.toString(),
                name: v.name,
                slug: v.slug,
                embedType: v.embed_type || v.embedType || '',
                embedLink: v.embed_link || v.embedLink || '',
              }));
              setSiblingViews(siblings);
            }
          }

          const view = siblings.find((v) => v.slug === viewSlug);
          if (view && view.embedType && view.embedLink) {
            const dashName = embedData?.dashboardName || dashboardSlug;
            const dashId = embedData?.dashboardId;
            if (!isSameDashboard || !dashId) {
              const dashResponse = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}`);
              const dashData = await dashResponse.json();
              resolved = {
                name: view.name,
                embedType: view.embedType,
                embedLink: view.embedLink,
                dashboardName: dashData.success ? dashData.dashboard.name : dashboardSlug,
                dashboardId: dashData.success ? dashData.dashboard.id?.toString() : undefined,
                isViewLevel: true,
              };
            } else {
              resolved = {
                name: view.name,
                embedType: view.embedType,
                embedLink: view.embedLink,
                dashboardName: dashName,
                dashboardId: dashId,
                isViewLevel: true,
              };
            }
          } else if (!view) {
            setError('View not found');
          } else {
            setError('No embed link configured for this view');
          }
        } else {
          // Dashboard-level embed (first visit or no views yet)
          const response = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}`);
          const data = await response.json();

          if (data.success && data.dashboard) {
            const dashboard = data.dashboard;
            const embedType = dashboard.embed_type || dashboard.embedType;
            const embedLink = dashboard.embed_link || dashboard.embedLink;

            if (embedType && embedLink) {
              resolved = {
                name: dashboard.name,
                embedType,
                embedLink,
                dashboardId: dashboard.id?.toString(),
              };
            } else {
              setError('No embed link configured for this dashboard');
            }

            try {
              const viewsResp = await fetch(`${API_BASE}/api/dashboards/${dashboardSlug}/views`);
              const viewsData = await viewsResp.json();
              if (viewsData.success && viewsData.views) {
                siblings = viewsData.views.map((v: any) => ({
                  id: v.id.toString(),
                  name: v.name,
                  slug: v.slug,
                  embedType: v.embed_type || v.embedType || '',
                  embedLink: v.embed_link || v.embedLink || '',
                }));
                setSiblingViews(siblings);
              }
            } catch { /* ignore */ }
          } else {
            setError('Dashboard not found');
          }
        }

        if (resolved) {
          setEmbedData(resolved);

          if (resolved.embedType === 'tableau') {
            const parts = parseTableauUrl(resolved.embedLink);
            if (parts) {
              setTableauParts(parts);
              const ticket = await fetchTrustedTicket(parts.site, parts.serverBase);
              setTrustedTicket(ticket);
            } else {
              setError('Could not parse Tableau URL');
            }
          } else {
            setResolvedSrc(resolved.embedLink);
          }
        }
      } catch (err) {
        console.error('Error fetching embed data:', err);
        setError('Failed to load embed data');
      } finally {
        setLoading(false);
      }
    };

    fetchEmbedData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardSlug, viewSlug]);

  // ─── Load Tableau Embedding API v3 script ──────────────────

  const tableauServerBase = tableauParts?.serverBase || '';

  useEffect(() => {
    if (embedData?.embedType !== 'tableau' || !tableauServerBase) return;
    setScriptLoaded(false);

    let cancelled = false;
    loadTableauScript(tableauServerBase)
      .then(() => { if (!cancelled) setScriptLoaded(true); })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError(`Failed to load Tableau Embedding API from ${tableauServerBase}`);
      });

    return () => { cancelled = true; };
  }, [embedData?.embedType, tableauServerBase]);

  // ─── Helper: build trusted URL for a sheet ────────────────────
  const buildTrustedUrl = useCallback(
    (ticket: string, parts: { serverBase: string; site: string; workbook: string }, sheetName: string) => {
      const safeSheet = sanitizeSheetForUrl(sheetName);
      const sheetPart = safeSheet ? `/${encodeURIComponent(safeSheet)}` : '';
      const safeWorkbook = encodeURIComponent(parts.workbook);
      return parts.site
        ? `${parts.serverBase}/trusted/${ticket}/t/${encodeURIComponent(parts.site)}/views/${safeWorkbook}${sheetPart}`
        : `${parts.serverBase}/trusted/${ticket}/views/${safeWorkbook}${sheetPart}`;
    }, [],
  );

  // ─── Helper: create a wrapped <tableau-viz> element ─────────
  // Uses opacity instead of visibility so Tableau iframes fully
  // render in the background (visibility:hidden can defer rendering).
  const createVizElement = useCallback(
    (id: string, visible: boolean): HTMLElement => {
      const wrapper = document.createElement('div');
      wrapper.id = `${id}-wrapper`;
      wrapper.style.position = 'absolute';
      wrapper.style.top = '0';
      wrapper.style.left = '0';
      wrapper.style.width = '100%';
      wrapper.style.height = '100%';
      wrapper.style.opacity = visible ? '1' : '0';
      wrapper.style.zIndex = visible ? '1' : '0';
      wrapper.style.pointerEvents = visible ? 'auto' : 'none';

      const el = document.createElement('tableau-viz') as any;
      el.id = id;
      el.setAttribute('hide-tabs', 'true');
      el.setAttribute('toolbar', 'bottom');
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.display = 'block';

      wrapper.appendChild(el);
      return wrapper;
    }, [],
  );

  // ─── Mount initial viz, discover sheets, preload all others ──

  useEffect(() => {
    if (!scriptLoaded || !tableauPartsKey || !trustedTicket) return;
    const parts = tableauPartsRef.current;
    if (!parts) return;

    const container = document.getElementById('tableau-viz-container');
    if (!container) return;
    container.innerHTML = '';
    vizMapRef.current.clear();
    setLoadedSheets(new Set());

    let cancelled = false;
    const { serverBase, site, workbook, sheet } = parts;

    const initialUrl = buildTrustedUrl(trustedTicket, { serverBase, site, workbook }, sheet);
    const initialSheetName = sheet || '__initial__';
    const wrapper = createVizElement('tableau-embed-primary', true);
    const vizChild = wrapper.querySelector('tableau-viz') as any;

    const isViewLevel = !!embedData?.isViewLevel;

    // Register primary wrapper immediately so switching always works
    vizMapRef.current.set(initialSheetName, wrapper);

    vizChild.addEventListener('firstinteractive', () => {
      if (cancelled) return;

      setLoadedSheets(prev => new Set(prev).add(initialSheetName));

      let discoveredSheets: TableauSheetTab[] = [];
      let activeName = initialSheetName;

      try {
        const wb = vizChild.workbook;
        if (wb) {
          if (isViewLevel) {
            activeName = wb.activeSheet?.name || sheet || initialSheetName;
            discoveredSheets = [{ name: activeName, index: 0 }];
          } else {
            const sheetsInfo = wb.publishedSheetsInfo || [];
            discoveredSheets = sheetsInfo
              .filter((s: any) => !s.isHidden)
              .map((s: any, idx: number) => ({ name: s.name, index: idx }));
            activeName = wb.activeSheet?.name || sheet || discoveredSheets[0]?.name || '';
          }

          if (activeName !== initialSheetName) {
            vizMapRef.current.delete(initialSheetName);
            vizMapRef.current.set(activeName, wrapper);
            setLoadedSheets(prev => {
              const next = new Set(prev);
              next.delete(initialSheetName);
              next.add(activeName);
              return next;
            });
          }
        }
      } catch (e) {
        console.warn('Could not read workbook sheets:', e);
      }

      setTableauSheets(discoveredSheets);
      setActiveTableauSheet(activeName);
      setTableauReady(true);

      // Library-level: sync views if requested
      if (!isViewLevel && syncRequestedRef.current && embedData?.dashboardId && discoveredSheets.length > 0) {
        autoCreateViewsFromSheets(
          embedData.dashboardId, discoveredSheets,
          { serverBase, site, workbook }, siblingViewsRef.current,
        ).then(() => {
          const slug = dashboardSlugRef.current;
          if (slug) navigate(`/${slug}`, { replace: true });
        });
        return;
      }

      // Build preload targets:
      // - library-level: all discovered sheets except active
      // - view-level: sibling Tableau views that belong to same workbook
      const preloadSheetNames = !isViewLevel
        ? discoveredSheets
            .map(s => s.name)
            .filter(name => name && name !== activeName)
        : Array.from(new Set(
            siblingViewsRef.current
              .filter(v => v.embedType === 'tableau' && !!v.embedLink)
              .map(v => parseTableauUrl(v.embedLink))
              .filter((p): p is { serverBase: string; site: string; workbook: string; sheet: string } => !!p)
              .filter(p =>
                p.serverBase === serverBase &&
                p.site === site &&
                p.workbook === workbook &&
                !!p.sheet &&
                p.sheet !== activeName,
              )
              .map(p => p.sheet),
          ));

      if (preloadSheetNames.length === 0) return;

      // Preload sequentially to avoid overwhelming Tableau with concurrent tickets/vizzes
      (async () => {
        for (let i = 0; i < preloadSheetNames.length; i++) {
          const sheetName = preloadSheetNames[i];
          if (cancelled) return;
          try {
            const tk = await fetchTrustedTicket(site, serverBase);
            if (!tk || cancelled) continue;

            const url = buildTrustedUrl(tk, { serverBase, site, workbook }, sheetName);
            const w = createVizElement(`tableau-embed-preload-${i}`, false);
            const child = w.querySelector('tableau-viz') as any;

            // Register wrapper immediately so tab switching can target it
            vizMapRef.current.set(sheetName, w);

            // Append first, then assign src to ensure connected callback fires
            container.appendChild(w);
            child.src = url;

            await new Promise<void>((resolve) => {
              const timeout = setTimeout(() => {
                console.warn(`Preload timeout for sheet "${sheetName}", moving on`);
                resolve();
              }, 30000);

              child.addEventListener('firstinteractive', () => {
                clearTimeout(timeout);
                if (!cancelled) {
                  setLoadedSheets(prev => new Set(prev).add(sheetName));
                }
                resolve();
              });

              child.addEventListener('vizloaderror', () => {
                clearTimeout(timeout);
                console.warn(`Preload failed for sheet "${sheetName}"`);
                resolve();
              });
            });
          } catch (err) {
            console.warn(`Failed to preload sheet "${sheetName}":`, err);
          }
        }
      })();
    });

    vizChild.addEventListener('vizloaderror', (e: any) => {
      console.error('Tableau viz load error:', e);
      setError('Failed to load Tableau dashboard. The trusted ticket may have expired.');
    });

    // Append to DOM, then set src
    container.appendChild(wrapper);
    vizChild.src = initialUrl;

    return () => {
      cancelled = true;
      container.innerHTML = '';
      vizMapRef.current.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded, tableauPartsKey, trustedTicket]);

  // ─── Switch Tableau sheet (instant CSS toggle, no reload) ───

  const switchTableauSheet = useCallback((sheetName: string) => {
    if (sheetName === activeTableauSheet) return;

    const isLoaded = loadedSheets.has(sheetName);

    if (isLoaded) {
      // Target sheet is ready — instant swap
      vizMapRef.current.forEach((el, name) => {
        const isTarget = name === sheetName;
        el.style.opacity = isTarget ? '1' : '0';
        el.style.zIndex = isTarget ? '1' : '0';
        el.style.pointerEvents = isTarget ? 'auto' : 'none';
      });
    }
    // If not loaded: keep current viz visible, overlay will show a spinner.
    // A useEffect below watches loadedSheets and performs the swap once ready.

    setActiveTableauSheet(sheetName);
  }, [activeTableauSheet, loadedSheets]);

  // ─── Deferred swap: once a pending sheet loads, reveal it ──

  useEffect(() => {
    if (!activeTableauSheet || !loadedSheets.has(activeTableauSheet)) return;

    // The active sheet just became ready — swap visibility now
    vizMapRef.current.forEach((el, name) => {
      const isTarget = name === activeTableauSheet;
      el.style.opacity = isTarget ? '1' : '0';
      el.style.zIndex = isTarget ? '1' : '0';
      el.style.pointerEvents = isTarget ? 'auto' : 'none';
    });
  }, [activeTableauSheet, loadedSheets]);

  // ─── Tab click handlers ────────────────────────────────────

  const handleTableauTabClick = (sheetName: string) => {
    switchTableauSheet(sheetName);
    internalTabSwitchRef.current = true;
    const matchingView = siblingViewsRef.current.find((v) => {
      if (v.embedType !== 'tableau' || !v.embedLink) return false;
      const parsed = parseTableauUrl(v.embedLink);
      return parsed?.sheet === sheetName;
    });
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (matchingView) {
        next.set('view', matchingView.slug);
      } else {
        next.delete('view');
      }
      return next;
    }, { replace: true });
  };

  const handleCustomViewTabClick = (view: SiblingView) => {
    // In view-level Tableau mode, sibling Tableau views from same workbook
    // should switch instantly without route navigation/new trusted ticket.
    if (isTableau && view.embedType === 'tableau' && view.embedLink) {
      const currentParts = tableauPartsRef.current;
      const targetParts = parseTableauUrl(view.embedLink);
      if (
        currentParts &&
        targetParts &&
        targetParts.serverBase === currentParts.serverBase &&
        targetParts.site === currentParts.site &&
        targetParts.workbook === currentParts.workbook
      ) {
        switchTableauSheet(targetParts.sheet);
        internalTabSwitchRef.current = true;
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          next.set('view', view.slug);
          return next;
        }, { replace: true });
        return;
      }
    }

    if (view.slug === viewSlug) return;
    if (view.embedType && view.embedLink) {
      navigate(`/${dashboardSlug}/embed?view=${view.slug}`);
    } else {
      navigate(`/${dashboardSlug}/${view.slug}`);
    }
  };

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen);

  const openInNewTab = () => {
    if (tableauParts) {
      const currentSheet = activeTableauSheet || tableauParts.sheet;
      window.open(buildTableauViewUrl(tableauParts.serverBase, tableauParts.site, tableauParts.workbook, currentSheet), '_blank');
    } else if (resolvedSrc) {
      window.open(resolvedSrc, '_blank');
    } else if (embedData?.embedLink) {
      window.open(embedData.embedLink, '_blank');
    }
  };

  const headerTitle = embedData?.dashboardName || embedData?.name || '';
  const isTableau = embedData?.embedType === 'tableau';
  const isLibraryLevel = isTableau && !embedData?.isViewLevel;
  const normalizeSheetName = (name?: string | null): string =>
    decodeURIComponent((name || '').trim()).replace(/\s+/g, '').toLowerCase();
  const effectiveActiveTableauSheet = activeTableauSheet || tableauParts?.sheet || tableauSheets[0]?.name || '';
  const isSameWorkbookTableauView = (view: SiblingView): boolean => {
    if (!isTableau || view.embedType !== 'tableau' || !view.embedLink) return false;
    const currentParts = tableauPartsRef.current;
    const targetParts = parseTableauUrl(view.embedLink);
    if (!currentParts || !targetParts) return false;
    return (
      targetParts.serverBase === currentParts.serverBase &&
      targetParts.site === currentParts.site &&
      targetParts.workbook === currentParts.workbook
    );
  };
  const getViewSheetName = (view: SiblingView): string | null => {
    if (!view.embedLink) return null;
    const parsed = parseTableauUrl(view.embedLink);
    return parsed?.sheet || null;
  };

  // ─── Render ────────────────────────────────────────────────

  // Full-page loading only when we have absolutely no data yet
  if (loading && !embedData && siblingViews.length === 0) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: '#3B82F6' }} />
      </Box>
    );
  }

  if (error && !embedData) {
    return (
      <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}>
        <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center', maxWidth: 400 }}>
          <Typography variant="h6" color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ bgcolor: '#3B82F6', '&:hover': { bgcolor: '#2563EB' } }}
          >
            Go Back
          </Button>
        </Paper>
      </Box>
    );
  }

  const showTabBar = isLibraryLevel
    ? (tableauSheets.length > 1 || siblingViews.some(v => v.embedType !== 'tableau'))
    : siblingViews.length > 1;

  return (
    <Box sx={{ display: 'flex', height: '100vh', bgcolor: '#F8FAFC', overflow: 'hidden' }}>
      {/* Left Icon Sidebar */}
      {!isFullscreen && (
        <Box
          sx={{
            width: 72, bgcolor: '#F8FAFC', borderRight: '1px solid #E5E7EB',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            py: 2, gap: 1, position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
          }}
        >
          <Box component="img" src="/RBI.png" alt="RBI" sx={{ width: 50, height: 50, objectFit: 'contain', mb: 2 }} />

          {[
            { label: 'Home', icon: <HomeIcon sx={{ fontSize: 22 }} />, nav: '/?nav=home' },
            { label: 'Libraries', icon: <LibraryBooksIcon sx={{ fontSize: 22 }} />, nav: '/?nav=libraries' },
            { label: 'Data', icon: <StorageIcon sx={{ fontSize: 22 }} />, nav: '/?nav=data' },
            { label: 'Functions', icon: <FunctionsIcon sx={{ fontSize: 22 }} />, nav: '/?nav=functions' },
          ].map(item => (
            <Tooltip key={item.label} title={item.label} placement="right">
              <Box
                onClick={() => navigate(item.nav)}
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer', py: 1, px: 0.5, borderRadius: 2, color: '#6B7280',
                  '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
                  transition: 'all 0.2s',
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>{item.label}</Typography>
              </Box>
            </Tooltip>
          ))}

          <Box sx={{ flex: 1 }} />

          {[
            { label: 'Docs', icon: <DocsIcon sx={{ fontSize: 22 }} /> },
            { label: 'Help', icon: <HelpIcon sx={{ fontSize: 22 }} /> },
          ].map(item => (
            <Tooltip key={item.label} title={item.label} placement="right">
              <Box
                sx={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  cursor: 'pointer', py: 1, px: 0.5, borderRadius: 2, color: '#6B7280',
                  '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' },
                  transition: 'all 0.2s',
                }}
              >
                {item.icon}
                <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25 }}>{item.label}</Typography>
              </Box>
            </Tooltip>
          ))}

          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 1 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: '#3B82F6', color: 'white', fontSize: '0.75rem', fontWeight: 600 }}>
              {auth.email ? auth.email[0].toUpperCase() : 'U'}
            </Avatar>
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, mt: 0.25, color: '#6B7280' }}>Account</Typography>
          </Box>
        </Box>
      )}

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1, ml: isFullscreen ? 0 : '72px',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          bgcolor: '#E5E7EB', transition: 'margin-left 0.3s ease',
          height: '100vh',
        }}
      >
        {/* ─── Top Header Bar ─── */}
        <Box sx={{ p: 2, pb: 0 }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FFFFFF', borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              px: 3, py: 1.5, border: '1px solid #E5E7EB',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'stretch', gap: 2 }}>
              <Box sx={{ width: 4, borderRadius: 1, bgcolor: '#3B82F6' }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 0.5 }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1F2937' }}>{headerTitle}</Typography>
                <Breadcrumbs
                  separator={<NavigateNextIcon sx={{ fontSize: 16, color: '#9CA3AF' }} />}
                  sx={{ '& .MuiBreadcrumbs-li': { lineHeight: 1 } }}
                >
                  <Link
                    underline="hover"
                    sx={{ fontSize: '0.8rem', color: '#6B7280', cursor: 'pointer', '&:hover': { color: '#3B82F6' } }}
                    onClick={() => navigate('/')}
                  >
                    Libraries
                  </Link>
                  <Link
                    underline="hover"
                    sx={{ fontSize: '0.8rem', color: '#6B7280', cursor: 'pointer', '&:hover': { color: '#3B82F6' } }}
                    onClick={() => navigate(`/${dashboardSlug}`)}
                  >
                    {headerTitle}
                  </Link>
                  {(() => {
                    const currentViewName = (viewSlug && siblingViews.find(v => v.slug === viewSlug)?.name)
                      || (isTableau && effectiveActiveTableauSheet)
                      || embedData?.name;
                    return currentViewName ? (
                      <Typography sx={{ fontSize: '0.8rem', color: '#3B82F6', fontWeight: 600 }}>
                        {currentViewName}
                      </Typography>
                    ) : null;
                  })()}
                </Breadcrumbs>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button onClick={openInNewTab} startIcon={<DownloadIcon />} variant="outlined" size="small"
                sx={{ color: '#6B7280', borderColor: '#E5E7EB', textTransform: 'none', fontWeight: 600,
                  '&:hover': { borderColor: '#3B82F6', color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) } }}>
                Download
              </Button>
              <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                <IconButton onClick={toggleFullscreen} size="small"
                  sx={{ color: '#6B7280', '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' } }}>
                  {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Open in new tab">
                <IconButton onClick={openInNewTab} size="small"
                  sx={{ color: '#6B7280', '&:hover': { bgcolor: alpha('#3B82F6', 0.1), color: '#3B82F6' } }}>
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>
        </Box>

        {/* ─── Tabs + Content Card ─── */}
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Paper
            elevation={0}
            sx={{
              bgcolor: '#FFFFFF', borderRadius: 3, border: '1px solid #E5E7EB',
              overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
            }}
          >
            {/* ─── Tab Bar ─── */}
            {showTabBar && (
              <Box
                sx={{
                  px: 2, py: 1, display: 'flex', alignItems: 'center',
                  borderBottom: '1px solid #E5E7EB', bgcolor: '#FFFFFF', flexShrink: 0,
                  overflowX: 'auto',
                  '&::-webkit-scrollbar': { height: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: '#D1D5DB', borderRadius: 2 },
                }}
              >
                {isLibraryLevel ? (
                  <>
                    {/* Library-level Tableau: discovered sheets as instant-switch tabs */}
                    {tableauSheets.map((sheet) => {
                      const isActive = normalizeSheetName(effectiveActiveTableauSheet) === normalizeSheetName(sheet.name);
                      return (
                        <Box
                          key={`tableau-${sheet.name}`}
                          onClick={() => handleTableauTabClick(sheet.name)}
                          sx={{
                            px: 2, py: 1, mr: 1,
                            cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap',
                            bgcolor: isActive ? alpha('#3B82F6', 0.1) : 'transparent',
                            color: isActive ? '#3B82F6' : '#6B7280',
                            fontWeight: isActive ? 600 : 500,
                            fontSize: '0.875rem',
                            borderBottom: isActive ? '3px solid #3B82F6' : '3px solid transparent',
                            transition: 'all 0.2s',
                            '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) },
                          }}
                        >
                          {sheet.name}
                        </Box>
                      );
                    })}

                    {/* Divider between Tableau sheets and custom views */}
                    {tableauSheets.length > 0 && siblingViews.some(v => v.embedType !== 'tableau') && (
                      <Box sx={{ width: 1, height: 24, bgcolor: '#E5E7EB', mx: 1, flexShrink: 0 }} />
                    )}

                    {/* Non-Tableau sibling views */}
                    {siblingViews.filter(v => v.embedType !== 'tableau').map((view) => (
                      <Box
                        key={`custom-${view.id}`}
                        onClick={() => handleCustomViewTabClick(view)}
                        sx={{
                          px: 2, py: 1, mr: 1,
                          cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap',
                          bgcolor: 'transparent', color: '#6B7280', fontWeight: 500, fontSize: '0.875rem',
                          borderBottom: '3px solid transparent', transition: 'all 0.2s',
                          '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) },
                        }}
                      >
                        {view.name}
                      </Box>
                    ))}

                    {/* Add View Button */}
                    <Tooltip title="Add View">
                      <IconButton
                        onClick={() => navigate(`/${dashboardSlug}`)}
                        size="small"
                        sx={{
                          ml: 0.5,
                          color: '#9CA3AF',
                          '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.1) },
                        }}
                      >
                        <AddIcon sx={{ fontSize: 18 }} />
                      </IconButton>
                    </Tooltip>
                  </>
                ) : (
                  /* View-level or non-Tableau: show all sibling views uniformly */
                  <>
                  {siblingViews.map((view) => {
                    const isCurrent = (isSameWorkbookTableauView(view) && effectiveActiveTableauSheet)
                      ? normalizeSheetName(getViewSheetName(view)) === normalizeSheetName(effectiveActiveTableauSheet)
                      : view.slug === viewSlug;
                    return (
                      <Box
                        key={view.id}
                        onClick={() => handleCustomViewTabClick(view)}
                        sx={{
                          px: 2, py: 1, mr: 1,
                          cursor: 'pointer', borderRadius: 2, whiteSpace: 'nowrap',
                          bgcolor: isCurrent ? alpha('#3B82F6', 0.1) : 'transparent',
                          color: isCurrent ? '#3B82F6' : '#6B7280',
                          fontWeight: isCurrent ? 600 : 500,
                          fontSize: '0.875rem',
                          borderBottom: isCurrent ? '3px solid #3B82F6' : '3px solid transparent',
                          transition: 'all 0.2s',
                          '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.05) },
                        }}
                      >
                        {view.name}
                      </Box>
                    );
                  })}
                  {/* Add View Button */}
                  <Tooltip title="Add View">
                    <IconButton
                      onClick={() => navigate(`/${dashboardSlug}`)}
                      size="small"
                      sx={{
                        ml: 0.5,
                        color: '#9CA3AF',
                        '&:hover': { color: '#3B82F6', bgcolor: alpha('#3B82F6', 0.1) },
                      }}
                    >
                      <AddIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  </Tooltip>
                  </>
                )}
              </Box>
            )}

            {/* ─── Content Area ─── */}
            <Box sx={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {/* Loading overlay — data fetch, initial Tableau load, or pending sheet switch */}
              {(loading
                || (isTableau && !tableauReady)
                || (isTableau && tableauReady && !!activeTableauSheet && !loadedSheets.has(activeTableauSheet))
              ) && (
                <Box sx={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column', gap: 2, bgcolor: '#F8FAFC', zIndex: 10,
                }}>
                  <CircularProgress sx={{ color: '#4F46E5' }} />
                  <Typography variant="body1" sx={{ color: '#6B7280', fontWeight: 500 }}>
                    Loading...
                  </Typography>
                </Box>
              )}

              {!isTableau && !loading && iframeLoading && embedData?.embedLink && (
                <Box sx={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column', gap: 2, bgcolor: '#F8FAFC', zIndex: 10,
                }}>
                  <CircularProgress sx={{ color: '#059669' }} />
                  <Typography variant="body1" sx={{ color: '#6B7280', fontWeight: 500 }}>
                    Loading embedded content...
                  </Typography>
                </Box>
              )}

              {/* Tableau Embedding API v3 container */}
              {isTableau && (
                <Box
                  id="tableau-viz-container"
                  sx={{
                    width: '100%',
                    flex: 1,
                    minHeight: 0,
                    position: 'relative',
                  }}
                />
              )}

              {/* Non-Tableau iframe */}
              {!isTableau && resolvedSrc && (
                <iframe
                  src={resolvedSrc}
                  title={embedData?.name || 'Embedded Content'}
                  style={{ width: '100%', flex: 1, border: 'none', display: 'block', minHeight: 0 }}
                  allowFullScreen
                  onLoad={() => setIframeLoading(false)}
                />
              )}

              {/* No embed URL */}
              {!isTableau && !resolvedSrc && !embedData?.embedLink && (
                <Box sx={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: 2, bgcolor: '#F8FAFC', minHeight: 300,
                }}>
                  <Typography variant="h6" sx={{ color: '#6B7280' }}>No embed URL configured</Typography>
                  <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}
                    sx={{ color: '#6B7280', borderColor: '#E5E7EB', textTransform: 'none', fontWeight: 600 }}>
                    Go Back
                  </Button>
                </Box>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default EmbedView;
