export interface User {
  email: string;
  name: string;
  isAdmin: boolean;
  token: string;
}

export const getAuthenticatedUser = (): User | null => {
  const token = localStorage.getItem('token');
  const email = localStorage.getItem('userEmail');
  const name = localStorage.getItem('userName');
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  if (!token || !email || !name) {
    console.log('🔒 [AUTH] No authenticated user (missing token/email/name)');
    return null;
  }

  const isAnon = email.endsWith('@anonymous.user');
  console.log(`🔒 [AUTH] User: ${email} | Anonymous: ${isAnon} | Admin: ${isAdmin}`);

  return {
    email,
    name,
    isAdmin,
    token
  };
};

export const isAuthenticated = (): boolean => {
  return getAuthenticatedUser() !== null;
};

export const isAnonymousUser = (): boolean => {
  const user = getAuthenticatedUser();
  return user !== null && user.email.endsWith('@anonymous.user');
};

export const isAdmin = (): boolean => {
  const user = getAuthenticatedUser();
  return user !== null && user.isAdmin === true;
};


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
    // Decode JWT payload (base64 decode the middle part)
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp; // Unix timestamp in seconds
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
      // Store new tokens
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      console.log(`✅ [AUTH] Token refreshed successfully for: ${currentEmail}`);
      return true;
    } else {
      console.log(`❌ [AUTH] Token refresh failed (${response.status})`);
      // Only clear auth on silent refresh - let interceptor handle user-initiated actions
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

  ['token', 'refreshToken', 'userEmail', 'userName', 'isAdmin'].forEach(key => {
    localStorage.removeItem(key);
  });

  console.log('✅ [AUTH] Tokens cleared');
};

export const logout = (): void => {
  clearAuthTokens();
};

export const getAuthHeaders = () => {
  const user = getAuthenticatedUser();
  if (!user) return {};

  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
};