import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import LandingPage from './components/homepage/LandingPage';
import AccountPage from './components/authenticated/AccountPage';
import YourPapersPage from './components/authenticated/YourPapersPage';
import NewPaperPage from './components/authenticated/NewPaperPage';
import ConsentPage from './components/authenticated/ConsentPage';
import ProcessingPage from './components/authenticated/ProcessingPage';
import PreviewPage from './components/authenticated/PreviewPage';
import UploadConfirmPage from './components/authenticated/UploadConfirmPage';
import PaymentPage from './components/authenticated/PaymentPage';
import SupportPage from './components/authenticated/SupportPage';
import PrivacyPolicy from './components/static/PrivacyPolicy';
import TermsConditions from './components/static/TermsConditions';
import AboutPage from './components/static/AboutPage';
import PricingPage from './components/static/PricingPage';
import SignInPage from './components/static/SignInPage';
import VerifyPage from './components/static/VerifyPage';
import PasswordResetPage from './components/static/PasswordResetPage';
import ForgotPasswordPage from './components/static/ForgotPasswordPage';
import AdminSupportPage from './components/admin/AdminSupportPage';
import useAuthRedirect from './hooks/useAuthRedirect';
import { shouldRefreshToken, refreshAccessToken } from './utils/auth';
import './App.css'

const AppContent = () => {
  useAuthRedirect();

  // Proactive token refresh: on mount and periodically every 10 minutes
  useEffect(() => {
    const checkAndRefresh = async () => {
      if (shouldRefreshToken()) {
        console.log('🔄 [APP] Token expiring soon, refreshing proactively');
        await refreshAccessToken(true); // silent = true (don't redirect on failure)
      }
    };

    // Check immediately on mount
    checkAndRefresh();

    // Check every 10 minutes (600000 ms)
    const interval = setInterval(checkAndRefresh, 600000);

    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<><LandingPage /><Footer /></>} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/papers" element={<YourPapersPage />} />
        <Route path="/papers/new" element={<NewPaperPage />} />
        <Route path="/papers/consent" element={<ConsentPage />} />
        <Route path="/papers/upload-confirm" element={<UploadConfirmPage />} />
        <Route path="/papers/:projectId/payment" element={<PaymentPage />} />
        <Route path="/papers/processing" element={<ProcessingPage />} />
        <Route path="/papers/:id/view" element={<PreviewPage />} />
        <Route path="/papers/:id/support" element={<SupportPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignInPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
        {/* Admin Routes */}
        <Route path="/admin/support" element={<AdminSupportPage />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  )
}

// Import Footer here to avoid adding it to every page route
import Footer from './components/Footer';

export default App
