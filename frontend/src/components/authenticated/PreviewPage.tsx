import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated, getToken } from '../../utils/auth';
import '../../styles/common.css';
import './PreviewPage.css';

const PreviewPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { id: paperId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  useEffect(() => {
    if (paperId) {
      fetchPdf();
    }
  }, [paperId]);

  const fetchPdf = async () => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/latex/project/${paperId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        console.error('Failed to fetch PDF');
      }
    } catch (error) {
      console.error('Error fetching PDF:', error);
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
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/latex/project/${paperId}/pdf`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paper_${paperId}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadTex = async () => {
    try {
      const token = getToken();
      const response = await fetch(`http://localhost:8000/api/latex/project/${paperId}/tex`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paper_${paperId}.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (response.status === 403) {
        alert('Please sign up to download LaTeX files');
      }
    } catch (error) {
      console.error('Error downloading TeX:', error);
    }
  };

  return (
    <div className="preview-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="preview-main-section">
        <div className="preview-container">
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

          {/* Quality Feedback Section */}
          <div className="feedback-section">
            <p className="feedback-question">
              Are you happy with the quality of this formatting?
            </p>
            <p className="feedback-subtext">
              If not: submit a support ticket
            </p>
            <button className="support-btn" onClick={handleGoToSupport}>
              Go to Support
            </button>
          </div>

          {/* Download Section */}
          <div className="download-sections">
            {/* Download Box 1: PDF and TeX */}
            <div className="download-box">
              <h3>Download as a .pdf or .tex here!</h3>
              <div className="download-buttons">
                <button className="download-btn pdf-btn" onClick={handleDownloadPdf}>
                  Download PDF
                </button>
                <button className="download-btn tex-btn" onClick={handleDownloadTex}>
                  Download .tex
                </button>
              </div>
            </div>

            {/* Download Box 2: Package Download */}
            <div className="download-box package-box">
              <h3>Full Package Download</h3>
              <p className="package-description">
                Your download includes the main .tex file, bibliography file (.bib),
                all extracted images in appropriate formats, pdf, and a README with
                compilation instructions.
              </p>
              <button className="download-btn package-btn" disabled>
                Download Full Package (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PreviewPage;