import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { StatusModal } from '../common/StatusModal';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface BalanceResponse {
  balance: number;
  formatted: string;
}

interface TopUpResponse {
  checkout_url: string;
}

interface TransactionResponse {
  transactions: Array<{
    transaction_id: string;
    type: string;
    amount: number;
    balance_after: number;
    description: string;
    created_at: string;
  }>;
}

const MIN_CREDITS = 100;
const TOPUP_BONUS_CREDITS = 150; // Introductory bonus
const TOPUP_BONUS_MIN_CREDITS = 250; // Bonus only for purchases >= $2.50

const CreditTopUpPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Query params for project-specific top-up flow
  const paramAmount = searchParams.get('amount');
  const paramProjectName = searchParams.get('project_name');
  const paramProjectId = searchParams.get('project_id');
  const paramReturnTo = searchParams.get('return_to');
  const hasProjectContext = !!(paramProjectName && paramProjectId);

  const [balance, setBalance] = useState<number>(0);
  const [creditAmount, setCreditAmount] = useState<string>(
    paramAmount && parseInt(paramAmount, 10) >= MIN_CREDITS ? paramAmount : String(MIN_CREDITS)
  );
  const [transactions, setTransactions] = useState<TransactionResponse['transactions']>([]);
  const [loading, setLoading] = useState(true);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successCredits, setSuccessCredits] = useState<string | null>(null);
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>(undefined);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [balanceData, historyData] = await Promise.all([
          apiRequest<BalanceResponse>('/api/credits/balance', { method: 'GET' }),
          apiRequest<TransactionResponse>('/api/credits/history?limit=10', { method: 'GET' })
        ]);
        setBalance(balanceData.balance);
        setTransactions(historyData.transactions);
      } catch (err: any) {
        setErrorStatusCode(err.status);
        setError(err.message || 'Failed to load credit information');
        setShowErrorModal(true);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    if (searchParams.get('topup_success') === 'true') {
      const credits = searchParams.get('credits');
      setSuccessCredits(credits);
      setShowSuccessModal(true);

      // Track credit top-up conversion (production only)
      if (window.location.hostname === 'latext.ai' && typeof window.gtag === 'function' && credits) {
        const dollars = parseInt(credits, 10) / 100;
        if (user?.email) {
          window.gtag('set', 'user_data', { 'email': user.email });
        }
        window.gtag('event', 'conversion', {
          'send_to': 'AW-17841022197/pKmDCLvgsd8bEPXJobtC',
          'value': dollars,
          'currency': 'USD'
        });
      }
    } else if (searchParams.get('topup_cancelled') === 'true') {
      setError('Top-up was cancelled');
      setShowErrorModal(true);
    }
  }, [searchParams]);

  const handleTopUp = async () => {
    const credits = parseInt(creditAmount, 10);
    if (isNaN(credits) || credits < MIN_CREDITS) {
      setError(`Minimum top-up is ${MIN_CREDITS} credits ($${(MIN_CREDITS / 100).toFixed(2)})`);
      return;
    }

    try {
      setTopUpLoading(true);
      setError(null);
      const data = await apiRequest<TopUpResponse>('/api/credits/topup', {
        method: 'POST',
        body: JSON.stringify({ credits })
      });
      window.location.href = data.checkout_url;
    } catch (err: any) {
      setErrorStatusCode(err.status);
      setError(err.message || 'Failed to create checkout session');
      setShowErrorModal(true);
      setTopUpLoading(false);
    }
  };

  const parsedCredits = parseInt(creditAmount, 10) || 0;
  const dollarAmount = (parsedCredits / 100).toFixed(2);
  const isValidAmount = parsedCredits >= MIN_CREDITS;
  const qualifiesForBonus = TOPUP_BONUS_CREDITS > 0 && parsedCredits >= TOPUP_BONUS_MIN_CREDITS;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="page">
      <Banner />

      <section className="main-section main-section--centered">
        <div className="container container--sm">
          <h1 className="section-title">Credits</h1>

          <div className="card mb-6">
            <h2 className="section-heading">Current Balance</h2>
            <div className="text-lg font-bold mb-2">{balance.toLocaleString()} credits</div>
            <div className="text-muted">${(balance / 100).toFixed(2)}</div>
          </div>

          {hasProjectContext && (
            <div className="notice notice--info mb-6">
              <span className="notice-icon">&#9432;</span>
              <div className="notice-content">
                <strong>{paramProjectName}</strong>
                <p>Requires <strong>{paramAmount}</strong> credits (${paramAmount ? (parseInt(paramAmount, 10) / 100).toFixed(2) : '0.00'}) to process.</p>
              </div>
            </div>
          )}

          <div className="notice notice--info mb-6" style={{ cursor: 'pointer' }} onClick={() => navigate('/pricing')}>
            <span className="notice-icon">&#9733;</span>
            <div className="notice-content">
              <strong>Save up to 80% with a subscription</strong>
              <p style={{ margin: '4px 0 0' }}>Starting at $4.99/month for ~10 document conversions. <span style={{ color: 'var(--accent)', fontWeight: 500 }}>View plans &rarr;</span></p>
            </div>
          </div>

          <div className="card mb-6">
            <h2 className="section-heading">Top Up Credits</h2>
            <p className="text-muted text-sm mb-6">
              1 credit = $0.01. Minimum top-up: {MIN_CREDITS} credits (${(MIN_CREDITS / 100).toFixed(2)})
              {TOPUP_BONUS_CREDITS > 0 && (
                <span style={{ display: 'block', marginTop: '6px', color: '#2e7d32', fontWeight: 600 }}>
                  Introductory offer: +{TOPUP_BONUS_CREDITS} bonus credits on purchases of ${(TOPUP_BONUS_MIN_CREDITS / 100).toFixed(2)} or more!
                </span>
              )}
            </p>

            <div className="form-group">
              <label className="form-label">Credit Amount</label>
              <input
                type="number"
                className="form-input"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                min={MIN_CREDITS}
                step={100}
              />
            </div>

            <div className="mb-6">
              {isValidAmount ? (
                <span className="text-lg">
                  <strong>{parsedCredits.toLocaleString()}</strong> credits
                  {qualifiesForBonus && <span style={{ color: '#2e7d32', fontWeight: 700 }}> +{TOPUP_BONUS_CREDITS} bonus</span>}
                  {' '}= <strong>${dollarAmount}</strong>
                </span>
              ) : (
                <span className="text-muted">Enter at least {MIN_CREDITS} credits</span>
              )}
            </div>

            <button
              className="btn btn--primary"
              onClick={handleTopUp}
              disabled={!isValidAmount || topUpLoading}
            >
              {topUpLoading ? 'Redirecting to Stripe...' : hasProjectContext ? `Top Up for ${paramProjectName} ($${dollarAmount})` : `Top Up $${dollarAmount}`}
            </button>
          </div>

          {transactions.length > 0 && (
            <div className="card">
              <h2 className="section-heading">Recent Transactions</h2>
              <div className="detail-grid">
                {transactions.map((txn) => (
                  <div key={txn.transaction_id} className="detail-item">
                    <div>
                      <div className="font-medium">{txn.description}</div>
                      <div className="text-muted text-sm">
                        {new Date(txn.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className={`font-semibold ${txn.amount > 0 ? 'text-success' : 'text-error'}`}>
                      {txn.amount > 0 ? '+' : ''}{txn.amount}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        statusCode={errorStatusCode}
        errorMessage={error || undefined}
      />

      <StatusModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        status="success"
        title="Top-Up Successful"
        message={`${successCredits} credits have been added to your account.`}
        actionButton={{
          label: (paramReturnTo || paramProjectId) ? 'Return to Document' : 'Continue',
          onClick: () => {
            setShowSuccessModal(false);
            if (paramReturnTo) {
              navigate(paramReturnTo);
            } else if (paramProjectId) {
              navigate(`/papers/${paramProjectId}/view`);
            }
          }
        }}
      />
    </div>
  );
};

export default CreditTopUpPage;
