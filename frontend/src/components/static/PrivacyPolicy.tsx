import React from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import '../../styles/common.css';
import './StaticPages.css';

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="static-page">
      <Banner />
      
      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title">Privacy Policy</h1>
        <p className="static-date">Last updated: January 2025</p>
        
        <section className="static-section">
          <h2>1. Information We Collect</h2>
          <p>
            LaTexT collects information you provide directly to us, such as when you create an account, 
            upload documents, make a payment, or contact us for support.
          </p>
          <ul>
            <li>Account information (name, email address, password)</li>
            <li>Payment information (processed securely through Stripe)</li>
            <li>Document content (temporarily stored for processing)</li>
            <li>Usage data and analytics</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>2. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Process your documents and provide our services</li>
            <li>Process payments and maintain your account</li>
            <li>Send you technical notices and support messages</li>
            <li>Improve and optimize our services</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>3. Data Storage and Security</h2>
          <p>
            Your documents are temporarily stored during processing and automatically deleted after 30 days. 
            We implement appropriate technical and organizational measures to protect your personal information.
          </p>
        </section>

        <section className="static-section">
          <h2>4. Anonymous Users</h2>
          <p>
            Anonymous users can upload and preview documents without creating an account. We use cookies 
            to maintain your session and store your documents for up to 7 days.
          </p>
        </section>

        <section className="static-section">
          <h2>5. Third-Party Services</h2>
          <p>We use the following third-party services:</p>
          <ul>
            <li><strong>Stripe:</strong> For payment processing</li>
            <li><strong>Google OAuth:</strong> For authentication (optional)</li>
            <li><strong>AWS S3:</strong> For secure file storage</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>6. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>7. Contact Us</h2>
          <p>
            If you have questions about this Privacy Policy, please contact us at:
            <br />
            <a href="mailto:privacy@latex.com">privacy@latex.com</a>
          </p>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;