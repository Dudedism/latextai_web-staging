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
              <span className="pc-price-value">1</span>
              <span className="pc-price-unit">/page</span>
            </div>

            <div className="pc-includes">Includes</div>
            <ul className="pc-features">
              <li>Free first time conversion</li>
              <li>Delivery in minutes, not days</li>
              <li>Templates</li>
              <li>Editing</li>
              <li>Raw LaTeX code download</li>
              <li>Perfect for small projects</li>
            </ul>

            <button
              className="btn-outline pc-cta"
              onClick={onTryFree}
              type="button"
              aria-label="Try it free now"
            >
              Try it free now ↗
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
                <span className="pc-price-value">4</span>
                <span className="pc-price-unit">/page</span>
              </div>
              <p className="pc-note">1 week delivery time</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PricingCompare;
