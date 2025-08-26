import React from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from './Banner';
import { getAuthenticatedUser, isAuthenticated } from '../utils/auth';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  const handleTryFree = async () => {
    // If already authenticated, just go to new paper page
    if (authenticated) {
      navigate('/papers/new');
      return;
    }
    
    // Create anonymous session
    try {
      // Generate a unique key for anonymous user
      const anonymousKey = `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Store the key in localStorage for later use
      localStorage.setItem('anonymousKey', anonymousKey);
      
      const response = await fetch('http://localhost:8000/api/loginAnonymously', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: anonymousKey }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store anonymous token
        localStorage.setItem('token', data.token);
        localStorage.setItem('userEmail', `${anonymousKey}@anonymous.user`);
        localStorage.setItem('userName', 'Anonymous');
        localStorage.setItem('isAdmin', 'false');
        
        // Navigate to new paper page
        navigate('/papers/new');
      } else {
        console.error('Failed to create anonymous session:', data.message);
        // Still navigate to new paper page even if anonymous session fails
        navigate('/papers/new');
      }
    } catch (error) {
      console.error('Error creating anonymous session:', error);
      // Still navigate to new paper page even if anonymous session fails
      navigate('/papers/new');
    }
  };

  const handleBrowseJournals = () => {
    navigate('/pricing');
  };

  return (
    <div className="landing-container">
      <Banner isAuthenticated={authenticated} userName={user?.name} />

      {/* Section 1: Hero */}
      <section className="section">
        <div className="hero-box">
          <div className="hero-text">
            <div className="title-section">
              <h1 className="main-title">
                Word to Journal-Ready
              </h1>
              <div className="subtitle-container">
                <img src="/LaTeX_logo.svg" alt="LaTeX" className="latex-logo" />
                <span className="subtitle-text">in Minutes</span>
              </div>
            </div>
            
            <p className="description">
              <strong>Stop wasting hours on formatting.</strong> Upload your .docx 
              file and get a beautifully typeset LaTeX manuscript 
              tailored to your target journal's guidelines, in minutes, 
              not days.
            </p>
          </div>

          <div className="hero-visual">
            <div className="document-preview">
              <div className="doc-before">
                <div className="doc-placeholder">Word Document</div>
              </div>
              <div className="arrow">→</div>
              <div className="doc-after">
                <div className="doc-placeholder">LaTeX Output</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Publishers */}
      <section className="section">
        <div className="publishers-section">
          <img src="/elsevier.svg" alt="Elsevier" className="publisher-logo" style={{width: '156px', height: '76px'}} />
          <img src="/ieee.svg" alt="IEEE" className="publisher-logo" style={{width: '138px', height: '77px'}} />
          <img src="/springer.svg" alt="Springer" className="publisher-logo" style={{width: '196px', height: '73px'}} />
          <img src="/lancet.svg" alt="The Lancet" className="publisher-logo" style={{width: '250px', height: '28px'}} />
          <img src="/nature.svg" alt="Nature" className="publisher-logo" style={{width: '168px', height: '46px'}} />
        </div>
      </section>

      {/* Section 3: Action Buttons */}
      <section className="section">
        <div className="action-buttons">
          <button className="btn-outline" onClick={handleTryFree}>Try It Free Now ↗</button>
          <button className="btn-outline" onClick={handleBrowseJournals}>Browse our supported journals ↗</button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;