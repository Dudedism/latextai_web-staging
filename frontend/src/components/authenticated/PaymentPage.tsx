import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { apiRequest } from '../../utils/api';
import '../../styles/common.css';
import './PaymentPage.css';

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
    // TODO: Stripe integration
    alert('Stripe payment integration coming soon!');
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
      <div className="payment-page">
        <Banner />
        <section className="payment-main-section">
          <div className="payment-container">
            <h1 className="payment-title">Error</h1>
            <p>Failed to load payment details. Please try again.</p>
            <button className="payment-btn payment-btn-cancel" onClick={handleCancel}>
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
    <div className="payment-page">
      <Banner />

      <section className="payment-main-section">
        <div className="payment-container">
          <div className="upload-progress">
            <div className="progress-step">File</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Template</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step">Upload</div>
            <div className="progress-arrow">→</div>
            <div className="progress-step active">Payment</div>
          </div>

          <h1 className="payment-title">Review & Payment</h1>

          <div className="payment-content">
            {/* Document Details */}
            <div className="payment-section">
              <h2 className="payment-section-title">Document Details</h2>
              <div className="payment-details-grid">
                <div className="payment-detail-item">
                  <span className="payment-detail-label">File:</span>
                  <span className="payment-detail-value">{metadata.filename}</span>
                </div>
                <div className="payment-detail-item">
                  <span className="payment-detail-label">Size:</span>
                  <span className="payment-detail-value">{formatFileSize(metadata.filesize)}</span>
                </div>
                <div className="payment-detail-item">
                  <span className="payment-detail-label">Pages:</span>
                  <span className="payment-detail-value">{metadata.page_count}</span>
                </div>
              </div>
            </div>

            {/* Cost Breakdown */}
            <div className="payment-section">
              <h2 className="payment-section-title">Cost Breakdown</h2>
              <div className="payment-cost-breakdown">
                <div className="payment-cost-item">
                  <span className="payment-cost-label">Base conversion fee (up to 15 pages):</span>
                  <span className="payment-cost-value">${costEstimate.base_cost.toFixed(2)}</span>
                </div>
                {costEstimate.additional_pages > 0 && (
                  <div className="payment-cost-item">
                    <span className="payment-cost-label">
                      Additional pages ({costEstimate.additional_pages} × $0.50):
                    </span>
                    <span className="payment-cost-value">${costEstimate.additional_cost.toFixed(2)}</span>
                  </div>
                )}
                <div className="payment-cost-divider"></div>
                <div className="payment-cost-item payment-cost-total">
                  <span className="payment-cost-label">Total:</span>
                  <span className="payment-cost-value">${costEstimate.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Payment Options */}
            {canUseFree && (
              <div className="payment-notice">
                <div className="payment-notice-icon">🎁</div>
                <div className="payment-notice-content">
                  <strong>You have 1 free upload available!</strong>
                  <p>This will use your one-time free document conversion. After this, standard pricing applies.</p>
                </div>
              </div>
            )}
          </div>

          <div className="payment-actions">
            <button className="payment-btn payment-btn-cancel" onClick={handleCancel} disabled={loading}>
              Cancel
            </button>

            {canUseFree ? (
              <button
                className="payment-btn payment-btn-free"
                onClick={handleUseFreeUpload}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Use Free Upload'}
              </button>
            ) : (
              <button
                className="payment-btn payment-btn-pay"
                onClick={handlePayWithStripe}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Pay $${costEstimate.total.toFixed(2)}`}
              </button>
            )}
          </div>
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
