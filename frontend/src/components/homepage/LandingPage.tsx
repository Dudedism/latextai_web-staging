import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Banner from '../Banner';
import { HeroSection, PricingCompare } from '.'; // barrel import
import { HowItWorksTitle, HowItWorksSteps } from './HowItWorks';
import './LandingPage.css';

const testimonials = [
  {
    quote: "I spent two days trying to format my IEEE paper in LaTeX. With LaTeXt.ai, it took 5 minutes and the output was cleaner than what I had.",
    author: "Postdoc",
    affiliation: "Biomedical Engineering"
  },
  {
    quote: "The Crossref reference verification alone is worth it. Every citation was checked and correctly formatted — no more manual BibTeX editing.",
    author: "Professor",
    affiliation: "Social Science"
  },
  {
    quote: "Our group submits to Elsevier and Springer regularly. This has become part of our standard workflow — upload the Word draft, download the LaTeX.",
    author: "Research Group Lead",
    affiliation: "Materials Science"
  }
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const [citationExpanded, setCitationExpanded] = useState(false);

  const handleTryFree = () => {
    navigate('/papers/new');
  };

  const handleBrowseJournals = () => {
    navigate('/journals');
  };

  // Testimonial slideshow for mobile
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const nextTestimonial = useCallback(() => {
    setActiveTestimonial(prev => (prev + 1) % testimonials.length);
  }, []);

  useEffect(() => {
    const timer = setInterval(nextTestimonial, 5000);
    return () => clearInterval(timer);
  }, [nextTestimonial]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      setActiveTestimonial(prev =>
        diff > 0
          ? (prev + 1) % testimonials.length
          : (prev - 1 + testimonials.length) % testimonials.length
      );
    }
    touchStartX.current = null;
  };

  return (
    <div className="landing-container">
      <Banner />

      {/* Section 1: Hero */}
      <HeroSection />

      {/* Section 2: Publishers */}
      <section className="section" style={{ marginTop: '-30px' }}>
        <div className="publishers-section">
          <img src="/elsevier.png" alt="Elsevier" className="publisher-logo" style={{ width: '156px', height: '76px' }} />
          <img src="/ieee.svg" alt="IEEE" className="publisher-logo" style={{ width: '138px', height: '77px' }} />
          <img src="/springer.png" alt="Springer" className="publisher-logo" style={{ width: '196px', height: '73px' }} />
          <img src="/lancet.svg" alt="The Lancet" className="publisher-logo" style={{ width: '250px', height: '28px' }} />
          <img src="/nature.svg" alt="Nature" className="publisher-logo" style={{ width: '168px', height: '46px' }} />
        </div>
        <div className={`feature-callout${citationExpanded ? ' expanded' : ''}`} onClick={() => setCitationExpanded(!citationExpanded)} style={{ cursor: 'pointer' }}>
          <div className="hero-feature-badge">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ transform: citationExpanded ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s ease' }}>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Auto Citation Lookup
          </div>
          <div className="feature-callout-collapse">
            <p className="feature-callout-text">
              We automatically search and match your citation keys to real publications, so your bibliography is always complete and correctly formatted.
            </p>
          </div>
        </div>
      </section>

      {/* Section 3: Action Buttons */}
      <section className="section" style={{ marginBottom: '40px' }}>
        <div className="action-buttons">
          <button className="btn-outline" onClick={handleTryFree}>Try It Free Now ↗</button>
          <button className="btn-outline" onClick={handleBrowseJournals}>Browse our supported journals ↗</button>
        </div>
      </section>

      {/* Social Proof / Testimonials */}
      <section className="section social-proof-section">
        {/* Desktop: 3-column grid */}
        <div className="testimonials-grid testimonials-desktop">
          {testimonials.map((t, i) => (
            <div key={i} className="testimonial-card">
              <p className="testimonial-quote">"{t.quote}"</p>
              <p className="testimonial-author">
                <strong>{t.author}</strong> — {t.affiliation}
              </p>
            </div>
          ))}
        </div>

        {/* Mobile: single-card slideshow */}
        <div className="testimonials-slideshow" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`testimonial-card testimonial-slide ${i === activeTestimonial ? 'testimonial-slide--active' : ''}`}
            >
              <p className="testimonial-quote">"{t.quote}"</p>
              <p className="testimonial-author">
                <strong>{t.author}</strong> — {t.affiliation}
              </p>
            </div>
          ))}
          <div className="testimonial-dots">
            {testimonials.map((_, i) => (
              <button
                key={i}
                className={`testimonial-dot ${i === activeTestimonial ? 'testimonial-dot--active' : ''}`}
                onClick={() => setActiveTestimonial(i)}
                aria-label={`Show testimonial ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: How it works - Title */}
      <HowItWorksTitle />

      {/* Demo Video */}
      <section className="section" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div style={{
          maxWidth: '1124px',
          margin: '0 auto',
          padding: '0 24px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.10)'
        }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              width: '100%',
              display: 'block',
              borderRadius: '12px'
            }}
          >
            <source src="/LaTeXtAI-Demo-HQ.mp4" type="video/mp4" />
          </video>
        </div>
      </section>

      {/* Section 4: How it works - Steps */}
      <HowItWorksSteps />

      {/* Blog Callout – replaces ValueProp */}
      <section className="section blog-callout">
        <div className="blog-callout-wrap">
          <div className="blog-callout-bubble" aria-hidden="true" />
          <div className="blog-callout-content">
            <div className="blog-callout-icon" aria-hidden="true">📣</div>
            <h2 className="blog-callout-title">Be updated, or update us!</h2>
            <p className="blog-callout-sub">Read the latest news, feature updates and insights — or share your own feedback with us.</p>
            <Link to="/blog" className="btn-outline blog-callout-cta">Visit our Blog →</Link>
          </div>
        </div>
      </section>

      <PricingCompare onTryFree={handleTryFree} />
    </div>
  );
};

export default LandingPage;
