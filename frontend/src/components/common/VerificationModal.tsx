import React, { useState } from 'react';
import './VerificationModal.css';
import { apiRequest } from '../../utils/api';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  showOnSignup?: boolean;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  showOnSignup = false
}) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendVerification = async () => {
    setSending(true);
    setError(null);

    try {
      await apiRequest('/api/user/send-verification-email', {
        method: 'POST',
      });

      setSent(true);
      setTimeout(() => {
        setSent(false);
      }, 3000);
    } catch (err) {
      setError('Failed to send verification email. Please try again.');
      console.error('Error sending verification email:', err);
    } finally {
      setSending(false);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="verification-modal-overlay" onClick={handleOverlayClick}>
      <div className="verification-modal-content">
        <button className="verification-modal-close" onClick={onClose}>×</button>

        <h2 className="verification-modal-title">Verify Your Email</h2>

        <p className="verification-modal-description">
          {showOnSignup
            ? `To access your free upload, please verify your email address ${userEmail}. Click the button below to receive a verification link.`
            : `Your email ${userEmail} needs to be verified to access this feature. Click the button below to receive a verification link.`
          }
        </p>

        <button
          className="verify-button"
          onClick={handleSendVerification}
          disabled={sending || sent}
        >
          {sending ? 'Sending...' : sent ? 'Email Sent!' : 'Send Verification Email'}
        </button>

        {error && <p className="verification-error">{error}</p>}
        {sent && <p className="verification-success">Verification email sent! Check your inbox.</p>}

        <p className="verification-modal-footer">
          Didn't receive the email? Check your spam folder or try resending.
        </p>
      </div>
    </div>
  );
};
