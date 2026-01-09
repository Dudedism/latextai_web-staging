import React from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import './StaticPages.css';

const TermsConditions: React.FC = () => {
  return (
    <div className="static-page">
      <Banner />

      <section className="static-main-section">
        <div className="static-container">
        <h1 className="static-title">Terms of Service</h1>
        <p className="static-date">Effective Date: January 2025</p>

        <p>
          These Terms of Service ("Terms") govern your access to and use of OpenTypesetter ("the Service"),
          operated by OpenTypesetter LLC, a Wyoming Limited Liability Company ("OpenTypesetter," "we," "our,"
          or "us"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree,
          you may not use the Service.
        </p>

        <section className="static-section">
          <h2>1. Eligibility & Accounts</h2>
          <p><strong>1.1 Eligibility:</strong> You must be at least 18 years old to use the Service.</p>
          <p>
            <strong>1.2 Account Registration:</strong> To access the Service, you must create an account by registering
            with your email address and password.
            You are responsible for maintaining the confidentiality of your account credentials and for all activities
            that occur under your account. You agree to notify us immediately of any unauthorized use of your account.
          </p>
          <p>
            <strong>1.3 Account Deletion:</strong> You may delete your account at any time through your account settings.
            When you delete your account, all associated documents and personal data will be permanently removed from our systems immediately.
          </p>
        </section>

        <section className="static-section">
          <h2>2. Description of Service</h2>
          <p>
            <strong>2.1 Service Offered:</strong> OpenTypesetter allows users to upload documents (currently .doc and .docx)
            for automated conversion into LaTeX format, including formatting of text, tables, equations, and citations.
          </p>
          <p>
            <strong>2.2 Free and Paid Use:</strong> The first uploaded document may be processed free of charge. Thereafter,
            the Service operates on a pay-per-document basis.
          </p>
        </section>

        <section className="static-section">
          <h2>3. User Content & Intellectual Property</h2>
          <p>
            <strong>3.1 User Ownership:</strong> You retain all rights, title, and interest in and to the documents
            you upload ("User Content").
          </p>
          <p>
            <strong>3.2 License to Process:</strong> By uploading content, you grant OpenTypesetter a limited, non-exclusive
            license to process and convert your User Content solely for the purpose of providing the Service.
          </p>
          <p>
            <strong>3.3 Optional Consent for Service Improvement:</strong> When creating an account, you may choose to
            consent to allow OpenTypesetter to use your uploaded and typeset documents for internal research and service
            improvement purposes. This consent is entirely opt-in, can be withdrawn at any time in your account settings,
            and never involves sharing or selling documents to third parties. If you do not consent, your documents will
            only be used to provide the Service.
          </p>
        </section>

        <section className="static-section">
          <h2>4. Payments and Credits</h2>
          <p>
            <strong>4.1 Payments:</strong> The Service operates on a pay-per-document basis. Payment is required before
            processing, except for the first free document.
          </p>
          <p>
            <strong>4.2 Payment Processing:</strong> Payments are processed securely through Stripe, Inc. ("Stripe").
            By making a payment, you also agree to Stripe's own terms of service and privacy policy.
          </p>
          <p>
            <strong>4.3 Credits for Feedback:</strong> We may, at our discretion, issue credits to users who provide
            feedback about the Service. These credits have no monetary value and may be used only for additional document
            submissions. The availability of such credits is not a guaranteed right.
          </p>
        </section>

        <section className="static-section">
          <h2>5. Data Storage & Deletion</h2>
          <p>
            <strong>5.1 Storage:</strong> Uploaded documents remain available in your account until you delete them.
          </p>
          <p>
            <strong>5.2 Deletion:</strong> When you delete a document, it is permanently removed from our systems immediately.
          </p>
          <p>
            <strong>5.3 Privacy Policy:</strong> Our Privacy Policy, which explains in detail how we handle your data,
            forms part of these Terms.
          </p>
        </section>

        <section className="static-section">
          <h2>6. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Upload illegal, infringing, or harmful content;</li>
            <li>Interfere with or disrupt the Service or its servers;</li>
            <li>Attempt to reverse engineer, decompile, or exploit the Service.</li>
          </ul>
        </section>

        <section className="static-section">
          <h2>7. Termination</h2>
          <p>
            <strong>7.1 By Company:</strong> We may suspend or terminate your account (i) for violation of these Terms,
            (ii) to comply with legal obligations, or (iii) at our sole discretion, for any reason or no reason.
          </p>
          <p>
            <strong>7.2 By User:</strong> You may terminate your account at any time by deleting it.
          </p>
        </section>

        <section className="static-section">
          <h2>8. Disclaimers</h2>
          <p>
            The Service is provided "as is" and "as available." We make no warranties, express or implied, including
            but not limited to merchantability, fitness for a particular purpose, or non-infringement. We do not warrant
            that the Service will be uninterrupted or error-free.
          </p>
        </section>

        <section className="static-section">
          <h2>9. Limitation of Liability</h2>
          <p>
            <strong>9.1</strong> To the fullest extent permitted by law, OpenTypesetter LLC, its members, and affiliates
            shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of
            the Service.
          </p>
          <p>
            <strong>9.2</strong> Our total liability for any claim related to the Service shall not exceed the greater of
            (a) the amount you paid for the affected document or (b) one hundred U.S. dollars (US $100).
          </p>
        </section>

        <section className="static-section">
          <h2>10. Governing Law & Dispute Resolution</h2>
          <p>
            <strong>10.1 Governing Law:</strong> These Terms are governed by the laws of the State of Wyoming, without
            regard to its conflict-of-laws principles.
          </p>
          <p>
            <strong>10.2 Arbitration:</strong> Any dispute arising from these Terms or your use of the Service shall be
            resolved by binding arbitration administered by the American Arbitration Association (AAA) under its Consumer
            Arbitration Rules. The seat of arbitration shall be Cheyenne, Wyoming. Either party may bring an individual
            action in a Wyoming small-claims court instead of arbitration.
          </p>
        </section>

        <section className="static-section">
          <h2>11. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. If material changes occur, we will notify you by email or within
            the Service interface. Continued use of the Service after such notice constitutes your acceptance of the updated Terms.
          </p>
        </section>

        <section className="static-section">
          <h2>12. Contact Information</h2>
          <p>
            For questions or concerns, contact:
            <br />
            OpenTypesetter LLC
            <br />
            Email: <a href="mailto:contact@latext.ai">contact@latext.ai</a>
          </p>
        </section>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default TermsConditions;
