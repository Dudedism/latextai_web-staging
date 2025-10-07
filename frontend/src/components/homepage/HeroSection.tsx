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
  );
};

export default HeroSection;
