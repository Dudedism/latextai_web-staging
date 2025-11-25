import React from 'react';

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  statusCode?: number;
  errorMessage?: string;
}

const getErrorMessage = (statusCode?: number): string => {
  if (!statusCode) {
    return "We're sorry, but something went wrong. Our team has been notified and is working to fix this issue.";
  }

  switch (statusCode) {
    case 400:
      return "The request was invalid. Please check your file and try again.";
    case 401:
      return "Your session has expired. Please sign in again to continue.";
    case 403:
      return "You don't have permission to perform this action. Please verify your account.";
    case 404:
      return "The requested resource was not found. Please try again.";
    case 413:
      return "The file you're trying to upload is too large. Please use a smaller file.";
    case 415:
      return "The file type is not supported. Please upload a .docx or .doc file.";
    case 429:
      return "Too many requests. Please wait a moment before trying again.";
    case 500:
      return "We encountered a server error. Our team is working to fix this issue.";
    case 502:
    case 503:
      return "Our service is temporarily unavailable. Please try again in a few minutes.";
    case 504:
      return "The request timed out. Please try again.";
    default:
      return `We encountered an unexpected error (${statusCode}). Our team has been notified and is working to fix this issue.`;
  }
};

export const ErrorModal: React.FC<ErrorModalProps> = ({
  isOpen,
  onClose,
  statusCode,
  errorMessage
}) => {
  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const displayMessage = errorMessage || getErrorMessage(statusCode);

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content text-center">
        <div className="modal-icon">
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="30" stroke="#d32f2f" strokeWidth="3"/>
            <path d="M32 20V36M32 44V44.1" stroke="#d32f2f" strokeWidth="3" strokeLinecap="round"/>
          </svg>
        </div>

        <h2 className="modal-title">Something Went Wrong</h2>

        <p className="modal-message">{displayMessage}</p>

        {statusCode && (
          <p className="text-muted text-sm mb-6" style={{ fontStyle: 'italic' }}>Error Code: {statusCode}</p>
        )}

        <button className="btn btn--primary btn--lg" onClick={onClose}>
          Okay
        </button>
      </div>
    </div>
  );
};
