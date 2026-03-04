import React, { useState, useEffect } from 'react';
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
  const [price, setPrice] = useState({ symbol: '$', value: '3.49' });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscription/detect-pricing`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tier === 'emerging_inr') {
          setPrice({ symbol: '₹', value: '149' });
        }
        // standard and emerging_usd both use $3.49
      })
      .catch(() => {
        // keep default pricing on failure
      });
  }, []);

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
              <span className="pc-price-currency">from {price.symbol}</span>
              <span className="pc-price-value">{price.value}</span>
              <span className="pc-price-unit">/month</span>
            </div>

            <div className="pc-includes">Includes</div>
            <ul className="pc-features">
              <li>~10 document conversions/month</li>
              <li>Delivery in minutes, not days</li>
              <li>Submission-ready PDF + Complete LaTeX compilation package</li>
              <li>Superior quality output</li>
              <li>Pay-as-you-go also available</li>
            </ul>

            <button
              className="btn-outline pc-cta"
              onClick={onTryFree}
              type="button"
              aria-label="Get started now"
            >
              Get started now &#8599;
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
