import React from 'react';
import Banner from './Banner';
import Footer from './Footer';
import '../styles/common.css';
import './AccountPage.css';

interface AccountPageProps {
  userName?: string;
  userEmail?: string;
}

const AccountPage: React.FC<AccountPageProps> = ({ 
  userName = 'John Researcher', 
  userEmail = 'johnresearcher@aplace.edu' 
}) => {
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
      <Banner isAuthenticated={true} userName={userName} />
      
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