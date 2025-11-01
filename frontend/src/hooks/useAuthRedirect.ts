import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { anonSpawn } from '../utils/auth';

const useAuthRedirect = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Don't do anything on public pages that don't require authentication
    const allowedPagesWithoutAuth = ['/', '/signin', '/signup', '/pricing', '/about', '/terms', '/privacy'];
    if (allowedPagesWithoutAuth.includes(location.pathname)) {
      return;
    }

    // Don't do anything if user is already authenticated
    if (isAuthenticated) {
      return;
    }

    // Create anonymous account for auth pages if no authentication exists
    // Note: anonSpawn checks if user is already authenticated
    anonSpawn();
  }, [location.pathname, isAuthenticated]);
};

export default useAuthRedirect;