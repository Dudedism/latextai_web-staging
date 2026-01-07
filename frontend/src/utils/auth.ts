// Auth event system - allows fetchInterceptor to notify React components
type AuthEventListener = () => void;
const authEventListeners: Set<AuthEventListener> = new Set();

export const onAuthCleared = (listener: AuthEventListener): (() => void) => {
  authEventListeners.add(listener);
  return () => authEventListeners.delete(listener);
};

const emitAuthCleared = () => {
  authEventListeners.forEach(listener => listener());
};

// Token getters
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

export const getRefreshToken = (): string | null => {
  return localStorage.getItem('refreshToken');
};

export const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  const currentEmail = localStorage.getItem('userEmail');

  console.log(`🔄 [AUTH] Refreshing token for: ${currentEmail || 'unknown'}`);

  if (!refreshToken) {
    console.log('❌ [AUTH] No refresh token available');
    return false;
  }

  try {
    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${refreshToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      console.log(`✅ [AUTH] Token refreshed successfully for: ${currentEmail}`);
      return true;
    } else {
      console.log(`❌ [AUTH] Token refresh failed (${response.status})`);
      return false;
    }
  } catch (error) {
    console.error('❌ [AUTH] Error refreshing token:', error);
    return false;
  }
};

export const clearAuthTokens = (): void => {
  console.log('🧹 [AUTH] Clearing all auth tokens');
  const oldEmail = localStorage.getItem('userEmail');
  console.log(`🧹 [AUTH] Removing tokens for: ${oldEmail || 'unknown'}`);

  ['token', 'refreshToken', 'userEmail', 'isAdmin', 'isVerified'].forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('✅ [AUTH] Tokens cleared');
  emitAuthCleared();
};

export const logout = (): void => {
  clearAuthTokens();
};
