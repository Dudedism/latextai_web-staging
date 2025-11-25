import React, { useState, useEffect } from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiRequest } from '../../utils/api';

interface Template {
  id: string;
  name: string;
  publisher: string;
  year: string;
  thumbnail: string;
}

interface ChooseTemplatePageProps {
  onSelectTemplate?: (templateId: string, templateName?: string) => void;
}

const ChooseTemplatePage: React.FC<ChooseTemplatePageProps> = ({ onSelectTemplate }) => {
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

  // Filter templates based on search query
  const filteredTemplates = templates.filter(template => {
    const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    const name = template.name.toLowerCase().replace(/\s+/g, ' ');
    const publisher = template.publisher.toLowerCase().replace(/\s+/g, ' ');
    return (
      name.includes(query) ||
      publisher.includes(query)
    );
  });

  const searchContainerStyle: React.CSSProperties = {
    position: 'relative',
    maxWidth: '500px',
    margin: '0 auto 40px',
  };

  const searchInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 48px 14px 20px',
    border: '1px solid #e0e0e0',
    borderRadius: '30px',
    fontSize: '16px',
  };

  const searchIconStyle: React.CSSProperties = {
    position: 'absolute',
    right: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#999',
    pointerEvents: 'none',
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  };

  const cardStyle = (isSelected: boolean): React.CSSProperties => ({
    background: 'white',
    border: isSelected ? '2px solid #000' : '1px solid #e0e0e0',
    borderRadius: '12px',
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    transform: isSelected ? 'scale(1.02)' : 'none',
  });

  const previewStyle: React.CSSProperties = {
    position: 'relative',
    height: '180px',
    background: '#f5f5f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  };

  const badgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    left: '12px',
    background: 'white',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 500,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  };

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step progress-step--active">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
          </div>

          <h1 className="section-title text-center">Choose Your Template</h1>

          <div style={searchContainerStyle}>
            <input
              type="text"
              placeholder="Search for your journal"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
            <svg style={searchIconStyle} width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
              <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>

          <div style={gridStyle}>
            {loading ? (
              <p className="text-muted">Loading templates...</p>
            ) : error ? (
              <p className="text-error">{error}</p>
            ) : (
              filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  style={cardStyle(selectedTemplate === template.id)}
                  onClick={() => handleTemplateClick(template)}
                >
                  <div style={previewStyle}>
                    <img src={template.thumbnail} alt={template.name} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
                    <span style={badgeStyle}>{template.publisher}</span>
                  </div>
                  <div style={{ padding: '16px' }}>
                    <h3 className="font-semibold" style={{ margin: '0 0 4px 0', fontSize: '16px' }}>{template.name}</h3>
                    <span className="text-sm text-muted">{template.year}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default ChooseTemplatePage;