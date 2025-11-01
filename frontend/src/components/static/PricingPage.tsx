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
          <div className="pricing-card featured">
            <h3 className="pricing-title">Our Service</h3>
            <div className="pricing-price">$1</div>
            <div className="pricing-unit">per page</div>
            <ul className="pricing-features">
              <li>Free first time conversion</li>
              <li>Delivery in minutes, not days</li>
              <li>Templates</li>
              <li>Editing</li>
              <li>Raw LaTeX code download</li>
              <li>Perfect for small projects</li>
            </ul>
            <button className="pricing-btn" onClick={() => handleGetStarted('perpage')}>
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

          <h3>How does the pricing work?</h3>
          <p>
            We charge $1 per page of your document. Your first conversion is completely free to try
            our service. Payment is only required after you're satisfied with the conversion quality.
          </p>

          <h3>What's included in the download?</h3>
          <p>
            Your download includes the main .tex file, bibliography file (.bib), all extracted images
            in appropriate formats, and a README with compilation instructions.
          </p>

          <h3>How fast is the conversion?</h3>
          <p>
            Most conversions are completed within minutes, not days like traditional services.
            You'll receive your converted LaTeX files quickly so you can get back to your research.
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