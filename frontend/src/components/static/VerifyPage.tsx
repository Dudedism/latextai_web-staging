import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Banner from '../Banner';
import '../../styles/common.css';
import './VerifyPage.css';

const VerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, refreshVerificationStatus, setAuthData, user } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setErrorMessage('Verification token is missing');
        return;
      }

      try {
        console.log('🔍 [VERIFY PAGE] Verifying email with token...');

        // Call backend verify endpoint (no auth required, token is sufficient)
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/verify?token=${token}`,
          {
            method: 'GET',
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log('✅ [VERIFY PAGE] Email verified successfully');
          setStatus('success');

          // If user is logged in AND it's the same email, update their verification status
          if (isAuthenticated && user && user.email === data.email) {
            console.log('🔄 [VERIFY PAGE] User is logged in, updating auth state...');
            // Update auth state with verified status
            const token = localStorage.getItem('token');
            const refreshToken = localStorage.getItem('refreshToken');
            if (token && refreshToken) {
              setAuthData({
                access_token: token,
                refresh_token: refreshToken,
                email: user.email,
                name: user.name,
                admin: user.isAdmin,
                is_verified: true
              });
            }
          } else if (isAuthenticated && user && user.email !== data.email) {
            console.log('ℹ️  [VERIFY PAGE] Different user is logged in, not updating auth state');
          } else {
            console.log('ℹ️  [VERIFY PAGE] User not logged in, verification successful but auth state unchanged');
          }

          // Redirect to root after 2 seconds
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } else {
          const data = await response.json();
          console.error('❌ [VERIFY PAGE] Verification failed:', data);
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed. The link may be expired or invalid.');
        }
      } catch (error) {
        console.error('❌ [VERIFY PAGE] Network error:', error);
        setStatus('error');
        setErrorMessage('Network error. Please try again later.');
      }
    };

    verifyEmail();
  }, [searchParams, navigate, isAuthenticated, user, setAuthData, refreshVerificationStatus]);

  return (
    <div className="verify-page">
      <Banner />
      <div className="verify-main-section">
        <div className="verify-container">
          <div className="verify-content">
            {status === 'verifying' && (
              <>
                <div className="verify-spinner"></div>
                <h1 className="verify-title">Verifying your email...</h1>
                <p className="verify-description">Please wait while we verify your email address.</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="verify-icon success">✓</div>
                <h1 className="verify-title">Email Verified!</h1>
                <p className="verify-description">Your email has been successfully verified.</p>
                <p className="redirect-message">Redirecting you to home page...</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="verify-icon error">✗</div>
                <h1 className="verify-title">Verification Failed</h1>
                <p className="error-message">{errorMessage}</p>
                <button
                  className="verify-button"
                  onClick={() => navigate('/')}
                >
                  Go to Home
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyPage;
