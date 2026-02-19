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

  if (!refreshToken) {
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
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    return false;
  }
};

export const clearAuthTokens = (): void => {
  ['token', 'refreshToken', 'userEmail', 'isAdmin', 'isVerified', 'isAnonymous'].forEach(key => {
    localStorage.removeItem(key);
  });
  emitAuthCleared();
};

export const logout = (): void => {
  clearAuthTokens();
};
