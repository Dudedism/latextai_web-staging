import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import ChooseTemplatePage from './ChooseTemplatePage';
import { getAuthenticatedUser, isAuthenticated, getToken } from '../../utils/auth';
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
  const [previewContent, setPreviewContent] = useState('');

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
    setDocumentTitle(file.name.replace(/\.(docx?|doc)$/, ''));
    
    // Simulate reading file content for preview
    const reader = new FileReader();
    reader.onload = () => {
      // Mock preview content since we can't actually read Word files in browser
      setPreviewContent(`Microsoft Word Tips and Tricks

Increase or programmatically develop speed awareness and formatting solutions. Work on some formatting to Improve Business with direct formats through use of MS Word.

Headers and Footers
Creating headers is best to bring the design of even a basic of your document. A header which is well- formatted indicates the Word page, [MS], date and much details date and shown on each margin to increase the text bars for the header. (1) Use the format-text integrated function to add text before the right, (2) see you can adjust the font and sizing for them, (3) switch to Footer function to any fonts left header. The header function is, by default used, also offers you can access by inserting headers for even pages and odd pages.

Tables in Word will happen to the bottom margin of every page. Essentially, the pages of modern guides are numbered in the header, and in footer is cited by the macro browsing your completed document.

Footnotes are fantastic features that allow you to add additional information for your readers. Place the cursor in a page, and go the bottom margin, make any References tab. The cursor "Insert footenote" is used. The tab will initiate the context formatting with superscripted notation in them. A footnote for your choice to select from your application. Make sure to provide information that is helpful and references will continue responsible throughout the whole paper unless you select "[1], (2] insert reference section and appear. Insert a cell page under the formatting change font. The Standard Selected for Movement: You can also use other style elements to create a set foothold list for all the bottom will appear in a floating text display, so you can decide what what each pointer will contain, command giving to the bottom of each page.]

title
something.wordx`);
    };
    reader.readAsText(file);
    
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

  const handleTemplateSelect = async (templateId: string) => {
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

    // Upload file with selected template
    if (uploadedFile) {
      try {
        const formData = new FormData();
        formData.append('file', uploadedFile);
        formData.append('template', template);

        const token = getToken();
        const response = await fetch('http://localhost:8000/api/latex/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          // Navigate to preview page with the project ID
          navigate(`/papers/${data.project_id}/view`);
        } else {
          console.error('Failed to upload file');
        }
      } catch (error) {
        console.error('Error uploading file:', error);
      }
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
          <div className="progress-step active">Upload</div>
          <div className="progress-arrow">→</div>
          <div className={`progress-step ${uploadState === 'preview' ? 'active' : ''}`}>Template</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step">Preview</div>
        </div>

        <h1 className="page-title">Upload Your Word Document</h1>

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
            <div className="document-preview">
              <div className="preview-content">
                <pre>{previewContent}</pre>
              </div>
            </div>
            <div className="preview-info">
              <p className="document-title">
                <strong>title</strong><br />
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