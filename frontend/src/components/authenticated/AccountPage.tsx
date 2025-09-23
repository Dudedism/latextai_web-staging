import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated } from '../../utils/auth';
import '../../styles/common.css';
import './AccountPage.css';

interface AccountPageProps {
  userName?: string;
  userEmail?: string;
}

const AccountPage: React.FC<AccountPageProps> = ({
  userName = localStorage.getItem('userName') || 'User',
  userEmail = localStorage.getItem('userEmail') || 'user@example.com' 
}) => {
  const navigate = useNavigate();
  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();
  const hasAnonymousKey = localStorage.getItem('anonymousKey') !== null;

  useEffect(() => {
    // Redirect anonymous users to sign up
    if (hasAnonymousKey) {
      navigate('/signin');
    }
  }, [hasAnonymousKey, navigate]);

  const handleSignOut = () => {
    console.log('Sign out clicked');
  };

  const handleRemoveCard = () => {
    console.log('Remove card clicked');
  };

  const handleAddCard = () => {
    console.log('Add card clicked');
  };

  return (
    <div className="account-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="account-main-section">
        <div className="account-container">
          <h1 className="account-title">Your Account</h1>
          
          <div className="account-section">
          <div className="account-field">
            <label>Name</label>
            <div className="field-value">{userName}</div>
          </div>
          
          {!hasAnonymousKey && (
            <div className="account-field">
              <label>Email</label>
              <div className="field-value">{userEmail}</div>
            </div>
          )}
        </div>

        {!hasAnonymousKey && (
          <div className="account-section">
            <label>Saved Cards</label>
            <div className="saved-cards">
              <div className="credit-card">
                <button className="remove-card-btn" onClick={handleRemoveCard}>
                  Remove
                </button>
                <div className="card-info">
                  <div className="card-name">{userName}</div>
                  <div className="card-number">**** **** **** 7568</div>
                </div>
              </div>
              <button className="add-card-btn" onClick={handleAddCard}>
                <span className="plus-icon">+</span>
                Add Card
              </button>
            </div>
          </div>
        )}

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