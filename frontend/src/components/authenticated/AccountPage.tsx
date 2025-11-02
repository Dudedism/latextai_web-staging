import React from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/common.css';
import './AccountPage.css';

interface AccountPageProps {
  userName?: string;
  userEmail?: string;
}

const AccountPage: React.FC<AccountPageProps> = () => {
  const { user, isAuthenticated } = useAuth();

  // Use user data from context
  const userName = user?.name || 'User';
  const userEmail = user?.email || 'user@example.com';

  console.log('👤 [ACCOUNT PAGE] Render state:', {
    isAuthenticated,
    userEmail,
    userName
  });

  const handleSignOut = () => {
    console.log('Sign out clicked');
  };

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
        </div>

        <button className="sign-out-btn" onClick={handleSignOut}>
          Sign Out
        </button>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AccountPage;