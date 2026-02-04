// Centralized API configuration
// In development with proxy: set REACT_APP_API_BASE_URL= (empty) so requests go to dev server (e.g. 8080) and get proxied to backend (3002).
// In production: empty string = relative URLs; or set full backend URL.

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL?.trim() ?? '';

// Export a helper for building API URLs
export const getApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
};
