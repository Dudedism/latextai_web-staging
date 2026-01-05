import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationModal } from '../common/VerificationModal';
import { apiRequest } from '../../utils/api';
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

  // Filter papers based on search query (matches ChooseTemplatePage implementation)
  const filteredPapers = papers.filter(paper => {
    const query = searchQuery.toLowerCase().trim().replace(/\s+/g, ' ');
    const title = paper.title.toLowerCase().replace(/\s+/g, ' ');
    const template = paper.template.toLowerCase().replace(/\s+/g, ' ');
    return (
      title.includes(query) ||
      template.includes(query)
    );
  });

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container">
          <div className="papers-header">
            <h1 className="section-title" style={{ marginBottom: 0 }}>Your Papers</h1>
            <div className="papers-header-actions">
              <div className="papers-search">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input form-input--pill"
                />
                <svg className="papers-search-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="2"/>
                  <path d="M14 14L17 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <button className="btn btn--outline btn--pill" onClick={() => navigate('/credits')}>
                Top Up Credits
              </button>
              <button className="btn btn--outline btn--pill" onClick={handleNewPaper}>
                New Paper
                <span style={{ fontSize: '18px', fontWeight: 300 }}>+</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-5">
            {papers.length === 0 ? (
              <div className="papers-empty" onClick={handleNewPaper}>
                <div style={{ color: '#999' }}>
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <circle cx="40" cy="40" r="38" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4"/>
                    <path d="M40 20V60M20 40H60" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="text-center">
                  <h3 className="font-bold" style={{ fontSize: '28px', marginBottom: '12px' }}>Upload your first project</h3>
                  <p className="text-muted">Your first upload is free, get started now!</p>
                </div>
              </div>
            ) : filteredPapers.length === 0 ? (
              <div className="text-center" style={{ padding: '60px 20px' }}>
                <p className="text-muted" style={{ fontSize: '18px' }}>No papers match your search.</p>
              </div>
            ) : (
              filteredPapers.map((paper) => (
                <div key={paper.id} className="paper-card">
                  <div className="paper-card-top">
                    <div className="paper-thumbnail">
                      <img src={paper.thumbnail} alt={paper.template} />
                    </div>
                    <div className="paper-info">
                      <div>
                        <span className="text-sm text-muted">Title</span>
                        <h3 className="paper-title">{paper.title}</h3>
                      </div>
                      <div className="paper-meta">
                        <div className="paper-meta-item">
                          <span className="text-sm text-muted">Date</span>
                          <span style={{ fontSize: '14px' }}>{paper.date}</span>
                        </div>
                        <div className="paper-meta-item">
                          <span className="text-sm text-muted">Template</span>
                          <span style={{ fontSize: '14px' }}>{paper.template}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="paper-actions">
                    <button className="paper-action-btn" onClick={() => handleView(paper)}>
                      <span className="btn-text">{paper.paid ? 'View' : 'Pay'}</span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 4C6 4 2.5 7 1 10C2.5 13 6 16 10 16C14 16 17.5 13 19 10C17.5 7 14 4 10 4Z" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </button>
                    <button className="paper-action-btn paper-action-btn--delete" onClick={() => handleDelete(paper.id)}>
                      <span className="btn-text">Delete</span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M7 3h6M3 5h14M5 5l1 12c0 1 0 2 2 2h4c2 0 2-1 2-2l1-12M8 8v7M12 8v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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