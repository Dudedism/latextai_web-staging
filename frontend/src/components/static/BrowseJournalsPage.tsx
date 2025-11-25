import React, { useState, useEffect } from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { apiRequest } from '../../utils/api';
import './BrowseJournalsPage.css';

interface Template {
  id: string;
  name: string;
  publisher: string;
  year: string;
  thumbnail: string;
}

const BrowseJournalsPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
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

  const filteredTemplates = templates.filter(template => {
    const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    const name = template.name.toLowerCase().replace(/\s+/g, ' ');
    const publisher = template.publisher.toLowerCase().replace(/\s+/g, ' ');
    return (
      name.includes(query) ||
      publisher.includes(query)
    );
  });

  return (
    <div className="browse-journals-page">
      <Banner />

      <section className="browse-main-section">
        <div className="browse-container">
          <h1 className="browse-title">Supported Journals</h1>
          <p className="browse-subtitle">
            Browse our collection of professional LaTeX templates from leading publishers
          </p>

          <div className="browse-search">
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
            {loading ? (
              <p>Loading templates...</p>
            ) : error ? (
              <p className="error-message">{error}</p>
            ) : (
              filteredTemplates.map((template) => (
                <div key={template.id} className="template-card">
                  <div className="template-preview">
                    <img src={template.thumbnail} alt={template.name} />
                    <span className="template-badge">{template.publisher}</span>
                  </div>
                  <div className="template-info">
                    <h3 className="template-name">{template.name}</h3>
                    <span className="template-year">{template.year}</span>
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

export default BrowseJournalsPage;
