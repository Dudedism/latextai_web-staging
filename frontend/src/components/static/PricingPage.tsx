import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { StatusModal } from '../common/StatusModal';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import './PricingPage.css';

interface SubscriptionTier {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  price_dollars: number;
}

const FALLBACK_TIERS: SubscriptionTier[] = [
  { id: 'scholar', name: 'Scholar', credits: 5000, price_cents: 499, price_dollars: 4.99 },
  { id: 'researcher', name: 'Researcher', credits: 8000, price_cents: 799, price_dollars: 7.99 },
  { id: 'professor', name: 'Professor', credits: 10000, price_cents: 999, price_dollars: 9.99 },
];

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();

  const [tiers, setTiers] = useState<SubscriptionTier[]>(FALLBACK_TIERS);
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTier, setSuccessTier] = useState<string | null>(null);

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const data = await apiRequest<{ tiers: SubscriptionTier[] }>('/api/subscription/tiers', { method: 'GET' });
        if (data.tiers?.length) setTiers(data.tiers);
      } catch {
        // Use fallback tiers
      }
    };
    fetchTiers();

    // Handle subscription success redirect
    if (searchParams.get('subscription_cancelled') === 'true') {
      // No action needed, user just returned from cancelled checkout
    }
  }, []);

  // Check for success redirect from account page
  useEffect(() => {
    const tier = searchParams.get('subscription_success_tier');
    if (tier) {
      setSuccessTier(tier);
      setShowSuccessModal(true);
    }
  }, [searchParams]);

  const handleSubscribe = async (tierKey: string) => {
    if (!isAuthenticated) {
      navigate('/signup');
      return;
    }

    try {
      setSubscribingTier(tierKey);
      const data = await apiRequest<{ checkout_url: string }>('/api/subscription/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ tier: tierKey }),
      });
      window.location.href = data.checkout_url;
    } catch (err: any) {
      alert(err.message || 'Failed to start checkout');
      setSubscribingTier(null);
    }
  };

  const estimateConversions = (credits: number) => Math.floor(credits / 499);

  return (
    <div className="static-page">
      <Banner />

      <section className="static-main-section">
        <div className="pricing-container">
          <h1 className="static-title" style={{ textAlign: 'center' }}>Simple, Transparent Pricing</h1>
          <p className="pricing-subtitle">
            Subscribe monthly or pay as you go. Cancel anytime.
          </p>

          {/* Subscription Tiers */}
          <div className="pricing-grid">
            {tiers.map((tier) => {
              const isPopular = tier.id === 'researcher';
              const conversions = estimateConversions(tier.credits);
              const costPerDoc = (tier.price_cents / conversions / 100).toFixed(2);

              return (
                <div key={tier.id} className={`pricing-card ${isPopular ? 'pricing-card--popular' : ''}`}>
                  {isPopular && <div className="pricing-badge">Most Popular</div>}
                  <h3 className="pricing-card-name">{tier.name}</h3>

                  <div className="pricing-card-price">
                    <span className="pricing-card-currency">$</span>
                    <span className="pricing-card-amount">{tier.price_dollars.toFixed(2)}</span>
                    <span className="pricing-card-period">/month</span>
                  </div>

                  <div className="pricing-card-credits">
                    {tier.credits.toLocaleString()} credits/month
                  </div>

                  <ul className="pricing-card-features">
                    <li>~{conversions} document conversions</li>
                    <li>~${costPerDoc} per document</li>
                    <li>PDF + LaTeX source + bibliography</li>
                    <li>Delivery in minutes</li>
                    <li>Unused credits carry over</li>
                    <li>Cancel anytime</li>
                  </ul>

                  <button
                    className={`pricing-card-cta ${isPopular ? 'pricing-card-cta--primary' : ''}`}
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={subscribingTier === tier.id}
                  >
                    {subscribingTier === tier.id ? 'Redirecting...' : isAuthenticated ? 'Subscribe' : 'Get Started'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pay As You Go */}
          <div className="pricing-payg">
            <div className="pricing-payg-card">
              <div className="pricing-payg-content">
                <h3 className="pricing-payg-title">Pay As You Go</h3>
                <p className="pricing-payg-desc">
                  No commitment. Purchase credits when you need them.
                </p>
                <div className="pricing-payg-price">
                  1 credit = $0.01 &middot; Base document: 499 credits ($4.99) &middot; +50 credits per extra page
                </div>
              </div>
              <button
                className="pricing-card-cta"
                onClick={() => isAuthenticated ? navigate('/credits') : navigate('/signup')}
              >
                {isAuthenticated ? 'Buy Credits' : 'Get Started'}
              </button>
            </div>

            <p className="pricing-savings-note">
              Save up to 80% per document with a subscription compared to pay-as-you-go pricing.
            </p>
          </div>

          {/* Enterprise */}
          <section className="static-section">
            <h2>Enterprise &amp; Institutional Pricing</h2>
            <p>
              Need a custom solution for your institution or research group? We offer flexible plans
              for universities, research institutions, and corporate R&amp;D departments.
            </p>
            <p>
              Contact us at <a href="mailto:contact@latext.ai">contact@latext.ai</a> to discuss
              your needs and get a custom quote.
            </p>
          </section>

          {/* FAQ */}
          <section className="static-section">
            <h2>Frequently Asked Questions</h2>

            <h3>How does the subscription work?</h3>
            <p>
              Choose a monthly plan and receive credits every month. Credits are added to your balance
              and can be used for document conversions. Unused credits carry over — they never expire.
              You can cancel your subscription at any time and keep your remaining credits.
            </p>

            <h3>What's the difference between subscription and pay-as-you-go?</h3>
            <p>
              Subscriptions give you credits at a significant discount. For example, the Scholar plan
              gives you ~10 conversions for $4.99/month (~$0.50/doc), while a single pay-as-you-go
              conversion costs $4.99. That's up to 80% savings.
            </p>

            <h3>What payment methods do you accept?</h3>
            <p>
              We accept all major credit cards (Visa, MasterCard, American Express) and debit cards
              through our secure payment processor, Stripe.
            </p>

            <h3>What's included in the download?</h3>
            <p>
              Your download includes the submission-ready PDF, the main .tex file, bibliography file (.bib),
              all extracted images, and a compilation package with instructions.
            </p>

            <h3>How fast is the conversion?</h3>
            <p>
              Most conversions are completed within minutes, not days like traditional services.
            </p>
          </section>
        </div>
      </section>

      <Footer />

      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        status="success"
        title="Subscription Activated!"
        message={`Your ${successTier ? successTier.charAt(0).toUpperCase() + successTier.slice(1) : ''} subscription is now active. Credits have been added to your account.`}
        actionButton={{
          label: 'Go to Account',
          onClick: () => {
            setShowSuccessModal(false);
            navigate('/account');
          }
        }}
      />
    </div>
  );
};

export default PricingPage;
