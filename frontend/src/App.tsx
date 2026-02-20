import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/homepage/LandingPage';
import AccountPage from './components/authenticated/AccountPage';
import YourPapersPage from './components/authenticated/YourPapersPage';
import NewPaperPage from './components/authenticated/NewPaperPage';
import ConsentPage from './components/authenticated/ConsentPage';
import ProcessingPage from './components/authenticated/ProcessingPage';
import PreviewPage from './components/authenticated/PreviewPage';
import UploadConfirmPage from './components/authenticated/UploadConfirmPage';
import CreditTopUpPage from './components/authenticated/CreditTopUpPage';
import PrivacyPolicy from './components/static/PrivacyPolicy';
import TermsConditions from './components/static/TermsConditions';
import AboutPage from './components/static/AboutPage';
import PricingPage from './components/static/PricingPage';
import BrowseJournalsPage from './components/static/BrowseJournalsPage';
import BlogPage from './components/static/BlogPage';
import BlogPostPage from './components/static/BlogPostPage';
import SignInPage from './components/static/SignInPage';
import VerifyPage from './components/static/VerifyPage';
import PasswordResetPage from './components/static/PasswordResetPage';
import ForgotPasswordPage from './components/static/ForgotPasswordPage';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};

// Static pages that should NOT auto-spawn an anonymous session
const NO_ANON_ROUTES = ['/', '/about', '/pricing', '/journals', '/blog', '/privacy', '/terms', '/signin', '/signup', '/verify', '/forgot-password', '/reset-password'];

const AppContent = () => {
  const location = useLocation();
  const { isAuthenticated, isLoading, anonSpawn } = useAuth();

  useEffect(() => {
    if (isLoading || isAuthenticated) return;
    if (NO_ANON_ROUTES.includes(location.pathname) || location.pathname.startsWith('/blog/')) return;
    anonSpawn();
  }, [isLoading, isAuthenticated, location.pathname, anonSpawn]);

  return (
    <div className="App">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<><LandingPage /><Footer /></>} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/papers" element={<YourPapersPage />} />
        <Route path="/papers/new" element={<NewPaperPage />} />
        <Route path="/papers/consent" element={<ConsentPage />} />
        <Route path="/papers/upload-confirm" element={<UploadConfirmPage />} />
        <Route path="/credits" element={<CreditTopUpPage />} />
        <Route path="/papers/processing" element={<ProcessingPage />} />
        <Route path="/papers/:id/view" element={<PreviewPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/journals" element={<BrowseJournalsPage />} />
        <Route path="/blog" element={<BlogPage />} />
        <Route path="/blog/:slug" element={<BlogPostPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignInPage />} />
        <Route path="/verify" element={<VerifyPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<PasswordResetPage />} />
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
