# LaTeXt Website Plan

## Overview
AI-powered document conversion service that transforms Word documents into professionally typeset LaTeX documents. Users can upload documents as anonymous users but must create an account and pay to download the final LaTeX output.

## User Types
- **Anonymous Users**: Can upload and preview documents, automatically tracked via cookies
- **Registered Users**: Have accounts, can pay for and download processed documents
- **Admin Users**: Can view system statistics and manage users

---

## 1. Landing Page

### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/`

### Access From
- Direct URL entry
- Logo click from any page

### Leads To
- Sign In Page (via "Sign In" button)
- Sign Up Page (via "Sign Up" or "Get Started" button)
- Your Papers Page (via "Try it Free" - creates anonymous session)

### Features
- Hero section with value proposition
- Sample before/after document previews
- Publisher templates showcase (Nature, IEEE, Elsevier, etc.)
- Pricing information
- How it works section
- Banner "Get Started" button becomes "Your Papers" after sign in (leads to Your Papers page)

---

## 2. Sign In / Sign Up Page

### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/signin`, `/signup`

### Access From
- Landing Page (Sign In/Sign Up buttons)
- Your Papers Page (when anonymous user needs to pay)
- New Paper Page (when anonymous user wants to save work)
- Any protected page redirect

### Leads To
- Your Papers Page (after successful authentication)
- Email verification page (after signup)
- Password reset flow (from Sign In)

### Features
- Email/password authentication
- Google OAuth integration
- Remember me option
- Link to switch between Sign In/Sign Up
- Email verification for new accounts

---

## 3. Your Papers Page

### Attributes
- **Authentication Required**: Yes (anonymous or registered)
- **Paywalled**: No
- **URL**: `/papers`

### Access From
- Sign In/Sign Up (after authentication)
- Landing Page ("Try it Free" - creates anonymous session)
- New Paper Page (via navigation, back button)
- Processing Page (via navigation)
- Post Processing View (via navigation)

### Leads To
- New Paper Page (via "New Paper" button)
- Processing Page (click "View" on processing paper)
- Post Processing View (click "View" on completed paper)
- Sign In Page (if anonymous user clicks paid feature)

### Features
- List of all uploaded papers with status:
  - Upload date
  - Document name
  - Processing status (Uploading/Processing/Ready)
  - Template used
  - Payment status (for registered users)
- Filter by status
- Search functionality
- Bulk actions (delete)

---

## 4. New Paper / Upload Page

### Attributes
- **Authentication Required**: Yes (anonymous or registered)
- **Paywalled**: No (upload is free)
- **URL**: `/papers/new`

### Access From
- Your Papers Page ("New Paper" button - only access point)

### Leads To
- Processing Page (after completing upload flow)
- Sign In Page (if anonymous user wants to save)

### State Flow
1. **Upload State**
   - Drag-and-drop or browse file selector
   - Supports .docx, .doc formats
   - File size limit display
   - Upload progress bar

2. **Preview + Confirmation State**
   - Document preview (first few pages)
   - Extracted metadata (title, authors, sections)
   - Edit metadata option
   - Confirm or re-upload option

3. **Choose Template State**
   - Template gallery (Nature, IEEE, Springer, etc.)
   - Template preview
   - Custom template option (future feature)
   - Processing time estimate

### Features
- Auto-save for anonymous users (cookie-based)
- Back button to previous state
- Cancel and return to Your Papers

---

## 5. Processing Page

### Attributes
- **Authentication Required**: Yes (anonymous or registered)
- **Paywalled**: No
- **URL**: `/papers/{id}/processing`

### Access From
- New Paper Page (after template selection)
- Your Papers Page (click "View" on processing paper)

### Leads To
- Post Processing View (when complete)
- Your Papers Page (via "Back to Papers")
- Sign In Page (if anonymous user wants to get notified)

### Features
- Real-time processing status
- Estimated time remaining
- Processing stages visualization:
  1. Document analysis
  2. Content extraction
  3. LaTeX conversion
  4. Template application
  5. Final compilation
- Option to get email notification when complete
- Cancel processing option

---

## 6. Stripe Payment Redirect

### Attributes
- **Authentication Required**: Yes (registered only)
- **Paywalled**: N/A (this is the paywall)
- **URL**: Stripe hosted

### Access From
- Post Processing View (click "Download LaTeX")
- Your Papers Page (click "Pay & Download")

### Leads To
- Post Processing View (on success)
- Payment failed page (on failure)

### Features
- Hosted by Stripe
- Shows document name and price
- Multiple payment methods
- Saves payment method for future use (optional)

---

## 7. Post Processing Paper View

### Attributes
- **Authentication Required**: Yes (anonymous or registered)
- **Paywalled**: Download is paywalled, preview is free
- **URL**: `/papers/{id}/view`

### Access From
- Processing Page (when complete)
- Your Papers Page (click "View" on completed paper)
- Stripe payment redirect (after successful payment)

### Leads To
- Stripe Payment (click "Download LaTeX" if unpaid)
- Your Papers Page (via navigation)
- New Paper Page (via "Convert Another")

### Features
- Side-by-side comparison (Original vs LaTeX output)
- PDF preview of LaTeX output
- Zoom controls
- Page navigation
- Download button (requires payment):
  - .tex file download
  - Supporting files (.bib, images)
  - Compilation instructions
- Reprocess with different template option
- Share preview link (time-limited)

---

## 8. Your Account Page

### Attributes
- **Authentication Required**: Yes (registered only)
- **Paywalled**: No
- **URL**: `/account`

### Access From
- Navigation menu (when signed in)
- Sign In redirect (for anonymous users)

### Leads To
- Your Papers Page
- Billing history
- Sign In Page (after logout)

### Features
- Profile information (name, email)
- Change password
- Email preferences
- Payment methods
- Billing history
- Usage statistics
- Delete account option

---

## User Journeys

### Anonymous User Flow
1. Lands on homepage
2. Clicks "Try it Free" → Creates anonymous session
3. Redirected to Your Papers page
4. Clicks "New Paper" button
5. Uploads document → Preview → Choose template
6. Views processing page
7. Sees completed preview
8. Clicks "Download" → Redirected to Sign Up
9. Creates account
10. Redirected to payment
11. Completes payment → Downloads LaTeX

### Returning Registered User Flow
1. Lands on homepage
2. Clicks "Sign In"
3. Authenticates
4. Goes to Your Papers page
5. Clicks "New Paper"
6. Uploads → Preview → Template → Processing
7. Views result
8. Pays and downloads

### Direct Upload Flow (Anonymous)
1. Lands on homepage
2. Clicks "Try it Free"
3. Anonymous session created
4. Redirected to Your Papers page
5. Clicks "New Paper"
6. Upload → Preview → Template
7. Processing → Preview
8. Prompted to create account for download

---

## 9. Miscellaneous Pages

### 9.1 Privacy Policy

#### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/privacy`

#### Access From
- Footer links (all pages)
- Sign Up page (checkbox link)
- Account settings

#### Features
- Data collection practices
- Cookie usage policy
- Third-party services (Stripe, Google OAuth)
- Data retention periods
- User rights (GDPR/CCPA compliance)
- Contact information for privacy concerns

---

### 9.2 Terms & Conditions

#### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/terms`

#### Access From
- Footer links (all pages)
- Sign Up page (checkbox requirement)
- Before payment completion

#### Features
- Service usage terms
- Acceptable use policy
- Intellectual property rights
- Payment terms and refund policy
- Limitation of liability
- Dispute resolution
- Account termination conditions

---

### 9.3 About

#### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/about`

#### Access From
- Footer links (all pages)
- Navigation menu

#### Features
- Company mission and vision
- Team information
- Technology overview (AI capabilities)
- Why LaTeX matters
- Success stories/testimonials
- Contact information
- Press kit/media resources

---

### 9.4 Pricing

#### Attributes
- **Authentication Required**: No
- **Paywalled**: No
- **URL**: `/pricing`

#### Access From
- Landing page ("View Pricing" button)
- Navigation menu
- Footer links
- Post Processing View (when viewing price)

#### Leads To
- Sign Up page (via "Get Started" on pricing tiers)
- Your Papers page (for logged-in users)

#### Features
- Pricing tiers:
  - Pay-per-document ($X per conversion)
  - Bulk packages (10 documents for $Y)
  - Academic discount
  - Enterprise/institutional pricing
- Feature comparison table
- FAQ section
- Money-back guarantee details
- Accepted payment methods
- Currency selector

---

## Technical Considerations

### Anonymous User Handling
- Cookie-based session tracking
- LocalStorage for document metadata
- 30-day cookie expiration
- Automatic migration to registered account on sign up

### Payment Integration
- Stripe Checkout for one-time payments
- Webhook handling for payment confirmation
- Receipt generation
- Refund policy implementation

### File Storage
- Temporary storage for uploads (7 days for anonymous, 30 days for registered)
- Secure S3 bucket for processed files
- CDN for preview images

### Processing Queue
- Background job queue for document processing
- WebSocket or polling for real-time status updates
- Email notifications on completion

### Security
- File type validation
- Virus scanning on upload
- Rate limiting
- CORS configuration
- Input sanitization