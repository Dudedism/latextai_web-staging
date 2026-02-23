# LatextAI Website (latext-site) Project Overview

Web application for the LatextAI document conversion service. Users sign up, upload Word documents, select a journal template, pay or use free credits, and receive professionally formatted LaTeX PDFs.

The site consists of a Flask/Python backend (REST API, authentication, Stripe payments, MongoDB) and a React/TypeScript/Vite frontend (SPA with routing, OAuth, payment flows).

The backend handles user auth (email/password + Google OAuth), email verification, credit management, Stripe checkout/webhooks, and proxies document processing to the separate LatextAI pipeline service. The frontend handles the user-facing flows: sign-in, paper upload, payment, account management.

Core flow: Sign up > Upload DOCX + select template > Pay (credits or Stripe) > Backend sends to pipeline service > Download PDF.

## TODO Plans

TODO files in `plans/` guide autonomous development. Follow them, but they may contain inconsistencies, inaccuracies, or contradictions. When encountered, interpret the overall goal and work out a solution rather than getting stuck or blindly following conflicting instructions.

If a planned solution is fundamentally impossible or you are confident it is suboptimal, brainstorm and explore your own approach. You may modify the TODO file itself to reflect a better solution. Document your reasoning in a note (see Notes and Context Persistence) explaining what was wrong with the original plan and why your approach is better.

### TODO File Formatting

- Phases are headers (e.g., `# Phase 1: Brief description`)
- Tasks are checkboxes: `- [ ]` (unchecked) and `- [x]` (done)
- Explanations go under each task as indented paragraphs
- Ralph loops use checkboxes for state tracking

# LatextAI Website Coding Standards

**Note:** If user requests conflict with these standards, notify the user of the conflict before proceeding.

## Context7 MCP

Always use Context7 MCP when library/API documentation is needed for clarification of functionality, code generation, setup or configuration steps. Do this especially for obscure or very new tools/libraries.

## Development Environment

The project lives at `~/Desktop/data/major/latext/latext-site`. Two sub-projects:

**Backend:**
```bash
cd ~/Desktop/data/major/latext/latext-site/backend
source venv/bin/activate  # if virtual environment exists
python app.py
```
The backend runs on port 8000 by default. Uses `.env.development` for local config.

**Frontend:**
```bash
cd ~/Desktop/data/major/latext/latext-site/frontend
npm run dev
```
The frontend dev server runs on port 5173 by default (Vite).

## Autonomous Mode Restrictions

When running autonomously on the cloud server, these restrictions are enforced:

**Blocked git commands:**
- `git remote` (do not modify remotes)
- `git merge` / `git rebase` into protected branches (main, master)

**Allowed git commands:**
- `git add`, `git commit`, `git status`, `git diff`, `git branch`, `git checkout`
- `git push`, `git pull`, `git fetch`

Use the GitLab access token in `$GITLAB_ACCESS_TOKEN` for authentication. Protected branches (main, master) are enforced server-side, so pushes to them will be rejected.

**Other restrictions:**
- No `sudo` commands
- Never read or modify `.env.production`
- Never use production environment in development, use `.env.staging` or `.env.development`
- Work on the `staging` branch (or feature branches off staging), never commit directly to main/master

**Database access:**
- `.env.development` / `.env.staging` contain MongoDB URIs for development and staging
- Do not delete any users, projects, or other entries in any collections, unless you created them temporarily for testing and want to clean them up.

**System and environment:**
- Do not aggressively delete files to clear up space on the system.
- Update requirements.txt (backend) and package.json (frontend) as you go with new added libraries.

**Sub-agents:**
- Be generous when deploying sub-agents for tasks. Especially if they would benefit from parallelism.
- Always use Opus or Sonnet for sub-agents, never Haiku.

**Ralph loop behavior:**

When running in a Ralph loop with a TODO list:
- Read the specified TODO file at the start of each iteration
- Find the first unchecked task (`- [ ]`)
- Complete that task fully before marking it done
- Mark the task done (`- [x]`) only after verifying it works
- Commit your changes
- If all tasks are checked, output `<promise>DONE</promise>` to signal completion
- If you cannot complete a task after reasonable effort, add a note explaining why and move to the next task
- Do not skip tasks or mark them done without completing them

**Telegram notifications:**

Send notifications via the Telegram bot at these points:
- When starting a TODO: "Starting [TODO filename]. [N] tasks to complete."
- After completing a task: "Completed: [task name]. Moving to next."
- When stuck on a task: "Stuck on: [task name]. [One line reason]. Moving on."
- When all tasks are done: "All tasks complete on [branch name]."
- When forced to stop (missing dependency, permission issue, unresolvable blocker): "STOPPED: [one line reason]. Roadblock summary written to notes directory."
- When deviating from the plan (impossible or suboptimal solution): "DEVIATING: [task name]. [One line reason]. See notes for details."

When forced to stop, before ceasing work:
1. Write a roadblock summary to `../conductor_notes_and_context/latext-site/` (e.g., `roadblock_stripe_2026-02-19-14-30-00.md`). Include: what task was in progress, what the blocker is, what was already completed, and what remains.
2. Send the Telegram notification.
3. Then stop.

Send notifications with POST (do not use query string parameters, they break on special characters):
```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" -d "chat_id=${TELEGRAM_CHAT_ID}" -d "text=<MESSAGE>"
```

If messaging fails, debug the issue (check token format, connectivity, response body) before moving on.

Bot token and chat ID are in environment variables `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

**Workflow:**
- Work on the `staging` branch (or feature branches)
- Commit and push to `staging`
- Human reviews and merges into protected branches

**Commit messages:**
- Never mention that Claude/AI did the work
- Just write a normal commit message describing the change

## Code Philosophy
- Keep code minimal and clean
- Simple, clear designs over clever abstractions
- Modular but not ridiculous
- Let components fail loudly when they should never fail
- Don't implement excessive error checking and fallbacks
- Never keep legacy/backwards-compatibility code when refactoring. If changing functionality, remove the old code entirely. Migration scripts handle existing data.

## Code Architecture

### Backend

Key files and their purpose:
- `app.py`: Flask application entry point, CORS, rate limiter, route registration
- `api_auth.py`: Authentication routes — signup, login, verify, Google OAuth, password reset, account deletion, token refresh
- `api_latext.py`: Document processing routes — upload, process (free/credit/Stripe), project management, credit operations
- `database.py`: MongoDB models — User, Project, CreditTransaction collections with class methods
- `.env.development` / `.env.staging`: Environment config (MongoDB URI, Stripe keys, Brevo API key, Google OAuth, etc.)

### Frontend

Key files and their purpose:
- `src/contexts/AuthContext.tsx`: Authentication state management — login, logout, token storage, OAuth callback handling, verification status
- `src/components/static/SignInPage.tsx`: Sign-in/sign-up/password-reset UI with Google OAuth
- `src/components/authenticated/PaymentPage.tsx`: Stripe checkout and credit payment flows
- `src/components/authenticated/YourPapersPage.tsx`: User's project list and download
- `src/components/authenticated/NewPaperPage.tsx`: Document upload + template selection
- `src/components/authenticated/AccountPage.tsx`: Account settings, data consent, password reset, account deletion
- `index.html`: Entry point with meta tags, favicons, analytics
- `public/site.webmanifest`: PWA manifest

## Frontend Error Handling

- Error modals exist in the frontend for displaying errors to users
- Use the existing error modal system instead of inline error messages
- Don't show raw "Internal Server Error" text in components

## IMPORTANT: No Stupid Wrapper Functions
- DO NOT wrap simple 1-line built-in functions
- Example of what NOT to do:
  ```typescript
  // ❌ STUPID - Don't do this
  function getProjectOutputDir(projectPath: string): string {
    return join(projectPath, 'output');
  }

  // ✅ GOOD - Just use join() directly
  const outputDir = join(projectPath, 'output');
  ```
  ```python
  # ❌ STUPID - Don't do this
  def generate_user_hash(email):
      return hashlib.sha256(email.lower().encode('utf-8')).hexdigest()

  # ✅ GOOD - Just use hashlib directly where needed
  user_hash = hashlib.sha256(email.lower().encode('utf-8')).hexdigest()
  ```
- Only create utilities for complex or frequently repeated logic
- If it's just calling one function, use that function directly

## Notes and Context Persistence

All AI-generated notes go in `../conductor_notes_and_context/latext-site/` (one level up from the project root). This directory serves as persistent memory across sessions. Write to it for:

- **Ideas and improvements**: If you get an idea for improving functionality unrelated to the current task, write it to `ideas_<task>_<yyyy-mm-dd-HH-MM-SS>.md`.
- **Weird errors or anomalies**: Log unexpected behavior to `anomalies_<task>_<yyyy-mm-dd-HH-MM-SS>.md`.
- **Roadblock summaries**: When forced to stop, write a `roadblock_<task>_<yyyy-mm-dd-HH-MM-SS>.md` with full context (see Telegram notifications section).
- **Session handoff**: When ending a session (for any reason), write a `handoff_<task>_<yyyy-mm-dd-HH-MM-SS>.md` describing: current progress, what's done, what's in progress, next steps, and any context the next session would need to continue.

**Proactive note-taking**: Don't wait until the end of a session to write notes. As you work, write down:
- Strange behaviors or bugs that need further investigation but aren't blocking the current task
- Feature ideas or improvements that come up during development
- Anything that should go into a future TODO list

Write a **handoff summary** whenever finishing a set of tasks or ending a session, even if all tasks are complete. The next session needs context on what was done and what was observed.

Check this directory at the start of each session for context left by previous sessions.

## Testing Standards

### Test Types
- All tests are integration tests that hit the actual API via HTTP requests
- Tests require: Flask backend running, MongoDB running, `BACKEND_URL` env var set
- No mocking of external dependencies

### Test Structure
Tests are located in `backend/tests/` and use pytest.

```bash
# Run all tests
BACKEND_URL=http://localhost:8000 pytest tests/ -v -s

# Run specific test file
BACKEND_URL=http://localhost:8000 pytest tests/test_user_creation.py -v -s
```

### Fixture Pattern
Each test file uses a module-scoped fixture for user setup/teardown:

```python
@pytest.fixture(scope="module")
def test_user():
    with app.app_context():
        user = create_test_user(
            is_verified=True,
            mongo_db=mongo.db,
            base_url=BASE_URL
        )
        yield user
        delete_test_user(user['email'], mongo.db)
```

### Consistent Cleanup with try/finally
Tests that create resources (projects, transactions, etc.) MUST use try/finally to ensure cleanup happens even if assertions fail:

```python
def test_something(test_user):
    project_id = None
    try:
        # Create resource
        response = requests.post(f"{BASE_URL}/api/latex/upload", ...)
        project_id = response.json()['project_id']

        # Assertions
        assert response.status_code == 200
        assert ...

    finally:
        # Cleanup runs even if assertions fail
        if project_id:
            with app.app_context():
                mongo.db.projects.delete_one({'project_id': project_id})
```

### Test Cleanup Helper
Use `delete_test_user()` from `test_utils.py` for comprehensive cleanup. It deletes by both `user_email` and `user_id` to catch orphaned records:

```python
from tests.test_utils import create_test_user, delete_test_user
```

### Hard Delete vs Orphan in Tests
For test cleanup, use hard deletes (direct mongo operations), not the production `delete_with_files()` which orphans records:

```python
# Test cleanup - hard delete
mongo.db.projects.delete_one({'project_id': project_id})

# NOT this - production code that orphans
Project.delete_with_files(project_id, user_email)
```
