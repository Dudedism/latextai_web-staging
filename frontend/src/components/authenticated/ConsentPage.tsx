import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiRequest } from '../../utils/api';
import '../../styles/common.css';
import './ConsentPage.css';

const ConsentPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, templateId, templateName } = location.state || {};
  const [isChecked, setIsChecked] = React.useState(false);

  const handleAgree = async () => {
    if (!isChecked) return;

    try {
      await apiRequest('/api/user/data-consent', {
        method: 'POST',
        body: JSON.stringify({ consent: true }),
      });

      // Navigate to upload confirm page
      navigate('/papers/upload-confirm', {
        state: { file, templateId, templateName }
      });
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

      // Redirect to papers page
      navigate('/papers');
    } catch (error) {
      console.error('Error saving consent:', error);
      navigate('/papers');
    }
  };

  return (
    <div className="consent-page">
      <Banner />

      <section className="consent-main-section">
        <div className="consent-container">
          <div className="upload-progress">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step active">Consent</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
          </div>

          <h1 className="consent-title">Help Us Make OpenTypesetter Better</h1>

          <div className="consent-content">
            <p>
              We use anonymized document data only to improve formatting accuracy and the AI models behind OpenTypesetter.
            </p>

            <p>
              By allowing us to analyze how our system handles your uploads, you help us fix errors faster, make formatting
              more reliable, and develop new features that benefit everyone.
            </p>

            <p>
              <strong>Your privacy and ownership are fully protected.</strong> Your documents will never be sold, shared,
              or made public — they're used strictly inside OpenTypesetter for research and technical improvement.
            </p>

            <div className="consent-agreement-box">
              <label className="consent-agreement-label">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="consent-checkbox"
                />
                <span className="consent-agreement-text">
                  I agree to let OpenTypesetter LLC securely retain and analyze copies of my uploaded and typeset documents
                  for internal research and product-improvement purposes.
                </span>
              </label>
            </div>

            <p className="consent-note">
              – This consent is optional and can be withdrawn at any time in your account settings.<br />
              – Declining or withdrawing consent will not affect your ability to use the Service.
            </p>
          </div>

          <div className="consent-actions">
            <button className="consent-btn consent-btn-decline" onClick={handleDecline}>
              Decline
            </button>
            <button
              className="consent-btn consent-btn-agree"
              onClick={handleAgree}
              disabled={!isChecked}
            >
              Agree & Continue
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ConsentPage;
