import React, { useState } from 'react';
import './ConsentModal.css';
import { apiRequest } from '../../utils/api';

interface ConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConsent: (consented: boolean) => void;
}

export const ConsentModal: React.FC<ConsentModalProps> = ({
  isOpen,
  onClose,
  onConsent
}) => {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleAgree = async () => {
    if (!isChecked) return;

    try {
      await apiRequest('/api/user/data-consent', {
        method: 'POST',
        body: JSON.stringify({ consent: true }),
      });

      onConsent(true);
      onClose();
    } catch (error) {
      console.error('Error saving consent:', error);
    }
  };

  const handleDecline = async () => {
    try {
      await apiRequest('/api/user/data-consent', {
        method: 'POST',
        body: JSON.stringify({ consent: false }),
      });

      onConsent(false);
      onClose();
    } catch (error) {
      console.error('Error saving consent:', error);
      onConsent(false);
      onClose();
    }
  };

  return (
    <div className="consent-modal-overlay" onClick={handleOverlayClick}>
      <div className="consent-modal-content">
        <h2 className="consent-modal-title">Help Us Make LaTexT Better</h2>

        <div className="consent-modal-text">
          <p>
            We use anonymized document data only to improve formatting accuracy and the AI models behind LaTexT.
          </p>

          <p>
            By allowing us to analyze how our system handles your uploads, you help us fix errors faster, make formatting
            more reliable, and develop new features that benefit everyone.
          </p>

          <p>
            <strong>Your privacy and ownership are fully protected.</strong> Your documents will never be sold, shared,
            or made public — they're used strictly inside LaTexT for research and technical improvement.
          </p>

          <div className="consent-modal-agreement-box">
            <label className="consent-modal-agreement-label">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="consent-modal-checkbox"
              />
              <span className="consent-modal-agreement-text">
                I agree to let OpenTypesetter LLC securely retain and analyze copies of my uploaded and typeset documents
                for internal research and product-improvement purposes.
              </span>
            </label>
          </div>

          <p className="consent-modal-note">
            – This consent is optional and can be withdrawn at any time in your account settings.<br />
            – Declining or withdrawing consent will not affect your ability to use the Service.
          </p>
        </div>

        <div className="consent-modal-actions">
          <button className="consent-modal-btn consent-modal-btn-decline" onClick={handleDecline}>
            Decline & Revoke
          </button>
          <button
            className="consent-modal-btn consent-modal-btn-agree"
            onClick={handleAgree}
            disabled={!isChecked}
          >
            Agree & Continue
          </button>
        </div>
      </div>
    </div>
  );
};
