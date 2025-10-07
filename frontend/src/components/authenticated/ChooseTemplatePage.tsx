import React, { useState } from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated } from '../../utils/auth';
import '../../styles/common.css';
import './ChooseTemplatePage.css';

interface Template {
  id: string;
  name: string;
  publisher: string;
  year: string;
  thumbnail: string;
}

interface ChooseTemplatePageProps {
  onSelectTemplate?: (templateId: string) => void;
}

const ChooseTemplatePage: React.FC<ChooseTemplatePageProps> = ({ onSelectTemplate }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  const templates: Template[] = [
    { id: '1', name: 'Nature Communications', publisher: 'nature', year: '2025', thumbnail: '/nature.svg' },
    { id: '2', name: 'The Lancet', publisher: 'the lancet', year: '2025', thumbnail: '/lancet.svg' },
    { id: '3', name: 'Springer Journal', publisher: 'springer', year: '2025', thumbnail: '/springer.svg' },
    { id: '4', name: 'Elsevier Journal', publisher: 'elsevier', year: '2025', thumbnail: '/elsevier.svg' },
    { id: '5', name: 'IEEE Transactions', publisher: 'ieee', year: '2025', thumbnail: '/ieee.svg' },
    { id: '6', name: 'Nature Physics', publisher: 'nature', year: '2025', thumbnail: '/nature.svg' },
    { id: '7', name: 'Lancet Oncology', publisher: 'the lancet', year: '2025', thumbnail: '/lancet.svg' },
    { id: '8', name: 'Springer Mathematics', publisher: 'springer', year: '2025', thumbnail: '/springer.svg' },
  ];

  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (onSelectTemplate) {
      onSelectTemplate(templateId);
    }
  };

  return (
    <div className="choose-template-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="template-main-section">
        <div className="template-container">
        <div className="template-progress">
          <div className="progress-step">File</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step active">Template</div>
          <div className="progress-arrow">→</div>
          <div className="progress-step">Upload</div>
        </div>

        <h1 className="page-title">Choose Your Template</h1>

        <div className="template-search">
          <input
            type="text"
            placeholder="Search for your journal"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
            <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>

        <div className="templates-grid">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
              onClick={() => handleTemplateClick(template.id)}
            >
              <div className="template-preview">
                <img src={template.thumbnail} alt={template.name} />
                <span className="template-badge">{template.publisher}</span>
              </div>
              <div className="template-info">
                <h3 className="template-name">{template.name}</h3>
                <span className="template-year">{template.year}</span>
              </div>
            </div>
          ))}
        </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseTemplatePage;