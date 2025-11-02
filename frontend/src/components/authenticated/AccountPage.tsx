import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import LoadingScreen from '../common/LoadingScreen';
import { useAuth } from '../../contexts/AuthContext';
import { VerificationModal } from '../common/VerificationModal';
import { ConsentModal } from '../common/ConsentModal';
import { ConfirmModal } from '../common/ConfirmModal';
import { apiRequest } from '../../utils/api';
import '../../styles/common.css';
import './AccountPage.css';

interface AccountPageProps {
  userName?: string;
  userEmail?: string;
}

const AccountPage: React.FC<AccountPageProps> = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isVerified, logout } = useAuth();
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [dataConsent, setDataConsent] = useState<boolean | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [loading, setLoading] = useState(true);

  // Use user data from context
  const userName = user?.name || 'User';
  const userEmail = user?.email || 'user@example.com';

  // Fetch data consent status on mount
  useEffect(() => {
    const fetchDataConsent = async () => {
      try {
        setLoading(true);
        const data = await apiRequest<{ consent: boolean | null }>('/api/user/data-consent', {
          method: 'GET',
        });
        setDataConsent(data.consent);
      } catch (error) {
        console.error('Error fetching data consent:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchDataConsent();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  console.log('👤 [ACCOUNT PAGE] Render state:', {
    isAuthenticated,
    userEmail,
    userName,
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

  const handleConsentResult = async (consented: boolean) => {
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

  const confirmDeleteAccount = () => {
    // TODO: Implement account deletion API call
    console.log('Delete account confirmed');
    alert('Account deletion not yet implemented');
  };

  const handlePasswordReset = () => {
    // TODO: Implement password reset email sending
    console.log('Password reset clicked');
    setPasswordResetSent(true);

    // Hide message after 5 seconds
    setTimeout(() => {
      setPasswordResetSent(false);
    }, 5000);
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="account-page">
      <Banner isAuthenticated={isAuthenticated} userName={user?.name} />
      
      <section className="account-main-section">
        <div className="account-container">
          <h1 className="account-title">Your Account</h1>
          
          <div className="account-section">
          <div className="account-field">
            <label>Name</label>
            <div className="field-value">{userName}</div>
          </div>

          <div className="account-field">
            <label>Email</label>
            <div className="field-value">{userEmail}</div>
          </div>

          <div className="account-field">
            <label>Email Verification Status</label>
            <div className="field-value verification-status">
              {isVerified ? (
                <span className="verified-badge">✓ Verified</span>
              ) : (
                <>
                  <span className="unverified-badge">Not Verified</span>
                  <button className="verify-email-btn" onClick={handleVerifyEmail}>
                    Send Verification Email
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="account-field">
            <label>Data Consent</label>
            <div className="field-value verification-status">
              {dataConsent ? (
                <>
                  <span className="verified-badge">✓ Consent Granted</span>
                  <button className="delete-account-btn" onClick={handleConsentToggle}>
                    Revoke Consent
                  </button>
                </>
              ) : (
                <>
                  <span className="unverified-badge">Consent Not Granted</span>
                  <button className="verify-email-btn" onClick={handleConsentToggle}>
                    Grant Consent
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="account-field">
            <label>Password</label>
            <div className="field-value verification-status">
              <button className="verify-email-btn" onClick={handlePasswordReset}>
                Reset Password
              </button>
              {passwordResetSent && (
                <span className="password-reset-confirmation">Password reset sent!</span>
              )}
            </div>
          </div>

          <div className="account-field">
            <label>Account Management</label>
            <div className="field-value">
              <button className="delete-account-btn" onClick={handleDeleteAccount}>
                Delete Account
              </button>
            </div>
          </div>
        </div>

        <button className="sign-out-btn" onClick={handleSignOut}>
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
    </div>
  );
};

export default AccountPage;