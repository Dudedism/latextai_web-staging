# Mock LaTeX Conversion System Plan

## Understanding of Requirements

### System Overview
- Users upload .docx files that will eventually be converted to .tex and rendered as .pdf with journal templates (Nature, Lancet, etc.)
- Currently mocking this functionality without actual conversion
- Each user has a unique directory containing all their projects
- Each project represents one file upload/conversion attempt

### Database Structure
New MongoDB collection/class for projects with fields:
- `tex_filename` - name of the generated .tex file
- `upload_filename` - original uploaded file name
- `pdf_filename` - name of the generated .pdf file
- `user_id` - reference to the user who owns this project
- `status` - conversion state: 'unconverted', 'converted', 'resolved'

### Directory Structure
```
backend/user_projects/
├── mock_files/           # Mock template files
│   ├── mock.tex         # Simple 5-page LaTeX with page numbers
│   └── mock.pdf         # Compiled version of mock.tex
└── {user_id}/           # One directory per user
    └── {project_id}/    # One directory per project
        ├── upload.docx  # Original uploaded file
        ├── output.tex   # Generated LaTeX file
        └── output.pdf   # Generated PDF file
```

## Implementation Plan

### Files to Create
1. `backend/user_projects/mock_files/mock.tex` - Simple 5-page LaTeX document with big page numbers
2. `backend/user_projects/mock_files/mock.pdf` - Compiled PDF from mock.tex

### Files to Edit
1. `backend/database.py`
   - Create new `Project` class
   - Add methods:
     - `__init__()` - initialize project fields
     - `insert()` - create new project entry
     - `find()` - find project by ID
     - `find_by_user()` - get all projects for a user
     - `update_status()` - update project status
     - Basic CRUD operations as needed

2. `backend/api_latext.py`
   - Import `Project` class and necessary modules (`os`, `shutil`, etc.)
   - Create helper functions:
     - `create_user_directory(user_id)` - create user's project directory if not exists
     - `create_project_directory(user_id, project_id)` - create specific project directory
     - `copy_mock_files(project_directory)` - copy mock .tex and .pdf to project directory
   - These will be used later for API endpoints

### No Frontend Integration
- This is backend-only work
- No changes to frontend components
- No API endpoints created yet (just helper functions for directory management)

## Status Field Values
- `'unconverted'` - File uploaded but not processed
- `'converted'` - LaTeX and PDF generated
- `'resolved'` - Conversion reviewed/finalized by user

---

# Mock API Update - Frontend Integration Plan

## Understanding of Requirements

### Current State Problems
1. **PreviewPage.tsx** - Hardcoded fake Nature paper content instead of showing actual generated PDF
2. **YourPapersPage.tsx** - Shows 3 duplicate placeholder papers "Extroversion In North American Chimpanzees" instead of real user projects
3. **ChooseTemplatePage.tsx** - All 8 template options are identical "Nature Communications" instead of variety

### Available Template Assets
From `frontend/public/`:
- `nature.svg` - Nature template
- `lancet.svg` - The Lancet template
- `springer.svg` - Springer template
- `elsevier.svg` - Elsevier template
- `ieee.svg` - IEEE template

## What Needs to Be Done

### 1. PreviewPage.tsx - Display Generated PDF
**Current:** Hardcoded Nature journal formatting text
**Target:** Display preview of the actual generated .pdf from the user's project

**Implementation:**
- Get project_id from URL parameter `/papers/{project_id}/view`
- Create API endpoint `GET /api/latex/project/{project_id}` to fetch project details
- Create API endpoint `GET /api/latex/project/{project_id}/pdf` to serve the PDF file
- Use PDF viewer component (like `react-pdf` or iframe) to display the PDF
- Keep the sidebar with satisfaction questions

### 2. YourPapersPage.tsx - Load Real User Projects
**Current:** Hardcoded array of 3 duplicate papers
**Target:** Fetch and display actual projects from database

**Implementation:**
- Create API endpoint `GET /api/latex/projects` that calls `Project.find_by_user(user_id)`
- On component mount, fetch user's projects via API
- Map project data to Paper interface:
  - `id` = project.project_id
  - `title` = extract from upload_filename (remove extension)
  - `date` = format project.created_at
  - `template` = capitalize project.template field
  - `thumbnail` = map template name to svg file (nature → /nature.svg)
  - `status` = map from project.status ('converted' → 'completed', 'unconverted' → 'processing')
- Handle empty state when user has no projects yet

### 3. ChooseTemplatePage.tsx - Diverse Template Options
**Current:** All 8 templates are "Nature Communications"
**Target:** Variety of templates matching available SVG assets

**Implementation:**
- Update templates array with variety:
  ```typescript
  { id: '1', name: 'Nature Communications', publisher: 'nature', year: '2025', thumbnail: '/nature.svg' }
  { id: '2', name: 'The Lancet', publisher: 'the lancet', year: '2025', thumbnail: '/lancet.svg' }
  { id: '3', name: 'Springer Journal', publisher: 'springer', year: '2025', thumbnail: '/springer.svg' }
  { id: '4', name: 'Elsevier Journal', publisher: 'elsevier', year: '2025', thumbnail: '/elsevier.svg' }
  { id: '5', name: 'IEEE Transactions', publisher: 'ieee', year: '2025', thumbnail: '/ieee.svg' }
  // Repeat or add more variations
  ```
- Store selected template when user clicks
- Pass template selection to next step in upload flow

### 4. Mock Upload API - Handle File Upload and Mock Conversion
**Current:** No upload functionality
**Target:** Accept file upload, create project, copy mock files

**Implementation:**
- Create API endpoint `POST /api/latex/upload` with `@requires_auth`
- Accept multipart/form-data with:
  - `file` - the uploaded .docx file
  - `template` - selected template name (from ChooseTemplatePage)
- Process:
  1. Generate unique `project_id` using `uuid.uuid4()`
  2. Create project directory: `user_projects/{user_id}/{project_id}/`
  3. Save uploaded file as `user_projects/{user_id}/{project_id}/upload.docx`
  4. Copy `mock_files/mock.tex` to `user_projects/{user_id}/{project_id}/output.tex`
  5. Copy `mock_files/mock.pdf` to `user_projects/{user_id}/{project_id}/output.pdf`
  6. Create Project database entry:
     - `project_id` = generated UUID
     - `user_id` = from authenticated user
     - `upload_filename` = original filename
     - `tex_filename` = 'output.tex'
     - `pdf_filename` = 'output.pdf'
     - `template` = selected template
     - `status` = 'converted' (since we're mocking, it's instantly "converted")
  7. Return project_id to frontend
- Frontend navigates to `/papers/{project_id}/view` after successful upload

### 5. Additional API Endpoints Needed

**GET /api/latex/projects** - List user's projects
- Requires authentication
- Call `Project.find_by_user(user_id)`
- Return array of project objects

**GET /api/latex/project/{project_id}** - Get single project details
- Requires authentication
- Verify project belongs to authenticated user
- Return project object

**GET /api/latex/project/{project_id}/pdf** - Serve PDF file
- Requires authentication
- Verify project belongs to authenticated user
- Use Flask's `send_file()` to serve the PDF from `user_projects/{user_id}/{project_id}/output.pdf`

**GET /api/latex/project/{project_id}/tex** - Download .tex file
- Requires authentication
- Verify project belongs to authenticated user
- Use Flask's `send_file()` to serve the .tex file

## Files to Edit

### Backend
1. `backend/api_latext.py`
   - Add all 5 API endpoints listed above
   - Import necessary modules: `send_file`, `secure_filename` from werkzeug
   - Add file upload handling logic
   - Add user verification logic for project access

### Frontend
1. `frontend/src/components/authenticated/YourPapersPage.tsx`
   - Remove hardcoded `papers` array
   - Add `useEffect` to fetch projects on mount
   - Add API call to `/api/latex/projects`
   - Map API response to Paper interface
   - Handle loading and empty states

2. `frontend/src/components/authenticated/PreviewPage.tsx`
   - Remove hardcoded Nature journal content
   - Get project_id from URL params using `useParams()`
   - Add `useEffect` to fetch project details
   - Replace document preview with PDF viewer (iframe or react-pdf)
   - API call to `/api/latex/project/{project_id}/pdf` for PDF URL

3. `frontend/src/components/authenticated/ChooseTemplatePage.tsx`
   - Update `templates` array with diverse options
   - Match templates to available SVG files
   - Store selected template in state
   - Pass template to upload API

4. `frontend/src/components/authenticated/NewPaperPage.tsx` (likely exists)
   - Add file upload handling
   - Add API call to `POST /api/latex/upload`
   - Navigate to preview page after successful upload

## Mock Behavior Summary
Since this is mock functionality:
- User uploads .docx file
- Backend saves uploaded file to project directory
- Backend immediately copies pre-made mock.tex and mock.pdf
- Project status is set to 'converted' instantly
- User can preview the mock 5-page PDF (with big numbers 1-5)
- User can download the mock .tex file
- All projects show the same mock output regardless of input file or template selection
- This simulates the future real conversion pipeline

---

# PDF Preview Restrictions - Free vs Verified Users

## Understanding of Requirements

### Business Logic
- **Anonymous users (is_verified=False)**: Get limited preview - first 3 pages only
- **Registered users (is_verified=True)**: Get full PDF access
- This is the "freemium" model - free users see a preview to encourage registration

### User Verification Status
- **is_verified=False**: Anonymous users (auto-created, no email verification)
- **is_verified=True**: Registered users (signed up with email)

### What Needs to Be Done

#### 1. Generate Preview PDF (First 3 Pages Only)
**Implementation:**
- Use PyPDF2 or PyMuPDF (fitz) library to extract first 3 pages from full PDF
- Create function `generate_pdf_preview(pdf_path, preview_path)` in `api_latext.py`
- Generate `preview_{project_id}.pdf` alongside `{project_id}.pdf`
- Call this function during upload process after copying mock.pdf

**Library choice:**
- PyPDF2: Simpler, pure Python
- PyMuPDF (fitz): Faster, more features
- Use PyPDF2 for simplicity since we're just extracting pages

**File structure:**
```
user_projects/{user_id}/{project_id}/
├── {project_id}.docx         # Original upload
├── {project_id}.tex           # Full LaTeX
├── {project_id}.pdf           # Full PDF (5 pages)
└── preview_{project_id}.pdf   # Preview PDF (3 pages only)
```

#### 2. Update Upload Endpoint
**Changes to `POST /api/latex/upload`:**
- After copying `{project_id}.pdf`, generate preview version
- Call `generate_pdf_preview(full_pdf_path, preview_pdf_path)`
- Store both files in project directory

#### 3. Update PDF Serving Endpoint
**Changes to `GET /api/latex/project/{project_id}/pdf`:**
- Check user's `is_verified` status from database
- **If is_verified=False**: Serve `preview_{project_id}.pdf` (3 pages)
- **If is_verified=True**: Serve `{project_id}.pdf` (full PDF)

**Logic:**
```python
@api_latext.route('/project/<project_id>/pdf', methods=['GET'])
@requires_auth
def get_pdf(user, data, project_id):
    # ... existing authentication and authorization checks ...

    # Check user verification status
    if user.get('is_verified', False):
        # Verified user - serve full PDF
        pdf_filename = project.get('pdf_filename', f'{project_id}.pdf')
    else:
        # Unverified/anonymous user - serve preview only
        pdf_filename = f'preview_{project_id}.pdf'

    pdf_path = os.path.join(USER_PROJECTS_DIR, str(project.get('user_id')), str(project_id), pdf_filename)

    # ... check file exists and serve ...
```

#### 4. Restrict .tex Downloads for Unverified Users
**Changes to `GET /api/latex/project/{project_id}/tex`:**
- Add verification check before serving file
- **If is_verified=False**: Return 403 Forbidden with message "Please register to download LaTeX source"
- **If is_verified=True**: Serve the .tex file as normal

**Logic:**
```python
@api_latext.route('/project/<project_id>/tex', methods=['GET'])
@requires_auth
def get_tex(user, data, project_id):
    # ... existing authentication and authorization checks ...

    # Check user verification status
    if not user.get('is_verified', False):
        return jsonify({'error': 'Please sign up to download LaTeX files'}), 403

    # ... serve the .tex file ...
```

## Files to Edit

### Backend
1. **`backend/api_latext.py`**
   - Add `import PyPDF2` or `import fitz` at top
   - Create `generate_pdf_preview(pdf_path, preview_path)` function
   - Update `upload_file()` endpoint to generate preview after copying PDF
   - Update `get_pdf()` endpoint to check `is_verified` and serve appropriate file
   - Update `get_tex()` endpoint to block unverified users

2. **`backend/requirements.txt`** (if exists)
   - Add `PyPDF2` or `PyMuPDF` dependency

## Expected Behavior After Implementation

### Anonymous User (is_verified=False)
1. Uploads file → gets project created
2. Views `/papers/{project_id}/view` → sees first 3 pages only
3. Tries to download .tex → gets 403 error "Please sign up to download LaTeX files"
4. Can still see their projects in "Your Papers" page

### Registered User (is_verified=True)
1. Uploads file → gets project created
2. Views `/papers/{project_id}/view` → sees all 5 pages
3. Downloads .tex → successfully downloads full LaTeX source
4. Full access to all features

## Frontend Changes (Optional)
- Could add messaging on preview page: "Sign up to see full PDF" for anonymous users
- Could disable/hide "Download .tex" button for anonymous users
- Could add overlay on page 3 saying "Register to see more"

## Testing Plan
1. As anonymous user: Upload → verify only 3 pages shown
2. As anonymous user: Try .tex download → verify 403 error
3. As registered user: Upload → verify all 5 pages shown
4. As registered user: Download .tex → verify success
5. Check that both `{project_id}.pdf` and `preview_{project_id}.pdf` exist in directory

---

# Preview Page UI/UX Improvements and Support Ticket System

## Understanding of Requirements

### Preview Page (/papers/{project_id}/view) Changes

#### 1. Remove "See your first 3 pages free" Box
**Current:** Box displaying this message
**Target:** Remove entirely

#### 2. Add Quality Feedback Section
**Below the PDF preview, add a box:**
- First line: "Are you happy with the quality of this formatting?"
- Second line (newline): "If not: submit a support ticket"
- Button: "Go to Support" - redirects to `/papers/{project_id}/support`

#### 3. Download Buttons Section
**Two separate boxes with aesthetic styling:**

**Box 1: File Downloads**
- Title: "Download as a .pdf or .tex here!"
- Two buttons: "Download PDF" and "Download .tex"
- These trigger actual downloads using existing API endpoints
- **No bifurcated styling:** Backend handles restrictions for unverified users

**Box 2: Package Download**
- Informational text: "Your download includes the main .tex file, bibliography file (.bib), all extracted images in appropriate formats, pdf, and a README with compilation instructions."
- Button: "Download Full Package"
- **NOT connected to API yet** - just placeholder for future functionality

### YourPapersPage (/papers) Changes

#### 4. Replace "Send" Button with "Support"
**Current:** Each paper card has three actions: "View", "Download .tex", "Send"
**Target:** Replace "Send" button with "Support" button
- Clicking "Support" navigates to `/papers/{project_id}/support`

### Database Changes

#### 5. New Ticket Class in database.py
**Purpose:** Track support tickets for user feedback/issues

**Fields:**
- `ticket_id` - Unique ticket identifier (UUID or auto-increment)
- `project_id` - Reference to the project this ticket is about
- `user_id` - Reference to the user who created the ticket
- `subject` - Subject line for the ticket (required field)
- `created_at` - Timestamp of ticket creation
- `status` - Ticket status: 'open', 'in_progress', 'resolved', 'closed'
- `messages` - Array of message objects, each containing:
  - `message_id` - Index/ID of message within ticket (0, 1, 2, ...)
  - `content` - The message text
  - `sender` - Who sent it: 'user' or 'admin'
  - `timestamp` - When the message was sent
  - `sender_id` - User ID or admin ID who sent the message

**Methods:**
- `__init__()` - Initialize ticket with project_id, user_id, subject, first message
- `insert()` - Create new ticket in database
- `find()` - Find ticket by ticket_id
- `find_by_project()` - Get all tickets for a specific project
- `find_open_ticket_by_project()` - Get open ticket for project (only 1 open at a time)
- `find_by_user()` - Get all tickets created by a user
- `add_message()` - Add a new message to the ticket's messages array (with spam prevention checks)
- `update_status()` - Change ticket status
- `count_user_messages_in_last_hour()` - Count messages from user in last 60 minutes (for rate limiting)

**Collection name:** `tickets`

**Spam Prevention Rules:**
1. **One open ticket per project:** Each project can only have 1 open ticket at a time (status='open' or 'in_progress')
   - User can create new ticket once previous ticket is 'resolved' or 'closed'
   - Enforced by checking `find_open_ticket_by_project()` before creating
2. **Message length limits:**
   - Minimum: 10 characters
   - Maximum: 2000 characters
3. **Rate limiting:** User can send maximum 5 messages per hour (counted across all messages in the ticket where sender='user')
   - Does NOT apply to admin messages
   - Enforced by `count_user_messages_in_last_hour()` before adding message
4. **Subject line requirement:**
   - Required when creating new ticket
   - Minimum: 5 characters
   - Maximum: 30 characters

### New Support Page Component

#### 6. Create SupportPage.tsx Page
**Route:** `/papers/{project_id}/support`

**Layout and Functionality:**

**Page Structure:**
Similar aesthetic to YourPapersPage with ticket management interface.

**Top Section:**
- Header: "Support Tickets for [Project Name/Title]"
- Informational text: "You can create multiple support tickets for this project. Only one ticket can be open at a time."
- Button: "Create New Ticket" (opens ticket creation form)
  - Only enabled if no open tickets exist
  - If open ticket exists, show message: "Please close your current open ticket before creating a new one"

**Ticket Creation Form** (shown when "Create New Ticket" clicked):
- Subject line input (5-30 characters, required)
- Message text area (10-2000 characters, required)
- Submit button
- Cancel button (closes form)
- **Validation:** Only verified users can submit (401 if not verified)
- **On success:** Create ticket, refresh page to show new ticket

**Tickets List Section:**
Display all tickets for this project (similar to paper cards in YourPapersPage):
- Each ticket shown as a card with:
  - Subject line (large, bold)
  - Status badge with color coding:
    - 'open' - Blue/primary color
    - 'in_progress' - Yellow/warning color
    - 'resolved' - Green/success color
    - 'closed' - Gray/muted color
  - Created date
  - Message count (e.g., "5 messages")
  - Click to expand/view ticket details

**Individual Ticket View** (when ticket card clicked):
- Expandable or navigate to `/papers/{project_id}/support/{ticket_id}`
- Show full conversation history:
  - Message bubbles styled differently for user vs admin
  - User messages: Left-aligned, lighter background
  - Admin messages: Right-aligned, darker/accent background
  - Each message shows: sender name, timestamp, content
- Add message section at bottom (if ticket is open/in_progress):
  - Text area for new message
  - Character count indicator (10-2000)
  - Submit button
  - Rate limit warning if approaching 5 messages/hour
- If ticket is resolved/closed: Show "This ticket is closed" message, no input

**Empty State:**
If no tickets exist yet:
- Show message: "No support tickets yet"
- Prominent "Create Your First Ticket" button

## Implementation Plan

### Backend Changes

1. **`backend/database.py`**
   - Create new `Ticket` class with all fields and methods listed above
   - Implement message array structure within tickets
   - Add timestamp handling

2. **`backend/api_latext.py`**
   - Add endpoint `POST /api/latex/project/{project_id}/support`
     - Requires auth with `is_verified=True` check
     - Accepts `subject` and `message` in request body
     - **Spam prevention checks:**
       - Validate subject length (5-30 characters)
       - Validate message length (10-2000 characters)
       - Check no open ticket exists for this project (`find_open_ticket_by_project()`)
       - If open ticket exists, return 400 Bad Request with error message
     - Creates new Ticket entry in database with initial message
     - Returns ticket_id
   - Add endpoint `GET /api/latex/project/{project_id}/tickets`
     - Returns all tickets for a project (ordered by created_at desc)
     - Includes ticket metadata and message count (not full messages)
   - Add endpoint `GET /api/latex/ticket/{ticket_id}`
     - Returns full ticket details with all messages
     - Verify ticket belongs to authenticated user's project
   - Add endpoint `POST /api/latex/ticket/{ticket_id}/message`
     - Add a message to an existing ticket
     - Requires auth with `is_verified=True` check
     - **Spam prevention checks:**
       - Validate message length (10-2000 characters)
       - Count user messages in last hour, reject if >= 5
       - Check ticket status is 'open' or 'in_progress' (can't message closed tickets)
     - Adds message to ticket's messages array
     - Returns updated ticket

### Frontend Changes

1. **`frontend/src/components/authenticated/PreviewPage.tsx`**
   - Remove "See your first 3 pages free" box
   - Add quality feedback section with text and "Go to Support" button
   - Add two download boxes:
     - Box 1: Download .pdf and .tex buttons (connected to existing APIs)
     - Box 2: Package download info with placeholder button
   - "Go to Support" button navigates to `/papers/{project_id}/support`

2. **`frontend/src/components/authenticated/YourPapersPage.tsx`**
   - Change "Send" button to "Support" button
   - Update click handler to navigate to `/papers/{project_id}/support`

3. **`frontend/src/components/authenticated/SupportPage.tsx`** (NEW FILE)
   - Implement full support ticket management interface as described above
   - Top section: Header, info text, "Create New Ticket" button
   - Ticket creation form: Subject input (5-30 chars), message textarea (10-2000 chars)
   - Tickets list: Display all tickets with status badges, created date, message count
   - Individual ticket view: Expandable conversation with message bubbles
   - Add message functionality: Textarea with character counter and submit
   - Handle all API calls (create ticket, fetch tickets, add message)
   - Empty state handling
   - Status badge color coding
   - Rate limit warnings

4. **`frontend/src/App.tsx`**
   - Add new route: `<Route path="/papers/:id/support" element={<SupportPage />} />`
   - Optionally add route for individual ticket view: `<Route path="/papers/:id/support/:ticketId" element={<SupportPage />} />`

### Files to Create

1. `frontend/src/components/authenticated/SupportPage.tsx`
2. `frontend/src/components/authenticated/SupportPage.css`

### Files to Edit

1. `backend/database.py` - Add Ticket class
2. `backend/api_latext.py` - Add support ticket endpoints
3. `frontend/src/components/authenticated/PreviewPage.tsx` - UI improvements
4. `frontend/src/components/authenticated/PreviewPage.css` - Styling for new sections
5. `frontend/src/components/authenticated/YourPapersPage.tsx` - Button change
6. `frontend/src/App.tsx` - Add support route

## Expected Behavior After Implementation

### Preview Page Experience
1. User views their converted paper
2. Sees PDF preview (3 pages for anonymous, full for verified)
3. Below PDF: sees quality feedback question
4. Can submit support ticket if verified (gets 401 if not)
5. Can download .pdf and .tex files using prominent buttons
6. Sees information about full package download (button not yet functional)

### Support Ticket Flow (Verified Users)
1. User types message in text area on preview page
2. Clicks submit
3. Backend creates Ticket with initial message
4. User redirected to `/papers/{project_id}/support`
5. Can view their ticket and message history
6. (Future: Admin can respond, user can reply)

### Your Papers Page
1. Each paper shows "Support" button instead of "Send"
2. Clicking navigates to support page for that project

## Admin Functionality (Future Implementation)
- Admin dashboard to view all open tickets
- Admin can respond to tickets (adds message with sender='admin')
- Admin can change ticket status
- Email notifications for ticket updates
- This will be implemented in a later phase