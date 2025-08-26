import React from 'react';
import Banner from './Banner';
import Footer from './Footer';
import '../styles/common.css';
import './StaticPages.css';

const TermsConditions: React.FC = () => {
  return (
    <div className="static-page">
      <Banner />
      
      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title">Terms & Conditions</h1>
        <p className="static-date">Effective Date: January 2025</p>
        
        <section className="static-section">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using LaTexT's services, you agree to be bound by these Terms and Conditions. 
            If you do not agree to these terms, please do not use our services.
          </p>
        </section>

        <section className="static-section">
          <h2>2. Service Description</h2>
          <p>
            LaTexT provides an AI-powered document conversion service that transforms Word documents into 
            professionally typeset LaTeX documents. The service includes:
          </p>
          <ul>
            <li>Document upload and processing</li>
            <li>Template selection from various journal formats</li>
            <li>Preview of converted documents</li>
            <li>Download of LaTeX source files (paid feature)</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>3. User Accounts</h2>
          <p>
            You may use our services as an anonymous user or create an account. Account holders are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of their account credentials</li>
            <li>All activities that occur under their account</li>
            <li>Providing accurate and complete information</li>
            <li>Updating information to keep it current</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>4. Payment Terms</h2>
          <p>
            Payment is required to download converted LaTeX documents. All payments are processed through Stripe. 
            By making a payment, you agree to:
          </p>
          <ul>
            <li>Pay all applicable fees</li>
            <li>Provide valid payment information</li>
            <li>Authorize us to charge your payment method</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>5. Refund Policy</h2>
          <p>
            We offer refunds within 7 days of purchase if you are not satisfied with the conversion quality. 
            Refund requests must include specific details about the quality issues encountered.
          </p>
        </section>

        <section className="static-section">
          <h2>6. Intellectual Property</h2>
          <p>
            You retain all rights to your uploaded documents. By using our service, you grant us a limited 
            license to process your documents for the purpose of providing our services. We do not claim 
            ownership of your content.
          </p>
        </section>

        <section className="static-section">
          <h2>7. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Upload malicious files or content</li>
            <li>Attempt to reverse engineer our service</li>
            <li>Use the service for illegal purposes</li>
            <li>Violate intellectual property rights of others</li>
            <li>Exceed reasonable usage limits</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>8. Limitation of Liability</h2>
          <p>
            LaTexT is provided "as is" without warranties of any kind. We are not liable for any indirect, 
            incidental, special, or consequential damages arising from your use of our services.
          </p>
        </section>

        <section className="static-section">
          <h2>9. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your account if you violate these terms. 
            You may delete your account at any time through your account settings.
          </p>
        </section>

        <section className="static-section">
          <h2>10. Changes to Terms</h2>
          <p>
            We may update these terms from time to time. Continued use of our services after changes 
            constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="static-section">
          <h2>11. Contact Information</h2>
          <p>
            For questions about these Terms & Conditions, please contact us at:
            <br />
            <a href="mailto:legal@latex.com">legal@latex.com</a>
          </p>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsConditions;