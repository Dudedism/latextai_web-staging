# Session Reading List

Files to read at the start of a new session to catch up on context.

## Specs & Plans
- `plans/anonymous_feature_spec.md` — Complete specification for the anonymous user feature (12 sections: accounts, upload flows, preview system, download tiering, payment changes, merge/tuck-away, verification, anti-abuse, pipeline changes, env config, database changes, old implementation reference)
- `plans/TODO_anonymous_feature.md` — TODO checklist for anonymous feature implementation
- `plans/TODO_payment_ui_redesign.md` — Payment UI redesign: invoice card on PreviewPage + CreditTopUpPage query params (5 user states, CSS additions, full spec)
- `plans/design_idea_payment.png` — Visual mockup of the invoice card design

## Key Backend Files
- `backend/api_project.py` — Upload, validate, project CRUD, payment-details endpoints
- `backend/api_latext.py` — Process endpoint, _upgrade_preview(), download endpoints (PDF/tex/bib/package)
- `backend/api_auth.py` — Auth routes, requires_auth decorator, anonymous endpoint, signup merge, login tuck-away, Google OAuth merge
- `backend/database.py` — User, Project, CreditTransaction models, merge_anonymous_into, transfer_to_user

## Key Frontend Files
- `frontend/src/components/authenticated/PreviewPage.tsx` — Document viewing, download buttons, payment/upgrade CTAs, status polling (being redesigned per TODO_payment_ui_redesign.md)
- `frontend/src/components/authenticated/CreditTopUpPage.tsx` — Credit purchase page, Stripe checkout (being updated to accept query params)
- `frontend/src/components/authenticated/UploadConfirmPage.tsx` — Upload confirm with reCAPTCHA v2, loading stages, auto-process for previews
- `frontend/src/components/authenticated/NewPaperPage.tsx` — File picker + template selection
- `frontend/src/components/authenticated/YourPapersPage.tsx` — User's project list
- `frontend/src/components/authenticated/AccountPage.tsx` — Account settings, anonymous guest session UI
- `frontend/src/contexts/AuthContext.tsx` — Auth state, anonSpawn, login/logout, token management
- `frontend/src/App.tsx` — Routing, NO_ANON_ROUTES, anonSpawn trigger
