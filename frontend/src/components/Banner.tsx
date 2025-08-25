import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Banner.css';

interface BannerProps {
  isAuthenticated?: boolean;
  userName?: string;
}

const Banner: React.FC<BannerProps> = ({ isAuthenticated = false, userName }) => {
  const location = useLocation();

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
        {isAuthenticated ? (
          <>
            {userName && <span className="username">{userName}</span>}
            <Link to="/papers" className="btn-get-started">Your Papers</Link>
          </>
        ) : (
          <Link to="/signin" className="btn-get-started">Get Started</Link>
        )}
      </div>
    </header>
  );
};

export default Banner;