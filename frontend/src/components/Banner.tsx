import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Banner.css';

interface BannerProps {
  isAuthenticated?: boolean;
  userName?: string;
}

const Banner: React.FC<BannerProps> = ({ isAuthenticated = false, userName }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Determine user state: check for anonymous key first to override isAuthenticated
  const hasAnonymousKey = localStorage.getItem('anonymousKey') !== null;
  const isAnonymous = hasAnonymousKey;
  const isFullUser = isAuthenticated && !hasAnonymousKey;
  const isUnauthenticated = !hasAnonymousKey && !isAuthenticated;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('anonymousKey');
    navigate('/signin');
  };

  return (
    <header className="banner">
      <Link to="/" className="logo">LaTexT</Link>
      <nav className="nav-center">
        <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
          Home
        </Link>
        <Link to="/about" className={location.pathname === '/about' ? 'active' : ''}>
          About
        </Link>
        <Link to="/pricing" className={location.pathname === '/pricing' ? 'active' : ''}>
          Plans
        </Link>
      </nav>
      <div className="nav-right">
        {isUnauthenticated ? (
          // State 1: Non-authenticated, non-anonymous users - only see "Sign Up"
          <Link to="/signin" className="btn-get-started">Sign Up</Link>
        ) : (
          // State 2 & 3: Anonymous or Full users - both see "Menu" hamburger
          <div className="hamburger-menu" ref={dropdownRef}>
            <button 
              className="hamburger-button" 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <span className="username">Menu</span>
              <svg 
                className="dropdown-arrow" 
                width="12" 
                height="8" 
                viewBox="0 0 12 8" 
                fill="none"
              >
                <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                {isFullUser ? (
                  // State 3: Full user menu
                  <>
                    <Link to="/account" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Profile
                    </Link>
                    <Link to="/papers" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Your Papers
                    </Link>
                    <Link to="/papers/new" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Upload Paper
                    </Link>
                    <button className="dropdown-item sign-out" onClick={handleSignOut}>
                      Sign Out
                    </button>
                  </>
                ) : (
                  // State 2: Anonymous user menu
                  <>
                    <Link to="/papers" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Your Papers
                    </Link>
                    <Link to="/papers/new" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Upload Paper
                    </Link>
                    <Link to="/signin" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                      Sign Up
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default Banner;