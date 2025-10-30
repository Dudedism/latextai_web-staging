import { logout } from './auth';

/**
 * Global fetch interceptor that automatically redirects to /signin on 401 errors
 * Call setupFetchInterceptor() once in your app initialization (main.tsx)
 */
export const setupFetchInterceptor = () => {
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    // Clone the response so we can read it without consuming it
    const clonedResponse = response.clone();

    // Check for 401 Unauthorized
    if (clonedResponse.status === 401) {
      console.log('🚨 401 Unauthorized detected - redirecting to sign in');

      // Clear auth data
      logout();

      // Redirect to signin page
      window.location.href = '/signin';
    }

    return response;
  };

  console.log('✅ Fetch interceptor initialized - will redirect on 401 errors');
};
