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
    return null;
  }

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

export const getAnonymousKey = (): string | null => {
  return localStorage.getItem('anonymousKey');
};

export const logout = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('isAdmin');
  // Don't remove anonymousKey - keep it for potential account merging
};

export const getAuthHeaders = () => {
  const user = getAuthenticatedUser();
  if (!user) return {};
  
  return {
    'Authorization': `Bearer ${user.token}`,
    'Content-Type': 'application/json'
  };
};