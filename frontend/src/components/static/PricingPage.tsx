import React from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { PricingCompare } from '../homepage';
import './StaticPages.css';

const PricingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/signup');
  };

  return (
    <div className="static-page">
      <Banner />

      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title" style={{ textAlign: 'center' }}>Simple, Transparent Pricing</h1>
        <p style={{ textAlign: 'center', fontSize: '18px', color: '#666', marginBottom: '40px' }}>
          One-time payment. No subscriptions. No hidden fees.
        </p>

        <PricingCompare onTryFree={handleGetStarted} variant="standalone" />

        <section className="static-section">
          <h2>Enterprise & Institutional Pricing</h2>
          <p>
            Need a custom solution for your institution or research group? We offer flexible plans 
            for universities, research institutions, and corporate R&D departments.
          </p>
          <p>
            Contact us at <a href="mailto:contact@latext.ai">contact@latext.ai</a> to discuss 
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
            We use a one-time payment model. The base price is $4.99 for documents up to 15 pages
            (one-sided PDF) or 7 pages (two-sided PDF). Each additional page costs $0.50. This
            page-based pricing ensures you only pay for what you need, accounting for the complexity
            of tables, equations, and figures in your document.
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
            Refunds are available if a paid document fails to process or if the output is unusable
            due to a system error. Contact our support team at contact@latext.ai with details about the issue.
          </p>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PricingPage;