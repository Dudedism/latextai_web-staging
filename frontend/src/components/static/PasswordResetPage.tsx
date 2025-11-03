import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import '../../styles/common.css';
import './SignInPage.css'; // Reuse SignIn styles

const PasswordResetPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('✅ [PASSWORD RESET] Password reset successful');

        // Clear any existing auth tokens to force re-login
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');

        setSuccess(true);
        // Redirect to signin after 2 seconds
        setTimeout(() => {
          navigate('/signin');
        }, 2000);
      } else {
        console.error('❌ [PASSWORD RESET] Reset failed:', data.error);
        setError(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('❌ [PASSWORD RESET] Error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="signin-page">
        <Banner />
        <section className="signin-section">
          <div className="signin-form-container">
            <div className="success-container">
              <div className="success-icon">✓</div>
              <h2 className="success-heading">Password Reset Successful!</h2>
              <p className="success-message">
                Your password has been reset successfully. Redirecting to sign in...
              </p>
            </div>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  return (
    <div className="signin-page">
      <Banner />

      <section className="signin-section">
        <div className="signin-form-container">
          <h1 className="signin-title">Reset Your Password</h1>
          <p className="signin-subtitle">Enter your new password below</p>

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

            <div className="form-field">
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="form-input"
                autoFocus
              />
            </div>

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

            <button type="submit" className="signin-btn" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password →'}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => navigate('/signin')}
                className="switch-btn"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PasswordResetPage;
