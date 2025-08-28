import React from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from './Banner';
import { HeroSection, HowItWorks, ValueProp, PricingCompare } from './homepage'; // barrel import
import { getAuthenticatedUser, isAuthenticated } from '../utils/auth';
import './Global.css';
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
      <HeroSection />

      {/* Section 2: Publishers */}
      <section className="section">
        <div className="publishers-section">
          <img src="/elsevier.svg" alt="Elsevier" className="publisher-logo" style={{ width: '156px', height: '76px' }} />
          <img src="/ieee.svg" alt="IEEE" className="publisher-logo" style={{ width: '138px', height: '77px' }} />
          <img src="/springer.svg" alt="Springer" className="publisher-logo" style={{ width: '196px', height: '73px' }} />
          <img src="/lancet.svg" alt="The Lancet" className="publisher-logo" style={{ width: '250px', height: '28px' }} />
          <img src="/nature.svg" alt="Nature" className="publisher-logo" style={{ width: '168px', height: '46px' }} />
        </div>
      </section>

      {/* Section 3: Action Buttons */}
      <section className="section">
        <div className="action-buttons">
          <button className="btn-outline" onClick={handleTryFree}>Try It Free Now ↗</button>
          <button className="btn-outline" onClick={handleBrowseJournals}>Browse our supported journals ↗</button>
        </div>
      </section>

      {/* Section 4: How it works */}
      <HowItWorks />
      <ValueProp
        cta={{ label: 'Try it free now', onClick: handleTryFree }}
      />
      <PricingCompare />
    </div>
  );
};

export default LandingPage;
