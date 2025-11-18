import React from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import { HeroSection, HowItWorks, ValueProp, PricingCompare } from '.'; // barrel import
import '../Global.css';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleTryFree = () => {
    navigate('/signup');
  };

  const handleBrowseJournals = () => {
    navigate('/pricing');
  };

  return (
    <div className="landing-container">
      <Banner />

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
      <PricingCompare onTryFree={handleTryFree} />
    </div>
  );
};

export default LandingPage;
