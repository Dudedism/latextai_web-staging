import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated, getToken } from '../../utils/auth';
import '../../styles/common.css';
import './YourPapersPage.css';

interface Paper {
  id: string;
  title: string;
  date: string;
  template: string;
  thumbnail: string;
  status: 'completed' | 'processing';
}

const YourPapersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);

  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/latex/projects`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPapers(data);
      } else {
        console.error('Failed to fetch projects');
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (paperId: string) => {
    navigate(`/papers/${paperId}/view`);
  };

  const handleDownload = async (paperId: string) => {
    try {
      const token = getToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/latex/project/${paperId}/tex`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document.tex`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        console.error('Failed to download .tex file');
      }
    } catch (error) {
      console.error('Error downloading .tex file:', error);
    }
  };

  const handleSupport = (paperId: string) => {
    navigate(`/papers/${paperId}/support`);
  };

  const handleNewPaper = () => {
    navigate('/papers/new');
  };

  return (
    <div className="papers-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="papers-main-section">
        <div className="papers-container">
        <div className="papers-header">
          <h1 className="papers-title">Your Papers</h1>
          <div className="papers-actions">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <svg className="search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
                <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <button className="new-paper-btn" onClick={handleNewPaper}>
              New Paper
              <span className="plus-icon">+</span>
            </button>
          </div>
        </div>

        <div className="papers-list">
          {loading ? (
            <p>Loading projects...</p>
          ) : papers.length === 0 ? (
            <div className="no-papers">
              <p>You don't have any papers yet.</p>
              <button className="new-paper-btn" onClick={handleNewPaper}>
                Upload Your First Paper
              </button>
            </div>
          ) : (
            papers.map((paper) => (
            <div key={paper.id} className="paper-card">
              <div className="paper-thumbnail">
                <img src={paper.thumbnail} alt={paper.template} />
                <span className="template-badge">nature</span>
              </div>
              
              <div className="paper-info">
                <div className="paper-meta">
                  <span className="paper-label">Title</span>
                  <h3 className="paper-title-text">{paper.title}</h3>
                </div>
                <div className="paper-details">
                  <div className="paper-meta">
                    <span className="paper-label">Date</span>
                    <span className="paper-value">{paper.date}</span>
                  </div>
                  <div className="paper-meta">
                    <span className="paper-label">Template</span>
                    <span className="paper-value">{paper.template}</span>
                  </div>
                </div>
              </div>

              <div className="paper-actions">
                <button className="action-btn view-btn" onClick={() => handleView(paper.id)}>
                  View
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4C6 4 2.5 7 1 10C2.5 13 6 16 10 16C14 16 17.5 13 19 10C17.5 7 14 4 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                <button className="action-btn download-btn" onClick={() => handleDownload(paper.id)}>
                  Download .tex
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 3V13M10 13L6 9M10 13L14 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M3 17H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
                <button className="action-btn support-btn" onClick={() => handleSupport(paper.id)}>
                  Support
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 14V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="10" cy="7" r="0.5" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
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

export default YourPapersPage;