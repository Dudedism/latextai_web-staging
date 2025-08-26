import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from './Banner';
import Footer from './Footer';
import '../styles/common.css';
import './ProcessingPage.css';

const ProcessingPage: React.FC = () => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Simulate processing progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          // Navigate to preview page after processing
          setTimeout(() => {
            navigate('/papers/1/view');
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="processing-page">
      <Banner isAuthenticated={true} />
      
      <section className="processing-main-section">
        <div className="processing-container">
        <div className="processing-progress">
          <div className="progress-step">Upload</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step">Template</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step active">Preview</div>
        </div>

        <div className="processing-content">
          <div className="processing-circle">
            <div className="circle-outer">
              <div className="circle-inner">
                <svg
                  className="progress-ring"
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
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 150}`}
                    strokeDashoffset={`${2 * Math.PI * 150 * (1 - progress / 100)}`}
                    transform="rotate(-90 160 160)"
                  />
                </svg>
                <div className="processing-text">
                  <h1 className="processing-title">Processing Your Paper</h1>
                  <p className="processing-subtitle">This should take just a few minutes.</p>
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