import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import './ProcessingPage.css';

const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const projectId = location.state?.projectId;

  useEffect(() => {
    // Show the animation for 2 seconds then navigate to preview
    const timer = setTimeout(() => {
      if (projectId) {
        navigate(`/papers/${projectId}/view`);
      } else {
        console.error('No project ID provided');
        navigate('/papers');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate, projectId]);

  return (
    <div className="processing-page">
      <Banner />
      
      <section className="processing-main-section">
        <div className="processing-container">
        <div className="processing-progress">
          <div className="progress-step">File</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step">Template</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step active">Upload</div>
        </div>

        <div className="processing-content">
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
                  <h1 className="processing-title">Processing Your Paper</h1>
                  <p className="processing-subtitle">Converting to your selected template...</p>
                </div>
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

export default ProcessingPage;