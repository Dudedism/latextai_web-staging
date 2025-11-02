import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationModal } from '../common/VerificationModal';
import { apiRequest } from '../../utils/api';
import { downloadFile } from '../../utils/download';
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
  const { user, isVerified } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await apiRequest<Paper[]>('/api/latex/projects');
      setPapers(data);
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
      await downloadFile(`/api/latex/project/${paperId}/tex`, `document.tex`);
    } catch (error) {
      console.error('Error downloading .tex file:', error);
    }
  };

  const handleSupport = (paperId: string) => {
    navigate(`/papers/${paperId}/support`);
  };

  const handleNewPaper = () => {
    // Check email verification status before allowing upload
    if (!isVerified) {
      setShowVerificationModal(true);
      return;
    }
    navigate('/papers/new');
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="papers-page">
      <Banner />

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
          {papers.length === 0 ? (
            <div className="empty-paper-card" onClick={handleNewPaper}>
              <div className="empty-paper-thumbnail">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                  <path d="M40 20V60M20 40H60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
              </div>

              <div className="empty-paper-info">
                <h3 className="empty-paper-title">Upload your first project</h3>
                <p className="empty-paper-subtitle">Your first upload is free - get started now!</p>
              </div>
            </div>
          ) : (
            papers.map((paper) => (
            <div key={paper.id} className="paper-card">
              <div className="paper-thumbnail">
                <img src={paper.thumbnail} alt={paper.template} />
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

      <VerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={user?.email || ''}
      />
    </div>
  );
};

export default YourPapersPage;