# Phase 1: Bug Fixes

- [ ] Fix uncaught error in AccountPage password reset

  `frontend/src/components/authenticated/AccountPage.tsx` lines 129-147 — `handlePasswordResetConfirm` throws an error on API failure but nothing catches it. The modal doesn't close and the user gets no feedback. Wrap in try-catch:
  ```typescript
  const handlePasswordResetConfirm = async () => {
    try {
      const response = await fetch(...);
      if (!response.ok) {
        const data = await response.json();
        // Show error to user via modal or state
        setErrorMessage(data.error || 'Failed to send password reset email');
        return;
      }
      // Success — close modal, show confirmation
      setShowPasswordResetModal(false);
    } catch (error) {
      setErrorMessage('Network error. Please try again.');
    }
  };
  ```

- [ ] Fix silent error in ConsentModal

  `frontend/src/components/authenticated/ConsentModal.tsx` lines 41-54 — `handleDecline` calls `onConsent(false)` and `onClose()` even when the API call fails. The user thinks consent was saved but it wasn't. Show an error message before closing, or retry.

- [ ] Fix race condition in PaymentPage setup_success flow

  `frontend/src/components/authenticated/PaymentPage.tsx` lines 51-59 — uses a `claimingRef` to prevent double execution, which is an anti-pattern. Two separate `useEffect` hooks both check `setup_success`. Consolidate into a single useEffect that handles the entire flow:
  ```typescript
  useEffect(() => {
    const setupSuccess = searchParams.get('setup_success');
    if (setupSuccess === 'true' && projectId) {
      claimFreeAfterSetup();
      return; // Don't fetch payment details
    }
    if (projectId) {
      fetchPaymentDetails();
    }
  }, [projectId, searchParams]);
  ```
  Remove the ref-based guard entirely.

- [ ] Fix stale useEffect dependency in NewPaperPage

  `frontend/src/components/authenticated/NewPaperPage.tsx` lines 31-38 — useEffect depends on `location.state` but has an empty dependency array `[]`. If `location.state` changes (e.g., navigating back with new state), the effect won't re-run. Add `location` to the dependency array:
  ```typescript
  }, [location]);
  ```

# Phase 2: Error Handling Improvements

- [ ] Type error objects properly in PaymentPage

  `frontend/src/components/authenticated/PaymentPage.tsx` lines 202-210 — catch block accesses `error.status` and `error.requires_topup` without validation:
  ```typescript
  } catch (error: any) {
    if (error.status === 402 && error.requires_topup) {
  ```
  Type the error properly and validate its shape before accessing properties:
  ```typescript
  } catch (error: unknown) {
    const err = error as { status?: number; requires_topup?: boolean; message?: string };
    if (err.status === 402 && err.requires_topup) {
      navigate('/credits');
    } else {
      setErrorStatusCode(err.status);
      setErrorMessage(err.message || 'Failed to process document');
      setShowErrorModal(true);
    }
  }
  ```

- [ ] Standardize API calls to use apiRequest everywhere

  `SignInPage.tsx` uses raw `fetch()` for signup and password reset instead of the `apiRequest()` utility. This bypasses any centralized headers, interceptors, or error handling. Replace direct `fetch()` calls with `apiRequest()` where appropriate (note: auth endpoints that don't need a token may legitimately use raw fetch — evaluate case by case).

- [ ] Sanitize error messages shown to users

  Multiple components display backend error messages directly to users (e.g., `alert(\`Failed to delete account: ${error.message}\`)`). Backend errors may leak implementation details. Show generic messages for unexpected errors; only display specific messages for validation errors the user can act on (wrong password, invalid email, etc.).

# Phase 3: React Best Practices

- [ ] Replace direct DOM manipulation in SignInPage Google button

  `frontend/src/components/static/SignInPage.tsx` lines 56-119 — the Google OAuth button is initialized via `document.getElementById()` and `container.innerHTML = ''`, which bypasses React's DOM management. Replace with a ref:
  ```typescript
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (googleButtonRef.current && window.google?.accounts) {
      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleButtonRef.current, {...});
    }
  }, [authMode]);
  ```
  Also remove the hardcoded `setTimeout(100)` — use a callback or MutationObserver if timing is needed.

- [ ] Remove unreachable code in SignInPage

  `frontend/src/components/static/SignInPage.tsx` lines 316-331 — the else branch checking for `authMode === 'password-reset'` is unreachable because `authMode` is typed as `'signin' | 'signup'`. Either:
  - Remove the dead code, or
  - If password-reset mode is intended, add `'password-reset'` to the type union

- [ ] Fix redundant API calls in NewPaperPage consent flow

  `frontend/src/components/authenticated/NewPaperPage.tsx` lines 87-116 — `handleTemplateSelect` checks consent status via GET, then ConsentModal makes its own POST when the user confirms. The GET check is fine, but the flow passes through multiple components redundantly. Simplify so ConsentModal receives the pending action and executes it after consent is saved, rather than having the parent re-check after modal closes.
