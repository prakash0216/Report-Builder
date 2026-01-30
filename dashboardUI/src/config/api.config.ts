// Centralized API configuration
// In development: uses http://localhost:8008 (from .env.development)
// In production: uses empty string for relative URLs (from .env.production)

export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

// Export a helper for building API URLs
export const getApiUrl = (endpoint: string): string => {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE_URL}${normalizedEndpoint}`;
};
