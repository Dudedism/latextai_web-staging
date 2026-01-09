import React, { useState, useEffect } from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiRequest } from '../../utils/api';
import '../static/BrowseJournalsPage.css';

interface Template {
  id: string;
  name: string;
  publisher: string;
  year: string;
  thumbnail: string;
}

interface ChooseTemplatePageProps {
  onSelectTemplate?: (templateId: string, templateName?: string) => void;
  onBack?: () => void;
}

const ChooseTemplatePage: React.FC<ChooseTemplatePageProps> = ({ onSelectTemplate, onBack }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const data = await apiRequest<{ templates: Template[] }>('/api/latex/templates');
      setTemplates(data.templates);
    } catch (error) {
      setError('Failed to load templates');
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template.id);
    if (onSelectTemplate) {
      onSelectTemplate(template.id, template.name);
    }
  };

  const filteredTemplates = templates.filter(template => {
    const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    const name = template.name.toLowerCase().replace(/\s+/g, ' ');
    const publisher = template.publisher.toLowerCase().replace(/\s+/g, ' ');
    return name.includes(query) || publisher.includes(query);
  });

  return (
    <div className="browse-journals-page">
      <Banner />

      <section className="browse-main-section">
        <div className="browse-container">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step progress-step--active">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
          </div>

          <h1 className="section-title">Choose Your Template</h1>

          <div className="browse-search">
            <input
              type="text"
              placeholder="Search for your journal"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              maxLength={100}
              className="search-input"
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="templates-grid">
            {loading ? (
              <p className="text-muted">Loading templates...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'template-card--selected' : ''}`}
                  onClick={() => handleTemplateClick(template)}
                >
                  <div className="template-preview">
                    <img src={template.thumbnail} alt={template.name} />
                    <span className="template-badge">{template.name}</span>
                  </div>
                  <div className="template-info">
                    <h3 className="template-name">{template.publisher}</h3>
                  </div>
                </div>
              ))
            )}
          </div>

          {onBack && (
            <div className="text-center mt-8">
              <button className="btn btn--ghost" onClick={onBack}>
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

export default ChooseTemplatePage;
