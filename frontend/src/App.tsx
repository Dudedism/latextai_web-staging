import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './components/homepage/LandingPage';
import AccountPage from './components/authenticated/AccountPage';
import YourPapersPage from './components/authenticated/YourPapersPage';
import NewPaperPage from './components/authenticated/NewPaperPage';
import ProcessingPage from './components/authenticated/ProcessingPage';
import PreviewPage from './components/authenticated/PreviewPage';
import UploadConfirmPage from './components/authenticated/UploadConfirmPage';
import SupportPage from './components/authenticated/SupportPage';
import PrivacyPolicy from './components/static/PrivacyPolicy';
import TermsConditions from './components/static/TermsConditions';
import AboutPage from './components/static/AboutPage';
import PricingPage from './components/static/PricingPage';
import SignInPage from './components/static/SignInPage';
import AdminSupportPage from './components/admin/AdminSupportPage';
import AdminProjectsPage from './components/admin/AdminProjectsPage';
import AdminProjectDetailPage from './components/admin/AdminProjectDetailPage';
import useAuthRedirect from './hooks/useAuthRedirect';
import { anonSpawn } from './utils/auth';
import './App.css'

const AppContent = () => {
  useAuthRedirect();

  // Create anonymous account on site load
  useEffect(() => {
    anonSpawn();
  }, []);
  
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<><LandingPage /><Footer /></>} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/papers" element={<YourPapersPage />} />
        <Route path="/papers/new" element={<NewPaperPage />} />
        <Route path="/papers/upload-confirm" element={<UploadConfirmPage />} />
        <Route path="/papers/processing" element={<ProcessingPage />} />
        <Route path="/papers/:id/view" element={<PreviewPage />} />
        <Route path="/papers/:id/support" element={<SupportPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignInPage />} />
        {/* Admin Routes */}
        <Route path="/admin/support" element={<AdminSupportPage />} />
        <Route path="/admin/projects" element={<AdminProjectsPage />} />
        <Route path="/admin/projects/:projectId" element={<AdminProjectDetailPage />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

// Import Footer here to avoid adding it to every page route
import Footer from './components/Footer';

export default App
