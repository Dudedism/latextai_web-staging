import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Banner from '../Banner';
import { HeroSection, PricingCompare } from '.'; // barrel import
import { HowItWorksTitle, HowItWorksSteps } from './HowItWorks';
import './LandingPage.css';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleTryFree = () => {
    navigate('/signup');
  };

  const handleBrowseJournals = () => {
    navigate('/journals');
  };

  return (
    <div className="landing-container">
      <Banner />

      {/* Section 1: Hero */}
      <HeroSection />

      {/* Section 2: Publishers */}
      <section className="section">
        <div className="publishers-section">
          <img src="/elsevier.png" alt="Elsevier" className="publisher-logo" style={{ width: '156px', height: '76px' }} />
          <img src="/ieee.svg" alt="IEEE" className="publisher-logo" style={{ width: '138px', height: '77px' }} />
          <img src="/springer.png" alt="Springer" className="publisher-logo" style={{ width: '196px', height: '73px' }} />
          <img src="/lancet.svg" alt="The Lancet" className="publisher-logo" style={{ width: '250px', height: '28px' }} />
          <img src="/nature.svg" alt="Nature" className="publisher-logo" style={{ width: '168px', height: '46px' }} />
        </div>
      </section>

      {/* Section 3: Action Buttons */}
      <section className="section" style={{ marginBottom: '40px' }}>
        <div className="action-buttons">
          <button className="btn-outline" onClick={handleTryFree}>Try It Free Now ↗</button>
          <button className="btn-outline" onClick={handleBrowseJournals}>Browse our supported journals ↗</button>
        </div>
      </section>

      {/* Section 4: How it works - Title */}
      <HowItWorksTitle />

      {/* Demo Video */}
      <section className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div style={{
          maxWidth: '1124px',
          margin: '0 auto',
          padding: '0 24px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.10)'
        }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              display: 'block',
              borderRadius: '12px'
            }}
          >
            <source src="/LaTeXtAI-Demo-HQ.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* Section 4: How it works - Steps */}
      <HowItWorksSteps />

      {/* Blog Callout – replaces ValueProp */}
      <section className="section blog-callout">
        <div className="blog-callout-wrap">
          <div className="blog-callout-bubble" aria-hidden="true" />
          <div className="blog-callout-content">
            <div className="blog-callout-icon" aria-hidden="true">📣</div>
            <h2 className="blog-callout-title">Be updated, or update us!</h2>
            <p className="blog-callout-sub">Read the latest news, feature updates and insights — or share your own feedback with us.</p>
            <Link to="/blog" className="btn-outline blog-callout-cta">Visit our Blog →</Link>
          </div>
        </div>
      </section>

      <PricingCompare onTryFree={handleTryFree} />
    </div>
  );
};

export default LandingPage;
