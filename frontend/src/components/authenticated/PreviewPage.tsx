import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { apiRequest, apiFetch } from '../../utils/api';
import { downloadFile } from '../../utils/download';
import '../../styles/common.css';
import './PreviewPage.css';

const PreviewPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'processing' | 'completed' | 'failed'>('processing');
  const [error, setError] = useState<string | null>(null);
  const { id: paperId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    if (paperId) {
      checkStatus();
    }
  }, [paperId]);

  const checkStatus = async () => {
    try {
      const project = await apiRequest<{ status: string }>(`/api/latex/project/${paperId}`);
      const projectStatus = project.status;

      // Only update status if we're currently viewing this project
      const currentPath = window.location.pathname;
      const isViewingThisProject = currentPath === `/papers/${paperId}/view`;

      if (isViewingThisProject) {
        if (projectStatus === 'converted') {
          setStatus('completed');
          fetchPdf();
        } else if (projectStatus === 'failed') {
          setStatus('failed');
          setError('Document processing failed');
          setLoading(false);
        } else {
          // Still processing
          setStatus('processing');
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
      await downloadFile(`/api/latex/project/${paperId}/pdf`, `paper_${paperId}.pdf`);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadTex = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/tex`, `paper_${paperId}.tex`);
    } catch (error: any) {
      if (error.message?.includes('403')) {
        alert('Please sign up to download LaTeX files');
      } else {
        console.error('Error downloading TeX:', error);
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
                      <p className="processing-subtitle">Your document is being converted to LaTeX format. This may take a few minutes.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="preview-document-wrapper">
              {status === 'failed' ? (
                <div className="error-state">
                  <h2>Processing Failed</h2>
                  <p>{error || 'An error occurred while processing your document.'}</p>
                  <button onClick={handleGoToSupport}>Contact Support</button>
                </div>
              ) : loading ? (
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
          )}

          {/* Download Section - Always Visible, Disabled During Processing */}
          <div className="content-section">
            <h3 className="section-heading">Download as a .pdf or .tex here!</h3>
            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleDownloadPdf}
                disabled={status === 'processing'}
              >
                Download PDF
              </button>
              <button
                className="btn btn-primary"
                onClick={handleDownloadTex}
                disabled={status === 'processing'}
              >
                Download .tex
              </button>
            </div>

            <h3 className="section-heading">Full Package Download</h3>
            <p className="section-description">
              Your download includes the main .tex file, bibliography file (.bib),
              all extracted images in appropriate formats, pdf, and a README with
              compilation instructions.
            </p>
            <button className="btn btn-primary" disabled>
              Download Full Package (Coming Soon)
            </button>
          </div>

          {/* Support Section - Always Visible At Bottom */}
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
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PreviewPage;