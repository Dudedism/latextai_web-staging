import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isAuthenticated, getAnonymousKey } from '../utils/auth';

const useAuthRedirect = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect on public pages that don't require authentication
    const allowedPagesWithoutAuth = ['/', '/signin', '/signup', '/pricing', '/about', '/terms', '/privacy'];
    if (allowedPagesWithoutAuth.includes(location.pathname)) {
      return;
    }

    // Don't redirect if user is authenticated
    if (isAuthenticated()) {
      return;
    }

    // Don't redirect if user has anonymous account
    if (getAnonymousKey()) {
      return;
    }

    // Redirect to landing page if user has no authentication at all
    navigate('/');
  }, [location.pathname, navigate]);
};

export default useAuthRedirect;