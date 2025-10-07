
This file is to keep track of the to-do for this website:

# Immediate:

<!-- - Fix authentication and anon user creation -->
<!-- - Delete user button -->
<!-- - Create repository and docker for pipeline. (We're not doing this, for now we bundle everything together) -->
<!-- - For now, we pretend an actual signed up account is a "paid" account.
- For "paid" accounts, full pdf view, no preview. Allow .tex download.
- For "free" (anonymous, unverified), only first 3 pages preview. No .tex download permitted. -->
<!-- - Improve preview page. Add approval buttons, pdf download button, tex download button. In the case of the approval move to status of resolved.
- Add basic admin panel to search users, projects, update, delete, download, etc. -->
<!-- - Add a support ticket function for paid users. Users can write a message (1000 characters) on what to change / improve. Support ticket shown if user presses not satisfied with preview. -->
- Create admin panel
- Update hardcoded paths from "https://localhost:8000". So make:
    - .env.development
    - .env.staging
    - .env.production

- Create the actual pipeline that uses RabbitMQ + Celery, including whatever else the pipeline will use.

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

1. Website (Flask NodeJs?, MongoDB)
2. Pipeline handling (Flask, Celery, RabbitMQ)
3. Pipeline (single i/o for insertion into #2)




# Later:

- Maybe move the processing spinner into the /papers page. Then add polling if there's any unfinished papers processing.







# Other:

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