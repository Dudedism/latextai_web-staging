import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StatusModal } from '../common/StatusModal';
import LandingPage from '../homepage/LandingPage';
import Footer from '../Footer';

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

      if (verificationAttempted.current) {
        return;
      }
      verificationAttempted.current = true;

      await new Promise(resolve => setTimeout(resolve, 100));

      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/api/verify?token=${token}`,
          { method: 'GET' }
        );

        if (response.ok) {
          const data = await response.json();
          setStatus('success');

          const accessToken = localStorage.getItem('token');
          const refreshToken = localStorage.getItem('refreshToken');
          const storedEmail = localStorage.getItem('userEmail');
          const storedIsAdmin = localStorage.getItem('isAdmin') === 'true';

          if (accessToken && refreshToken && storedEmail && storedEmail === data.email) {
            setAuthData({
              access_token: accessToken,
              refresh_token: refreshToken,
              email: storedEmail,
              admin: storedIsAdmin,
              is_verified: true
            });
          }
        } else {
          const data = await response.json();
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed. The link may be expired or invalid.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Network error. Please try again later.');
      }
    };

    verifyEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = () => {
    navigate('/');
  };

  return (
    <>
      <LandingPage />
      <Footer />
      <StatusModal
        isOpen={true}
        onClose={handleClose}
        status={status === 'verifying' ? 'loading' : status}
        title={
          status === 'verifying'
            ? 'Verifying...'
            : status === 'success'
            ? 'Email Verified!'
            : 'Verification Failed'
        }
        message={
          status === 'verifying'
            ? 'Please wait while we verify your email address.'
            : status === 'success'
            ? 'Your email has been successfully verified.'
            : errorMessage
        }
        submessage={status === 'success' ? 'Redirecting you to home page...' : undefined}
        autoCloseMs={status === 'success' ? 2000 : undefined}
        onAutoClose={handleClose}
        showCloseButton={status !== 'verifying'}
        actionButton={
          status === 'error'
            ? { label: 'Go to Home', onClick: handleClose }
            : undefined
        }
      />
    </>
  );
};

export default VerifyPage;
