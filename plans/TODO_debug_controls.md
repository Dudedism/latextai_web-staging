# TODO: Refactor Admin Debug Controls to Dev-Only Query Params

Replace the `isAdmin`-gated debug buttons on PreviewPage with dev/staging-only dropdown controls gated behind `VITE_DEBUG_CONTROLS`. Mock logic doesn't ship to production builds.

---

## Context

The PreviewPage has admin debug controls (mock buttons) that set component state to test different UI states. Currently these:
- Are gated behind `isAdmin` (requires a database flag)
- Ship mock code (state vars, mock data, apply/reset functions) to all users
- Pollute the production component with `mockAnonymous`, `effectiveAnonymous`, etc.

The new approach uses `import.meta.env.VITE_DEBUG_CONTROLS === 'true'` which is set in `.env.development` and `.env.staging` but NOT in `.env.production`. Vite tree-shakes the dead branch in production builds.

## Current state

- `VITE_DEBUG_CONTROLS` env var already added to `.env.development`, `.env.staging`, and `vite-env.d.ts`
- Mock state variables (`mockAnonymous`, `mockDocStatus`, `mockCompilation`, `mockUserState`, `effectiveAnonymous`) already added to PreviewPage
- `applyMock()` and `resetMock()` functions already added
- `isAnonymous` already replaced with `effectiveAnonymous` in render JSX (3 places)
- Old 4-button admin debug section still in PreviewPage (needs replacing)

---

# Phase 1: Replace admin debug buttons with dropdown controls

- [x] Replace the admin debug controls JSX with dropdown-based mock controls

  Replace the `{isAdmin && (...)}` section (4 buttons) with `{import.meta.env.VITE_DEBUG_CONTROLS === 'true' && (...)}` containing:
  - **Document Status** dropdown: Completed, Needs Payment, Processing, Failed
  - **Compilation** dropdown (disabled unless doc status = Completed): Success, Failed
  - **User State** dropdown: Anonymous Preview, Free Upload, Has Credits, Low Credits, Paid
  - Apply Mock button → calls `applyMock()`
  - Reset button → calls `resetMock()`
  Use existing `.form-select`, `.form-label`, `.btn--sm` classes. Compact inline layout.

- [x] Remove `isAdmin` from the useAuth destructure if no longer used elsewhere in PreviewPage

  After switching the gate to `VITE_DEBUG_CONTROLS`, check if `isAdmin` is still referenced anywhere in PreviewPage. If not, remove it from the destructure on the `useAuth()` line to keep imports clean.

# Phase 2: Cleanup

- [x] Verify TypeScript compiles cleanly

  Run `npx tsc --noEmit` and fix any type errors.

- [x] Verify production build tree-shakes the debug code

  Run `npm run build` and confirm no mock data or debug control strings appear in the output bundle. The `VITE_DEBUG_CONTROLS` check should cause Vite/Rollup to eliminate the entire block.
