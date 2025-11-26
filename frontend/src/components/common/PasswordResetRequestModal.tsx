import React, { useState } from 'react';

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
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content" style={{ borderRadius: '16px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        <h2 className="modal-title" style={{ fontSize: '24px', marginBottom: '16px' }}>Reset Your Password</h2>

        <p className="text-muted mb-6" style={{ lineHeight: 1.6 }}>
          We'll send a password reset link to {userEmail}. Click the button below to receive the link.
        </p>

        <button
          className="btn btn--primary btn--pill btn--full"
          onClick={handleSendReset}
          disabled={sending || sent}
        >
          {sending ? 'Sending...' : sent ? 'Email Sent!' : 'Send Password Reset Email'}
        </button>

        {error && <p className="text-error text-sm text-center mt-4">{error}</p>}
        {sent && <p className="text-success text-sm text-center mt-4 font-medium">Password reset email sent! Check your inbox.</p>}

        <p className="text-muted text-sm text-center mt-4" style={{ lineHeight: 1.5 }}>
          The link will expire in 1 hour. Check your spam folder if you don't see it.
        </p>
      </div>
    </div>
  );
};
