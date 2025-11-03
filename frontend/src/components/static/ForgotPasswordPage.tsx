import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import '../../styles/common.css';
import './ForgotPasswordPage.css';

const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/request-password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (response.ok) {
        setEmailSent(true);
        setError('');
      } else {
        // Still show success to prevent email enumeration
        setEmailSent(true);
        setError('');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-page">
      <Banner />

      <section className="signin-section">
        <div className="signin-form-container">
          <h1 className="signin-title">Reset Password</h1>

          {emailSent ? (
            <div className="success-container">
              <div className="success-icon">✓</div>
              <h2 className="success-heading">Email Sent!</h2>
              <p className="success-message">
                If this email is registered and verified, a password reset link has been sent.
              </p>
              <p className="success-submessage">
                Please check your inbox and follow the instructions to reset your password.
                The link will expire in 1 hour.
              </p>
              <button
                type="button"
                onClick={() => navigate('/signin')}
                className="signin-btn"
                style={{ marginTop: '20px' }}
              >
                Back to Sign In →
              </button>
            </div>
          ) : (
            <>
              <p className="signin-subtitle">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <form className="signin-form" onSubmit={handleSubmit}>
                {error && (
                  <div className="error-message">
                    {error}
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
                    autoFocus
                  />
                </div>

                <button type="submit" className="signin-btn" disabled={loading}>
                  {loading ? 'Loading...' : 'Send Reset Link →'}
                </button>
              </form>

              <div className="auth-switch">
                <p>
                  Remember your password?{' '}
                  <Link to="/signin" className="switch-btn">
                    Sign in
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ForgotPasswordPage;
