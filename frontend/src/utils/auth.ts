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

export const getTokenExpiry = (): number | null => {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp;
  } catch {
    return null;
  }
};

export const shouldRefreshToken = (): boolean => {
  const exp = getTokenExpiry();
  if (!exp) return false;

  const now = Math.floor(Date.now() / 1000);
  const timeLeft = exp - now;

  // Refresh if token expires in less than 5 minutes (300 seconds)
  return timeLeft > 0 && timeLeft < 300;
};

export const refreshAccessToken = async (silent: boolean = false): Promise<boolean> => {
  const refreshToken = getRefreshToken();
  const currentEmail = localStorage.getItem('userEmail');

  console.log(`🔄 [AUTH] Refreshing token for: ${currentEmail || 'unknown'}${silent ? ' (silent)' : ''}`);

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
      if (silent) {
        console.log('   Silent refresh failed - clearing expired tokens');
        logout();
      }
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

  ['token', 'refreshToken', 'userEmail', 'userName', 'isAdmin', 'isVerified'].forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('✅ [AUTH] Tokens cleared');
  emitAuthCleared();
};

export const logout = (): void => {
  clearAuthTokens();
};
