# LaTeX.ai - Document Conversion Platform

A full-stack web application that converts Microsoft Word documents (.docx) to LaTeX format using AI-powered processing, with support for multiple academic journal templates.

## 🏗️ Architecture Overview

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
│  • User authentication & authorization                           │
│  • File upload & validation                                      │
│  • Payment processing (Stripe)                                   │
│  • Project metadata management                                   │
└────────────────────────┬────────────────────────────────────────┘
                         │ API Key Authentication
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   latextai Service                               │
│                  (Flask API - Port 8001)                         │
│  • DOCX → LaTeX conversion (GPT-4 powered)                       │
│  • Layout correction & PDF compilation                           │
│  • Background job processing                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                ┌──────────────────┐
                │  MongoDB Database │
                │   (Shared DB)     │
                └──────────────────┘
```

## 📁 Project Structure

```
latext-site/
├── backend/                      # Flask API server (Port 8000)
│   ├── app.py                   # Main Flask application
│   ├── config.py                # Environment configuration
│   ├── database.py              # MongoDB models (User, Project, Ticket)
│   ├── api_auth.py              # Authentication endpoints
│   ├── api_user.py              # User profile operations
│   ├── api_admin.py             # Admin operations
│   ├── api_public.py            # Public endpoints (health check)
│   ├── api_project.py           # Project CRUD, upload, validation
│   ├── api_latext.py            # LaTeX processing (proxy to latextai)
│   ├── email_service.py         # Email sending (Brevo)
│   ├── templates.json           # Available LaTeX templates
│   ├── utils/
│   │   ├── document_utils.py    # DOCX metadata extraction
│   │   └── pricing.py           # Cost calculation
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
    │       └── auth.ts          # Token management
    └── package.json             # Node dependencies
```

## 🔄 Project Status Flow

### Status Values

| Status | Description |
|--------|-------------|
| `uploaded` | File uploaded, awaiting validation |
| `validated` | Document validated and ready for payment/processing |
| `processing` | Currently being converted by latextai service |
| `converted` | Successfully completed, PDF/TEX available |
| `failed` | Processing error occurred |

### Complete Lifecycle

```
1. UPLOAD
   POST /api/latex/upload
   ├─ Status: 'uploaded'
   ├─ validated: false
   └─ paid: false

2. VALIDATION
   POST /api/latex/validate
   ├─ Converts DOCX → PDF (LibreOffice) for page counting
   ├─ Calculates cost: $4.99 + ($0.50 × pages beyond 15)
   ├─ Status: 'validated' ✓
   ├─ validated: true
   └─ paid: false

3. PAYMENT
   Option A: POST /api/latex/claim-free (first upload)
   Option B: Stripe payment (coming soon)
   ├─ REQUIRES: status='validated' AND validated=true ✓
   ├─ Status: 'validated' (unchanged)
   ├─ validated: true
   └─ paid: true ✓

4. PROCESSING
   POST /api/latex/process
   ├─ Requires: status='validated' AND paid=true
   ├─ Forwards to latextai service
   ├─ Status: 'processing' ✓
   └─ Background worker starts

5. COMPLETION
   (Automatic - latextai worker)
   ├─ Status: 'converted' ✓
   ├─ pdf_filename: set
   └─ tex_filename: set

6. ERROR (if processing fails)
   (Automatic - latextai worker)
   └─ Status: 'failed' ✓
```

### Critical Status Checks

**Before payment** (`api_project.py:390-402`, `api_latext.py:97-109`):
```python
if not project.get('validated', False):
    return error  # Must validate first
if project.get('status') != 'validated':
    return error  # Cannot pay for unvalidated project
```

**Before processing** (`api_latext.py:159-163`):
```python
if project.get('status') != 'validated':
    return error  # Cannot process
if not project.get('paid', False):
    return error  # Must be paid
```

**Before download** (`api_latext.py:271-272, 325-326`):
```python
if project.get('status') != 'converted':
    return error  # PDF/TEX not ready
```

## 🚀 Setup Instructions

### Prerequisites

- Python 3.12+
- Node.js 18+
- MongoDB 8.0+ (running on host or remote)
- Docker & Docker Compose (for latextai service)

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create `.env.development` file:
   ```env
   FLASK_ENV=development
   BACKEND_URL=http://localhost:8000

   # MongoDB
   MONGO_URI=mongodb://username:password@localhost:27017/latext_db?tls=true&tlsAllowInvalidCertificates=true

   # JWT
   SECRET_KEY=your-secret-key-here
   JWT_SECRET_KEY=your-jwt-secret-key

   # External Services
   LATEXTAI_SERVICE_URL=http://localhost:8001
   LATEXTAI_API_KEY=your-api-key-here

   # Email (Brevo)
   BREVO_API_KEY=your-brevo-api-key

   # Google OAuth (optional)
   GOOGLE_CLIENT_ID=your-google-client-id
   ```

5. **Run the Flask server:**
   ```bash
   python app.py
   ```
   Server runs on `http://localhost:8000`

### Frontend Setup

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   Create `.env` file:
   ```env
   VITE_BACKEND_URL=http://localhost:8000
   ```

4. **Run development server:**
   ```bash
   npm run dev
   ```
   Development server runs on `http://localhost:5173`

## 🔐 Authentication & Authorization

### User Roles

- **Regular User**: Can upload documents, claim free upload, view own projects
- **Admin User**: All user permissions + admin debugging controls

### JWT Token Flow

```
1. User logs in → Backend issues access_token (15 min) + refresh_token (7 days)
2. Frontend stores tokens in localStorage
3. All API requests include: Authorization: Bearer {access_token}
4. Frontend auto-refreshes token every 10 minutes
5. Logout → Backend invalidates refresh_token
```

### Admin Access

To make a user an admin:

```javascript
// In MongoDB shell (mongosh)
db.users.updateOne(
  { email: 'user@example.com' },
  { $set: { admin: true } }
)
```

**Note:** User must log out and log back in for admin flag to take effect.

## 📊 Database Schema

### Users Collection

```javascript
{
  _id: ObjectId,
  name: String,
  email: String,
  password: String,          // Scrypt hashed
  is_verified: Boolean,
  admin: Boolean,
  data_consent: Boolean,
  free_upload_used: Boolean,
  is_deleted: Boolean,
  created_at: Date,
  refresh_token_jti: String,
  token_updated_at: Date
}
```

### Projects Collection

```javascript
{
  _id: ObjectId,
  project_id: String,        // UUID
  user_id: String,           // User email
  template: String,          // Template ID (e.g., 'MQ', 'IEEE')
  status: String,            // 'uploaded' | 'validated' | 'processing' | 'converted' | 'failed'
  upload_filename: String,
  pdf_filename: String,
  tex_filename: String,
  page_count: Number,
  word_count: Number,
  total_cost: Number,
  paid: Boolean,
  is_free_project: Boolean,
  validated: Boolean,
  validated_at: Date,
  paid_at: Date,
  created_at: Date
}
```

## 🛠️ API Endpoints

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
- `POST /api/latex/claim-free` - Claim free upload (atomic operation)
- `POST /api/latex/process` - Start LaTeX conversion
- `GET /api/latex/projects` - List user's projects
- `GET /api/latex/project/:id` - Get project details
- `GET /api/latex/project/:id/payment-details` - Get payment info
- `DELETE /api/latex/project/:id` - Delete project

### Downloads

- `GET /api/latex/project/:id/pdf` - Download PDF
- `GET /api/latex/project/:id/tex` - Download LaTeX source (verified users only)

### Admin Endpoints

- `POST /api/latex/admin/mark-paid` - Mark project as paid (bypass payment)
- `GET /api/admin/users` - List all users
- `GET /api/admin/tickets` - Manage support tickets

## 🧪 Admin Debugging Features

Admin users see a **"⚡ Quick Process (Admin)"** button on the payment page that:

1. Marks the project as `paid=true` (bypasses Stripe)
2. Sets `status='validated'`
3. Triggers processing immediately
4. Redirects to preview page

**Backend endpoint:** `POST /api/latex/admin/mark-paid`

## 🏷️ Available LaTeX Templates

Templates are defined in `backend/templates.json`:

- IEEE Conference
- Mankind Quarterly (MQ)
- Nature
- The Lancet
- Springer Computer Science
- Elsevier
- APS (American Physical Society)
- TU Darmstadt
- And more...

Each template has:
- Display name and description
- LaTeX template files (in latextai service)
- Enabled/disabled status

## 💳 Pricing Model

**Free Tier:**
- First upload: FREE

**Paid Tier:**
- Base cost: $4.99 (up to 15 pages)
- Additional pages: $0.50/page

**Validation:**
- Documents with word/page ratio < 50 are rejected (prevents PDF-as-DOCX uploads)

## 📧 Email Integration

**Service:** Brevo (formerly Sendinblue)

**Email Types:**
- Email verification
- Password reset

**Configuration:** `backend/email_service.py`

## 🔗 Integration with latextai Service

The main website proxies requests to the latextai microservice:

```python
# Example: Processing request
response = requests.post(
    f"{LATEXTAI_SERVICE_URL}/api/upload",
    files={'file': file_data},
    data={
        'user_email': user['email'],
        'project_id': project_id,
        'template': template_name
    },
    headers={'X-API-Key': LATEXTAI_API_KEY}
)
```

See [latextai repository](../latextai/README.md) for conversion engine details.

## 🐛 Troubleshooting

### Status stuck at 'uploaded'

**Cause:** Project wasn't validated before attempting to process.

**Fix:** Ensure `/api/latex/validate` is called after upload and before `/api/latex/process`.

### Processing fails with "must be validated"

**Cause:** `status != 'validated'` or `paid != true`

**Fix:** Check that:
1. Validation completed successfully
2. Payment/free claim completed
3. Status was set to 'validated' (fixed in latest version)

### Admin controls not showing

**Cause:** User's `admin` field not set in database, or user didn't re-login after update.

**Fix:**
1. Update database: `db.users.updateOne({email: '...'}, {$set: {admin: true}})`
2. Log out and log back in

## 📝 Environment Files

### Development
- Backend: `.env.development`
- Frontend: `.env`

### Staging
- Backend: `.env.staging`
- Frontend: `.env.staging`

### Production
- Backend: `.env.production`
- Frontend: `.env.production`

## 🚢 Deployment

**Backend:**
```bash
gunicorn app:app --bind 0.0.0.0:8000 --workers 4
```

**Frontend:**
```bash
npm run build:production
# Serve dist/ directory with Nginx or similar
```

## 📚 Development Notes

- MongoDB must be accessible from backend
- LibreOffice must be installed for DOCX validation (page counting)
- latextai service must be running for processing to work
- JWT tokens are automatically refreshed by frontend
- File uploads are limited to 30MB
- CORS is configured for cross-origin requests

## 🔒 Security Features

- JWT authentication with refresh tokens
- Password hashing (Scrypt)
- Rate limiting (10,000/day, 1,000/hour)
- Email verification required
- Admin role validation
- File type validation
- File size limits
- Secure MongoDB connections (TLS)
- API key authentication for service-to-service communication

## 📄 License

[Add your license here]

## 👥 Contributors

[Add contributors here]

## 🆘 Support

For issues or questions, create a support ticket through the application or contact the development team.
