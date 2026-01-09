import React from 'react';
import './PricingCompare.css';

type PricingCompareProps = {
  onTryFree?: () => void | Promise<void>;
  variant?: 'full' | 'standalone';
};

const PricingCompare: React.FC<PricingCompareProps> = ({
  onTryFree,
  variant = 'full',
}) => {
  const isStandalone = variant === 'standalone';

  return (
    <section className={isStandalone ? '' : 'section'}>
      <div className={`pc-container ${isStandalone ? 'pc-container--single' : ''}`}>
        {!isStandalone && (
          <header className="pc-header">
            <h2 className="pc-title">The Lowest Pricing Available.</h2>
            <p className="pc-subtitle">See how we compare to our competitors.</p>
          </header>
        )}

        <div className={`pc-grid ${isStandalone ? 'pc-grid--single' : ''}`}>
          <div className="pc-card pc-primary">
            <h3 className="pc-card-title">Our Service</h3>

            <div className="pc-price">
              <span className="pc-price-currency">$</span>
              <span className="pc-price-value">4.99</span>
              <span className="pc-price-unit">/document</span>
            </div>

            <div className="pc-includes">Includes</div>
            <ul className="pc-features">
              <li>Up to 15 pages</li>
              <li>+$0.50 per additional page</li>
              <li>Delivery in minutes, not days</li>
              <li>Submission-ready PDF + Complete LaTeX compilation package</li>
              <li>Superior quality output</li>
            </ul>

            <button
              className="btn-outline pc-cta"
              onClick={onTryFree}
              type="button"
              aria-label="Get started now"
            >
              Get started now ↗
            </button>
          </div>

          {!isStandalone && (
            <div className="pc-stack">
              <div className="pc-card pc-competitor">
                <h3 className="pc-card-title">Competitor A</h3>
                <div className="pc-price">
                  <span className="pc-price-currency">$</span>
                  <span className="pc-price-value">400+</span>
                  <span className="pc-price-unit">/project</span>
                </div>
                <p className="pc-note">@ $100/hour minimum 4 hours</p>
                <p className="pc-note">1 week delivery time</p>
              </div>

              <div className="pc-card pc-competitor">
                <h3 className="pc-card-title">Competitor B</h3>
                <div className="pc-price">
                  <span className="pc-price-currency">$</span>
                  <span className="pc-price-value">9.99</span>
                  <span className="pc-price-unit">/document</span>
                </div>
                <p className="pc-note">Limited features</p>
                <p className="pc-note">Lower quality output</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PricingCompare;
