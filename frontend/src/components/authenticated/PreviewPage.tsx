import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { apiRequest, apiFetch } from '../../utils/api';
import { downloadFile } from '../../utils/download';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/common.css';
import './PreviewPage.css';

const PreviewPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [compilationFailed, setCompilationFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { id: paperId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (paperId) {
      checkStatus();
    }
  }, [paperId]);

  const checkStatus = async () => {
    try {
      const project = await apiRequest<{ status: string; compilation_failed?: boolean }>(`/api/latex/project/${paperId}`);
      const projectStatus = project.status;
      const projectCompilationFailed = project.compilation_failed || false;

      // Redirect if project is still in upload/validation stage (not yet paid/converted)
      if (projectStatus === 'uploaded' || projectStatus === 'validated') {
        console.log('🔄 [PREVIEW] Project not yet converted, redirecting to /papers');
        navigate('/papers');
        return;
      }

      // Only update status if we're currently viewing this project
      const currentPath = window.location.pathname;
      const isViewingThisProject = currentPath === `/papers/${paperId}/view`;

      if (isViewingThisProject) {
        if (projectStatus === 'converted') {
          setStatus('completed');
          setCompilationFailed(projectCompilationFailed);
          if (!projectCompilationFailed) {
            fetchPdf();
          } else {
            setLoading(false);
          }
        } else if (projectStatus === 'failed') {
          setStatus('failed');
          setCompilationFailed(projectCompilationFailed);
          setError('Document processing failed');
          setLoading(false);
        } else {
          // Still processing
          setStatus('processing');
          setCompilationFailed(false);
          // Continue polling while viewing this project
          setTimeout(checkStatus, 60000);
        }
      } else {
        console.log('🧹 [PREVIEW] User navigated away from this project view, stopping polling');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check project status');
      setLoading(false);
    } finally {
      setInitialLoading(false);
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
    // Cleanup blob URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleGoToSupport = () => {
    navigate(`/papers/${paperId}/support`);
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/pdf`, 'document.pdf');
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadTex = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/tex`, 'document.tex');
    } catch (error: any) {
      if (error.message?.includes('403')) {
        alert('Please sign up to download LaTeX files');
      } else {
        console.error('Error downloading TeX:', error);
      }
    }
  };

  const handleDownloadBib = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/bib`, 'document.bib');
    } catch (error: any) {
      if (error.message?.includes('403')) {
        alert('Please sign up to download BibTeX files');
      } else {
        console.error('Error downloading BibTeX:', error);
      }
    }
  };

  const handleDownloadPackage = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/package`, 'latex_package.zip');
    } catch (error: any) {
      if (error.message?.includes('403')) {
        alert('Please sign up to download compilation package');
      } else {
        console.error('Error downloading package:', error);
      }
    }
  };

  if (initialLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="preview-page">
      <Banner />

      <section className="preview-main-section">
        <div className="preview-container">
          {/* Processing State - No Box */}
          {status === 'processing' ? (
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
                <button className="btn btn-dark" onClick={handleGoToSupport} style={{ marginTop: '24px' }}>Contact Support</button>
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
              </div>
            </div>
          ) : status === 'completed' && !compilationFailed ? (
            <div className="preview-document-wrapper">
              {loading ? (
                <p className="loading-text">Loading PDF...</p>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  width="100%"
                  height="800px"
                  style={{ border: 'none' }}
                  title="PDF Preview"
                />
              ) : (
                <p className="error-text">Failed to load PDF</p>
              )}
            </div>
          ) : null}

          {/* Download Section - Always Visible, Disabled During Processing */}
          <div className="content-section">
            <h3 className="section-heading">Download your files here!</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                disabled={status === 'processing' || status === 'failed' || compilationFailed}
              >
                Download PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadTex}
                disabled={status === 'processing' || status === 'failed'}
              >
                Download .tex
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadBib}
                disabled={status === 'processing' || status === 'failed'}
              >
                Download .bib
              </button>
            </div>

            <h3 className="section-heading">Full Package Download</h3>
            <p className="section-description">
              Your download includes the main .tex file, bibliography file (.bib),
              all extracted images in appropriate formats, PDF, and all compilation files.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleDownloadPackage}
              disabled={status === 'processing' || status === 'failed'}
            >
              Download Full Package
            </button>
          </div>

          {/* Support Section - Only Visible When Converted */}
          {status === 'completed' && (
            <div className="content-section">
              <p className="section-heading">
                Are you happy with the quality of this formatting?
              </p>
              <p className="section-description">
                If not: submit a support ticket
              </p>
              <button className="btn btn-dark" onClick={handleGoToSupport}>
                Go to Support
              </button>
            </div>
          )}

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
    </div>
  );
};

export default PreviewPage;