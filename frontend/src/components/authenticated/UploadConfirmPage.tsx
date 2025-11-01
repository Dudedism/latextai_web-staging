import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiFetch } from '../../utils/api';
import '../../styles/common.css';
import './UploadConfirmPage.css';

const UploadConfirmPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { file, templateId, templateName } = location.state || {};

  const handleConfirmUpload = async () => {
    if (!file || !templateId) {
      console.error('Missing file or template');
      navigate('/papers/new');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template', templateId);

      const response = await apiFetch('/api/latex/upload', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        navigate('/papers/processing', { state: { projectId: data.project_id } });
      } else {
        console.error('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleCancel = () => {
    navigate('/papers/new');
  };

  return (
    <div className="upload-confirm-page">
      <Banner />

      <section className="upload-confirm-section">
        <div className="upload-confirm-container">
          <div className="upload-progress">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step active">Upload</div>
          </div>

          <h1 className="page-title">Confirm Upload</h1>

          <div className="upload-summary">
            <div className="summary-item">
              <span className="summary-label">File:</span>
              <span className="summary-value">{file?.name || 'No file selected'}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Template:</span>
              <span className="summary-value">{templateName || 'No template selected'}</span>
            </div>
          </div>

          <div className="button-group">
            <button className="cancel-btn" onClick={handleCancel}>
              ← Back
            </button>
            <button className="confirm-btn" onClick={handleConfirmUpload}>
              Confirm Upload
            </button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default UploadConfirmPage;
