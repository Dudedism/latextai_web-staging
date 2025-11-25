import { logout, refreshAccessToken, getToken } from './auth';

/**
 * Global fetch interceptor that automatically handles token refresh on 401 errors
 * Call setupFetchInterceptor() once in your app initialization (main.tsx)
 */
export const setupFetchInterceptor = () => {
  const originalFetch = window.fetch;
  let isRefreshing = false;

  // Auth endpoints that legitimately return 401 for invalid credentials
  const authEndpoints = ['/api/login', '/api/signup', '/api/refresh'];

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    // Clone the response so we can read it without consuming it
    const clonedResponse = response.clone();

    // Get the URL to check if it's an auth endpoint
    const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
    const isAuthEndpoint = authEndpoints.some(endpoint => url.includes(endpoint));

    // Check for 401 Unauthorized (skip for auth endpoints - they legitimately return 401)
    if (clonedResponse.status === 401 && !isAuthEndpoint) {
      console.log('🚨 401 Unauthorized detected - attempting token refresh');

      // Prevent multiple simultaneous refresh attempts
      if (isRefreshing) {
        return response;
      }

      isRefreshing = true;

      try {
        // Try to refresh the token
        const refreshed = await refreshAccessToken();

        if (refreshed) {
          console.log('✅ Token refreshed successfully - retrying request');

          // Retry the original request with the new token
          const [url, options] = args;
          const newToken = getToken();

          // Update the Authorization header with the new token
          const newOptions = { ...options as RequestInit };
          newOptions.headers = {
            ...(newOptions.headers || {}),
            'Authorization': `Bearer ${newToken}`
          };

          isRefreshing = false;
          return await originalFetch(url, newOptions);
        } else {
          console.log('❌ Token refresh failed - redirecting to sign in');

          // Clear auth data
          logout();

          // Redirect to signin page
          window.location.href = '/signin';
        }
      } finally {
        isRefreshing = false;
      }
    }

    return response;
  };

  console.log('✅ Fetch interceptor initialized - will auto-refresh tokens on 401 errors');
};
