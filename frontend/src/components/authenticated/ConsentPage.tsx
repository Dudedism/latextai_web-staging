import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiRequest } from '../../utils/api';

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

      navigate('/papers');
    } catch (error) {
      console.error('Error saving consent:', error);
      navigate('/papers');
    }
  };

  const checkboxBoxStyle: React.CSSProperties = {
    margin: '32px 0',
    padding: '24px',
    background: '#f8f8f8',
    borderRadius: '8px',
    border: '2px solid #e0e0e0',
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step progress-step--active">Consent</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
          </div>

          <h1 className="section-title text-center">Help Us Make LaTexT Better</h1>

          <div style={{ lineHeight: 1.6 }}>
            <p className="mb-5">
              We use anonymized document data only to improve formatting accuracy and the AI models behind LaTexT.
            </p>

            <p className="mb-5">
              By allowing us to analyze how our system handles your uploads, you help us fix errors faster, make formatting
              more reliable, and develop new features that benefit everyone.
            </p>

            <p className="mb-5">
              <strong>Your privacy and ownership are fully protected.</strong> Your documents will never be sold, shared,
              or made public — they're used strictly inside LaTexT for research and technical improvement.
            </p>

            <div style={checkboxBoxStyle}>
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                />
                <span>
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

          <div className="flex gap-4 justify-center mt-8">
            <button className="btn btn--danger btn--lg" onClick={handleDecline}>
              Decline
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
      </section>

      <Footer />
    </div>
  );
};

export default ConsentPage;
