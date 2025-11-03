import React, { useState } from 'react';
import './PasswordResetRequestModal.css';

interface PasswordResetRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  onConfirm: () => Promise<void>;
}

export const PasswordResetRequestModal: React.FC<PasswordResetRequestModalProps> = ({
  isOpen,
  onClose,
  userEmail,
  onConfirm,
}) => {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSendReset = async () => {
    setSending(true);
    setError(null);

    try {
      await onConfirm();
      setSent(true);
      setTimeout(() => {
        setSent(false);
        onClose();
      }, 3000);
    } catch (err) {
      setError('Failed to send password reset email. Please try again.');
      console.error('Error sending password reset email:', err);
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
    <div className="password-reset-request-modal-overlay" onClick={handleOverlayClick}>
      <div className="password-reset-request-modal-content">
        <button className="password-reset-request-modal-close" onClick={onClose}>×</button>

        <h2 className="password-reset-request-modal-title">Reset Your Password</h2>

        <p className="password-reset-request-modal-description">
          We'll send a password reset link to {userEmail}. Click the button below to receive the link.
        </p>

        <button
          className="password-reset-request-button"
          onClick={handleSendReset}
          disabled={sending || sent}
        >
          {sending ? 'Sending...' : sent ? 'Email Sent!' : 'Send Password Reset Email'}
        </button>

        {error && <p className="password-reset-request-error">{error}</p>}
        {sent && <p className="password-reset-request-success">Password reset email sent! Check your inbox.</p>}

        <p className="password-reset-request-modal-footer">
          The link will expire in 1 hour. Check your spam folder if you don't see it.
        </p>
      </div>
    </div>
  );
};
