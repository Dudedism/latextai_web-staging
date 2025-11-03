import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  email: string;
  name: string;
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
  setAuthData: (data: { access_token: string; refresh_token: string; email: string; name: string; admin: boolean; is_verified?: boolean }) => void;
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
        console.log('🔒 [AUTH CONTEXT] Verification status refreshed:', isVerified);
      }
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    }
  };

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('userEmail');
      const name = localStorage.getItem('userName');
      const isAdmin = localStorage.getItem('isAdmin') === 'true';
      const cachedVerified = localStorage.getItem('isVerified');

      if (token && email && name) {
        console.log('🔒 [AUTH CONTEXT] Initializing auth state');
        console.log(`🔒 [AUTH CONTEXT] User: ${email} | Admin: ${isAdmin} | Verified: ${cachedVerified}`);

        setUser({
          email,
          name,
          isAdmin,
          isVerified: cachedVerified === 'true'
        });

        // Only fetch verification status if not cached
        if (cachedVerified === null) {
          console.log('🔒 [AUTH CONTEXT] Verification status not cached, fetching...');
          refreshVerificationStatus();
        }
      } else {
        console.log('🔒 [AUTH CONTEXT] No auth state found');
        setUser(null);
      }
    };

    initAuth();
  }, []);

  const isAuthenticated = user !== null;
  const isAdmin = user?.isAdmin || false;
  const isVerified = user?.isVerified || false;

  const setAuthData = (data: {
    access_token: string;
    refresh_token: string;
    email: string;
    name: string;
    admin: boolean;
    is_verified?: boolean;
  }) => {
    console.log('🔧 [AUTH CONTEXT] setAuthData CALLED!');
    console.log('  - email:', data.email);
    console.log('  - is_verified:', data.is_verified);

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('isAdmin', data.admin.toString());

    // Store verification status if provided
    if (data.is_verified !== undefined) {
      const verifiedString = data.is_verified.toString();
      localStorage.setItem('isVerified', verifiedString);
      console.log('💾 [AUTH CONTEXT] SAVED to localStorage: isVerified =', verifiedString);
      console.log('💾 [AUTH CONTEXT] VERIFY localStorage now has:', localStorage.getItem('isVerified'));
    } else {
      console.log('⚠️  [AUTH CONTEXT] is_verified was undefined, NOT saving to localStorage');
    }

    setUser({
      email: data.email,
      name: data.name,
      isAdmin: data.admin,
      isVerified: data.is_verified || false
    });

    console.log('✅ [AUTH CONTEXT] Auth state set. User isVerified:', data.is_verified || false);
  };

  const clearAuth = () => {
    console.log('🧹 [AUTH CONTEXT] Clearing auth state');
    const oldEmail = localStorage.getItem('userEmail');
    console.log(`🧹 [AUTH CONTEXT] Removing tokens for: ${oldEmail || 'unknown'}`);

    ['token', 'refreshToken', 'userEmail', 'userName', 'isAdmin', 'isVerified'].forEach(key => {
      localStorage.removeItem(key);
    });

    setUser(null);

    console.log('✅ [AUTH CONTEXT] Auth state cleared');
  };

  const login = async (
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('🔐 [AUTH CONTEXT] Login attempt for:', email);

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
        console.log('✅ [AUTH CONTEXT] Login successful');

        setAuthData({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          email: email,
          name: data.name,
          admin: data.admin || false,
          is_verified: data.is_verified || false
        });

        return { success: true };
      } else {
        console.log('❌ [AUTH CONTEXT] Login failed:', data.message);
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Login error:', error);
      return { success: false, error: 'Network error. Please check if the backend server is running.' };
    }
  };

  const logout = async () => {
    console.log('🚪 [AUTH CONTEXT] Logout');

    // Call backend to invalidate refresh token
    try {
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ [AUTH CONTEXT] Server-side logout successful');
    } catch (error) {
      console.error('❌ [AUTH CONTEXT] Server-side logout failed:', error);
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
