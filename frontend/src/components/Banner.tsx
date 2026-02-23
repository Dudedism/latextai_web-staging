import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './common/LoadingScreen';
import './Banner.css';

const Banner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isAnonymous, logout } = useAuth();

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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    setIsDropdownOpen(false);
    await logout();
    if (location.pathname === '/') {
      setIsSigningOut(false);
    } else {
      navigate('/');
    }
  };

  if (isSigningOut) {
    return <LoadingScreen />;
  }

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
          Pricing
        </Link>
        <Link to="/journals" className={location.pathname === '/journals' ? 'active' : ''}>
          Journals
        </Link>
      </nav>
      <div className="nav-right">
        <div className="hamburger-menu" ref={dropdownRef}>
          <button
            className="hamburger-button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            aria-label="Menu"
          >
            <span className="menu-text">Menu</span>
            <svg
              className="hamburger-icon"
              width="20"
              height="14"
              viewBox="0 0 20 14"
              fill="none"
            >
              <path d="M1 1H19M1 7H19M1 13H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
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
              <button
                className="mobile-menu-close"
                onClick={() => setIsDropdownOpen(false)}
                aria-label="Close menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
              {/* Mobile-only nav links */}
              <div className="mobile-nav-links">
                <Link to="/" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                  Home
                </Link>
                <Link to="/about" className="dropdown-item hide-mobile" onClick={() => setIsDropdownOpen(false)}>
                  About
                </Link>
                <Link to="/pricing" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                  Pricing
                </Link>
                <Link to="/journals" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                  Journals
                </Link>
              </div>
              {isAuthenticated && !isAnonymous ? (
                <button className="dropdown-item sign-out" onClick={handleSignOut}>
                  Sign Out
                </button>
              ) : (
                <>
                  <Link to="/signin" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/signup" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Sign Up
                  </Link>
                </>
              )}
              <Link to="/account" className={`dropdown-item${!isAuthenticated || isAnonymous ? ' hide-mobile-guest' : ''}`} onClick={() => setIsDropdownOpen(false)}>
                Profile
              </Link>
              <Link to="/papers" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                Your Papers
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Banner;