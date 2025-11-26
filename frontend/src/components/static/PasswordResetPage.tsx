import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { StatusModal } from '../common/StatusModal';

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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    navigate('/signin');
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section main-section--centered">
        <div className="container container--sm" style={{ maxWidth: '400px' }}>
          <h1 className="section-title text-center">Reset Your Password</h1>
          <p className="text-muted text-center mb-6">Enter your new password below</p>

          <form className="auth-form" onSubmit={handleSubmit}>
            {error && (
              <div className="notice notice--error" style={{ padding: '10px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <div>
              <input
                type="password"
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                maxLength={128}
                className="auth-input"
                autoFocus
              />
            </div>

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

            <button
              type="submit"
              className="btn btn--primary btn--pill btn--full"
              style={{ marginTop: '16px' }}
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              Remember your password?{' '}
              <button type="button" onClick={() => navigate('/signin')} className="auth-link">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </section>

      <Footer />

      <StatusModal
        isOpen={success}
        onClose={handleSuccessClose}
        status="success"
        title="Password Reset Successful!"
        message="Your password has been reset successfully."
        submessage="Redirecting to sign in..."
        autoCloseMs={2000}
        onAutoClose={handleSuccessClose}
        showCloseButton={true}
      />
    </div>
  );
};

export default PasswordResetPage;
