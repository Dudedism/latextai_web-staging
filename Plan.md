
This file is to keep track of the to-do for this website:

# Immediate:

- Fix authentication and anon user creation
- Create repository and docker for pipeline.
- Create mock pipeline that uses RabbitMQ + Celery, including whatever else the pipeline will use.

# Admin Panel:

Create admin dashboard, features should include:
- Enter a username, email, etc. Find user submissions.
- Basic ability to interact with project files (delete, upload, download)
- Communicate with users via email

# Pipeline:

- Run pipeline myself on a test file
- Create unit tests for pipeline
- Prepare pipeline for insertion

# Three repos:

1. Website (Flask, MongoDB)
2. Pipeline handling (Flask, Celery, RabbitMQ)
3. Pipeline (single i/o for insertion into #2)

---

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
- Rate limiting
- CORS configuration
- Input sanitization