import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { ErrorModal } from '../common/ErrorModal';
import { ConsentModal } from '../common/ConsentModal';
import { apiFetch, apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

const UploadConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAnonymous } = useAuth();
  const { file, templateId, templateName } = location.state || {};
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'uploading' | 'validating' | 'processing' | 'success'>('uploading');
  const [fadeOut, setFadeOut] = useState(false);

  // Consent state
  const [showConsentModal, setShowConsentModal] = useState(false);

  // reCAPTCHA v2 state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaContainerRef = useRef<HTMLDivElement>(null);
  const captchaWidgetId = useRef<number | null>(null);

  // Render reCAPTCHA v2 checkbox for anonymous users
  const renderCaptcha = useCallback(() => {
    if (!isAnonymous || !captchaContainerRef.current || !window.grecaptcha) return;
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;

    // Only render once
    if (captchaWidgetId.current !== null) return;

    try {
      captchaWidgetId.current = window.grecaptcha.render(captchaContainerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(null),
      });
    } catch {
      // Widget may already be rendered (e.g. StrictMode double-mount)
    }
  }, [isAnonymous]);

  useEffect(() => {
    if (!isAnonymous) return;
    // grecaptcha may not be loaded yet — poll until ready
    if (window.grecaptcha?.render) {
      renderCaptcha();
    } else {
      const interval = setInterval(() => {
        if (window.grecaptcha?.render) {
          clearInterval(interval);
          renderCaptcha();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, [isAnonymous, renderCaptcha]);

  const doUpload = async () => {
    setIsLoading(true);
    setLoadingStage('uploading');
    setFadeOut(false);

    try {
      // STAGE 1: Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template', templateId);

      // For anonymous users, attach the CAPTCHA token
      if (isAnonymous && captchaToken) {
        formData.append('captcha_token', captchaToken);
      }

      const uploadResponse = await apiFetch('/api/latex/upload', {
        method: 'POST',
        body: formData,
      });

      // Handle duplicate upload (409) — resume with existing project
      let projectId: string;
      if (uploadResponse.status === 409) {
        const dupData = await uploadResponse.json();
        if (dupData.project_id) {
          projectId = dupData.project_id;
        } else {
          setIsLoading(false);
          setErrorStatusCode(409);
          setErrorMessage(dupData.error || 'An upload is already in progress.');
          setShowErrorModal(true);
          return;
        }
      } else if (!uploadResponse.ok) {
        setIsLoading(false);
        setErrorStatusCode(uploadResponse.status);
        setErrorMessage(undefined);
        setShowErrorModal(true);
        console.error('Failed to upload file:', uploadResponse.status);
        return;
      } else {
        const uploadData = await uploadResponse.json();
        projectId = uploadData.project_id;
      }

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

      if (validateResponse.status === 409) {
        // Already validated (concurrent request completed) — go to view
        navigate(`/papers/${projectId}/view`);
        return;
      }

      if (!validateResponse.ok) {
        setIsLoading(false);
        setErrorStatusCode(validateResponse.status);
        setErrorMessage(undefined);
        setShowErrorModal(true);
        console.error('Failed to validate file:', validateResponse.status);
        return;
      }

      const validateData = await validateResponse.json();

      // For preview uploads (anonymous or verified user previews), trigger processing immediately
      if (validateData.is_preview) {
        setFadeOut(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        setLoadingStage('processing');
        setFadeOut(false);

        const processResponse = await apiFetch('/api/latex/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: projectId }),
        });

        if (!processResponse.ok) {
          setIsLoading(false);
          setErrorStatusCode(processResponse.status);
          setErrorMessage(undefined);
          setShowErrorModal(true);
          console.error('Failed to process file:', processResponse.status);
          return;
        }
      }

      // Success - fade to green
      setFadeOut(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setLoadingStage('success');
      setFadeOut(false);
      await new Promise(resolve => setTimeout(resolve, 500));

      // Navigate to view page (payment UI is now on PreviewPage)
      navigate(`/papers/${projectId}/view`);

    } catch (error) {
      setIsLoading(false);
      setErrorStatusCode(undefined);
      setErrorMessage(undefined);
      setShowErrorModal(true);
      console.error('Error during upload/validation:', error);
    }
  };

  const handleConfirmUpload = async () => {
    if (!file || !templateId) {
      console.error('Missing file or template');
      navigate('/papers/new');
      return;
    }

    // Check consent before uploading
    try {
      const data = await apiRequest<{ consent: boolean | null }>('/api/user/data-consent', { method: 'GET' });
      if (data.consent === null || data.consent === undefined) {
        setShowConsentModal(true);
        return;
      }
    } catch {
      setShowConsentModal(true);
      return;
    }

    doUpload();
  };

  const handleConsentResult = (consented: boolean) => {
    if (!consented) {
      navigate('/papers');
      return;
    }
    doUpload();
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    navigate('/');
  };

  const handleCancel = () => {
    navigate('/papers/new', { state: { file, returnToTemplate: true } });
  };

  const getLoadingMessage = () => {
    switch (loadingStage) {
      case 'uploading':
        return "We're uploading your file...";
      case 'validating':
        return "We're validating your file...";
      case 'processing':
        return "We're processing your file...";
      case 'success':
        return "Success!";
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

  // Anonymous users must complete CAPTCHA before uploading (skip if no site key configured)
  const captchaRequired = isAnonymous && !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const canSubmit = !isLoading && (!captchaRequired || !!captchaToken);

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md text-center">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">&rarr;</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">&rarr;</div>
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

          {/* reCAPTCHA v2 checkbox for anonymous users */}
          {isAnonymous && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <div ref={captchaContainerRef}></div>
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button className="btn btn--ghost" onClick={handleCancel} disabled={isLoading}>
              &larr; Back to Picking Template
            </button>
            <button className="btn btn--primary btn--lg" onClick={handleConfirmUpload} disabled={!canSubmit}>
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

      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConsent={handleConsentResult}
      />
    </div>
  );
};

export default UploadConfirmPage;
