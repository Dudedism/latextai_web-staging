import React, { useState } from 'react';
import Banner from '../Banner';
import Footer from '../Footer';
import { getAuthenticatedUser, isAuthenticated } from '../../utils/auth';
import '../../styles/common.css';
import './PreviewPage.css';

const PreviewPage: React.FC = () => {
  const [satisfied, setSatisfied] = useState<boolean | null>(null);
  const [currentPage] = useState(1);

  const user = getAuthenticatedUser();
  const authenticated = isAuthenticated();

  const handleSatisfiedClick = (value: boolean) => {
    setSatisfied(value);
    if (value) {
      // If satisfied, could navigate to payment or download
      console.log('User is satisfied with formatting');
    } else {
      // If not satisfied, could offer options to reprocess
      console.log('User wants to try different formatting');
    }
  };

  return (
    <div className="preview-page">
      <Banner isAuthenticated={authenticated} userName={user?.name} />
      
      <section className="preview-main-section">
        <div className="preview-container">
        <div className="preview-content">
          <div className="preview-document">
            <div className="document-header">
              <img src="/nature.svg" alt="Nature" className="journal-logo" />
              <span className="journal-name">nature</span>
              <span className="journal-subtitle">Manuscript formatting</span>
            </div>
            
            <div className="document-body">
              <div className="document-text">
                <p className="document-paragraph">
                  This guide describes how to prepare contributions for submission. We recommend you read this in full if you have not previously submitted a contribution to Nature. We also recommend that authors refer to the full author instruction prior to submission.
                </p>

                <h2 className="section-title">Format of Articles and letters</h2>
                
                <p className="document-paragraph">
                  <strong>Articles</strong> are original reports whose conclusions represent a substantial advance in the understanding of an important problem and have immediate, far-reaching implications. They are typically 3,000 words of main text (not including Methods, references and figure legends). Articles have a separate summary of up to 150 words, which has no references, and does not contain citations to numbered references in the main text, and up to six display items (figures and/or tables). Typically Articles includes received/accepted dates.
                </p>

                <p className="document-paragraph">
                  Articles have a summary separate of 150-200 words, which is aimed at readers outside the discipline. This summary contains a paragraph (2-3 sentences) of basic-level introduction to the field, a brief account of the background and rationale of the work, followed by a statement of the main conclusions (introduced by the phrase 'Here we show' or its equivalent) and finally, 2-3 sentences putting the main findings into general context so it is clear how the results described in the paper have moved the field forwards. Please refer to our annotated example to see how to structure the summary paragraph.
                </p>

                <h2 className="section-title">Format of articles and letters</h2>
                
                <p className="document-paragraph">
                  Contributors may suggest particularly suitable independent referees when they submit their manuscript, but must give contact details of the proposed reviewer. They are confident notes that are by other departments on the essential aspects and published in the editors' discretion. Correspondence intended for publication in Nature must be submitted exclusively via the journal's online submission system.
                </p>
              </div>
              
              <div className="page-indicator">
                Page {currentPage}
              </div>
            </div>
          </div>

          <div className="preview-sidebar">
            <h2 className="sidebar-title">See your first 3 pages free</h2>
            
            <div className="satisfaction-section">
              <p className="satisfaction-question">
                Are you happy with the quality of this formatting?
              </p>
              <div className="satisfaction-buttons">
                <button
                  className={`satisfaction-btn ${satisfied === true ? 'active' : ''}`}
                  onClick={() => handleSatisfiedClick(true)}
                >
                  Yes ✓
                </button>
                <button
                  className={`satisfaction-btn ${satisfied === false ? 'active' : ''}`}
                  onClick={() => handleSatisfiedClick(false)}
                >
                  No ✗
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default PreviewPage;