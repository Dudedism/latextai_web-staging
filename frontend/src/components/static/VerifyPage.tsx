import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Banner from '../Banner';
import '../../styles/common.css';
import './VerifyPage.css';

const VerifyPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const verificationAttempted = useRef(false);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setErrorMessage('Verification token is missing');
        return;
      }

      // Prevent duplicate verification attempts
      if (verificationAttempted.current) {
        console.log('⏭️  [VERIFY PAGE] Verification already attempted, skipping');
        return;
      }
      verificationAttempted.current = true;

      // Wait a moment for AuthContext to initialize
      await new Promise(resolve => setTimeout(resolve, 100));

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
          console.log('📧 [VERIFY PAGE] Verified email from backend:', data.email);
          setStatus('success');

          // Check if user has auth tokens (logged in) - read directly from localStorage
          const accessToken = localStorage.getItem('token');
          const refreshToken = localStorage.getItem('refreshToken');
          const storedEmail = localStorage.getItem('userEmail');
          const storedName = localStorage.getItem('userName');
          const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';

          console.log('🔍 [VERIFY PAGE] Checking auth state (reading from localStorage)...');
          console.log('  - accessToken exists:', !!accessToken);
          console.log('  - refreshToken exists:', !!refreshToken);
          console.log('  - storedEmail:', storedEmail);
          console.log('  - data.email:', data.email);
          console.log('  - emails match:', storedEmail === data.email);

          if (accessToken && refreshToken && storedEmail && storedName && storedEmail === data.email) {
            // User is logged in AND it's the same email, update their verification status
            console.log('🔄 [VERIFY PAGE] ✅ ALL CONDITIONS MET - User is logged in, updating auth state to verified...');
            setAuthData({
              access_token: accessToken,
              refresh_token: refreshToken,
              email: storedEmail,
              name: storedName,
              admin: storedIsAdmin,
              is_verified: true
            });
            console.log('✅ [VERIFY PAGE] setAuthData CALLED with is_verified: true');
          } else if (accessToken && refreshToken && storedEmail && storedEmail !== data.email) {
            console.log('⚠️  [VERIFY PAGE] Different user is logged in, not updating auth state');
          } else {
            console.log('⚠️  [VERIFY PAGE] User not logged in (no tokens), verification successful but auth state unchanged');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
