import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { ErrorModal } from '../common/ErrorModal';
import { apiRequest, apiFetch } from '../../utils/api';
import { downloadFile } from '../../utils/download';
import { useAuth } from '../../contexts/AuthContext';
import './PreviewPage.css';

const FAST_POLL_INTERVAL = 5000;
const PAYMENT_TIMEOUT = 30000;

interface ProjectResponse {
  status: string;
  paid?: boolean;
  is_preview?: boolean;
  paid_with_free_upload?: boolean;
  compilation_failed?: boolean;
  feedback?: 'positive' | 'negative' | null;
}

interface CreditSplit {
  free_credits_used: number;
  paid_credits_used: number;
  discount_applied: boolean;
  discount_amount: number;
  access_level: 'full' | 'free_only';
  sufficient: boolean;
  total_after_discount: number;
}

interface PaymentDetails {
  metadata: {
    filename: string;
    page_count: number;
    word_count: number | null;
    filesize: number | null;
    template: string;
  };
  cost_estimate: {
    base_credits: number;
    additional_pages: number;
    additional_credits: number;
    total_credits: number;
    total_dollars: number;
    breakdown: string;
  };
  credit_balance: number;
  free_credit_balance: number;
  first_purchase_discount_available: boolean;
  credit_split: CreditSplit;
  has_sufficient_credits: boolean;
  first_free_conversion_used: boolean;
}

const PreviewPage: React.FC = () => {
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'awaiting_payment' | 'needs_payment' | 'processing' | 'completed' | 'failed'>('processing');
  const [compilationFailed, setCompilationFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const [feedback, setFeedback] = useState<'positive' | 'negative' | null>(null);
  const [projectPaid, setProjectPaid] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [paidWithFreeUpload, setPaidWithFreeUpload] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const { id: paperId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAnonymous } = useAuth();

  // Debug mock overrides (dev/staging only, tree-shaken from production)
  const [mockAnonymous, setMockAnonymous] = useState<boolean | null>(null);
  const [mockPreset, setMockPreset] = useState('done_paid');
  const [mockFreeCredits, setMockFreeCredits] = useState(750);
  const [mockPaidCredits, setMockPaidCredits] = useState(0);
  const effectiveAnonymous = mockAnonymous !== null ? mockAnonymous : isAnonymous;
  const freeCredits = (import.meta.env.VITE_DEBUG_CONTROLS === 'true' && mockAnonymous !== null) ? mockFreeCredits : (paymentDetails?.free_credit_balance ?? 0);
  const isFirstFreeConversion = freeCredits >= (paymentDetails?.cost_estimate?.total_credits ?? Infinity) && !paymentDetails?.first_free_conversion_used;

  const isPaymentFlow = searchParams.get('payment_success') === 'true';
  const paymentStartTime = useRef<number | null>(null);
  const hasCalledProcess = useRef(false);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (paperId) {
      if (isPaymentFlow) {
        paymentStartTime.current = Date.now();
        hasCalledProcess.current = false;
        setStatus('awaiting_payment');
        setSearchParams({});
      }
      checkStatus();
    }

    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, [paperId]);

  const checkStatus = async () => {
    try {
      const project = await apiRequest<ProjectResponse>(`/api/latex/project/${paperId}`);
      const projectStatus = project.status;
      const paid = project.paid || false;
      const preview = project.is_preview || false;
      const projectCompilationFailed = project.compilation_failed || false;
      setFeedback(project.feedback || null);
      setProjectPaid(paid);
      setIsPreview(preview);
      setPaidWithFreeUpload(project.paid_with_free_upload || false);

      // State logging
      console.log(`[PreviewPage] status=${projectStatus} paid=${paid} preview=${preview} freeUpload=${project.paid_with_free_upload || false} compileFailed=${projectCompilationFailed} isAnonymous=${isAnonymous}`);

      const currentPath = window.location.pathname;
      const isViewingThisProject = currentPath === `/papers/${paperId}/view`;

      if (!isViewingThisProject) {
        return;
      }

      if (isPaymentFlow && !hasCalledProcess.current) {
        if (paid) {
          hasCalledProcess.current = true;
          setStatus('processing');
          try {
            await apiRequest('/api/latex/process', {
              method: 'POST',
              body: JSON.stringify({ project_id: paperId })
            });
            pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
          } catch (processError: any) {
            setErrorMessage(processError.message || 'Failed to start document processing');
            setShowErrorModal(true);
          }
          return;
        }

        if (paymentStartTime.current && Date.now() - paymentStartTime.current > PAYMENT_TIMEOUT) {
          setErrorMessage('Payment verification timed out. Please try again or contact us at contact@latext.ai.');
          setShowErrorModal(true);
          return;
        }

        setStatus('awaiting_payment');
        pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
        setInitialLoading(false);
        return;
      }

      if (projectStatus === 'uploaded' || projectStatus === 'validated') {
        if (preview || isAnonymous) {
          // Preview uploads are being processed — poll until ready
          // Fetch payment details early so the invoice card can render during processing
          if (projectStatus === 'validated' && !paymentDetails) {
            fetchPaymentDetails();
          }
          setStatus('processing');
          setLoading(false);
          pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
          return;
        }
        if (!paid) {
          // Validated unpaid project — show payment UI on this page
          await fetchPaymentDetails();
          setStatus('needs_payment');
          setLoading(false);
          return;
        }
        return;
      }

      if (projectStatus === 'converted') {
        setStatus('completed');
        setCompilationFailed(projectCompilationFailed);
        if (!projectCompilationFailed) {
          fetchPdf();
        } else {
          setLoading(false);
        }
        // Fetch payment details for unpaid projects or free-upload projects (need cost data for upgrade CTA)
        if (!paid || project.paid_with_free_upload) {
          fetchPaymentDetails();
        }
      } else if (projectStatus === 'failed') {
        setStatus('failed');
        setCompilationFailed(projectCompilationFailed);
        setError('Document processing failed');
        setLoading(false);
      } else {
        setStatus('processing');
        setCompilationFailed(false);
        if (!paymentDetails && (preview || isAnonymous)) {
          fetchPaymentDetails();
        }
        pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setError('Failed to check project status');
      setLoading(false);
    } finally {
      setInitialLoading(false);
    }
  };

  const fetchPaymentDetails = async () => {
    try {
      const details = await apiRequest<PaymentDetails>(`/api/latex/project/${paperId}/payment-details`);
      setPaymentDetails(details);
    } catch {
      // Payment details not available (already paid, etc.) — ignore
    }
  };

  const fetchPdf = async () => {
    try {
      const response = await apiFetch(`/api/latex/project/${paperId}/pdf`);

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } else {
        setError('Failed to load PDF');
      }
    } catch (error) {
      console.error('Error fetching PDF:', error);
      setError('Failed to load PDF');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleErrorModalClose = () => {
    setShowErrorModal(false);
  };

  const handleDownloadPdf = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/pdf`, 'document.pdf');
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadTex = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/tex`, 'document.tex');
    } catch (error) {
      console.error('Error downloading TeX:', error);
    }
  };

  const handleDownloadBib = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/bib`, 'document.bib');
    } catch (error) {
      console.error('Error downloading BibTeX:', error);
    }
  };

  const handleDownloadPackage = async () => {
    try {
      await downloadFile(`/api/latex/project/${paperId}/package`, 'latex_package.zip');
    } catch (error) {
      console.error('Error downloading package:', error);
    }
  };

  const handleProcessWithCredits = async () => {
    if (!paperId) return;
    setPaymentLoading(true);
    try {
      await apiRequest('/api/latex/process', {
        method: 'POST',
        body: JSON.stringify({ project_id: paperId, use_credits: true })
      });
      setProjectPaid(true);
      setIsPreview(false);
      setStatus('processing');
      pollTimeoutRef.current = setTimeout(checkStatus, FAST_POLL_INTERVAL);
    } catch (error: any) {
      if (error.status === 402) {
        navigate('/credits');
      } else {
        setErrorMessage(error.message || 'Failed to process document');
        setShowErrorModal(true);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleUnlockFullAccess = async () => {
    if (!paperId) return;
    setPaymentLoading(true);
    try {
      await apiRequest(`/api/latex/project/${paperId}/unlock`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      setProjectPaid(true);
      setPaidWithFreeUpload(false);
      setPaymentDetails(null);
    } catch (error: any) {
      if (error.status === 402) {
        navigate(`/credits?amount=${paymentDetails?.cost_estimate?.total_credits ?? 0}&project_id=${paperId}&return_to=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setErrorMessage(error.message || 'Failed to unlock full access');
        setShowErrorModal(true);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleFeedback = async (value: 'positive' | 'negative') => {
    if (feedback !== null) return;
    try {
      await apiRequest(`/api/latex/project/${paperId}/feedback`, {
        method: 'POST',
        body: JSON.stringify({ feedback: value }),
      });
      setFeedback(value);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  // Show invoice card for unpaid projects (needs_payment or completed-but-unpaid)
  const showInvoiceCard = status === 'needs_payment' ||
    (!projectPaid && status === 'completed' && !compilationFailed);

  const isUpgrade = status === 'completed' && (isPreview || paidWithFreeUpload);

  // Auto-set slider defaults when preset changes
  const handlePresetChange = (preset: string) => {
    setMockPreset(preset);
    const defaults: Record<string, [number, number]> = {
      proc_anon: [750, 0], done_anon: [750, 0],
      proc_free: [750, 0], done_free: [750, 0],
      proc_free_low: [300, 0], done_free_low: [300, 0],
      proc_credits: [150, 500], done_credits: [150, 500],
      proc_low: [50, 300], done_low: [50, 300],
      done_free_claimed: [150, 0], done_free_claimed_topup: [150, 500], done_free_claimed_cf: [150, 500],
      proc_paid: [0, 0], done_paid: [0, 0],
      comp_failed: [0, 0], failed: [0, 0],
    };
    const [free, paid] = defaults[preset] || [0, 0];
    setMockFreeCredits(free);
    setMockPaidCredits(paid);
  };

  // Debug mock presets — every valid UI state as a flat list
  const MOCK_META: PaymentDetails['metadata'] = {
    filename: 'your_thesis.docx', page_count: 17, word_count: 12400, filesize: 2048000, template: 'IEEE Template'
  };
  const MOCK_COST: PaymentDetails['cost_estimate'] = {
    base_credits: 499, additional_pages: 2, additional_credits: 100, total_credits: 599, total_dollars: 5.99, breakdown: ''
  };

  // Local credit split calculation for debug mock only
  const calculate_credit_split_local = (totalCost: number, freeBalance: number, paidBalance: number, discountAvailable: boolean): CreditSplit => {
    const freeUsed = Math.min(totalCost, freeBalance);
    let remaining = totalCost - freeUsed;
    let discountApplied = false;
    let discountAmount = 0;
    if (discountAvailable && remaining > 0) {
      discountAmount = remaining - Math.ceil(remaining / 2);
      remaining = Math.ceil(remaining / 2);
      discountApplied = true;
    }
    const paidUsed = Math.min(remaining, paidBalance);
    const sufficient = (freeUsed + paidUsed + discountAmount) >= totalCost;
    return {
      free_credits_used: freeUsed, paid_credits_used: paidUsed,
      discount_applied: discountApplied, discount_amount: discountAmount,
      access_level: paidUsed > 0 ? 'full' : 'free_only', sufficient,
      total_after_discount: totalCost - discountAmount,
    };
  };

  const applyMock = () => {
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    // Shared defaults — each preset overrides what it needs
    setLoading(false);
    setError(null);
    setCompilationFailed(false);
    setPdfUrl(null);
    setMockAnonymous(false);
    setProjectPaid(false);
    setIsPreview(false);
    setPaidWithFreeUpload(false);

    // Derive payment details from sliders
    const mockSplit = calculate_credit_split_local(MOCK_COST.total_credits, mockFreeCredits, mockPaidCredits, true);
    const pd: PaymentDetails = {
      metadata: MOCK_META, cost_estimate: MOCK_COST,
      credit_balance: mockPaidCredits,
      free_credit_balance: mockFreeCredits,
      first_purchase_discount_available: true,
      credit_split: mockSplit,
      has_sufficient_credits: mockSplit.sufficient,
      first_free_conversion_used: false,
    };

    switch (mockPreset) {
      case 'proc_paid':
        setStatus('processing');
        return;
      case 'proc_anon':
        setStatus('processing');
        setMockAnonymous(true);
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'proc_free':
      case 'proc_free_low':
        setStatus('processing');
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'proc_credits':
      case 'proc_low':
        setStatus('processing');
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'failed':
        setStatus('failed');
        setError('Document processing failed');
        return;
      case 'comp_failed':
        setStatus('completed');
        setCompilationFailed(true);
        setProjectPaid(true);
        return;
      case 'done_anon':
        setStatus('completed');
        setMockAnonymous(true);
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'done_free':
      case 'done_free_low':
        setStatus('completed');
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'done_credits':
      case 'done_low':
        setStatus('completed');
        setIsPreview(true);
        setPaymentDetails(pd);
        return;
      case 'done_free_claimed':
      case 'done_free_claimed_topup':
        setStatus('completed');
        setProjectPaid(true);
        setPaidWithFreeUpload(true);
        setPaymentDetails(pd);
        return;
      case 'done_free_claimed_cf':
        setStatus('completed');
        setCompilationFailed(true);
        setProjectPaid(true);
        setPaidWithFreeUpload(true);
        return;
      case 'done_paid':
        setStatus('completed');
        setProjectPaid(true);
        return;
    }
  };

  const resetMock = () => {
    setMockAnonymous(null);
    checkStatus();
  };

  const renderInvoiceCard = () => {
    const pd = paymentDetails;

    // Loading state
    if (!pd) {
      return (
        <div className="invoice-card">
          <div className="invoice-loading">
            <div className="spinner" />
          </div>
        </div>
      );
    }

    const { metadata, cost_estimate, credit_balance, has_sufficient_credits, credit_split } = pd;
    const freeBalance = pd.free_credit_balance ?? 0;

    return (
      <div className="invoice-card">
        {/* Document metadata bar */}
        <div className="invoice-meta">
          <strong>{metadata.filename}</strong>
          {' · '}{metadata.template}
          {' · '}{metadata.page_count} pages
          {metadata.word_count ? <>{' · '}{metadata.word_count.toLocaleString()} words</> : null}
        </div>

        <div className="invoice-body">
          {/* Heading */}
          <h3 className="invoice-heading">
            {effectiveAnonymous
              ? 'Sign Up & Unlock for Free!'
              : isFirstFreeConversion
                ? 'Unlock Your Document for Free'
                : isUpgrade
                  ? 'Upgrade to Full Access'
                  : 'Use Credits to Unlock'}
          </h3>

          {/* Features checklist — free signup sell vs authenticated free vs paid features */}
          {effectiveAnonymous ? (
            <ul className="invoice-features">
              <li>Professionally compiled PDF document</li>
              <li>750 free credits — one full conversion</li>
              <li>5 free document previews</li>
            </ul>
          ) : isFirstFreeConversion ? (
            <ul className="invoice-features">
              <li>Professionally compiled PDF document</li>
              <li>Your free credits cover this conversion</li>
              <li>Pay with credits later to unlock source files</li>
            </ul>
          ) : (
            <ul className="invoice-features">
              <li>Professionally compiled PDF document</li>
              <li>Editable LaTeX source file (.tex)</li>
              <li>Bibliography file (.bib)</li>
              <li>
                Complete compilation package
                <span className="feature-subtitle">Source files, extracted images, PDF, and all build files</span>
              </li>
            </ul>
          )}

          {/* State A: Anonymous user — sign-up CTA */}
          {effectiveAnonymous ? (
            <>
              <p className="invoice-message">
                Sign up to see the full PDF for free.
              </p>
              <div className="invoice-cta">
                <button
                  className="btn btn--primary btn--lg btn--pill"
                  onClick={() => navigate('/signup')}
                >
                  Sign Up Free
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Cost breakdown */}
              <div className="invoice-breakdown">
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Base conversion (up to 15 pages)</span>
                    <span className="detail-value">+{cost_estimate.base_credits} credits</span>
                  </div>
                  {cost_estimate.additional_pages > 0 && (
                    <div className="detail-item">
                      <span className="detail-label">Additional pages ({cost_estimate.additional_pages} × 50)</span>
                      <span className="detail-value">+{cost_estimate.additional_credits} credits</span>
                    </div>
                  )}
                  {isFirstFreeConversion && credit_split?.free_credits_used > 0 && (
                    <div className="detail-item invoice-free-credits">
                      <span className="detail-label">Free credits</span>
                      <span className="detail-value">−{credit_split.free_credits_used} credits</span>
                    </div>
                  )}
                  {credit_split?.discount_applied && (
                    <div className="detail-item invoice-free-credits">
                      <span className="detail-label">First-purchase discount (50%)</span>
                      <span className="detail-value">−{credit_split.discount_amount} credits</span>
                    </div>
                  )}
                  {(() => {
                    const effectiveCost = credit_split
                      ? cost_estimate.total_credits - (isFirstFreeConversion ? (credit_split.free_credits_used ?? 0) : 0) - (credit_split.discount_amount ?? 0)
                      : cost_estimate.total_credits;
                    const hasDiscount = (isFirstFreeConversion && (credit_split?.free_credits_used ?? 0) > 0) || credit_split?.discount_applied;
                    const remainingFree = freeBalance - (credit_split?.free_credits_used ?? 0);
                    const remainingPaid = credit_balance - (credit_split?.paid_credits_used ?? 0);
                    const remainingTotal = remainingPaid + remainingFree;
                    const covered = credit_split?.sufficient ?? false;

                    return (
                      <>
                        <div className="detail-item invoice-total">
                          <span className="detail-label">Total cost</span>
                          <span className="detail-value">
                            {hasDiscount && effectiveCost < cost_estimate.total_credits ? (
                              <>
                                <em className="invoice-highlight invoice-total-free">{effectiveCost} credits</em>
                                {effectiveCost > 0 && <> <span className="invoice-total-dollars">(${(effectiveCost / 100).toFixed(2)})</span></>}
                                <br /><span className="invoice-strikethrough">{cost_estimate.total_credits} credits</span>
                              </>
                            ) : (
                              <>
                                {cost_estimate.total_credits} credits
                                <br /><span className="invoice-total-dollars">${cost_estimate.total_dollars.toFixed(2)}</span>
                              </>
                            )}
                          </span>
                        </div>
                        {(credit_balance > 0 || freeBalance > 0) && (
                          <div className="detail-item invoice-balance">
                            <span className="detail-label">Your balance</span>
                            <span className="detail-value">
                              {isFirstFreeConversion ? (
                                <>{credit_balance.toLocaleString()} credits</>
                              ) : (
                                <>{(credit_balance + freeBalance).toLocaleString()} credits</>
                              )}
                            </span>
                          </div>
                        )}
                        <div className="detail-item invoice-balance">
                          <span className="detail-label">Your balance after</span>
                          <span className={`detail-value ${covered ? 'text-success' : 'text-error'}`}>
                            {!covered ? (
                              <span className="text-error">Need more credits</span>
                            ) : isFirstFreeConversion ? (
                              <>
                                {remainingPaid > 0 && <>{remainingPaid.toLocaleString()} credits</>}
                                {remainingPaid > 0 && remainingFree > 0 && ' + '}
                                {remainingFree > 0 && <span className="invoice-highlight invoice-highlight--blue">+{remainingFree} free credits</span>}
                                {remainingPaid === 0 && remainingFree === 0 && '0 credits'}
                              </>
                            ) : (
                              <>{remainingTotal.toLocaleString()} credits</>
                            )}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* State B: Free credits cover entire conversion */}
              {isFirstFreeConversion && credit_split?.sufficient && credit_split.paid_credits_used === 0 && (
                <div className="invoice-promo">
                  <div className="notice notice--info">
                    <span className="notice-icon" role="img" aria-label="gift">&#127873;</span>
                    <div className="notice-content">
                      <strong>Your free credits cover this entire conversion!</strong>
                      <p>No payment required.</p>
                    </div>
                  </div>
                </div>
              )}

              {!has_sufficient_credits && (
                <p className="invoice-shortfall"><strong><em>Need more credits</em></strong></p>
              )}

              {/* CTA buttons */}
              <div className="invoice-cta">
                {has_sufficient_credits ? (
                  <button
                    className="btn btn--success btn--lg btn--pill"
                    onClick={handleProcessWithCredits}
                    disabled={paymentLoading}
                  >
                    {paymentLoading ? 'Processing...' : isFirstFreeConversion
                      ? 'Use Free Credits'
                      : `Pay ${cost_estimate.total_credits} Credits`}
                  </button>
                ) : (
                  <button
                    className="btn btn--accent btn--lg btn--pill"
                    onClick={() => navigate(`/credits?amount=${cost_estimate.total_credits}&project_name=${encodeURIComponent(metadata.filename)}&project_id=${paperId}&return_to=${encodeURIComponent(window.location.pathname)}`)}
                  >
                    Top Up Credits
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (initialLoading) {
    return <LoadingScreen />;
  }

  return (
    <div className="preview-page">
      <Banner />

      <section className="preview-main-section">
        <div className="preview-container">
          {/* Awaiting Payment Confirmation */}
          {status === 'awaiting_payment' ? (
            <div className="processing-state">
              <div className="processing-circle">
                <div className="circle-outer">
                  <div className="circle-inner">
                    <svg
                      className="progress-ring spinning"
                      width="320"
                      height="320"
                      viewBox="0 0 320 320"
                    >
                      <circle
                        className="progress-ring-bg"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="2"
                        fill="none"
                      />
                      <circle
                        className="progress-ring-fill"
                        cx="160"
                        cy="160"
                        r="150"
                        strokeWidth="3"
                        fill="none"
                        strokeDasharray="400 942"
                        transform="rotate(-90 160 160)"
                      />
                    </svg>
                    <div className="processing-text">
                      <h2 className="processing-title">Confirming Payment...</h2>
                      <p className="processing-subtitle">Please wait while we verify your payment.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : status === 'processing' ? (
            <>
              <div className="processing-state">
                <div className="processing-circle">
                  <div className="circle-outer">
                    <div className="circle-inner">
                      <svg
                        className="progress-ring spinning"
                        width="320"
                        height="320"
                        viewBox="0 0 320 320"
                      >
                        <circle
                          className="progress-ring-bg"
                          cx="160"
                          cy="160"
                          r="150"
                          strokeWidth="2"
                          fill="none"
                        />
                        <circle
                          className="progress-ring-fill"
                          cx="160"
                          cy="160"
                          r="150"
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray="400 942"
                          transform="rotate(-90 160 160)"
                        />
                      </svg>
                      <div className="processing-text">
                        <h2 className="processing-title">Processing Your Document...</h2>
                        <p className="processing-subtitle">Your document is being converted to LaTeX format and compiled. This may take a few minutes.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Invoice card shown during preview processing (only for anonymous sign-up CTA) */}
              {effectiveAnonymous && renderInvoiceCard()}
            </>
          ) : status === 'needs_payment' ? (
            renderInvoiceCard()
          ) : status === 'failed' ? (
            <div className="processing-state">
              <div className="error-state">
                <h2 className="processing-title">Processing Failed</h2>
                <p className="processing-subtitle">{error || 'An error occurred while processing your document.'}</p>
                <p className="processing-subtitle" style={{ marginTop: '16px' }}>
                  Please contact us at <a href="mailto:contact@latext.ai" style={{ color: '#2196f3', fontWeight: 600 }}>contact@latext.ai</a>
                </p>
              </div>
            </div>
          ) : status === 'completed' && !compilationFailed ? (
            <div className="preview-document-wrapper">
              {loading ? (
                <p className="loading-text">Loading PDF...</p>
              ) : pdfUrl ? (
                <>
                  {isPreview && !projectPaid && (
                    <div style={{
                      background: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '8px',
                      padding: '12px 16px',
                      marginBottom: '16px',
                      textAlign: 'center',
                      fontSize: '14px'
                    }}>
                      This is a 3-page preview. {effectiveAnonymous ? 'Sign up to see the full document for free!' : isFirstFreeConversion ? 'Use your free credits below to unlock the full document.' : 'Pay to unlock the full document and source files.'}
                    </div>
                  )}
                  <iframe
                    src={pdfUrl}
                    width="100%"
                    height="800px"
                    style={{ border: 'none' }}
                    title="PDF Preview"
                  />
                </>
              ) : (
                <p className="error-text">Failed to load PDF</p>
              )}
            </div>
          ) : status === 'completed' && compilationFailed ? (
            <div className="compilation-failed-banner">
              <div className="compilation-failed-icon">⚠</div>
              <h2 className="compilation-failed-title">PDF Compilation Issue</h2>
              <p className="compilation-failed-text">
                Your document was successfully converted to LaTeX, but we encountered an issue
                during PDF compilation. We apologise for the inconvenience — an internal report
                has been filed and our team will investigate.
              </p>
              {effectiveAnonymous ? (
                <>
                  <p className="compilation-failed-text">
                    <a href="/signup" className="compilation-failed-link">Create a free account</a>{' '}
                    to access your LaTeX source and bibliography files, and we'll notify you
                    once the PDF is ready.
                  </p>
                  <div className="compilation-failed-cta">
                    <a href="/signup" className="btn btn--primary btn--pill">Sign Up — It's Free</a>
                  </div>
                </>
              ) : (
                <p className="compilation-failed-text compilation-failed-note">
                  Your LaTeX source (.tex) and bibliography (.bib) files are
                  available for download below.
                </p>
              )}
            </div>
          ) : null}

          {/* Invoice Card for unpaid completed projects */}
          {showInvoiceCard && status === 'completed' && renderInvoiceCard()}

          {/* Download Section */}
          {status === 'completed' && (
            <div className={`dl-section${!projectPaid ? ' dl-section--locked' : ''}`}>
              {/* Context messaging block — only shown for paid/free-claimed projects */}
              {projectPaid && <div className="dl-message">
                {compilationFailed && paidWithFreeUpload ? (
                  <>
                    <h3 className="dl-message-heading">We've unlocked your full package</h3>
                    <p className="dl-message-text">
                      Unfortunately, PDF compilation encountered an error during processing.
                      Since you used your free upload on this document, we've unlocked full access
                      to all source files as a courtesy — no additional cost.
                    </p>
                    <p className="dl-message-text">
                      You can compile locally using the files below. Need help? Contact us at{' '}
                      <a href="mailto:contact@latext.ai" className="dl-message-link">contact@latext.ai</a>.
                    </p>
                    <ul className="dl-message-features">
                      <li>Full Package (.zip) — LaTeX source, bibliography, style files, and extracted images</li>
                      <li>LaTeX Source (.tex) — Editable source file for local compilation</li>
                      <li>Bibliography (.bib) — Your references in BibTeX format</li>
                    </ul>
                  </>
                ) : compilationFailed ? (
                  <>
                    <h3 className="dl-message-heading">PDF compilation encountered an error</h3>
                    <p className="dl-message-text">
                      Your document was successfully converted to LaTeX, but the PDF compilation
                      step ran into an issue. Don't worry — all your source files are still available.
                    </p>
                    <p className="dl-message-text">
                      You can compile locally using the files below. Need help? Contact us at{' '}
                      <a href="mailto:contact@latext.ai" className="dl-message-link">contact@latext.ai</a>.
                    </p>
                    <ul className="dl-message-features">
                      <li>Full Package (.zip) — LaTeX source, bibliography, style files, and extracted images</li>
                      <li>LaTeX Source (.tex) — Editable source file for local compilation</li>
                      <li>Bibliography (.bib) — Your references in BibTeX format</li>
                    </ul>
                  </>
                ) : paidWithFreeUpload ? (() => {
                  const split = paymentDetails?.credit_split;
                  const upgradeCost = split?.paid_credits_used ?? 0;
                  const hasDiscount = split?.discount_applied ?? (paymentDetails?.first_purchase_discount_available ?? false);
                  const canUnlock = split?.sufficient ?? false;

                  const totalCredits = paymentDetails?.cost_estimate?.total_credits ?? 0;
                  const freeUsed = split?.free_credits_used ?? 0;
                  const discountAmt = split?.discount_amount ?? 0;
                  const paidNeeded = totalCredits - freeUsed - discountAmt;
                  const paidBalance = paymentDetails?.credit_balance ?? 0;
                  const deficit = Math.max(0, paidNeeded - paidBalance);

                  return canUnlock ? (
                    <>
                      <h3 className="dl-message-heading">Ready to unlock?</h3>
                      <p className="dl-message-text">
                        You have enough credits to unlock the full package for this document.
                        This includes editable LaTeX source (.tex), bibliography (.bib),
                        journal style files, and the complete compilation package.
                      </p>
                      {hasDiscount && (
                        <p className="dl-message-text">
                          With your <strong>50% first-time discount</strong>, the unlock price
                          is just <strong>{upgradeCost} credits</strong>
                          {freeCredits > 0 && <> (after applying your remaining free credits)</>}.
                        </p>
                      )}
                      <ul className="dl-message-features">
                        <li>Editable LaTeX source file (.tex)</li>
                        <li>Bibliography file (.bib)</li>
                        <li>Journal style files (.bst, .sty, .cls)</li>
                        <li>Extracted images and full compilation package</li>
                      </ul>
                      <div className="dl-message-actions">
                        <button
                          className="btn btn--success btn--lg btn--pill"
                          onClick={handleUnlockFullAccess}
                          disabled={paymentLoading}
                        >
                          {paymentLoading ? 'Unlocking...' : `Unlock Full Access — ${upgradeCost} Credits`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <h3 className="dl-message-heading">Enjoying your results?</h3>
                      <p className="dl-message-text">
                        Thank you for trying LaTexT! Your PDF is ready to download below.
                        To unlock the full package — editable LaTeX source, bibliography,
                        and all compilation files — top up your credits.
                      </p>

                      <div className="invoice-breakdown" style={{ margin: '16px 0' }}>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">Full access cost</span>
                            <span className="detail-value">{totalCredits} credits</span>
                          </div>
                          {freeUsed > 0 && (
                            <div className="detail-item invoice-free-credits">
                              <span className="detail-label">Free credits applied</span>
                              <span className="detail-value">−{freeUsed} credits</span>
                            </div>
                          )}
                          {discountAmt > 0 && (
                            <div className="detail-item invoice-free-credits">
                              <span className="detail-label">First-purchase discount (50%)</span>
                              <span className="detail-value">−{discountAmt} credits</span>
                            </div>
                          )}
                          {paidBalance > 0 && (
                            <div className="detail-item">
                              <span className="detail-label">Your balance</span>
                              <span className="detail-value">−{Math.min(paidBalance, paidNeeded)} credits</span>
                            </div>
                          )}
                          <div className="detail-item invoice-total">
                            <span className="detail-label">Credits needed</span>
                            <span className="detail-value"><strong>{deficit} credits</strong> (${(deficit / 100).toFixed(2)})</span>
                          </div>
                        </div>
                      </div>

                      {hasDiscount && (
                        <p className="dl-message-text">
                          As a first-time buyer, you'll receive a <strong>50% discount</strong> on your paid credits.
                        </p>
                      )}
                      <ul className="dl-message-features">
                        <li>Editable LaTeX source file (.tex)</li>
                        <li>Bibliography file (.bib)</li>
                        <li>Journal style files (.bst, .sty, .cls)</li>
                        <li>Extracted images and full compilation package</li>
                      </ul>
                      <div className="dl-message-actions">
                        <button
                          className="btn btn--accent btn--lg btn--pill"
                          onClick={() => navigate(`/credits?amount=${deficit}&project_id=${paperId}&return_to=${encodeURIComponent(window.location.pathname)}`)}
                        >
                          Top Up {deficit} Credits (${(deficit / 100).toFixed(2)})
                        </button>
                      </div>
                    </>
                  );
                })() : (
                  <>
                    <h3 className="dl-message-heading">Your document is ready</h3>
                    <p className="dl-message-text">
                      Your conversion is complete! Here's what's included in your downloads:
                    </p>
                    <ul className="dl-message-features">
                      <li>Full Package (.zip) — Everything in one download: PDF, LaTeX source, bibliography, style files, and extracted images.</li>
                      <li>PDF Document — Your professionally formatted paper, ready to submit.</li>
                      <li>LaTeX Source (.tex) — Editable source file for further customization.</li>
                      <li>Bibliography (.bib) — Your references in BibTeX format.</li>
                    </ul>
                  </>
                )}
              </div>}

              {/* Full Package hero card */}
              <div className={`dl-hero${paidWithFreeUpload && !compilationFailed ? ' dl-card--locked' : ''}`}>
                <img className="dl-hero-icon" src="/zip.png" alt="ZIP" />
                <div className="dl-hero-content">
                  <strong className="dl-hero-title">Full Package (.zip)</strong>
                  <p className="dl-hero-subtitle">Includes PDF, LaTeX source, and all assets.</p>
                  <button
                    className="dl-hero-btn"
                    onClick={handleDownloadPackage}
                    disabled={paidWithFreeUpload && !compilationFailed}
                  >
                    Download Full Package
                  </button>
                </div>
              </div>

              {/* Individual file cards */}
              <div className="dl-grid">
                <div className={`dl-card${compilationFailed ? ' dl-card--locked' : ''}`}>
                  <img className="dl-card-icon" src="/pdf.png" alt="PDF" height="54" />
                  <strong className="dl-card-title">PDF Document (.pdf)</strong>
                  <button className="dl-card-btn" onClick={handleDownloadPdf} disabled={compilationFailed}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download
                  </button>
                </div>

                <div className={`dl-card${paidWithFreeUpload && !compilationFailed ? ' dl-card--locked' : ''}`}>
                  <img className="dl-card-icon" src="/tex.png" alt="TEX" height="54" />
                  <strong className="dl-card-title">LaTeX Source (.tex)</strong>
                  <button className="dl-card-btn" onClick={handleDownloadTex} disabled={paidWithFreeUpload && !compilationFailed}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download
                  </button>
                </div>

                <div className={`dl-card${paidWithFreeUpload && !compilationFailed ? ' dl-card--locked' : ''}`}>
                  <img className="dl-card-icon" src="/bibtex.png" alt="BibTeX" height="54" />
                  <strong className="dl-card-title">Bibliography (.bib)</strong>
                  <button className="dl-card-btn" onClick={handleDownloadBib} disabled={paidWithFreeUpload && !compilationFailed}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M8 2v8m0 0l-3-3m3 3l3-3M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Feedback Section - Only show when completed and paid */}
          {status === 'completed' && projectPaid && (
            <div className="content-section" style={{ marginTop: '40px' }}>
              <h3 className="section-heading">
                {feedback ? 'Thanks for your feedback!' : 'How was the output quality?'}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <button
                  onClick={() => handleFeedback('positive')}
                  disabled={feedback !== null}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: feedback === 'positive' ? '3px solid #4caf50' : '2px solid #e0e0e0',
                    background: feedback === 'positive' ? '#e8f5e9' : 'white',
                    cursor: feedback !== null ? 'default' : 'pointer',
                    opacity: feedback !== null && feedback !== 'positive' ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Good"
                >
                  <img src="/green-thumbs-up-11246.svg" alt="Thumbs up" width="28" height="28" />
                </button>
                <button
                  onClick={() => handleFeedback('negative')}
                  disabled={feedback !== null}
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    border: feedback === 'negative' ? '3px solid #f44336' : '2px solid #e0e0e0',
                    background: feedback === 'negative' ? '#ffebee' : 'white',
                    cursor: feedback !== null ? 'default' : 'pointer',
                    opacity: feedback !== null && feedback !== 'negative' ? 0.4 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Bad"
                >
                  <img src="/thumbs-down-14922.svg" alt="Thumbs down" width="28" height="28" />
                </button>
              </div>
            </div>
          )}

          {/* Debug Controls — dev/staging only, tree-shaken from production */}
          {import.meta.env.VITE_DEBUG_CONTROLS === 'true' && (
            <div className="content-section" style={{ borderTop: '2px solid #e74c3c', marginTop: '2rem', paddingTop: '1rem' }}>
              <h3 className="section-heading" style={{ color: '#e74c3c' }}>Debug Controls</h3>
              <div style={{ marginBottom: '16px' }}>
                <select className="form-select" value={mockPreset} onChange={e => handlePresetChange(e.target.value)}>
                  <optgroup label="Processing">
                    <option value="proc_anon">Processing — Anonymous Preview</option>
                    <option value="proc_free">Processing — Signed Up, Free Credits</option>
                    <option value="proc_free_low">Processing — Signed Up, Low Free Credits</option>
                    <option value="proc_credits">Processing — Has Paid Credits</option>
                    <option value="proc_low">Processing — Low Paid Credits</option>
                    <option value="proc_paid">Processing — Paid</option>
                  </optgroup>
                  <optgroup label="Completed (PDF visible)">
                    <option value="done_anon">Completed — Anonymous Preview</option>
                    <option value="done_free">Completed — Signed Up, Free Credits</option>
                    <option value="done_free_low">Completed — Signed Up, Low Free Credits</option>
                    <option value="done_credits">Completed — Has Paid Credits (Upgrade)</option>
                    <option value="done_low">Completed — Low Paid Credits (Upgrade)</option>
                    <option value="done_free_claimed">Completed — Free Claimed (PDF only)</option>
                    <option value="done_free_claimed_topup">Completed — Free Claimed + After Credit Topup</option>
                    <option value="done_free_claimed_cf">Completed — Free Claimed + Compilation Failed</option>
                    <option value="done_paid">Completed — Paid (Downloads)</option>
                    <option value="comp_failed">Completed — Compilation Failed</option>
                  </optgroup>
                  <optgroup label="Error">
                    <option value="failed">Processing Failed</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#666' }}>Free credits: {mockFreeCredits}</label>
                  <input type="range" min={0} max={750} step={50} value={mockFreeCredits} onChange={e => setMockFreeCredits(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '13px', color: '#666' }}>Paid credits: {mockPaidCredits}</label>
                  <input type="range" min={0} max={2000} step={50} value={mockPaidCredits} onChange={e => setMockPaidCredits(Number(e.target.value))} style={{ width: '100%' }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn--primary btn--sm" onClick={applyMock}>Apply</button>
                <button className="btn btn--secondary btn--sm" onClick={resetMock}>Reset</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <Footer />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={handleErrorModalClose}
        errorMessage={errorMessage}
      />
    </div>
  );
};

export default PreviewPage;
