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

export const getToken = (): string | null => {
  return localStorage.getItem('token');
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

export const anonSpawn = async (): Promise<boolean> => {
  // Don't create anonymous account if user is already registered
  if (isAuthenticated() && !isAnonymousUser()) {
    return true; // Already have registered account
  }

  // Check if anonymous account already exists
  if (getAnonymousKey()) {
    return true; // Already have anonymous account
  }

  try {
    // Generate a unique key for anonymous user
    const anonymousKey = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store the key in localStorage for later use
    localStorage.setItem('anonymousKey', anonymousKey);

    const response = await fetch('http://localhost:8000/api/loginAnonymously', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: anonymousKey }),
    });

    const data = await response.json();

    if (response.ok) {
      // Store anonymous token
      localStorage.setItem('token', data.token);
      localStorage.setItem('userEmail', `${anonymousKey}@anonymous.user`);
      localStorage.setItem('userName', data.name || 'Anonymous');
      localStorage.setItem('isAdmin', 'false');
      return true;
    } else {
      console.error('Failed to create anonymous session:', data.message);
      return false;
    }
  } catch (error) {
    console.error('Error creating anonymous session:', error);
    return false;
  }
};