import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { apiRequest, apiFetch } from '../../utils/api';
import { downloadFile } from '../../utils/download';
import { useAuth } from '../../contexts/AuthContext';
import './PreviewPage.css';

const FAST_POLL_INTERVAL = 5000;
const SLOW_POLL_INTERVAL = 60000;
const PAYMENT_TIMEOUT = 30000;

interface ProjectResponse {
  status: string;
  paid?: boolean;
  is_preview?: boolean;
  compilation_failed?: boolean;
  feedback?: 'positive' | 'negative' | null;
}

interface PaymentDetails {
  cost_estimate: {
    total_credits: number;
    total_dollars: number;
  };
  can_use_free: boolean;
  credit_balance: number;
  has_sufficient_credits: boolean;
}

const PreviewPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'awaiting_payment' | 'processing' | 'completed' | 'failed'>('processing');
  const [compilationFailed, setCompilationFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [projectPaid, setProjectPaid] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { id: paperId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin, isAnonymous, user } = useAuth();

  const isPaymentFlow = searchParams.get('payment_success') === 'true';
  const isSetupSuccess = searchParams.get('setup_success') === 'true';
  const paymentStartTime = useRef<number | null>(null);
  const hasCalledProcess = useRef(false);
  const claimingRef = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle Stripe setup return (free upload claim)
  useEffect(() => {
    if (isSetupSuccess && paperId && !claimingRef.current) {
      claimingRef.current = true;
      setSearchParams({});
      claimFreeAfterSetup();
    }
  }, [isSetupSuccess, paperId]);

  const claimFreeAfterSetup = async () => {
    if (!paperId) return;
    setPaymentLoading(true);
    try {
      await apiRequest('/api/latex/claim-free', {
        method: 'POST',
        body: JSON.stringify({ project_id: paperId })
      });
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: paperId })
      });
      setProjectPaid(true);
      setIsPreview(false);
      setStatus('processing');
      pollTimeoutRef.current = setTimeout(checkStatus, SLOW_POLL_INTERVAL);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to claim free upload');
      setShowErrorModal(true);
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if (paperId) {
      if (isPaymentFlow) {
        paymentStartTime.current = Date.now();
        hasCalledProcess.current = false;
        setStatus('awaiting_payment');
      }
      if (!isSetupSuccess) {
        checkStatus();
      }
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [paperId]);

  const checkStatus = async () => {
    try {
      const project = await apiRequest<ProjectResponse>(`/api/latex/project/${paperId}`);
      const projectStatus = project.status;
      const paid = project.paid || false;
      const preview = project.is_preview || false;
      const projectCompilationFailed = project.compilation_failed || false;
      setFeedback(project.feedback || null);
      setProjectPaid(paid);
      setIsPreview(preview);

      const currentPath = window.location.pathname;
      const isViewingThisProject = currentPath === `/papers/${paperId}/view`;

      if (!isViewingThisProject) {
        return;
      }

      if (isPaymentFlow && !hasCalledProcess.current) {
        if (paid) {
          hasCalledProcess.current = true;
          setStatus('processing');
          try {
            await apiRequest('/api/latex/process', {
              method: 'POST',
              body: JSON.stringify({ project_id: paperId })
            });
            pollTimeoutRef.current = setTimeout(checkStatus, SLOW_POLL_INTERVAL);
          } catch (processError: any) {
            setErrorMessage(processError.message || 'Failed to start document processing');
            setShowErrorModal(true);
          }
          return;
        }

        if (paymentStartTime.current && Date.now() - paymentStartTime.current > PAYMENT_TIMEOUT) {
          setErrorMessage('Payment verification timed out. Please try again or contact us at contact@latext.ai.');
          setShowErrorModal(true);
          return;
        }

        setStatus('awaiting_payment');
        pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
        setInitialLoading(false);
        return;
      }

      if (projectStatus === 'uploaded' || projectStatus === 'validated') {
        // For unpaid/preview projects that are validated, fetch payment details
        if (!paid && !isPaymentFlow) {
          fetchPaymentDetails();
        }
        if (!isPaymentFlow && !preview) {
          navigate('/papers');
        }
        return;
      }

      if (projectStatus === 'converted') {
        setStatus('completed');
        setCompilationFailed(projectCompilationFailed);
        if (!projectCompilationFailed) {
          fetchPdf();
        } else {
          setLoading(false);
        }
        // Fetch payment details for unpaid projects
        if (!paid) {
          fetchPaymentDetails();
        }
      } else if (projectStatus === 'failed') {
        setStatus('failed');
        setCompilationFailed(projectCompilationFailed);
        setError('Document processing failed');
        setLoading(false);
      } else {
        setStatus('processing');
        setCompilationFailed(false);
        pollTimeoutRef.current = setTimeout(checkStatus, SLOW_POLL_INTERVAL);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check project status');
      setLoading(false);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchPaymentDetails = async () => {
    try {
      const details = await apiRequest<PaymentDetails>(`/api/latex/project/${paperId}/payment-details`);
      setPaymentDetails(details);
    } catch {
      // Payment details not available (already paid, etc.) — ignore
    }
  };

  const fetchPdf = async () => {
    try {
      const response = await apiFetch(`/api/latex/project/${paperId}/pdf`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        setError('Failed to load PDF');
      }
    } catch (error) {
      console.error('Error fetching PDF:', error);
      setError('Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/pdf`, 'document.pdf');
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadTex = async () => {
    if (!projectPaid) {
      if (isAnonymous) {
        navigate('/signup');
      }
      return;
    }
    try {
      await downloadFile(`/api/latex/project/${paperId}/tex`, 'document.tex');
    } catch (error) {
      console.error('Error downloading TeX:', error);
    }
  };

  const handleDownloadBib = async () => {
    if (!projectPaid) {
      if (isAnonymous) {
        navigate('/signup');
      }
      return;
    }
    try {
      await downloadFile(`/api/latex/project/${paperId}/bib`, 'document.bib');
    } catch (error) {
      console.error('Error downloading BibTeX:', error);
    }
  };

  const handleDownloadPackage = async () => {
    if (!projectPaid) {
      if (isAnonymous) {
        navigate('/signup');
      }
      return;
    }
    try {
      await downloadFile(`/api/latex/project/${paperId}/package`, 'latex_package.zip');
    } catch (error) {
      console.error('Error downloading package:', error);
    }
  };

  const handleUseFreeUpload = async () => {
    if (!paperId) return;
    setPaymentLoading(true);
    try {
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: paperId, use_free_upload: true })
      });
      setProjectPaid(true);
      setIsPreview(false);
      setStatus('processing');
      pollTimeoutRef.current = setTimeout(checkStatus, SLOW_POLL_INTERVAL);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to start processing');
      setShowErrorModal(true);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleProcessWithCredits = async () => {
    if (!paperId) return;
    setPaymentLoading(true);
    try {
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: paperId })
      });
      setProjectPaid(true);
      setIsPreview(false);
      setStatus('processing');
      pollTimeoutRef.current = setTimeout(checkStatus, SLOW_POLL_INTERVAL);
    } catch (error: any) {
      if (error.status === 402) {
        navigate('/credits');
      } else {
        setErrorMessage(error.message || 'Failed to process document');
        setShowErrorModal(true);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleFeedback = async (value: 'positive' | 'negative') => {
    if (feedback !== null) return;
    try {
      await apiRequest(`/api/latex/project/${paperId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback: value }),
      });
      setFeedback(value);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  // Determine what upgrade CTA to show
  const needsUpgrade = !projectPaid && (isPreview || status === 'completed');
  const isDisabled = status === 'awaiting_payment' || status === 'processing' || status === 'failed';

  if (initialLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="preview-page">
      <Banner />

      <section className="preview-main-section">
        <div className="preview-container">
          {/* Awaiting Payment Confirmation */}
          {status === 'awaiting_payment' ? (
            <div className="processing-state">
              <div className="processing-circle">
                <div className="circle-outer">
                  <div className="circle-inner">
                    <svg
                      className="progress-ring spinning"
                      width="320"
                      height="320"
                      viewBox="0 0 320 320"
                    >
                      <circle
                        className="progress-ring-bg"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        className="progress-ring-fill"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="400 942"
                        transform="rotate(-90 160 160)"
                      />
                    </svg>
                    <div className="processing-text">
                      <h2 className="processing-title">Confirming Payment...</h2>
                      <p className="processing-subtitle">Please wait while we verify your payment.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : status === 'processing' ? (
            <div className="processing-state">
              <div className="processing-circle">
                <div className="circle-outer">
                  <div className="circle-inner">
                    <svg
                      className="progress-ring spinning"
                      width="320"
                      height="320"
                      viewBox="0 0 320 320"
                    >
                      <circle
                        className="progress-ring-bg"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        className="progress-ring-fill"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="400 942"
                        transform="rotate(-90 160 160)"
                      />
                    </svg>
                    <div className="processing-text">
                      <h2 className="processing-title">Processing Your Document...</h2>
                      <p className="processing-subtitle">Your document is being converted to LaTeX format and compiled. This may take a few minutes.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : status === 'failed' ? (
            <div className="processing-state">
              <div className="error-state">
                <h2 className="processing-title">Processing Failed</h2>
                <p className="processing-subtitle">{error || 'An error occurred while processing your document.'}</p>
                <p className="processing-subtitle" style={{ marginTop: '16px' }}>
                  Please contact us at <a href="mailto:contact@latext.ai" style={{ color: '#2196f3', fontWeight: 600 }}>contact@latext.ai</a>
                </p>
              </div>
            </div>
          ) : status === 'completed' && compilationFailed ? (
            <div className="processing-state">
              <div className="error-state">
                <h2 className="processing-title">PDF Compilation Failed</h2>
                <p className="processing-subtitle" style={{ maxWidth: '600px', margin: '0 auto' }}>
                  Your document was successfully converted to LaTeX, but PDF compilation encountered an error.
                </p>
                <p className="processing-subtitle" style={{ maxWidth: '600px', margin: '16px auto 0' }}>
                  You can still download the .tex file, .bib file, and full compilation package below to compile locally.
                </p>
                <p className="processing-subtitle" style={{ marginTop: '16px' }}>
                  Need help? Contact us at <a href="mailto:contact@latext.ai" style={{ color: '#2196f3', fontWeight: 600 }}>contact@latext.ai</a>
                </p>
              </div>
            </div>
          ) : status === 'completed' && !compilationFailed ? (
            <div className="preview-document-wrapper">
              {loading ? (
                <p className="loading-text">Loading PDF...</p>
              ) : pdfUrl ? (
                <>
                  {isPreview && !projectPaid && (
                    <div style={{
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}>
                      This is a 3-page preview. {isAnonymous ? 'Sign up to see the full document for free!' : 'Pay to unlock the full document and source files.'}
                    </div>
                  )}
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800px"
                    style={{ border: 'none' }}
                    title="PDF Preview"
                  />
                </>
              ) : (
                <p className="error-text">Failed to load PDF</p>
              )}
            </div>
          ) : null}

          {/* Upgrade / Payment Section */}
          {needsUpgrade && status === 'completed' && (
            <div className="content-section" style={{
              background: '#f8f9fa',
              border: '2px solid #e0e0e0',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'center'
            }}>
              {isAnonymous ? (
                <>
                  <h3 className="section-heading">Want the full document?</h3>
                  <p style={{ marginBottom: '16px', color: '#666' }}>
                    Sign up to see the full PDF for free and unlock the complete LaTeX source package.
                  </p>
                  <button
                    className="btn btn--primary btn--lg btn--pill"
                    onClick={() => navigate('/signup')}
                  >
                    Sign Up Free
                  </button>
                </>
              ) : (
                <>
                  <h3 className="section-heading">Unlock Full Access</h3>
                  <p style={{ marginBottom: '16px', color: '#666' }}>
                    Pay to download the full PDF, .tex source, .bib file, and complete compilation package.
                  </p>
                  {paymentDetails?.can_use_free && (
                    <button
                      className="btn btn--primary btn--lg btn--pill"
                      onClick={handleUseFreeUpload}
                      disabled={paymentLoading}
                      style={{ marginBottom: '8px' }}
                    >
                      {paymentLoading ? 'Processing...' : 'Use Free Upload'}
                    </button>
                  )}
                  {paymentDetails?.has_sufficient_credits && (
                    <button
                      className="btn btn--primary btn--lg btn--pill"
                      onClick={handleProcessWithCredits}
                      disabled={paymentLoading}
                      style={{ marginLeft: paymentDetails?.can_use_free ? '8px' : '0' }}
                    >
                      {paymentLoading ? 'Processing...' : `Pay ${paymentDetails.cost_estimate.total_credits} Credits`}
                    </button>
                  )}
                  {!paymentDetails?.has_sufficient_credits && !paymentDetails?.can_use_free && (
                    <button
                      className="btn btn--primary btn--lg btn--pill"
                      onClick={() => navigate('/credits')}
                    >
                      Top Up Credits
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Feedback Section - Only show when completed and paid */}
          {status === 'completed' && projectPaid && (
            <div className="content-section">
              <h3 className="section-heading">
                {feedback ? 'Thanks for your feedback!' : 'How was the output quality?'}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <button
                  onClick={() => handleFeedback('positive')}
                  disabled={feedback !== null}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: feedback === 'positive' ? '3px solid #4caf50' : '2px solid #e0e0e0',
                    background: feedback === 'positive' ? '#e8f5e9' : 'white',
                    cursor: feedback !== null ? 'default' : 'pointer',
                    opacity: feedback !== null && feedback !== 'positive' ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Good"
                >
                  <img src="/green-thumbs-up-11246.svg" alt="Thumbs up" width="28" height="28" />
                </button>
                <button
                  onClick={() => handleFeedback('negative')}
                  disabled={feedback !== null}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: feedback === 'negative' ? '3px solid #f44336' : '2px solid #e0e0e0',
                    background: feedback === 'negative' ? '#ffebee' : 'white',
                    cursor: feedback !== null ? 'default' : 'pointer',
                    opacity: feedback !== null && feedback !== 'negative' ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Bad"
                >
                  <img src="/thumbs-down-14922.svg" alt="Thumbs down" width="28" height="28" />
                </button>
              </div>
            </div>
          )}

          {/* Download Section */}
          <div className="content-section">
            <h3 className="section-heading">Download your files here!</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                disabled={isDisabled || compilationFailed}
              >
                Download PDF {isPreview && !projectPaid ? '(Preview)' : ''}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadTex}
                disabled={isDisabled || !projectPaid}
                title={!projectPaid ? 'Payment required' : ''}
                style={{ opacity: !projectPaid ? 0.5 : 1 }}
              >
                Download .tex {!projectPaid ? '(Locked)' : ''}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadBib}
                disabled={isDisabled || !projectPaid}
                title={!projectPaid ? 'Payment required' : ''}
                style={{ opacity: !projectPaid ? 0.5 : 1 }}
              >
                Download .bib {!projectPaid ? '(Locked)' : ''}
              </button>
            </div>

            <h3 className="section-heading">Full Package Download</h3>
            <p className="section-description">
              Your download includes the main .tex file, bibliography file (.bib),
              all extracted images in appropriate formats, PDF, and all compilation files.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleDownloadPackage}
                disabled={isDisabled || !projectPaid}
                title={!projectPaid ? 'Payment required' : ''}
                style={{ opacity: !projectPaid ? 0.5 : 1 }}
              >
                Download Full Package {!projectPaid ? '(Locked)' : ''}
              </button>
            </div>
          </div>

          {/* Admin Debug Controls */}
          {isAdmin && (
            <div className="content-section" style={{ borderTop: '2px solid #e74c3c', marginTop: '2rem', paddingTop: '1rem' }}>
              <h3 className="section-heading" style={{ color: '#e74c3c' }}>Admin Debug Controls</h3>
              <div className="button-group" style={{ flexDirection: 'column', gap: '0.5rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setStatus('completed');
                    setCompilationFailed(false);
                    setLoading(false);
                    setError(null);
                    setPdfUrl('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf');
                  }}
                >
                  Mock: Converted + Compilation Success
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setStatus('completed');
                    setCompilationFailed(true);
                    setLoading(false);
                    setError(null);
                    setPdfUrl(null);
                  }}
                >
                  Mock: Converted + Compilation Failed
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setStatus('failed');
                    setCompilationFailed(true);
                    setLoading(false);
                    setError('Document processing failed');
                    setPdfUrl(null);
                  }}
                >
                  Mock: Failed + Compilation Failed
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setStatus('processing');
                    setCompilationFailed(false);
                    setLoading(true);
                    setError(null);
                    setPdfUrl(null);
                  }}
                >
                  Mock: Processing + Compilation N/A
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={handleErrorModalClose}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default PreviewPage;
