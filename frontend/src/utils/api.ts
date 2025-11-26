import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Centralized fetch wrapper that handles authentication and redirects on 401
 */
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();
  const userEmail = localStorage.getItem('userEmail');

  console.log(`📡 [API] ${options.method || 'GET'} ${endpoint}`);
  console.log(`📡 [API] User: ${userEmail || 'none'}`);

  // Add Authorization header if token exists
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    console.log(`📡 [API] Token: ${token.substring(0, 20)}...`);
  } else {
    console.log('⚠️  [API] No token available');
  }

  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  console.log(`📡 [API] Response: ${response.status} ${response.statusText}`);

  // Note: 401 handling is done by fetchInterceptor (global window.fetch wrapper)
  // The interceptor will automatically attempt token refresh and retry the request

  return response;
};

/**
 * Helper for JSON requests
 */
export const apiRequest = async <T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  const response = await apiFetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || errorData.message || `API request failed: ${response.statusText}`) as any;
    error.status = response.status;
    throw error;
  }

  return response.json();
};
