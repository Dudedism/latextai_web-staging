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
  paid: boolean;
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

  const handleView = (paper: Paper) => {
    // If not paid, redirect to payment page, otherwise go to view
    if (!paper.paid) {
      navigate(`/papers/${paper.id}/payment`);
    } else {
      navigate(`/papers/${paper.id}/view`);
    }
  };

  const handleDelete = async (paperId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      await apiRequest(`/api/latex/project/${paperId}`, {
        method: 'DELETE',
      });
      // Refresh projects list after deletion
      fetchProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Failed to delete project. Please try again.');
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
                <button className="action-btn view-btn" onClick={() => handleView(paper)}>
                  {paper.paid ? 'View' : 'Pay'}
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 4C6 4 2.5 7 1 10C2.5 13 6 16 10 16C14 16 17.5 13 19 10C17.5 7 14 4 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
                    <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
                  </svg>
                </button>
                <button className="action-btn delete-btn" onClick={() => handleDelete(paper.id)}>
                  Delete
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M7 3h6M3 5h14M5 5l1 12c0 1 0 2 2 2h4c2 0 2-1 2-2l1-12M8 8v7M12 8v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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