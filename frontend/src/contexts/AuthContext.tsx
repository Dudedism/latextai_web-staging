import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { onAuthCleared, clearAuthTokens } from '../utils/auth';

interface User {
  email: string;
  isAdmin: boolean;
  isVerified: boolean;
  isAnonymous: boolean;
  pricingTier: string;
  pricingCurrency: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  isVerified: boolean;
  isAnonymous: boolean;
  login: (email: string, password: string, anonEmail?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setAuthData: (data: { access_token: string; refresh_token: string; email: string; admin: boolean; is_verified?: boolean; is_anonymous?: boolean }) => void;
  clearAuth: () => void;
  refreshVerificationStatus: () => Promise<void>;
  refreshUser: () => Promise<void>;
  anonSpawn: () => Promise<void>;
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
  const [isLoading, setIsLoading] = useState(true);
  const anonSpawnRef = useRef(false);

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

  // Refresh full user profile from the backend
  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/user/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('userEmail', data.email);
        localStorage.setItem('isAdmin', (data.admin || false).toString());
        localStorage.setItem('isVerified', (data.is_verified || false).toString());
        localStorage.setItem('isAnonymous', (data.is_anonymous || false).toString());
        localStorage.setItem('pricingTier', data.pricing_tier || 'standard');
        localStorage.setItem('pricingCurrency', data.pricing_currency || 'usd');

        setUser({
          email: data.email,
          isAdmin: data.admin || false,
          isVerified: data.is_verified || false,
          isAnonymous: data.is_anonymous || false,
          pricingTier: data.pricing_tier || 'standard',
          pricingCurrency: data.pricing_currency || 'usd',
        });
      }
    } catch (error) {
      console.error('Failed to refresh user profile:', error);
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
        const isNewUser = params.get('is_new_user') === 'true';

        if (accessToken && refreshToken && urlEmail) {
          // Store auth data from OAuth callback
          localStorage.setItem('token', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          localStorage.setItem('userEmail', urlEmail);
          localStorage.setItem('isAdmin', admin.toString());
          localStorage.setItem('isVerified', 'true'); // Google users are auto-verified
          localStorage.setItem('isAnonymous', 'false');

          setUser({
            email: urlEmail,
            isAdmin: admin,
            isVerified: true,
            isAnonymous: false,
            pricingTier: localStorage.getItem('pricingTier') || 'standard',
            pricingCurrency: localStorage.getItem('pricingCurrency') || 'usd',
          });

          // Track Google OAuth signup conversion (production only, new users only)
          if (isNewUser && window.location.hostname === 'latext.ai' && typeof window.gtag === 'function') {
            window.gtag('set', 'user_data', { 'email': urlEmail });
            window.gtag('event', 'conversion', {
              'send_to': 'AW-17841022197/AzBICImqtN8bEPXJobtC'
            });
          }

          // Clean up URL (remove hash fragment)
          window.history.replaceState(null, '', window.location.pathname);
          setIsLoading(false);
          return;
        }
      }

      // Fall back to localStorage
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('userEmail');
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      const cachedVerified = localStorage.getItem('isVerified');
      const cachedAnonymous = localStorage.getItem('isAnonymous') === 'true';

      if (token && email) {
        setUser({
          email,
          isAdmin,
          isVerified: cachedVerified === 'true',
          isAnonymous: cachedAnonymous,
          pricingTier: localStorage.getItem('pricingTier') || 'standard',
          pricingCurrency: localStorage.getItem('pricingCurrency') || 'usd',
        });

        // Only fetch verification status if not cached and not anonymous
        if (cachedVerified === null && !cachedAnonymous) {
          refreshVerificationStatus();
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
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
  const isAnonymous = user?.isAnonymous || false;

  const setAuthData = (data: {
    access_token: string;
    refresh_token: string;
    email: string;
    admin: boolean;
    is_verified?: boolean;
    is_anonymous?: boolean;
    pricing_tier?: string;
    pricing_currency?: string;
  }) => {
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('isAdmin', data.admin.toString());

    // Store verification status if provided
    if (data.is_verified !== undefined) {
      localStorage.setItem('isVerified', data.is_verified.toString());
    }

    // Store anonymous status
    localStorage.setItem('isAnonymous', (data.is_anonymous || false).toString());

    // Store pricing tier
    if (data.pricing_tier) localStorage.setItem('pricingTier', data.pricing_tier);
    if (data.pricing_currency) localStorage.setItem('pricingCurrency', data.pricing_currency);

    setUser({
      email: data.email,
      isAdmin: data.admin,
      isVerified: data.is_verified || false,
      isAnonymous: data.is_anonymous || false,
      pricingTier: data.pricing_tier || localStorage.getItem('pricingTier') || 'standard',
      pricingCurrency: data.pricing_currency || localStorage.getItem('pricingCurrency') || 'usd',
    });
  };

  const clearAuth = () => {
    clearAuthTokens(); // Clears localStorage and emits event, which triggers setUser(null)
  };

  const login = async (
    email: string,
    password: string,
    anonEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const body: Record<string, string> = { email, password };
      if (anonEmail) body.anon_email = anonEmail;

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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

  const anonSpawn = async () => {
    // Mutex: prevent concurrent anonSpawn calls
    if (anonSpawnRef.current) return;
    anonSpawnRef.current = true;

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/auth/anonymous`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        setAuthData({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          email: data.email,
          admin: false,
          is_verified: false,
          is_anonymous: true
        });
      }
    } catch (error) {
      console.error('Failed to create anonymous session:', error);
    } finally {
      anonSpawnRef.current = false;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    isAdmin,
    isVerified,
    isAnonymous,
    login,
    logout,
    setAuthData,
    clearAuth,
    refreshVerificationStatus,
    refreshUser,
    anonSpawn
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
