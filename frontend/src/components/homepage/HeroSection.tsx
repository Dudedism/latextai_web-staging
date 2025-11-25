import React from 'react';

const HeroSection: React.FC = () => {
  return (
    <section className="section">
      <div className="hero-box">
        <div className="hero-text">
          <div className="title-section">
            <h1 className="main-title">Word to Journal-Ready</h1>
            <div className="subtitle-container">
              <img src="/LaTeX_logo.svg" alt="LaTeX" className="latex-logo" />
              <span className="subtitle-text">in Minutes</span>
            </div>
          </div>

          <p className="description">
            <strong>Stop wasting hours on formatting.</strong> Upload your .docx
            file and get a beautifully typeset LaTeX manuscript
            tailored to your target journal&apos;s guidelines, in minutes,
            not days.
          </p>
        </div>

        <div className="hero-visual">
          <div className="conversion-icons">
            <div className="doc-card doc-card--left">
              <img src="/Microsoft_Office_Word_(2019–2025).svg" alt="Word" className="doc-logo" />
            </div>
            <div className="conversion-arrow">
              <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
                <path d="M5 12H19M19 12L13 6M19 12L13 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="doc-card doc-card--right">
              <img src="/LaTeX_logo.svg" alt="LaTeX" className="doc-logo" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
