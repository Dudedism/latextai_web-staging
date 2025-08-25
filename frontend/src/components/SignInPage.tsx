import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Banner from './Banner';
import Footer from './Footer';
import { getAuthenticatedUser, isAuthenticated, getAnonymousKey } from '../utils/auth';
import '../styles/common.css';
import './SignInPage.css';

type AuthMode = 'signin' | 'signup';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  useEffect(() => {
    // Set auth mode based on current path and clear form data
    const newMode = location.pathname === '/signin' ? 'signin' : 'signup';
    setAuthMode(newMode);
    setError('');
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setAgreeToTerms(false);
  }, [location.pathname]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const user = getAuthenticatedUser();
  
  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/papers');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
      }
      
      if (!agreeToTerms) {
        setError('Please agree to the terms and conditions');
        setLoading(false);
        return;
      }

      if (!name.trim()) {
        setError('Name is required');
        setLoading(false);
        return;
      }
    }

    try {
      const endpoint = authMode === 'signin' ? '/api/login' : '/api/signup';
      const baseUrl = 'http://localhost:8000';
      
      // Check if there's an anonymous key for account merging
      const anonymousKey = getAnonymousKey();
      
      const body: any = authMode === 'signin' 
        ? { email, password }
        : { name, email, password };
      
      // Add anonymous key if it exists (for account merging)
      if (anonymousKey && authMode === 'signin') {
        body.anon_key = anonymousKey;
      }

      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        if (authMode === 'signin') {
          // Store JWT token in localStorage
          localStorage.setItem('token', data.token);
          localStorage.setItem('userEmail', email);
          localStorage.setItem('userName', data.name);
          localStorage.setItem('isAdmin', data.admin?.toString() || 'false');
          
          // Navigate to papers page
          navigate('/papers');
        } else {
          // Signup successful - show success message
          setError('');
          alert('Registration successful! Please check your email to verify your account.');
          // Switch to signin mode
          setAuthMode('signin');
        }
      } else {
        setError(data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please check if the backend server is running.');
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <Banner isAuthenticated={isAuthenticated()} userName={user?.name} />
      
      <section className="signin-section">
        <div className="signin-form-container">
          <h1 className="signin-title">
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h1>
          
          <form className="signin-form" onSubmit={handleSubmit}>
            {error && (
              <div className="error-message" style={{
                color: '#ff0000',
                fontSize: '14px',
                marginBottom: '20px',
                padding: '10px',
                backgroundColor: '#ffebee',
                border: '1px solid #ffcdd2',
                borderRadius: '4px'
              }}>
                {error}
              </div>
            )}
            
            {authMode === 'signup' && (
              <div className="form-field">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
            )}
            
            <div className="form-field">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
              />
            </div>
            
            <div className="form-field">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
              />
            </div>
            
            {authMode === 'signup' && (
              <div className="form-field">
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
            )}
            
            {authMode === 'signup' && (
              <div className="form-field checkbox-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    required
                  />
                  <span className="checkmark"></span>
                  I agree with the <Link to="/terms">terms and conditions</Link> of using this tool.
                </label>
              </div>
            )}
            
            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? 'Loading...' : `${authMode === 'signin' ? 'Sign In' : 'Get Started'} →`}
            </button>
          </form>
          
          <div className="auth-switch">
            {authMode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <Link to="/signup" className="switch-btn">
                  Sign up
                </Link>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <Link to="/signin" className="switch-btn">
                  Sign in
                </Link>
                .
              </p>
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default SignInPage;