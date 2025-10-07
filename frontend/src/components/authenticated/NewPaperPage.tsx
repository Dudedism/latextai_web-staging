import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import ChooseTemplatePage from './ChooseTemplatePage';
import { getAuthenticatedUser, isAuthenticated } from '../../utils/auth';
import '../../styles/common.css';
import './NewPaperPage.css';

type UploadState = 'upload' | 'preview' | 'template';

const NewPaperPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('upload');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0 && (files[0].name.endsWith('.docx') || files[0].name.endsWith('.doc'))) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    setUploadedFile(file);
    setDocumentTitle(file.name);
    setUploadState('preview');
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleChooseTemplate = () => {
    setUploadState('template');
  };

  const handleTemplateSelect = (templateId: string) => {
    // Map template IDs to template names
    const templateMap: { [key: string]: string } = {
      '1': 'nature',
      '2': 'the lancet',
      '3': 'springer',
      '4': 'elsevier',
      '5': 'ieee',
      '6': 'nature',
      '7': 'the lancet',
      '8': 'springer'
    };

    const template = templateMap[templateId] || 'nature';

    // Navigate to upload confirmation page
    if (uploadedFile) {
      navigate('/papers/upload-confirm', {
        state: {
          file: uploadedFile,
          template: template
        }
      });
    }
  };

  if (uploadState === 'template') {
    return <ChooseTemplatePage onSelectTemplate={handleTemplateSelect} />;
  }

  return (
    <div className="new-paper-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="new-paper-main-section">
        <div className="new-paper-container">
        <div className="upload-progress">
          <div className="progress-step active">File</div>
          <div className="progress-arrow">→</div>
          <div className={`progress-step ${uploadState === 'preview' ? 'active' : ''}`}>Template</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step">Upload</div>
        </div>

        <h1 className="page-title">Choose Your Word Document</h1>

        {uploadState === 'upload' && (
          <div className="upload-section">
            <div 
              className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClick}
            >
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <path d="M24 8V32M24 8L16 16M24 8L32 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 40H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <p className="upload-text">Drag or Click to Upload</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".doc,.docx"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </div>
            <button className="template-btn" disabled>
              Choose A Template →
            </button>
          </div>
        )}

        {uploadState === 'preview' && (
          <div className="preview-section">
            <div className="preview-info">
              <p className="document-title">
                <strong>Filename:</strong><br />
                {documentTitle}
              </p>
            </div>
            <button className="template-btn" onClick={handleChooseTemplate}>
              Choose A Template →
            </button>
          </div>
        )}
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default NewPaperPage;