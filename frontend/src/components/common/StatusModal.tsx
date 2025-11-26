import React, { useEffect } from 'react';

export type StatusType = 'success' | 'error' | 'loading';

interface StatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: StatusType;
  title: string;
  message: string;
  submessage?: string;
  autoCloseMs?: number;
  onAutoClose?: () => void;
  showCloseButton?: boolean;
  actionButton?: {
    label: string;
    onClick: () => void;
  };
}

export const StatusModal: React.FC<StatusModalProps> = ({
  isOpen,
  onClose,
  status,
  title,
  message,
  submessage,
  autoCloseMs,
  onAutoClose,
  showCloseButton = true,
  actionButton,
}) => {
  useEffect(() => {
    if (!isOpen || !autoCloseMs) return;

    const timer = setTimeout(() => {
      if (onAutoClose) {
        onAutoClose();
      } else {
        onClose();
      }
    }, autoCloseMs);

    return () => clearTimeout(timer);
  }, [isOpen, autoCloseMs, onAutoClose, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && showCloseButton) {
      onClose();
    }
  };

  const renderIcon = () => {
    if (status === 'loading') {
      return <div className="spinner spinner--lg" />;
    }

    if (status === 'success') {
      return (
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="30" stroke="var(--color-success)" strokeWidth="3" />
          <path
            d="M20 32L28 40L44 24"
            stroke="var(--color-success)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    return (
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
        <circle cx="32" cy="32" r="30" stroke="var(--color-error)" strokeWidth="3" />
        <path
          d="M32 20V36M32 44V44.1"
          stroke="var(--color-error)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    );
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content text-center">
        {showCloseButton && (
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        )}

        <div className="modal-icon">{renderIcon()}</div>

        <h2 className="modal-title">{title}</h2>

        <p className="modal-message">{message}</p>

        {submessage && (
          <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-6)' }}>
            {submessage}
          </p>
        )}

        {actionButton && (
          <button className="btn btn--primary btn--lg" onClick={actionButton.onClick}>
            {actionButton.label}
          </button>
        )}
      </div>
    </div>
  );
};
