import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-top-row">
          <div className="footer-brand">
            <h2 className="footer-logo">LaTexT</h2>
            <p className="footer-copyright">© LaTexT, All rights reserved.</p>
          </div>

          <div className="footer-section footer-section-site">
            <h3 className="footer-heading">The Site</h3>
            <ul className="footer-links">
              <li><Link to="/">Home</Link></li>
              <li><Link to="/about">About</Link></li>
              <li><Link to="/pricing">Pricing</Link></li>
              <li><Link to="/journals">Supported Journals</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-row">
          <div className="footer-section footer-section-legal">
            <h3 className="footer-heading">Legal</h3>
            <ul className="footer-links">
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms & Conditions</Link></li>
            </ul>
          </div>

          <div className="footer-section footer-section-contact">
            <h3 className="footer-heading">Contact Us</h3>
            <ul className="footer-links">
              <li><a href="mailto:contact@latext.ai">contact@latext.ai</a></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;