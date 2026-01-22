import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = 'http://localhost:3002/api';

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

  const fetchContext = useCallback(async () => {
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

      // Fetch dashboard info
      const dashboardResponse = await fetch(`${API_BASE}/dashboards/${dashboardSlugParam}`);
      const dashboardData = await dashboardResponse.json();

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
        const viewResponse = await fetch(
          `${API_BASE}/dashboards/${dashboardSlugParam}/views/${viewSlugParam}`
        );
        const viewData = await viewResponse.json();

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
      console.error('Error fetching dashboard context:', err);
      setError('Failed to load dashboard context');
      setErrorType('network_error');
    } finally {
      setIsLoading(false);
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

