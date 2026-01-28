import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { useAuth } from '../../contexts/AuthContext';
import { StatusModal } from '../common/StatusModal';

type AuthMode = 'signin' | 'signup';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    location.pathname === '/signin' ? 'signin' : 'signup'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [justRegistered, setJustRegistered] = useState(false);

  useEffect(() => {
    // Set auth mode based on current path
    const newMode = location.pathname === '/signin' ? 'signin' : 'signup';
    setAuthMode(newMode);
    
    // Clear password fields when switching modes
    if (!justRegistered) {
      setError('');
      setPassword('');
      setConfirmPassword('');
      setAgreeToTerms(false);
      // Clear all fields if not coming from successful registration
      setEmail('');
    } else {
      // Only clear passwords after successful registration
      setPassword('');
      setConfirmPassword('');
      setJustRegistered(false);
    }
  }, [location.pathname]);
  
  const { isAuthenticated, login: authLogin, setAuthData } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/papers');
    }
  }, [isAuthenticated, navigate]);

  // Initialize Google Sign-In button dynamically
  useEffect(() => {
    if (authMode !== 'signin') return;

    // Load Google Identity Services script if not already loaded
    const loadGoogleScript = () => {
      return new Promise<void>((resolve) => {
        if (window.google?.accounts) {
          resolve();
          return;
        }
        
        const existingScript = document.getElementById('google-gsi-script');
        if (existingScript) {
          existingScript.addEventListener('load', () => resolve());
          return;
        }

        const script = document.createElement('script');
        script.id = 'google-gsi-script';
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    const initializeGoogleButton = async () => {
      await loadGoogleScript();
      
      // Small delay to ensure the container is rendered
      setTimeout(() => {
        const container = document.getElementById('google-signin-container');
        if (container && window.google?.accounts) {
          // Clear any previous button
          container.innerHTML = '';
          
          window.google.accounts.id.initialize({
            client_id: '720160772474-jrdbco5ieojmvg83sr1juo3kineasj20.apps.googleusercontent.com',
            ux_mode: 'redirect',
            login_uri: 'http://localhost:8000/api/auth/google',
          });
          
          window.google.accounts.id.renderButton(container, {
            type: 'standard',
            size: 'large',
            theme: 'outline',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            locale: 'en',
            width: 360,
          });
        }
      }, 100);
    };

    initializeGoogleButton();
  }, [authMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (authMode === 'signup') {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setShowErrorModal(true);
        setLoading(false);
        return;
      }

      if (!agreeToTerms) {
        setError('Please agree to the terms and conditions');
        setShowErrorModal(true);
        setLoading(false);
        return;
      }
    }

    try {
      if (authMode === 'signin') {
        // Use AuthContext login for signin
        const result = await authLogin(email, password);

        if (result.success) {
          // Navigate to papers page
          navigate('/papers');
        } else {
          setError(result.error || 'Login failed');
          setShowErrorModal(true);
        }
      } else {
        // Handle signup with direct fetch (now with auto-login)
        const body = { email, password };

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok) {
          // Signup successful with auto-login - store auth data
          setError('');

          // Track signup conversion (production only)
          if (window.location.hostname === 'latext.ai' && typeof window.gtag === 'function') {
            window.gtag('set', 'user_data', { 'email': email });
            window.gtag('event', 'conversion', {
              'send_to': 'AW-17841022197/AzBICImqtN8bEPXJobtC'
            });
          }

          if (data.access_token && data.refresh_token) {
            // Auto-login: Store tokens and user data using AuthContext
            setAuthData({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              email: data.email,
              admin: data.admin || false,
              is_verified: false  // New users are not verified by default
            });

            // Navigate to papers page after successful signup
            navigate('/papers');
          } else {
            // Fallback: Old behavior (shouldn't happen with updated backend)
            alert(data.message || 'Registration successful! You can now sign in.');
            setJustRegistered(true);
            navigate('/signin');
          }
        } else {
          setError(data.message || 'An error occurred');
          setShowErrorModal(true);
        }
      }
    } catch (err) {
      setError('Network error. Please check if the backend server is running.');
      setShowErrorModal(true);
      console.error('Auth error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    setError('');
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section main-section--centered">
        <div className="container container--sm" style={{ maxWidth: '400px' }}>

          {/* Google Sign-In Button - only on Sign In page */}
          {authMode === 'signin' && (
            <div style={{ marginBottom: '32px', marginTop: '8px', width: '100%' }}>
              <div id="google-signin-container"></div>
            </div>
          )}

          <h1 className="section-title text-center">
            {authMode === 'signin' ? 'Sign In' : 'Sign Up'}
          </h1>

          <form className="auth-form" onSubmit={handleSubmit}>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={254}
                className="auth-input"
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                maxLength={128}
                className="auth-input"
              />
            </div>

            {authMode === 'signup' && (
              <div>
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  maxLength={128}
                  className="auth-input"
                />
              </div>
            )}

            {authMode === 'signup' && (
              <div style={{ marginTop: '8px' }}>
                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    checked={agreeToTerms}
                    onChange={(e) => setAgreeToTerms(e.target.checked)}
                    required
                  />
                  I agree with the <Link to="/terms">terms and conditions</Link> of using this tool.
                </label>
              </div>
            )}

            <button type="submit" className="btn btn--primary btn--pill btn--full" style={{ marginTop: '16px' }} disabled={loading}>
              {loading ? 'Loading...' : `${authMode === 'signin' ? 'Sign In' : 'Get Started'} →`}
            </button>

            {authMode === 'signin' && (
              <div className="text-center mt-4">
                <Link to="/forgot-password" className="auth-link">
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <div className="auth-switch">
            {authMode === 'signin' ? (
              <p>
                Don't have an account?{' '}
                <Link to="/signup" className="auth-link">
                  Sign up
                </Link>
              </p>
            ) : authMode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <Link to="/signin" className="auth-link">
                  Sign in
                </Link>
              </p>
            ) : (
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setError('');
                  }}
                  className="auth-link"
                >
                  Sign in
                </button>
                .
              </p>
            )}
          </div>
        </div>
      </section>

      <Footer />

      <StatusModal
        isOpen={showErrorModal}
        onClose={handleErrorModalClose}
        status="error"
        title={authMode === 'signin' ? 'Sign In Failed' : 'Sign Up Failed'}
        message={error}
        showCloseButton={true}
        actionButton={{ label: 'Try Again', onClick: handleErrorModalClose }}
      />
    </div>
  );
};

export default SignInPage;