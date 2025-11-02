import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationModal } from '../common/VerificationModal';
import '../../styles/common.css';
import './SignInPage.css';

type AuthMode = 'signin' | 'signup';

const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authMode, setAuthMode] = useState<AuthMode>(() =>
    location.pathname === '/signin' ? 'signin' : 'signup'
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justRegistered, setJustRegistered] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');

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
      setName('');
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
      if (authMode === 'signin') {
        // Use AuthContext login for signin
        const result = await authLogin(email, password);

        if (result.success) {
          // Navigate to papers page
          navigate('/papers');
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        // Handle signup with direct fetch (now with auto-login)
        const body = { name, email, password };

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

          if (data.access_token && data.refresh_token) {
            // Auto-login: Store tokens and user data using AuthContext
            setAuthData({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              email: data.email,
              name: data.name,
              admin: data.admin || false,
              is_verified: false  // New users are not verified by default
            });

            console.log('✅ [SIGNUP] Registration and auto-login successful');

            // Store email for verification modal
            setSignupEmail(data.email);

            // Show verification modal
            setShowVerificationModal(true);

            // Navigate to papers page after a delay (so user sees modal)
            setTimeout(() => {
              navigate('/papers');
            }, 500);
          } else {
            // Fallback: Old behavior (shouldn't happen with updated backend)
            alert(data.message || 'Registration successful! You can now sign in.');
            setJustRegistered(true);
            navigate('/signin');
          }
        } else {
          setError(data.message || 'An error occurred');
        }
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
      <Banner />
      
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

      <VerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={signupEmail}
        showOnSignup={true}
      />
    </div>
  );
};

export default SignInPage;