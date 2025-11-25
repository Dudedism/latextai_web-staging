import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { apiRequest } from '../../utils/api';
import { useAuth } from '../../contexts/AuthContext';

interface CostEstimate {
  base_cost: number;
  additional_pages: number;
  additional_cost: number;
  total: number;
  breakdown: string;
}

interface Metadata {
  filesize: number;
  page_count: number;
  word_count: number;
  filename: string;
}

interface PaymentDetails {
  project_id: string;
  metadata: Metadata;
  cost_estimate: CostEstimate;
  can_use_free: boolean;
}

const PaymentPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { isAdmin } = useAuth();

  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorStatusCode, setErrorStatusCode] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  // Fetch payment details on mount
  useEffect(() => {
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
  }, [projectId]);

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
      // STEP 1: Claim free upload (atomic operation)
      await apiRequest('/api/latex/claim-free', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ Free upload claimed successfully');

      // STEP 2: Trigger processing
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ Processing started successfully');

      // STEP 3: Navigate to preview page
      navigate(`/papers/${projectId}/view`);

    } catch (error: any) {
      console.error('Error claiming free upload:', error);

      if (error.status === 409) {
        // Free upload already used or race condition
        setErrorMessage(error.message || 'Your free upload has already been used. Please use a payment method.');
        setErrorStatusCode(409);
      } else {
        setErrorStatusCode(error.status);
        setErrorMessage(error.message);
      }

      setShowErrorModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePayWithStripe = async () => {
    if (!projectId) {
      setErrorMessage('Project ID not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      console.log('💳 [STRIPE] Creating checkout session...');

      const response = await apiRequest<{ checkout_url: string }>('/api/stripe/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });

      console.log('✅ [STRIPE] Checkout session created, redirecting...');

      // Redirect to Stripe Checkout
      window.location.href = response.checkout_url;

    } catch (error: any) {
      console.error('❌ [STRIPE] Error creating checkout session:', error);
      setErrorStatusCode(error.status);
      setErrorMessage(error.message || 'Failed to create checkout session');
      setShowErrorModal(true);
      setLoading(false);
    }
  };

  const handleAdminQuickProcess = async () => {
    if (!projectId) {
      setErrorMessage('Project ID not found');
      setShowErrorModal(true);
      return;
    }

    setLoading(true);
    try {
      // STEP 1: Mark as paid
      console.log('🔧 [ADMIN] Marking project as paid...');
      await apiRequest('/api/latex/admin/mark-paid', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });
      console.log('✅ [ADMIN] Project marked as paid');

      // STEP 2: Start processing
      console.log('🔧 [ADMIN] Starting processing...');
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: projectId })
      });
      console.log('✅ [ADMIN] Processing started');

      // STEP 3: Navigate to view page
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

  const { cost_estimate: costEstimate, metadata, can_use_free: canUseFree } = paymentDetails;

  return (
    <div className="page">
      <Banner />

      <section className="main-section">
        <div className="container container--md">
          <div className="progress-steps">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step progress-step--active">Payment</div>
          </div>

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
              <h2 className="section-heading">Cost Breakdown</h2>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Base conversion fee (up to 15 pages):</span>
                  <span className="detail-value">${costEstimate.base_cost.toFixed(2)}</span>
                </div>
                {costEstimate.additional_pages > 0 && (
                  <div className="detail-item">
                    <span className="detail-label">
                      Additional pages ({costEstimate.additional_pages} × $0.50):
                    </span>
                    <span className="detail-value">${costEstimate.additional_cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="detail-item" style={{ borderTop: '2px solid var(--color-gray-300)', paddingTop: '12px', fontWeight: 'bold' }}>
                  <span className="detail-label" style={{ fontWeight: 'bold', color: 'var(--color-black)' }}>Total:</span>
                  <span className="detail-value" style={{ fontSize: '18px' }}>${costEstimate.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Free Upload Notice */}
            {canUseFree && (
              <div className="notice notice--info" style={{ flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', width: '100%' }}>
                  <div className="notice-icon">🎁</div>
                  <div className="notice-content">
                    <strong>You have 1 free upload available!</strong>
                    <p>This will use your one-time free document conversion. After this, standard pricing applies.</p>
                  </div>
                </div>
                <button
                  className="btn btn--primary btn--lg"
                  onClick={handleUseFreeUpload}
                  disabled={loading}
                  style={{ marginTop: '12px' }}
                >
                  {loading ? 'Processing...' : 'Use Free Upload'}
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-4 justify-center mt-8">
            <button className="btn btn--secondary btn--lg" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>

            <button
              className="btn btn--primary btn--lg"
              onClick={handlePayWithStripe}
              disabled={loading}
            >
              {loading ? 'Processing...' : `Pay $${costEstimate.total.toFixed(2)}`}
            </button>
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
                <button
                  className="btn"
                  onClick={() => {
                    setPaymentDetails(prev => prev ? {
                      ...prev,
                      can_use_free: !prev.can_use_free
                    } : null);
                  }}
                  style={{ backgroundColor: '#2196F3', color: 'white' }}
                >
                  {canUseFree ? '🎁 Mock: Free → Paid' : '💳 Mock: Paid → Free'}
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
