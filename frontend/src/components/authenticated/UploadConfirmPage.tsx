import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { ErrorModal } from '../common/ErrorModal';
import { apiFetch } from '../../utils/api';

const UploadConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, templateId, templateName } = location.state || {};
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'uploading' | 'validating' | 'success'>('uploading');
  const [fadeOut, setFadeOut] = useState(false);

  const handleConfirmUpload = async () => {
    if (!file || !templateId) {
      console.error('Missing file or template');
      navigate('/papers/new');
      return;
    }

    setIsLoading(true);
    setLoadingStage('uploading');
    setFadeOut(false);

    try {
      // STAGE 1: Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template', templateId);

      const uploadResponse = await apiFetch('/api/latex/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        setIsLoading(false);
        setErrorStatusCode(uploadResponse.status);
        setErrorMessage(undefined);
        setShowErrorModal(true);
        console.error('Failed to upload file:', uploadResponse.status);
        return;
      }

      const uploadData = await uploadResponse.json();
      const projectId = uploadData.project_id;

      // Fade to green briefly before transition
      setFadeOut(true);
      await new Promise(resolve => setTimeout(resolve, 300));

      // STAGE 2: Validate file
      setLoadingStage('validating');
      setFadeOut(false);

      const validateResponse = await apiFetch('/api/latex/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ project_id: projectId }),
      });

      if (!validateResponse.ok) {
        setIsLoading(false);
        setErrorStatusCode(validateResponse.status);
        setErrorMessage(undefined);
        setShowErrorModal(true);
        console.error('Failed to validate file:', validateResponse.status);
        return;
      }

      const validateData = await validateResponse.json();

      // Success - fade to green
      setLoadingStage('success');
      setFadeOut(true);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to payment page with validation results
      navigate(`/papers/${projectId}/payment`, {
        state: {
          costEstimate: validateData.cost_estimate,
          metadata: validateData.metadata,
          canUseFree: uploadData.can_use_free
        }
      });

    } catch (error) {
      setIsLoading(false);
      setErrorStatusCode(undefined);
      setErrorMessage(undefined);
      setShowErrorModal(true);
      console.error('Error during upload/validation:', error);
    }
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/papers/new');
  };

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'uploading':
        return "We're uploading your file...";
      case 'validating':
        return "We're validating your file...";
      case 'success':
        return "Success!";
      default:
        return "Processing...";
    }
  };

  const loadingOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: loadingStage === 'success' ? 'rgba(46, 125, 50, 0.95)' : 'rgba(0, 0, 0, 0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    transition: 'all 0.3s ease',
    opacity: fadeOut ? 0.7 : 1,
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md text-center">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step progress-step--active">Upload</div>
          </div>

          <h1 className="section-title">Confirm Upload</h1>

          <div className="detail-grid mb-8">
            <div className="detail-item">
              <span className="detail-label">File:</span>
              <span className="detail-value">{file?.name || 'No file selected'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Template:</span>
              <span className="detail-value">{templateName || 'No template selected'}</span>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button className="btn btn--secondary btn--lg" onClick={handleCancel} disabled={isLoading}>
              ← Back
            </button>
            <button className="btn btn--primary btn--lg" onClick={handleConfirmUpload} disabled={isLoading}>
              Confirm Upload
            </button>
          </div>
        </div>
      </section>

      <Footer />

      {isLoading && (
        <div style={loadingOverlayStyle}>
          <div className="text-center" style={{ color: 'white' }}>
            <div className="spinner spinner--lg" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)', margin: '0 auto 24px' }}></div>
            <p style={{ fontSize: '18px' }}>{getLoadingMessage()}</p>
          </div>
        </div>
      )}

      <ErrorModal
        isOpen={showErrorModal}
        onClose={handleErrorModalClose}
        statusCode={errorStatusCode}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default UploadConfirmPage;
