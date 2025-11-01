import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Banner.css';

interface BannerProps {
  // Legacy props - kept for backward compatibility but not used
  isAuthenticated?: boolean;
  userName?: string;
}

const Banner: React.FC<BannerProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, isAnonymous, logout } = useAuth();

  // Determine user state: registered users vs anonymous users (default)
  const isRegisteredUser = isAuthenticated && !isAnonymous;

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
    logout();
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
              {isRegisteredUser ? (
                // Registered user menu
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
                // Anonymous user menu (default)
                <>
                  <Link to="/papers" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Your Papers
                  </Link>
                  <Link to="/papers/new" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Upload Paper
                  </Link>
                  <Link to="/signin" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Sign In
                  </Link>
                  <Link to="/signup" className="dropdown-item" onClick={() => setIsDropdownOpen(false)}>
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Banner;