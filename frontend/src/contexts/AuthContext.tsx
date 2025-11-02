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
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  setAuthData: (data: { access_token: string; refresh_token: string; email: string; name: string; admin: boolean }) => void;
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
        console.log(`🔒 [AUTH CONTEXT] User: ${email} | Admin: ${isAdmin}`);

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
  const isAdmin = user?.isAdmin || false;

  const setAuthData = (data: {
    access_token: string;
    refresh_token: string;
    email: string;
    name: string;
    admin: boolean
  }) => {
    console.log('✅ [AUTH CONTEXT] Setting auth state for:', data.email);

    localStorage.setItem('token', data.access_token);
    localStorage.setItem('refreshToken', data.refresh_token);
    localStorage.setItem('userEmail', data.email);
    localStorage.setItem('userName', data.name);
    localStorage.setItem('isAdmin', data.admin.toString());

    setUser({
      email: data.email,
      name: data.name,
      isAdmin: data.admin
    });

    console.log('✅ [AUTH CONTEXT] Auth state set');
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
          admin: data.admin || false
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

  const logout = () => {
    console.log('🚪 [AUTH CONTEXT] Logout');
    clearAuth();
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
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
