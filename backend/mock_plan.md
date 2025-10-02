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