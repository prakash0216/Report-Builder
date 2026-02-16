import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../config/api.config';

const API_BASE = `${API_BASE_URL}/api`;

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

type ErrorType = 'dashboard_not_found' | 'view_not_found' | 'network_error' | null;

interface DashboardContextType {
  // Dashboard info
  dashboardId: number | null;
  dashboardSlug: string | null;
  dashboardName: string;
  
  // View info
  viewId: number | null;
  viewSlug: string | null;
  viewName: string;
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  errorType: ErrorType;
  
  // Refresh function
  refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType>({
  dashboardId: null,
  dashboardSlug: null,
  dashboardName: '',
  viewId: null,
  viewSlug: null,
  viewName: '',
  isLoading: true,
  error: null,
  errorType: null,
  refresh: async () => {},
});

export const useDashboardContext = () => useContext(DashboardContext);

interface DashboardProviderProps {
  children: React.ReactNode;
}

// Helper: fetch with retry for transient failures
async function fetchWithRetry(url: string, retries: number = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      // If we got a valid HTTP response (even 404), return it — no retry needed
      if (response.ok || response.status === 404) {
        return response;
      }
      // Server error (500, 502, 503, etc.) — retry
      if (attempt < retries) {
        console.warn(`Retrying ${url} (attempt ${attempt + 1}/${retries}) — status ${response.status}`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      return response;
    } catch (err) {
      // Network error (fetch itself failed) — retry
      if (attempt < retries) {
        console.warn(`Retrying ${url} (attempt ${attempt + 1}/${retries}) — network error`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  // Should never reach here, but satisfy TypeScript
  return fetch(url);
}

export const DashboardProvider: React.FC<DashboardProviderProps> = ({ children }) => {
  const { dashboardName: dashboardSlugParam, viewName: viewSlugParam } = useParams<{
    dashboardName?: string;
    viewName?: string;
  }>();

  const [dashboardId, setDashboardId] = useState<number | null>(null);
  const [dashboardSlug, setDashboardSlug] = useState<string | null>(null);
  const [dashboardName, setDashboardName] = useState<string>('');
  const [viewId, setViewId] = useState<number | null>(null);
  const [viewSlug, setViewSlug] = useState<string | null>(null);
  const [viewName, setViewName] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<ErrorType>(null);

  // Track the current fetch to avoid stale updates on rapid navigation
  const fetchIdRef = useRef(0);

  const fetchContext = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    setError(null);
    setErrorType(null);

    try {
      // If no dashboard slug, we're at root (dashboard management)
      if (!dashboardSlugParam) {
        setDashboardId(null);
        setDashboardSlug(null);
        setDashboardName('');
        setViewId(null);
        setViewSlug(null);
        setViewName('');
        setIsLoading(false);
        return;
      }

      // Fetch dashboard info with retry
      const dashboardResponse = await fetchWithRetry(`${API_BASE}/dashboards/${dashboardSlugParam}`);
      
      // Bail out if a newer fetch has started (user navigated away)
      if (currentFetchId !== fetchIdRef.current) return;

      let dashboardData;
      try {
        dashboardData = await dashboardResponse.json();
      } catch {
        // Response wasn't valid JSON (server error page, etc.)
        console.error(`Invalid JSON response for dashboard: "${dashboardSlugParam}"`);
        setError('Server returned an invalid response. Please try again.');
        setErrorType('network_error');
        setIsLoading(false);
        return;
      }

      if (!dashboardData.success || !dashboardData.dashboard) {
        console.error(`Dashboard not found: "${dashboardSlugParam}"`);
        setError(`Dashboard "${dashboardSlugParam}" not found`);
        setErrorType('dashboard_not_found');
        setIsLoading(false);
        return;
      }

      setDashboardId(dashboardData.dashboard.id);
      setDashboardSlug(dashboardData.dashboard.slug);
      setDashboardName(dashboardData.dashboard.name);

      // If we have a view slug, fetch view info
      if (viewSlugParam) {
        const viewResponse = await fetchWithRetry(
          `${API_BASE}/dashboards/${dashboardSlugParam}/views/${viewSlugParam}`
        );
        
        // Bail out if a newer fetch has started
        if (currentFetchId !== fetchIdRef.current) return;

        let viewData;
        try {
          viewData = await viewResponse.json();
        } catch {
          console.error(`Invalid JSON response for view: "${viewSlugParam}"`);
          setError('Server returned an invalid response. Please try again.');
          setErrorType('network_error');
          setIsLoading(false);
          return;
        }

        if (viewData.success && viewData.view) {
          setViewId(viewData.view.id);
          setViewSlug(viewData.view.slug);
          setViewName(viewData.view.name);
        } else {
          console.error(`View not found: "${viewSlugParam}" in dashboard "${dashboardSlugParam}"`);
          setError(`View "${viewSlugParam}" not found`);
          setErrorType('view_not_found');
        }
      } else {
        setViewId(null);
        setViewSlug(null);
        setViewName('');
      }
    } catch (err) {
      // Bail out if a newer fetch has started
      if (currentFetchId !== fetchIdRef.current) return;
      console.error('Error fetching dashboard context:', err);
      setError('Failed to load dashboard context');
      setErrorType('network_error');
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [dashboardSlugParam, viewSlugParam]);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const value: DashboardContextType = {
    dashboardId,
    dashboardSlug,
    dashboardName,
    viewId,
    viewSlug,
    viewName,
    isLoading,
    error,
    errorType,
    refresh: fetchContext,
  };

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export default DashboardContext;

