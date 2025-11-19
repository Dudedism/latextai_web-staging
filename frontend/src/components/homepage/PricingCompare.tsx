import React from 'react';
import './PricingCompare.css';

type PricingCompareProps = {
  onTryFree?: () => void | Promise<void>;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
};

const PricingCompare: React.FC<PricingCompareProps> = ({
  onTryFree,
  title = 'The Lowest Pricing Available.',
  subtitle = 'See how we compare to our competitors.',
}) => {
  return (
    <section className="section">
      <div className="pc-container">
        <header className="pc-header">
          <h2 className="pc-title">{title}</h2>
          <p className="pc-subtitle">{subtitle}</p>
        </header>

        <div className="pc-grid">
          {/* Left: Our Service */}
          <div className="pc-card pc-primary">
            <h3 className="pc-card-title">Our Service</h3>

            <div className="pc-price">
              <span className="pc-price-currency">$</span>
              <span className="pc-price-value">4.99</span>
              <span className="pc-price-unit">/document</span>
            </div>

            <div className="pc-includes">Includes</div>
            <ul className="pc-features">
              <li>Up to 15 pages (one-sided) or 7 pages (two-sided)</li>
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

          {/* Right: Competitors */}
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
                <span className="pc-price-value">2.99</span>
                <span className="pc-price-unit">/document</span>
              </div>
              <p className="pc-note">Limited features</p>
              <p className="pc-note">Lower quality output</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingCompare;
