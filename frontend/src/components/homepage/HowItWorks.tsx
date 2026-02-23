import React from 'react';

export const HowItWorksTitle: React.FC = () => {
  return (
    <section className="section howitworks" style={{ paddingBottom: 0, marginBottom: '24px', marginTop: '40px' }}>
      <div className="how-container">
        <h2 className="how-title">How it works.</h2>
        <p className="how-subtitle">Our process is simple.</p>
      </div>
    </section>
  );
};

export const HowItWorksSteps: React.FC = () => {
  return (
    <section className="section howitworks" style={{ paddingTop: 0, marginTop: '32px', marginBottom: '60px' }}>
      <div className="how-container">
        <div className="how-steps">
          {/* Step 1 */}
          <div className="how-step">
            <div className="how-step-head">
              <span className="how-step-number">1</span>
              {/* Upload icon */}
              <svg className="how-step-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V4M12 4l-4 4M12 4l4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h3 className="how-step-title">
              Upload your word<br />file
            </h3>
            <p className="how-step-desc">
              Drag and drop your .docx or .doc — no setup required.
            </p>
          </div>

          {/* Step 2 */}
          <div className="how-step">
            <div className="how-step-head">
              <span className="how-step-number">2</span>
              {/* Book / template icon */}
              <svg className="how-step-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 6.5v11a2 2 0 0 0 2 2H20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M20 19.5V6.5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M8.5 8.5h7M8.5 11.5h7M8.5 14.5h4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <h3 className="how-step-title">
              Select a Journal<br />Template
            </h3>
            <p className="how-step-desc">
              Pick from dozens of publisher styles: Nature, Elsevier, IEEE, Springer, and more.
            </p>
          </div>

          {/* Step 3 */}
          <div className="how-step">
            <div className="how-step-head">
              <span className="how-step-number">3</span>
              {/* Download icon */}
              <svg className="how-step-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 4v10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 10l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 18h16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <h3 className="how-step-title">
              Download Your<br />PDF + LaTeX Files
            </h3>
            <p className="how-step-desc">
              Get your publication-ready PDF and complete LaTeX compilation package with all source files.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

const HowItWorks: React.FC = () => {
  return (
    <>
      <HowItWorksTitle />
      <HowItWorksSteps />
    </>
  );
};

export default HowItWorks;
