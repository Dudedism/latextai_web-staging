import React from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import '../../styles/common.css';
import './StaticPages.css';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = (plan: string) => {
    console.log(`Selected plan: ${plan}`);
    navigate('/signin');
  };

  return (
    <div className="static-page">
      <Banner />
      
      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title">Simple, Transparent Pricing</h1>
        <p style={{ textAlign: 'center', fontSize: '18px', color: '#666', marginBottom: '40px' }}>
          Choose the plan that works best for you. No hidden fees.
        </p>
        
        <div className="pricing-grid">
          <div className="pricing-card">
            <h3 className="pricing-title">Pay Per Document</h3>
            <div className="pricing-price">$9.99</div>
            <div className="pricing-unit">per conversion</div>
            <ul className="pricing-features">
              <li>Single document conversion</li>
              <li>All journal templates</li>
              <li>Preview before payment</li>
              <li>Download .tex and supporting files</li>
              <li>7-day storage</li>
              <li>Email support</li>
            </ul>
            <button className="pricing-btn" onClick={() => handleGetStarted('single')}>
              Get Started
            </button>
          </div>

          <div className="pricing-card featured">
            <span className="pricing-badge">Most Popular</span>
            <h3 className="pricing-title">Document Pack</h3>
            <div className="pricing-price">$79.99</div>
            <div className="pricing-unit">10 conversions</div>
            <ul className="pricing-features">
              <li>10 document conversions</li>
              <li>All journal templates</li>
              <li>Priority processing</li>
              <li>Download .tex and supporting files</li>
              <li>30-day storage</li>
              <li>Priority email support</li>
              <li>20% savings per document</li>
            </ul>
            <button className="pricing-btn" onClick={() => handleGetStarted('pack')}>
              Get Started
            </button>
          </div>

          <div className="pricing-card">
            <h3 className="pricing-title">Academic</h3>
            <div className="pricing-price">$49.99</div>
            <div className="pricing-unit">per month</div>
            <ul className="pricing-features">
              <li>Unlimited conversions</li>
              <li>All journal templates</li>
              <li>Instant processing</li>
              <li>Download .tex and supporting files</li>
              <li>Unlimited storage</li>
              <li>Priority support</li>
              <li>Collaboration features</li>
              <li>API access</li>
            </ul>
            <button className="pricing-btn" onClick={() => handleGetStarted('academic')}>
              Get Started
            </button>
          </div>
        </div>

        <section className="static-section">
          <h2>Enterprise & Institutional Pricing</h2>
          <p>
            Need a custom solution for your institution or research group? We offer flexible plans 
            for universities, research institutions, and corporate R&D departments.
          </p>
          <p>
            Contact us at <a href="mailto:enterprise@latex.com">enterprise@latex.com</a> to discuss 
            your needs and get a custom quote.
          </p>
        </section>

        <section className="static-section">
          <h2>Frequently Asked Questions</h2>
          
          <h3>What payment methods do you accept?</h3>
          <p>
            We accept all major credit cards (Visa, MasterCard, American Express) and debit cards 
            through our secure payment processor, Stripe.
          </p>

          <h3>Can I try before I buy?</h3>
          <p>
            Yes! You can upload your document and preview the first 3 pages of the converted LaTeX 
            output completely free. Payment is only required to download the full document.
          </p>

          <h3>What's included in the download?</h3>
          <p>
            Your download includes the main .tex file, bibliography file (.bib), all extracted images 
            in appropriate formats, and a README with compilation instructions.
          </p>

          <h3>Do unused conversions expire?</h3>
          <p>
            Document packs are valid for 12 months from purchase date. Monthly subscriptions renew 
            automatically and don't have usage limits during the subscription period.
          </p>

          <h3>What's your refund policy?</h3>
          <p>
            We offer a 7-day money-back guarantee if you're not satisfied with the conversion quality. 
            Simply contact our support team with details about the issue.
          </p>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PricingPage;