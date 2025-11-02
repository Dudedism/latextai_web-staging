import React from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="confirm-modal-overlay" onClick={handleOverlayClick}>
      <div className="confirm-modal-content">
        <h2 className="confirm-modal-title">{title}</h2>

        <p className="confirm-modal-message">{message}</p>

        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn confirm-modal-btn-cancel" onClick={onClose}>
            {cancelText}
          </button>
          <button
            className={`confirm-modal-btn ${isDangerous ? 'confirm-modal-btn-danger' : 'confirm-modal-btn-confirm'}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
