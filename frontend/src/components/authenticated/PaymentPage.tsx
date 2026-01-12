import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface CostEstimate {
  base_credits: number;
  additional_pages: number;
  additional_credits: number;
  total_credits: number;
  total_dollars: number;
  breakdown: string;
}

interface Metadata {
  filesize: number;
  page_count: number;
  word_count: number;
  filename: string;
  template: string;
}

interface PaymentDetails {
  project_id: string;
  metadata: Metadata;
  cost_estimate: CostEstimate;
  can_use_free: boolean;
  credit_balance: number;
  has_sufficient_credits: boolean;
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin, user } = useAuth();

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const claimingRef = React.useRef(false);

  useEffect(() => {
    const setupSuccess = searchParams.get('setup_success');
    if (setupSuccess === 'true' && projectId && !claimingRef.current) {
      claimingRef.current = true;
      console.log('✅ [PAYMENT] Returned from Stripe setup, claiming free upload...');
      setSearchParams({});
      claimFreeAfterSetup();
    }
  }, [searchParams, projectId]);

  const claimFreeAfterSetup = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      await apiRequest('/api/latex/claim-free', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ [PAYMENT] Free upload claimed successfully');

      // Track free upload conversion (production only)
      if (window.location.hostname === 'latext.ai' && typeof window.gtag === 'function') {
        if (user?.email) {
          window.gtag('set', 'user_data', { 'email': user.email });
        }
        window.gtag('event', 'conversion', {
          'send_to': 'AW-17841022197/RDtCCOWwtd8bEPXJobtC'
        });
      }

      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ [PAYMENT] Processing started successfully');
      navigate(`/papers/${projectId}/view`);

    } catch (error: any) {
      console.error('❌ [PAYMENT] Error claiming free upload:', error);
      if (error.status === 409) {
        setErrorMessage(error.message || 'This card has already been used for a free upload.');
      } else {
        setErrorMessage(error.message || 'Failed to claim free upload');
      }
      setErrorStatusCode(error.status);
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const setupSuccess = searchParams.get('setup_success');
    if (setupSuccess === 'true') {
      // Skip fetching payment details when returning from Stripe setup
      // claimFreeAfterSetup() handles the flow from here
      return;
    }

    const fetchPaymentDetails = async () => {
      if (!projectId) {
        console.error('❌ [PAYMENT] No project ID provided');
        setErrorMessage('Project ID not found');
        setShowErrorModal(true);
        setInitialLoading(false);
        return;
      }

      console.log('📡 [PAYMENT] Fetching payment details for project:', projectId);

      try {
        const details = await apiRequest<PaymentDetails>(`/api/latex/project/${projectId}/payment-details`);
        console.log('✅ [PAYMENT] Payment details received:', details);
        setPaymentDetails(details);
      } catch (error: any) {
        console.error('❌ [PAYMENT] Error fetching payment details:', error);
        setErrorStatusCode(error.status);
        setErrorMessage(error.message || 'Failed to load payment details');
        setShowErrorModal(true);
      } finally {
        setInitialLoading(false);
      }
    };

    fetchPaymentDetails();
  }, [projectId, searchParams]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUseFreeUpload = async () => {
    if (!projectId) {
      setErrorMessage('Project ID not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 [STRIPE] Creating setup session for card verification...');

      const response = await apiRequest<{ checkout_url: string }>('/api/stripe/create-setup-session', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ [STRIPE] Setup session created, redirecting to card verification...');
      window.location.href = response.checkout_url;

    } catch (error: any) {
      console.error('❌ [STRIPE] Error creating setup session:', error);

      if (error.status === 409) {
        setErrorMessage(error.message || 'Your free upload has already been used. Please use credits.');
        setErrorStatusCode(409);
      } else {
        setErrorStatusCode(error.status);
        setErrorMessage(error.message || 'Failed to start card verification');
      }

      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessWithCredits = async () => {
    if (!projectId) {
      setErrorMessage('Project ID not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log('💳 [CREDITS] Processing with credits...');

      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ [CREDITS] Processing started successfully');
      navigate(`/papers/${projectId}/view`);

    } catch (error: any) {
      console.error('❌ [CREDITS] Error processing:', error);
      if (error.status === 402 && error.requires_topup) {
        navigate('/credits');
      } else {
        setErrorStatusCode(error.status);
        setErrorMessage(error.message || 'Failed to process document');
        setShowErrorModal(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTopUpCredits = () => {
    navigate('/credits');
  };

  const handleAdminQuickProcess = async () => {
    if (!projectId) {
      setErrorMessage('Project ID not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log('🔧 [ADMIN] Marking project as paid...');
      await apiRequest('/api/latex/admin/mark-paid', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });
      console.log('✅ [ADMIN] Project marked as paid');

      console.log('🔧 [ADMIN] Starting processing...');
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });
      console.log('✅ [ADMIN] Processing started');

      navigate(`/papers/${projectId}/view`);
    } catch (error: any) {
      console.error('❌ [ADMIN] Error:', error);
      setErrorStatusCode(error.status);
      setErrorMessage(error.message || 'Failed to process project');
      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/papers');
  };

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
    navigate('/papers');
  };

  if (initialLoading) {
    return <LoadingScreen />;
  }

  if (!paymentDetails) {
    return (
      <div className="page">
        <Banner />
        <section className="main-section main-section--centered">
          <div className="container container--md text-center">
            <h1 className="section-title">Error</h1>
            <p className="mb-6">Failed to load payment details. Please try again.</p>
            <button className="btn btn--secondary btn--lg" onClick={handleCancel}>
              Go Back
            </button>
          </div>
        </section>
        <Footer />
      </div>
    );
  }

  const { cost_estimate: costEstimate, metadata, can_use_free: canUseFree, credit_balance: creditBalance, has_sufficient_credits: hasSufficientCredits } = paymentDetails;

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md">
          <h1 className="section-title text-center">Review & Payment</h1>

          <div className="flex flex-col gap-6">
            {/* Document Details */}
            <div>
              <h2 className="section-heading">Document Details</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">File:</span>
                  <span className="detail-value">{metadata.filename}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Template:</span>
                  <span className="detail-value">{metadata.template}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Size:</span>
                  <span className="detail-value">{formatFileSize(metadata.filesize)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Pages:</span>
                  <span className="detail-value">{metadata.page_count}</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div>
              <h2 className="section-heading">Cost</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Base (up to 15 pages):</span>
                  <span className="detail-value">{costEstimate.base_credits} credits</span>
                </div>
                {costEstimate.additional_pages > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">
                      Additional ({costEstimate.additional_pages} pages × 50):
                    </span>
                    <span className="detail-value">{costEstimate.additional_credits} credits</span>
                  </div>
                )}
                <div className="detail-item" style={{ borderTop: '2px solid var(--color-gray-300)', paddingTop: '12px' }}>
                  <span className="detail-label font-bold">Total:</span>
                  <span className="detail-value font-bold">{costEstimate.total_credits} credits (${costEstimate.total_dollars.toFixed(2)})</span>
                </div>
              </div>
            </div>

            {/* Credit Balance */}
            <div>
              <h2 className="section-heading">Your Balance</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Available credits:</span>
                  <span className={`detail-value font-bold ${hasSufficientCredits ? 'text-success' : 'text-error'}`}>
                    {creditBalance.toLocaleString()} credits
                  </span>
                </div>
                {!hasSufficientCredits && (
                  <div className="detail-item">
                    <span className="detail-label">Need:</span>
                    <span className="detail-value text-error">
                      {(costEstimate.total_credits - creditBalance).toLocaleString()} more credits
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Free Upload Notice */}
            {canUseFree && (
              <div className="notice notice--info" style={{ flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', width: '100%' }}>
                  <div className="notice-icon">🎁</div>
                  <div className="notice-content">
                    <strong>You have 1 free upload available!</strong>
                    <p>Card verification required to prevent abuse. You will not be charged.</p>
                  </div>
                </div>
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleUseFreeUpload}
                  disabled={loading}
                  style={{ marginTop: '12px' }}
                >
                  {loading ? 'Verifying...' : 'Use Free Upload'}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center mt-8">
            <button className="btn btn--secondary btn--lg" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>

            {hasSufficientCredits ? (
              <button
                className="btn btn--primary btn--lg"
                onClick={handleProcessWithCredits}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Process Now (${costEstimate.total_credits} credits)`}
              </button>
            ) : (
              <button
                className="btn btn--primary btn--lg"
                onClick={handleTopUpCredits}
                disabled={loading}
              >
                Top Up Credits
              </button>
            )}
          </div>

          {/* Admin Debug Controls */}
          {isAdmin && (
            <div style={{ marginTop: '2rem', borderTop: '2px solid #ff6b35', paddingTop: '1rem' }}>
              <h2 className="section-heading" style={{ color: '#ff6b35' }}>🔧 Admin Debug Controls</h2>
              <p className="text-sm text-muted mb-4">
                Bypass payment and process immediately for testing purposes.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  className="btn"
                  onClick={handleAdminQuickProcess}
                  disabled={loading}
                  style={{ backgroundColor: '#4CAF50', color: 'white' }}
                >
                  {loading ? 'Processing...' : '⚡ Quick Process (Admin)'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={handleErrorModalClose}
        statusCode={errorStatusCode}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default PaymentPage;
