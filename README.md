# LaTeX.ai

A full-stack web application that converts Microsoft Word documents (.docx) to LaTeX format using AI, with support for multiple academic journal templates.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Browser                              │
│                  (React + TypeScript + Vite)                     │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   latext-site Backend                            │
│                  (Flask API - Port 8000)                         │
│  - User authentication & authorization                           │
│  - File upload & validation                                      │
│  - Payment processing (Stripe)                                   │
│  - Credit system management                                      │
│  - Project metadata management                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ API Key Authentication
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   latextai Service                               │
│                  (Flask API - Port 8001)                         │
│  - DOCX to LaTeX conversion (GPT-4 powered)                      │
│  - Layout correction & PDF compilation                           │
│  - Background job processing                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  MongoDB Database │
                │   (Shared DB)     │
                └──────────────────┘
```

## Project Structure

```
latext-site/
├── backend/                      # Flask API server (Port 8000)
│   ├── app.py                   # Main Flask application
│   ├── config.py                # Environment configuration
│   ├── database.py              # MongoDB models
│   ├── api_auth.py              # Authentication endpoints
│   ├── api_user.py              # User profile operations
│   ├── api_admin.py             # Admin operations
│   ├── api_public.py            # Public endpoints (health check)
│   ├── api_project.py           # Project CRUD, upload, validation
│   ├── api_latext.py            # LaTeX processing (proxy to latextai)
│   ├── api_stripe.py            # Stripe payment integration
│   ├── api_credits.py           # Credit balance and transactions
│   ├── email_service.py         # Email sending (Brevo)
│   ├── templates.json           # Available LaTeX templates
│   ├── utils/
│   │   ├── document_utils.py    # DOCX metadata extraction
│   │   └── pricing.py           # Cost calculation
│   ├── tests/                   # Integration tests (pytest)
│   ├── user_projects/           # Uploaded files storage
│   └── requirements.txt         # Python dependencies
│
└── frontend/                    # React application (Port 5173)
    ├── src/
    │   ├── main.tsx             # Application entry point
    │   ├── App.tsx              # Root component with routing
    │   ├── components/
    │   │   ├── authenticated/   # Protected pages
    │   │   ├── static/          # Public pages
    │   │   ├── common/          # Shared components
    │   │   └── admin/           # Admin dashboard
    │   ├── contexts/
    │   │   └── AuthContext.tsx  # Authentication state
    │   └── utils/
    │       ├── api.ts           # API client wrapper
    │       ├── auth.ts          # Token management
    │       └── fetchInterceptor.ts  # Auto 401 handling
    └── package.json             # Node dependencies
```

## Project Status Flow

| Status | Description |
|--------|-------------|
| `uploaded` | File uploaded, awaiting validation |
| `validated` | Document validated and ready for payment/processing |
| `processing` | Currently being converted by latextai service |
| `converted` | Successfully completed, PDF/TEX available |
| `failed` | Processing error occurred |

### Lifecycle

```
1. UPLOAD
   POST /api/latex/upload
   Status: 'uploaded', validated: false, paid: false

2. VALIDATION
   POST /api/latex/validate
   Converts DOCX to PDF (LibreOffice) for page counting
   Calculates cost: 500 credits base + 50 credits per page beyond 15
   Status: 'validated', validated: true, paid: false

3. PAYMENT
   Option A: POST /api/latex/claim-free (first upload, requires card verification)
   Option B: Stripe Checkout Session
   Option C: Pay with credits (POST /api/latex/pay-with-credits)
   Status: 'validated', validated: true, paid: true

4. PROCESSING
   POST /api/latex/process
   Forwards to latextai service
   Status: 'processing'

5. COMPLETION
   (Automatic via latextai worker)
   Status: 'converted', pdf_filename and tex_filename set

6. ERROR
   Status: 'failed'
```

## Setup

### Prerequisites

- Python 3.12+
- Node.js 18+
- MongoDB 8.0+ (see MONGO.md for setup)
- Docker & Docker Compose (for latextai service)
- LibreOffice (for DOCX to PDF conversion during validation)

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `.env.development`:

```env
FLASK_ENV=development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173

# MongoDB
MONGO_URI=mongodb://username:password@localhost:27017/latext_db?tls=true&tlsAllowInvalidCertificates=true

# JWT (access: 1 day, refresh: 7 days)
SECRET_KEY=your-secret-key-here
JWT_SECRET_KEY=your-jwt-secret-key
JWT_ACCESS_TOKEN_EXPIRES=86400
JWT_REFRESH_TOKEN_EXPIRES=604800

# External Services
LATEXTAI_SERVICE_URL=http://localhost:8001
LATEXTAI_API_KEY=your-api-key-here

# Email (Brevo)
BREVO_API_KEY=your-brevo-api-key
BREVO_SENDER_EMAIL=noreply@latext.ai
BREVO_SENDER_NAME=LaTeX.ai Team

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id
```

Run the server:

```bash
python app.py
```

Server runs on `http://localhost:8000`

### Frontend Setup

```bash
cd frontend
npm install
```

Create `.env`:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Run development server:

```bash
npm run dev
```

Development server runs on `http://localhost:5173`

## Authentication

### JWT Token Flow

1. User logs in, backend issues access_token (1 day) + refresh_token (7 days)
2. Frontend stores tokens in localStorage
3. All API requests include `Authorization: Bearer {access_token}`
4. Global fetch interceptor catches 401 responses and auto-refreshes tokens
5. On refresh failure, user is redirected to /signin
6. Logout invalidates refresh_token in database

### Admin Access

```javascript
// In MongoDB shell (mongosh)
db.users.updateOne(
  { email: 'user@example.com' },
  { $set: { admin: true } }
)
```

User must log out and log back in for admin flag to take effect.

## Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  email: String,
  password: String,              // Scrypt hashed
  is_verified: Boolean,
  admin: Boolean,
  data_consent: Boolean,
  free_project_id: String,       // UUID of free project (null if not claimed)
  is_deleted: Boolean,
  card_fingerprints: [String],   // Stripe card fingerprints for abuse detection
  credit_balance: Number,        // Credits (1 credit = $0.01)
  created_at: Date,
  refresh_token_jti: String,
  token_updated_at: Date
}
```

### Projects Collection

```javascript
{
  _id: ObjectId,
  project_id: String,            // UUID
  user_id: ObjectId,             // Reference to user._id
  user_email: String,
  template: String,              // Template ID
  status: String,                // 'uploaded' | 'validated' | 'processing' | 'converted' | 'failed'
  upload_filename: String,
  pdf_filename: String,
  tex_filename: String,
  page_count: Number,
  word_count: Number,
  total_credits: Number,
  paid: Boolean,
  is_free_project: Boolean,
  validated: Boolean,
  validated_at: Date,
  paid_at: Date,
  created_at: Date,
  is_orphaned: Boolean,          // Set when project is deleted (keeps user_id for stats)
  orphaned_at: Date,
  feedback: String               // 'positive' | 'negative' | null
}
```

### Credit Transactions Collection

```javascript
{
  _id: ObjectId,
  transaction_id: String,        // UUID
  user_id: ObjectId,
  user_email: String,
  transaction_type: String,      // 'topup' | 'deduction' | 'refund'
  amount: Number,                // Positive for credits added, negative for deducted
  balance_after: Number,
  description: String,
  project_id: String,            // Associated project (if applicable)
  stripe_session_id: String,     // Stripe session (for topups)
  created_at: Date
}
```

### Used Tokens Collection

```javascript
{
  _id: ObjectId,
  token_hash: String,            // Hash of the token
  token_type: String,            // 'email_verification' | 'password_reset'
  email: String,
  used_at: Date
}
```

## API Endpoints

### Authentication

- `POST /api/signup` - User registration
- `POST /api/login` - User login (returns JWT tokens)
- `POST /api/logout` - Logout and invalidate refresh token
- `POST /api/refresh` - Refresh access token
- `POST /api/verify` - Verify email address
- `POST /api/forgot-password` - Request password reset
- `POST /api/reset-password` - Reset password with token

### Project Management

- `POST /api/latex/upload` - Upload DOCX file
- `POST /api/latex/validate` - Validate document and calculate cost
- `POST /api/latex/claim-free` - Claim free upload (atomic, requires card verification)
- `POST /api/latex/process` - Start LaTeX conversion
- `GET /api/latex/projects` - List user's projects
- `GET /api/latex/project/:id` - Get project details
- `DELETE /api/latex/project/:id` - Delete project
- `GET /api/latex/templates` - Get available templates

### Downloads

- `GET /api/latex/project/:id/pdf` - Download PDF
- `GET /api/latex/project/:id/tex` - Download LaTeX source (verified users only)

### Credits

- `GET /api/credits/balance` - Get user's credit balance
- `GET /api/credits/history` - Get transaction history
- `POST /api/credits/topup` - Create Stripe session for credit purchase

### Stripe

- `POST /api/stripe/create-setup-session` - Setup payment method (for free upload verification)
- `POST /api/stripe/webhook` - Stripe webhook handler

### User Profile

- `GET /api/user/profile` - Get user info
- `PUT /api/user/profile` - Update profile
- `GET /api/user/data-consent` - Get consent status
- `POST /api/user/data-consent` - Update consent
- `GET /api/user/verification-status` - Check email verification
- `POST /api/user/send-verification-email` - Resend verification

### Admin

- `POST /api/latex/admin/mark-paid` - Mark project paid (bypass payment)
- `GET /api/admin/users` - List all users

### Public

- `GET /api/health` - Health check

## Available Templates

Defined in `backend/templates.json`:

- IEEE Transactions
- IEEE Conference
- Nature Report
- NeurIPS
- Springer Computer Science
- The Lancet
- Default Document

## Pricing

Credit-based model (1 credit = $0.01):

| Component | Credits | USD |
|-----------|---------|-----|
| Base (up to 15 pages) | 500 | $5.00 |
| Additional pages | 50/page | $0.50/page |
| Minimum | 500 | $5.00 |
| Maximum | 10,000 | $100.00 |

First upload is free (requires card verification to prevent abuse).

## Stripe Integration

### Local Development Setup

1. Install Stripe CLI:
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. Login and start webhook forwarding:
   ```bash
   stripe login
   stripe listen --forward-to localhost:8000/api/stripe/webhook
   ```

3. Copy the webhook secret (`whsec_...`) to `.env.development`

4. Restart backend

### Test Payment Flow

1. Upload and validate a document
2. Click "Pay" button, redirects to Stripe Checkout
3. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
4. Webhook fires, marks project as paid, triggers processing

### Test Card Numbers

| Card Number | Description |
|-------------|-------------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 9995` | Declined (insufficient funds) |
| `4000 0000 0000 0002` | Declined (card declined) |
| `4000 0025 0000 3155` | Requires 3D Secure |

## Testing

Tests are integration tests that hit the actual API via HTTP requests.

### Requirements

- Flask backend running on port 8000
- MongoDB accessible
- `BACKEND_URL` environment variable set

### Running Tests

```bash
cd backend

# Run all tests
BACKEND_URL=http://localhost:8000 pytest tests/ -v -s

# Run specific test file
BACKEND_URL=http://localhost:8000 pytest tests/test_user_creation.py -v -s

# Run specific test
BACKEND_URL=http://localhost:8000 pytest tests/test_refresh_tokens.py::test_token_reuse_no_rotation -v -s
```

### Test Files

- `conftest.py` - Shared fixtures (test user creation, login)
- `test_user_creation.py` - User signup and verification
- `test_input_validation.py` - Input validation
- `test_upload_validation.py` - Document validation
- `test_refresh_tokens.py` - JWT refresh token flow
- `test_general_vulnerabilities.py` - Security tests
- `test_upload_race_condition.py` - Race condition prevention

### Test User Pattern

Tests use module-scoped fixtures:

```python
@pytest.fixture(scope="module")
def test_user():
    with app.app_context():
        user = create_test_user(is_verified=True, mongo_db=mongo.db, base_url=BASE_URL)
        yield user
        delete_test_user(user['email'], mongo.db)
```

### Cleanup Pattern

Tests that create resources must use try/finally:

```python
def test_something(test_user):
    project_id = None
    try:
        response = requests.post(f"{BASE_URL}/api/latex/upload", ...)
        project_id = response.json()['project_id']
        assert response.status_code == 200
    finally:
        if project_id:
            with app.app_context():
                mongo.db.projects.delete_one({'project_id': project_id})
```

### Security Features Tested

**Token Rotation:**
- Each refresh token use issues a new token
- Old refresh token is invalidated

**Reuse Detection:**
- Already-used refresh tokens are detected
- All tokens for that user are invalidated
- Attacker is blocked with 401

**Upload Race Condition:**
- Parallel requests to `/api/latex/claim-free` are protected
- Only one request succeeds, others get 409 (upload in progress) or 402 (already used)

## Troubleshooting

### Status stuck at 'uploaded'

Project wasn't validated. Call `/api/latex/validate` after upload and before `/api/latex/process`.

### Processing fails with "must be validated"

Either `status != 'validated'` or `paid != true`. Verify validation and payment completed.

### Admin controls not showing

User's `admin` field not set, or user didn't re-login after database update.

### Webhook not receiving events

1. Verify `stripe listen` is running
2. Check endpoint is `localhost:8000/api/stripe/webhook`
3. Verify `STRIPE_WEBHOOK_SECRET` matches CLI output
4. Restart backend after updating secret
