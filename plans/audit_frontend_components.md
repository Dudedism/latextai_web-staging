# Frontend Components Audit Findings

Audit of frontend component changes pulled to staging on 2026-02-19.

Files reviewed: `AuthContext.tsx`, `SignInPage.tsx`, `PaymentPage.tsx`, `AccountPage.tsx`, `NewPaperPage.tsx`, `YourPapersPage.tsx`, `vite-env.d.ts`

---

## Critical

### Tokens Stored in localStorage

`AuthContext.tsx` lines ~148-149. Access and refresh tokens stored in plain `localStorage`:
```typescript
localStorage.setItem('token', data.access_token);
localStorage.setItem('refreshToken', data.refresh_token);
```

Any XSS vulnerability would expose all tokens. localStorage is accessible from any script on the page.

- [ ] Switch to HttpOnly cookies for token storage (requires backend changes to set cookies)
- [ ] If localStorage is required, implement additional measures like token encryption

### OAuth Tokens Exposed via URL Fragment

`AuthContext.tsx` lines ~73-99. OAuth callback extracts tokens from the URL hash:
```typescript
const accessToken = params.get('access_token');
const refreshToken = params.get('refresh_token');
```

The `window.history.replaceState` cleanup runs after extraction, but tokens were already in browser history.

- [ ] Backend should exchange authorization code for tokens server-side, then set HttpOnly cookies
- [ ] Consider PKCE flow for OAuth

### Hardcoded Google OAuth Client ID

`SignInPage.tsx` line ~99:
```typescript
client_id: '720160772474-jrdbco5ieojmvg83sr1juo3kineasj20.apps.googleusercontent.com',
```

Hardcoded in source code instead of using environment variables.

- [ ] Move to `import.meta.env.VITE_GOOGLE_CLIENT_ID`
- [ ] Add actual value to `.env.local` (already gitignored)

---

## High

### Uncaught Error in Password Reset Handler

`AccountPage.tsx` lines ~129-147. `handlePasswordResetConfirm` throws an error that is never caught:
```typescript
const handlePasswordResetConfirm = async () => {
  const response = await fetch(...);
  if (!response.ok) {
    throw new Error(data.error || '...');  // thrown but never caught
  }
};
```

This will crash the component. Modal doesn't close on error. User gets no feedback.

- [ ] Add try-catch block
- [ ] Show error feedback to user
- [ ] Close modal or show retry option after error

### Race Condition in PaymentPage setup_success Flow

`PaymentPage.tsx` lines ~51-59, ~105-139. Two `useEffect` hooks both check `setup_success`. Uses a `claimingRef` to prevent double-execution, which is an anti-pattern:
```typescript
if (setupSuccess === 'true' && projectId && !claimingRef.current) {
  claimingRef.current = true;
  claimFreeAfterSetup();
}
```

- [ ] Consolidate into a single useEffect that handles the full flow
- [ ] Remove the ref-based guard

### ConsentModal Silently Swallows Errors

`ConsentModal.tsx` lines ~41-54. `handleDecline` calls `onConsent(false)` and `onClose()` even when the API call fails. User thinks consent was saved, but it wasn't.

- [ ] Show error feedback before closing
- [ ] Ask user to retry on failure

### Untyped Error Handling in Payment Flow

`PaymentPage.tsx` lines ~202-210. Assumes error object has `requires_topup` property without validation:
```typescript
if (error.status === 402 && error.requires_topup) {
```

- [ ] Type the error properly
- [ ] Validate error structure before accessing properties

---

## Medium

### Missing useEffect Dependency

`NewPaperPage.tsx` lines ~31-38. useEffect depends on `location.state` but has an empty dependency array:
```typescript
useEffect(() => {
  const state = location.state as { file?: File; returnToTemplate?: boolean } | null;
  // ...
}, []);  // should include location
```

If `location.state` changes, the effect won't re-run.

- [ ] Add `location` to the dependency array

### Direct DOM Manipulation for Google OAuth Button

`SignInPage.tsx` lines ~56-119. Google sign-in button initialized via direct DOM manipulation:
```typescript
const container = document.getElementById('google-signin-container');
if (container && window.google?.accounts) {
  container.innerHTML = '';  // bypasses React
  window.google.accounts.id.renderButton(container, {...});
}
```

Uses `setTimeout(100)` which is fragile and could cause flickering.

- [ ] Use React refs instead of `getElementById()`
- [ ] Check if button already exists before clearing
- [ ] Remove arbitrary setTimeout or handle loading state properly

### Password Sent via Direct fetch() Instead of apiRequest()

`SignInPage.tsx` lines ~132-164. Signup and password reset use raw `fetch()` instead of the centralized `apiRequest()` utility, bypassing any interceptors or headers.

- [ ] Use `apiRequest()` for all API calls for consistency
- [ ] Ensure all sensitive endpoints go through the same path

### Over-Detailed Error Messages Shown to Users

`PaymentPage.tsx`, `AccountPage.tsx`, multiple places. Backend error responses are displayed directly:
```typescript
alert(`Failed to delete account: ${error.message || 'Unknown error'}`);
```

Backend errors may leak implementation details.

- [ ] Log detailed errors to console
- [ ] Show generic user-friendly messages
- [ ] Only display specific messages for validation errors

---

## Low

### Unreachable Code in SignInPage

`SignInPage.tsx` lines ~316-331. The else branch checking for `authMode === 'password-reset'` is unreachable because `authMode` is typed as `'signin' | 'signup'`:
```typescript
{authMode === 'signin' ? (...) : authMode === 'signup' ? (...) : (
  // This branch can never execute
)}
```

- [ ] Remove unreachable code or add 'password-reset' to the authMode type if intended

### Verification Status Cache Consistency

`AuthContext.tsx` lines ~43-67, ~106-126. `refreshVerificationStatus` silently fails on network errors. Verification status could be out of sync between localStorage and React state.

- [ ] Add error state to track refresh failures
- [ ] Provide method to manually refresh verification status

### Redundant API Calls in NewPaperPage

`NewPaperPage.tsx` lines ~87-116. `handleTemplateSelect` checks consent status with a GET request, then `ConsentModal` makes its own POST request. This doubles the API calls.

- [ ] Simplify the consent flow to avoid redundant calls

---

## Positive Findings

- Token refresh interceptor (`fetchInterceptor.ts`) properly handles 401 errors with concurrent refresh prevention
- The `isRefreshing` flag and queued retry pattern is well-implemented
- Auth endpoints are correctly excluded from auto-refresh
