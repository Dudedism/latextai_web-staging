import React, { useState } from 'react';
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
    <div className="modal-overlay" onClick={handleOverlayClick} style={{ padding: '20px', overflowY: 'auto' }}>
      <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="modal-title" style={{ fontSize: '32px', marginBottom: '32px' }}>Help Us Make LaTexT Better</h2>

        <div style={{ color: '#333', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '20px' }}>
            We use anonymized document data only to improve formatting accuracy and the AI models behind LaTexT.
          </p>

          <p style={{ marginBottom: '20px' }}>
            By allowing us to analyze how our system handles your uploads, you help us fix errors faster, make formatting
            more reliable, and develop new features that benefit everyone.
          </p>

          <p style={{ marginBottom: '20px' }}>
            <strong>Your privacy and ownership are fully protected.</strong> Your documents will never be sold, shared,
            or made public — they're used strictly inside LaTexT for research and technical improvement.
          </p>

          <div style={{ margin: '32px 0', padding: '24px', background: '#f8f8f8', borderRadius: '8px', border: '2px solid #e0e0e0' }}>
            <label style={{ display: 'flex', gap: '12px', cursor: 'pointer', alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }}
              />
              <span style={{ fontSize: '15px', lineHeight: 1.6, flex: 1 }}>
                I agree to let OpenTypesetter LLC securely retain and analyze copies of my uploaded and typeset documents
                for internal research and product-improvement purposes.
              </span>
            </label>
          </div>

          <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>
            – This consent is optional and can be withdrawn at any time in your account settings.<br />
            – Declining or withdrawing consent will not affect your ability to use the Service.
          </p>
        </div>

        <div className="modal-actions mt-8">
          <button className="btn btn--danger btn--lg" onClick={handleDecline}>
            Decline & Revoke
          </button>
          <button
            className="btn btn--primary btn--lg"
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
