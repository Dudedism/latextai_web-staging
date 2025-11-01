import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  email: string;
  name: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  isAdmin: boolean;
  login: (email: string, password: string, currentEmail?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setAuthData: (data: { access_token: string; refresh_token: string; email: string; name: string; admin: boolean }, options?: { cleanupKeys?: string[] }) => void;
  clearAuth: () => void;
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

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = () => {
      const token = localStorage.getItem('token');
      const email = localStorage.getItem('userEmail');
      const name = localStorage.getItem('userName');
      const isAdmin = localStorage.getItem('isAdmin') === 'true';

      if (token && email && name) {
        console.log('🔒 [AUTH CONTEXT] Initializing auth state');
        console.log(`🔒 [AUTH CONTEXT] User: ${email} | Anonymous: ${email.endsWith('@anonymous.user')} | Admin: ${isAdmin}`);

        setUser({
          email,
          name,
          isAdmin
        });
      } else {
        console.log('🔒 [AUTH CONTEXT] No auth state found');
        setUser(null);
      }
    };

    initAuth();
  }, []);

  const isAuthenticated = user !== null;
  const isAnonymous = user !== null && user.email.endsWith('@anonymous.user');
  const isAdmin = user?.isAdmin || false;

  const replaceAuthState = (
    newState: {
      access_token: string;
      refresh_token: string;
      email: string;
      name: string;
      admin: boolean;
    },
    options: { cleanupKeys?: string[] } = {}
  ) => {
    console.log('✅ [AUTH CONTEXT] Replacing auth state for:', newState.email);

    localStorage.setItem('token', newState.access_token);
    localStorage.setItem('refreshToken', newState.refresh_token);
    localStorage.setItem('userEmail', newState.email);
    localStorage.setItem('userName', newState.name);
    localStorage.setItem('isAdmin', newState.admin.toString());

    // Clean up any additional keys (e.g., temporary merge tokens)
    (options.cleanupKeys || []).forEach(key => {
      localStorage.removeItem(key);
      console.log(`🧹 [AUTH CONTEXT] Removed ${key}`);
    });

    setUser({
      email: newState.email,
      name: newState.name,
      isAdmin: newState.admin
    });

    console.log('✅ [AUTH CONTEXT] Auth state replaced');
    if (options.cleanupKeys?.length) {
      console.log(`🧹 [AUTH CONTEXT] Cleaned up: ${options.cleanupKeys.join(', ')}`);
    }
  };

  const setAuthData = (data: {
    access_token: string;
    refresh_token: string;
    email: string;
    name: string;
    admin: boolean
  }, options: { cleanupKeys?: string[] } = {}) => {
    replaceAuthState(data, options);
  };

  const clearAuth = () => {
    console.log('🧹 [AUTH CONTEXT] Clearing auth state');
    const oldEmail = localStorage.getItem('userEmail');
    console.log(`🧹 [AUTH CONTEXT] Removing tokens for: ${oldEmail || 'unknown'}`);

    ['token', 'refreshToken', 'userEmail', 'userName', 'isAdmin'].forEach(key => {
      localStorage.removeItem(key);
    });

    setUser(null);

    console.log('✅ [AUTH CONTEXT] Auth state cleared');
  };

  const login = async (
    email: string,
    password: string,
    currentEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    console.log('🔐 [AUTH CONTEXT] Login attempt for:', email);

    // Safety check: Prevent registered user -> anonymous user transition
    if (email.endsWith('@anonymous.user')) {
      console.error('❌ [AUTH CONTEXT] Cannot login to anonymous account');
      return { success: false, error: 'Invalid login attempt' };
    }

    // Safety check: Prevent merging registered user into anonymous
    if (currentEmail && !currentEmail.endsWith('@anonymous.user')) {
      console.warn('⚠️ [AUTH CONTEXT] Cannot merge registered user into another account');
      // Allow login but don't send current_email for merge
      currentEmail = undefined;
    }

    try {
      const body: any = { email, password };

      // If currently logged in as anonymous user, send email for merge
      if (currentEmail && currentEmail.endsWith('@anonymous.user')) {
        body.current_email = currentEmail;
        console.log('🔀 [AUTH CONTEXT] Sending current anonymous email for merge:', currentEmail);
      }

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [AUTH CONTEXT] Login successful');

        // Replace auth state (server already handled merge if needed)
        replaceAuthState({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          email: email,
          name: data.name,
          admin: data.admin || false
        }, { cleanupKeys: [] });

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

  const logout = () => {
    console.log('🚪 [AUTH CONTEXT] Logout');
    clearAuth();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isAnonymous,
    isAdmin,
    login,
    logout,
    setAuthData,
    clearAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
