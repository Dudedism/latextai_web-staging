import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { onAuthCleared, clearAuthTokens } from '../utils/auth';

interface User {
  email: string;
  isAdmin: boolean;
  isVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setAuthData: (data: { access_token: string; refresh_token: string; email: string; admin: boolean; is_verified?: boolean }) => void;
  clearAuth: () => void;
  refreshVerificationStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // Function to refresh verification status from the backend
  const refreshVerificationStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/verification-status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const isVerified = data.is_verified || false;

        // Update localStorage and state
        localStorage.setItem('isVerified', isVerified.toString());
        setUser(prev => prev ? { ...prev, isVerified } : null);
      }
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    }
  };

  // Initialize auth state from localStorage or URL fragment (for Google OAuth)
  useEffect(() => {
    const initAuth = () => {
      // Check for OAuth tokens in URL fragment (from Google login redirect)
      const hash = window.location.hash.substring(1);
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const urlEmail = params.get('email');
        const admin = params.get('admin') === 'true';

        if (accessToken && refreshToken && urlEmail) {
          // Store auth data from OAuth callback
          localStorage.setItem('token', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('userEmail', urlEmail);
          localStorage.setItem('isAdmin', admin.toString());
          localStorage.setItem('isVerified', 'true'); // Google users are auto-verified

          setUser({
            email: urlEmail,
            isAdmin: admin,
            isVerified: true
          });

          // Clean up URL (remove hash fragment)
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }
      }

      // Fall back to localStorage
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('userEmail');
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      const cachedVerified = localStorage.getItem('isVerified');

      if (token && email) {
        setUser({
          email,
          isAdmin,
          isVerified: cachedVerified === 'true'
        });

        // Only fetch verification status if not cached
        if (cachedVerified === null) {
          refreshVerificationStatus();
        }
      } else {
        setUser(null);
      }
    };

    initAuth();
  }, []);

  // Listen for auth cleared events (e.g., from fetchInterceptor)
  useEffect(() => {
    const unsubscribe = onAuthCleared(() => {
      setUser(null);
    });

    return unsubscribe;
  }, []);

  const isAuthenticated = user !== null;
  const isAdmin = user?.isAdmin || false;
  const isVerified = user?.isVerified || false;

  const setAuthData = (data: {
    access_token: string;
    refresh_token: string;
    email: string;
    admin: boolean;
    is_verified?: boolean;
  }) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('isAdmin', data.admin.toString());

    // Store verification status if provided
    if (data.is_verified !== undefined) {
      localStorage.setItem('isVerified', data.is_verified.toString());
    }

    setUser({
      email: data.email,
      isAdmin: data.admin,
      isVerified: data.is_verified || false
    });
  };

  const clearAuth = () => {
    clearAuthTokens(); // Clears localStorage and emits event, which triggers setUser(null)
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setAuthData({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          email: email,
          admin: data.admin || false,
          is_verified: data.is_verified || false
        });

        return { success: true };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please check if the backend server is running.' };
    }
  };

  const logout = async () => {
    // Call backend to invalidate refresh token
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      // Ignore server-side logout errors
    }

    // Clear local auth state regardless of server response
    clearAuth();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isAdmin,
    isVerified,
    login,
    logout,
    setAuthData,
    clearAuth,
    refreshVerificationStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
