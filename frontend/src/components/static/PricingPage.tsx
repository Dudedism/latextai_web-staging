import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { StatusModal } from '../common/StatusModal';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';
import { formatCredits, getPricingConfig } from '../../utils/pricing';
import './PricingPage.css';

interface SubscriptionTier {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  price_dollars: number;
  price_display?: string;
  currency?: string;
  currency_symbol?: string;
}

const FALLBACK_TIERS: SubscriptionTier[] = [
  { id: 'scholar', name: 'Scholar', credits: 5000, price_cents: 349, price_dollars: 3.49 },
  { id: 'researcher', name: 'Researcher', credits: 8000, price_cents: 499, price_dollars: 4.99 },
  { id: 'professor', name: 'Professor', credits: 10000, price_cents: 699, price_dollars: 6.99 },
];

// Original prices (before launch discount) — shown crossed out
const ORIGINAL_PRICES: Record<string, Record<string, string>> = {
  standard: { scholar: '$4.99', researcher: '$7.99', professor: '$9.99' },
  emerging_inr: { scholar: '₹249', researcher: '₹399', professor: '₹599' },
  emerging_usd: { scholar: '$4.99', researcher: '$7.99', professor: '$9.99' },
};

const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, user } = useAuth();

  const [tiers, setTiers] = useState<SubscriptionTier[]>(FALLBACK_TIERS);
  const [pricingTier, setPricingTier] = useState<string>('standard');
  const [subscribingTier, setSubscribingTier] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successTier, setSuccessTier] = useState<string | null>(null);

  useEffect(() => {
    const detectAndFetchTiers = async () => {
      // Detect pricing tier (allow ?preview_tier= override for testing)
      const previewTier = searchParams.get('preview_tier');
      let detectedTier = 'standard';

      if (previewTier && ['standard', 'emerging_inr', 'emerging_usd'].includes(previewTier)) {
        detectedTier = previewTier;
      } else if (isAuthenticated && user?.pricingTier) {
        detectedTier = user.pricingTier;
      } else if (!isAuthenticated) {
        try {
          const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/subscription/detect-pricing`);
          if (response.ok) {
            const data = await response.json();
            detectedTier = data.pricing_tier || 'standard';
          }
        } catch {
          // Fall back to standard
        }
      }

      setPricingTier(detectedTier);

      // Fetch tiers with pricing_tier param
      try {
        const data = await apiRequest<{ tiers: SubscriptionTier[] }>(
          `/api/subscription/tiers?pricing_tier=${encodeURIComponent(detectedTier)}`,
          { method: 'GET' }
        );
        if (data.tiers?.length) setTiers(data.tiers);
      } catch {
        // Use fallback tiers
      }
    };
    detectAndFetchTiers();

    // Handle subscription success redirect
    if (searchParams.get('subscription_cancelled') === 'true') {
      // No action needed, user just returned from cancelled checkout
    }
  }, [isAuthenticated, user?.pricingTier]);

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
  const currencySymbol = tiers[0]?.currency_symbol || getPricingConfig(pricingTier).currencySymbol;

  // Format price amount without currency symbol (e.g. "3.49" or "149")
  const formatPriceAmount = (cents: number, currency?: string) => {
    const amount = cents / 100;
    return currency === 'inr' ? Math.round(amount).toString() : amount.toFixed(2);
  };

  return (
    <div className="static-page">
      <Banner />

      <section className="static-main-section">
        <div className="pricing-container">
          <h1 className="static-title" style={{ textAlign: 'center' }}>Simple, Transparent Pricing</h1>
          <p className="pricing-subtitle">
            Subscribe monthly or pay as you go. Cancel anytime.
          </p>

          {/* Launch Pricing Banner */}
          <div className="pricing-launch-banner">
            Launch Pricing — Limited Time Offer
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
                  Base document: 499 credits ({formatCredits(499, pricingTier)}) &middot; +50 credits per extra page
                </div>
                <div style={{ marginTop: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '14px' }}>
                  Introductory offer: +150 bonus credits on purchases of {formatCredits(1000, pricingTier)} or more!
                </div>
              </div>
              <button
                className="pricing-card-cta"
                onClick={() => isAuthenticated ? navigate('/credits') : navigate('/signup')}
              >
                {isAuthenticated ? 'Buy Credits' : 'Get Started'}
              </button>
            </div>
          </div>

          <p className="pricing-savings-note">
            Save up to 80% per document with a subscription compared to pay-as-you-go pricing.
          </p>

          {/* Subscription Tiers */}
          <div className="pricing-grid">
            {tiers.map((tier) => {
              const isPopular = tier.id === 'researcher';
              const conversions = estimateConversions(tier.credits);
              const costPerDocAmount = (tier.price_cents / conversions / 100);
              const costPerDoc = tier.currency === 'inr'
                ? `${tier.currency_symbol || currencySymbol}${Math.round(costPerDocAmount)}`
                : `${tier.currency_symbol || currencySymbol}${costPerDocAmount.toFixed(2)}`;
              const originalPrice = (ORIGINAL_PRICES[pricingTier] || ORIGINAL_PRICES.standard)[tier.id];

              return (
                <div key={tier.id} className={`pricing-card ${isPopular ? 'pricing-card--popular' : ''}`}>
                  {isPopular && <div className="pricing-badge">Most Popular</div>}
                  <h3 className="pricing-card-name">{tier.name}</h3>

                  <div className="pricing-card-price">
                    {originalPrice && (
                      <span className="pricing-card-original">{originalPrice}</span>
                    )}
                    <span className="pricing-card-currency">{tier.currency_symbol || '$'}</span>
                    <span className="pricing-card-amount">{formatPriceAmount(tier.price_cents, tier.currency)}</span>
                    <span className="pricing-card-period">/month</span>
                  </div>

                  <div className="pricing-card-credits">
                    {tier.credits.toLocaleString()} credits/month
                  </div>

                  <ul className="pricing-card-features">
                    <li>~{conversions} document conversions</li>
                    <li>~{costPerDoc} per document</li>
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
              gives you ~10 conversions for {tiers[0] ? `${tiers[0].currency_symbol || currencySymbol}${formatPriceAmount(tiers[0].price_cents, tiers[0].currency)}` : formatCredits(499, pricingTier)}/month, while a single pay-as-you-go
              conversion costs {formatCredits(499, pricingTier)}. That's up to 80% savings.
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
