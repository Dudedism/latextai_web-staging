import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import ChooseTemplatePage from './ChooseTemplatePage';
import { apiRequest } from '../../utils/api';

type UploadState = 'upload' | 'preview' | 'template';

const NewPaperPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>('upload');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const state = location.state as { file?: File; returnToTemplate?: boolean } | null;
    if (state?.file && state?.returnToTemplate) {
      setUploadedFile(state.file);
      setDocumentTitle(state.file.name);
      setUploadState('template');
    }

    // Check upload eligibility — redirect if at limit
    apiRequest<{ can_upload: boolean; reason?: string }>('/api/latex/can-upload', { method: 'GET' })
      .then(data => {
        if (!data.can_upload) {
          navigate('/papers?upload_limit=true', { replace: true });
        }
      })
      .catch(() => {});
  }, []);

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

  const handleBackToFile = () => {
    setUploadedFile(null);
    setDocumentTitle('');
    setUploadState('upload');
  };

  const handleTemplateSelect = (templateId: string, templateName?: string) => {
    if (!uploadedFile) return;

    navigate('/papers/upload-confirm', {
      state: {
        file: uploadedFile,
        templateId: templateId,
        templateName: templateName || templateId
      }
    });
  };

  if (uploadState === 'template') {
    return (
      <ChooseTemplatePage onSelectTemplate={handleTemplateSelect} onBack={handleBackToFile} />
    );
  }

  const dropzoneStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '500px',
    height: '350px',
    border: `2px dashed ${isDragging ? '#000' : '#e0e0e0'}`,
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    background: isDragging ? '#f5f5f5' : 'white',
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md text-center">
          <div className="progress-steps">
            <div className={`progress-step ${uploadState === 'upload' ? 'progress-step--active' : ''}`}>File</div>
            <div className="progress-arrow">→</div>
            <div className={`progress-step ${uploadState === 'preview' ? 'progress-step--active' : ''}`}>Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
          </div>

          <h1 className="section-title">Choose Your Word Document</h1>

          {uploadState === 'upload' && (
            <div className="flex flex-col items-center gap-6">
              <div
                style={dropzoneStyles}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleClick}
              >
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" style={{ color: '#666' }}>
                  <path d="M24 8V32M24 8L16 16M24 8L32 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M8 40H40" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                <p className="text-muted">Drag or Click to Upload</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".doc,.docx"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
              </div>
              <button className="btn btn--secondary btn--pill btn--lg" disabled>
                Choose A Template →
              </button>
            </div>
          )}

          {uploadState === 'preview' && (
            <div className="flex flex-col items-center gap-6">
              <div>
                <p className="text-sm text-muted mb-2">Filename:</p>
                <p>{documentTitle}</p>
              </div>
              <button className="btn btn--secondary btn--pill btn--lg" onClick={handleChooseTemplate}>
                Choose A Template →
              </button>
              <button className="btn btn--ghost" onClick={handleBackToFile}>
                ← Choose a Different File
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