import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated, getToken } from '../../utils/auth';
import '../../styles/common.css';
import './PreviewPage.css';

const PreviewPage: React.FC = () => {
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const { id: paperId } = useParams<{ id: string }>();

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

  const handleSatisfiedClick = (value: boolean) => {
    setSatisfied(value);
    if (value) {
      // If satisfied, could navigate to payment or download
      console.log('User is satisfied with formatting');
    } else {
      // If not satisfied, could offer options to reprocess
      console.log('User wants to try different formatting');
    }
  };

  return (
    <div className="preview-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="preview-main-section">
        <div className="preview-container">
        <div className="preview-content">
          <div className="preview-document">
            {loading ? (
              <p>Loading PDF...</p>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                width="100%"
                height="800px"
                style={{ border: 'none' }}
                title="PDF Preview"
              />
            ) : (
              <p>Failed to load PDF</p>
            )}
          </div>

          <div className="preview-sidebar">
            <h2 className="sidebar-title">See your first 3 pages free</h2>
            
            <div className="satisfaction-section">
              <p className="satisfaction-question">
                Are you happy with the quality of this formatting?
              </p>
              <div className="satisfaction-buttons">
                <button
                  className={`satisfaction-btn ${satisfied === true ? 'active' : ''}`}
                  onClick={() => handleSatisfiedClick(true)}
                >
                  Yes ✓
                </button>
                <button
                  className={`satisfaction-btn ${satisfied === false ? 'active' : ''}`}
                  onClick={() => handleSatisfiedClick(false)}
                >
                  No ✗
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PreviewPage;