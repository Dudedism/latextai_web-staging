import { getToken, logout } from './auth';

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

/**
 * Centralized fetch wrapper that handles authentication and redirects on 401
 */
export const apiFetch = async (
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = getToken();

  // Add Authorization header if token exists
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Make the request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized - redirect to signin
  if (response.status === 401) {
    console.log('401 Unauthorized - redirecting to sign in');
    logout();
    window.location.href = '/signin';
  }

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
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
};
