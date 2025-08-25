import React from 'react';
import Banner from './Banner';
import Footer from './Footer';
import '../styles/common.css';
import './StaticPages.css';

const AboutPage: React.FC = () => {
  return (
    <div className="static-page">
      <Banner />
      
      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title">About LaTexT</h1>
        
        <section className="static-section">
          <h2>Our Mission</h2>
          <p>
            LaTexT is revolutionizing academic publishing by eliminating the tedious formatting process 
            that researchers face when submitting manuscripts to journals. We believe scientists should 
            focus on their research, not on wrestling with LaTeX syntax and journal templates.
          </p>
        </section>

        <section className="static-section">
          <h2>Why LaTeX Matters</h2>
          <p>
            LaTeX remains the gold standard for scientific typesetting, offering unparalleled precision 
            in mathematical formulas, consistent formatting, and professional typography. However, its 
            steep learning curve and complex syntax have been barriers for many researchers.
          </p>
          <p>
            LaTexT bridges this gap by providing the benefits of LaTeX without requiring users to learn 
            its intricate markup language. Simply upload your Word document, and we'll handle the rest.
          </p>
        </section>

        <section className="static-section">
          <h2>How It Works</h2>
          <p>Our AI-powered technology:</p>
          <ul>
            <li>Analyzes your document structure and content</li>
            <li>Identifies sections, equations, references, and figures</li>
            <li>Applies journal-specific formatting rules</li>
            <li>Generates clean, submission-ready LaTeX code</li>
            <li>Ensures compatibility with journal submission systems</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>Our Technology</h2>
          <p>
            LaTexT uses advanced natural language processing and document analysis algorithms to understand 
            your manuscript's structure. Our system has been trained on thousands of academic papers across 
            various disciplines, ensuring accurate conversion regardless of your field.
          </p>
        </section>

        <section className="static-section">
          <h2>Supported Publishers</h2>
          <p>
            We support templates from major academic publishers including Nature, IEEE, Elsevier, 
            Springer, The Lancet, and many more. Our template library is continuously expanding based 
            on user requests and publisher updates.
          </p>
        </section>

        <section className="static-section">
          <h2>Our Team</h2>
          <p>
            LaTexT was founded by a team of researchers and software engineers who experienced firsthand 
            the frustration of manuscript formatting. We're passionate about making academic publishing 
            more accessible and efficient for researchers worldwide.
          </p>
        </section>

        <section className="static-section">
          <h2>Success Stories</h2>
          <p>
            Since our launch, we've helped thousands of researchers save countless hours on formatting. 
            Our users report spending 90% less time on manuscript preparation, allowing them to focus 
            on what matters most: their research.
          </p>
        </section>

        <section className="static-section">
          <h2>Contact Us</h2>
          <p>
            We'd love to hear from you! Whether you have questions, feedback, or partnership inquiries, 
            please reach out to us at:
          </p>
          <ul>
            <li>General inquiries: <a href="mailto:info@latex.com">info@latex.com</a></li>
            <li>Technical support: <a href="mailto:support@latex.com">support@latex.com</a></li>
            <li>Media & press: <a href="mailto:press@latex.com">press@latex.com</a></li>
          </ul>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutPage;