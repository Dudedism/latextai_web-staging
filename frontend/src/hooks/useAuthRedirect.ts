import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isAuthenticated, getAnonymousKey, anonSpawn } from '../utils/auth';

const useAuthRedirect = () => {
  const location = useLocation();

  useEffect(() => {
    // Don't do anything on public pages that don't require authentication
    const allowedPagesWithoutAuth = ['/', '/signin', '/signup', '/pricing', '/about', '/terms', '/privacy'];
    if (allowedPagesWithoutAuth.includes(location.pathname)) {
      return;
    }

    // Don't do anything if user is already authenticated
    if (isAuthenticated()) {
      return;
    }

    // Don't do anything if user already has anonymous account
    if (getAnonymousKey()) {
      return;
    }

    // Create anonymous account for auth pages if no authentication exists
    anonSpawn();
  }, [location.pathname]);
};

export default useAuthRedirect;