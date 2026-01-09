import React, { useState } from 'react';
import { apiRequest } from '../../utils/api';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  userEmail
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
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ borderRadius: '16px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2 className="modal-title" style={{ fontSize: '24px', marginBottom: '16px' }}>Verify Your Email</h2>

        <p className="text-muted mb-6" style={{ lineHeight: 1.6 }}>
          Please verify your email address ({userEmail}). Click the button below to receive a verification link.
        </p>

        <button
          className="btn btn--primary btn--pill btn--full"
          onClick={handleSendVerification}
          disabled={sending || sent}
        >
          {sending ? 'Sending...' : sent ? 'Email Sent!' : 'Send Verification Email'}
        </button>

        {error && <p className="text-error text-sm text-center mt-4">{error}</p>}
        {sent && <p className="text-success text-sm text-center mt-4 font-medium">Verification email sent! Check your inbox.</p>}

        <p className="text-muted text-sm text-center mt-4" style={{ lineHeight: 1.5 }}>
          Didn't receive the email? Check your spam folder or try resending.
        </p>
      </div>
    </div>
  );
};
