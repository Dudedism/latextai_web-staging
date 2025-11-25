import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { StatusModal } from '../common/StatusModal';

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      // Always show success to prevent email enumeration
      if (response.ok || !response.ok) {
        setEmailSent(true);
        setError('');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    navigate('/signin');
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section main-section--centered">
        <div className="container container--sm" style={{ maxWidth: '400px' }}>
          <h1 className="section-title text-center">Reset Password</h1>

          <p className="text-muted text-center mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="notice notice--error" style={{ padding: '10px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="auth-input"
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn--primary btn--pill btn--full"
              style={{ marginTop: '16px' }}
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              Remember your password?{' '}
              <Link to="/signin" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>

      <Footer />

      <StatusModal
        isOpen={emailSent}
        onClose={handleModalClose}
        status="success"
        title="Email Sent!"
        message="If this email is registered and verified, a password reset link has been sent."
        submessage="Please check your inbox. The link will expire in 1 hour."
        showCloseButton={true}
        actionButton={{ label: 'Back to Sign In', onClick: handleModalClose }}
      />
    </div>
  );
};

export default ForgotPasswordPage;
