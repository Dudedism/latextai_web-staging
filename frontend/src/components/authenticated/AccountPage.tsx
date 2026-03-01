import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationModal } from '../common/VerificationModal';
import { ConsentModal } from '../common/ConsentModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { PasswordResetRequestModal } from '../common/PasswordResetRequestModal';
import { StatusModal } from '../common/StatusModal';
import { apiRequest } from '../../utils/api';

interface SubscriptionStatus {
  active: boolean;
  tier: string;
  tier_name: string;
  credits_per_month: number;
  status: string;
  current_period_end: string | null;
}

interface AccountPageProps {
  userEmail?: string;
}

const AccountPage: React.FC<AccountPageProps> = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated, isVerified, isAnonymous, logout, refreshUser } = useAuth();
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSubscriptionSuccess, setShowSubscriptionSuccess] = useState(false);
  const [successTierName, setSuccessTierName] = useState<string | null>(null);

  const [dataConsent, setDataConsent] = useState<boolean | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  // Use user data from context
  const userEmail = user?.email || 'user@example.com';

  // Refresh user profile and fetch consent on mount
  useEffect(() => {
    const fetchAccountData = async () => {
      try {
        setLoading(true);
        await refreshUser();
        const [consentData, subData] = await Promise.all([
          apiRequest<{ consent: boolean | null }>('/api/user/data-consent', { method: 'GET' }),
          apiRequest<SubscriptionStatus>('/api/subscription/status', { method: 'GET' }).catch(() => null),
        ]);
        setDataConsent(consentData.consent);
        if (subData) setSubscription(subData);
      } catch (error) {
        console.error('Error fetching account data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchAccountData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (searchParams.get('subscription_success') === 'true') {
      const tier = searchParams.get('tier');
      if (tier) setSuccessTierName(tier.charAt(0).toUpperCase() + tier.slice(1));
      setShowSubscriptionSuccess(true);
    }
  }, [searchParams]);

  console.log('👤 [ACCOUNT PAGE] Render state:', {
    isAuthenticated,
    userEmail,
    isVerified,
    dataConsent
  });

  const handleSignOut = async () => {
    console.log('Sign out clicked');
    await logout();
    navigate('/');
  };

  const handleVerifyEmail = () => {
    setShowVerificationModal(true);
  };

  const handleConsentToggle = () => {
    setShowConsentModal(true);
  };

  const handleConsentResult = async (_consented: boolean) => {
    // Refresh consent status after modal closes
    try {
      const data = await apiRequest<{ consent: boolean | null }>('/api/user/data-consent', {
        method: 'GET',
      });
      setDataConsent(data.consent);
    } catch (error) {
      console.error('Error refreshing consent status:', error);
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteAccount = async () => {
    setShowDeleteModal(false);
    setLoading(true);

    try {
      console.log('🗑️  [ACCOUNT] Deleting account...');
      await apiRequest('/api/deleteAccount', {
        method: 'POST',
        body: JSON.stringify({})
      });

      console.log('✅ [ACCOUNT] Account deleted successfully');

      // Clear auth state and redirect to home page
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');

      // Navigate to home page (will cause AuthContext to update)
      window.location.href = '/';
    } catch (error: any) {
      console.error('❌ [ACCOUNT] Error deleting account:', error);
      alert(`Failed to delete account: ${error.message || 'Unknown error'}`);
      setLoading(false);
    }
  };

  const handlePasswordResetClick = () => {
    // Open the modal for confirmation
    setShowPasswordResetModal(true);
  };

  const handlePasswordResetConfirm = async () => {
    console.log('🔑 [ACCOUNT] Requesting password reset');

    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/request-password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: userEmail }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('❌ [ACCOUNT] Error requesting password reset:', data.error);
      throw new Error(data.error || 'Failed to send password reset email');
    }

    console.log('✅ [ACCOUNT] Password reset email sent');
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const data = await apiRequest<{ portal_url: string }>('/api/subscription/create-portal', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      window.location.href = data.portal_url;
    } catch (err: any) {
      alert(err.message || 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (isAnonymous) {
    return (
      <div className="page">
        <Banner />
        <section className="main-section main-section--centered">
          <div className="container container--sm">
            <h1 className="section-title">Guest Session</h1>
            <p style={{ marginBottom: '24px', color: '#666' }}>
              You are browsing as a guest. Sign up to access your full account, save your projects, and unlock all features.
            </p>

            <div className="mb-8">
              <div className="mb-6">
                <label className="form-label form-label--light">Data Consent</label>
                <div className="flex items-center gap-4">
                  {dataConsent ? (
                    <>
                      <span className="badge badge--success">✓ Consent Granted</span>
                      <button className="btn btn--danger btn--sm btn--pill" onClick={handleConsentToggle}>
                        Revoke Consent
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="badge badge--error">Consent Not Granted</span>
                      <button className="btn btn--primary btn--sm btn--pill" onClick={handleConsentToggle}>
                        Grant Consent
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4" style={{ alignItems: 'center' }}>
              <button className="btn btn--primary btn--lg btn--pill" onClick={() => navigate('/signup')}>
                Sign Up
              </button>
            </div>
          </div>
        </section>

        <ConsentModal
          isOpen={showConsentModal}
          onClose={() => setShowConsentModal(false)}
          onConsent={handleConsentResult}
        />

        <Footer />
      </div>
    );
  }

  return (
    <div className="page">
      <Banner />

      <section className="main-section main-section--centered">
        <div className="container container--sm">
          <h1 className="section-title">Your Account</h1>

          <div className="mb-8">
            <div className="mb-6">
              <label className="form-label form-label--light">Email</label>
              <div>{userEmail}</div>
            </div>

            <div className="mb-6">
              <label className="form-label form-label--light">Email Verification Status</label>
              <div className="flex items-center gap-4">
                {isVerified ? (
                  <span className="badge badge--success">✓ Verified</span>
                ) : (
                  <>
                    <span className="badge badge--error">Not Verified</span>
                    <button className="btn btn--primary btn--sm btn--pill" onClick={handleVerifyEmail}>
                      Send Verification Email
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label form-label--light">Subscription</label>
              <div className="flex items-center gap-4">
                {subscription?.active ? (
                  <>
                    <span className="badge badge--success">
                      {subscription.tier_name} Plan
                    </span>
                    <span style={{ fontSize: '14px', color: '#666' }}>
                      {subscription.credits_per_month.toLocaleString()} credits/month
                      {subscription.current_period_end && (
                        <> &middot; Renews {new Date(subscription.current_period_end).toLocaleDateString()}</>
                      )}
                    </span>
                    <button
                      className="btn btn--primary btn--sm btn--pill"
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                    >
                      {portalLoading ? 'Opening...' : 'Manage'}
                    </button>
                  </>
                ) : (
                  <>
                    <span className="badge" style={{ background: '#f5f5f5', color: '#666' }}>No active plan</span>
                    <button className="btn btn--primary btn--sm btn--pill" onClick={() => navigate('/pricing')}>
                      View Plans
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label form-label--light">Data Consent</label>
              <div className="flex items-center gap-4">
                {dataConsent ? (
                  <>
                    <span className="badge badge--success">✓ Consent Granted</span>
                    <button className="btn btn--danger btn--sm btn--pill" onClick={handleConsentToggle}>
                      Revoke Consent
                    </button>
                  </>
                ) : (
                  <>
                    <span className="badge badge--error">Consent Not Granted</span>
                    <button className="btn btn--primary btn--sm btn--pill" onClick={handleConsentToggle}>
                      Grant Consent
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label form-label--light">Password</label>
              <div className="flex items-center gap-4">
                {isVerified ? (
                  <button className="btn btn--primary btn--sm btn--pill" onClick={handlePasswordResetClick}>
                    Reset Password
                  </button>
                ) : (
                  <>
                    <button className="btn btn--primary btn--sm btn--pill" disabled>
                      Reset Password
                    </button>
                    <span className="badge badge--error">
                      Verify email first
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="mb-6">
              <label className="form-label form-label--light">Account Management</label>
              <div>
                <button className="btn btn--danger btn--sm btn--pill" onClick={handleDeleteAccount}>
                  Delete Account
                </button>
              </div>
            </div>
          </div>

          <button className="btn btn--ghost" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      </section>

      <Footer />

      <VerificationModal
        isOpen={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        userEmail={userEmail}
      />

      <ConsentModal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        onConsent={handleConsentResult}
      />

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
        confirmText="Delete Account"
        cancelText="Cancel"
        isDangerous={true}
      />

      <PasswordResetRequestModal
        isOpen={showPasswordResetModal}
        onClose={() => setShowPasswordResetModal(false)}
        userEmail={userEmail}
        onConfirm={handlePasswordResetConfirm}
      />

      <StatusModal
        isOpen={showSubscriptionSuccess}
        onClose={() => setShowSubscriptionSuccess(false)}
        status="success"
        title="Subscription Activated!"
        message={`Your ${successTierName || ''} subscription is now active. Credits have been added to your account.`}
      />
    </div>
  );
};

export default AccountPage;