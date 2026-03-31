-- Seed Knowledge Base
-- Auto-generated from docs/ folder
-- Run this script to populate rag.kb_documents

SET search_path TO rag;

-- Clear existing documents
DELETE FROM kb_documents;

-- Insert knowledge base documents
INSERT INTO kb_documents (area, title, content, file_path) VALUES
    ('login_auth', 'Authentication Flows', '---
name: authentication-flows
description: Auth flows, session management, Supabase Auth integration, and troubleshooting
area: 05
maintained_by: auth-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Authentication Flows

## Overview

The authentication system is built on Supabase Auth and exposes a React context API (`AuthContext`) to all components. Every user-facing auth operation — login, registration, logout, password reset — flows through this abstraction layer, which in turn delegates to the `supabaseAuth` helper defined in `src/lib/supabase.ts`.

The system uses the `useI18n` hook to translate all user-facing strings, with translation keys defined under the `auth` namespace in:
- `src/locales/modules/auth/en-us/auth.ts` (English)
- `src/locales/modules/auth/pt-br/auth.ts` (Portuguese)

---

## AuthContext Implementation

### Location

`src/contexts/AuthContext.tsx`

### Interface

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
}
```

### Initialization Flow

On application mount, `AuthProvider` performs two operations in parallel:

1. **Session check** — calls `supabaseAuth.getSession()` to restore any existing session from storage (Supabase stores the session token in localStorage automatically). The result populates `user` state. If this call throws, the error is caught and `loading` is set to `false` so the app does not hang.

2. **Auth state listener** — registers a subscription via `supabaseAuth.onAuthStateChange()`. This listener fires whenever Supabase detects a change in authentication state (e.g., a session refresh, a token expiry, or a sign-out). When the event is `SIGNED_OUT`, the provider navigates to `/login`.

The subscription is cleaned up on unmount via `subscription.unsubscribe()`.

### Provider Hierarchy in App.tsx

`AuthProvider` wraps the entire application inside `BrowserRouter`. It is the outermost provider, ensuring `useAuth()` is available to all components:

```
BrowserRouter
  AuthProvider            <-- user, loading, auth methods
    ErrorMonitorProvider
      TeamProvider
        ProjectSelectionProvider
          AreaAccessProvider
            AreaProvider
              GovernanceProvider
                Routes...
```

---

## Supabase Auth Flows

### Login

**Entry point:** `src/pages/Login.tsx` renders `LoginForm`.

**Step-by-step:**

1. User fills email and password fields validated by a Zod schema (`email` must be a valid email address; `password` must be at least 6 characters).
2. `LoginForm.onSubmit()` calls `signIn(email, password)` from `useAuth()`.
3. `AuthContext.signIn()` delegates to `supabaseAuth.signIn()`, which calls `supabase.auth.signInWithPassword({ email, password })`.
4. On success, Supabase stores the session token in localStorage and the `onAuthStateChange` listener fires `SIGNED_IN`, populating `user` in the context. `LoginForm` then clears any stored project selection via `ProjectStorage.clearSelectedProject()` and navigates to `/project-selector`.
5. On failure, the raw Supabase error message string is inspected in `LoginForm`:

| Raw Supabase message fragment | i18n key displayed to user |
|------------------------------|---------------------------|
| `Invalid login credentials` | `auth.login.errors.invalidCredentials` ("Invalid email or password") |
| `Email not confirmed` | `auth.login.errors.emailNotConfirmed` ("Please confirm your email first") |
| `Too many requests` | `auth.login.errors.tooManyRequests` ("Too many attempts. Please wait a moment and try again") |
| any other message | `auth.login.errors.genericError` ("An error occurred during login. Please try again") |

**Code pattern (LoginForm):**

```typescript
const onSubmit = async (data: LoginFormData) => {
  setIsLoading(true);
  setError(null);
  try {
    await signIn(data.email, data.password);
    saveEmailPreference(data.email, rememberMe);
    ProjectStorage.clearSelectedProject();
    navigate(''/project-selector'', { replace: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes(''Invalid login credentials'')) {
      setError(t(''login.errors.invalidCredentials''));
    } else if (errorMessage.includes(''Email not confirmed'')) {
      setError(t(''login.errors.emailNotConfirmed''));
    } else if (errorMessage.includes(''Too many requests'')) {
      setError(t(''login.errors.tooManyRequests''));
    } else {
      setError(t(''login.errors.genericError''));
    }
  } finally {
    setIsLoading(false);
  }
};
```

The `LoginForm` also persists the user''s email address when "Remember me" is checked, storing it under the `rememberEmail` / `savedEmail` keys in localStorage.

### Registration

**Entry point:** routed at `/signup` (rendered as part of the legacy onboarding flow).

**Step-by-step:**

1. User fills email, password, and confirm password fields. Zod schema validates email format and enforces a 6-character minimum on both password fields; a `.refine()` ensures passwords match.
2. `SignupForm.onSubmit()` calls `signUp(email, password)` from `useAuth()`.
3. `AuthContext.signUp()` calls `supabase.auth.signUp({ email, password })`.
4. Supabase creates the user account. If `user` is returned (non-null), the UI shows a success state with the message "Verify your Email" (`auth.signup.success.title`). The user is redirected to `/login` after a 3-second delay.
5. On failure, error strings are matched against:

| Raw Supabase message fragment | i18n key |
|------------------------------|----------|
| `User already registered` | `auth.signup.errors.emailExists` ("An account with this email already exists") |
| `Invalid email` | `auth.signup.errors.invalidEmail` ("Please enter a valid email") |
| `Password` (any password-related error) | `auth.signup.errors.weakPassword` ("Password must be at least 6 characters long") |
| any other message | `auth.signup.errors.genericError` ("An error occurred during signup. Please try again") |

### Logout

**Entry point:** `LogoutButton` component (`src/components/auth/LogoutButton.tsx`), available throughout the application layout.

**Step-by-step:**

1. User clicks the logout button (variant prop controls appearance).
2. `handleLogout()` calls `signOut()` from `useAuth()`.
3. `AuthContext.signOut()` calls `supabaseAuth.signOut()`, which invokes `supabase.auth.signOut()`. This clears the session from localStorage and triggers the `onAuthStateChange` listener with `SIGNED_OUT`.
4. The listener sets `user` to `null` and navigates to `/login`.
5. `LogoutButton` sets local `isLoading` state during the async operation and shows a spinner while the call is in flight.

```typescript
const handleLogout = async () => {
  setIsLoading(true);
  try {
    await signOut();
  } catch (error) {
    console.error(''Logout failed:'', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Forgot Password

**Entry point:** `src/pages/ForgotPassword.tsx` renders `ForgotPasswordForm`.

**Step-by-step:**

1. User enters their email address. Zod schema validates it is a well-formed email.
2. `ForgotPasswordForm.onSubmit()` calls `forgotPassword(email)` from `useAuth()`.
3. `AuthContext.forgotPassword()` calls `supabaseAuth.resetPasswordForEmail()`. This helper wraps `supabase.auth.resetPasswordForEmail(email, { redirectTo: ''<origin>/reset-password'' })`, sending Supabase a password-reset email to the given address with a link back to the application''s reset-password route.
4. On success, `ForgotPasswordForm` shows a success state (green check icon, "Email Sent" message) and clears the form. No session is created at this stage.
5. On failure, error strings are matched:

| Raw message fragment | i18n key |
|---------------------|----------|
| `rate limit` or `Too many` | `auth.forgotPassword.errors.rateLimitError` ("Too many attempts. Please wait a moment and try again") |
| any other message | `auth.forgotPassword.errors.genericError` ("An error occurred while sending the email. Please try again") |

**Note:** Supabase does not reveal whether an email address exists in the system — it always returns a success response for security reasons. The UI reflects this by always showing the "Email Sent" success state regardless of whether the account exists.

### Reset Password

**Entry point:** `src/pages/ResetPassword.tsx` renders `ResetPasswordForm`.

**Step-by-step:**

1. `ResetPassword` page checks if a valid session exists by reading `user` from `useAuth()`. While loading, it shows a pulsing key icon and "Verifying your reset link..." text.
2. If `user` is null after loading (no valid session — the reset token URL was never opened or the token expired), the page displays an error alert with `auth.resetPassword.errors.invalidToken` ("Invalid or expired link") and offers a button to request a new link via `/forgot-password`.
3. If a valid session is present (Supabase has already processed the reset-link token and established a session), `ResetPasswordForm` is shown.
4. `ResetPasswordForm` asks for a new password and confirmation. Zod schema enforces 6-character minimum and matching passwords.
5. On submit, `resetPassword(newPassword)` calls `supabaseAuth.updatePassword()`, which wraps `supabase.auth.updateUser({ password: newPassword })`.
6. On success, a green checkmark is shown and the user is auto-redirected to `/login` after a 3-second countdown (`auth.resetPassword.success.redirecting`, with `{{seconds}}` interpolation).
7. On failure, the error message is inspected for `invalid` or `expired` to display `auth.resetPassword.errors.invalidToken`; all other errors map to `auth.resetPassword.errors.genericError`.

---

## Session Management

### How Sessions Work

Supabase Auth uses JWT-based sessions. When a user signs in:

1. Supabase returns an access token (JWT) and a refresh token.
2. The Supabase JavaScript client stores both in `localStorage` under the `sb-<project-ref>-auth-token` key.
3. The access token is included as a Bearer token in all authenticated Supabase client requests automatically.
4. The client also registers a refresh timer. When the access token is close to expiry, the client automatically exchanges the refresh token for a new access token (this is transparent to the application).

### Session Restoration on Page Load

`AuthProvider`''s initial `getSession()` call restores the session from localStorage without a network round-trip, provided a non-expired token is present. If the token has expired, `getSession()` will attempt a silent refresh.

### Token Refresh and Expiry

- Access tokens issued by Supabase are short-lived (typically 1 hour).
- The Supabase client handles refresh automatically when needed.
- If refresh fails (e.g., the refresh token is also expired or revoked), the client transitions to an unauthenticated state and the `onAuthStateChange` listener fires `SIGNED_OUT`.
- `ProtectedRoute` then detects `isAuthenticated === false` and redirects to `/login`.

### Session Storage Keys

| Key prefix | Contents |
|-----------|----------|
| `sb-<ref>-auth-token` | Supabase session (access token, refresh token, expiry metadata) |
| `rememberEmail` | Saved email when "Remember me" is checked on login |
| `savedEmail` | The actual email value stored alongside `rememberEmail` |
| `dr-ai-selected-project` | Current project selection (managed by `ProjectSelectionContext`, not auth) |

### Server-Side Session Validation

Supabase Row Level Security (RLS) policies on each database table validate the JWT embedded in the request. The frontend `supabase` client attaches this token automatically. No manual token handling is required in application code beyond what `supabaseAuth` already does.

---

## Protected Routes Pattern

### ProtectedRoute Component

**Location:** `src/components/ProtectedRoute.tsx`

`ProtectedRoute` is a wrapper component used inside `App.tsx` to guard all authenticated routes. It performs a three-stage check:

```
Is auth loading?
  Yes -> <PageLoader />                    (wait for session check)
  No  ->
    Is user authenticated?
      No  -> Navigate to /login             (redirect unauthenticated users)
      Yes ->
        Is project loading?
          Yes -> <PageLoader />            (wait for project context)
          No  ->
            Is current route project-exempt?
              Yes -> render children        (e.g. /project-selector, /profile)
              No  ->
                Is selectedProject set?
                  Yes -> render children    (normal authenticated route)
                  No  -> Navigate to /project-selector
```

### Project-Exempt Routes

These routes do not require a project to be selected:

```typescript
const PROJECT_EXEMPT_ROUTES = [
  ''/project-selector'',
  ''/projects'',
  ''/products/create'',
  ''/team'',
  ''/profile'',
  ''/governance'',
  ''/privacy-policy'',
  ''/terms-of-service'',
  ''/admin'',
];
```

Route matching is done by exact equality or prefix (so `/team/create` is also exempt because it starts with `/team`).

### Route Definition in App.tsx

Public routes (no authentication) are defined outside the `ProtectedRoute` wrapper:

```typescript
<Routes>
  {/* Public */}
  <Route path="/login" element={<Login />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/auth/calendar-callback" element={<CalendarOAuthCallback />} />
  <Route path="/demos" element={<DemosPage />} />
  <Route path="/meetings/share/:token" element={<PublicMeetingSharePage />} />

  {/* Protected — wrapped in ProtectedRoute + Layout */}
  <Route element={
    <ProtectedRoute>
      <Layout />
    </ProtectedRoute>
  }>
    <Route path="/" element={<Dashboard />} />
    <Route path="/project-selector" element={<ProjectSelector />} />
    {/* ... all other routes */}
  </Route>
</Routes>
```

### Post-Sign-In Navigation

After a successful login, `LoginForm` navigates to `/project-selector` (not directly to `/`). This ensures the user selects or creates a project before entering the main application, satisfying `ProtectedRoute`''s project-selection requirement.

After logout, `AuthContext` navigates to `/login`. The `ProjectSelectionContext` retains the last selected project in localStorage so it can be restored on the next login.

---

## User-Facing Auth Errors

All error messages shown to users come from i18n translation files. Components never hard-code error text.

### i18n Key Reference

| Flow | i18n key | English text |
|------|----------|-------------|
| Login | `auth.login.errors.invalidCredentials` | "Invalid email or password" |
| Login | `auth.login.errors.emailNotConfirmed` | "Please confirm your email first" |
| Login | `auth.login.errors.tooManyRequests` | "Too many attempts. Please wait a moment and try again" |
| Login | `auth.login.errors.genericError` | "An error occurred during login. Please try again" |
| Login (validation) | `auth.login.validation.emailInvalid` | "Please enter a valid email" |
| Login (validation) | `auth.login.validation.passwordMinLength` | "Password must be at least 6 characters long" |
| Signup | `auth.signup.errors.emailExists` | "An account with this email already exists" |
| Signup | `auth.signup.errors.invalidEmail` | "Please enter a valid email" |
| Signup | `auth.signup.errors.weakPassword` | "Password must be at least 6 characters long" |
| Signup | `auth.signup.errors.genericError` | "An error occurred during signup. Please try again" |
| Signup (validation) | `auth.signup.validation.passwordsNoMatch` | "Passwords do not match" |
| Forgot Password | `auth.forgotPassword.errors.genericError` | "An error occurred while sending the email. Please try again" |
| Forgot Password | `auth.forgotPassword.errors.rateLimitError` | "Too many attempts. Please wait a moment and try again" |
| Reset Password | `auth.resetPassword.errors.genericError` | "An error occurred while resetting the password. Please try again" |
| Reset Password | `auth.resetPassword.errors.invalidToken` | "Invalid or expired link" |
| Reset Password | `auth.resetPassword.errors.expiredToken` | "This reset link has expired" |
| Reset Password (validation) | `auth.resetPassword.validation.passwordsNoMatch` | "Passwords do not match" |

### Error Mapping Strategy

Each form implements error mapping by inspecting the raw Supabase error `message` string for known substrings. This is a pragmatic approach since Supabase error messages are stable and localized. The mapping is done via `String.prototype.includes()` against a short list of known patterns, falling back to a generic i18n key for any unrecognized error.

### Error Display Pattern

All forms use the Shadcn `Alert` component with `variant="destructive"` to render errors:

```tsx
{error && (
  <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2 ...">
    <AlertCircle className="h-4 w-4" />
    <AlertDescription className="ml-2">{error}</AlertDescription>
  </Alert>
)}
```

---

## Common Auth Troubleshooting Scenarios

### User Cannot Log In — "Invalid email or password"

**Symptoms:** Login form returns "Invalid email or password" immediately after submission.

**Root causes and actions:**

1. Incorrect email or password. Ask the user to:
   - Verify the email address is spelled correctly.
   - Check that Caps Lock is not enabled.
   - Try the "Forgot password?" link to reset the password.
2. Account was created but email was never confirmed. In Supabase Auth''s default email confirmation mode, the account exists but `signInWithPassword` will fail with "Email not confirmed" if confirmation is pending. If the user sees "Invalid email or password" instead, it may mean the email confirmation was attempted but the link expired. Resolution: use the forgot-password flow to receive a new link.
3. Account does not exist. If the user never completed registration, there is no account. Resolution: create a new account.

### User Reports Being Redirected to Login Unexpectedly

**Symptoms:** Authenticated user is redirected to `/login` without clicking logout.

**Root causes and actions:**

1. Session token expired. Supabase access tokens expire after a set period (default 1 hour). The client should refresh automatically, but if the refresh token is also invalid (e.g., the user cleared site data while the app was open), the session is lost. Resolution: log in again.
2. `localStorage` was cleared or became inaccessible. The session data lives in localStorage. Privacy browsing modes or browser settings that restrict localStorage will prevent session persistence. Resolution: ensure the browser allows localStorage for the application domain.
3. Concurrent session limit reached. Supabase can be configured to limit concurrent sessions per user; exceeding this limit revokes older sessions. Resolution: check Supabase project auth settings for session limits.
4. Supabase project URL or anon key was rotated. If environment variables `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` changed, existing localStorage sessions signed with the old key are invalidated. Resolution: log in again with the updated environment.

### User Cannot Complete Password Reset

**Symptoms:** User clicks the reset link in the email but lands on a page saying "Invalid or expired link."

**Root causes and actions:**

1. Link has expired. Password reset links are single-use and expire after a set time (configurable in Supabase, default 1 hour). Resolution: request a new link via the forgot-password flow.
2. Link was already used. Once a password is reset, the token is consumed and cannot be used again. If the user is trying to use the same link a second time, it will be invalid. Resolution: request a new link.
3. Browser opened the link in a different tab or window than the one where the session was initiated. Supabase associates the reset token with a specific browser session. Resolution: open the link in the same browser where the reset was initiated.
4. The Supabase project has email confirmations disabled or misconfigured. Check the Supabase dashboard under Authentication > URL Configuration that the Site URL and Redirect URLs include the application origin. Without this, Supabase may reject the token exchange.

### User Cannot Register — "An account with this email already exists"

**Symptoms:** Signup form returns the email-exists error immediately.

**Root causes and actions:**

1. The email is already registered. This can happen if the user created an account previously, possibly using a different authentication method (e.g., a magic link or OAuth provider that shares the same email). Resolution: use the forgot-password flow to set a password for the existing account, or use the original sign-in method.
2. A previous registration attempt created a partial account (Supabase created the user record but the email was never confirmed). The user record still exists. Resolution: use the forgot-password flow.

### Rate Limiting Errors

**Symptoms:** User sees "Too many attempts. Please wait a moment and try again" on login or password reset.

**Root causes and actions:**

1. Supabase applies built-in rate limiting on auth endpoints. This is normal protection against brute-force attacks. Resolution: wait 60 seconds and retry.
2. Automated bots or scripts hitting the auth endpoints. If the application is exposed publicly, some bot traffic may trigger rate limits. This does not affect real users significantly due to the short cooldown period.

### Translation Keys Missing

**Symptoms:** Error message displays as an empty string or a raw key like `auth.login.errors.invalidCredentials`.

**Root causes and actions:**

1. The i18n configuration is not initialized. `useI18n` requires the i18n provider to be mounted. Check that `src/i18n/config` is imported in `App.tsx` (it is, as `import ''./i18n/config''`).
2. The namespace is not registered. All auth translations are under the `auth` namespace. Verify the namespace is registered when initializing i18n.
3. A translation key was added to the code but not added to one or both locale files. Ensure the key exists in both `en-us/auth.ts` and `pt-br/auth.ts`.

---

## supabaseAuth Helper Reference

Located in `src/lib/supabase.ts`, `supabaseAuth` is a thin wrapper around `supabase.auth` that adds type-safe error propagation (all Supabase errors are thrown rather than returned as data, making try/catch the consistent pattern).

```typescript
export const supabaseAuth = {
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  signUp: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },

  resetPasswordForEmail: async (email: string, redirectTo?: string) => {
    const redirectUrl = redirectTo ?? `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    if (error) throw error;
  },

  updatePassword: async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },
};
```

---

## Related Documentation

- [User Flows](../18-user-flows/flows.md) — end-to-end user journeys that include auth steps
- [Permissions](../19-permissions/roles.md) — role-based access control applied after authentication
- [Project Context](../06-project-context/context-system.md) — how project selection interacts with the auth session
- [State Management](../07-state-management/state-patterns.md) — overall state architecture including auth state
- [Database Schema](../04-database-schema/schema.md) — auth-related database tables
', 'docs/05-authentication/auth-flows.md'),
    ('login_auth', 'User Flows', '---
name: user-flows
description: Step-by-step user flows for all major features
area: 18
maintained_by: flow-documenter
created: 2026-03-30
updated: 2026-03-30
---

# User Flows

This document describes the step-by-step user flows for all major features in the RAG Workforce application. Each flow covers the complete journey from user intent to system response.

---

## Table of Contents

1. [Registration (Sign Up)](#1-registration-sign-up)
2. [Email Verification](#2-email-verification)
3. [Login](#3-login)
4. [Logout](#4-logout)
5. [Project Selection](#5-project-selection)
6. [Task Management - Create Task](#6-task-management---create-task)
7. [Task Management - Assign Task](#7-task-management---assign-task)
8. [Task Management - Change Status](#8-task-management---change-status)
9. [Sprint Planning - Create Sprint](#9-sprint-planning---create-sprint)
10. [Sprint Planning - Assign Tasks to Sprint](#10-sprint-planning---assign-tasks-to-sprint)
11. [Sprint Planning - Track Velocity](#11-sprint-planning---track-velocity)
12. [Meeting Recording - Create Meeting](#12-meeting-recording---create-meeting)
13. [Meeting Recording - View Transcript](#13-meeting-recording---view-transcript)
14. [Document Generation - Select Transcript](#14-document-generation---select-transcript)
15. [Document Generation - Choose Document Type](#15-document-generation---choose-document-type)
16. [Document Generation - Generate via Edge Function](#16-document-generation---generate-via-edge-function)

---

## 1. Registration (Sign Up)

**Objective**: Create a new user account in the system.

**Prerequisites**: None. The registration page is publicly accessible.

**Flow Steps**:

1. User navigates to the application URL.
2. System checks for an active authentication session.
3. If no session exists, system displays the Login page.
4. User clicks the "Sign Up" or "Create Account" link.
5. User enters a valid email address in the email field.
6. User enters a password (minimum 6 characters) in the password field.
7. User confirms the password by entering it again.
8. User clicks the "Create Account" or "Sign Up" button.
9. System validates the input fields:
   - Email format is validated.
   - Password length meets the minimum requirement (6 characters).
10. System calls Supabase Auth `signUp` method with email and password.
11. System creates a new user record in Supabase Auth.
12. System sends a confirmation email to the provided email address.
13. System displays a success message: "Check your email for a confirmation link."
14. User is redirected to the login page or an email verification pending screen.

**Technical Implementation**:
- Uses `signUp` from `useAuth` context in `AuthContext.tsx`.
- Supabase Auth handles user creation and email dispatch.
- The `AuthProvider` wraps the application to manage authentication state.

**Error Handling**:
- If email is already registered: display "Email already registered" error.
- If password is too short: display "Password must be at least 6 characters" error.
- If network error occurs: display generic error with retry option.

---

## 2. Email Verification

**Objective**: Confirm the user''s email address to activate the account.

**Prerequisites**: User must have completed registration and received a confirmation email.

**Flow Steps**:

1. User receives an email from the system with a confirmation link.
2. User clicks the confirmation link in the email.
3. System extracts the confirmation token from the URL.
4. System calls Supabase Auth `confirmSignup` with the token.
5. System validates the token:
   - Token is checked for expiration.
   - Token is validated against the user''s record.
6. If token is valid, system updates the user''s email confirmation status to verified.
7. System redirects the user to the login page.
8. System displays a success message: "Email verified successfully. You can now log in."
9. User proceeds to the login flow.

**Error Handling**:
- If token is expired: display "Confirmation link has expired. Request a new one."
- If token is invalid: display "Invalid confirmation link."
- If email already confirmed: display "Email already verified. Please log in."

---

## 3. Login

**Objective**: Authenticate an existing user and establish a session.

**Prerequisites**: User must have a registered account with a verified email address.

**Flow Steps**:

1. User navigates to the application login page at `/login`.
2. System displays the Login form with email and password fields.
3. User enters their registered email address.
4. User enters their password.
5. (Optional) User checks the "Remember me" checkbox.
6. User clicks the "Log in" button.
7. System validates the input fields:
   - Email format is validated.
   - Password is not empty.
8. System calls Supabase Auth `signIn` method with email and password.
9. System authenticates credentials against Supabase Auth.
10. System creates a new session and stores the session token.
11. System updates the `user` state in `AuthContext`.
12. System clears any previously selected project from localStorage via `ProjectStorage.clearSelectedProject()`.
13. System navigates the user to the `/project-selector` page.
14. User sees the project selection interface.

**Technical Implementation**:
- Component: `LoginForm.tsx` at `src/components/auth/LoginForm.tsx`.
- Uses `signIn` from `useAuth` context in `AuthContext.tsx`.
- Session is managed by Supabase Auth automatically.
- On successful login, `ProjectStorage.clearSelectedProject()` is called.

**Error Handling**:
- If credentials are invalid: display "Invalid email or password."
- If email is not confirmed: display "Please confirm your email address before logging in."
- If too many requests: display "Too many login attempts. Please try again later."
- If network error occurs: display generic error with retry option.

---

## 4. Logout

**Objective**: End the user''s session and clear authentication state.

**Prerequisites**: User must be currently logged in.

**Flow Steps**:

1. User clicks the logout button (typically in the header or user menu).
2. System calls Supabase Auth `signOut` method.
3. System clears the user session from storage.
4. System sets the `user` state to `null` in `AuthContext`.
5. System removes any selected project from localStorage.
6. System navigates the user to the `/login` page.
7. User sees the login page and is no longer authenticated.

**Technical Implementation**:
- Uses `signOut` from `useAuth` context in `AuthContext.tsx`.
- `AuthProvider` listens for `SIGNED_OUT` auth events and automatically navigates to `/login`.
- Local project selection data is cleared via `ProjectStorage.clearSelectedProject()`.

**Error Handling**:
- If signOut fails due to network error: display error toast and retry option.
- Session cleanup should still occur locally even if server call fails.

---

## 5. Project Selection

**Objective**: Select a project to work on and establish project context for all subsequent operations.

**Prerequisites**: User must be logged in. User must have access to at least one project.

**Critical Implementation Rule**:
- **ALWAYS** use `selectedProject?.id` from `useProjectSelection()`, **NOT** a separate `selectedProjectId` variable.
- The hook returns the full `selectedProject` object; access the ID via `selectedProject?.id`.

```typescript
// CORRECT
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// INCORRECT - this property does not exist
const { selectedProjectId } = useProjectSelection();
```

**Flow Steps**:

1. User logs in and is redirected to `/project-selector`.
2. System displays the project selector page with available projects.
3. System loads user''s accessible projects via `useProjects` hook.
4. System displays recent projects at the top of the list with a "Recent" badge.
5. User can search for a project using the search field.
6. User can toggle between grid and list view modes.
7. User clicks on a project card to select it.
8. System calls `selectProject(project)` from `useProjectSelection` hook.
9. System validates that the project exists and has a valid ID.
10. System checks user access rights via `checkUserHasAccess` (unless user is admin).
11. System stores the selected project in `ProjectSelectionContext`.
12. System persists the project to localStorage via `ProjectStorage.setSelectedProject()`.
13. System adds the project to the recent projects history.
14. System navigates the user to `/dashboard` (in project mode) or `/projects/{projectId}`.
15. The selected project is now available via `useProjectSelection().selectedProject`.
16. All subsequent data operations use `selectedProject?.id` to scope queries.

**Technical Implementation**:
- Hook: `useProjectSelection()` from `src/contexts/ProjectSelectionContext.tsx`.
- The hook returns `{ selectedProject, selectProject, projectHistory, ... }`.
- Access the project ID as: `const { selectedProject } = useProjectSelection(); const projectId = selectedProject?.id;`.
- All pages that require a project check `selectedProject` before rendering.
- Protected routes redirect to `/project-selector` if no project is selected.

**Error Handling**:
- If user has no project access: display "You don''t have access to this project" and redirect.
- If project ID is invalid: display "Invalid Project" error.
- If project is not selected on a protected route: redirect to `/project-selector`.

---

## 6. Task Management - Create Task

**Objective**: Create a new task within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Tasks page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads tasks for the current project using `useTasks(selectedProject?.id)`.
4. System displays the task board (Kanban or list view).
5. User clicks the "Add Task" button in the header or task add dropdown.
6. System displays the task creation form dialog (`TaskFormDialog`).
7. User fills in the task details:
   - **Title** (required): Enter a brief task description.
   - **Description** (optional): Enter detailed task information.
   - **Priority** (optional): Select from Low, Medium, High, Critical, Urgent.
   - **Story Points** (optional): Enter an estimated story point value (Fibonacci: 1, 2, 3, 5, 8, 13, 21).
   - **Assignee** (optional): Select a team member to assign the task.
   - **Sprint** (optional): Select a sprint for the task.
   - **Tags** (optional): Add relevant tags.
   - **Acceptance Criteria** (optional): Add acceptance criteria items.
8. User clicks "Save" or "Create" button.
9. System validates the form fields.
10. System calls `taskService.createTask()` with the form data.
11. System includes `project_id: selectedProject.id` and `created_by: user.id` in the payload.
12. System saves the task to the `dev_tasks` database table.
13. System refreshes the task list.
14. System closes the dialog and displays the updated board.
15. System shows a success toast: "Task created successfully."

**Technical Implementation**:
- Page: `Tasks.tsx` at `src/pages/Tasks.tsx`.
- Service: `taskService.createTask()` from `src/lib/services/task-service.ts`.
- Form: `TaskFormDialog` component.
- Project ID: `const { selectedProject } = useProjectSelection(); const projectId = selectedProject?.id;`.

**Alternative Task Creation Methods**:
- **AI Creation**: Click "Create with AI" to generate tasks from natural language via `AITaskCreationDialog`.
- **Voice Creation**: Click "Create by Voice" to use voice input via `VoiceTaskDialog`.
- **From Document**: Click "Create from Document" to generate from existing documents.
- **From File**: Click "Create from File" to generate from uploaded files.

---

## 7. Task Management - Assign Task

**Objective**: Assign a task to a team member.

**Prerequisites**: User must be logged in, have a project selected, and have a task to assign.

**Flow Steps**:

1. User navigates to the Tasks page.
2. User locates the task to assign (via Kanban board or list view).
3. User clicks on the task card to open the task detail modal.
4. System displays the task detail view with current assignee information.
5. User clicks the "Edit" button to modify task details.
6. System displays the assignee selection field.
7. System loads available team members from `useTeamMembers(selectedProject?.id)`.
8. User selects a team member from the dropdown.
9. User clicks "Save" or "Update".
10. System calls `taskService.updateTask()` with the new assignee.
11. System updates the task record in the database.
12. System refreshes the task list.
13. System closes the edit modal and updates the board.
14. System shows a success toast with the assignee name.

**Technical Implementation**:
- Service: `taskService.updateTask(taskId, data)` with `assignee_id` in data payload.
- Hook: `useTeamMembers(selectedProject?.id)` provides the team member list.
- The assignee is stored in the `dev_tasks` table as `assignee_id`.

**Batch Assignment**:
1. User selects multiple tasks in list view using checkboxes.
2. User clicks the batch action bar.
3. User selects "Assign" action.
4. User chooses a team member.
5. System updates all selected tasks with the new assignee.

---

## 8. Task Management - Change Status

**Objective**: Update the status of a task (e.g., move from "To Do" to "In Progress" to "Done").

**Prerequisites**: User must be logged in, have a project selected, and have a task to update.

**Flow Steps - Kanban Drag and Drop**:

1. User navigates to the Tasks page.
2. User views the Kanban board with columns: Todo, In Progress, Done, Blocked.
3. User drags a task card from one column to another.
4. System updates the task status based on the target column.
5. System calls `taskService.updateTask()` with the new status.
6. System updates the task record in the database.
7. System visually animates the card to its new position.
8. System shows a subtle status change indicator.

**Flow Steps - Task Detail Modal**:

1. User clicks on a task card to open the detail modal.
2. User clicks the status dropdown.
3. User selects the new status from the list (Todo, In Progress, Done, Blocked).
4. User clicks "Save".
5. System updates the status and refreshes the board.
6. System closes the modal and shows the updated board.

**Technical Implementation**:
- Kanban board component handles drag-and-drop status changes via `KanbanBoard` component.
- Service: `taskService.updateTask(taskId, { status: ''done'' })`.
- Batch status changes supported via `useBatchTaskOperations`.

---

## 9. Sprint Planning - Create Sprint

**Objective**: Create a new sprint within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Sprints page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads sprints for the current project using `useSprints(selectedProject?.id)`.
4. System displays the sprint list with existing sprints.
5. User clicks the "New Sprint" button.
6. System displays the sprint creation form (`SprintForm`).
7. User fills in the sprint details:
   - **Name** (required): Enter a unique sprint name (e.g., "Sprint 5").
   - **Description** (optional): Enter sprint goals and notes.
   - **Start Date** (required): Select the sprint start date via date picker.
   - **End Date** (required): Select the sprint end date.
   - **Status** (required): Select from Planning, Active, Completed, Cancelled.
   - **Goals** (optional): Add sprint goals as a list of text items.
8. User clicks "Create Sprint" button.
9. System validates the form fields.
10. System ensures the end date is after the start date.
11. System calls the sprint creation function with the form data.
12. System saves the sprint to the `sprints` database table.
13. System navigates to the new sprint''s detail page.
14. System shows a success toast: "Sprint created successfully."

**Batch Sprint Creation**:

1. User clicks "Create Batch" button on the Sprints page.
2. System displays the batch creation dialog (`BatchSprintCreationDialog`).
3. User configures multiple sprints at once (e.g., 4 sprints over 8 weeks).
4. System creates all sprints via `useBatchSprintCreation` hook.
5. System displays a progress indicator during creation.
6. System displays a summary of created sprints.

**Technical Implementation**:
- Page: `SprintList.tsx` at `src/pages/SprintList.tsx`.
- Form: `SprintForm.tsx` at `src/pages/sprints/SprintForm.tsx`.
- Data: `useSprints(selectedProject?.id)` hook.
- Form uses `react-hook-form` with `zod` validation schema.
- Sprint status enum: `planning`, `active`, `completed`, `cancelled`.

---

## 10. Sprint Planning - Assign Tasks to Sprint

**Objective**: Associate existing tasks with a specific sprint.

**Prerequisites**: User must be logged in, have a project selected, and have both tasks and a sprint available.

**Flow Steps**:

1. User navigates to the Sprints page.
2. User clicks on a sprint card to open the sprint detail view.
3. System displays the sprint details with associated tasks.
4. User clicks "Add Tasks" or navigates to the Sprint Tasks section.
5. System displays the task selection panel.
6. System loads tasks from the current project that are not yet assigned to a sprint.
7. User selects one or more tasks from the list (checkbox selection).
8. User clicks "Assign to Sprint" button.
9. System calls `taskService.updateTask()` for each selected task with the sprint ID.
10. System updates each task record in the database.
11. System refreshes the sprint detail view.
12. System displays the newly assigned tasks in the sprint task list.
13. System shows a success toast with the count of assigned tasks.

**Technical Implementation**:
- Sprint detail page: `src/pages/sprints/SprintTasks.tsx`.
- Service: `taskService.updateTask(taskId, { sprint_id: sprintId })`.
- Task statistics are recalculated after assignment.

---

## 11. Sprint Planning - Track Velocity

**Objective**: Monitor sprint progress and team velocity through task completion metrics.

**Prerequisites**: User must be logged in, have a project selected, and have at least one active sprint.

**Flow Steps**:

1. User navigates to the Sprints page.
2. System loads sprint task statistics via `taskService.fetchTasks()` for each sprint.
3. System calculates velocity metrics for each sprint:
   - Total tasks count
   - Completed tasks count
   - Total story points
   - Completed story points
   - Velocity percentage (completedPoints / totalPoints * 100)
4. System displays sprint cards with velocity indicators (progress bars, completion stats).
5. User clicks on a sprint card for detailed analytics.
6. System navigates to the Sprint Analytics page (`/sprints/analytics`).
7. System displays:
   - Velocity trend graph
   - Task completion breakdown by status
   - Story points progress bar
   - AI-powered insights via `analyzeSprintAPI()`
8. User can filter analytics by date range or task status.
9. System provides recommendations based on sprint performance.

**Technical Implementation**:
- Analytics page: `src/pages/sprints/SprintAnalyticsPage.tsx`.
- Service: `taskService.fetchTasks()` for sprint-specific task fetching.
- AI analysis: `analyzeSprintAPI(metricsJson, projectId, userId)` from `document-generation-service.ts`.
- Velocity calculation: `completedPoints / totalPoints * 100`.

---

## 12. Meeting Recording - Create Meeting

**Objective**: Create a new meeting record within the selected project.

**Prerequisites**: User must be logged in and have a project selected.

**Flow Steps**:

1. User navigates to the Meetings page via the main navigation.
2. System verifies a project is selected; if not, displays an error message.
3. System loads meetings for the current project.
4. User clicks the "New Meeting" button.
5. System displays the meeting creation form (`MeetingForm`).
6. User fills in the meeting details:
   - **Title** (required): Enter the meeting title.
   - **Description** (optional): Enter meeting description or agenda.
   - **Meeting Date** (required): Select the meeting date.
   - **Start Time** (required): Select the start time.
   - **End Time** (required): Select the end time.
   - **Meeting URL** (optional): Enter a link to the meeting (Zoom, Teams, etc.).
   - **Sprint** (optional): Associate the meeting with a sprint.
   - **Participants** (optional): Add team members or AI agents.
   - **Transcript Agent** (optional): Select an AI agent for transcription.
   - **Recurrence** (optional): Configure recurring meeting settings.
7. User clicks "Create Meeting" button.
8. System validates the form fields.
9. System saves the meeting to the `meetings` database table.
10. System saves participant associations to the `meeting_participants` table.
11. (If calendar sync enabled) System syncs the meeting to Microsoft Outlook calendar.
12. System navigates to the meetings list page.
13. System shows a success toast: "Meeting created successfully."

**Recurring Meeting Flow**:

1. User enables the recurrence option in the meeting form.
2. User configures recurrence pattern (daily, weekly, monthly).
3. User sets the number of occurrences.
4. System displays a confirmation modal showing all meetings to be created.
5. User confirms the recurring creation.
6. System creates all meetings via `useRecurringMeetingCreation` hook.
7. System displays a progress indicator during creation.
8. System shows a summary of created meetings.

**Technical Implementation**:
- Page: `MeetingCreate.tsx` at `src/pages/MeetingCreate.tsx`.
- Component: `MeetingForm` in `src/components/meetings/MeetingForm.tsx`.
- Mutations: `useMeetingMutations` hook.
- Calendar sync: `useCalendarConnection` for Microsoft Outlook integration.
- Recurring meetings: `useRecurringMeetingCreation` hook with confirmation flow.

---

## 13. Meeting Recording - View Transcript

**Objective**: View a meeting''s transcript and related information.

**Prerequisites**: User must be logged in, have a project selected, and have a meeting with an associated transcript.

**Flow Steps**:

1. User navigates to the Meetings page.
2. User locates the meeting with a transcript (indicated by a transcript badge or icon).
3. User clicks on the meeting card.
4. System navigates to `/meetings/{meetingId}/detail`.
5. System loads meeting data with transcript via `useMeetingWithTranscript(meetingId)`.
6. System detects the transcript format (plain text or Recall JSON).
7. System displays the meeting hero section with title, status, and badges.
8. System displays the transcript content in the appropriate viewer:
   - Plain text: uses `TranscriptViewer` component.
   - Recall JSON: uses `RecallTranscriptViewer` component.
9. System displays related information in the sidebar:
   - Meeting link card
   - Transcript agent card (if configured)
   - Related documents section
   - Sprint association
   - Participants list
10. User can copy the meeting URL using the copy button.
11. User can edit or delete the meeting (if they are the creator).
12. User can generate documents from the transcript via the Related Documents section.

**Technical Implementation**:
- Page: `MeetingDetailPage.tsx` at `src/pages/meetings/MeetingDetailPage.tsx`.
- Hook: `useMeetingWithTranscript(meetingId)` fetches from `view_meeting_with_transcript` database view.
- Transcript detection: `detectTranscriptFormat()` utility.
- Viewers: `TranscriptViewer` and `RecallTranscriptViewer` components.
- Edit/delete permissions checked against `meeting.created_by === user.id`.

---

## 14. Document Generation - Select Transcript

**Objective**: Select a meeting transcript as the source for document generation.

**Prerequisites**: User must be logged in, have a project selected, and have a meeting with a transcript.

**Flow Steps**:

1. User navigates to the Meetings page.
2. User locates the meeting with a transcript to use.
3. User clicks on the meeting card to view its details.
4. User verifies the transcript content is correct by reviewing it in the viewer.
5. User clicks on the "Related Documents" section in the sidebar.
6. System loads the `RelatedDocuments` component with the transcript ID.
7. System queries the `generated_documents` table for documents linked to this transcript.
8. System displays existing generated documents (if any).
9. User clicks "Generate New Documents" button.
10. System displays the `DocumentGenerator` component.

**Alternative Flow - Direct Document Generation**:

1. User clicks the "Generate Documents" button on the meeting detail page.
2. System displays the `DocumentGenerator` component with the transcript pre-loaded.
3. System loads the transcript from `meeting_transcripts` table via Supabase.
4. System retrieves the project context from the selected project.
5. User proceeds to select document types.

**Technical Implementation**:
- Component: `RelatedDocuments` at `src/components/transcriptions/RelatedDocuments.tsx`.
- Component: `DocumentGenerator` at `src/components/transcriptions/DocumentGenerator.tsx`.
- Data fetch: Supabase query on `meeting_transcripts` table.
- Project context: `selectedProject?.id` from `useProjectSelection()`.

---

## 15. Document Generation - Choose Document Type

**Objective**: Select the types of documents to generate from the transcript.

**Prerequisites**: User must have selected a transcript and opened the document generator.

**Flow Steps**:

1. System displays available document types as selectable cards.
2. User reviews the available document types:
   - **Meeting Notes**: Structured meeting summary with key decisions and action items.
   - **User Stories**: User story generation from discussion points.
   - **Test Cases**: Test scenarios and validation cases.
   - **Technical Specs**: Technical implementation details.
   - **PRD**: Product Requirements Document.
3. User selects one or more document types by clicking the checkboxes on the cards.
4. User optionally adds project context in the "Additional Context" field to enhance generation.
5. User reviews their selections.
6. User clicks the "Generate" button.

**Available Document Types and Edge Functions**:

| Document Type | Edge Function | Description |
|--------------|---------------|-------------|
| Meeting Notes | `create-meeting-notes` | Structured meeting summaries |
| User Stories | `create-user-story` | User story generation |
| Test Cases | `create-test-cases` | Test scenarios |
| Technical Specs | `create-technical-specs` | Implementation details |
| PRD | `create-prd` | Product Requirements Document |
| Unit Tests | `create-unit-tests` | Unit test generation |
| Tasks | `create-tasks` | Task breakdown from content |
| Analyze Transcript | `analyze-transcript` | AI-powered transcript analysis |
| Analyze Sprint | `analyze-sprint` | Sprint metrics analysis |

**Technical Implementation**:
- Component: `DocumentGenerator.tsx` with document type selection UI.
- Centralized types: `useCentralizedDocumentTypes()` hook.
- Selection state managed locally in the component.
- Icons and labels retrieved from centralized document type system.

---

## 16. Document Generation - Generate via Edge Function

**Objective**: Generate selected document types using AI through Supabase Edge Functions.

**Prerequisites**: User must have selected at least one document type and clicked Generate.

**Flow Steps**:

1. System validates that at least one document type is selected.
2. System retrieves the transcript content from `meeting_transcripts` table.
3. System retrieves the project ID from `selectedProject?.id`.
4. System retrieves the user ID from `useAuth()`.
5. System sets the generating state and displays progress UI.
6. System initializes generation steps for each selected document type.
7. For each selected document type (processed sequentially):
   a. System updates the progress step to "in_progress".
   b. System calls `generateDocumentAPI()` with parameters:
      - `documentType`: The document type key (e.g., "user-story", "prd")
      - `transcriptContent`: The meeting transcript text + optional context
      - `projectId`: `selectedProject?.id`
      - `meetingTranscriptId`: The transcript ID for tracking
      - `userId`: `user?.id`
   c. The Edge Function receives the request at `create-{document-type}`.
   d. The Edge Function loads the appropriate Handlebars template.
   e. The Edge Function constructs the OpenAI API prompt using the template.
   f. The Edge Function calls the OpenAI Responses API.
   g. The Edge Function tracks token usage in `ai_interactions` table.
   h. The Edge Function saves the generated document to `generated_documents` table.
   i. The Edge Function returns the response with `success`, `document`, and `response_id`.
   j. System updates the progress step to "completed" or "error".
8. System displays the generation results with status indicators for each document.
9. For successful generations, system provides "View" and "Download" buttons.
10. System triggers the `onComplete` callback to refresh the documents list.
11. System displays a summary toast: "Generated X documents successfully."

**Edge Function Request Format**:

```typescript
{
  content: string;              // Transcript + optional context
  project_id: string;          // From selectedProject?.id (REQUIRED)
  meeting_transcript_id?: string;  // For tracking relationship
  user_id?: string;            // From user?.id
  system_prompt?: string;      // Optional override
  user_prompt?: string;        // Optional override
  previous_response_id?: string;   // For conversation continuity
  model?: string;              // Optional model override
  temperature?: number;         // Optional override
  token_limit?: number;        // Optional override
}
```

**Edge Function Response Format**:

```typescript
{
  success: boolean;
  document?: string;           // Generated Markdown content
  response_id?: string;        // OpenAI response ID for tracking
  document_id?: string;        // Database document ID
  error?: string;              // Error message if failed
}
```

**Technical Implementation**:
- Service: `generateDocumentAPI()` from `src/lib/services/document-generation-service.ts`.
- Edge Function invocation: `supabase.functions.invoke(functionName, { body: requestBody })`.
- Shared types: `supabase/functions/_shared/document-generation/types.ts`.
- Document types: centralized in `DocumentTypes` system.
- Sequential processing: `SequentialGenerationProgress` component.
- All document generation uses Edge Functions (no direct frontend OpenAI calls).

**Error Handling**:
- If API key not configured: display "API key not configured. Please configure your OpenAI API key in settings."
- If rate limit exceeded: display "Rate limit exceeded. Please try again later."
- If quota exceeded: display "Rate limit exceeded. Please try again later."
- If generation fails: mark the step as error and allow retry.
- If network error: display retry option.

---

## Appendix A: Key Hooks Reference

| Hook | Location | Purpose |
|------|----------|---------|
| `useAuth` | `src/contexts/AuthContext.tsx` | Authentication state (user, signIn, signUp, signOut) |
| `useProjectSelection` | `src/contexts/ProjectSelectionContext.tsx` | Project context and selection |
| `useTasks` | `src/hooks/useTasks.ts` | Task data fetching and operations |
| `useSprints` | `src/hooks/useSprints.ts` | Sprint data and CRUD operations |
| `useMeetings` | `src/hooks/useMeetings.ts` | Meeting data fetching |
| `useMeetingMutations` | `src/hooks/useMeetingMutations.ts` | Meeting create/update/delete |
| `useTeamMembers` | `src/hooks/useTeamMembers.ts` | Team member data |
| `useMeetingWithTranscript` | `src/hooks/useMeetingWithTranscript.ts` | Meeting with transcript data |
| `generateDocumentAPI` | `src/lib/services/document-generation-service.ts` | Document generation via Edge Functions |
| `useCentralizedDocumentTypes` | `src/hooks/useCentralizedDocumentTypes.ts` | Centralized document type definitions |

---

## Appendix B: Critical Implementation Rules

### Rule 1: Project Selection

**ALWAYS** access the project ID via `selectedProject?.id`:

```typescript
// CORRECT
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// Use projectId in queries
const { data } = await supabase
  .from(''tasks'')
  .select(''*'')
  .eq(''project_id'', projectId);

// INCORRECT - this property does not exist
const { selectedProjectId } = useProjectSelection();
```

### Rule 2: Authentication Flow

All authenticated pages must follow this pattern:

```typescript
const { user } = useAuth();
const { selectedProject } = useProjectSelection();

// Check authentication
if (!user) {
  return <Navigate to="/login" replace />;
}

// Check project selection
if (!selectedProject) {
  return <Alert>Please select a project first.</Alert>;
}
```

### Rule 3: Document Generation

**ALL** document generation must use `generateDocumentAPI()` from `document-generation-service.ts`. Do not call OpenAI directly from the frontend.

```typescript
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

const result = await generateDocumentAPI(
  ''user-story'',           // Document type
  transcriptContent,      // Input content
  selectedProject?.id,    // Project context
  meetingTranscriptId,    // Optional transcript ID
  user?.id               // Optional user ID
);

if (result.success) {
  // Document generated and saved automatically
  console.log(''Response ID:'', result.response_id);
} else {
  // Handle error
  console.error(result.error);
}
```

### Rule 4: Query Scoping

All database queries must be scoped by project:

```typescript
// CORRECT - always filter by project_id
const { data } = await supabase
  .from(''tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id);

// INCORRECT - missing project filter
const { data } = await supabase
  .from(''tasks'')
  .select(''*'');
```

---

## Appendix C: Related Documentation

- [Authentication System](../05-authentication/auth-flows.md)
- [Project Context System](../06-project-context/context-system.md)
- [Task Management](../21-tasks/tasks.md)
- [Sprint Management](../20-sprints/sprints.md)
- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md)
- [Document Generation API](../17-document-generation/api.md)
', 'docs/18-user-flows/flows.md'),
    ('document_generation', 'Document Generation - Edge Functions (v2.0)', '---
name: document-generation-edge-functions
description: Document generation v2.0 - Edge Functions, OpenAI integration, document types
area: 08
maintained_by: docgen-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Document Generation - Edge Functions (v2.0)

## Overview

The document generation system has been fully migrated from a frontend-centric v1.0 architecture to a server-side v2.0 architecture powered by Supabase Edge Functions. All AI-powered document creation now runs in Deno-based Edge Functions, keeping the OpenAI API key server-side, enabling automatic token usage tracking, and providing centralized error handling.

This section documents the complete Edge Function layer, including the shared infrastructure that all document generators use, the individual function implementations, the frontend service that invokes them, and the type definitions that ensure type safety across the stack.

## Architecture

### System Overview

```
+------------------------+      +----------------------------------+
|      Frontend React    |      |    Supabase Edge Functions       |
|                        |      |        (Deno Runtime)            |
|  generateDocumentAPI() |      |                                  |
|  generateUnitTests()   |      |  create-prd/                    |
|  generateBacklogItem() |---->|  create-user-story/              |
|  generateTasksAPI()     |      |  create-meeting-notes/          |
|  analyzeSprintAPI()    |      |  create-technical-specs/       |
+------------------------+      |  create-test-cases/             |
                               |  create-unit-tests/              |
                               |  create-backlog-items/           |
                               |  suggest-backlog-item/           |
                               |  analyze-transcript/             |
                               |  analyze-sprint/                 |
                               |                                  |
                               |  _shared/document-generation/     |
                               |    openai-service.ts              |
                               |    ai-interaction-service.ts      |
                               |    generated-document-service.ts  |
                               |    prompt-builder.ts              |
                               |    response-builder.ts            |
                               |    validation.ts                  |
                               |    types.ts                       |
                               +----------------------------------+
                                          |
                                          v
                               +-----------------------+
                               |    OpenAI API         |
                               |  (Responses API)      |
                               +-----------------------+
                                          |
                                          v
                               +-----------------------+
                               |    Supabase DB        |
                               |  ai_interactions      |
                               |  generated_documents  |
                               +-----------------------+
```

### Request/Response Flow

```
Frontend Request
      |
      |  supabase.functions.invoke(''create-prd'', { body: EdgeFunctionRequest })
      v
Edge Function Handler (serve())
      |
      |  1. validateMethod()      - Check HTTP method
      |  2. validateRequestBody()- Validate required fields
      |  3. loadConfiguration()  - Merge DB config, request overrides, defaults
      |  4. buildPrompts()       - Assemble system and user prompts
      v
AIInteractionService.createInteraction()
      |  Insert pending record to ai_interactions table
      v
AIInteractionService.updateInteractionInProgress()
      |  Set status = ''in_progress'', started_at = now
      v
OpenAIService.generateDocument()
      |  POST to OpenAI Responses API with model, max_output_tokens, temperature
      v
extractOutputText()
      |  Parse response.output_text, clean code fences
      v
AIInteractionService.completeInteraction()
      |  Record token_usage, duration_ms, response_metadata
      v
GeneratedDocumentService.storeDocument()
      |  Calculate word_count, section_count, reading time
      |  Insert to generated_documents table
      v
Response to Frontend (EdgeFunctionResponse)
```

### Shared Infrastructure (`_shared/document-generation/`)

The `_shared/document-generation/` directory contains all common code reused by every document generation function. This ensures consistent behavior across all document types and eliminates duplication.

| File | Responsibility |
|------|---------------|
| `openai-service.ts` | Wraps OpenAI Responses API calls with retry logic and error mapping |
| `ai-interaction-service.ts` | Manages lifecycle of records in `ai_interactions` table |
| `generated-document-service.ts` | Stores generated content to `generated_documents`, calculates metadata |
| `prompt-builder.ts` | Assembles system and user prompts with placeholder injection |
| `response-builder.ts` | Constructs HTTP responses with CORS headers and status codes |
| `openai-helper.ts` | Extracts text from OpenAI response objects, builds input message arrays |
| `validation.ts` | Validates HTTP method and request body structure |
| `token-extractor.ts` | Extracts token usage statistics from OpenAI response metadata |
| `types.ts` | Shared TypeScript interfaces: `RequestBody`, `ResponseData`, `OpenAIConfig`, `DocumentTypeKey` |

## Migration: v1.0 to v2.0

### What Changed

The v1.0 architecture called OpenAI directly from the React frontend. The `generateDocumentsWithOpenAI()` function in `src/lib/openai.ts` accepted an API key (either from the environment or user settings) and made requests directly from the browser. Token usage had to be tracked manually in the frontend after the response arrived.

v2.0 removes all frontend OpenAI calls. The Edge Functions act as a secure proxy. The API key is stored as a Supabase secret (`OPENAI_API_KEY`) and is never exposed to the client. Every generation creates an `ai_interactions` record automatically, and the generated document is stored in `generated_documents` with computed metadata.

### v1.0 (Deprecated)

```typescript
// DEPRECATED - Frontend OpenAI calls
import { generateDocumentsWithOpenAI } from ''@/lib/openai'';

const documents = await generateDocumentsWithOpenAI(
  transcript,
  prompt,
  documentTypes,
  project
);

// Manual token tracking required
const { data: aiInteraction } = await supabase
  .from(''ai_interactions'')
  .insert({ ... });
```

### v2.0 (Current)

```typescript
// CURRENT - All document generation through Edge Functions
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

const result = await generateDocumentAPI(
  ''user-story'',
  transcriptContent,
  projectId,
  meetingTranscriptId,
  userId
);

if (result.success) {
  // Document already saved to generated_documents
  // Token usage already tracked in ai_interactions
  console.log(result.document);
}
```

### What Remains in src/lib/openai.ts

The file `src/lib/openai.ts` still exists and the `generateDocumentsWithOpenAI` function is still imported in a few places. According to the codebase comments, this function is reserved for **task creation workflows only** and should not be used for new document generation code. The frontend service layer (`document-generation-service.ts`) has taken over all document generation responsibilities.

## Edge Functions Reference

### create-prd

Generates a Product Requirements Document from meeting transcript content.

**Endpoint:** `/supabase/functions/create-prd`

**Operation constant:** `create-prd`

**Document type stored:** `prd`

**Request body fields used:**

| Field | Required | Description |
|-------|----------|-------------|
| `content` | Yes | Meeting transcript or description text |
| `project_id` | Yes | Project identifier for isolation |
| `meeting_transcript_id` | No | Link to source transcript |
| `user_id` | No | User performing the action |
| `system_prompt` | No | Override system prompt |
| `user_prompt` | No | Override user prompt template |
| `previous_response_id` | No | For multi-turn conversation continuity |
| `model` | No | Override OpenAI model |
| `temperature` | No | Override randomness (0.0-2.0) |
| `token_limit` | No | Override max output tokens |

### create-user-story

Generates user stories from meeting transcript content.

**Endpoint:** `/supabase/functions/create-user-story`

**Operation constant:** `create-user-story`

**Document type stored:** `user-story`

### create-meeting-notes

Generates structured meeting notes with action items and summaries.

**Endpoint:** `/supabase/functions/create-meeting-notes`

**Operation constant:** `create-meeting-notes`

**Document type stored:** `meeting-notes`

### create-technical-specs

Generates technical specification documents from meeting content.

**Endpoint:** `/supabase/functions/create-technical-specs`

**Operation constant:** `create-technical-specs`

**Document type stored:** `technical-specs`

### create-test-cases

Generates test case documents from requirements or feature descriptions.

**Endpoint:** `/supabase/functions/create-test-cases`

**Operation constant:** `create-test-cases`

**Document type stored:** `test-cases`

### create-unit-tests

Generates unit test code from function code and test scenarios. Accepts structured form data in the `content` field as a JSON string.

**Endpoint:** `/supabase/functions/create-unit-tests`

**Operation constant:** `create-unit-tests`

**Document type stored:** `unit-tests`

**Special request handling:** The `content` field contains a JSON-stringified `UnitTestFormData` object with `language`, `framework`, `functionName`, `functionCode`, `testScenarios`, and `additionalContext`.

**Supported languages:** JavaScript, TypeScript, Python, Java

**Supported frameworks per language:**

| Language | Frameworks |
|----------|------------|
| JavaScript | Jest, Mocha, Jasmine, AVA |
| TypeScript | Jest, Vitest, Mocha, Jasmine |
| Python | pytest, unittest, nose2, doctest |
| Java | JUnit, TestNG, Mockito, Spock |

## Request and Response Formats

### Request Body

All document generation Edge Functions accept the same base request format defined by `RequestBody` in `_shared/document-generation/types.ts`:

```typescript
interface RequestBody {
  content: string;                  // Transcript or input content
  project_id: string;              // Project identifier
  user_id?: string;                // Optional user tracking
  system_prompt?: string;          // Optional custom system prompt override
  user_prompt?: string;            // Optional custom user prompt override
  previous_response_id?: string;   // OpenAI conversation continuity
  model?: string;                  // Optional model override
  temperature?: number;            // Optional temperature override (0.0-2.0)
  token_limit?: number;            // Optional max output tokens override
  meeting_transcript_id?: string;  // Optional transcript reference
}
```

The `content` field carries the input that the AI analyzes to generate the document. For most document types, this is raw text from a meeting transcript. For `create-unit-tests`, it is a JSON string containing the test generation form data.

### Response Body

All document generation Edge Functions return the same base response format defined by `ResponseData` in `_shared/document-generation/types.ts`:

```typescript
interface ResponseData {
  success: boolean;               // Operation status
  document?: string;            // Generated document (Markdown or JSON)
  response_id?: string;         // OpenAI response ID for tracking
  document_id?: string;         // Database ID of stored document
  document_name?: string;       // Generated or extracted document name
  ai_interaction_id?: string;   // AI interaction tracking ID
  error?: string;               // Error message if success is false
}
```

### Frontend Service Request/Response

The frontend `generateDocumentAPI()` in `document-generation-service.ts` wraps the Edge Function call with additional type normalization and error handling:

```typescript
// Request (frontend service)
interface EdgeFunctionRequest {
  content: string;
  project_id: string;
  meeting_transcript_id?: string;
  user_id?: string;
  system_prompt?: string;
  user_prompt?: string;
  previous_response_id?: string;
  model?: string;
  temperature?: number;
  token_limit?: number;
}

// Response (frontend service)
interface EdgeFunctionResponse {
  success: boolean;
  document?: string;
  response_id?: string;
  document_id?: string;
  error?: string;
}
```

## Configuration and Defaults

### OpenAI Configuration Precedence

Each Edge Function uses `loadConfiguration()` from `_shared/platform-settings/config-loader.ts` to merge configuration from three sources with the following precedence:

1. **Request overrides** - Parameters sent in the request body (`model`, `temperature`, `token_limit`)
2. **Database config** - Settings stored in the `platform_settings` table, keyed by document type
3. **Default config** - Hardcoded defaults in each function''s `config.ts`

The merged result is an `OpenAIConfig` object:

```typescript
interface OpenAIConfig {
  model: string;                  // OpenAI model identifier (e.g., ''gpt-4o'')
  max_output_tokens: number;       // Maximum response length (100-20000)
  temperature: number;            // Randomness level (0.0-2.0)
  store: boolean;                 // Store conversation for continuity
  system_prompt?: string;         // AI role definition
  prompt?: string;               // User-facing template with {{content}} placeholder
  token_limit?: number;           // Alias mapped to max_output_tokens
}
```

The `mergeConfigurations()` function in `types.ts` applies precedence and maps `token_limit` to `max_output_tokens` for API compatibility.

### Prompt Template Processing

The `buildPrompts()` function in `prompt-builder.ts` resolves the system and user prompts through a three-step process:

1. Apply request overrides if provided
2. Fall back to database-stored prompts
3. Fall back to the function''s default prompts

The user prompt template supports two placeholder syntaxes that are replaced with the actual content before being sent to the model:

- `{{content}}` - Replaced with the transcript/input content
- `{{transcript}}` - Alias for `{{content}}`

## Shared Types

All shared types are defined in `/supabase/functions/_shared/document-generation/types.ts`. The key types are:

### DocumentTypeKey

A union type of all valid document type identifiers used throughout the system. Covers three document areas:

**Generated Documents (10 types):** `tasks`, `features`, `prd`, `test-cases`, `user-story`, `meeting-notes`, `unit-tests`, `specs`, `accessibility-test-result`, `performance-test-result`

**Planning Documents (24 types):** `requirements`, `user-guides`, `change-requirements`, `functional-summary`, `roadmap`, `business-context`, `company-goals`, `retrospective`, `okrs`, `executive-business-review`, `project-plan`, `status-report`, `4ls-retrospective`, `5-whys-analysis`, `90-day-plan`, `brainstorming`, `competitive-analysis`, `customer-journey-mapping`, `design-systems`, `marketing-plan`, `persona`, `project-charter`, `project-kickoff`, `risk-assessment-matrix`, `statement-of-work`

**Development Documents (6 types):** `architecture`, `technical-specs`, `task-notes`, `code-style-guide`, `technical-summary`, `integration-architecture`

**Governance Documents (11 types):** `compliance`, `processes-workflows`, `resources-tools`, `compliance-legal`, `team-organization`, `technical-standards`, `standard-operating-procedure`, `strategic-plan`

### AIInteractionParams

Parameters for creating an AI interaction record:

```typescript
interface AIInteractionParams {
  project_id: string;
  request_prompt: string;
  request_model: string;
  request_parameters: any;
  previous_interaction_id?: string;
  meeting_transcript_id?: string;
}
```

### TokenUsage

Token usage data extracted from OpenAI responses:

```typescript
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
}
```

### InteractionMetadata

Metadata extracted from OpenAI response headers:

```typescript
interface InteractionMetadata {
  conversation_id: string | null;
  model: string | null;
  created: number | null;
  object: string | null;
}
```

### StoreDocumentParams

Parameters for storing a generated document:

```typescript
interface StoreDocumentParams {
  content: string;
  document_type: DocumentTypeKey;
  document_name?: string;
  project_id: string;
  user_id?: string;
  ai_interaction_id: string;
  meeting_transcript_id?: string;
  sprint_id?: string;
}
```

### DocumentMetadata

Metadata calculated from document content:

```typescript
interface DocumentMetadata {
  word_count: number;
  section_count: number;
  estimated_reading_time: number;
}
```

## Error Handling

### Error Mapping

Edge Functions use `getErrorStatusCode()` in `response-builder.ts` to determine HTTP status codes:

| Condition | Status Code |
|-----------|-------------|
| `Method not allowed` in message | 405 |
| `required` in message | 400 |
| Error has numeric `status` property | Uses that value |
| All other errors | 500 |

### Frontend Error Transformation

The `generateDocumentAPI()` and specialized functions in `document-generation-service.ts` transform raw Edge Function errors into user-friendly messages before displaying them to users. The transformer functions check for common error patterns:

| Error Pattern | User-Friendly Message |
|--------------|----------------------|
| API key or authentication error | "API key not configured. Please configure your OpenAI API key in settings." |
| Rate limit or quota exceeded | "Rate limit exceeded. Please try again later." |
| Validation or invalid request | "Invalid request. Please check your input and try again." |
| Content too long | "Document content is too large. Please use a smaller document or split it into parts." |
| Project not found | "Project not found. Please ensure the project exists." |
| Timeout | "Request timed out. Please try again with a smaller document." |
| Network or connection error | "Network error. Please check your connection and try again." |
| OpenAI server error | "AI service error. Please try again later." |
| Internal server error (500) | "Temporary service error. Please try again in a few moments." |
| Unrecognized error | Returns the original error message |

### Interaction Lifecycle Errors

`ai-interaction-service.ts` handles failures at the tracking layer. When `generateDocument()` throws, `failInteraction()` records the error details including `error.name`, `error.message`, `error.stack`, and timestamp in the `ai_interactions` table. This ensures every failed request has a traceable record even if the Edge Function crashes.

## Usage Patterns

### Basic Document Generation

```typescript
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

const result = await generateDocumentAPI(
  ''prd'',
  meetingTranscriptText,
  selectedProjectId,
  transcriptId,
  currentUserId
);

if (result.success) {
  console.log(''Document:'', result.document);
  console.log(''Stored ID:'', result.document_id);
}
```

### Unit Test Generation

```typescript
import { generateUnitTests } from ''@/lib/services/document-generation-service'';

const formData = {
  language: ''typescript'',
  framework: ''Jest'',
  functionName: ''calculateTotal'',
  functionCode: ''export function calculateTotal(items: number[]): number { return items.reduce((a, b) => a + b, 0); }'',
  testScenarios: [
    { description: ''Should return sum of positive numbers'', input: ''[1, 2, 3]'', expectedOutput: ''6'' },
    { description: ''Should return 0 for empty array'', input: ''[]'', expectedOutput: ''0'' }
  ]
};

const result = await generateUnitTests(formData, projectId, userId);
```

### Backlog Item Generation

```typescript
import { generateBacklogItem } from ''@/lib/services/document-generation-service'';

const result = await generateBacklogItem(
  ''Add dark mode support'',
  projectId,
  userId
);

if (result.success && result.backlog_items) {
  const item = result.backlog_items[0];
  console.log(item.title, item.priority, item.story_points);
}
```

### Task Generation from Content

```typescript
import { generateTasksAPI } from ''@/lib/services/document-generation-service'';

const result = await generateTasksAPI(
  prdContent,
  projectId,
  sourceDocumentId,  // Tracks document relationship
  userId
);
```

## Deployment

Deploy individual Edge Functions:

```bash
supabase functions deploy create-prd
supabase functions deploy create-user-story
supabase functions deploy create-meeting-notes
supabase functions deploy create-technical-specs
supabase functions deploy create-test-cases
supabase functions deploy create-unit-tests
supabase functions deploy analyze-transcript
supabase functions deploy suggest-backlog-item
supabase functions deploy create-backlog-items
supabase functions deploy analyze-sprint
```

Secrets must be configured in the Supabase dashboard or via CLI before deployment:

```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

## Related Documentation

- [Prompt Templates](../09-prompt-templates/templates.md) - Document templates and prompt engineering
- [AI Interaction Tracking](../10-ai-tracking/tracking.md) - Token usage and interaction audit trail
- [Generated Documents](../24-generated-documents/gen-docs.md) - Document storage and retrieval
- [Frontend Document Generation Service](../../ragworkforce/docs/08-document-generation/document-generation-service.md) - Client-side API layer
', 'docs/08-document-generation/edge-functions.md'),
    ('document_generation', 'Prompt Templates', '---
name: prompt-templates
description: Template system, Handlebars syntax, versioning, and template loading
area: 09
maintained_by: template-writer
created: 2026-03-30
updated: 2026-03-30
---

# Prompt Templates

## Overview

The prompt template system provides structured, versioned templates for AI-powered document generation. Templates are authored in Markdown with Handlebars syntax for dynamic content injection, stored at `src/prompts/document-templates/`, and loaded server-side by Supabase Edge Functions. The system supports six core document types: PRD, User Stories, Meeting Notes, Technical Specs, Test Cases, and Tasks.

The template architecture follows a three-layer precedence model: request overrides take highest priority, database configuration comes second, and default values serve as the fallback. This design allows per-project customization while maintaining sensible defaults.

## Template Files

Templates reside in `src/prompts/document-templates/` and are organized by document type:

| File | Document Type | Purpose |
|------|--------------|---------|
| `base-instructions.md` | All types | Global AI behavior rules (language, output format, constraints) |
| `prd.md` | PRD | Product Requirements Document structure |
| `user-stories.md` | User Story | Agile user story generation |
| `meeting-notes.md` | Meeting Notes | Structured meeting summary |
| `technical-specs.md` | Technical Specs | Technical implementation details |
| `test-cases.md` | Test Cases | Test scenarios and validation plans |
| `tasks.md` | Tasks | Technical task decomposition and planning |

The `base-instructions.md` file is special: it defines universal rules applied to all document generation operations. It specifies that all AI output must be in Brazilian Portuguese, that the AI must not fabricate information (using `[TBD]` or `[MISSING]` for unknown data), and that the AI must follow the provided template structure exactly without adding or removing sections.

## Handlebars Syntax Reference

Handlebars provides three categories of expression: variables, conditionals, and iteration. All templates use these consistently.

### Variables

Variables interpolate single values into the output. The syntax uses double curly braces with optional dot notation for nested property access:

```handlebars
# Meeting Notes - {{ meeting.title }}

**Project:** {{ project.name }}
**Date:** {{ meeting.date }}
**Coverage:** {{ coverage.percentage }}%
```

For array indexing within an iteration context, the `@index` variable is available:

```handlebars
#### Test Case {{ @index + 1 }}: {{ this.name }}
```

Dot notation traverses nested objects:

```handlebars
- Load Time: {{ performance.loadTime }}ms
- Response Time: {{ performance.responseTime }}ms
```

### Conditionals

Conditionals render a block only when a value is truthy. The inverse block (`{{else}}`) renders when the value is falsy:

```handlebars
{{ #each e2eTests }}
#### Test Case {{ @index + 1 }}: {{ this.name }}
- **Edge Cases:** {{ this.edgeCases }}
{{ /each }}
```

Note that the `{{ #each }}` block helper iterates over arrays, while the root-level `{{ #each }}` can also iterate over object keys. For conditional output based on a boolean flag:

```handlebars
{{ #if this.isCritical }}
- **Severity:** CRITICAL
{{ else }}
- **Severity:** {{ this.severity }}
{{ /if }}
```

### Loops and Iteration

The `{{ #each }}` block helper iterates over arrays. Inside the block, `this` refers to the current item, and `@index` provides the zero-based position:

```handlebars
### 2. Integration Tests
{{ #each integrationTests }}
#### Test Case {{ @index + 1 }}: {{ this.name }}
- **Modules:** {{ this.modules }}
- **Scenario:** {{ this.scenario }}
- **Steps:**
  {{ #each this.steps }}
  {{ @index + 1 }}. {{ this }}
  {{ /each }}
- **Expected Result:** {{ this.expectedResult }}
{{ /each }}
```

Nested `{{ #each }}` blocks are supported for multi-level data structures. The inner block maintains its own `@index` and `this` context.

### Comments

Handlebars comments are stripped from the output:

```handlebars
{{! This comment will not appear in the output }}
```

### Example: Full Meeting Notes Template

```handlebars
# Meeting Notes - {{ meeting.title }}

## Meeting Details
**Date:** {{ meeting.date }}
**Time:** {{ meeting.time }}
**Duration:** {{ meeting.duration }}
**Type:** {{ meeting.type }}
**Facilitator:** {{ meeting.facilitator }}

## Attendees
{{ #each attendees }}
- **{{ this.name }}** - {{ this.role }} ({{ this.department }})
{{ /each }}

## Action Items
| Item | Owner | Due Date | Priority | Status |
|------|-------|----------|----------|--------|
{{ #each actionItems }}
| {{ this.item }} | {{ this.owner }} | {{ this.dueDate }} | {{ this.priority }} | {{ this.status }} |
{{ /each }}

## Decisions Log
{{ #each decisions }}
### Decision {{ @index + 1 }}: {{ this.title }}
- **Context:** {{ this.context }}
- **Decision:** {{ this.decision }}
- **Rationale:** {{ this.rationale }}
- **Impact:** {{ this.impact }}
{{ /each }}

## Meeting Metrics
- **Attendance Rate:** {{ metrics.attendanceRate }}%
- **Action Items Generated:** {{ metrics.actionItems }}
- **Decisions Made:** {{ metrics.decisions }}
```

## Template Versioning

Templates are versioned through the `is_current_version` flag on the `generated_documents` table in the database. When a new document is generated, the system marks all previous versions of that type for the current project as non-current before inserting the new record.

The versioning strategy follows this pattern:

1. When generating a new PRD, all existing PRD records for the project have `is_current_version` set to `false`.
2. The newly generated PRD is inserted with `is_current_version = true`.
3. The AI model receives the conversation history via `previous_response_id`, enabling it to reference prior outputs when refining or extending documents.
4. Historical versions are retained for audit trails and rollback purposes.

This approach decouples template versioning from document versioning: the template files in `src/prompts/document-templates/` represent the current template logic, while the database tracks individual generated documents and their lineage through conversation IDs.

## Document Types

### PRD (Product Requirements Document)

The PRD template (`prd.md`) produces comprehensive product requirement documents with seven required sections:

1. Executive Summary -- product vision, key meeting insights, primary objectives
2. Problem Statement -- problem definition, current pain points, impact of inaction
3. Solution Overview -- proposed approach, core components, expected outcomes
4. Functional Requirements -- features, user interactions, system behaviors
5. Non-Functional Requirements -- performance, security, scalability, compatibility
6. User Personas -- user types, characteristics, use cases per persona
7. Success Metrics -- KPIs, measurement criteria, milestones

### User Stories

The User Stories template (`user-stories.md`) generates agile stories in the standard three-line format, grouped by epic or feature area. Each story includes acceptance criteria using Given/When/Then notation, priority level, effort estimate, and dependencies.

The template enforces that stories remain user-focused and value-driven, avoiding technical implementation details at the story level. Technical tasks derived from stories are tracked separately.

### Meeting Notes

The Meeting Notes template (`meeting-notes.md`) produces structured summaries with variable sections including meeting metadata, attendee list, agenda, discussion points, decisions made, action items with ownership and due dates, risks and issues, follow-up items, and meeting metrics.

### Technical Specs

The Technical Specs template (`technical-specs.md`) generates implementation-ready specifications covering system architecture, API endpoints, database schema, security requirements, performance requirements, and technical constraints. This template uses technical terminology and includes code snippet placeholders.

### Test Cases

The Test Cases template (`test-cases.md`) produces extensive test documentation covering unit tests, integration tests, end-to-end tests, manual test plans, and user acceptance testing scenarios. Each test includes input data, expected outputs, preconditions, steps, and status tracking.

### Tasks

The Tasks template (`tasks.md`) generates granular technical task breakdowns. Unlike other templates, it outputs structured JSON instead of Markdown. Each task includes title, description, task_type, priority, estimated hours, story points, dependencies, and developer assignment. The template implements a developer scoring algorithm based on skills, availability, and workload.

## How Edge Functions Load and Use Templates

Templates are not loaded from the filesystem at runtime. Instead, each Edge Function contains its own hardcoded prompt definitions in a `config.ts` file. This approach avoids filesystem access complexity in the Deno runtime and ensures templates are deployed alongside the function code.

The loading chain follows this sequence:

1. The Edge Function handler receives a `RequestBody` with `content`, `project_id`, and optional overrides (`system_prompt`, `user_prompt`, `model`, `temperature`, `token_limit`, `previous_response_id`).

2. The function calls `loadConfiguration()` which queries the `platform_settings` table for the relevant configuration key (e.g., `ai-create-prd`, `ai-create-user-story`). If found, the database values override defaults.

3. The function calls `buildPrompts()` which merges the configuration sources following precedence: request overrides > database config > default config. The `replacePromptPlaceholders()` utility injects the user content into the prompt template using `{{content}}` or `{{transcript}}` placeholders.

4. The constructed prompts are passed to `OpenAIService.generateDocument()` along with the selected model, temperature, and token limits.

5. The generated document is stored in `generated_documents` with the appropriate `document_type` and `is_current_version = true`.

The configuration precedence is logged for debugging:

```typescript
console.log(`${logPrefix} Configuration sources:`, {
  model: ''request'' | ''database'' | ''default'',
  temperature: ''request'' | ''database'' | ''default'',
  token_limit: ''request'' | ''database'' | ''default''
});
```

### Default Configuration Example

Each Edge Function defines its defaults in `config.ts`. For example, `create-prd/config.ts`:

```typescript
export const CONFIG_KEY = ''ai-create-prd'';

export const DEFAULT_SYSTEM_PROMPT = `You are a specialized Product Requirements Document (PRD) generator...`;

export const DEFAULT_USER_PROMPT = `Generate a detailed Product Requirements Document based on the following content:`;

export const OPENAI_CONFIG: OpenAIConfig = {
  model: ''gpt-4o'',
  max_output_tokens: 8000,
  token_limit: 8000,
  temperature: 0.6,
  store: false
};
```

## Conversation IDs for Multi-Document Sessions

The OpenAI Responses API supports conversation continuity through `previous_response_id`. When generating multiple related documents, passing the previous response ID allows the model to maintain context across the session.

Use `generateDocumentAPI()` with the `previous_response_id` parameter:

```typescript
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

// Generate first document
const result1 = await generateDocumentAPI(
  ''prd'',
  meetingTranscriptContent,
  projectId,
  meetingTranscriptId
);

// Generate follow-up document with conversation continuity
const result2 = await generateDocumentAPI(
  ''user-stories'',
  additionalContent,
  projectId,
  undefined,           // no transcript ID
  undefined,           // no user ID
  result1.response_id  // maintain conversation context
);
```

The `previous_response_id` is stored in the `ai_interactions` table via the `previous_interaction_id` field, enabling audit trails of multi-document generation chains.

## Automatic Model Selection

The system uses automatic model selection based on document complexity:

| Model | Use Case | Configuration |
|-------|----------|---------------|
| `gpt-4o` | Complex documents (PRD, Technical Specs, Test Cases) | `temperature: 0.6`, `max_output_tokens: 8000` |
| `gpt-4o-mini` | Simple documents (Task notes, quick summaries) | Lower token limits, faster response |

The model is selected through the configuration merge process in `loadConfiguration()`. The default config for each document type specifies the appropriate model, which can be overridden per-request or per-project through the `platform_settings` database table.

The `temperature` setting of `0.6` balances determinism with creative flexibility, ensuring consistent document structure while allowing natural language variation.

Token limits are set to 8000 by default for complex documents, accommodating full PRD and technical specification outputs. The `token_limit` field maps to `max_output_tokens` in the OpenAI API request.

## Prompt Placeholder System

The `replacePromptPlaceholders()` function in `types.ts` handles dynamic content injection:

```typescript
export function replacePromptPlaceholders(prompt: string, content: string): string {
  return prompt
    .replace(/\{\{content\}\}/g, content)
    .replace(/\{\{transcript\}\}/g, content);
}
```

Both `{{content}}` and `{{transcript}}` are supported as placeholders, providing flexibility in how prompts are authored. The function uses regex replacement with the global flag to replace all occurrences.

## Language and Output Rules

All templates and AI outputs default to Brazilian Portuguese, as enforced by `base-instructions.md`. The base instructions define critical rules:

- Output language: Always Brazilian Portuguese unless explicitly told otherwise
- Information integrity: Never fabricate dates, numbers, or scope. Use `[TBD]` or `[MISSING]` for unknown information
- Structure adherence: Never change or ignore the template structure
- Detail preservation: Maintain the level of detail in the source; do not infer non-existent details

These rules are embedded in the system prompt for every document generation request, ensuring consistent behavior across all document types.

## Related Topics

- [Document Generation](../08-document-generation/edge-functions.md) -- Edge Function implementation details
- [Generated Documents](../24-generated-documents/gen-docs.md) -- Document storage and retrieval
- [AI Tracking](../10-ai-tracking/tracking.md) -- Token usage and cost tracking
', 'docs/09-prompt-templates/templates.md'),
    ('document_generation', 'AI Interaction Tracking', '---
name: ai-tracking
description: AI interaction tracking, token usage, cost monitoring, ai_interactions table
area: 10
maintained_by: tracking-analyst
created: 2026-03-30
updated: 2026-03-30
---

# AI Interaction Tracking

## Overview

Every OpenAI API call made by document generation Edge Functions is automatically tracked in the `ai_interactions` table. Tracking is handled server-side by the `AIInteractionService` class, ensuring all token usage and cost data is captured without any frontend involvement. This provides a complete audit trail for cost monitoring, usage analysis, and conversation continuity across document generation sessions.

## ai_interactions Table

The `ai_interactions` table stores a record for each AI API call, capturing the full lifecycle from request to response.

### Columns

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | Primary key, auto-generated |
| `project_id` | `uuid` | Project association for isolation and cost attribution |
| `user_id` | `uuid` | User who initiated the request (optional) |
| `meeting_transcript_id` | `uuid` | Source transcript link (optional) |
| `previous_interaction_id` | `uuid` | Parent interaction for conversation chains (optional) |
| `interaction_type` | `text` | Type identifier, e.g. `document-generation`, `task-creation` |
| `status` | `text` | Lifecycle status: `pending`, `in_progress`, `completed`, `failed` |
| `sequence_order` | `integer` | Order within a multi-turn conversation sequence |
| `request_prompt` | `text` | Original prompt sent to the model |
| `request_model` | `text` | OpenAI model used for this request |
| `request_parameters` | `jsonb` | Parameters sent with the request (temperature, max_tokens, etc.) |
| `response_text` | `text` | AI-generated response content |
| `token_usage` | `jsonb` | Token breakdown: `{input_tokens, output_tokens, total_tokens}` |
| `openai_conversation_id` | `text` | OpenAI conversation/response ID for continuity |
| `response_metadata` | `jsonb` | Additional response metadata (model, created, object) |
| `duration_ms` | `integer` | Request duration in milliseconds |
| `error_message` | `text` | Error message if status is `failed` |
| `error_details` | `jsonb` | Full error stack and timestamp on failure |
| `started_at` | `timestamp with time zone` | When processing began |
| `completed_at` | `timestamp with time zone` | When processing finished |
| `created_at` | `timestamp with time zone` | Record creation timestamp |

### Key Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory) -- ensures all interactions are isolated by project
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional) -- links input source
- `previous_interaction_id` -> `ai_interactions.id` (self-reference) -- enables conversation chains
- Referenced by `generated_documents.ai_interaction_id`
- Referenced by `dev_tasks.generated_from_interaction_id`
- Referenced by `audit_trail.ai_interaction_id`

## How Server-Side Tracking Works

Edge Functions use the `AIInteractionService` class to manage the full lifecycle of each interaction. The service creates a record at the start of the request, updates it during processing, and finalizes it with token usage and cost data upon completion.

### Interaction Lifecycle

The lifecycle follows four states:

1. **pending** -- Record created with request metadata before the API call
2. **in_progress** -- Status updated and `started_at` set when the request begins
3. **completed** -- Finalized with response text, token usage, and duration after success
4. **failed** -- Error details recorded if the request fails

### Lifecycle Implementation

```typescript
import { AIInteractionService } from ''./_shared/document-generation/ai-interaction-service.ts'';

const service = new AIInteractionService(supabase, ''create-prd'');

// Step 1: Create pending record
const interactionId = await service.createInteraction({
  project_id: projectId,
  request_prompt: prompt,
  request_model: ''gpt-4o'',
  request_parameters: { temperature: 0.7, max_output_tokens: 8000 },
  previous_interaction_id: previousId,   // Optional, for conversation chains
  meeting_transcript_id: transcriptId,    // Optional, for document generation
});

// Step 2: Mark as in progress
await service.updateInteractionInProgress(interactionId);

// Step 3: Call OpenAI
const response = await openai.responses.create({ ... });

// Step 4: Complete with token usage
await service.completeInteraction(interactionId, response, document, startTime);

// On error: await service.failInteraction(interactionId, error, startTime);
```

The `completeInteraction` method automatically extracts token usage and response metadata from the OpenAI response:

```typescript
const tokenUsage = extractTokenUsage(response);
// Returns: { input_tokens: number, output_tokens: number, total_tokens: number }

const metadata = extractResponseMetadata(response);
// Returns: { conversation_id, model, created, object }
```

### Extracted Token Usage

Token usage is extracted from the OpenAI response `usage` object:

```typescript
function extractTokenUsage(response: any): TokenUsage {
  const usage = response?.usage || {};
  return {
    input_tokens: usage.input_tokens || 0,
    output_tokens: usage.output_tokens || 0,
    total_tokens: usage.total_tokens || (usage.input_tokens || 0) + (usage.output_tokens || 0),
  };
}
```

## Token Usage Monitoring

### Per-Interaction Breakdown

Each record in `ai_interactions` contains a `token_usage` JSONB field with the full breakdown:

```json
{
  "input_tokens": 1250,
  "output_tokens": 3800,
  "total_tokens": 5050
}
```

### Querying Usage for a Project

Get total token consumption for a specific project over a time range:

```sql
SELECT
  COUNT(*) AS total_requests,
  SUM((token_usage->>''input_tokens'')::int)  AS total_input_tokens,
  SUM((token_usage->>''output_tokens'')::int) AS total_output_tokens,
  SUM((token_usage->>''total_tokens'')::int)  AS total_tokens
FROM ai_interactions
WHERE project_id = ''your-project-uuid''
  AND status = ''completed''
  AND created_at >= NOW() - INTERVAL ''30 days'';
```

### Usage by Model

Break down token consumption by model to understand where costs are concentrated:

```sql
SELECT
  request_model,
  COUNT(*) AS request_count,
  SUM((token_usage->>''total_tokens'')::int) AS total_tokens,
  ROUND(
    SUM((token_usage->>''total_tokens'')::int)::numeric /
    NULLIF(COUNT(*), 0),
    0
  ) AS avg_tokens_per_request
FROM ai_interactions
WHERE project_id = ''your-project-uuid''
  AND status = ''completed''
GROUP BY request_model
ORDER BY total_tokens DESC;
```

### Daily Usage Trend

Track daily consumption to identify usage patterns:

```sql
SELECT
  DATE(created_at) AS usage_date,
  COUNT(*) AS requests,
  SUM((token_usage->>''total_tokens'')::int) AS tokens,
  COUNT(DISTINCT user_id) AS active_users
FROM ai_interactions
WHERE project_id = ''your-project-uuid''
  AND status = ''completed''
GROUP BY DATE(created_at)
ORDER BY usage_date DESC
LIMIT 30;
```

### Failed Interactions

Identify failed requests to diagnose issues:

```sql
SELECT
  id,
  request_model,
  error_message,
  created_at,
  duration_ms
FROM ai_interactions
WHERE project_id = ''your-project-uuid''
  AND status = ''failed''
ORDER BY created_at DESC
LIMIT 20;
```

## Cost Calculation

### Per-Model Pricing

Costs are calculated using OpenAI''s per-token pricing (per 1 million tokens):

| Model | Input Price ($/1M tokens) | Output Price ($/1M tokens) |
|-------|---------------------------|----------------------------|
| `gpt-4o` | $5.00 | $15.00 |
| `gpt-4o-mini` | $0.15 | $0.60 |
| `gpt-4-turbo` | $10.00 | $30.00 |
| `gpt-4` | $30.00 | $60.00 |
| `gpt-3.5-turbo` | $0.50 | $1.50 |

Pricing source: `_shared/external-service-utils.ts::calculateOpenAICost()`. Unknown models fall back to `gpt-4o-mini` pricing.

### Cost Formula

```
cost = (input_tokens / 1,000,000) * input_price
     + (output_tokens / 1,000,000) * output_price
```

Implementation from `_shared/external-service-utils.ts`:

```typescript
export function calculateOpenAICost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing: Record<string, { input: number; output: number }> = {
    ''gpt-4o'': { input: 5.0, output: 15.0 },
    ''gpt-4o-mini'': { input: 0.15, output: 0.60 },
    ''gpt-4-turbo'': { input: 10.0, output: 30.0 },
    ''gpt-4'': { input: 30.0, output: 60.0 },
    ''gpt-3.5-turbo'': { input: 0.50, output: 1.50 },
  };

  const modelPricing = pricing[model] || pricing[''gpt-4o-mini''];
  const inputCost = (inputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (outputTokens / 1_000_000) * modelPricing.output;

  return inputCost + outputCost;
}
```

### Example Cost Calculations

A document generation request using `gpt-4o-mini` with 1,500 input tokens and 4,000 output tokens:

```
input cost  = (1,500 / 1,000,000) * 0.15  = $0.000225
output cost = (4,000 / 1,000,000) * 0.60  = $0.002400
total cost  = $0.002625
```

The same request with `gpt-4o` instead:

```
input cost  = (1,500 / 1,000,000) * 5.00  = $0.007500
output cost = (4,000 / 1,000,000) * 15.00 = $0.060000
total cost  = $0.067500
```

Using `gpt-4o-mini` results in approximately **96% cost savings** for this request.

### Querying Total Cost for a Project

```sql
SELECT
  request_model,
  COUNT(*) AS request_count,
  SUM((token_usage->>''input_tokens'')::int)  AS input_tokens,
  SUM((token_usage->>''output_tokens'')::int) AS output_tokens,
  SUM((token_usage->>''total_tokens'')::int)  AS total_tokens,
  ROUND(SUM(
    (token_usage->>''input_tokens'')::int  / 1_000_000.0 * COALESCE(NULLIF((pricing->>request_model->>''input''), '''')::numeric, 0.15)
    + (token_usage->>''output_tokens'')::int / 1_000_000.0 * COALESCE(NULLIF((pricing->>request_model->>''output''), '''')::numeric, 0.60)
  ), 6) AS estimated_cost_usd
FROM ai_interactions,
  jsonb_build_object(
    ''gpt-4o'',      jsonb_build_object(''input'', 5.0,  ''output'', 15.0),
    ''gpt-4o-mini'', jsonb_build_object(''input'', 0.15, ''output'', 0.60)
  ) AS pricing
WHERE project_id = ''your-project-uuid''
  AND status = ''completed''
GROUP BY request_model
ORDER BY estimated_cost_usd DESC;
```

## Cost Optimization

### Model Selection Strategy

The system uses automatic model selection to balance cost and quality:

| Task Complexity | Default Model | Rationale |
|-----------------|---------------|-----------|
| Simple, well-defined documents (meeting notes, basic PRDs) | `gpt-4o-mini` | Faster and significantly cheaper |
| Complex generation (features, technical specs, unit tests) | `gpt-4o` | Better reasoning and output quality |
| User override | Custom model | User-specified via `model` parameter |

### Cost Optimization Techniques

1. **Server-side model selection** -- Edge Functions select the appropriate model based on document type complexity, eliminating unnecessary `gpt-4o` usage.

2. **Token limits enforced** -- The `token_limit` parameter caps output tokens per request, preventing runaway generation and unexpected costs.

3. **GPT-4o-mini as fallback** -- Unknown models default to `gpt-4o-mini` pricing to prevent budget overruns from experimental model versions.

4. **Conversation continuity** -- Multi-document sessions reuse conversation context via `previous_response_id`, reducing input token overhead on follow-up requests.

### Requesting a Specific Model

Override the default model in the API call:

```typescript
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

const result = await generateDocumentAPI(
  ''prd'',
  transcriptContent,
  projectId,
  undefined,
  undefined,
  { model: ''gpt-4o'' }  // Force gpt-4o for complex requirements
);
```

## response_id for Conversation Continuity

### What Is response_id

The `openai_conversation_id` field (populated from `response.id`) uniquely identifies each OpenAI API response. This value can be passed to subsequent requests as `previous_response_id` to maintain conversational context across multiple turns.

### Why Use Conversation Continuity

When generating multiple related documents or refining content across several steps, passing the previous `response_id` allows the model to maintain context from earlier interactions. This is particularly valuable for:

- Iterative document refinement (generate, review, regenerate)
- Multi-document sessions where each document builds on the previous one
- Complex features that require multiple generation passes

### Implementation

```typescript
// First generation call
const result1 = await generateDocumentAPI(
  ''user-story'',
  transcriptContent,
  projectId,
  transcriptId
);

console.log(result1.response_id);   // e.g., "resp_abc123xyz"

// Second call with continuity
const result2 = await generateDocumentAPI(
  ''prd'',
  refinedContent,
  projectId,
  undefined,
  undefined,
  { previous_response_id: result1.response_id }
);

// The AI now has context from the user-story generation
```

In the Edge Function, `previous_response_id` is forwarded to the OpenAI API:

```typescript
const response = await this.client.responses.create({
  model: config.model!,
  input: messages,
  previous_response_id: previousResponseId || undefined,  // Enables continuity
  max_output_tokens: config.max_output_tokens!,
  temperature: config.temperature!,
  store: config.store!,
});
```

### Chaining Interactions in the Database

The `previous_interaction_id` column in `ai_interactions` mirrors this continuity at the database level:

```sql
-- Find all interactions in a conversation chain
WITH RECURSIVE conversation_chain AS (
  SELECT id, project_id, request_model, status,
         token_usage, created_at, previous_interaction_id, 1 AS depth
  FROM ai_interactions
  WHERE id = ''interaction-uuid''

  UNION ALL

  SELECT i.id, i.project_id, i.request_model, i.status,
         i.token_usage, i.created_at, i.previous_interaction_id, cc.depth + 1
  FROM ai_interactions i
  INNER JOIN conversation_chain cc ON i.previous_interaction_id = cc.id
)
SELECT * FROM conversation_chain ORDER BY depth;
```

## Tracking Status Reference

| Status | Meaning |
|--------|---------|
| `pending` | Interaction record created, request not yet sent to OpenAI |
| `in_progress` | OpenAI API request is underway |
| `completed` | Request finished successfully, response stored |
| `failed` | Request failed, error details recorded |

Failed records are not deleted. They remain in the table with `status = ''failed''` and `error_message` populated, ensuring complete audit coverage including unsuccessful attempts.

## Related Documentation

- [Document Generation - Edge Functions](../08-document-generation/edge-functions.md) -- Complete Edge Function reference including AIInteractionService integration
- [Generated Documents](../24-generated-documents/gen-docs.md) -- Document storage linked to AI interactions
- [Database Schema](../04-database-schema/schema.md) -- Full ai_interactions table definition and relationships
- [Prompt Templates](../09-prompt-templates/templates.md) -- Templates that drive AI interactions
', 'docs/10-ai-tracking/tracking.md'),
    ('document_generation', 'Generated Documents', '---
name: generated-documents
description: generated_documents table, document types, versioning, retrieval patterns
area: 24
maintained_by: generated-docs-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Generated Documents

## Overview

The `generated_documents` table stores all AI-produced content created through the document generation system. Documents are created by Supabase Edge Functions, versioned through the `is_current_version` flag and `version_number` column, and always scoped to a project. Every document links back to the source `meeting_transcript` that triggered its creation and to the `ai_interaction` record that tracks token usage and cost.

This document covers the complete table schema, the full catalog of document types, how versioning works, how documents relate to transcripts, and the recommended retrieval patterns for each use case.

## generated_documents Table

### Column Reference

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | Primary key |
| `project_id` | uuid | NO | null | FK to `project_knowledge_base.id` -- project isolation anchor |
| `meeting_transcript_id` | uuid | YES | null | FK to `meeting_transcripts.id` -- source transcript |
| `ai_interaction_id` | uuid | NO | null | FK to `ai_interactions.id` -- source AI interaction record |
| `sprint_id` | uuid | YES | null | FK to `sprints.id` -- associated sprint |
| `status` | text | NO | `''draft''` | Workflow status: draft, submitted, approved, rejected |
| `document_type` | text | YES | null | Document type identifier (e.g., `prd`, `user-story`, `meeting-notes`) |
| `document_name` | text | YES | null | Human-readable document display name |
| `content_markdown` | text | NO | null | Generated document content in Markdown format |
| `raw_content` | text | YES | null | Unprocessed content before any transformation |
| `content_format` | text | YES | `''markdown''` | Format of the content field (e.g., `markdown`, `json`) |
| `version_number` | integer | YES | `1` | Incremental version number for this document family |
| `is_current_version` | boolean | YES | `true` | Whether this record is the active version |
| `replaced_by` | uuid | YES | null | FK to `generated_documents.id` -- the document that superseded this one |
| `word_count` | integer | YES | null | Word count of the document content |
| `section_count` | integer | YES | null | Number of sections detected in the document |
| `estimated_reading_time` | integer | YES | null | Estimated reading time in minutes |
| `quality_score` | numeric | YES | null | AI-assessed quality score |
| `quality_issues` | text[] | YES | `''{}''` | List of identified quality issues |
| `validation_results` | jsonb | YES | `''{}''` | Structured document validation results |
| `company_knowledge_ids` | jsonb | YES | `''[]''` | Referenced company knowledge base entry IDs |
| `submitted_by` | uuid | YES | null | User who submitted the document for approval |
| `submitted_for_approval_at` | timestamptz | YES | null | Timestamp of submission |
| `approved_by` | uuid | YES | null | User who approved the document |
| `approved_at` | timestamptz | YES | null | Approval timestamp |
| `approval_notes` | text | YES | null | Notes recorded at approval time |
| `rejected_by` | uuid | YES | null | User who rejected the document |
| `rejected_at` | timestamptz | YES | null | Rejection timestamp |
| `rejection_reason` | text | YES | null | Reason recorded at rejection time |
| `created_by` | text | YES | null | Creator reference (user ID or system identifier) |
| `created_at` | timestamptz | YES | `now()` | Creation timestamp |
| `updated_at` | timestamptz | YES | `now()` | Last modification timestamp |
| `deleted_at` | timestamptz | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional -- source transcript)
- `ai_interaction_id` -> `ai_interactions.id` (N:1, mandatory -- AI tracking)
- `sprint_id` -> `sprints.id` (N:1, optional -- sprint context)
- `replaced_by` -> `generated_documents.id` (self-reference -- version chain)

### Indexes

| Index | Purpose |
|-------|---------|
| Primary key on `id` | Unique row identifier |
| Index on `project_id` | Project-scoped filtering |
| Index on `meeting_transcript_id` | Transcript-linked document lookup |
| Index on `ai_interaction_id` | AI interaction traceability |
| Index on `sprint_id` | Sprint-based document queries |
| Index on `status` | Workflow status filtering |
| Index on `document_type` | Document type filtering |
| Index on `is_current_version` | Current version filtering |
| Index on `deleted_at` | Soft-delete exclusion |
| Composite on `(project_id, document_type)` | Efficient per-type project queries |
| Composite on `(project_id, meeting_transcript_id)` | Efficient transcript-linked queries |

### RLS Policy

Documents are isolated by project_id through the standard project isolation policy, which checks that the authenticated user has a record in `user_project_access` for the target project.

```sql
CREATE POLICY documents_project_isolation ON generated_documents
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

## Document Types

### Primary Document Types (Generated via Edge Functions)

These six types are produced by the document generation Edge Functions:

| Type Key | Display Name | Edge Function | Content Format |
|----------|-------------|---------------|----------------|
| `prd` | Product Requirements Document | `create-prd` | Markdown |
| `user-story` | User Stories | `create-user-story` | Markdown |
| `meeting-notes` | Meeting Notes | `create-meeting-notes` | Markdown |
| `technical-specs` | Technical Specifications | `create-technical-specs` | Markdown |
| `test-cases` | Test Cases | `create-test-cases` | Markdown |
| `unit-tests` | Unit Test Code | `create-unit-tests` | Markdown (code blocks) |

### Extended Document Type Catalog

The system supports a broader catalog of 51 document types organized into four areas. These types are defined as `DocumentTypeKey` in the shared types and used throughout the generation pipeline.

**Generated Documents (10 types):**
`tasks`, `features`, `prd`, `test-cases`, `user-story`, `meeting-notes`, `unit-tests`, `specs`, `accessibility-test-result`, `performance-test-result`

**Planning Documents (24 types):**
`requirements`, `user-guides`, `change-requirements`, `functional-summary`, `roadmap`, `business-context`, `company-goals`, `retrospective`, `okrs`, `executive-business-review`, `project-plan`, `status-report`, `4ls-retrospective`, `5-whys-analysis`, `90-day-plan`, `brainstorming`, `competitive-analysis`, `customer-journey-mapping`, `design-systems`, `marketing-plan`, `persona`, `project-charter`, `project-kickoff`, `risk-assessment-matrix`, `statement-of-work`

**Development Documents (6 types):**
`architecture`, `technical-specs`, `task-notes`, `code-style-guide`, `technical-summary`, `integration-architecture`

**Governance Documents (11 types):**
`compliance`, `processes-workflows`, `resources-tools`, `compliance-legal`, `team-organization`, `technical-standards`, `standard-operating-procedure`, `strategic-plan`

## Versioning

### How Versioning Works

Each document generation request for a given `(project_id, document_type, meeting_transcript_id)` tuple creates a new version. The versioning strategy uses two columns in coordination:

- `is_current_version` (boolean) -- marks which record is the active one. Only one record per document family can have `true` at any time.
- `version_number` (integer) -- provides a human-readable sequential counter within the document family.

When a new document is generated:

1. All existing records matching the same `(project_id, document_type, meeting_transcript_id)` are updated to set `is_current_version = false`.
2. The `version_number` is calculated as `MAX(existing_version_number) + 1` from those records.
3. The new document is inserted with `is_current_version = true` and the calculated `version_number`.
4. If the previous current version exists, its `replaced_by` field is set to point to the new document.

This creates a linear version chain: every historical version remains accessible, the active version is always identifiable via `is_current_version = true`, and the chain is traversable through `replaced_by`.

### Versioning in Code

The `GeneratedDocumentService` in the shared Edge Function infrastructure handles versioning:

```typescript
// From generated-document-service.ts
const versionNumber = await getNextVersionNumber(supabase, {
  projectId: params.project_id,
  documentType: params.document_type,
  meetingTranscriptId: params.meeting_transcript_id,
});

// Mark all existing versions as non-current
await supabase
  .from(''generated_documents'')
  .update({
    is_current_version: false,
    replaced_by: newDocumentId,
  })
  .eq(''project_id'', params.project_id)
  .eq(''document_type'', params.document_type)
  .eq(''meeting_transcript_id'', params.meeting_transcript_id)
  .eq(''is_current_version'', true);

// Insert new version as current
await supabase
  .from(''generated_documents'')
  .insert({
    ...params,
    version_number: versionNumber,
    is_current_version: true,
  });
```

### Accessing Version History

To retrieve all versions of a document family:

```typescript
const { data: versions } = await supabase
  .from(''generated_documents'')
  .select(''id, version_number, is_current_version, created_at, created_by'')
  .eq(''project_id'', projectId)
  .eq(''document_type'', ''prd'')
  .eq(''meeting_transcript_id'', transcriptId)
  .is(''deleted_at'', null)
  .order(''version_number'', { ascending: false });
```

## Transcript Relationships

### Why Transcripts Matter

Every document generation request originates from a `meeting_transcript`. The transcript provides the content that the AI model analyzes. This relationship enables:

- **Traceability** -- knowing which meeting produced which document
- **Context continuity** -- subsequent document generations can reference prior outputs via `previous_response_id`
- **Audit trail** -- linking documents back to their source through `meeting_transcript_id`
- **Conversation chains** -- multi-document sessions maintain continuity through the transcript + AI interaction chain

### Linking Documents to Transcripts

When invoking a document generation Edge Function, pass `meeting_transcript_id` to establish the relationship:

```typescript
import { generateDocumentAPI } from ''@/lib/services/document-generation-service'';

const result = await generateDocumentAPI(
  ''prd'',
  transcriptText,              // The content extracted from the transcript
  projectId,                    // Project scope
  transcriptId,                 // Establishes the transcript link
  userId                        // Creator tracking
);
```

The response includes `document_id` which can be stored alongside the transcript reference:

```typescript
if (result.success) {
  // The document is already stored in generated_documents
  // with meeting_transcript_id set to the provided transcriptId
  console.log(''Document stored:'', result.document_id);
  console.log(''AI interaction:'', result.ai_interaction_id);
}
```

### Querying Documents by Transcript

To find all documents generated from a specific transcript:

```typescript
const { data: documents } = await supabase
  .from(''generated_documents'')
  .select(''*'')
  .eq(''meeting_transcript_id'', transcriptId)
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });
```

## Retrieval Patterns

### Pattern 1: By Project (all current documents)

Retrieve all current-version documents within a project. This is the primary pattern for the document list view.

```typescript
const { data: documents } = await supabase
  .from(''generated_documents'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });
```

### Pattern 2: By Project and Type (filtered)

Retrieve all current-version documents of a specific type within a project. Use this when displaying a filtered list, such as all PRDs or all User Stories.

```typescript
const { data: prds } = await supabase
  .from(''generated_documents'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .eq(''document_type'', ''prd'')
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });
```

### Pattern 3: By Transcript (all documents from one meeting)

Retrieve all current-version documents linked to a specific transcript. Use this on the transcript detail view to show everything generated from a meeting.

```typescript
const { data: documents } = await supabase
  .from(''generated_documents'')
  .select(''id, document_type, document_name, status, is_current_version, version_number, created_at'')
  .eq(''meeting_transcript_id'', transcriptId)
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''document_type'');
```

### Pattern 4: Single Document by ID

Retrieve a specific document by its ID. Use this when navigating directly to a document''s detail view.

```typescript
const { data: document } = await supabase
  .from(''generated_documents'')
  .select(''*'')
  .eq(''id'', documentId)
  .eq(''project_id'', selectedProjectId)  // Always validate project scope
  .is(''deleted_at'', null)
  .single();
```

### Pattern 5: With Transcript Join

Retrieve documents with their associated transcript information using the `documents_with_transcripts` view:

```typescript
const { data: documents } = await supabase
  .from(''documents_with_transcripts'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });
```

The view returns each document alongside `transcript_title`, `transcript_date`, and `transcript_speakers` from the joined `meeting_transcripts` table.

### Pattern 6: By Status (workflow filtering)

Retrieve documents by their approval workflow status:

```typescript
const { data: pending } = await supabase
  .from(''generated_documents'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .eq(''status'', ''submitted'')
  .eq(''is_current_version'', true)
  .is(''deleted_at'', null)
  .order(''submitted_for_approval_at'', { ascending: false });
```

### Pattern 7: Using TanStack Query

All retrieval patterns integrate with TanStack Query v5 for caching and synchronization:

```typescript
import { useQuery } from ''@tanstack/react-query'';

const { data: documents, isLoading } = useQuery({
  queryKey: [''documents'', ''current'', selectedProjectId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from(''generated_documents'')
      .select(''*'')
      .eq(''project_id'', selectedProjectId)
      .eq(''is_current_version'', true)
      .is(''deleted_at'', null)
      .order(''created_at'', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProjectId,  // Only run when project is selected
});
```

For transcript-scoped documents:

```typescript
const { data: transcriptDocs } = useQuery({
  queryKey: [''documents'', ''transcript'', transcriptId],
  queryFn: async () => {
    const { data, error } = await supabase
      .from(''generated_documents'')
      .select(''*'')
      .eq(''meeting_transcript_id'', transcriptId)
      .eq(''is_current_version'', true)
      .is(''deleted_at'', null)
      .order(''document_type'');

    if (error) throw error;
    return data;
  },
  enabled: !!transcriptId,
});
```

## Document Status Workflow

Documents progress through a workflow defined by the `status` column:

| Status | Description | Next States |
|--------|-------------|-------------|
| `draft` | Initial state after generation | `submitted`, `rejected` |
| `submitted` | Submitted for review/approval | `approved`, `rejected` |
| `approved` | Reviewed and accepted | -- (terminal) |
| `rejected` | Reviewed and rejected | `draft`, `submitted` |

The `submitted_by`, `approved_by`, and `rejected_by` columns track the users who performed these actions, with corresponding timestamps.

## Document Metadata

### Content Metrics

When a document is stored, `GeneratedDocumentService` calculates three content metrics:

- `word_count` -- total words in `content_markdown`
- `section_count` -- number of top-level sections (Markdown headings)
- `estimated_reading_time` -- calculated as `ceil(word_count / 200)` minutes, assuming 200 words per minute reading speed

These metrics are useful for displaying document summaries and estimating review time.

### Quality Assessment

The `quality_score`, `quality_issues`, and `validation_results` columns support document quality workflows. The AI model can be configured to assess output quality, and the results are stored alongside the document for downstream review processes.

## Common Queries Reference

```sql
-- All current documents for a project
SELECT id, document_type, document_name, version_number, status, created_at
FROM generated_documents
WHERE project_id = ''...''
  AND is_current_version = true
  AND deleted_at IS NULL
ORDER BY document_type, created_at DESC;

-- Version history for a specific document
SELECT id, version_number, is_current_version, created_at, replaced_by
FROM generated_documents
WHERE project_id = ''...''
  AND document_type = ''prd''
  AND meeting_transcript_id = ''...''
  AND deleted_at IS NULL
ORDER BY version_number DESC;

-- Documents awaiting approval
SELECT id, document_type, document_name, submitted_by, submitted_for_approval_at
FROM generated_documents
WHERE project_id = ''...''
  AND status = ''submitted''
  AND is_current_version = true
  AND deleted_at IS NULL
ORDER BY submitted_for_approval_at ASC;

-- AI cost per document type (via ai_interactions join)
SELECT
  gd.document_type,
  COUNT(*) as generation_count,
  SUM(ai.cost_usd) as total_cost_usd,
  SUM((ai.token_usage->>''total_tokens'')::int) as total_tokens
FROM generated_documents gd
JOIN ai_interactions ai ON ai.id = gd.ai_interaction_id
WHERE gd.project_id = ''...''
  AND gd.deleted_at IS NULL
  AND ai.deleted_at IS NULL
GROUP BY gd.document_type
ORDER BY total_cost_usd DESC;
```

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---------|--------------|------------|
| Document not found | Wrong `project_id` filter, or document was soft-deleted | Verify `selectedProjectId` is set; check `deleted_at IS NULL` |
| Old version displaying | Cached query returning stale data | Invalidate the TanStack Query cache; add `is_current_version = true` filter |
| Generation succeeded but document missing | `meeting_transcript_id` mismatch in filter | Ensure the same `transcriptId` used for generation is used in retrieval |
| All versions showing instead of current | Missing `is_current_version = true` filter | Always filter by `is_current_version = true` for current-state queries |
| Document count does not match UI | Soft-deleted records excluded | Query includes `deleted_at IS NULL`; deleted documents are hidden |
| Query performance is slow | Missing index on filter columns | Verify composite index on `(project_id, document_type)` exists |

## Related Topics

- [Meeting Transcripts](../23-meeting-transcripts/transcripts.md) -- Source transcripts for document generation
- [Document Generation Edge Functions](../08-document-generation/edge-functions.md) -- Edge Function implementation details, request/response formats
- [Prompt Templates](../09-prompt-templates/templates.md) -- Handlebars template system and document structure definitions
- [AI Interaction Tracking](../10-ai-tracking/tracking.md) -- Token usage, cost tracking, and AI interaction lifecycle
- [Database Schema](../04-database-schema/schema.md) -- Complete table definitions and RLS policies
', 'docs/24-generated-documents/gen-docs.md'),
    ('task_sprint', 'Projects', '---
name: projects
description: project_knowledge_base, project creation, settings, isolation architecture
area: 20
maintained_by: project-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Projects

## Overview

Projects are the top-level organizational unit in the Workforce platform. Every piece of data in the system -- tasks, sprints, meeting transcripts, generated documents, and AI interactions -- is scoped to a specific project. The project defines the boundary of data isolation, ensuring that users can only access information within projects they have been explicitly granted access to.

At the database level, the `project_knowledge_base` table serves as the central anchor for all project-scoped data. Every core table maintains a foreign key to this table, and Row Level Security (RLS) policies enforce isolation at the database layer. At the application layer, the `useProjectSelection()` hook provides the active project context and is the single source of truth for determining which project is currently in use.

## Data Model

### Project Hierarchy

```
profiles (user account)
  |
  v
user_project_access (grants project access)
  |
  v
project_knowledge_base (project -- the isolation boundary)
  |
  +-- sprints (development iterations)
  +-- dev_tasks (tasks and user stories)
  +-- meeting_transcripts (meeting records for AI processing)
  +-- generated_documents (AI-produced PRDs, specs, test cases, etc.)
  +-- ai_interactions (token usage and cost tracking)
  +-- features (feature definitions)
  +-- backlog_items (backlog entries)

project_knowledge_base
  |
  +-- project_team_members (links to team_members with role)
        |
        v
        team_members (globally visible, assigned to tasks across projects)
              |
              +-- team_member_skills
              +-- team_member_tools
```

## project_knowledge_base Table

The `project_knowledge_base` table is the central repository for all project metadata. It stores the project''s identity, configuration, and leadership information, serving as the anchor for all project-scoped data in the system.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key; referenced as project_id by all scoped tables |
| name | text | NO | null | Project display name |
| description | text | NO | null | Project description |
| category | text | YES | null | Project category or type (e.g., "web-app", "mobile", "api") |
| owner | uuid | YES | null | FK to profiles.id -- the project owner |
| context_data | jsonb | YES | ''{}''::jsonb | Flexible metadata storage for custom project fields |
| is_active | boolean | YES | true | Soft-delete flag; inactive projects are hidden from most queries |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |
| tags | text[] | YES | ''{}''::text[] | Project tags for filtering and categorization |
| git_repository_url | text | YES | null | Linked Git repository URL |
| jira_url | text | YES | null | Linked Jira instance URL |
| logo_url | text | YES | null | Project logo image URL |
| icon | text | YES | null | Project icon identifier (used in the UI) |
| color | text | YES | null | Project color theme (hex value for UI theming) |
| leaders_managers | jsonb | YES | ''[]''::jsonb | Project leadership information (name, role, contact) |
| team_member_links | jsonb | YES | ''[]''::jsonb | Team member associations and metadata |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |

### Relationships

- **owner** -> `profiles.id` (N:1, optional): The user who owns and administers the project.
- **Referenced by**: All core scoped tables (`dev_tasks`, `sprints`, `generated_documents`, `ai_interactions`, `meeting_transcripts`, `features`, `backlog_items`) as the primary project isolation anchor via `project_id`.
- **Join table**: `project_team_members` links team members to projects with role information.

### RLS Policies

Access to projects is controlled through the `user_project_access` table. A user can only see or interact with a project if they have a non-deleted access record in that table.

```sql
-- Project visibility: user must have a record in user_project_access
CREATE POLICY project_isolation_select ON project_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_project_access
      WHERE user_project_access.project_id = project_knowledge_base.id
      AND user_project_access.user_id = auth.uid()
      AND user_project_access.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `owner`
- Index on `is_active`
- Index on `deleted_at`

---

## Project Creation and Settings

### Creating a Project

Project creation is typically performed by an administrator. The process involves inserting a record into `project_knowledge_base` and then granting access to users via `user_project_access`.

**Steps:**

1. An administrator inserts a new record into `project_knowledge_base` with `name`, `description`, and optionally `category`, `tags`, `git_repository_url`, `jira_url`, `icon`, `color`, and other configuration fields.
2. The project owner is set via the `owner` column (FK to `profiles.id`).
3. Users who need access are added to `user_project_access` with their `user_id` and `project_id`.
4. Team members are linked to the project through `project_team_members`, associating each member with a role (e.g., "developer", "qa", "product-owner").
5. Once these steps are complete, all data operations scoped to this project will work correctly through the `project_id` filter.

**Example: Inserting a new project (SQL)**

```sql
INSERT INTO project_knowledge_base (name, description, category, owner, tags, git_repository_url, jira_url)
VALUES (
  ''E-Commerce Platform Redesign'',
  ''Full redesign of the customer-facing e-commerce experience with new checkout flow and mobile optimization.'',
  ''web-app'',
  ''a1b2c3d4-e5f6-7890-abcd-ef1234567890'',  -- owner profile ID
  ARRAY[''frontend'', ''ux'', ''mobile-first''],
  ''https://github.com/org/ecommerce-platform'',
  ''https://company.atlassian.net/jira/projects/ECOM''
)
RETURNING id;
```

**Example: Granting user access (SQL)**

```sql
INSERT INTO user_project_access (user_id, project_id, created_by)
VALUES (
  ''user-uuid-to-grant'',
  ''project-uuid-from-insert'',
  ''admin-uuid''
);
```

**Example: Linking team members (SQL)**

```sql
INSERT INTO project_team_members (project_id, member_id, role)
VALUES
  (''project-uuid'', ''member-uuid-1'', ''frontend-developer''),
  (''project-uuid'', ''member-uuid-2'', ''backend-developer''),
  (''project-uuid'', ''member-uuid-3'', ''product-owner'');
```

### Project Settings

Projects support several configuration options that affect behavior and appearance:

| Setting | Column | Description |
|---------|--------|-------------|
| Project Name | `name` | The display name shown across the UI |
| Description | `description` | A brief description of the project''s purpose and scope |
| Category | `category` | A type identifier used for filtering and organization |
| Tags | `tags` | An array of text tags for further classification |
| Git Repository | `git_repository_url` | URL to the linked Git repository |
| Jira URL | `jira_url` | URL to the linked Jira instance |
| Icon | `icon` | Icon identifier used in the project selector and header |
| Color | `color` | Hex color code used to theme the project''s UI elements |
| Logo | `logo_url` | URL to a custom project logo image |
| Leadership | `leaders_managers` | JSONB array of leadership roles and contacts |
| Active Status | `is_active` | Controls visibility; inactive projects are hidden from most queries |

### Branding Fields

The `icon`, `color`, and `logo_url` fields allow per-project theming. The UI applies these values to the project header and selector components, giving each project a distinct visual identity.

---

## Project Knowledge Base Structure

The project knowledge base functions as a central repository for all project-related information. Beyond the metadata in `project_knowledge_base`, the repository encompasses:

**Tasks and Work Items**

All development tasks are stored in `dev_tasks` and scoped to a project via `project_id`. Tasks can be assigned to sprints, assigned to team members, organized into features, and tagged for categorization. The project provides the top-level container for all work tracking.

**Sprints**

Development iterations are stored in `sprints` and scoped to a project. Each sprint has a defined start and end date, planned and completed story points, and a velocity metric. Sprints group tasks within the project scope.

**Meeting Transcripts**

Records of meetings are stored in `meeting_transcripts` and scoped to a project. These transcripts serve as input for AI-powered document generation, producing PRDs, user stories, technical specs, test cases, and meeting notes.

**Generated Documents**

AI-produced documents are stored in `generated_documents` and scoped to a project. Each document is linked to a source meeting transcript and an AI interaction record. Documents support versioning, approval workflows, and quality scoring.

**AI Interactions**

Every AI operation (document generation, task creation, analysis) is tracked in `ai_interactions` and scoped to a project. Each interaction records token usage, cost, model, duration, and quality metrics, enabling project-level AI budget tracking.

---

## Project-Level Data Isolation

Data isolation is the most critical architectural constraint in the system. Every table that contains project-scoped data must include a `project_id` column, and every query and mutation must filter by that column. Isolation is enforced at two layers: the application layer (through `useProjectSelection()`) and the database layer (through RLS policies).

### The Isolation Rule

**Every Supabase query that reads or writes project-scoped data must include a `project_id` filter.**

```typescript
// WRONG -- no project filter, returns data from all projects (or nothing due to RLS)
const { data } = await supabase.from(''dev_tasks'').select(''*'');

// WRONG -- uses undefined value, produces empty results
const { selectedProjectId } = useProjectSelection();
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId);  // selectedProjectId is always undefined

// CORRECT -- derives project ID from selectedProject object
const { selectedProject } = useProjectSelection();
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id);  // safe -- returns undefined if no project
```

### Tables That Require Project Isolation

| Table | Filter | Notes |
|-------|--------|-------|
| `dev_tasks` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- every task belongs to a project |
| `sprints` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- every sprint belongs to a project |
| `meeting_transcripts` | `.eq(''project_id'', selectedProject.id)` | Optional at insert, but filtered when project-scoped |
| `generated_documents` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- documents belong to a project |
| `ai_interactions` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- costs tracked per project |
| `features` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- features belong to a project |
| `backlog_items` | `.eq(''project_id'', selectedProject.id)` | Mandatory -- backlog entries belong to a project |

### TanStack Query Integration

When using TanStack Query, queries should be gated on the presence of a selected project to prevent unnecessary requests with undefined filters:

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks, isLoading } = useQuery({
  queryKey: [''tasks'', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from(''dev_tasks'')
      .select(''*'')
      .eq(''project_id'', selectedProject?.id)
      .order(''created_at'', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,  // Query will not execute until a project is selected
});
```

### RLS Enforcement

Even if application-level filtering is bypassed, RLS policies on every table ensure that users cannot access data from projects they have not been granted access to:

```sql
-- Example: tasks isolation policy
CREATE POLICY tasks_project_isolation ON dev_tasks
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

This means that a query without a `project_id` filter will return zero rows rather than cross-project data, because the RLS policy additionally restricts results to projects in the user''s access list.

---

## Relationships

### Relationship to team_members

Team members (`team_members`) are globally visible across the entire system. A team member record represents a person who can be assigned to tasks in any project. The link between a team member and a specific project is managed through the `project_team_members` join table:

```
project_knowledge_base (1)
  |
  +-- project_team_members (N)
        |
        +-- team_members (1)
              |
              +-- team_member_skills (1:N)
              +-- team_member_tools (1:N)
```

**project_team_members columns:**

| Column | Type | Description |
|--------|------|-------------|
| id | bigint | Primary key |
| project_id | uuid | FK to project_knowledge_base.id |
| member_id | uuid | FK to team_members.id |
| role | text | Member''s role within the project |
| joined_at | timestamp | When the member joined the project |

**Querying team members for a project:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: projectMembers } = await supabase
  .from(''project_team_members'')
  .select(`
    role,
    joined_at,
    member:team_members (
      id,
      name,
      email,
      profile,
      headline,
      avatar_url
    )
  `)
  .eq(''project_id'', selectedProject?.id)
  .is(''deleted_at'', null);
```

### Relationship to sprints

Sprints (`sprints`) are development iterations that belong to a specific project:

```
project_knowledge_base (1)
  |
  +-- sprints (N)
        |
        +-- dev_tasks (N) -- tasks assigned to the sprint
        +-- generated_documents (N) -- documents generated during the sprint
        +-- meetings (N) -- meetings held during the sprint
```

**sprints columns relevant to project isolation:**

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| project_id | uuid | FK to project_knowledge_base.id (mandatory) |
| name | varchar | Sprint name |
| status | sprint_status | planning, active, completed, cancelled |
| start_date | date | Sprint start date |
| end_date | date | Sprint end date |
| planned_points | int | Total planned story points |
| completed_points | int | Completed story points |
| velocity | numeric | Calculated velocity |

**Querying sprints for a project:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: sprints } = await supabase
  .from(''sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .order(''start_date'', { ascending: false });
```

**Sprint-to-task relationship:**

Tasks are assigned to sprints via the `sprint_id` foreign key in `dev_tasks`. To retrieve all tasks for the active sprint:

```typescript
const { selectedProject } = useProjectSelection();

const { data: sprintTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .eq(''sprint_id'', activeSprintId)
  .order(''priority'', { ascending: false });
```

---

## Project Context Selection: useProjectSelection()

The `useProjectSelection()` hook is the application-layer mechanism for accessing the currently active project. It is the standard interface for all components that need project-scoped data.

### Hook Interface

**File:** `src/hooks/useProjectSelection.ts`

```typescript
export interface UseProjectSelectionReturn {
  selectedProject: Project | null;   // The full Project object -- NOT selectedProjectId
  isProjectMode: boolean;
  isLoading: boolean;
  projectHistory: Project[];
  selectProject: (project: Project) => void;
  clearProject: () => void;
  toggleProjectMode: () => void;
  enableProjectMode: () => void;
  disableProjectMode: () => void;
  isProjectSelected: boolean;
  canAccessProjectRoutes: boolean;
  navigateToProject: (projectId: string) => void;
  navigateToDashboard: () => void;
  switchProject: (project: Project) => void;
  getRecentProjects: (limit?: number) => Project[];
}
```

### Project Type

The `Project` type (defined in `src/types/project-selection.ts`) reflects the `project_knowledge_base` table structure:

```typescript
export interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status?: string;
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  team_id?: number;
  overall_quality_score?: number;
  total_cost?: number;
  total_tokens?: number;
  total_interactions?: number;
  collaborators_count?: number;
  completed_documents?: string[];
  failed_documents?: string[];
  tags?: string[];
  is_public?: boolean;
  sprints_count?: number;
  tasks_count?: number;
  incomplete_tasks_count?: number;
  meetings_count?: number;
  icon?: string;
  color?: string;
  logo_url?: string;
}
```

### Correct Usage

The most important rule is to never destructure `selectedProjectId` directly from the hook. The hook exposes `selectedProject` (the full object), not a `selectedProjectId` property. Attempting to use a non-existent property produces `undefined`, which silently breaks every query and mutation.

**Correct pattern:**

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function TasksPage() {
  const { selectedProject } = useProjectSelection();

  if (!selectedProject) {
    return <Alert>Please select a project to view tasks.</Alert>;
  }

  const { data: tasks } = useQuery({
    queryKey: [''tasks'', selectedProject.id],
    queryFn: () => supabase
      .from(''dev_tasks'')
      .select(''*'')
      .eq(''project_id'', selectedProject.id)
      .order(''created_at'', { ascending: false }),
    enabled: !!selectedProject.id,
  });

  return <TaskList tasks={tasks} />;
}
```

**Incorrect pattern (never do this):**

```typescript
// WRONG -- selectedProjectId does not exist on the returned object
const { selectedProjectId } = useProjectSelection();  // always undefined

// WRONG -- same problem with any name that is not "selectedProject"
const { projectId } = useProjectSelection();         // always undefined
const { id } = useProjectSelection();                // always undefined
```

### Navigation Helpers

The hook provides navigation helpers that automatically manage project mode transitions:

```typescript
const {
  selectedProject,
  navigateToProject,
  navigateToDashboard,
  switchProject,
  enableProjectMode,
  disableProjectMode,
} = useProjectSelection();

// Switch to a different project
switchProject(anotherProject);

// Navigate to the current project''s home page
navigateToProject(selectedProject.id);

// Return to the global dashboard
navigateToDashboard();

// Enable project-scoped navigation (redirects to /project-selector if no project is active)
enableProjectMode();
```

### Project Mode

The application operates in one of two modes:

- **Project Mode** (`isProjectMode = true`): All data is scoped to the selected project. Navigating to protected routes without a project selected redirects to `/project-selector`.
- **Non-Project Mode** (`isProjectMode = false`): The application behaves like a single-workspace app with no project filtering.

Project mode is the default. The context provider persists the selected project in `localStorage` under the key `dr-ai-selected-project`, along with project history and mode state.

### Access Validation

When `selectProject()` is called, the context validates that the current user has access to the target project before setting it:

```typescript
const setSelectedProject = async (project: Project | null) => {
  if (project) {
    const { data: { user } } = await supabase.auth.getUser();
    const userIsAdmin = isAdminUser(user.id);

    if (!userIsAdmin) {
      const hasAccess = await checkUserHasAccess(user.id, project.id);
      if (!hasAccess) {
        toast.error("You don''t have access to this project");
        navigate(''/project-selector'');
        return;
      }
    }
    setSelectedProjectState(project);
  }
};
```

Non-admin users are checked against `user_project_access`. Admin users bypass this check.

---

## Related Topics

- [Project Context System](../06-project-context/context-system.md) -- Detailed documentation of the `useProjectSelection()` hook, context hierarchy, and isolation enforcement
- [Database Schema](../04-database-schema/schema.md) -- Complete table definitions, relationships, RLS policies, and index strategy
- [Sprints](../22-sprints/sprints.md) -- Sprint management within projects
- [Tasks](../21-tasks/tasks.md) -- Task management within projects
- [Team Members](../17-team-members/members.md) -- Team member management and project linking
- [Area Theming](../16-ui-theming/themes.md) -- Project-level visual theming with colors and icons
', 'docs/20-projects/projects.md'),
    ('task_sprint', 'Tasks', '---
name: tasks
description: dev_tasks table, task statuses, assignments, area classification, task creation
area: 21
maintained_by: tasks-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Tasks

## Overview

Tasks represent units of work within a project. They are the atomic building blocks of sprint planning and track all development work from initial planning through completion. The `dev_tasks` table stores every task with its metadata, relationships to sprints and team members, and workflow status.

## dev_tasks Table

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key, auto-generated |
| project_id | UUID | Project association (REQUIRED) |
| title | TEXT | Task title (required, non-empty) |
| description | TEXT | Detailed task description |
| task_type | task_type | Classification type (default: feature) |
| status | task_status | Current workflow status (default: todo) |
| priority | task_priority | Priority level (default: medium) |
| tags | TEXT[] | Array of string tags for categorization |
| component_area | TEXT | Area classification for UI theming |
| estimated_hours | INTEGER | Original time estimate (default: 0) |
| actual_hours | INTEGER | Time spent working on task (default: 0) |
| story_points | INTEGER | Agile story points estimate (default: 0) |
| parent_task_id | UUID | Optional parent task for subtasks |
| dependencies | JSONB | Task dependency relationships |
| feature_id | UUID | Optional link to parent feature |
| generated_from_interaction_id | UUID | AI interaction that generated this task |
| ai_metadata | JSONB | AI-specific metadata |
| created_by | TEXT | User who created the task |
| assigned_to | UUID | team_members.id |
| sprint_id | UUID | sprints.id |
| jira_issue_key | TEXT | External Jira issue key |
| jira_issue_id | TEXT | External Jira issue ID |
| jira_sync_status | TEXT | synced / pending / error / conflict |
| jira_last_synced_at | TIMESTAMP | Last Jira sync timestamp |
| jira_sync_enabled | BOOLEAN | Enable Jira synchronization (default: false) |
| created_at | TIMESTAMP | Creation timestamp |
| updated_at | TIMESTAMP | Last modification |
| deleted_at | TIMESTAMP | Soft delete timestamp |

### Constraints

- `title` must be non-empty (trimmed)
- `jira_sync_status` must be one of: synced, pending, error, conflict

### Relationships

| Relationship | Target Table | Notes |
|-------------|--------------|-------|
| project_id | projects | REQUIRED - all tasks must belong to a project |
| sprint_id | sprints | Optional - tasks may be backlogged |
| assigned_to | team_members | Optional - unassigned tasks are allowed |
| feature_id | features | Optional - groups tasks under a feature |
| parent_task_id | dev_tasks | Enables subtask hierarchy |

## Task Statuses

| Status | Label | Description |
|--------|-------|-------------|
| todo | To Do | Task created but work has not started |
| in_progress | In Progress | Work is actively underway |
| in_review | In Review | Work submitted for code/design review |
| testing | Testing | Work is being validated by QA |
| blocked | Blocked | Task cannot proceed due to external dependency or issue |
| done | Done | Task completed and accepted |
| cancelled | Cancelled | Task cancelled and will not be worked on |

## Status Transition Diagram

```
                                    [cancelled]
                                        ^
                                        |
                                        X (any state can be cancelled)

[blocked] <---- [in_progress] ----> [in_review]
    ^                |                  |
    |                v                  v
    |           [testing] <------- [in_review] (if review fails)
    |                |
    |                v
    +---------> [done]

[todo] ----> [in_progress] ----> [done]
```

### Valid Transitions

| From | To | Notes |
|------|----|-------|
| todo | in_progress | Start working on task |
| todo | cancelled | Cancel without starting |
| in_progress | in_review | Submit for review |
| in_progress | testing | Move to QA phase |
| in_progress | blocked | Encounter blocking issue |
| in_progress | cancelled | Cancel while working |
| in_review | testing | Review passed |
| in_review | in_progress | Review rejected, return to work |
| in_review | cancelled | Cancel after review |
| testing | done | QA passed |
| testing | in_progress | QA failed, return to work |
| testing | cancelled | Cancel after testing |
| blocked | in_progress | Block resolved |
| blocked | cancelled | Cancel blocked task |

## Area Assignment

Tasks are classified by `component_area` which determines UI theming across the application.

| Area | Color | Hex | Usage |
|------|-------|-----|-------|
| planning | Dark Gold | #B8860B | Requirements, user stories, roadmaps |
| development | Gray/Silver | #9E9E9E | Implementation, coding, features |
| testing / quality | Bronze | #CD7F32 | QA, bugs, test cases, validation |
| governance | Dark Green | #1B4332 | Settings, compliance, administration |

### Setting Component Area

The `component_area` field is set based on the source document type during task generation:

- PRD documents -> planning
- User Stories -> planning
- Technical Specs -> development
- Test Cases -> testing/quality
- Meeting Notes -> planning
- Bug Reports -> testing/quality

### Querying by Area

```typescript
// Filter tasks by component_area
const { data: planningTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .eq(''component_area'', ''planning'')
  .is(''deleted_at'', null);
```

## Task Types

| Type | Label | Description |
|------|-------|-------------|
| feature | Feature | New functional capability |
| bug | Bug | Defect or issue fix |
| enhancement | Enhancement | Improve existing feature |
| technical_debt | Technical Debt | Code quality refactoring |
| research | Research | Investigation or discovery work |
| documentation | Documentation | Documentation creation/update |
| testing | Testing | QA testing tasks |
| test | Test | Unit or integration test |
| deployment | Deployment | Release and deployment tasks |
| maintenance | Maintenance | Ongoing maintenance work |
| refactor | Refactor | Code restructuring |

## Priority Levels

| Priority | Label | Description |
|----------|-------|-------------|
| low | Low | Nice to have, can be deprioritized |
| medium | Medium | Standard priority |
| high | High | Important, should be prioritized |
| critical | Critical | Must complete for release |
| urgent | Urgent | Immediate attention required |

## Query Patterns

### Tasks by Project

All queries must filter by `project_id` for data isolation.

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks } = useQuery({
  queryKey: [''tasks'', selectedProject?.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from(''dev_tasks'')
      .select(''*'')
      .eq(''project_id'', selectedProject?.id)
      .is(''deleted_at'', null)
      .order(''created_at'', { ascending: false });

    if (error) throw error;
    return data;
  },
  enabled: !!selectedProject?.id,
});
```

### Tasks by Sprint

```typescript
// All tasks in a specific sprint
const { data: sprintTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .eq(''sprint_id'', sprintId)
  .is(''deleted_at'', null)
  .order(''priority'', { ascending: false });

// Tasks NOT assigned to any sprint (backlog)
const { data: backlogTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .is(''sprint_id'', null)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });

// Multiple sprints with ''no-sprint'' option
const { data: mixedTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .or(`sprint_id.in.(${sprintIds.join('','')}),sprint_id.is.null`)
  .is(''deleted_at'', null);
```

### Tasks by Team Member

```typescript
// Tasks assigned to a specific member
const { data: assignedTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .eq(''assigned_to'', memberId)
  .is(''deleted_at'', null)
  .order(''priority'', { ascending: false });

// Unassigned tasks
const { data: unassignedTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .is(''assigned_to'', null)
  .is(''deleted_at'', null)
  .order(''created_at'', { ascending: false });

// Using TaskService
const taskService = new TaskService();
const tasks = await taskService.getTasksByAssignee(memberId);
```

### Tasks by Area

```typescript
// Tasks by component_area
const { data: developmentTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .eq(''component_area'', ''development'')
  .is(''deleted_at'', null);

// Multiple areas
const { data: mixedAreaTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .in(''component_area'', [''planning'', ''development''])
  .is(''deleted_at'', null);
```

### Tasks by Status

```typescript
// Active tasks (excluding done and cancelled)
const { data: activeTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .neq(''status'', ''done'')
  .neq(''status'', ''cancelled'')
  .is(''deleted_at'', null);

// Tasks by multiple statuses
const { data: blockedAndInProgress } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .in(''status'', [''blocked'', ''in_progress''])
  .is(''deleted_at'', null);
```

### Tasks by Feature

```typescript
// All tasks linked to a feature
const { data: featureTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .eq(''feature_id'', featureId)
  .is(''deleted_at'', null);

// Tasks without a feature (loose tasks)
const { data: looseTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', projectId)
  .is(''feature_id'', null)
  .is(''deleted_at'', null);
```

### Using TaskService

The `TaskService` class in `src/lib/services/task-service.ts` provides centralized query methods:

```typescript
import { taskService } from ''@/lib/services/task-service'';

// Fetch with filters
const tasks = await taskService.fetchTasks(projectId, {
  status: [''todo'', ''in_progress''],
  priority: [''high'', ''critical''],
  component_area: [''development''],
  assigned_to: [memberId],
});

// Get tasks by sprint
const sprintTasks = await taskService.getTasksBySprint(sprintId);

// Get tasks by feature
const featureTasks = await taskService.getTasksByFeature(featureId);

// Get task statistics
const stats = await taskService.getTaskStatistics(projectId);
// Returns: total_tasks, completed_tasks, in_progress_tasks, blocked_tasks,
// by_status, by_priority, by_type, total_story_points, etc.

// Batch operations
const updated = await taskService.batchUpdateTasks(taskIds, projectId, {
  status: ''done'',
  sprint_id: sprintId,
});

// Assign tasks to sprint
await taskService.assignTasksToSprint(taskIds, sprintId);
```

### View with Relations

The `view_dev_tasks_with_relations` view joins task data with related records:

```sql
SELECT
  dt.id,
  dt.title,
  dt.status,
  dt.priority,
  dt.project_id,
  dt.sprint_id,
  dt.assigned_to,
  -- Joined data
  team_member.name  AS assigned_to_name,
  sprints.name      AS sprint_name,
  features.title    AS feature_title
FROM view_dev_tasks_with_relations dt
WHERE dt.project_id = ''uuid-here'';
```

## Task Creation

### Legacy Method (Deprecated)

The legacy task creation used `generateDocumentsWithOpenAI()` from `src/lib/openai.ts`. This method is deprecated but still used by some legacy components (TaskFileUploadDialog, TaskCreationFromTranscriptDialog, Convert page).

```typescript
// DEPRECATED - Do not use for new implementations
import { generateDocumentsWithOpenAI } from ''@/lib/openai'';

const documents = await generateDocumentsWithOpenAI(
  transcript,
  prompt,
  [''tasks''],  // Request task generation
  project
);

const taskContent = documents.tasks; // Raw task text from AI
```

### Current Method: Edge Functions

Task generation has been migrated to Edge Functions for better security and tracking.

```typescript
import { generateTasksAPI } from ''@/lib/services/document-generation-service'';

// Generate tasks from document content
const result = await generateTasksAPI(
  transcriptContent,      // Input content
  projectId,               // Project context
  meetingTranscriptId,     // Optional transcript reference
  userId                   // Optional user tracking
);

if (result.success) {
  const { tasks, response_id } = result;
  // Tasks are automatically saved to dev_tasks table
}
```

### UI Workflow: GenerateTasksModal

The frontend component `GenerateTasksModal` orchestrates task creation:

1. User selects a document to generate tasks from
2. Optionally links tasks to a feature
3. Optionally provides additional AI guidance
4. Clicks "Generate with AI" to call the Edge Function
5. Reviews and edits generated tasks inline
6. Saves all tasks to the database

```typescript
// Component usage
<GenerateTasksModal
  open={isOpen}
  onOpenChange={setIsOpen}
  document={selectedDocument}
  projectId={projectId}
  onSuccess={(tasks) => console.log(''Created:'', tasks)}
/>
```

## Common Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Tasks not showing | Wrong project selected | Verify `selectedProject?.id` is set |
| Cannot assign task | User not in project team | Add user to `project_team_members` table |
| Sprint tasks missing | `sprint_id` not set on tasks | Edit tasks to assign sprint |
| Task status stuck | Invalid transition attempted | Check valid transition paths |
| Area not styled | `component_area` not set | Set area during task creation |
| Parent task has subtasks | `parent_task_id` used | Subtasks inherit parent''s sprint/feature |

## Related Topics

- [Sprints](../22-sprints/sprints.md) - Sprint planning and velocity tracking
- [Features](../20-projects/projects.md) - Feature grouping
- [Team Members](../17-team-members/members.md) - Team member assignments
- [Project Context](../06-project-context/context-system.md) - Project isolation pattern
- [Database Schema](../04-database-schema/schema.md) - Full schema reference
', 'docs/21-tasks/tasks.md'),
    ('task_sprint', 'Sprints', '---
name: sprints
description: sprints table, sprint planning, velocity tracking, burndown, sprint-task relationships
area: 22
maintained_by: sprint-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Sprints

## Overview

Sprints are time-boxed development iterations within a project. They provide a structured framework for planning, executing, and measuring software delivery. Each sprint has a defined duration (typically 1-2 weeks), a set of goals, and a collection of tasks that team members work on during that period.

The sprint system integrates with the broader project management infrastructure, linking tasks, features, team members, and analytics into a cohesive workflow. Sprint data is organized by `project_id`, ensuring proper data isolation across multiple projects.

## sprints Table

The `sprints` table stores all sprint records. It uses UUID as the primary key and includes comprehensive fields for sprint planning and tracking.

### Schema Definition

```sql
CREATE TABLE IF NOT EXISTS "public"."sprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "project_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "status" "public"."sprint_status" DEFAULT ''planning''::"public"."sprint_status",
    "goals" "text"[] DEFAULT ARRAY[]::"text"[],
    "planned_points" integer,
    "completed_points" integer,
    "velocity" numeric(5,2),
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "deleted_at" timestamp with time zone,
    CONSTRAINT "valid_date_range" CHECK (("end_date" >= "start_date")),
    CONSTRAINT "valid_name_length" CHECK ((("length"(("name")::"text") >= 1) AND ("length"(("name")::"text") <= 255))),
    CONSTRAINT "valid_points" CHECK (((("planned_points" IS NULL) OR ("planned_points" >= 0)) AND (("completed_points" IS NULL) OR ("completed_points" >= 0))))
);
```

### Field Reference

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `id` | UUID | Primary key, auto-generated | Unique sprint identifier |
| `project_id` | UUID | NOT NULL, FK to `project_knowledge_base` | Associates sprint with a project |
| `name` | VARCHAR(255) | NOT NULL, 1-255 chars | Sprint display name (e.g., "Sprint 3") |
| `description` | TEXT | NULL | Detailed description of sprint objectives |
| `start_date` | DATE | NOT NULL | Sprint start date (inclusive) |
| `end_date` | DATE | NOT NULL | Sprint end date (inclusive) |
| `status` | sprint_status | DEFAULT ''planning'' | Current sprint lifecycle status |
| `goals` | TEXT[] | DEFAULT empty array | Array of sprint goal strings |
| `planned_points` | INTEGER | >= 0 | Total story points planned for sprint |
| `completed_points` | INTEGER | >= 0 | Total story points completed in sprint |
| `velocity` | NUMERIC(5,2) | NULL | Calculated velocity (story points per week) |
| `created_by` | UUID | NULL | User who created the sprint |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Last modification timestamp |
| `deleted_at` | TIMESTAMPTZ | NULL | Soft delete timestamp |

### Database Constraints

| Constraint | Expression | Description |
|------------|------------|-------------|
| `valid_date_range` | `end_date >= start_date` | End date must be on or after start date |
| `valid_name_length` | `LENGTH(name) BETWEEN 1 AND 255` | Name must be non-empty and under 255 characters |
| `valid_points` | `planned_points >= 0 AND completed_points >= 0` | Point values cannot be negative |

### Indexes

| Index Name | Columns | Purpose |
|------------|---------|---------|
| `idx_sprints_project_id` | `project_id` | Fast lookup by project |
| `idx_sprints_status` | `status` | Fast filter by status |
| `idx_sprints_dates` | `start_date, end_date` | Date range queries |
| `idx_sprints_project_status` | `project_id, status` | Combined project and status filter |
| `idx_sprints_team_id` | `team_id` | Team-based sprint queries |

## Sprint Statuses

Sprints transition through a defined lifecycle. The `sprint_status` enum governs these transitions.

### Status Values

| Status | Value | Description |
|--------|-------|-------------|
| `planning` | Planning | Sprint is created but not yet started. Tasks can be assigned and goals can be set. |
| `active` | Active | Sprint is in progress. Team is actively working on assigned tasks. |
| `completed` | Completed | Sprint has ended. All work is reviewed and velocity is calculated. |
| `cancelled` | Cancelled | Sprint was cancelled before completion. No further work is expected. |

### Status Transition Flow

```
[Created] --> planning --> active --> completed --> [Archived]
                      |         |
                      +----> cancelled --> [Archived]
```

### Auto-Status Suggestions

The system can suggest appropriate status based on current date:

```typescript
function getSuggestedStatus(startDate: string, endDate: string): SprintStatus {
  const today = new Date();

  if (isAfter(start, today)) {
    return ''planning'';    // Start date is in the future
  } else if (isWithinInterval(today, { start, end })) {
    return ''active'';      // Today falls within sprint dates
  } else {
    return ''completed'';   // End date has passed
  }
}
```

## Sprint Planning Workflow

Planning a sprint involves three key activities: selecting or creating the sprint, assigning tasks, and defining sprint goals.

### Step 1: Create Sprint

```typescript
import { sprintService } from ''@/lib/services/sprint-service'';

const sprint = await sprintService.createSprint({
  name: ''Sprint 3'',
  project_id: selectedProject.id,
  start_date: ''2025-01-15'',
  end_date: ''2025-01-29'',
  goals: [''Implement user authentication'', ''Add role-based access control''],
  planned_points: 50,
});
```

### Step 2: Assign Tasks to Sprint

Tasks are linked to sprints via the `sprint_id` field on `dev_tasks`. There are two primary methods for assignment:

#### Method A: Drag and Drop (UI)

The `SprintTaskManager` component provides a visual interface with two columns: Backlog and Sprint. Users can drag tasks from backlog to sprint, or use checkboxes for bulk selection.

#### Method B: Direct Update (API)

```typescript
// Add task to sprint
await taskService.updateTask(taskId, { sprint_id: sprintId });

// Remove task from sprint
await taskService.updateTask(taskId, { sprint_id: undefined });
```

#### Task Assignment Rules

- Only tasks with status other than `done` or `cancelled` should be added to a sprint.
- Tasks can be moved between sprints or back to backlog at any time during planning.
- During an active sprint, moving tasks in or out constitutes scope change and affects scope stability metrics.

### Step 3: Set Sprint Goals

Sprint goals are stored as a `TEXT[]` array, allowing multiple discrete objectives per sprint:

```typescript
// Set goals when creating
const goals = [
  ''Complete user authentication module'',
  ''Reduce API response time by 30%'',
  ''Write unit tests for core services'',
];

// Goals can be updated at any time
await sprintService.updateSprint(sprintId, { goals });
```

### Step 4: Activate Sprint

When the start date arrives, the sprint status changes to `active`:

```typescript
await sprintService.updateSprint(sprintId, { status: ''active'' });
```

## Velocity Tracking

Velocity measures the rate at which a team completes work, expressed in story points per sprint.

### Velocity Calculation Formula

The velocity calculation normalizes points by sprint duration:

```
Velocity = Completed Story Points / Sprint Duration in Weeks
```

### Implementation

```typescript
function calculateVelocity(completedPoints: number, durationDays: number): number {
  const durationWeeks = durationDays / 7;
  if (durationWeeks <= 0) return 0;
  return Math.round((completedPoints / durationWeeks) * 10) / 10;
}
```

### Example Calculation

For a 2-week sprint (14 days):

| Completed Points | Duration Weeks | Velocity |
|-----------------|----------------|----------|
| 30 | 2 | 15.0 |
| 45 | 2 | 22.5 |
| 20 | 2 | 10.0 |

### Historical Velocity

The system tracks velocity across completed sprints to calculate averages:

```typescript
const velocityHistory = sprints
  .filter(s => s.status === ''completed'')
  .map(s => ({
    name: s.name,
    velocity: s.velocity,
    completedPoints: s.completed_points,
  }));

const averageVelocity = velocityHistory.reduce((sum, s) => sum + s.velocity, 0)
  / velocityHistory.length;
```

### Velocity Trend Analysis

Velocity trends are calculated by comparing recent sprints against older ones:

```typescript
function determineVelocityTrend(velocityHistory: VelocityDataPoint[]): ''up'' | ''down'' | ''stable'' {
  if (velocityHistory.length < 3) return ''stable'';

  const recent = velocityHistory.slice(-3);
  const older = velocityHistory.slice(0, -3);

  if (older.length > 0) {
    const recentAvg = average(recent.map(s => s.velocity));
    const olderAvg = average(older.map(s => s.velocity));

    if (recentAvg > olderAvg * 1.1) return ''up'';
    if (recentAvg < olderAvg * 0.9) return ''down'';
  }

  return ''stable'';
}
```

## Burndown Tracking

Burndown charts visualize remaining work over the sprint duration, comparing actual progress against an ideal linear burndown.

### Burndown Data Structure

```typescript
interface BurndownDataPoint {
  date: string;        // Formatted date label (e.g., "Jan 15")
  ideal: number;      // Ideal remaining points (linear decrease)
  actual?: number;     // Actual remaining points (from snapshots)
}
```

### Burndown Calculation

```typescript
function buildBurndownData(
  sprint: Sprint,
  snapshots: SprintDailySnapshot[]
): BurndownDataPoint[] {
  const start = parseISO(sprint.start_date);
  const end = parseISO(sprint.end_date);
  const allDays = eachDayOfInterval({ start, end });
  const totalPoints = snapshots[0]?.total_points ?? 0;

  // Calculate ideal burndown: linear decrease from total to zero
  const idealPerDay = totalPoints / (allDays.length - 1);

  return allDays.map((day, index) => {
    const dateStr = format(day, ''yyyy-MM-dd'');
    const snapshot = snapshots.find(s => s.snapshot_date === dateStr);

    return {
      date: format(day, ''MMM dd''),
      ideal: Math.max(0, Math.round((totalPoints - idealPerDay * index) * 10) / 10),
      actual: snapshot?.remaining_points,
    };
  });
}
```

### Ideal vs Actual Burndown

| Line | Description |
|------|-------------|
| **Ideal** | Linear decrease from `totalPoints` on day 0 to 0 on the last day |
| **Actual** | Real remaining points based on task completion snapshots |

### Daily Snapshots

The system records daily snapshots for accurate burndown tracking:

```sql
CREATE TABLE sprint_daily_snapshots (
  id UUID PRIMARY KEY,
  sprint_id UUID REFERENCES sprints(id),
  snapshot_date DATE,
  total_points INTEGER,
  remaining_points INTEGER,
  completed_points INTEGER,
  todo_tasks INTEGER,
  in_progress_tasks INTEGER,
  blocked_tasks INTEGER
);
```

## Sprint-Task Relationships

Tasks are linked to sprints through the `sprint_id` foreign key on the `dev_tasks` table.

### Relationship Schema

```sql
ALTER TABLE dev_tasks ADD COLUMN sprint_id UUID REFERENCES sprints(id);
```

### Querying Sprint Tasks

```typescript
// Get all tasks for a specific sprint
const { data: sprintTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''sprint_id'', sprintId)
  .is(''deleted_at'', null);

// Get backlog tasks (no sprint assigned)
const { data: backlogTasks } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .is(''sprint_id'', null)
  .eq(''status'', ''todo'');
```

### View: view_sprints_with_stats

A pre-computed view aggregates sprint statistics for efficient queries:

```sql
CREATE OR REPLACE VIEW view_sprints_with_stats AS
SELECT
  s.*,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.deleted_at IS NULL) AS total_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''done'' AND dt.deleted_at IS NULL) AS completed_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''in_progress'' AND dt.deleted_at IS NULL) AS in_progress_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''testing'' AND dt.deleted_at IS NULL) AS testing_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''in_review'' AND dt.deleted_at IS NULL) AS in_review_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''todo'' AND dt.deleted_at IS NULL) AS todo_tasks,
  COUNT(DISTINCT dt.id) FILTER (WHERE dt.status = ''blocked'' AND dt.deleted_at IS NULL) AS blocked_tasks,
  COALESCE(SUM(dt.story_points) FILTER (WHERE dt.deleted_at IS NULL), 0) AS total_story_points,
  COALESCE(SUM(dt.story_points) FILTER (WHERE dt.status = ''done'' AND dt.deleted_at IS NULL), 0) AS completed_story_points
FROM sprints s
LEFT JOIN dev_tasks dt ON s.id = dt.sprint_id
GROUP BY s.id;
```

### Using the Stats View

```typescript
const { data: sprintWithStats } = await supabase
  .from(''view_sprints_with_stats'')
  .select(''*'')
  .eq(''id'', sprintId)
  .single();

// Access aggregated data
const {
  total_tasks,
  completed_tasks,
  total_story_points,
  completed_story_points,
} = sprintWithStats;

// Calculate progress
const progress = total_tasks > 0
  ? Math.round((completed_tasks / total_tasks) * 100)
  : 0;
```

## Current Sprint Selection

The system supports identifying and working with the currently active sprint.

### Finding the Active Sprint

```typescript
// Method 1: Query by status
const { data: activeSprint } = await supabase
  .from(''sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .eq(''status'', ''active'')
  .single();

// Method 2: Query by date overlap
const { data: activeSprint } = await supabase
  .from(''sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .lte(''start_date'', today)
  .gte(''end_date'', today)
  .single();
```

### Active Sprint Helper

```typescript
function isSprintActive(sprint: Sprint): boolean {
  if (sprint.status !== ''active'') return false;

  const today = new Date();
  const start = parseISO(sprint.start_date);
  const end = parseISO(sprint.end_date);

  return isWithinInterval(today, { start, end });
}
```

### Sprint Progress

```typescript
function calculateSprintProgress(sprint: Sprint): number {
  if (sprint.status === ''completed'') return 100;
  if (sprint.status !== ''active'') return 0;

  const totalDays = differenceInDays(
    parseISO(sprint.end_date),
    parseISO(sprint.start_date)
  ) + 1;

  const elapsedDays = Math.max(
    0,
    differenceInDays(new Date(), parseISO(sprint.start_date))
  );

  return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
}
```

## Batch Sprint Creation

For teams that plan sprints in advance, batch creation generates multiple consecutive sprints with consistent parameters.

### Configuration

```typescript
interface BatchSprintConfig {
  quantity: number;           // Number of sprints to create
  durationWeeks: number;       // Duration of each sprint (1-6 weeks)
  startDay: number;           // Day of week for sprint start (0=Sunday)
  endDay: number;             // Day of week for sprint end (0=Sunday)
  firstSprintStartDate: string;  // Start date for first sprint
  prefix?: string;            // Optional name prefix
}
```

### Example Usage

```typescript
const config: BatchSprintConfig = {
  quantity: 4,
  durationWeeks: 2,
  startDay: 1,  // Monday
  endDay: 5,    // Friday
  firstSprintStartDate: ''2025-01-06'',
  prefix: ''Sprint'',
};

// Generates:
// Sprint 1: 2025-01-06 to 2025-01-17
// Sprint 2: 2025-01-20 to 2025-01-31
// Sprint 3: 2025-02-03 to 2025-02-14
// Sprint 4: 2025-02-17 to 2025-02-28
```

### Overlap Detection

Before creating batch sprints, the system checks for date conflicts with existing sprints:

```typescript
function checkBatchOverlaps(
  generatedDates: GeneratedSprintDates[],
  existingSprints: Sprint[]
): BatchOverlapResult[] {
  return generatedDates.map((generated, index) => {
    const overlapping = existingSprints
      .filter(s => s.status !== ''cancelled'')
      .filter(s => dateRangesOverlap(
        generated.startDate, generated.endDate,
        s.start_date, s.end_date
      ))
      .map(s => s.name);

    return {
      index,
      hasOverlap: overlapping.length > 0,
      overlappingSprintNames: overlapping,
    };
  });
}
```

## API Endpoints

### List Sprints

```
POST /functions/v1/api-sprints-list
```

**Request:**
```json
{
  "projectId": "uuid",
  "status": ["active", "planning"],
  "includeStats": true,
  "page": 1,
  "limit": 10
}
```

### Get Sprint Details

```
POST /functions/v1/api-sprint-details
```

**Request:**
```json
{
  "projectId": "uuid",
  "sprintId": "uuid",
  "includeTasks": true
}
```

## Common Troubleshooting

| Issue | Likely Cause | Solution |
|-------|-------------|----------|
| No sprints displayed | Incorrect project selected | Verify `selectedProject?.id` is set correctly |
| Cannot change sprint status | Invalid date configuration | Ensure `end_date >= start_date` |
| Velocity shows zero | Tasks not marked as `done` | Complete tasks to increment velocity |
| Burndown shows flat line | No daily snapshots recorded | Ensure `sprint_daily_snapshots` is populated |
| Tasks not appearing in sprint | `sprint_id` not set | Assign tasks via task manager or API |
| Batch creation fails | Date overlap with existing sprint | Check overlap before creating |

## Related Documentation

- [Tasks](../21-tasks/tasks.md) - Task management and status workflow
- [Projects](../20-projects/projects.md) - Project context and isolation
- [Database Schema](../04-database-schema/schema.md) - Table definitions and relationships
- [Component Organization](../14-component-organization/components.md) - Sprint-related UI components
- [API Endpoints](../11-api-endpoints/endpoints.md) - Sprint API reference
', 'docs/22-sprints/sprints.md'),
    ('general', 'Project Overview', '---
name: project-overview
description: Project mission, tech stack, architecture overview, and key patterns
area: 01
maintained_by: foundation-architect
created: 2026-03-30
updated: 2026-03-30
---

# Project Overview

## Overview

RAG Workforce is an AI-powered workforce management and collaboration platform designed to streamline project planning, meeting documentation, and team coordination through intelligent document generation and retrieval-augmented workflows.

The platform serves teams that need to capture meeting transcripts, generate structured documentation (PRDs, user stories, technical specs, test cases, meeting notes), and manage development tasks within a unified project context. By leveraging OpenAI''s Responses API and a sophisticated retrieval system, the application transforms raw meeting content into actionable project artifacts while maintaining strict project-based data isolation.

The system architecture prioritizes security and maintainability by centralizing AI operations on the server side via Supabase Edge Functions, eliminating API key exposure on the client, automating token usage tracking, and providing consistent error handling across all document generation workflows.

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.3.x | UI framework with concurrent features |
| TypeScript | 5.8.x | Type-safe development |
| Vite | 7.3.x | Build tool and dev server |
| Tailwind CSS | 3.4.x | Utility-first styling |
| Shadcn/ui | latest | Component library on Radix UI primitives |
| TanStack Query | 5.83.x | Server state management |
| React Router DOM | 6.30.x | Client-side routing |
| Framer Motion | 12.x | Animation and transitions |
| Monaco Editor | 0.55.x | Code and document editing |
| TipTap | 3.9.x | Rich text editing |
| React Hook Form | 7.62.x | Form state management |
| Zod | 3.25.x | Schema validation |
| i18next | 25.5.x | Internationalization |

### Backend and Infrastructure

| Technology | Purpose |
|-----------|---------|
| Supabase | PostgreSQL database, authentication, storage, edge functions |
| Supabase Edge Functions | Server-side AI document generation (Deno runtime) |
| OpenAI API | GPT-4o and GPT-4o-mini for document generation |

### Development and Quality

| Technology | Purpose |
|-----------|---------|
| Vitest | Unit and integration testing |
| Playwright | End-to-end testing |
| ESLint | Code linting (flat config) |
| Vite ESLint Plugin | Fast lint feedback during development |

## Architecture Diagram

```
+------------------------------------------------------------------+
|                         CLIENT (React 18)                         |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |   Pages / Routes  |    |   UI Components   |                  |
|  +-------------------+    +-------------------+                  |
|           |                       |                              |
|  +---------------------------------------------------+           |
|  |              State Management Layer               |           |
|  |  TanStack Query (server state)                    |           |
|  |  React Context (auth, project, team)             |           |
|  |  Component useState (local UI state)              |           |
|  +---------------------------------------------------+           |
|           |                                                     |
|  +-------------------+    +-------------------+                  |
|  |   Hooks           |    |   Services        |                  |
|  |   useProjectSel.. |    |   document-gen... |                  |
|  |   useTasks        |    |   supabase-client |                  |
|  +-------------------+    +-------------------+                  |
+------------------------------------------------------------------+
            |
            | HTTPS (REST)
            v
+------------------------------------------------------------------+
|                     SUPABASE LAYER                                |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |  Supabase Client  |    |   Row Level Sec.  |                  |
|  |  (Auth + Database)|    |   (project_id)    |                  |
|  +-------------------+    +-------------------+                  |
|           |                                                     |
|  +-------------------+    +-------------------+                  |
|  |  PostgreSQL Tables|    |   Storage Bucket  |                  |
|  |  project_knowledge|    |   (files/assets)  |                  |
|  |  dev_tasks        |    +-------------------+                  |
|  |  meeting_transcr..|                                           |
|  |  generated_doc... |                                           |
|  |  ai_interactions  |                                           |
|  |  sprints, teams   |                                           |
|  +-------------------+                                           |
+------------------------------------------------------------------+
            |
            | Local invoke (internal)
            v
+------------------------------------------------------------------+
|                  SUPABASE EDGE FUNCTIONS                          |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |              _shared/document-generation/                   | |
|  |              (types, utilities, shared logic)              | |
|  +-------------------------------------------------------------+ |
|           |              |              |              |         |
|  +----------------+ +----------------+ +----------------+     |
|  |  create-prd   | |create-user-    | |create-meeting- |     |
|  |               | |story          | |notes           |     |
|  +----------------+ +----------------+ +----------------+     |
|           |              |              |                       |
|  +----------------+ +----------------+ +----------------+     |
|  |create-technical| |create-test-    | |create-unit-    |     |
|  |-specs          | |cases           | |tests           |     |
|  +----------------+ +----------------+ +----------------+     |
|           |              |              |                       |
|  +----------------+                                              |
|  |analyze-transcr.|                                              |
|  +----------------+                                              |
+------------------------------------------------------------------+
            |
            | HTTPS (OpenAI API)
            v
+------------------------------------------------------------------+
|                        OPENAI API                                 |
|                                                                   |
|  +-------------------+    +-------------------+                  |
|  |   GPT-4o         |    |  Responses API    |                  |
|  |   (complex docs) |    |  (conversation)   |                  |
|  +-------------------+    +-------------------+                  |
|  +-------------------+                                           |
|  |  GPT-4o-mini     |                                           |
|  |  (simple docs)   |                                           |
|  +-------------------+                                           |
+------------------------------------------------------------------+
```

## Key Architectural Patterns

### 1. Project Context System

All data operations in the application are scoped to a selected project. The `useProjectSelection()` hook provides the active project context, and every database query must filter by `project_id` to ensure proper data isolation.

```typescript
// CORRECT: Access project via selectedProject property
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;

// All queries MUST include project_id filter
const { data, error } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .order(''created_at'', { ascending: false });
```

Key constraint: Never destructure a `selectedProjectId` property from the hook. The hook exposes `selectedProject` (the full object), not `selectedProjectId` directly. Attempting to use a non-existent property will result in undefined behavior and silent query failures.

### 2. OpenAI Integration v2.0 (Edge Function Based)

The document generation system has migrated from frontend OpenAI calls to server-side Edge Functions. This architectural change provides several benefits over the legacy approach.

**Document Generation Pipeline**:

```
User Action (e.g., generate PRD)
    |
    v
generateDocumentAPI()  [src/lib/services/document-generation-service.ts]
    |
    v
Supabase Edge Function (e.g., /create-prd)
    |
    v
OpenAI Responses API (GPT-4o or GPT-4o-mini)
    |
    +--> ai_interactions table (automatic token tracking)
    |
    v
generated_documents table (document storage)
    |
    v
Structured response to client { success, document?, response_id?, error? }
```

**Supported Document Types**:

| Document Type | Edge Function | Description |
|---------------|---------------|-------------|
| PRD | `create-prd` | Product Requirements Document |
| User Stories | `create-user-story` | User story generation |
| Meeting Notes | `create-meeting-notes` | Structured meeting summary |
| Technical Specs | `create-technical-specs` | Technical implementation details |
| Test Cases | `create-test-cases` | Test scenarios and validation |
| Unit Tests | `create-unit-tests` | Code unit test generation |
| Transcript Analysis | `analyze-transcript` | Meeting content analysis |

**Migration from v1.0**:

The legacy architecture called OpenAI directly from the frontend using `generateDocumentsWithOpenAI()` in `src/lib/openai.ts`. This approach is now deprecated for document generation due to the following issues:

- API keys were exposed to the client browser
- Token usage tracking required manual inserts into the `ai_interactions` table
- Error handling was distributed across components with no consistent format
- Model selection logic was duplicated and inconsistent

The v2.0 migration removed direct frontend-to-OpenAI calls, eliminated manual `aiInteractionId` state management, and added server-side automatic token tracking with structured error responses mapped to internationalized messages.

**Legacy Support**: The deprecated `generateDocumentsWithOpenAI` function remains in use only for task creation workflows that have not yet been migrated to Edge Functions.

### 3. Supabase Edge Functions

Edge Functions are located in `supabase/functions/` and written in TypeScript running on the Deno runtime. They share infrastructure through a common module at `_shared/document-generation/`.

**Directory Structure**:

```
supabase/functions/
|
+-- _shared/document-generation/
|   +-- types.ts         (TypeScript interfaces for request/response)
|   +-- openai-client.ts (OpenAI configuration and client setup)
|   +-- prompt-loader.ts (Handlebars template loading and caching)
|   +-- retry.ts         (Exponential backoff retry logic)
|   +-- tracking.ts      (ai_interactions logging)
|
+-- create-prd/index.ts
+-- create-user-story/index.ts
+-- create-meeting-notes/index.ts
+-- create-technical-specs/index.ts
+-- create-test-cases/index.ts
+-- create-unit-tests/index.ts
+-- analyze-transcript/index.ts
```

**Request Format**:

```typescript
interface EdgeFunctionRequest {
  content: string;                  // Transcript or input content
  project_id: string;              // Project identifier (required)
  meeting_transcript_id?: string;  // Optional transcript reference
  user_id?: string;                 // Optional user tracking
  system_prompt?: string;          // Optional custom system prompt override
  user_prompt?: string;            // Optional custom user prompt override
  previous_response_id?: string;    // For conversation continuity
  model?: string;                  // Optional model override
  temperature?: number;            // Optional temperature override
  token_limit?: number;           // Optional token limit override
}
```

**Response Format**:

```typescript
interface EdgeFunctionResponse {
  success: boolean;       // Operation status
  document?: string;     // Generated document (Markdown format)
  response_id?: string; // OpenAI response ID for tracking
  error?: string;        // Error message if failed
}
```

**Error Handling Strategy**: Edge Functions return structured errors that map to user-friendly internationalized messages. Common error scenarios include authentication failures when the API key is not configured, quota exceeded when rate limits are hit, and validation errors when request format is invalid.

### 4. Template System

Document generation uses Handlebars templates stored in `src/prompts/document-templates/`. Templates are version-controlled with an `is_current_version` flag in the database, allowing controlled rollout of template changes without code deployments. Edge Functions load templates at runtime, and the Responses API maintains conversation continuity through response IDs, enabling multi-step document generation sessions.

### 5. Area-Based Design Theming

The application visualizes four distinct work areas, each with its own color identity applied through CSS custom properties on the `data-area` attribute:

| Area | Primary Color | Accent | Purpose |
|------|--------------|--------|---------|
| Planning | `#B8860B` (Dark Gold) | `#DAA520` | PRD, user stories, requirements |
| Development | `#9E9E9E` (Gray/Silver) | `#C0C0C0` | Task management, sprints |
| Testing/Quality | `#CD7F32` (Bronze) | `#D4A574` | Test cases, quality assurance |
| Governance | `#1B4332` (Dark Green) | `#2D6A4F` | Policies, compliance, audits |

## Design Philosophy

### Security by Design

API keys are never exposed to the client. All OpenAI interactions occur server-side within Supabase Edge Functions, eliminating the risk of key theft through client-side code inspection or network attacks. Token usage is tracked automatically on the server, providing accurate cost attribution without relying on client-side reporting.

### Data Isolation

Every table in the database is organized by `project_id`. Row Level Security (RLS) policies enforce this isolation at the database layer, ensuring that users can only access data within projects they are authorized to view. This architectural decision prevents data leakage between projects even if application-level checks are bypassed.

### Separation of Concerns

The frontend focuses purely on UI rendering and user interaction. Business logic related to AI document generation resides entirely in Edge Functions, and data access is mediated through Supabase. This separation allows each layer to evolve independently and simplifies testing by enforcing clear boundaries.

### Internationalization First

All user-facing text is externalized into translation files (`src/locales/pt-br.ts`, `src/locales/en-us.ts`) and accessed through the `useI18n` hook. This ensures the application can be localized without code changes and that all strings follow a consistent naming convention organized by namespace.

### State Management Transparency

Server state is managed by TanStack Query, which provides caching, background refetching, and optimistic updates. Application state (authentication, project selection, team context) uses React Context, making the state flow predictable and debuggable without external state inspection tools.

## Related Topics

- [Folder Structure](/docs/02-folder-structure/structure.md) - Directory layout and file organization
- [Glossary](/docs/03-glossary/terms.md) - Key terminology and definitions
- [Database Schema](/docs/04-database-schema/schema.md) - Table structure, relationships, and RLS policies
- [Edge Functions Reference](/docs/08-document-generation/edge-functions.md) - Detailed API documentation for each function
- [Document Generation Service](/docs/12-supabase-functions/functions.md) - Client-side API wrapper documentation
- [Frontend Style Guide](/docs/Code%20Rules/frontend-style-guide.md) - Component patterns and code conventions
- [SQL Style Guide](/docs/Code%20Rules/sql-style-guide.md) - Database query conventions
- [Area Theming System](/docs/16-ui-theming/themes.md) - Design system for work areas
', 'docs/01-project-overview/overview.md'),
    ('general', 'Folder Structure', '---
name: folder-structure
description: Complete directory organization and purpose of all folders in the project
area: 02
maintained_by: structure-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Folder Structure

## Project Overview

This document describes the complete directory organization of the DR AI Workforce project. The project is a React-based application built with Vite, TypeScript, Supabase (PostgreSQL + Auth + Edge Functions), and OpenAI for AI-powered document generation and RAG-based search.

## Project Tree

```
workforce/
|
|- .dr_ai/                      # DR_AI framework internal state
|- .github/workflows/            # GitHub Actions CI/CD pipelines
|- .omc/                        # Claude Code HUD state
|- aws/terraform/               # AWS infrastructure as code
|- docs/                        # Project documentation (architecture, features, APIs)
|- public/                      # Static assets (favicon, data)
|- src/                         # Frontend source code
|   |- components/              # React components
|   |- contexts/                # React Context providers
|   |- hooks/                   # Custom React hooks (TanStack Query wrappers)
|   |- lib/                     # Business logic, services, utilities
|   |- locales/                 # i18n translation modules (pt-br, en-us)
|   |- pages/                   # Route-level page components
|   |- types/                   # TypeScript type definitions
|   |- App.tsx                  # Root React component
|   |- App.css                  # Global styles
|   |- config/                  # Runtime configuration
|   |- prompts/                 # Handlebars document templates
|   |- tests/                   # Integration and E2E tests
|   |- main.tsx                 # Application entry point
|   |- index.css                # Tailwind base styles
|   |- routes.tsx               # React Router route definitions
|   |- supabaseClient.ts        # Supabase client initialization
|   `- vite-env.d.ts            # Vite environment type declarations
|
|- supabase/                    # Supabase backend configuration
|   `- functions/               # Deno-based Edge Functions
|       |- _shared/             # Shared utilities (reused across all Edge Functions)
|       |- accessibility-test/  # Google PageSpeed API integration
|       |- add-meet-recorder/   # Adds a bot to MS Teams meetings
|       |- admin-create-user/   # Admin user provisioning
|       |- admin-soft-delete-user/  # Soft-delete user accounts
|       |- analyze-sprint/      # Sprint health analysis
|       |- analyze-transcript/  # Meeting transcript AI analysis
|       |- api-backlog-items/   # REST API for backlog CRUD operations
|       |- api-docs/            # API documentation endpoint
|       |- api-rag-search/     # RAG-powered search endpoint
|       |- api-sprint-details/  # Sprint detail retrieval
|       |- api-sprints-list/   # Sprint listing endpoint
|       |- api-task-assign/    # Task assignment endpoint
|       |- api-task-details/    # Task detail retrieval
|       |- api-task-status/    # Task status update endpoint
|       |- api-tasks-list/      # Task listing endpoint
|       |- api-team-members-list/  # Team member listing endpoint
|       |- create-meeting-notes/   # AI-generated meeting notes
|       |- create-prd/          # AI-generated Product Requirements Document
|       |- create-technical-specs/ # AI-generated technical specifications
|       |- create-test-cases/   # AI-generated test cases
|       |- create-unit-tests/   # AI-generated unit tests
|       |- create-user-story/  # AI-generated user stories
|       |- extract-pdf/         # PDF content extraction
|       |- generate-presigned-download-url/  # Secure file download URLs
|       |- microsoft-calendar-integration/   # MS Calendar sync
|       |- process-transcript/  # Meeting transcript processing
|       |- recall-bot-create/   # MS Teams bot creation
|       |- recall-bot-list/     # List recall bots
|       |- recall-transcript/   # Recall.ai transcript retrieval
|       |- recall-webhook/     # Recall.ai webhook handler
|       |- search/              # RAG search endpoint
|       |- search-engine/       # Search engine logic
|       |- sync-github-pr/      # GitHub Pull Request sync
|       `- sync-jira/           # JIRA issue sync
|
|- .env                         # Development environment variables
|- .env.production.template     # Production env template
|- .env.sample                  # Sample environment variables
|- .env.staging.template        # Staging env template
|- CLAUDE.md                    # Claude Code project instructions
|- GEMINI.md                    # Gemini CLI instructions
|- README.md                    # Project README
|- components.json              # Shadcn/ui component registry
|- deploy.sh                    # Deployment script
|- deno.lock                    # Deno dependency lock file
|- eslint.config.js             # ESLint flat-config configuration
|- index.html                   # HTML entry point
|- package.json                 # NPM dependencies and scripts
|- postcss.config.js            # PostCSS configuration for Tailwind
|- tailwind.config.ts           # Tailwind CSS theme configuration
|- tsconfig.app.json            # TypeScript compiler options for app
|- tsconfig.json                # Root TypeScript configuration
|- tsconfig.node.json           # TypeScript for Node.js tools
|- vitest.config.ts             # Vitest unit test configuration
`- vite.config.ts               # Vite bundler configuration
```

---

## src/components/

**Path:** `src/components/`

**Purpose:** All React UI components. Organized by feature domain to group related functionality.

### src/components/ai-agents/

**Path:** `src/components/ai-agents/`

**Purpose:** AI agent configuration and management UI. Handles the creation, editing, and audit of configurable AI agents with autonomy settings, coding behavior, communication rules, and integration preferences.

**Key files:**
- `AgentAuditLog.tsx` -- Change history for agent configurations
- `AgentCard.tsx` -- Card display for a single agent
- `AgentConfigHeader.tsx` -- Header with agent name and status
- `AgentConfigTabs.tsx` -- Tab navigation for config categories
- `AgentExportImportDialog.tsx` -- Import/export functionality
- `AgentTemplateDialog.tsx` -- Template selection and creation
- `fields/` -- Form field components for each setting type (BooleanField, EnumField, JsonField, NumberField, StringField, OverrideIndicator, SettingField, SettingSection, SettingsGrid)
- `tabs/` -- Configuration tab panels (AutonomyConfigTab, CodingConfigTab, CommunicationConfigTab, DocumentationConfigTab, GitConfigTab, IntegrationConfigTab, LearningConfigTab, PerformanceConfigTab, SchedulingConfigTab, SecurityConfigTab)

### src/components/auth/

**Path:** `src/components/auth/`

**Purpose:** Authentication-related UI components for login, signup, password management, and logout flows.

**Key files:**
- `AuthLayout.tsx` -- Layout wrapper for auth pages
- `ForgotPasswordForm.tsx` -- Password reset request form
- `LoginForm.tsx` -- Email/password login form
- `LogoutButton.tsx` -- User logout trigger
- `PasswordInput.tsx` -- Password input with visibility toggle
- `ResetPasswordForm.tsx` -- New password entry after reset
- `SignupForm.tsx` -- New user registration form

### src/components/backlog-creation/

**Path:** `src/components/backlog-creation/`

**Purpose:** Multi-step wizard for AI-powered backlog generation from meeting transcripts. Orchestrates the flow from source selection through generation to review and confirmation.

**Key files:**
- `BacklogGenerationProgress.tsx` -- Progress indicator for wizard steps
- `BacklogGenerationWizard.tsx` -- Step wizard container with navigation
- `steps/BacklogConfirmationStep.tsx` -- Final review before saving
- `steps/BacklogGenerationStep.tsx` -- AI generation execution step
- `steps/BacklogReviewStep.tsx` -- Review generated backlog items
- `steps/MeetingSourceStep.tsx` -- Select meeting transcript source

### src/components/backlog/

**Path:** `src/components/backlog/`

**Purpose:** Backlog management UI including board view, list view, CSV import, and statistics dashboards.

**Key files:**
- `BacklogBoard.tsx` -- Kanban-style board with drag-drop columns
- `BacklogBoardView.tsx` -- Board view container with filters
- `BacklogCSVInputMethod.tsx` -- CSV file upload for bulk import
- `BacklogColumn.tsx` -- Single column in the board view
- `BacklogConvertDialog.tsx` -- Convert backlog items to features/tasks
- `BacklogFilters.tsx` -- Filter controls (priority, status, area)
- `BacklogImportDialog.tsx` -- Import dialog with multiple methods
- `BacklogItem.tsx` -- Individual backlog item card
- `BacklogItemCreator.tsx` -- Inline creation form for new items
- `BacklogItemForm.tsx` -- Full form for editing backlog items
- `BacklogItemPreviewList.tsx` -- Preview list for generated items
- `BacklogStatistics.tsx` -- Dashboard statistics container
- `BacklogTable.tsx` -- Tabular view alternative to board
- `BacklogTextInputMethod.tsx` -- Plain-text bulk input
- `BacklogToolbar.tsx` -- Toolbar with actions and view toggles
- `statistics/` -- Statistic cards (AgeDistributionCard, BusinessValueMatrix, FeaturePipelineCard, HealthScoreCard)
- `backlog-styles.css` -- Component-specific CSS
- `STYLING_GUIDE.md` -- Backlog styling conventions

### src/components/bugs/

**Path:** `src/components/bugs/`

**Purpose:** Bug reporting and tracking UI including creation forms, list views, and severity/status badges.

**Key files:**
- `BugAnalysisDialog.tsx` -- AI-powered bug analysis dialog
- `BugCard.tsx` -- Card display for a single bug
- `BugCreateSheet.tsx` -- Slide-out sheet for new bug creation
- `BugFilters.tsx` -- Filter controls for bug list
- `BugForm.tsx` -- Complete bug creation/edit form
- `BugList.tsx` -- Paginated list of bugs
- `BugPriorityBadge.tsx` -- Badge showing priority level
- `BugSeverityBadge.tsx` -- Badge showing severity level
- `BugStatusBadge.tsx` -- Badge showing current status
- `index.ts` -- Barrel export file

### src/components/calendar-events/

**Path:** `src/components/calendar-events/`

**Purpose:** Calendar event display components, including hero sections and attendee cards for meeting details.

**Key files:**
- `AttendeeCard.tsx` -- Attendee avatar and details card
- `CalendarEventHeroSection.tsx` -- Hero banner for event detail page
- `CopyToMeetingDialog.tsx` -- Copy event details to meeting record

### src/components/calendar-integration/

**Path:** `src/components/calendar-integration/`

**Purpose:** Microsoft Calendar integration components for connecting accounts, managing permissions, and listing upcoming recorded meetings.

**Key files:**
- `CalendarConnectionStatus.tsx` -- Shows OAuth connection status
- `CalendarIntegrationCard.tsx` -- Card for calendar account
- `CalendarSelectionList.tsx` -- List of calendars to sync
- `ConnectMicrosoftButton.tsx` -- OAuth initiation button
- `UpcomingRecordedMeetings.tsx` -- List of meetings with recordings
- `index.ts` -- Barrel export file

### src/components/chat/

**Path:** `src/components/chat/`

**Purpose:** RAG-powered chat interface components for querying project knowledge.

**Key files:**
- `ChatContainer.tsx` -- Main chat interface wrapper
- `FloatingChatButton.tsx` -- Floating action button to open chat
- `MessageBubble.tsx` -- Individual chat message bubble
- `MessageInput.tsx` -- Text input with send functionality
- `MessageList.tsx` -- Scrollable message history
- `SourcesPanel.tsx` -- Citation sources panel showing retrieved context
- `index.ts` -- Barrel export file
- `standalone/` -- Standalone chat page (StandaloneChat, constants, types)

### src/components/common/

**Path:** `src/components/common/`

**Purpose:** Reusable UI components shared across multiple feature areas, including project selection and tag inputs.

**Key files:**
- `ProjectSelector.tsx` -- Project dropdown selector
- `TagInput.tsx` -- Multi-value tag input component

### src/components/dashboard/

**Path:** `src/components/dashboard/`

**Purpose:** Dashboard and statistics components for displaying project metrics, team performance, and governance indicators.

**Key files:**
- `DashboardStats.tsx` -- Key metric cards
- `GovernanceMetrics.tsx` -- Governance area metrics
- `PlanningMetrics.tsx` -- Planning area metrics
- `QualityMetrics.tsx` -- Quality/testing area metrics
- `TeamPerformanceChart.tsx` -- Team performance visualization

### src/components/development/

**Path:** `src/components/development/`

**Purpose:** Development area components including style guide management, code review metrics, pull request dashboards, and AI agent configuration.

**Key files:**
- `AIAgentCreationDialog.tsx` -- Dialog for creating new AI agents
- `AIAgentSettings.tsx` -- Settings panel for agent configuration
- `AnalysisReportDetail.tsx` -- Detailed view of analysis report
- `AnalysisReportList.tsx` -- List of analysis reports
- `CodeReviewMetrics.tsx` -- Code review statistics
- `DevPerformanceDashboard.tsx` -- Developer performance metrics
- `PRMetricsDashboard.tsx` -- Pull request statistics
- `PullRequestList.tsx` -- List of GitHub PRs
- `RefactorInsights.tsx` -- Code refactoring suggestions
- `StyleGuideChatSettings.tsx` -- Chat settings for style guide
- `StyleGuideList.tsx` -- List of available style guides
- `StyleGuideViewer.tsx` -- Style guide content viewer with Monaco editor

### src/components/features/

**Path:** `src/components/features/`

**Purpose:** Feature management UI for the Planning area. Features are high-level product requirements that can be broken down into tasks.

**Key files:**
- `FeatureAttachments.tsx` -- File attachments for a feature
- `FeatureCard.tsx` -- Card display for a feature
- `FeatureCreateDialog.tsx` -- Dialog for creating new features
- `FeatureDetailSheet.tsx` -- Slide-out detail panel
- `FeatureFilters.tsx` -- Filter controls for feature list
- `FeatureForm.tsx` -- Feature creation/edit form
- `FeatureList.tsx` -- Paginated feature list
- `FeatureRelationshipGraph.tsx` -- Visual graph of feature dependencies
- `FeatureRelationships.tsx` -- Relationship management panel

### src/components/governance/

**Path:** `src/components/governance/`

**Purpose:** Governance area components including access control, allocation requests, JIRA integration configuration, platform settings, and RAG configuration.

**Key files:**
- `AccessControlForm.tsx` -- Access control rules editor
- `AllocationRequests.tsx` -- Team member allocation management
- `GovernanceAreaAccess.tsx` -- Area-level access management
- `GovernanceDocumentList.tsx` -- Governance document listing
- `GovernanceJiraConfigForm.tsx` -- JIRA integration configuration
- `GovernanceJiraList.tsx` -- List of JIRA integrations
- `MeetingRecordingConfig.tsx` -- MS Teams recording bot config
- `MeetingShare.tsx` -- Meeting sharing configuration
- `PlatformSettings.tsx` -- Platform-wide settings
- `RagConfig.tsx` -- RAG search configuration
- `UserCreationForm.tsx` -- Admin user creation form
- `UserManagement.tsx` -- User lifecycle management table

### src/components/knowledge-base/

**Path:** `src/components/knowledge-base/`

**Purpose:** Project knowledge base UI for managing structured knowledge entries organized by category and objectives.

**Key files:**
- `KnowledgeCategory.tsx` -- Category grouping for knowledge entries
- `KnowledgeEntryForm.tsx` -- Form for creating/editing entries
- `KnowledgeList.tsx` -- Paginated knowledge entry list

### src/components/layout/

**Path:** `src/components/layout/`

**Purpose:** Application shell components including sidebar navigation, header, and area-specific layouts.

**Key files:**
- `AreaNavLinks.tsx` -- Area-specific navigation links
- `Sidebar.tsx` -- Main application sidebar
- `SidebarHeader.tsx` -- Sidebar branding and project selector
- `SidebarNav.tsx` -- Navigation menu items
- `SidebarTeamSelector.tsx` -- Team selection in sidebar
- `TopBar.tsx` -- Top navigation bar

### src/components/meetings/

**Path:** `src/components/meetings/`

**Purpose:** Meeting management UI including creation forms, detail views, participant management, transcript display, and sharing.

**Key files:**
- `MeetingCard.tsx` -- Card display for a meeting
- `MeetingDetailSheet.tsx` -- Slide-out detail panel
- `MeetingForm.tsx` -- Meeting creation/edit form
- `MeetingFormBasicInfo.tsx` -- Basic information section of form
- `MeetingFormDateTime.tsx` -- Date and time section
- `MeetingFormParticipants.tsx` -- Participant selection
- `MeetingFormRecording.tsx` -- Recording settings section
- `MeetingFormReview.tsx` -- Review step before save
- `MeetingList.tsx` -- Paginated meeting list
- `MeetingParticipantForm.tsx` -- Add/edit participant
- `MeetingRecordingInfo.tsx` -- Recording status and controls
- `MeetingShareSettings.tsx` -- Sharing and visibility settings
- `MeetingTranscript.tsx` -- Transcript display component
- `MeetingViewPreferenceToggle.tsx` -- Toggle between list/detail view
- `PublicMeetingShare.tsx` -- Public share link management
- `PublicMeetingViewer.tsx` -- Public read-only meeting view

### src/components/planning/

**Path:** `src/components/planning/`

**Purpose:** Planning area components for AI-powered document generation including PRD, user stories, meeting notes, technical specs, and test cases.

**Key files:**
- `PlanningDocumentCreator.tsx` -- Main document generation orchestrator
- `PlanningDocumentForm.tsx` -- Form for document generation parameters

### src/components/projects/

**Path:** `src/components/projects/`

**Purpose:** Project management components including access control, collaboration management, repository management, and project creation wizard.

**Key files:**
- `AccessStatusBadge.tsx` -- Access level badge
- `BulkAccessDialog.tsx` -- Bulk access modification
- `BulkActionsBar.tsx` -- Bulk action toolbar
- `BulkDeleteDialog.tsx` -- Bulk delete confirmation
- `BulkOwnerAssignDialog.tsx` -- Bulk owner assignment
- `DocumentList.tsx` -- Project document listing
- `DocumentManager.tsx` -- Document upload and management
- `DocumentUpload.tsx` -- File upload component
- `GitRepositoryForm.tsx` -- Git repository connection form
- `GitRepositoryItem.tsx` -- Single repository item
- `GitRepositoryManager.tsx` -- Repository management panel
- `MemberListItem.tsx` -- Team member list item
- `ProjectAccessBadge.tsx` -- Project access level badge
- `ProjectAccessControl.tsx` -- Access control settings
- `ProjectAccessManager.tsx` -- Access management panel
- `ProjectActionsDropdown.tsx` -- Project action menu
- `ProjectActivityFeed.tsx` -- Recent activity feed
- `ProjectAvatar.tsx` -- Project avatar/initial display
- `ProjectBrandingFields.tsx` -- Branding metadata fields
- `ProjectCollaborators.tsx` -- Collaborator management
- `ProjectDeleteDialog.tsx` -- Delete confirmation dialog
- `ProjectDetailsCard.tsx` -- Project summary card
- `ProjectDetailsHeader.tsx` -- Project header section
- `ProjectFilters.tsx` -- Filter controls
- `ProjectFormDialog.tsx` -- Project creation/edit dialog
- `ProjectImportExportDialog.tsx` -- Data import/export
- `ProjectLeaderManager.tsx` -- Lead assignment
- `ProjectMemberManager.tsx` -- Member management
- `ProjectOverviewTab.tsx` -- Overview tab content
- `ProjectPermissionRules.tsx` -- Permission rules editor
- `ProjectPermissionsDialog.tsx` -- Permissions configuration
- `ProjectStatsCards.tsx` -- Statistics cards
- `ProjectTeamSelector.tsx` -- Team selection
- `ProjectVisibilitySettings.tsx` -- Visibility configuration
- `ProjectVisibilityToggle.tsx` -- Public/private toggle
- `TeamMemberManager.tsx` -- Team member management
- `wizard/` -- Multi-step project creation wizard (ProjectCreationWizard, WizardNavigation, WizardProgress, steps/BasicInfoStep including AIDescriptionChat, ChatInput, ChatMessage, DocumentSuggestions, FileUploadGuidance; steps/LinksStep, ReviewStep, TagsAndMetaStep, TeamStep)

### src/components/sprints/

**Path:** `src/components/sprints/`

**Purpose:** Sprint management components including creation forms, task assignment, and velocity tracking.

**Key files:**
- `SprintAnalytics.tsx` -- Sprint analytics dashboard
- `SprintCard.tsx` -- Card display for a sprint
- `SprintCreateDialog.tsx` -- Sprint creation dialog
- `SprintFilters.tsx` -- Sprint filter controls
- `SprintList.tsx` -- Paginated sprint list
- `SprintTaskBoard.tsx` -- Kanban board of sprint tasks
- `SprintVelocityChart.tsx` -- Velocity trend chart

### src/components/tasks/

**Path:** `src/components/tasks/`

**Purpose:** Task management components including CRUD operations, kanban board, sprint assignment, and AI suggestion integration.

**Key files:**
- `TaskAssigneeSelector.tsx` -- Assignee dropdown selector
- `TaskAttachmentList.tsx` -- Task file attachments
- `TaskBoard.tsx` -- Kanban board with status columns
- `TaskCard.tsx` -- Card display for a task
- `TaskColumn.tsx` -- Single status column
- `TaskCreateDialog.tsx` -- Task creation dialog
- `TaskDetailSheet.tsx` -- Slide-out task detail panel
- `TaskFilters.tsx` -- Filter controls for task list
- `TaskForm.tsx` -- Task creation/edit form
- `TaskFormBasicInfo.tsx` -- Basic info section
- `TaskFormDescription.tsx` -- Description with AI enhancement
- `TaskFormEstimates.tsx` -- Estimate fields (points, hours)
- `TaskFormMetadata.tsx` -- Metadata fields (labels, area)
- `TaskFormReview.tsx` -- Review step before save
- `TaskList.tsx` -- Paginated task list
- `TaskPriorityBadge.tsx` -- Priority indicator badge
- `TaskStatusBadge.tsx` -- Status indicator badge
- `TaskSprintSelector.tsx` -- Sprint assignment selector

### src/components/transcriptions/

**Path:** `src/components/transcriptions/`

**Purpose:** Meeting transcription UI components including document generation triggers and related document display.

**Key files:**
- `DocumentGenerator.tsx` -- Document generation from transcript
- `RelatedDocuments.tsx` -- Documents generated from this transcript
- `TranscriptEditor.tsx` -- Editable transcript view
- `TranscriptList.tsx` -- List of meeting transcripts

### src/components/ui/

**Path:** `src/components/ui/`

**Purpose:** Shadcn/ui base component library. All components are built on Radix UI primitives and styled with Tailwind CSS. This directory contains the foundational UI building blocks used throughout the application.

**Key files:**
- `alert-dialog.tsx` -- Alert dialog (Radix AlertDialog)
- `aspect-ratio.tsx` -- Aspect ratio container
- `avatar.tsx` -- Avatar with image/fallback (Radix Avatar)
- `badge.tsx` -- Status and label badges
- `button.tsx` -- Button with variants (Radix Slot)
- `calendar.tsx` -- Calendar date picker (react-day-picker)
- `card.tsx` -- Card container components
- `carousel.tsx` -- Image/content carousel (embla-carousel)
- `chart.tsx` -- Chart wrapper (recharts)
- `checkbox.tsx` -- Checkbox input (Radix Checkbox)
- `collapsible.tsx` -- Collapsible section (Radix Collapsible)
- `command.tsx` -- Command palette (cmdk)
- `context-menu.tsx` -- Right-click context menu (Radix ContextMenu)
- `dialog.tsx` -- Modal dialog (Radix Dialog)
- `dropdown-menu.tsx` -- Dropdown menu (Radix DropdownMenu)
- `form.tsx` -- React Hook Form + Zod integration
- `hover-card.tsx` -- Hover reveal card (Radix HoverCard)
- `input.tsx` -- Text input field
- `label.tsx` -- Form label (Radix Label)
- `menubar.tsx` -- Menu bar (Radix Menubar)
- `navigation-menu.tsx` -- Navigation menu (Radix NavigationMenu)
- `popover.tsx` -- Popover panel (Radix Popover)
- `progress.tsx` -- Progress bar (Radix Progress)
- `radio-group.tsx` -- Radio button group (Radix RadioGroup)
- `resizable.tsx` -- Resizable panel (react-resizable-panels)
- `scroll-area.tsx` -- Custom scrollbar (Radix ScrollArea)
- `select.tsx` -- Select dropdown (Radix Select)
- `separator.tsx` -- Horizontal/vertical divider (Radix Separator)
- `sheet.tsx` -- Slide-out panel (vaul)
- `skeleton.tsx` -- Loading placeholder
- `slider.tsx` -- Range slider (Radix Slider)
- `sonner.tsx` -- Toast notifications (sonner)
- `switch.tsx` -- Toggle switch (Radix Switch)
- `table.tsx` -- Table components (thead, tbody, tr, td, th)
- `tabs.tsx` -- Tab panels (Radix Tabs)
- `textarea.tsx` -- Multi-line text input
- `toast.tsx` -- Toast notification components
- `toggle.tsx` -- Toggle button (Radix Toggle)
- `toggle-group.tsx` -- Toggle button group (Radix ToggleGroup)
- `tooltip.tsx` -- Tooltip (Radix Tooltip)
- `use-toast.ts` -- Toast hook and utilities

### src/components/quality/

**Path:** `src/components/quality/`

**Purpose:** Quality and testing area components including accessibility testing, automated test generation, bug reports, and performance testing.

**Key files:**
- `AccessibilityReportViewer.tsx` -- Accessibility test results display
- `AccessibilityTestForm.tsx` -- URL input for accessibility test
- `AutomatedTestDashboard.tsx` -- Automated test overview
- `BugReportsDashboard.tsx` -- Bug statistics dashboard
- `PerformanceReportViewer.tsx` -- Performance test results
- `PerformanceTestForm.tsx` -- Performance test configuration
- `TestCaseDetail.tsx` -- Test case detail view
- `TestCaseForm.tsx` -- Test case creation/edit
- `TestCaseList.tsx` -- Test case listing
- `TestGeneratorForm.tsx` -- AI test generation form

---

## src/contexts/

**Path:** `src/contexts/`

**Purpose:** React Context providers for global application state that does not belong in TanStack Query (server state). Includes authentication, project selection, and team management.

**Key files:**
- `AuthContext.tsx` -- Supabase authentication state and methods (user session, sign in/out)
- `ProjectSelectionContext.tsx` -- Current selected project state and methods (selectedProject, selectProject)
- `TeamContext.tsx` -- Current team context for multi-team scenarios

---

## src/hooks/

**Path:** `src/hooks/`

**Purpose:** Custom React hooks, primarily thin wrappers around TanStack Query that encapsulate data fetching, mutations, and caching logic for each feature domain. Organized by feature.

**Key subdirectories and files:**

- `documents/` -- Document-related hooks (useDocumentActions, useDocumentFilters, useDocumentPagination, useDocumentSelection, useDocumentSort)
- `__tests__/` -- Unit tests for hooks

**Key hook files (top-level):**

| Category | Hook Files |
|----------|-----------|
| **AI Agents** | `useAIAgents.ts`, `useAgentConfig.ts`, `useAgentConfigAudit.ts`, `useAgentConfigTemplates.ts` |
| **Accessibility** | `useAccessibilityTest.ts` |
| **Admin** | `useAdminUserCreation.ts` |
| **Area Access** | `useAreaAccess.ts`, `useAreaDetection.ts` |
| **Backlog** | `useBacklog.ts`, `useBacklogDragDrop.ts`, `useBacklogGeneration.ts` |
| **Batch Operations** | `useBatchSprintCreation.ts`, `useBatchTaskOperations.ts`, `useBulkProjectActions.ts` |
| **Bugs** | `useBugById.ts`, `useBugCreate.ts`, `useBugStatistics.ts`, `useBugs.ts` |
| **Calendar** | `useCalendarConnection.ts`, `useCalendarEventDetail.ts`, `useCopyCalendarEventToMeeting.ts` |
| **Code Review** | `useCodeReviewMetrics.ts` |
| **Company Knowledge** | `useCompanyKnowledge.ts` |
| **Dashboard** | `useDashboardStats.ts` |
| **Description Generation** | `useDescriptionGeneration.ts`, `useEnhanceDescription.ts` |
| **Dev Performance** | `useDevPerformance.ts` |
| **Documents** | `useDocumentApproval.ts`, `useDocumentContent.ts`, `useDocumentTypes.ts`, `useDocumentUpdate.ts`, `useDocuments.ts`, `usePlanningDocuments.ts` |
| **Features** | `useFeatureAttachments.ts`, `useFeatureGeneration.ts`, `useFeatureRelationships.ts`, `useFeatures.ts` |
| **Generate Tasks** | `useGenerateTasks.ts` |
| **GitHub** | `useGitHubAccountMappings.ts`, `useGitHubPRMetrics.ts`, `useGitHubPRStats.ts`, `useGitHubPullRequestDetail.ts`, `useGitHubPullRequests.ts`, `useGitRepositories.ts` |
| **Governance** | `useGovernance.ts`, `useGovernanceDocuments.ts`, `useGovernanceIndexingStatus.ts`, `useGovernanceJiraConfig.ts` |
| **Indexing** | `useIgnoredRecords.ts`, `useIndexingStatus.ts` |
| **JIRA** | `useJiraConfig.ts`, `useJiraSync.ts` |
| **Load Test** | `useLoadTest.ts` |
| **Meetings** | `useMeetingAssets.ts`, `useMeetingDetails.ts`, `useMeetingMutations.ts`, `useMeetingRecordingSettings.ts`, `useMeetingShareToken.ts`, `useMeetingTranscripts.ts`, `useMeetingViewPreference.ts`, `useMeetingWithTranscript.ts`, `useMeetings.ts` |
| **Member Allocation** | `useMemberAllocation.ts`, `useMemberProjects.ts` |
| **Mentions** | `useMentionAutocomplete.ts` |
| **Notifications** | `useNotificationPreferences.ts` |
| **Performance** | `useErrorMonitor.ts`, `usePerformanceMonitor.ts`, `usePerformanceTest.ts` |
| **Platform** | `usePlatformSettings.ts` |
| **Presigned URLs** | `usePresignedDownload.ts`, `usePresignedUpload.ts` |
| **Profiles** | `useProfiles.ts` |
| **Projects** | `useProjectActivity.ts`, `useProjectCollaborators.ts`, `useProjectMembers.ts`, `useProjectPermissions.ts`, `useProjectSelection.ts`, `useProjectTeamMembers.ts`, `useProjectTeams.ts` |
| **Reports** | `useAnalysisReports.ts`, `useCentralizedDocumentTypes.ts` |
| **Share Tokens** | `useAllShareTokens.ts` |
| **Share Allocation** | `useAllocationRequests.ts` |
| **Style Guide Chat** | `useStyleGuideChatSettings.ts` |
| **UI Utilities** | `useDebounce.ts`, `useI18n.ts`, `useToast.ts` |

---

## src/lib/

**Path:** `src/lib/`

**Purpose:** Core business logic, service classes, utilities, AI integrations, and RAG implementation. This is the largest and most critical directory, containing all shared logic not specific to a single component.

### src/lib/openai*.ts

**Path:** `src/lib/openai*.ts`

**Purpose:** OpenAI API integration layer. Handles AI-powered document generation, conversation tracking, and AI-enhanced task description generation.

**Key files:**
- `openai.ts` -- Main OpenAI client with Responses API integration for document generation (legacy; deprecated for document generation in favor of Edge Functions; still used for task creation)
- `openai-secure.ts` -- Secure OpenAI client wrapper (server-side key management pattern)
- `openai.test.ts` -- Unit tests for OpenAI integration

### src/lib/services/

**Path:** `src/lib/services/`

**Purpose:** Service classes that encapsulate business logic and Supabase interactions for each feature domain. These services abstract database operations behind a clean API.

**Key files:**

| Service | Purpose |
|---------|---------|
| `admin-user-service.ts` | Admin user provisioning and management |
| `agent-config-service.ts` | AI agent configuration CRUD and versioning |
| `ai-document-generation.ts` | AI document generation orchestration |
| `analysis-reports-service.ts` | Code analysis report management |
| `backlog-conversion.ts` | Convert backlog items to features/tasks |
| `backlog-service.ts` | Backlog item CRUD operations |
| `bug-service.ts` | Bug report CRUD and statistics |
| `calendar-integration-service.ts` | Microsoft Calendar OAuth and sync |
| `code-review-metrics-service.ts` | Code review metric calculations |
| `comment-service.ts` | Task and document comments |
| `description-synthesizer.ts` | AI description enhancement |
| `dev-performance-service.ts` | Developer performance metrics |
| `document-generation-service.ts` | Frontend wrapper for Edge Function document generation |
| `enhanced-project-service.ts` | Extended project operations |
| `feature-attachment-service.ts` | Feature file attachments |
| `feature-service.ts` | Feature CRUD and relationships |
| `github-pr-metrics-service.ts` | GitHub PR metric calculations |
| `github-sync-service.ts` | GitHub PR synchronization |
| `governance-service.ts` | Governance area operations |
| `indexing-service.ts` | RAG indexing management |
| `jira-integration-service.ts` | JIRA synchronization and metrics |
| `meeting-recording-service.ts` | MS Teams recording bot management |
| `meeting-service.ts` | Meeting CRUD operations |
| `member-allocation-service.ts` | Team member allocation |
| `microsoft-auth-service.ts` | MS OAuth token management |
| `microsoft-calendar-service.ts` | MS Calendar API operations |
| `openai-cost-tracking-service.ts` | Token usage and cost tracking |
| `permission-service.ts` | Permission checking and enforcement |
| `platform-settings-service.ts` | Platform-wide configuration |
| `presigned-url-service.ts` | Secure upload/download URL generation |
| `project-import-export-service.ts` | Project data import/export |
| `project-service.ts` | Core project CRUD operations |
| `pull-request-service.ts` | GitHub PR management |
| `rag-search-service.ts` | RAG search operations |
| `recall-bot-service.ts` | Recall.ai bot management |
| `refactor-insight-service.ts` | Refactoring suggestion management |
| `repository-service.ts` | Git repository management |
| `search-engine-service.ts` | Search indexing and retrieval |
| `share-token-service.ts` | Share token generation and validation |
| `sprint-service.ts` | Sprint CRUD and analytics |
| `style-guide-service.ts` | Style guide management |
| `suggested-task-service.ts` | AI task suggestions |
| `task-service.ts` | Task CRUD operations |
| `team-member-service.ts` | Team member management |
| `team-service.ts` | Team CRUD operations |
| `token-usage-service.ts` | AI token usage tracking |
| `transcript-service.ts` | Meeting transcript management |
| `transcript-streaming-service.ts` | Streaming transcript processing |
| `user-access-service.ts` | User access level management |
| `user-profile-service.ts` | User profile CRUD |
| `__tests__/` | Unit tests for services |

### src/lib/utils/

**Path:** `src/lib/utils/`

**Purpose:** Pure utility functions for formatting, validation, date handling, and common operations.

**Key files:**
- `cn.ts` -- Class name merger (clsx + tailwind-merge)
- `date.ts` -- Date formatting and manipulation utilities
- `error.ts` -- Error handling utilities
- `format.ts` -- General formatting helpers (currency, number, text)
- `id.ts` -- ID generation utilities
- `priority.ts` -- Priority level helpers
- `status.ts` -- Status mapping utilities
- `text.ts` -- Text manipulation utilities
- `validation.ts` -- Zod schemas and validation helpers

### src/lib/rag/

**Path:** `src/lib/rag/`

**Purpose:** Retrieval-Augmented Generation (RAG) implementation for knowledge-based chat and search. Handles vector storage, embedding generation, search orchestration, and conversation context.

**Key files:**
- `chat-service.ts` -- RAG chat orchestration (builds context, calls OpenAI, streams response)
- `conversation-context.ts` -- Maintains conversation history for RAG sessions
- `embedding-generator.ts` -- OpenAI embedding generation for document chunking
- `index.ts` -- Barrel export
- `initial-indexer.ts` -- Initial project content indexing
- `prompt-builder.ts` -- Builds system and user prompts with retrieved context
- `prompts/context-formatters.ts` -- Formats retrieved documents for prompts
- `prompts/grounding-rules.ts` -- Grounding rules for AI responses
- `prompts/index.ts` -- Prompt barrel exports
- `prompts/query-analyzer.ts` -- Analyzes user queries for search strategy
- `prompts/reasoning-templates.ts` -- Chain-of-thought reasoning templates
- `prompts/system-prompts.ts` -- System prompt templates
- `prompts/types.ts` -- Prompt-related type definitions
- `prompts/user-facing-messages.ts` -- Localized user-facing messages
- `search-engine.ts` -- Semantic search implementation using cosine similarity
- `source-tracker.ts` -- Tracks which documents were used as context
- `streaming-client.ts` -- Streaming OpenAI response handler for RAG
- `sync-orchestrator.ts` -- Coordinates content changes with vector store updates
- `vector-storage.ts` -- Vector storage abstraction (SQLite via Turso/libSQL)

### src/lib/security/

**Path:** `src/lib/security/`

**Purpose:** Security utilities for input sanitization and cryptographic operations.

**Key files:**
- `crypto.ts` -- Encryption/decryption utilities
- `input-sanitizer.ts` -- User input sanitization
- `sanitization.ts` -- General sanitization helpers

### src/lib/jira/

**Path:** `src/lib/jira/`

**Purpose:** JIRA integration utilities including status mapping, error translation, and formatting.

**Key files:**
- `error-translator.ts` -- Translates JIRA API errors to user messages
- `formatters.ts` -- JIRA field formatters
- `status-mappings.ts` -- Maps JIRA statuses to internal statuses

### src/lib/mock-data/

**Path:** `src/lib/mock-data/`

**Purpose:** Mock data for development and testing scenarios.

**Key files:**
- `legacy-code/` -- Mock data for legacy code analysis features (code-health-data, compatibility-data, migration-tracker-data, refactoring-plans-data, tech-debt-data, index)

### src/lib/observability/

**Path:** `src/lib/observability/`

**Purpose:** Observability and monitoring utilities for error sanitization and logging.

**Key files:**
- `sanitize-error.ts` -- Strips sensitive information from error objects

### src/lib/constants/

**Path:** `src/lib/constants/`

**Purpose:** Application-wide constants and static configuration data.

**Key files:**
- `drag-drop.ts` -- Drag-and-drop configuration
- `meeting-template-variables.ts` -- Template variable definitions
- `meeting-type-templates.ts` -- Meeting type templates

### src/lib/navigation/

**Path:** `src/lib/navigation/`

**Purpose:** Navigation utilities including area-to-route mapping.

**Key files:**
- `areaMapping.ts` -- Maps navigation areas to routes and metadata

### src/lib/migrations/

**Path:** `src/lib/migrations/`

**Purpose:** Data migration scripts for schema and feature updates.

**Key files:**
- `prompt-to-document-migration.ts` -- Migrates prompt-based docs to document model

### Other lib files:

| File | Purpose |
|------|---------|
| `advanced-integration-patterns.ts` | Advanced AI integration patterns |
| `analytics-dashboard.ts` | Analytics dashboard utilities |
| `audit-trail.ts` | Audit logging utilities |
| `backward-compatibility.ts` | Legacy code compatibility helpers |
| `cache-config.ts` | Cache configuration |
| `chunk-error-handler.ts` | Chunk processing error handling |
| `conversation-context-utils.ts` | Conversation context utilities |
| `conversation-tracking.ts` | AI conversation tracking |
| `conversation-tracking-integration.ts` | Conversation tracking integration |
| `cost-management.ts` | AI cost management utilities |
| `cost-monitoring-dashboard.ts` | Cost monitoring display utilities |
| `document-model-selector.ts` | Document model selection logic |
| `document-pipeline.ts` | Document processing pipeline |
| `enhanced-project-context.ts` | Enhanced project context utilities |
| `errors/voice-recording-errors.ts` | Voice recording error definitions |
| `feature-toggles.ts` | Feature flag management |
| `instruction-loader.ts` | Loads instructions for AI agents |
| `intelligent-caching.ts` | Intelligent caching strategy |
| `knowledge-context.ts` | Knowledge base context utilities |
| `lazy-with-retry.ts` | Lazy loading with retry logic |
| `legacy-code-utils.ts` | Legacy code analysis utilities |
| `logger.ts` | Application logging |
| `meeting-project-service.ts` | Meeting-project relationship service |
| `migration-utilities.ts` | General migration helpers |
| `optimized-sequential-generator.ts` | Optimized sequential document generation |
| `pattern-quality-assessment.ts` | Code pattern quality scoring |
| `performance-comparison.ts` | Performance comparison utilities |
| `performance-monitoring.ts` | Performance monitoring utilities |
| `predictive-quality-analysis.ts` | Predictive quality analysis |
| `projects-import-export.ts` | Project import/export |
| `projects.ts` | Project utilities |
| `prompt-loader.ts` | Loads AI prompts from files |
| `prompt-storage.ts` | Prompt storage utilities |
| `prompt-templates.ts` | Prompt template definitions |
| `prompts.ts` | Prompt definitions |
| `quality-gates.ts` | Quality gate definitions |
| `quality-metrics-calculator.ts` | Quality metric calculations |
| `quality-validation.ts` | Quality validation logic |
| `sequential-caching-system.ts` | Sequential caching implementation |
| `sequential-cost-optimizer.ts` | Cost optimization for sequential operations |
| `sequential-document-generator.ts` | Sequential document generation |
| `sequential-error-recovery.ts` | Error recovery for sequential operations |
| `sequential-generation-refactored.ts` | Refactored sequential generation |

---

## src/pages/

**Path:** `src/pages/`

**Purpose:** Route-level page components. Each file typically corresponds to one URL route defined in `src/routes.tsx`. Pages compose smaller components to create full page layouts.

**Key pages:**

| Route Area | Page Files |
|------------|-----------|
| **Root** | `ChatPage.tsx`, `Code.tsx`, `Dashboard.tsx`, `DemosPage.tsx`, `DocumentsListingPage.tsx`, `ForgotPassword.tsx`, `KnowledgeFormPage.tsx`, `KnowledgeListPage.tsx`, `Login.tsx`, `ManageProjects.tsx`, `MeetingCreate.tsx`, `MeetingEdit.tsx`, `MeetingList.tsx`, `Metrics.tsx`, `MyDraftsPage.tsx`, `NotFound.tsx`, `PermissionsVisibilityPage.tsx`, `ProjectDetails.tsx`, `ProjectForm.tsx`, `ProjectSelector.tsx`, `QA.tsx`, `RepositoriesListingPage.tsx`, `ResetPassword.tsx`, `SprintList.tsx`, `StandaloneChatTestPage.tsx`, `SuggestedTasks.tsx`, `TaskDocumentViewerPage.tsx`, `Tasks.tsx`, `Teams.tsx`, `UploadMedia.tsx` |
| **Admin** | `admin/IndexingManagementPage.tsx` |
| **Areas (Landing)** | `areas/DevelopmentLanding.tsx`, `areas/GovernanceLanding.tsx`, `areas/LegacyCodeLanding.tsx`, `areas/PlanningLanding.tsx`, `areas/QualityLanding.tsx` |
| **Auth Callbacks** | `auth/CalendarOAuthCallback.tsx` |
| **Backlog** | `backlog/BacklogBoardPage.tsx`, `backlog/BacklogGenerationPage.tsx`, `backlog/BacklogHubPage.tsx`, `backlog/BacklogListPage.tsx`, `backlog/BacklogPrioritizationPage.tsx`, `backlog/BacklogStatisticsPage.tsx` |
| **Calendar Events** | `calendar-events/CalendarEventDetailPage.tsx` |
| **Development** | `development/AIAgentConfigPage.tsx`, `development/AIAgentsListPage.tsx`, `development/AnalysisReportDetailPage.tsx`, `development/AnalysisReportsPage.tsx`, `development/CodeReviewMetricsPage.tsx`, `development/DevPerformanceComparePage.tsx`, `development/DevPerformanceDashboard.tsx`, `development/DevPerformanceDetailPage.tsx`, `development/PRMetricsDashboard.tsx`, `development/PullRequestsDashboard.tsx`, `development/RefactorInsightsPage.tsx`, `development/StyleGuideChatSettingsPage.tsx`, `development/StyleGuideDetailPage.tsx`, `development/StyleGuidesPage.tsx` |
| **Governance** | `governance/AccessControlPage.tsx`, `governance/AllocationRequestsPage.tsx`, `governance/AreaAccessPage.tsx`, `governance/GovernanceDocumentsPage.tsx`, `governance/GovernanceIndexingPage.tsx`, `governance/GovernanceJiraConfigFormPage.tsx`, `governance/GovernanceJiraIntegrationsListPage.tsx`, `governance/GovernanceMeetingSharePage.tsx`, `governance/MeetingRecordingConfigPage.tsx`, `governance/PlatformSettingsPage.tsx`, `governance/RagConfigPage.tsx`, `governance/UserManagementPage.tsx` |
| **Legacy Code** | `legacy-code/CodeHealthDashboard.tsx`, `legacy-code/CompatibilityPage.tsx`, `legacy-code/MigrationTrackerPage.tsx`, `legacy-code/RefactoringPlansPage.tsx`, `legacy-code/TechDebtRegistryPage.tsx` |
| **Legal** | `legal/PrivacyPolicyPage.tsx`, `legal/TermsOfServicePage.tsx` |
| **Meetings** | `meetings/MeetingDetailPage.tsx`, `meetings/PublicMeetingSharePage.tsx` |
| **Planning** | `planning/FeatureCreationPage.tsx`, `planning/FeatureDetailPage.tsx`, `planning/FeaturesListPage.tsx`, `planning/PlanningDocumentsPage.tsx` |
| **Products** | `products/ProductCreationPage.tsx` |
| **Quality** | `quality/AccessibilityReportsPage.tsx`, `quality/AccessibilityTestPage.tsx`, `quality/AutomatedTestingDashboard.tsx`, `quality/BugDetailPage.tsx`, `quality/BugListPage.tsx`, `quality/BugReportsDashboard.tsx`, `quality/PerformanceReportsPage.tsx`, `quality/PerformanceTestPage.tsx`, `quality/TestCasesPage.tsx`, `quality/TestGeneratorPage.tsx` |
| **Sprints** | `sprints/SprintAnalyticsPage.tsx`, `sprints/SprintDetails.tsx`, `sprints/SprintForm.tsx`, `sprints/SprintTasks.tsx` |
| **Tasks** | `tasks/AISuggestedTasksPage.tsx`, `tasks/TaskEditPage.tsx` |

---

## src/types/

**Path:** `src/types/`

**Purpose:** TypeScript type definitions and interfaces for all data models, API responses, and configuration objects. These types are used throughout the application to ensure type safety.

**Key type files:**

| Category | Files |
|----------|-------|
| **AI Agents** | `agent-config.ts`, `user-ai-config.ts` |
| **Accessibility** | `accessibility-test.ts` |
| **Allocation** | `allocation-request.ts` |
| **Analysis** | `analysis-report.ts`, `code-review-metrics.ts`, `refactor-insight.ts` |
| **Backlog** | `backlog-generation.ts`, `backlog.ts` |
| **Bugs** | `bug.ts` |
| **Calendar** | `calendar-event-mapping.ts`, `calendar-integration.ts`, `meeting-recorder.ts`, `meeting-recording-settings.ts`, `recurring-meeting.ts` |
| **Code Review** | `code-review-metrics.ts` |
| **Development** | `dev-performance.ts`, `dev-task.ts`, `git-repository.ts`, `github-pr-metrics.ts`, `github-pr.ts`, `style-guide-chat-settings.ts`, `style-guide.ts` |
| **Documents** | `centralized-document-types.ts`, `document-save.ts`, `document-types.ts`, `document.ts`, `documents.ts`, `feature-document.ts`, `json-document-types.ts`, `markdown.ts` |
| **Editor** | `editor.ts` |
| **Features** | `feature-attachment.ts`, `feature-creation.ts`, `feature.ts` |
| **Governance** | `governance.ts`, `indexing.ts`, `platform-settings.ts`, `rag-config.ts` |
| **JIRA** | `jira.ts` |
| **Knowledge** | `knowledge.ts` |
| **Legacy Code** | `legacy-code.ts` |
| **Meetings** | `meeting-asset.ts`, `meeting-participant.ts`, `meeting-project.ts`, `meeting-share.ts`, `meeting-view.ts`, `meeting-with-transcript.ts`, `meeting.ts`, `transcript.ts`, `transcription.ts` |
| **Navigation** | `navigation.ts` |
| **Performance** | `error-monitor.ts`, `performance-test.ts`, `test-generator.ts` |
| **Permissions** | `user-access.ts`, `user-area-access.ts`, `user-notification-preferences.ts`, `user-project-access.ts` |
| **Planning** | `prompt.ts`, `suggestions.ts` |
| **Product** | `demo-video.ts`, `enhanced-project.ts` |
| **Projects** | `project-selection.ts`, `project-team-member.ts`, `project-wizard.types.ts`, `project.ts` |
| **Sprints** | `sprint-analytics.ts`, `sprint.ts` |
| **Tasks** | `task-attachment.ts`, `task-comment.ts`, `task-selection.ts` |
| **Team** | `team.ts` |
| **Translations** | `translations.ts` |
| **Users** | `user-admin.ts`, `user-profile.ts` |
| **Index** | `index.ts` -- Barrel export for all types |
| **Declarations** | `markdown.d.ts` -- Markdown module declaration |

---

## src/locales/

**Path:** `src/locales/`

**Purpose:** Internationalization (i18n) translation files. The project supports two locales: Portuguese (Brazil) and English (US). Translations are organized by namespace (feature area) and locale.

**Structure:**
```
src/locales/
|- en-us.ts              # English root entry point
|- pt-br.ts              # Portuguese root entry point
|- modules/              # Feature-specific translation modules
|   |- auth/             # Authentication translations
|   |- backlog/          # Backlog translations
|   |- bugs/             # Bug tracking translations
|   |- calendar/         # Calendar translations
|   |- chat/             # Chat/RAG translations
|   |- core/             # Core UI translations (common, errors, navigation, ui)
|   |- demos/            # Demo page translations
|   |- development/      # Development area translations (aiAgents, analysisReports, codeReviewMetrics, codeRules, devPerformance, prMetrics, pullRequests, refactorInsights, styleGuideChatSettings, styleGuides)
|   |- documents/        # Document translations (convert, documentCard, documents, fileUpload, requirements)
|   |- features/          # Feature translations
|   |- governance/        # Governance area translations (accessControl, aiSettings, allocationRequests, documents, governance, meetingRecordingConfig, meetingShare, permissionsPage, ragConfig, repository, userCreation)
|   `- jira/             # JIRA translations
```

Each module directory contains:
- `en-us/[namespace].ts` -- English translations for that namespace
- `pt-br/[namespace].ts` -- Portuguese translations for that namespace
- `index.ts` -- Barrel export for the module

---

## supabase/functions/

**Path:** `supabase/functions/`

**Purpose:** Deno-based Supabase Edge Functions that run server-side. These handle AI document generation, API endpoints, integrations with external services (JIRA, GitHub, Microsoft Calendar, Recall.ai), and RAG search.

### supabase/functions/_shared/

**Path:** `supabase/functions/_shared/`

**Purpose:** Shared utilities, types, and services reused across all Edge Functions. Organized by domain.

**Key subdirectories:**

| Subdirectory | Purpose |
|-------------|---------|
| `document-generation/` | Shared AI document generation logic (types, prompt-builder, openai-service, ai-interaction-service, generated-document-service, token-extractor, validation, response-builder, openai-helper) |
| `github/` | GitHub API client, pagination, rate limiting, retry logic, types, DB service |
| `indexing/` | RAG indexing content extractors (backlog, feature, generated-document, knowledge-base, meeting, style-guide, task) plus chunking, embeddings, content-extractor-factory |
| `jira/` | JIRA API client, error handling, logging, metrics, DB service (optimized) |
| `pdf-extraction/` | PDF parsing (pdf-parser, text-processor, types) |
| `platform-settings/` | Platform settings loader and service |
| `rag-context/` | RAG context building and configuration |
| `storage/` | Cloud storage abstraction (GCS, S3 providers, factory) |
| `supabase/` | Supabase client and types for Edge Functions |

**Other shared files:**
- `admin-user-types.ts` -- Admin user type definitions
- `api-response-builder.ts` -- Standardized API response formatting
- `batch-processor.ts` -- Batch processing utilities
- `cors.ts` -- CORS headers configuration
- `database-utils.ts` -- Database utility functions
- `developer-matrix/service.ts` -- Developer matrix service
- `encryption.ts` -- Encryption utilities
- `external-service-database.ts` -- External service database operations
- `external-service-types.ts` -- External service type definitions
- `external-service-utils.ts` -- External service utilities
- `field-mapper.ts` -- Field mapping utilities
- `ms-calendar-types.ts` -- Microsoft Calendar types
- `ms-oauth-scopes.ts` -- MS OAuth scope definitions
- `ms-oauth-utils.ts` -- Microsoft OAuth utilities
- `recall-bot-types.ts` -- Recall.ai bot types
- `response-formatter.ts` -- Response formatting
- `transcript-streaming-parser.ts` -- Streaming transcript parsing
- `validation.ts` -- Validation utilities
- `jira-alerts.ts` -- JIRA alert utilities

### supabase/functions/ (top-level Edge Functions)

| Function | Purpose |
|----------|---------|
| `accessibility-test/` | Google PageSpeed API integration for accessibility testing |
| `add-meet-recorder/` | Adds Recall.ai bot to MS Teams meetings |
| `admin-create-user/` | Admin user account creation |
| `admin-soft-delete-user/` | Soft-delete user accounts |
| `analyze-sprint/` | Sprint health analysis via AI |
| `analyze-transcript/` | Meeting transcript AI analysis |
| `api-backlog-items/` | REST API for backlog CRUD (with data-mapper, database-service, request-handler, response-builder, types, validation) |
| `api-docs/` | API documentation serving |
| `api-rag-search/` | RAG-powered semantic search API |
| `api-sprint-details/` | Sprint detail retrieval endpoint |
| `api-sprints-list/` | Sprint listing endpoint |
| `api-task-assign/` | Task assignment endpoint |
| `api-task-details/` | Task detail retrieval |
| `api-task-status/` | Task status update |
| `api-tasks-list/` | Task listing endpoint |
| `api-team-members-list/` | Team member listing |
| `create-meeting-notes/` | AI generates structured meeting notes from transcript |
| `create-prd/` | AI generates Product Requirements Document |
| `create-technical-specs/` | AI generates technical specifications |
| `create-test-cases/` | AI generates test cases from requirements |
| `create-unit-tests/` | AI generates unit tests |
| `create-user-story/` | AI generates user stories |
| `extract-pdf/` | PDF content extraction |
| `generate-presigned-download-url/` | Generates secure presigned download URLs |
| `microsoft-calendar-integration/` | MS Calendar OAuth and event sync |
| `process-transcript/` | Meeting transcript processing pipeline |
| `recall-bot-create/` | Creates Recall.ai bot for meeting recording |
| `recall-bot-list/` | Lists Recall.ai bots |
| `recall-transcript/` | Retrieves transcript from Recall.ai |
| `recall-webhook/` | Handles Recall.ai webhook events |
| `search/` | RAG search endpoint |
| `search-engine/` | Core search engine logic |
| `sync-github-pr/` | Synchronizes GitHub pull requests |
| `sync-jira/` | Synchronizes JIRA issues |

---

## docs/

**Path:** `docs/`

**Purpose:** Comprehensive project documentation covering architecture, features, APIs, integration guides, governance, and product planning.

**Key directories:**

| Directory | Purpose |
|-----------|---------|
| `api/` | API endpoint documentation (accessibility-test, backlog-items, calendar-integration, sprint endpoints, task endpoints, team-members, document-generation, creating-new-document-generation-function, api-documentation-guide) |
| `Code Rules/` | Coding standards (frontend-style-guide.md, sql-style-guide.md) |
| `edge-functions/` | Edge Function documentation (SUPABASE-DOCS-INDEX, ms-calendar-sync, user creation) |
| `features/` | Feature documentation (TEST_GENERATOR_USER_GUIDE, github-pr-sync, i18n-implementation-guide, presigned-upload-implementation, style-guide-chat-system, voice-task-generation-chatgpt, console-boundary-implementation, external-service-utils) |
| `frontend/` | Frontend documentation (COLOR_USAGE_GUIDE.md) |
| `funcional/` | Functional feature documentation in Portuguese (area-specific features: PLANNING, DEVELOPMENT, QUALITY, GOVERNANCE, meetings, MENU) |
| `governanca-informations/` | Governance reference materials in Portuguese (regulatory landscape, risk/security, governance frameworks, organizational impact, market trends) |
| `governance-templates/` | Governance policy templates in Portuguese (access policy, compliance, privacy, data protection, security, usage) |
| `integrations/` | Integration documentation (INDEX, dr-media-tools-integration) |
| `jira/` | JIRA integration documentation (jira-api-endpoints.md, jira-integration-setup.md) |
| `knowledge-base/` | Project knowledge base content (objetivos: strategic indicators, annual goals, mission/vision/values, OKRs, strategic priorities; processos: customer service, software development, incident management, onboarding; recursos-e-ferramentas) |
| `product/` | Product planning documentation in Portuguese (0-8: benefits summary, architecture, requirements, task elaboration, autonomous agents implementation, quality, maintenance, onboarding, knowledge management; area-specific usage-oriented features) |
| `rag/` | RAG system documentation (indexing-system-documentation, rag-content-type-column-proposal, rag-phase1-metadata-enhancement, task-indexing-migration, generate-embeddings) |

**Root-level docs:**
- `PROJECT_INDEX.md` -- Project documentation index
- `Features - 2026-03-23.md` -- Feature list
- `Product Backlog Items - 2026-03-23.md` -- Product backlog
- `TEST_COMMANDS.md` -- Test command reference
- `AI_Settings_Management.md` -- AI settings management
- `analysis-reports-formats.json` -- Analysis report format definitions
- `create-documents-curl.md` -- curl examples for document generation
- `openai-api-responses.ts` -- OpenAI Responses API documentation
- `payload-backlog.json` -- Backlog payload examples
- `backlog-normalized-record.md` -- Backlog normalized record format
- `feature-normalized-record.md` -- Feature normalized record format
- `centralized-document-types-plan.md` -- Document types centralization plan
- `TECHNICAL_PLAN_TEAM_PROJECT_DOCS.md` -- Technical planning document
- `api_ACCESSIBILITY.md` -- Accessibility API documentation

---

## Configuration Files

### package.json

**Path:** `package.json`

**Purpose:** NPM package manifest defining project metadata, scripts, and dependencies.

**Key scripts:**
- `npm run dev` -- Start development server on port 8080
- `npm run build` -- Production build
- `npm run build:dev` -- Development build with source maps
- `npm run lint` -- Run ESLint
- `npm run preview` -- Preview production build
- `npm run test` -- Unit tests via Vitest
- `npm run test:coverage` -- Test coverage report
- `npm run test:integration` -- Integration tests
- `npm run test:e2e` -- Playwright E2E tests
- `npm run test:e2e:ci` -- CI E2E tests with JSON/HTML/JUnit reporters
- `npm run test:accessibility` -- Accessibility E2E tests
- `npm run test:performance` -- Performance E2E tests
- `npm run test:visual` -- Visual regression tests
- `npm run test:all` -- Full test suite (unit + E2E)

### tsconfig.json

**Path:** `tsconfig.json`

**Purpose:** Root TypeScript configuration. Sets up path aliases (`@/*` maps to `./src/*`), progressive strict mode settings, and references `tsconfig.app.json` and `tsconfig.node.json`.

**Key settings:**
- `baseUrl: "."` with `paths: { "@/*": ["./src/*"] }` -- Path alias configuration
- `noImplicitAny: true` -- Catches untyped variables
- `strictNullChecks: true` -- Prevents null/undefined errors
- `noUnusedLocals: true` -- Enforces clean code
- `noUnusedParameters: true` -- Enforces clean parameter usage

### tsconfig.app.json

**Path:** `tsconfig.app.json`

**Purpose:** TypeScript configuration for the React application source code.

**Key settings:**
- `target: ES2020`, `lib: ["ES2020", "DOM", "DOM.Iterable"]` -- ES2020 with DOM types
- `module: ESNext` -- Modern ES modules
- `jsx: react-jsx` -- React JSX transform
- `moduleResolution: bundler` -- Bundler-style module resolution
- `strict: false` -- Kept false for gradual migration (while selective strict flags are enabled)

### tsconfig.node.json

**Path:** `tsconfig.node.json`

**Purpose:** TypeScript configuration for Node.js build tools (Vite, ESLint).

### vite.config.ts

**Path:** `vite.config.ts`

**Purpose:** Vite bundler configuration.

**Key features:**
- Server on host `::`, port `8080`
- `@` alias to `./src`
- Plugin stack: `wasm()`, `topLevelAwait()`, `react()` (SWC), and `componentTagger()` (dev mode only for bundle analysis)
- Manual chunk splitting: `react-vendor`, `ui-vendor` (Radix), `form-vendor` (react-hook-form), `query-vendor` (TanStack Query), `supabase-vendor`, `monaco-editor`, `shadcn-ui`
- Chunk size warning threshold: 1000 KB

### tailwind.config.ts

**Path:** `tailwind.config.ts`

**Purpose:** Tailwind CSS theme configuration.

**Key features:**
- Dark mode via `class` selector
- Content paths: `./pages/**`, `./components/**`, `./app/**`, `./src/**`
- CSS variable-based color system (primary, secondary, destructive, muted, accent, popover, card, sidebar)
- Area-specific color tokens: `planning` (gold), `development` (gray), `testing` (bronze), `governance` (green), `phase` (CSS variable)
- Custom keyframe animations: `accordion-down`, `accordion-up`
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography`

### postcss.config.js

**Path:** `postcss.config.js`

**Purpose:** PostCSS configuration. Registers Tailwind CSS and Autoprefixer plugins.

### eslint.config.js

**Path:** `eslint.config.js`

**Purpose:** ESLint flat-config configuration for TypeScript and React.

**Key rules:**
- Extends ESLint recommended + TypeScript-ESLint recommended
- React Hooks rules from `eslint-plugin-react-hooks`
- `react-refresh/only-export-components` as a warning
- `@typescript-eslint/no-unused-vars` disabled (handled by TypeScript)

### vitest.config.ts

**Path:** `vitest.config.ts`

**Purpose:** Vitest unit test configuration.

**Key features:**
- Environment: `jsdom`
- Setup file: `./src/tests/setup.ts`
- Coverage provider: `v8` with thresholds (branches 75%, functions/lines/statements 80%)
- Timeouts: test 30s, hook 30s, teardown 10s
- `@` alias to `./src`
- `process.env` mock for tests

### components.json

**Path:** `components.json`

**Purpose:** Shadcn/ui component registry. Defines where components are stored and how they are managed by the Shadcn CLI.

---

## Directory Purpose Summary

| Directory | Purpose |
|-----------|---------|
| `src/components/ui/` | Shadcn/ui base components -- reusable atomic UI building blocks |
| `src/components/projects/` | Project management components -- access control, collaboration, wizard |
| `src/contexts/` | React Context providers -- auth, project selection, team state |
| `src/hooks/` | Custom hooks -- TanStack Query wrappers for all feature data fetching |
| `src/lib/openai*.ts` | OpenAI integration -- document generation, conversation tracking |
| `src/lib/services/` | Service classes -- business logic and Supabase database operations |
| `src/lib/utils/` | Pure utility functions -- formatting, validation, date handling |
| `src/lib/rag/` | RAG implementation -- vector storage, embeddings, search, chat |
| `src/pages/` | Route page components -- full page layouts for each URL |
| `src/types/` | TypeScript type definitions -- data models, API types, config types |
| `src/locales/` | i18n translations -- Portuguese (pt-br) and English (en-us) |
| `supabase/functions/_shared/` | Edge Function shared utilities -- reusable across all functions |
| `supabase/functions/*/` | Edge Functions -- AI document generation, APIs, integrations |
| `docs/` | Project documentation -- architecture, features, APIs, governance, product |
', 'docs/02-folder-structure/structure.md'),
    ('general', 'Glossary of Key Terms', '---
name: glossary-terms
description: Key terms and definitions used throughout the Workforce project
area: 03
maintained_by: glossary-writer
created: 2026-03-30
updated: 2026-03-30
---

# Glossary of Key Terms

## AI Interactions (ai_interactions table)

A database table that tracks every call made to the OpenAI API, recording token usage, cost, model used, and the response ID returned by OpenAI. This table is populated automatically by Edge Functions during document generation. It serves as the system of record for monitoring AI consumption and billing. Each interaction is linked to a project via `project_id` and optionally to a user via `user_id`. The table enables cost analysis per project, per user, and per document type.

Related terms: response_id, OpenAI Responses API, Edge Functions, document generation (v2.0)

---

## Area Themes

A set of CSS custom property definitions that apply distinct visual styling to each of the four project phases: Planning, Development, Testing/Quality, and Governance. Each area has a primary color, accent color, and background tint. The themes are applied via the `data-area` attribute on DOM elements (e.g., `data-area="planning"`). This visual differentiation helps users quickly identify which phase they are working within.

| Area | Primary Color | Accent Color |
|------|--------------|--------------|
| Planning | Dark Gold (#B8860B) | Goldenrod (#DAA520) |
| Development | Gray (#9E9E9E) | Silver (#C0C0C0) |
| Testing/Quality | Bronze (#CD7F32) | Tan (#D4A574) |
| Governance | Dark Green (#1B4332) | Forest Green (#2D6A4F) |

Related terms: Project Context

---

## AuthContext

A React Context that encapsulates all authentication state and operations for the application. It provides the current user session, methods for signing in and out, and the loading state of the authentication process. AuthContext is built on top of Supabase Auth and is the primary mechanism through which any component accesses the authenticated user.

Related terms: React Context, Supabase (RLS, Auth, Storage), ProjectSelectionContext, TeamContext

---

## Conversation IDs

Identifier strings returned by the OpenAI Responses API that maintain continuity across multiple related API calls within a single document generation session. When generating multiple documents from the same transcript (e.g., a PRD and its associated User Stories), the `previous_response_id` from one call is passed as `previous_response_id` in the next, allowing the model to maintain context. This enables coherent multi-document generation workflows.

Related terms: response_id, OpenAI Responses API, Edge Functions, document generation (v2.0)

---

## Document Generation (v2.0)

The current architecture for generating AI-powered documents from meeting transcripts. In v2.0, all document generation flows through Supabase Edge Functions, which call the OpenAI API server-side. This replaces the deprecated v1.0 frontend-based approach where OpenAI was called directly from the React client. The v2.0 architecture provides centralized API key management, automatic token tracking, consistent error handling, and server-side model selection optimization.

Supported document types: PRD, User Stories, Meeting Notes, Technical Specs, Test Cases.

Related terms: Edge Functions, AI interactions (ai_interactions table), response_id, conversation IDs, OpenAI Responses API, generated_documents, meeting_transcript

---

## Edge Functions

Serverless functions hosted on Supabase that execute in a Deno runtime environment. In the Workforce project, Edge Functions handle all document generation requests. Each document type has its own function (e.g., `create-prd`, `create-user-story`), while shared logic resides in `/supabase/functions/_shared/document-generation/`. Edge Functions receive requests from the frontend via the `document-generation-service.ts` wrapper, call the OpenAI API, automatically record usage in the `ai_interactions` table, and return structured responses.

Related terms: document generation (v2.0), OpenAI Responses API, AI interactions (ai_interactions table), response_id

---

## generated_documents

A database table that stores the output of AI-generated documents. Each record contains the document content (in Markdown format), the document type, the associated project ID, and a reference to the source meeting transcript if applicable. Documents are versioned using the `is_current_version` flag, allowing historical versions to be preserved while marking the latest version.

Related terms: meeting_transcript, is_current_version flag, document generation (v2.0), Project Context

---

## Handlebars Templates

Template files used by Edge Functions to construct prompts sent to the OpenAI API for document generation. Handlebars syntax (e.g., `{{variable}}`, `{{#each items}}...{{/each}}`) allows dynamic insertion of transcript content and metadata into a structured prompt framework. Templates are stored in `src/prompts/document-templates/` and versioned via the `is_current_version` flag in the database, enabling template updates without code deployments.

Related terms: document generation (v2.0), is_current_version flag, OpenAI Responses API

---

## is_current_version Flag

A boolean field in the database that marks the active version of a document template. When a template is updated, the previous version''s flag is set to `false` and the new version''s flag is set to `true`. This versioning mechanism allows Edge Functions to always load the current template while preserving historical versions for audit or rollback purposes.

Related terms: Handlebars Templates, Edge Functions, document generation (v2.0)

---

## meeting_transcript

A database table that stores raw transcript data from recorded meetings. Each transcript record contains the full text content, metadata such as date and participants, and a reference to the project it belongs to. Meeting transcripts serve as the input source for document generation. Components like `DocumentGenerator.tsx` and `RelatedDocuments.tsx` read from this table to allow users to generate documents from past meetings.

Related terms: document generation (v2.0), generated_documents, Project Context

---

## OpenAI Responses API

The OpenAI API endpoint used by Edge Functions for document generation. Unlike the traditional chat completions endpoint, the Responses API is designed for multi-turn conversation continuity and returns a `response_id` that can be used in subsequent calls via the `previous_response_id` parameter. The API supports automatic token counting and is accessed server-side within Edge Functions, keeping API keys secure.

Related terms: response_id, conversation IDs, Edge Functions, document generation (v2.0), AI interactions (ai_interactions table)

---

## Project Context

The active project scope that filters all data within the application. Every query, mutation, and display in the Workforce app is constrained to the currently selected project. This isolation ensures that data from one project never leaks into another. The active project is accessed via the `selectedProject` object from the `useProjectSelection` hook. All Supabase queries must include an `.eq(''project_id'', selectedProject.id)` filter. The `selectedProject` object contains the full project record, including `id`, `name`, and other metadata.

Related terms: selectedProject, useProjectSelection hook, Supabase (RLS, Auth, Storage)

---

## React Context

A React pattern for sharing state across components without prop drilling. The Workforce project uses three primary contexts: `AuthContext` manages user authentication state, `ProjectSelectionContext` manages the currently active project, and `TeamContext` manages team member data. Contexts are consumed via custom hooks (e.g., `useProjectSelection()`) that provide a clean API surface to components while abstracting the underlying context implementation.

Related terms: AuthContext, ProjectSelectionContext, TeamContext, useProjectSelection hook

---

## response_id

A unique identifier string returned by the OpenAI Responses API with every API response. In the Workforce project, `response_id` is stored in the `ai_interactions` table for tracking and auditing purposes. It is also used as `previous_response_id` in subsequent API calls to maintain conversation continuity across multi-document generation sessions.

Related terms: OpenAI Responses API, conversation IDs, AI interactions (ai_interactions table), Edge Functions

---

## RLS (Row Level Security)

A Supabase feature that enforces data access rules at the database level. RLS policies define which rows a user can read, insert, update, or delete based on their authentication status and the contents of the row. In the Workforce project, RLS policies are configured per table to enforce Project Context isolation, ensuring users can only access data from projects they belong to. RLS is a critical security layer complementing application-level filtering.

Related terms: Supabase (RLS, Auth, Storage), Project Context, AuthContext

---

## selectedProject

The primary object representing the currently active project in the application. It is obtained by destructuring from the `useProjectSelection()` hook. The object contains the full project record, and the most critical property is `.id`, which must be used in all database queries to enforce Project Context isolation.

**CRITICAL**: Always access via `selectedProject?.id`. The property `selectedProjectId` does not exist on the object returned by `useProjectSelection()`. Using `selectedProjectId` will result in undefined behavior and silent data leakage or loss.

Correct usage:
```typescript
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;
// Use selectedProjectId in .eq(''project_id'', selectedProjectId)
```

Incorrect usage:
```typescript
// WRONG - selectedProjectId does not exist
const { selectedProjectId } = useProjectSelection();
```

Related terms: Project Context, useProjectSelection hook, Supabase (RLS, Auth, Storage)

---

## Sprint Velocity

A metric that measures the amount of work a team completes during a sprint, typically expressed in story points or task count. Velocity is calculated by summing the completed items in a sprint and is used to forecast future sprint capacity. In the Workforce project, sprint velocity is tracked in the `sprints` table alongside sprint dates and planned capacity, enabling teams to balance workload against historical performance.

Related terms: dev_tasks

---

## Supabase (RLS, Auth, Storage)

The backend-as-a-service platform that powers the Workforce project''s data layer. Supabase provides four integrated services used in this project: PostgreSQL (the database), Auth (user authentication), Storage (file uploads), and Edge Functions (serverless code execution). All database operations are performed through the Supabase JavaScript client, and security is enforced through a combination of RLS policies and application-level Project Context filtering.

Related terms: RLS (Row Level Security), AuthContext, Edge Functions, Project Context

---

## TanStack Query v5

A data fetching and caching library for React used throughout the Workforce project to manage server state. TanStack Query (formerly React Query) handles fetching, caching, synchronizing, and updating data from the Supabase backend. It replaces manual `useEffect` + `useState` patterns with a declarative API that includes automatic background refetching, stale-while-revalidate caching, and query invalidation. All components use TanStack Query hooks to fetch data from Supabase.

Related terms: React Context, Supabase (RLS, Auth, Storage)

---

## TeamContext

A React Context that manages team member data within the active project. It provides access to the list of team members, their roles, and methods for adding or updating members. TeamContext is scoped to the current project via `selectedProject?.id`, ensuring team data is isolated per project. It complements `AuthContext` and `ProjectSelectionContext` as one of the three primary state contexts in the application.

Related terms: React Context, AuthContext, ProjectSelectionContext, Project Context

---

## useProjectSelection Hook

A custom React hook that provides access to the currently selected project. It is the primary interface for reading the Project Context within any component. The hook returns an object containing `selectedProject` (the full project record) and `setSelectedProject` (a function to change the active project). It must not be destructured using `selectedProjectId` as that property does not exist on the returned object.

Correct usage:
```typescript
const { selectedProject } = useProjectSelection();
```

Related terms: Project Context, selectedProject, React Context, ProjectSelectionContext
', 'docs/03-glossary/terms.md'),
    ('general', 'Database Schema Reference', '---
name: database-schema
description: Complete database schema with tables, columns, relationships, RLS policies
area: 04
maintained_by: db-architect
created: 2026-03-30
updated: 2026-03-30
---

# Database Schema Reference

This document provides a comprehensive reference for the Workforce database schema. It covers all core tables, their columns, data types, relationships, and the Row-Level Security (RLS) policies that enforce project-based data isolation.

## Entity-Relationship Diagram

```
+---------------------------+       +---------------------------+       +---------------------------+
|   profiles                |       |   project_knowledge_base |       |   team_members            |
|---------------------------|       |---------------------------|       |---------------------------|
| id (PK) [uuid]            |<------| owner (FK profiles)       |       | id (PK) [uuid]            |
| email [text]              |       | id (PK) [uuid]            |------>| profile [text]            |
| full_name [text]          |       | name [text]                |       | status [text]             |
| avatar_url [text]        |       | description [text]        |       | name [text]               |
+---------------------------+       | category [text]           |       | email [text]              |
                                     | tags [text[]]             |       | headline [text]           |
                                     +---------------------------+       | bio [text]                 |
                                           |                         | professional_summary [text]|
                                           | 1:N                     | avatar_url [text]          |
                                           v                         +---------------------------+
+---------------------------+       +---------------------------+            | 1:N                |
|   sprints                 |       |   dev_tasks               |            v                |
|---------------------------|       |---------------------------|       +---------------------------+
| id (PK) [uuid]            |<------| project_id (FK pkb)       |       | project_team_members       |
| project_id (FK pkb)       |       | id (PK) [uuid]            |       |---------------------------|
| name [varchar]            |       | sprint_id (FK sprints)    |<------+ member_id (FK team_members)|
| status [sprint_status]   |       | assigned_to (FK team_memb)|       | project_id (FK pkb)        |
| start_date [date]        |       | parent_task_id (FK self)  |       | role [text]                |
| end_date [date]          |       | feature_id (FK features)   |       +---------------------------+
| velocity [numeric]        |       | status [task_status]      |       | team_member_skills          |
| planned_points [int]      |       | priority [task_priority]   |       | team_member_tools           |
| completed_points [int]   |       | title [text]               |       +---------------------------+
+---------------------------+       | description [text]        |
                                     | story_points [int]        |
                                     +---------------------------+
                                           |
                                           | 1:N
                                           v
+---------------------------+       +---------------------------+
|   meeting_transcripts     |       |   generated_documents     |
|---------------------------|       |---------------------------|
| id (PK) [uuid]            |<------| project_id (FK pkb)       |
| project_id (FK pkb)       |       | id (PK) [uuid]            |
| meeting_id (FK meetings)  |       | meeting_transcript_id(FK) |
| title [text]              |       | ai_interaction_id (FK)    |
| transcript_text [text]    |       | sprint_id (FK sprints)    |
| transcript_metadata[jsonb]|       | status [text]             |
| meeting_date [timestamp]  |       | document_type [text]      |
| tags [text[]]            |       | document_name [text]       |
| is_public [bool]          |       | content [text]            |
+---------------------------+       | version [int]             |
                                     | is_current_version [bool]  |
                                     | approved_by [uuid]        |
                                     | rejected_by [uuid]        |
                                     +---------------------------+
                                           |
                                           | N:1
                                           v
+---------------------------+
|   ai_interactions         |
|---------------------------|
| id (PK) [uuid]            |
| project_id (FK pkb)       |
| meeting_transcript_id(FK) |
| previous_interaction_id(FK)|
| interaction_type [text]  |
| status [text]             |
| request_prompt [text]     |
| response_text [text]      |
| request_model [text]      |
| cost_usd [numeric]        |
| token_usage [jsonb]       |
| duration_ms [int]         |
| quality_score [numeric]   |
| error_message [text]      |
| retry_count [int]         |
+---------------------------+
```

---

## 1. project_knowledge_base

The central table representing all projects in the system. All other core tables maintain a foreign key to this table, enabling strict project-based data isolation.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Project display name |
| description | text | NO | null | Project description |
| category | text | YES | null | Project category or type |
| owner | uuid | YES | null | FK to profiles.id -- project owner |
| context_data | jsonb | YES | ''{}''::jsonb | Flexible metadata storage |
| is_active | boolean | YES | true | Soft-delete flag |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |
| tags | text[] | YES | ''{}''::text[] | Project tags for filtering |
| git_repository_url | text | YES | null | Linked Git repository URL |
| jira_url | text | YES | null | Linked Jira instance URL |
| logo_url | text | YES | null | Project logo image URL |
| icon | text | YES | null | Project icon identifier |
| color | text | YES | null | Project color theme |
| leaders_managers | jsonb | YES | ''[]''::jsonb | Project leadership information |
| team_member_links | jsonb | YES | ''[]''::jsonb | Team member associations |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |

### Relationships

- **owner** -> `profiles.id` (N:1, optional)
- **Referenced by**: All other core tables as the primary project isolation anchor

### RLS Policies

RLS is enforced so that users can only access project records they have been granted access to via `user_project_access`.

```sql
-- Project visibility: user must have a record in user_project_access
CREATE POLICY project_isolation_select ON project_knowledge_base
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_project_access
      WHERE user_project_access.project_id = project_knowledge_base.id
      AND user_project_access.user_id = auth.uid()
      AND user_project_access.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `owner`
- Index on `is_active`
- Index on `deleted_at`

---

## 2. team_members

Represents individual team members within the system. Team members can be assigned to tasks and linked to projects through the `project_team_members` join table.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Full name of the team member |
| email | text | YES | null | Email address |
| profile | text | NO | ''fullstack''::text | Professional profile/specialization |
| status | text | NO | ''active''::text | Member status: active, inactive |
| headline | text | YES | null | Short professional headline |
| bio | text | YES | null | Biography or description |
| professional_summary | text | YES | null | Detailed professional summary |
| avatar_url | text | YES | null | Profile picture URL |
| slug | text | NO | null | URL-friendly identifier |
| member_type | character varying | YES | ''human''::character varying | human or bot/agent |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | NO | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- Referenced by `dev_tasks.assigned_to`
- Referenced by `project_team_members.member_id`
- Join table `team_member_skills` (N:1 via team_member_id)
- Join table `team_member_tools` (N:1 via team_member_id)

### RLS Policies

Team members are visible across projects but must belong to a project to be used within that project''s context.

```sql
-- Team members are globally visible but filtered by project context
CREATE POLICY team_members_project_filter ON team_members
  FOR SELECT USING (
    deleted_at IS NULL
  );
```

### Indexes

- Primary key on `id`
- Index on `email`
- Index on `status`
- Index on `slug` (unique)
- Index on `deleted_at`

---

## 3. dev_tasks

Represents individual tasks (also known as user stories, bugs, or features) within a project. Tasks can belong to sprints, be assigned to team members, and track time and progress.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| sprint_id | uuid | YES | null | FK to sprints.id -- sprint assignment |
| assigned_to | uuid | YES | null | FK to team_members.id -- assigned developer |
| parent_task_id | uuid | YES | null | FK to dev_tasks.id -- parent for subtasks |
| feature_id | uuid | YES | null | FK to features.id -- parent feature |
| status | task_status (enum) | NO | ''todo''::task_status | Current status |
| priority | task_priority (enum) | NO | ''medium''::task_priority | Task priority level |
| task_type | task_type (enum) | NO | ''feature''::task_type | Type: feature, bug, chore, spike |
| title | text | NO | null | Task title |
| description | text | YES | null | Detailed task description |
| story_points | integer | YES | 0 | Estimated story points |
| estimated_hours | integer | YES | 0 | Estimated hours |
| actual_hours | integer | YES | 0 | Actual hours spent |
| tags | text[] | YES | ''{}''::text[] | Task tags |
| dependencies | jsonb | YES | ''[]''::jsonb | Task dependency references |
| component_area | text | YES | null | Technical component or area |
| ai_metadata | jsonb | YES | ''{}''::jsonb | AI-generated metadata |
| generated_from_interaction_id | uuid | YES | null | FK to ai_interactions.id -- source AI interaction |
| jira_sync_enabled | boolean | YES | false | Whether Jira sync is enabled |
| jira_issue_key | text | YES | null | Jira issue key |
| jira_issue_id | text | YES | null | Jira issue numeric ID |
| jira_sync_status | text | YES | null | Last sync status |
| jira_last_synced_at | timestamp with time zone | YES | null | Last Jira sync timestamp |
| last_jira_sync | timestamp with time zone | YES | null | Alternate last sync timestamp |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `sprint_id` -> `sprints.id` (N:1, optional)
- `assigned_to` -> `team_members.id` (N:1, optional)
- `parent_task_id` -> `dev_tasks.id` (self-reference for subtasks)
- `feature_id` -> `features.id` (N:1, optional)
- `generated_from_interaction_id` -> `ai_interactions.id` (N:1, optional)
- Referenced by `task_comments.task_id`
- Referenced by `task_attachments.task_id`

### RLS Policies

Tasks are filtered by the current project context, enforced through the project_id column.

```sql
-- Tasks are isolated by project_id
CREATE POLICY tasks_project_isolation ON dev_tasks
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `sprint_id`
- Index on `assigned_to`
- Index on `status`
- Index on `priority`
- Index on `parent_task_id`
- Index on `deleted_at`
- Composite index on `(project_id, sprint_id)`
- Composite index on `(project_id, status)`

---

## 4. sprints

Represents time-boxed development iterations. Sprints belong to a project and track planned versus completed work through story points.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| name | character varying | NO | null | Sprint name |
| status | sprint_status (enum) | YES | ''planning''::sprint_status | Sprint status |
| start_date | date | NO | null | Sprint start date |
| end_date | date | NO | null | Sprint end date |
| goals | text[] | YES | ARRAY[]::text[] | Sprint goals |
| planned_points | integer | YES | null | Total planned story points |
| completed_points | integer | YES | null | Completed story points |
| velocity | numeric | YES | null | Calculated velocity (completed / duration) |
| description | text | YES | null | Sprint description |
| created_by | uuid | YES | null | FK to profiles.id -- sprint creator |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `created_by` -> `profiles.id` (N:1, optional)
- Referenced by `dev_tasks.sprint_id`
- Referenced by `generated_documents.sprint_id`
- Referenced by `meetings.sprint_id`
- Join table `feature_sprints` (many-to-many via features)

### RLS Policies

Sprints inherit project isolation from their project_id foreign key.

```sql
-- Sprints are isolated by project_id
CREATE POLICY sprints_project_isolation ON sprints
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `status`
- Index on `start_date`
- Index on `end_date`
- Index on `deleted_at`

---

## 5. meeting_transcripts

Stores transcribed content from meetings. Transcripts serve as input for AI-powered document generation (PRD, user stories, meeting notes, technical specs, test cases).

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | uuid_generate_v4() | Primary key |
| project_id | uuid | YES | null | FK to project_knowledge_base.id -- project isolation |
| meeting_id | uuid | YES | null | FK to meetings.id -- source meeting |
| title | text | NO | null | Transcript title |
| description | text | YES | null | Transcript description |
| transcript_text | text | NO | null | Full transcript content |
| transcript_metadata | jsonb | YES | ''{}''::jsonb | Metadata such as speaker segments, timestamps |
| meeting_date | timestamp with time zone | NO | now() | Date and time of the meeting |
| tags | text[] | YES | ''{}''::text[] | Tags for classification |
| is_public | boolean | YES | false | Whether transcript is publicly accessible |
| created_by | text | YES | null | Creator reference |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, optional -- project isolation)
- `meeting_id` -> `meetings.id` (N:1, optional)
- Referenced by `generated_documents.meeting_transcript_id`
- Referenced by `ai_interactions.meeting_transcript_id`
- Join table `feature_meetings` (many-to-many via features)

### RLS Policies

Transcripts are filtered by project_id, with optional public access override.

```sql
-- Transcripts are isolated by project_id or marked as public
CREATE POLICY transcripts_project_isolation ON meeting_transcripts
  FOR SELECT USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
    OR is_public = true
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_id`
- Index on `meeting_date`
- Index on `is_public`
- Index on `deleted_at`

---

## 6. generated_documents

Stores AI-generated documents such as PRDs, user stories, meeting notes, technical specs, and test cases. Documents are created from meeting transcripts via AI interactions.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| meeting_transcript_id | uuid | YES | null | FK to meeting_transcripts.id -- source transcript |
| ai_interaction_id | uuid | NO | null | FK to ai_interactions.id -- source AI interaction |
| sprint_id | uuid | YES | null | FK to sprints.id -- associated sprint |
| status | text | NO | ''draft''::text | Document status: draft, submitted, approved, rejected |
| document_type | text | YES | null | Type: prd, user-story, meeting-notes, technical-specs, test-cases |
| document_name | text | YES | null | Document display name |
| content | text | NO | null | Generated document content (Markdown) |
| raw_content | text | YES | null | Raw unprocessed content |
| content_format | text | YES | ''markdown''::text | Content format |
| version | integer | YES | 1 | Document version number |
| is_current_version | boolean | YES | true | Whether this is the current version |
| replaced_by | uuid | YES | null | FK to generated_documents.id -- replacement document |
| word_count | integer | YES | null | Word count of document content |
| section_count | integer | YES | null | Number of sections in the document |
| estimated_reading_time | integer | YES | null | Estimated reading time in minutes |
| quality_score | numeric | YES | null | AI-assessed quality score |
| quality_issues | text[] | YES | ''{}''::text[] | List of identified quality issues |
| validation_results | jsonb | YES | ''{}''::jsonb | Document validation results |
| company_knowledge_ids | jsonb | YES | ''[]''::jsonb | Referenced company knowledge base entries |
| submitted_by | uuid | YES | null | User who submitted for approval |
| submitted_for_approval_at | timestamp with time zone | YES | null | Submission timestamp |
| approved_by | uuid | YES | null | User who approved the document |
| approved_at | timestamp with time zone | YES | null | Approval timestamp |
| approval_notes | text | YES | null | Approval notes |
| rejected_by | uuid | YES | null | User who rejected the document |
| rejected_at | timestamp with time zone | YES | null | Rejection timestamp |
| rejection_reason | text | YES | null | Reason for rejection |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional)
- `ai_interaction_id` -> `ai_interactions.id` (N:1, mandatory)
- `sprint_id` -> `sprints.id` (N:1, optional)
- `replaced_by` -> `generated_documents.id` (self-reference)
- Referenced by `feature_documents.document_id`

### RLS Policies

Documents are isolated by project_id and follow a workflow approval process.

```sql
-- Documents are isolated by project_id
CREATE POLICY documents_project_isolation ON generated_documents
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_transcript_id`
- Index on `ai_interaction_id`
- Index on `sprint_id`
- Index on `status`
- Index on `document_type`
- Index on `is_current_version`
- Index on `deleted_at`
- Composite index on `(project_id, document_type)`

---

## 7. ai_interactions

Tracks all AI interactions for token usage monitoring, cost tracking, and conversation continuity. Interactions are the building blocks for document generation and task creation.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| project_id | uuid | NO | null | FK to project_knowledge_base.id -- project isolation |
| meeting_transcript_id | uuid | YES | null | FK to meeting_transcripts.id -- input source |
| previous_interaction_id | uuid | YES | null | FK to ai_interactions.id -- conversation chain |
| interaction_type | text | NO | null | Type: document-generation, task-creation, analysis |
| status | text | NO | ''pending''::text | Status: pending, in-progress, completed, failed |
| sequence_order | integer | NO | 1 | Order within a conversation sequence |
| request_prompt | text | YES | null | Original user prompt |
| response_text | text | YES | null | AI-generated response text |
| request_model | text | YES | null | OpenAI model used for request |
| cost_usd | numeric | YES | 0.00 | Calculated cost in USD |
| token_usage | jsonb | YES | ''{}''::jsonb | Token usage breakdown (prompt, completion, total) |
| duration_ms | integer | YES | null | Interaction duration in milliseconds |
| quality_score | numeric | YES | null | Quality assessment score |
| quality_metrics | jsonb | YES | ''{}''::jsonb | Detailed quality metrics |
| quality_issues | text[] | YES | ''{}''::text[] | Identified quality issues |
| request_data | jsonb | YES | null | Full request payload |
| response_data | jsonb | YES | null | Full response payload |
| request_parameters | jsonb | YES | ''{}''::jsonb | Request parameters (temperature, max_tokens, etc.) |
| response_metadata | jsonb | YES | ''{}''::jsonb | Response metadata from OpenAI |
| openai_conversation_id | text | YES | null | OpenAI conversation ID for continuity |
| error_message | text | YES | null | Error message if interaction failed |
| error_details | jsonb | YES | null | Detailed error information |
| retry_count | integer | YES | 0 | Number of retry attempts |
| started_at | timestamp with time zone | YES | null | When the interaction started |
| completed_at | timestamp with time zone | YES | null | When the interaction completed |
| created_at | timestamp with time zone | YES | now() | Creation timestamp |
| updated_at | timestamp with time zone | YES | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Relationships

- `project_id` -> `project_knowledge_base.id` (N:1, mandatory -- project isolation)
- `meeting_transcript_id` -> `meeting_transcripts.id` (N:1, optional)
- `previous_interaction_id` -> `ai_interactions.id` (self-reference for conversation chains)
- Referenced by `generated_documents.ai_interaction_id`
- Referenced by `dev_tasks.generated_from_interaction_id`
- Referenced by `audit_trail.ai_interaction_id`
- Referenced by `external_service_calls.ai_interaction_id`

### RLS Policies

Interactions are isolated by project_id and track costs per project.

```sql
-- AI interactions are isolated by project_id
CREATE POLICY ai_interactions_project_isolation ON ai_interactions
  FOR ALL USING (
    project_id IN (
      SELECT upa.project_id FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
      AND upa.deleted_at IS NULL
    )
  );
```

### Indexes

- Primary key on `id`
- Index on `project_id`
- Index on `meeting_transcript_id`
- Index on `previous_interaction_id`
- Index on `interaction_type`
- Index on `status`
- Index on `openai_conversation_id`
- Index on `created_at`
- Index on `deleted_at`
- Composite index on `(project_id, created_at)`

---

## Project ID Isolation Pattern

The project_id foreign key is the cornerstone of data isolation in the Workforce database. Every table that contains project-scoped data includes a `project_id` column referencing `project_knowledge_base.id`.

### Enforcement Rules

1. **Mandatory for scoped tables**: Tables like `dev_tasks`, `sprints`, and `generated_documents` require `project_id` to be non-null.
2. **Optional for cross-project tables**: Tables like `meeting_transcripts` and `team_members` allow null project_id for broader applicability.
3. **RLS enforcement**: Row-Level Security policies always check that the user''s `user_project_access` record includes the target project_id.
4. **API layer enforcement**: The `useProjectSelection()` hook exposes `selectedProject?.id`, which must be included as `.eq(''project_id'', selectedProjectId)` in all Supabase queries.

### Query Pattern

```typescript
// CORRECT: Always filter by project_id
const { selectedProject } = useProjectSelection();
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .order(''created_at'', { ascending: false });

// INCORRECT: Never query without project context
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .order(''created_at'', { ascending: false }); // Missing project filter
```

---

## Enum Types

The schema uses three user-defined enum types:

| Enum | Values | Used By |
|------|--------|---------|
| task_status | todo, in_progress, done, blocked | dev_tasks.status |
| task_priority | low, medium, high, critical | dev_tasks.priority |
| task_type | feature, bug, chore, spike | dev_tasks.task_type |
| sprint_status | planning, active, completed, cancelled | sprints.status |
| feature_status | draft, planned, in_progress, delivered, archived | features.status |

---

## Supporting Tables

### project_team_members

Join table linking team members to projects with role information.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | bigint | NO | Primary key |
| project_id | uuid | NO | FK to project_knowledge_base.id |
| member_id | uuid | NO | FK to team_members.id |
| role | text | YES | Member''s role within the project |
| joined_at | timestamp with time zone | NO | When member joined the project |
| created_at | timestamp with time zone | NO | Creation timestamp |
| updated_at | timestamp with time zone | NO | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

### task_comments

Discussion threads attached to tasks.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | uuid | NO | Primary key |
| task_id | uuid | NO | FK to dev_tasks.id |
| project_id | uuid | NO | FK to project_knowledge_base.id (isolation) |
| author_id | uuid | NO | FK to team_members.id |
| content | text | NO | Comment content |
| mentioned_members | jsonb | YES | Array of mentioned team member IDs |
| created_at | timestamp with time zone | YES | Creation timestamp |
| updated_at | timestamp with time zone | YES | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

### user_project_access

Controls which users can access which projects.

| Column | Type | Nullable | Purpose |
|--------|------|----------|---------|
| id | bigint | NO | Primary key |
| user_id | uuid | NO | FK to profiles.id |
| project_id | uuid | NO | FK to project_knowledge_base.id |
| created_by | uuid | YES | FK to profiles.id -- who granted access |
| created_at | timestamp with time zone | NO | Grant timestamp |
| updated_at | timestamp with time zone | NO | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | Soft-delete timestamp |

---

## Index Strategy Summary

| Table | Primary Index | Key Composite Indexes | Foreign Key Indexes |
|-------|--------------|-----------------------|---------------------|
| project_knowledge_base | id | (owner) | - |
| team_members | id | (email), (slug) unique | - |
| dev_tasks | id | (project_id, sprint_id), (project_id, status) | project_id, sprint_id, assigned_to, parent_task_id |
| sprints | id | (project_id, status) | project_id |
| meeting_transcripts | id | (project_id, meeting_date) | project_id, meeting_id |
| generated_documents | id | (project_id, document_type) | project_id, meeting_transcript_id, ai_interaction_id, sprint_id |
| ai_interactions | id | (project_id, created_at) | project_id, meeting_transcript_id, previous_interaction_id |
| project_team_members | id | (project_id), (member_id) | project_id, member_id |
| task_comments | id | (task_id), (project_id) | task_id, project_id, author_id |
| user_project_access | id | (user_id), (project_id) | user_id, project_id |

---

## Design Principles

1. **Project isolation first**: Every query must include project context through project_id filtering, enforced at both the RLS and application layers.
2. **Soft deletes everywhere**: All tables include a `deleted_at` column for soft delete, never hard deletes.
3. **Audit capability**: The `audit_trail` table records all state changes across the system.
4. **AI cost tracking**: `ai_interactions` tracks every AI call with token usage and cost for project-level budgeting.
5. **Versioning for documents**: `generated_documents` supports version history through `version`, `is_current_version`, and `replaced_by` columns.
6. **Jira bidirectional sync**: `dev_tasks` supports optional Jira synchronization with local tracking of sync state.
7. **Flexible metadata**: JSONB columns (context_data, ai_metadata, transcript_metadata) allow structured but schema-less data storage.', 'docs/04-database-schema/schema.md'),
    ('general', 'Project Context System', '---
name: project-context-system
description: Project isolation, selectedProject pattern, context system - CRITICAL correct usage
area: 06
maintained_by: context-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Project Context System

## Overview

The Project Context System is the foundation of data isolation in this application. Every piece of data -- tasks, sprints, documents, meetings, transcripts, etc. -- is scoped to a specific project. All queries to the database must include a `project_id` filter, and the `useProjectSelection()` hook is the single source of truth for determining which project is currently active.

The system consists of two React contexts that flow top-down: `AuthContext` provides the authenticated user, and `ProjectSelectionContext` provides the currently selected project and project mode. No component should ever hardcode a project ID or assume a project is selected without checking.

---

## The Hook: `useProjectSelection()`

**File:** `src/hooks/useProjectSelection.ts` (exported also from `src/contexts/ProjectSelectionContext.tsx`)

**CRITICAL:** The hook returns an object with a `selectedProject` property of type `Project | null`. It does NOT return a property named `selectedProjectId`.

```typescript
// Interface as defined in src/hooks/useProjectSelection.ts
export interface UseProjectSelectionReturn {
  selectedProject: Project | null;   // <-- The full Project object, NOT selectedProjectId
  isProjectMode: boolean;
  isLoading: boolean;
  projectHistory: Project[];
  selectProject: (project: Project) => void;
  clearProject: () => void;
  toggleProjectMode: () => void;
  enableProjectMode: () => void;
  disableProjectMode: () => void;
  isProjectSelected: boolean;
  canAccessProjectRoutes: boolean;
  navigateToProject: (projectId: string) => void;
  navigateToDashboard: () => void;
  switchProject: (project: Project) => void;
  getRecentProjects: (limit?: number) => Project[];
}
```

The `Project` type (defined in `src/types/project-selection.ts`) includes:

```typescript
export interface Project {
  id: string;
  name: string;
  title?: string;
  description?: string;
  status?: string;
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  team_id?: number;
  overall_quality_score?: number;
  total_cost?: number;
  total_tokens?: number;
  total_interactions?: number;
  collaborators_count?: number;
  completed_documents?: string[];
  failed_documents?: string[];
  tags?: string[];
  is_public?: boolean;
  sprints_count?: number;
  tasks_count?: number;
  incomplete_tasks_count?: number;
  meetings_count?: number;
  // Branding fields
  icon?: string;
  color?: string;
  logo_url?: string;
}
```

---

## Context Hierarchy

The context providers are stacked in the application root. Understanding the order matters because `ProjectSelectionContext` depends on having an authenticated user in order to validate project access.

```
App
  AuthProvider              --> provides user: User | null
    ProjectSelectionProvider --> provides selectedProject: Project | null, isProjectMode, etc.
      [application routes and components]
```

### AuthContext

**File:** `src/contexts/AuthContext.tsx`

Provides authentication state. All other contexts depend on the user being authenticated.

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (newPassword: string) => Promise<void>;
  isAuthenticated: boolean;
}
```

Usage:

```typescript
import { useAuth } from ''@/contexts/AuthContext'';

const { user, isAuthenticated, signOut } = useAuth();
```

### ProjectSelectionContext

**File:** `src/contexts/ProjectSelectionContext.tsx`

Provides project selection state and project-mode behavior. The context:

1. Persists the selected project in `localStorage` under the key `dr-ai-selected-project`
2. Persists project mode state in `localStorage` under `dr-ai-project-mode`
3. Maintains a project history (up to 5 recent projects) in `localStorage` under `dr-ai-project-history`
4. Validates user access to a project before setting it (non-admin users are checked against `user_project_access`)
5. Redirects to `/project-selector` when navigating to protected routes without a project selected in project mode

**Important:** The context exports both `useProjectSelection` (from the hook file) and `useProjectSelectionContext` (from the context file). Both return the same interface. The hook file version adds navigation helpers (`navigateToProject`, `navigateToDashboard`, `switchProject`). Always prefer importing from `src/hooks/useProjectSelection.ts`.

---

## WRONG vs RIGHT: The `selectedProjectId` Mistake

This is the most common and most critical error in the codebase. The destructuring pattern `const { selectedProjectId } = useProjectSelection()` does NOT work. There is no `selectedProjectId` property on the returned object. This produces a variable that is always `undefined`, silently breaking every query and mutation in the component.

### WRONG Pattern

```typescript
// WRONG - selectedProjectId does NOT exist on the returned object
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function MyComponent() {
  const { selectedProjectId } = useProjectSelection(); // ALWAYS undefined

  // Every query using selectedProjectId will fail silently
  const { data } = useQuery({
    queryKey: [''tasks'', selectedProjectId],
    queryFn: () => supabase.from(''dev_tasks'').select(''*'').eq(''project_id'', selectedProjectId),
    // selectedProjectId is undefined, so .eq(''project_id'', undefined) matches nothing
  });

  return <div>{selectedProjectId}</div>; // renders: undefined
}
```

The same applies to any variation of this mistake:

```typescript
// WRONG - all of these create undefined variables
const { selectedProjectId } = useProjectSelection();
const { projectId } = useProjectSelection();
const { id } = useProjectSelection();
```

When `selectedProjectId` is `undefined`, every Supabase query that uses it in a filter becomes:

```typescript
// What actually happens:
supabase.from(''tasks'').select(''*'').eq(''project_id'', undefined)
// Translates to: WHERE project_id = NULL  (not WHERE project_id = ''some-uuid'')
// Returns zero rows instead of the project''s data
```

### RIGHT Pattern

```typescript
// RIGHT - destructure selectedProject, then access .id
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function MyComponent() {
  const { selectedProject } = useProjectSelection();

  // Always check if a project is selected before using the id
  const { data } = useQuery({
    queryKey: [''tasks'', selectedProject?.id],
    queryFn: () => supabase
      .from(''dev_tasks'')
      .select(''*'')
      .eq(''project_id'', selectedProject?.id),
    // selectedProject?.id is safe - returns undefined if no project selected
    // Supabase handles undefined by omitting the filter, but you should guard below
    enabled: !!selectedProject, // <-- ALWAYS gate queries on project existence
  });

  return <div>{selectedProject?.name ?? ''No project selected''}</div>;
}
```

---

## Correct Usage Patterns

### Pattern 1: Accessing the project ID for queries

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function TasksPage() {
  const { selectedProject } = useProjectSelection();

  // Guard: render a message if no project is selected
  if (!selectedProject) {
    return <Alert>Please select a project to view tasks.</Alert>;
  }

  // Now use selectedProject.id safely
  const { data: tasks } = useQuery({
    queryKey: [''tasks'', selectedProject.id],
    queryFn: () => supabase
      .from(''dev_tasks'')
      .select(''*'')
      .eq(''project_id'', selectedProject.id)  // <-- correct
      .order(''created_at'', { ascending: false }),
    enabled: !!selectedProject.id,
  });

  return <TaskList tasks={tasks} />;
}
```

### Pattern 2: Creating a local `selectedProjectId` variable (derived, not destructured)

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function DocumentPage() {
  const { selectedProject } = useProjectSelection();

  // Derive selectedProjectId from the full object - this is safe
  const selectedProjectId = selectedProject?.id;

  const { data: documents } = useDocuments(selectedProjectId);

  return <DocumentList documents={documents} />;
}
```

This works because you first destructured `selectedProject` correctly, then derived `selectedProjectId` from it. The mistake is in the initial destructuring, not in having a `selectedProjectId` variable.

### Pattern 3: Passing the project ID to child components

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';
import TranscriptionsList from ''@/components/transcriptions/TranscriptionsList'';

function TranscriptionsPage() {
  const { selectedProject } = useProjectSelection();

  if (!selectedProject) {
    return <NoProjectAlert />;
  }

  // Pass the id explicitly to components that expect it as a prop
  return <TranscriptionsList selectedProjectId={selectedProject.id} />;
}
```

Note: Some components in the codebase expect a `selectedProjectId` prop directly. This is fine -- you are responsible for correctly deriving that value before passing it.

### Pattern 4: Combining with TanStack Query

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';
import { useQuery } from ''@tanstack/react-query'';
import { supabase } from ''@/integrations/supabase/client'';

function SprintAnalytics() {
  const { selectedProject } = useProjectSelection();

  const { data: sprints, isLoading } = useQuery({
    queryKey: [''sprints'', selectedProject?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(''sprints'')
        .select(''*'')
        .eq(''project_id'', selectedProject?.id)
        .order(''created_at'', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!selectedProject?.id,  // Query will not run until a project is selected
  });

  return <SprintList sprints={sprints} isLoading={isLoading} />;
}
```

### Pattern 5: Navigation helpers

```typescript
import { useProjectSelection } from ''@/hooks/useProjectSelection'';

function ProjectHeader() {
  const { selectedProject, navigateToDashboard, navigateToProject } = useProjectSelection();

  return (
    <div>
      <h1>{selectedProject?.name}</h1>
      <button onClick={() => navigateToDashboard()}>Go to Dashboard</button>
      <button onClick={() => navigateToProject(selectedProject.id)}>Project Home</button>
    </div>
  );
}
```

---

## Project Isolation Architecture

All database tables are scoped by `project_id`. The application enforces this isolation at two levels:

### 1. Application-level enforcement

The `ProjectSelectionContext` validates that the current user has access to the selected project before setting it. This happens in `setSelectedProject`:

```typescript
// src/contexts/ProjectSelectionContext.tsx, setSelectedProject function
const setSelectedProject = async (project: Project | null) => {
  if (project) {
    const { data: { user } } = await supabase.auth.getUser();
    const userIsAdmin = isAdminUser(user.id);

    if (!userIsAdmin) {
      const hasAccess = await checkUserHasAccess(user.id, project.id);
      if (!hasAccess) {
        toast.error("You don''t have access to this project");
        navigate(''/project-selector'');
        return;
      }
    }
    // Access granted, set project
    setSelectedProjectState(project);
  }
};
```

### 2. Query-level enforcement

Every Supabase query must include a `project_id` filter:

```typescript
// Every query follows this pattern
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject.id);  // <-- REQUIRED on every query
```

Core tables that require project isolation:

| Table | Query filter |
|---|---|
| `dev_tasks` | `.eq(''project_id'', selectedProject.id)` |
| `sprints` | `.eq(''project_id'', selectedProject.id)` |
| `meeting_transcripts` | `.eq(''project_id'', selectedProject.id)` |
| `generated_documents` | `.eq(''project_id'', selectedProject.id)` |
| `ai_interactions` | `.eq(''project_id'', selectedProject.id)` |
| `features` | `.eq(''project_id'', selectedProject.id)` |
| `backlog_items` | `.eq(''project_id'', selectedProject.id)` |

### Route protection

In project mode, the `ProjectSelectionProvider` useEffect intercepts navigation to protected routes and redirects to `/project-selector` if no project is selected:

```typescript
// src/contexts/ProjectSelectionContext.tsx, checkRouteAccess effect
const protectedRoutes = [''/'', ''/dashboard'', ''/tasks'', ''/sprints'', ''/code'', ''/qa'', ''/metrics'', ''/meetings'', ''/documents''];

if (isProtectedRoute && !selectedProject) {
  navigate(''/project-selector'');
  return;
}
```

---

## Common Mistakes Reference

| Mistake | Why it fails | Correct approach |
|---|---|---|
| `const { selectedProjectId } = useProjectSelection()` | Property does not exist; value is always `undefined` | `const { selectedProject } = useProjectSelection()` then use `selectedProject?.id` |
| `const { id } = useProjectSelection()` | No `id` property on the returned object | `const { selectedProject } = useProjectSelection()` then `selectedProject?.id` |
| `.eq(''project_id'', selectedProject?.id)` without a guard | Query runs with `undefined` filter, returns zero rows | Always use `enabled: !!selectedProject?.id` with TanStack Query, or check `if (!selectedProject)` first |
| `const selectedProjectId = selectedProject?.id` without checking | The variable will be `undefined`, causing the same query problem | Always guard with a `if (!selectedProject)` check before using the derived ID |
| Hardcoding a project ID | Breaks multi-project isolation; accesses wrong project data | Always derive from `selectedProject.id` |
| Using `useProjectSelectionContext` instead of the hook | Both work, but the hook adds navigation helpers | Prefer `import { useProjectSelection } from ''@/hooks/useProjectSelection''` |

---

## Project Mode vs Non-Project Mode

The application supports two navigation modes:

- **Project Mode** (`isProjectMode = true`): All data is scoped to the selected project. Protected routes redirect to `/project-selector` if no project is selected. This is the default behavior.
- **Non-Project Mode** (`isProjectMode = false`): The application behaves like a traditional single-workspace application. All queries omit the `project_id` filter.

Use the provided helpers to manage mode switching:

```typescript
const { isProjectMode, enableProjectMode, disableProjectMode, toggleProjectMode } = useProjectSelection();

// Enable project mode (will redirect to /project-selector if no project is selected)
enableProjectMode();

// Disable project mode (will navigate to ''/'')
disableProjectMode();

// Toggle between modes
toggleProjectMode();
```

---

## Summary

1. Always use `const { selectedProject } = useProjectSelection()` -- never destructure `selectedProjectId` directly.
2. Access the project ID as `selectedProject?.id`.
3. Guard all queries: either check `if (!selectedProject)` before using the ID, or use `enabled: !!selectedProject?.id` in TanStack Query.
4. Every database query must include a `.eq(''project_id'', selectedProject.id)` filter.
5. The context hierarchy flows from `AuthContext` (user) to `ProjectSelectionContext` (project). Both must be available for the system to function correctly.
', 'docs/06-project-context/context-system.md'),
    ('general', 'State Management Patterns', '---
name: state-management-patterns
description: TanStack Query v5, React Context, and local state patterns
area: 7
maintained_by: state-specialist
created: 2026-03-30
updated: 2026-03-30
---

# State Management Patterns

This document describes the state management architecture for the RAG Workforce application, covering TanStack Query v5 for server state, React Context for global application state, and `useState` for local UI state.

## Overview

The application follows a clear separation between three categories of state:

| Category | Tool | Scope | Persistence |
|----------|------|-------|-------------|
| Server State | TanStack Query v5 | Fetched from Supabase | Cached in query client |
| Global App State | React Context | Application-wide | localStorage for some contexts |
| UI State | useState | Component-local | Memory only |

## TanStack Query v5 Patterns

TanStack Query (formerly React Query) is the primary tool for managing all server state, including data fetching, caching, synchronization, and mutations.

### Basic Query Pattern

Hooks wrap `useQuery` with typed return interfaces for consistency. The project convention is to define a return type interface and return normalized data:

```typescript
// src/hooks/useMeetings.ts
export interface UseMeetingsReturn {
  meetings: MeetingWithDetails[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  isRefetching: boolean;
  isSuccess: boolean;
}

export function useMeetings(
  projectId?: string,
  filters?: MeetingFilters,
  enabled: boolean = true
): UseMeetingsReturn {
  const query = useQuery({
    queryKey: [''meetings'', projectId, filters],
    queryFn: async () => {
      const { meetingService } = await import(''@/lib/services/meeting-service'');
      const result = await meetingService.fetchMeetingsListView(projectId, filters, { page: 1, limit: 500 });
      return result.data;
    },
    enabled: enabled && !!projectId,
    staleTime: 30000,       // 30 seconds
    gcTime: 300000,         // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    meetings: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    isRefetching: query.isRefetching,
    isSuccess: query.isSuccess,
  };
}
```

### Query Key Patterns

Query keys are always array-based, with parameters listed from most to least specific. The project does not use a centralized queryKeyFactory; keys are defined inline in each hook.

**Project-scoped queries** always include `projectId` as the second element:

```typescript
// Entity list queries with project context
queryKey: [''meetings'', projectId, filters]
queryKey: [''backlog'', projectId, filters, viewOptions, showAllStatuses]
queryKey: [''tasks'', projectId, filters]

// Statistics queries (separate from list to allow independent invalidation)
queryKey: [''backlog-statistics'', projectId]
queryKey: [''backlog-statistics-extended'', projectId]
queryKey: [''backlog-matrix-items'', projectId]

// Document-specific queries
queryKey: [''project-documents'', selectedProject?.id, filters, includeContent]
queryKey: [''document-content'', documentId, documentSource]
queryKey: [''document-stats'', selectedProject?.id]
queryKey: [''task-documents'', selectedProject?.id, filters]

// Count queries (for pagination)
queryKey: [''project-wide-documents-count'', selectedProject?.id, filters]
queryKey: [''sprint-documents-count'', selectedProject?.id, filters]
```

**Key principles:**
- Always include `projectId` as the second element when data is project-scoped
- Include all filter parameters in the key for proper cache segmentation
- Group related queries with a common prefix (e.g., `backlog`, `document`)
- Use separate keys for statistics and counts to allow independent invalidation
- Never hardcode project IDs in query keys

### Mutation Patterns

Mutations use `useMutation` with `onSuccess` and `onError` callbacks for cache invalidation and user feedback via toast:

```typescript
// src/hooks/useBacklog.ts
const createItemMutation = useMutation({
  mutationFn: async (data: BacklogItemFormData) => {
    // Get max position for ordering
    const { data: maxPosData } = await supabase
      .from(''backlog_items'')
      .select(''position'')
      .eq(''project_id'', projectId)
      .order(''position'', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = maxPosData ? maxPosData.position + 1 : 0;

    const { data: newItem, error } = await supabase
      .from(''backlog_items'')
      .insert({ ...data, project_id: projectId, position: newPosition })
      .select()
      .single();

    if (error) throw error;
    return newItem;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: [''backlog'', projectId] });
    queryClient.invalidateQueries({ queryKey: [''backlog-statistics'', projectId] });
    queryClient.invalidateQueries({ queryKey: [''backlog-statistics-extended'', projectId] });
    queryClient.invalidateQueries({ queryKey: [''backlog-matrix-items'', projectId] });
    toast.success(''Backlog item created successfully'');
  },
  onError: (error) => {
    console.error(''Failed to create backlog item:'', error);
    toast.error(''Failed to create backlog item'');
  }
});
```

### Optimistic Updates with Rollback

For operations where immediate UI feedback is important (reordering, drag-and-drop), use optimistic updates with rollback on failure:

```typescript
const reorderItemsMutation = useMutation({
  mutationFn: async (updates: BacklogPositionUpdate[]) => {
    const results = await Promise.all(
      updates.map(update =>
        supabase
          .from(''backlog_items'')
          .update({ position: update.position, status: update.status, updated_at: new Date().toISOString() })
          .eq(''id'', update.id)
      )
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw new Error(''Failed to reorder some items'');
  },
  onMutate: async (updates) => {
    // Cancel outgoing queries to prevent race conditions
    await queryClient.cancelQueries({ queryKey: [''backlog'', projectId] });

    // Snapshot current state for rollback
    const previousItems = queryClient.getQueryData([''backlog'', projectId, filters, viewOptions, showAllStatuses]);

    // Optimistic update - apply changes immediately
    queryClient.setQueryData([''backlog'', projectId, filters, viewOptions, showAllStatuses], (old: BacklogItem[] = []) => {
      const newItems = [...old];
      updates.forEach(update => {
        const index = newItems.findIndex(item => item.id === update.id);
        if (index !== -1) {
          newItems[index] = {
            ...newItems[index],
            position: update.position,
            ...(update.status && { status: update.status })
          };
        }
      });
      return newItems.sort((a, b) => a.position - b.position);
    });

    return { previousItems };
  },
  onError: (error, variables, context) => {
    // Rollback on error
    if (context?.previousItems) {
      queryClient.setQueryData([''backlog'', projectId, filters, viewOptions, showAllStatuses], context.previousItems);
    }
    toast.error(''Failed to reorder items'');
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: [''backlog'', projectId] });
  }
});
```

### Cache Invalidation Strategy

Invalidate all related queries after mutations to keep data consistent. Group invalidations by entity:

```typescript
// After document deletion - invalidate all related document queries
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: [''project-documents''] });
  queryClient.invalidateQueries({ queryKey: [''project-wide-documents''] });
  queryClient.invalidateQueries({ queryKey: [''sprint-documents''] });
  queryClient.invalidateQueries({ queryKey: [''task-documents''] });
  queryClient.invalidateQueries({ queryKey: [''document-stats''] });
  queryClient.invalidateQueries({ queryKey: [''project-wide-documents-count''] });
  queryClient.invalidateQueries({ queryKey: [''sprint-documents-count''] });
  queryClient.invalidateQueries({ queryKey: [''task-documents-count''] });
}
```

### Stale Time Configuration

Configure `staleTime` based on data volatility:

| Data Type | staleTime | gcTime | Rationale |
|-----------|-----------|--------|-----------|
| User activity (meetings, tasks) | 30s | 5min | Changes frequently, refetch on focus |
| Documents (list) | 2min | 10min | Changes infrequently |
| Document content | 5min | 30min | Large payloads, rarely changes |
| Extended statistics (database views) | 5min | 10min | Computed views, expensive to refresh |
| Matrix items | 2min | 10min | Derived data |

### The `enabled` Flag

Use the `enabled` parameter to conditionally run queries. The most common pattern is gating on project selection:

```typescript
// Only run when project is selected
enabled: !!selectedProject?.id

// Combine with other conditions
enabled: enabled && !!projectId

// Explicit enable/disable
enabled: !!epicId && !!projectId
```

When `enabled` is `false`, the query does not fire and returns `{ data: undefined, isLoading: false, isFetching: false }`.

## React Context Patterns

React Context is used for truly global state that does not belong in TanStack Query: authentication, active project, active team, and current area detection.

### When to Use Each Context

| Context | Use Case | Persisted to localStorage |
|---------|----------|--------------------------|
| AuthContext | User session, sign-in/sign-out | No (Supabase handles session) |
| ProjectSelectionContext | Active project, project mode, navigation guards | Yes |
| TeamContext | Active team, team list, team selector UI | Yes |
| AreaContext | Current area detection, area-aware navigation | Yes |

### AuthContext

Manages authentication state and Supabase session. Does not manually persist; relies on Supabase''s built-in session management.

**File:** `src/contexts/AuthContext.tsx`

```typescript
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check active session on mount
    supabaseAuth.getSession().then((session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabaseAuth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (_event === ''SIGNED_OUT'') {
        navigate(''/login'');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const signIn = async (email: string, password: string) => { /* ... */ };
  const signOut = async () => { /* ... */ };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn,
      signOut,
      forgotPassword,
      resetPassword,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
```

**Usage:**

```typescript
const { user, isAuthenticated, signOut } = useAuth();
```

### ProjectSelectionContext

Manages the currently selected project, project mode, and navigation guards. Persists selection and mode to localStorage for session continuity.

**File:** `src/contexts/ProjectSelectionContext.tsx`

```typescript
interface ProjectSelectionContextType {
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  clearSelectedProject: () => void;
  isProjectMode: boolean;
  setIsProjectMode: (mode: boolean) => void;
  isLoading: boolean;
  projectHistory: Project[];
  addToHistory: (project: Project) => void;
  clearHistory: () => void;
}
```

**Key behaviors:**
- Validates user access via `checkUserHasAccess` before setting a project
- Admin users bypass access checks
- Redirects to `/project-selector` when no project is selected on protected routes
- Maintains a history of up to 5 recently accessed projects
- Listens to route changes to enforce project selection on protected routes

**Protected route list (enforce project selection):**

```typescript
const protectedRoutes = [''/'', ''/dashboard'', ''/tasks'', ''/sprints'', ''/code'', ''/qa'', ''/metrics'', ''/meetings'', ''/documents''];
```

**Exempt routes (no project required):**

```typescript
const exemptRoutes = [''/products/create'', ''/projects/new'', ''/project-selector'', ''/login'', ''/profile''];
```

**LocalStorage keys:**

```typescript
const PROJECT_SELECTION_KEY = ''dr-ai-selected-project'';
const PROJECT_MODE_KEY = ''dr-ai-project-mode'';
const PROJECT_HISTORY_KEY = ''dr-ai-project-history'';
const MAX_HISTORY_ITEMS = 5;
```

**Composed hook with navigation helpers:**

```typescript
// src/hooks/useProjectSelection.ts
const { selectedProject, isProjectMode, isLoading, projectHistory, selectProject, clearProject, toggleProjectMode, enableProjectMode, disableProjectMode, isProjectSelected, canAccessProjectRoutes, navigateToProject, navigateToDashboard, switchProject, getRecentProjects } = useProjectSelection();
```

### TeamContext

Manages team selection across the application. Composes with the `useTeams` hook for data fetching and adds localStorage persistence.

**File:** `src/contexts/TeamContext.tsx`

```typescript
interface TeamContextValue {
  currentTeam: Team | null;
  teams: Team[];
  isLoading: boolean;
  error: string | null;
  selectTeam: (teamId: string | null) => Promise<void>;
  refreshTeams: () => Promise<void>;
  clearTeamSelection: () => void;
  isTeamSelectorOpen: boolean;
  setTeamSelectorOpen: (open: boolean) => void;
}
```

**Loading priority:**
1. `initialTeamId` prop (from deep linking)
2. localStorage persisted team ID
3. Auto-select first available team

**Available hooks:**

```typescript
useTeamContext()    // Full context value
useCurrentTeam()    // Just currentTeam
useHasTeam()        // Boolean: !!currentTeam
```

### AreaContext

Provides area detection based on the current route and allows manual area switching with URL synchronization.

**File:** `src/contexts/AreaContext.tsx`

```typescript
export interface AreaContextType {
  currentArea: Area;
  areaConfig: AreaConfig;
  setAreaContext: (area: Area) => void;
  navigateWithArea: (path: string, options?: { replace?: boolean }) => void;
  // ...
}
```

**Key behaviors:**
- Detects area from current pathname using `useAreaDetection` hook
- Persists manual selections to localStorage
- Provides `navigateWithArea` to preserve area context during navigation
- Syncs area context with URL for bookmarkable links

## useState for UI-Only State

Reserve `useState` for component-local state that does not need to be shared or persisted:

- Form input values (before submission)
- Modal/dialog open/close state
- Toggle states (expanded/collapsed sections)
- Loading states for local operations
- Filter and sort preferences (when not using TanStack Query filters)

```typescript
// UI state for team selector dropdown
const [isTeamSelectorOpen, setTeamSelectorOpen] = useState(false);

// Local filter state with localStorage persistence for user preference
const [filters, setFiltersState] = useState<BacklogFilters>(() => ({
  ...DEFAULT_BACKLOG_FILTERS,
  ...loadFromStorage(STORAGE_KEY_FILTERS, {})
}));

const setFilters = useCallback((newFilters: BacklogFilters) => {
  setFiltersState(newFilters);
  saveToStorage(STORAGE_KEY_FILTERS, newFilters);
}, []);
```

**When NOT to use useState for:**
- Data fetched from the server (use TanStack Query)
- Authentication state (use AuthContext)
- Selected project (use ProjectSelectionContext)
- Selected team (use TeamContext)
- Global UI toggles shared across multiple components (use a dedicated Context)

## Error Handling Patterns

### Toast Notifications

The project uses `sonner` for toast notifications. Import the `toast` function directly or use the `useToast` hook from `src/hooks/use-toast.ts`:

```typescript
import { toast } from ''sonner'';
import { useToast } from ''@/hooks/use-toast'';

// Direct usage
toast.success(''Backlog item created successfully'');
toast.error(''Failed to create backlog item'');
toast.error("You don''t have access to this project");

// With useToast hook (for programmatic dismissal)
const { toast } = useToast();
toast({ title: ''Project Selected'', description: `You''re now working on ${project.name}` });
```

### Error Handling in Queries

TanStack Query provides `error` and `isError` directly from the query result:

```typescript
const { data, isLoading, error } = useQuery({ ... });

if (isError) {
  return <ErrorMessage error={error} />;
}

if (isLoading) {
  return <LoadingSkeleton />;
}
```

### Error Handling in Mutations

Handle errors in the `onError` callback, always providing user feedback:

```typescript
const mutation = useMutation({
  mutationFn: asyncFunction,
  onSuccess: () => {
    toast.success(''Operation completed'');
  },
  onError: (error) => {
    console.error(''Operation failed:'', error);
    toast.error(''Operation failed: '' + error.message);
  }
});
```

### Error Boundaries

Wrap route-level components with `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) to catch and display rendering errors gracefully.

## Separation of Concerns Decision Tree

When adding state to a component, follow this decision tree:

```
Is the data fetched from the server?
├── YES: Use TanStack Query (useQuery / useMutation)
│         └── Include projectId in queryKey for project-scoped data
└── NO: Is the state needed by multiple components across the app?
          ├── YES: Use React Context
          │         ├── Authentication or session?       -> AuthContext
          │         ├── Active project selection?      -> ProjectSelectionContext
          │         ├── Active team selection?         -> TeamContext
          │         ├── Current area or route?         -> AreaContext
          │         └── Other shared state?            -> Create a new context
          └── NO: Is the state needed only by this component or its children?
                    ├── YES: Pass via props or a focused context
                    └── NO: Use useState
```

## Common Patterns Reference

### Combining Context with TanStack Query

Contexts provide the parameters that TanStack Query uses for scoped queries:

```typescript
// ProjectSelectionContext provides projectId
const { selectedProject } = useProjectSelection();
const projectId = selectedProject?.id;

// TanStack Query uses projectId for scoped queries
const { documents } = useProjectDocuments(filters);

// AuthContext provides user ID for mutations
const { user } = useAuth();
```

### Controlled Filter State with Persistence

Combine `useState` for local filter state with localStorage for persistence:

```typescript
const STORAGE_KEY_FILTERS = ''backlog-filters'';

const [filters, setFiltersState] = useState<BacklogFilters>(() => ({
  ...DEFAULT_BACKLOG_FILTERS,
  ...loadFromStorage(STORAGE_KEY_FILTERS, {})
}));

const setFilters = useCallback((newFilters: BacklogFilters) => {
  setFiltersState(newFilters);
  saveToStorage(STORAGE_KEY_FILTERS, newFilters);
}, []);

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(''Failed to save to localStorage:'', error);
  }
}
```

### Automatic Refetch on Context Change

When a context value changes (e.g., project change), queries automatically refetch because the query key changes:

```typescript
// When selectedProject changes, the query key changes
queryKey: [''backlog'', projectId, filters, viewOptions]
// TanStack Query treats this as a new query and fetches fresh data
```

### Dependent Queries

Ensure a query only runs when its prerequisites are met:

```typescript
// useMeetings requires projectId
export function useMeetings(
  projectId?: string,
  filters?: MeetingFilters,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: [''meetings'', projectId, filters],
    queryFn: fetchMeetings,
    enabled: enabled && !!projectId,  // Won''t run until projectId is available
  });
}
```

### Custom Hooks as the Integration Layer

Custom hooks wrap TanStack Query and contexts to provide a clean API to components:

```typescript
// src/hooks/useDocuments.ts
export function useProjectDocuments(filters?: DocumentFilters, includeContent = false) {
  const { selectedProject } = useProjectSelection();

  return useQuery({
    queryKey: [''project-documents'', selectedProject?.id, filters, includeContent],
    queryFn: async (): Promise<UnifiedDocument[]> => {
      if (!selectedProject?.id) throw new Error(''No project selected'');
      // ... fetch logic
    },
    enabled: !!selectedProject?.id,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
```

## Related Documentation

- [Project Context System](../06-project-context/context-system.md) - ProjectSelectionContext and project isolation
- [Authentication Flows](../05-authentication/auth-flows.md) - AuthContext and session management
- [Tasks](../21-tasks/tasks.md) - useTasks hook and task-specific patterns
- [Database Schema](../04-database-schema/schema.md) - Tables and views that queries target
', 'docs/07-state-management/state-patterns.md'),
    ('general', 'Edge Function API Endpoints', '---
name: api-endpoints
description: All Edge Function endpoints with request/response schemas and deployment
area: 11
maintained_by: api-documenter
created: 2026-03-30
updated: 2026-03-30
---

# Edge Function API Endpoints

All document generation endpoints are implemented as Supabase Edge Functions using Deno runtime. They provide server-side OpenAI integration with automatic token tracking, document storage, and conversation continuity via the Responses API.

Base URL: `https://<project-ref>.supabase.co/functions/v1/<endpoint>`

Authentication: Requires `Authorization: Bearer <anon_key>` header.

---

## 1. Create PRD

Generates a Product Requirements Document from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-prd` |
| Method | `POST` |
| Document Type | `prd` |
| Deployment | `supabase functions deploy create-prd` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or raw content to generate PRD from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model (e.g., gpt-4o, gpt-4o-mini)",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated PRD content in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 2. Create User Story

Generates user stories from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-user-story` |
| Method | `POST` |
| Document Type | `user-story` |
| Deployment | `supabase functions deploy create-user-story` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or raw content to generate user stories from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated user stories in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 3. Create Meeting Notes

Generates structured meeting notes from transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-meeting-notes` |
| Method | `POST` |
| Document Type | `meeting-notes` |
| Deployment | `supabase functions deploy create-meeting-notes` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript content to generate notes from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated meeting notes in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 4. Create Technical Specs

Generates technical specification documents from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-technical-specs` |
| Method | `POST` |
| Document Type | `technical-specs` |
| Deployment | `supabase functions deploy create-technical-specs` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or requirements content",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated technical specifications in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 5. Create Test Cases

Generates test scenarios and validation cases from meeting transcript content.

| Property | Value |
|----------|-------|
| URL | `/create-test-cases` |
| Method | `POST` |
| Document Type | `test-cases` |
| Deployment | `supabase functions deploy create-test-cases` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript or requirements to generate test cases from",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated test cases in Markdown format",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Auto-generated document name",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or `project_id` |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 6. Create Unit Tests

Generates production-ready unit tests for code functions. Uses language and framework-specific prompts.

| Property | Value |
|----------|-------|
| URL | `/create-unit-tests` |
| Method | `POST` |
| Document Type | `unit-tests` |
| Deployment | `supabase functions deploy create-unit-tests` |

### Supported Languages and Frameworks

| Language | Supported Frameworks |
|----------|---------------------|
| JavaScript | Jest, Mocha, Jasmine, AVA |
| TypeScript | Jest, Vitest, Mocha, Jasmine |
| Python | pytest, unittest, nose2, doctest |
| Java | JUnit, TestNG, Mockito, Spock |

### Request Schema

```json
{
  "content": "string (required) - JSON stringified UnitTestFormData object",
  "project_id": "string (required) - Project identifier for data isolation",
  "user_id": "string (optional) - User performing the action",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt template",
  "previous_response_id": "string (optional) - OpenAI response ID for conversation continuity",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens",
  "document_type": "string (optional) - Must be ''unit-tests'' if provided",
  "meeting_transcript_id": "string (optional) - Associated transcript reference"
}
```

**UnitTestFormData structure (stringified in content):**
```json
{
  "language": "string (required) - javascript | typescript | python | java",
  "framework": "string (required) - Framework from supported list above",
  "functionName": "string (required) - Name of the function to generate tests for",
  "functionCode": "string (optional) - Source code of the function",
  "testScenarios": [
    {
      "description": "string (required) - Test scenario description",
      "input": "string (optional) - Test input value",
      "expectedOutput": "string (optional) - Expected output value",
      "shouldThrow": "boolean (optional) - Whether the test expects an error",
      "errorMessage": "string (optional) - Expected error message"
    }
  ],
  "additionalContext": "string (optional) - Additional context for test generation"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "document": "string - Generated unit tests in the specified language/framework",
  "response_id": "string - OpenAI response ID for tracking",
  "document_id": "string - Stored document ID in generated_documents table",
  "document_name": "string - Format: ''Unit Tests - <functionName>''",
  "ai_interaction_id": "string - AI interaction record ID"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content`, `project_id`, or `content` is not valid JSON |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## 7. Analyze Transcript

Extracts structured metadata from meeting transcripts including title, description, date, tags, and recommended documents. Does not store generated documents.

| Property | Value |
|----------|-------|
| URL | `/analyze-transcript` |
| Method | `POST` |
| Document Type | N/A (analysis only, no document storage) |
| Deployment | `supabase functions deploy analyze-transcript` |

### Request Schema

```json
{
  "content": "string (required) - Meeting transcript content to analyze",
  "project_id": "string (optional) - Project identifier (required for AI interaction tracking)",
  "user_id": "string (optional) - User performing the action",
  "model": "string (optional) - Override OpenAI model",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override max output tokens"
}
```

### Response Schema

**Success (200):**
```json
{
  "success": true,
  "analysis": {
    "title": "string - Extracted meeting title",
    "description": "string - Brief summary of meeting content",
    "meeting_date": "string | null - Extracted meeting date if identifiable",
    "tags": ["string"] - Array of relevant topic tags",
    "recommended_documents": ["string"] - Array of document types recommended for generation",
    "confidence_scores": {
      "title": "number - Confidence score for title extraction (0-1)",
      "description": "number - Confidence score for description (0-1)",
      "meeting_date": "number - Confidence score for date extraction (0-1)"
    }
  },
  "response_id": "string - OpenAI response ID for tracking"
}
```

**Error:**
```json
{
  "success": false,
  "error": "string - Error message"
}
```

### Error Codes

| HTTP Code | Condition |
|-----------|-----------|
| 400 | Missing or invalid `content` or transcript exceeds 50,000 characters |
| 405 | Non-POST method used |
| 500 | Internal error, OpenAI API failure, or missing environment variable |

---

## Common Configuration

### OpenAI Configuration Precedence

Configuration is loaded with the following precedence order:

1. **Request-level overrides** - `model`, `temperature`, `token_limit` passed in request body
2. **Database configuration** - Platform settings from `platform_settings` table
3. **Default configuration** - Built-in defaults per endpoint

### Supported Models

| Model | Use Case |
|-------|----------|
| `gpt-4o` | Complex documents, technical specifications |
| `gpt-4o-mini` | Simple documents, quick generations |
| `gpt-4-turbo` | High-quality complex documents |

### Default OpenAI Parameters

| Parameter | Default Value | Range |
|-----------|--------------|-------|
| `temperature` | 0.7 | 0.0 - 2.0 |
| `max_output_tokens` | 4096 | 100 - 20000 |
| `store` | true | boolean |

---

## CORS Support

All endpoints include CORS preflight handling via `OPTIONS` method. The following headers are included in all responses:

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | `*` (configurable) |
| `Access-Control-Allow-Headers` | `authorization, x-client-info, apikey, content-type` |
| `Access-Control-Allow-Methods` | `POST, OPTIONS` |

---

## Error Handling

All errors follow a consistent format. The `getErrorStatusCode` function maps error messages to appropriate HTTP status codes:

| Status Code | Error Pattern |
|-------------|---------------|
| 400 | Error message contains "required" |
| 405 | Error message contains "Method not allowed" |
| 500 | All other errors (default fallback) |

---

## Deployment Commands

Deploy individual functions:

```bash
supabase functions deploy create-prd
supabase functions deploy create-user-story
supabase functions deploy create-meeting-notes
supabase functions deploy create-technical-specs
supabase functions deploy create-test-cases
supabase functions deploy create-unit-tests
supabase functions deploy analyze-transcript
```

Deploy all functions at once:

```bash
supabase functions deploy
```

Set required secrets before deployment:

```bash
supabase secrets set OPENAI_API_KEY=sk-your-openai-key
```

---

## Usage Example

```bash
curl -X POST ''https://<project-ref>.supabase.co/functions/v1/create-prd'' \
  -H ''Authorization: Bearer <anon-key>'' \
  -H ''Content-Type: application/json'' \
  -d ''{
    "content": "We need to build a user authentication system with OAuth support...",
    "project_id": "uuid-project-id",
    "user_id": "uuid-user-id",
    "temperature": 0.7
  }''
```

---

## Related Topics

- [Document Generation](../08-document-generation/edge-functions.md)
- [Supabase Functions](../12-supabase-functions/functions.md)
- [AI Tracking](../10-ai-tracking/tracking.md)
', 'docs/11-api-endpoints/endpoints.md'),
    ('general', 'Supabase Edge Functions Infrastructure', '---
name: supabase-functions
description: Deno Edge Functions, shared utilities, error handling, deployment
area: 12
maintained_by: functions-documenter
created: 2026-03-30
updated: 2026-03-30
---

# Supabase Edge Functions Infrastructure

Supabase Edge Functions provide a serverless runtime for executing TypeScript code in a Deno environment. This document covers the architecture, shared utilities, error handling patterns, and deployment procedures for all document generation functions in this project.

## Runtime Environment

### Deno-Based Serverless

All Edge Functions run on Deno, a modern JavaScript/TypeScript runtime built with Rust. The functions use Deno standard library imports and are deployed to Supabase''s Edge Functions infrastructure.

**Key Runtime Characteristics:**

- Runtime: Deno 1.x
- Import format: URL-based imports (ESM modules via `https://deno.land/`, `https://esm.sh/`)
- Execution: Isolated serverless environment per request
- Timeout: Configurable per function (default varies by function type)
- Memory: Shared quota across function invocations

**Sample imports from a document generation function:**

```typescript
import { serve } from ''https://deno.land/std@0.168.0/http/server.ts'';
import { SupabaseClient } from ''https://esm.sh/@supabase/supabase-js@2.39.0'';
import { OpenAI } from ''npm:openai'';
```

### Function Entry Pattern

All document generation functions follow a consistent entry pattern:

```typescript
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === ''OPTIONS'') {
    return createCorsResponse();
  }

  try {
    // Validate request method
    const methodValidation = validateMethod(req.method);
    if (!methodValidation.valid) {
      const errorData = formatErrorResponse(methodValidation.error!);
      const statusCode = getErrorStatusCode(methodValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Parse and validate request body
    const body: RequestBody = await req.json();
    const bodyValidation = validateRequestBody(body);
    if (!bodyValidation.valid) {
      const errorData = formatErrorResponse(bodyValidation.error!);
      const statusCode = getErrorStatusCode(bodyValidation.error!);
      return createResponse(errorData, statusCode);
    }

    // Process document generation
    // ...

    const successData = formatSuccessResponse(document, responseId, storedDocument?.id);
    return createResponse(successData, 200);
  } catch (error) {
    console.error(`[${OPERATION}] Edge function error:`, error);
    const errorData = formatErrorResponse(error);
    const statusCode = getErrorStatusCode(error);
    return createResponse(errorData, statusCode);
  }
});
```

## Shared Utilities: `_shared/document-generation/`

The `_shared/document-generation/` directory contains centralized utilities used by all document generation functions. This shared approach reduces code duplication and ensures consistent behavior across functions.

### Directory Structure

```
supabase/functions/_shared/document-generation/
  types.ts               -- Type definitions (RequestBody, ResponseData, OpenAIConfig)
  validation.ts          -- Request validation functions
  response-builder.ts    -- HTTP response formatting with CORS
  openai-service.ts      -- OpenAI API client wrapper
  openai-helper.ts       -- Response parsing and message building
  token-extractor.ts     -- Token usage and metadata extraction
  ai-interaction-service.ts  -- AI interaction lifecycle management
  generated-document-service.ts -- Document storage with metadata
  prompt-builder.ts      -- Prompt assembly with placeholder replacement
```

### Types (`types.ts`)

Core type definitions for all document generation functions.

**RequestBody:**

```typescript
interface RequestBody {
  content: string;              // Input content for generation
  project_id: string;           // Project context identifier
  user_id?: string;             // Optional user identifier
  system_prompt?: string;       // Optional custom system prompt override
  user_prompt?: string;         // Optional custom user prompt override
  previous_response_id?: string; // For conversation continuity
  model?: string;               // Optional model override
  temperature?: number;          // Optional temperature override
  token_limit?: number;         // Optional token limit override
  meeting_transcript_id?: string; // Optional transcript reference
}
```

**ResponseData:**

```typescript
interface ResponseData {
  success: boolean;
  document?: string;            // Generated document content (Markdown)
  response_id?: string;         // OpenAI response ID for tracking
  document_id?: string;         // Stored document ID
  document_name?: string;       // Stored document name
  ai_interaction_id?: string;   // Interaction tracking ID
  error?: string;               // Error message if failed
}
```

**OpenAIConfig:**

```typescript
interface OpenAIConfig {
  model: string;                // e.g., ''gpt-4o'', ''gpt-4o-mini''
  max_output_tokens: number;    // Maximum response length (100-20000)
  temperature: number;          // Randomness level (0.0-2.0)
  store: boolean;                // Whether to store conversation
  system_prompt?: string;        // AI role definition
  prompt?: string;              // User-facing template with {{content}} placeholder
  token_limit?: number;         // Internal field mapped to max_output_tokens
}
```

**DocumentTypeKey:** A union type covering all 51 supported document types across four categories: Generated Documents (10 types: tasks, features, prd, test-cases, user-story, meeting-notes, unit-tests, specs, accessibility-test-result, performance-test-result), Planning Documents (24 types), Development Documents (6 types), and Governance Documents (11 types).

### Validation (`validation.ts`)

Request validation with structured error messages.

```typescript
export function validateRequestBody(body: RequestBody): ValidationResult {
  if (!body.content?.trim()) {
    return { valid: false, error: ''Content is required'' };
  }

  if (!body.project_id?.trim()) {
    return { valid: false, error: ''Project ID is required'' };
  }

  return { valid: true };
}

export function validateMethod(method: string): ValidationResult {
  if (method !== ''POST'') {
    return { valid: false, error: ''Method not allowed'' };
  }

  return { valid: true };
}
```

### Response Builder (`response-builder.ts`)

Standardized HTTP responses with CORS headers and error mapping.

**Success Response:**

```typescript
export function formatSuccessResponse(
  document: string,
  responseId: string,
  documentId?: string,
  documentName?: string,
  aiInteractionId?: string
): ResponseData {
  return {
    success: true,
    document,
    response_id: responseId,
    document_id: documentId,
    document_name: documentName,
    ai_interaction_id: aiInteractionId
  };
}
```

**Error Response:**

```typescript
export function formatErrorResponse(error: Error | string): ResponseData {
  return {
    success: false,
    error: error instanceof Error ? error.message : error
  };
}
```

**CORS Headers:**

```typescript
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
```

### OpenAI Service (`openai-service.ts`)

Wrapper around the OpenAI Responses API with automatic metadata injection.

```typescript
export class OpenAIService {
  private client: OpenAI;
  private operation: string;

  async generateDocument(
    input: InputMsg[],
    projectId: string,
    previousResponseId?: string,
    config?: Partial<OpenAIConfig>
  ): Promise<any> {
    const requestPayload = {
      model: config.model!,
      input,
      previous_response_id: previousResponseId || undefined,
      max_output_tokens: config.max_output_tokens!,
      temperature: config.temperature!,
      store: config.store!,
      metadata: {
        project_id: projectId,
        operation: this.operation
      }
    };

    const response = await this.client.responses.create(requestPayload);
    return response;
  }
}
```

### OpenAI Helper (`openai-helper.ts`)

Response parsing utilities for extracting content and building input messages.

**Code Fence Cleaning:**

```typescript
export function cleanCodeFences(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // Remove leading code fences (```markdown, ```json at start)
  cleaned = cleaned.replace(/^```(?:markdown|json)?\n?/, '''');

  // Remove trailing code fences (``` at end)
  cleaned = cleaned.replace(/\n?```\s*$/, '''');

  return cleaned.trim();
}
```

**Output Extraction:**

```typescript
export function extractOutputText(resp: any): string {
  const rawText = extractRawOutputText(resp);
  return cleanCodeFences(rawText);
}

export function extractRawOutputText(resp: any): string {
  let text = '''';

  if (resp?.output_text) {
    text = String(resp.output_text);
  } else {
    const texts: string[] = [];
    const items = resp?.output ?? resp?.content ?? [];

    for (const item of items) {
      if (Array.isArray(item?.content)) {
        for (const contentItem of item.content) {
          if (typeof contentItem?.text === ''string'') {
            texts.push(contentItem.text);
          }
        }
      } else if (typeof item?.text === ''string'') {
        texts.push(item.text);
      }
    }

    text = texts.join(''\n'').trim();
  }

  return text;
}
```

**Input Message Building:**

```typescript
export function buildInputMessages(
  systemPrompt: string,
  userPrompt: string,
  content: string
): InputMsg[] {
  return [
    { role: ''system'', content: [{ type: ''input_text'', text: systemPrompt }] },
    { role: ''user'', content: [{ type: ''input_text'', text: `${userPrompt}\n\n${content}` }] }
  ];
}
```

### Prompt Builder (`prompt-builder.ts`)

Prompt assembly with configuration precedence: `request > database > default`.

```typescript
export function buildPrompts(
  content: string,
  defaultSystemPrompt: string,
  defaultUserPrompt: string,
  dbConfig: { system_prompt?: string; prompt?: string },
  requestOverrides: { system_prompt?: string; user_prompt?: string },
  logPrefix = ''''
): PromptResult {
  const finalSystemPrompt =
    requestOverrides.system_prompt || dbConfig.system_prompt || defaultSystemPrompt;
  const finalUserPrompt =
    requestOverrides.user_prompt || dbConfig.prompt || defaultUserPrompt;

  const processedUserPrompt = replacePromptPlaceholders(finalUserPrompt, content);

  return {
    systemPrompt: finalSystemPrompt,
    userPrompt: processedUserPrompt,
    source: {
      system_prompt: requestOverrides.system_prompt ? ''request'' :
                     (dbConfig.system_prompt ? ''database'' : ''default''),
      user_prompt: requestOverrides.user_prompt ? ''request'' :
                    (dbConfig.prompt ? ''database'' : ''default''),
    }
  };
}
```

### AI Interaction Service (`ai-interaction-service.ts`)

Manages the complete lifecycle of AI interaction records in the `ai_interactions` table: `pending -> in_progress -> completed/failed`.

**Lifecycle Methods:**

```typescript
// 1. Create pending record
async createInteraction(params: AIInteractionParams): Promise<string>

// 2. Mark as in-progress
async updateInteractionInProgress(interactionId: string): Promise<void>

// 3. Complete with response data and token usage
async completeInteraction(
  interactionId: string,
  response: any,
  document: string,
  startTime: number
): Promise<void>

// 4. Mark as failed with error details
async failInteraction(
  interactionId: string,
  error: Error,
  startTime: number
): Promise<void>
```

### Generated Document Service (`generated-document-service.ts`)

Stores documents with automatic metadata calculation.

**Stored Metadata:**

- `word_count`: Extracted by removing markdown syntax and splitting on whitespace
- `section_count`: Count of markdown headers (lines matching `/^#{1,6}\s+.+$/gm`)
- `estimated_reading_time`: Calculated at 200 words per minute
- `content_format`: Detected as `json` or `markdown` based on content structure

**Document Name Resolution Priority:**

1. Explicitly provided in params
2. Extracted from first H1 heading (`# Title`) in markdown content
3. Generated as `{DocumentType} - {YYYY-MM-DD}` format

## Error Handling and i18n Mapping

### Error Code Mapping

The `getErrorStatusCode` function maps error messages to appropriate HTTP status codes.

| Error Pattern | HTTP Status | Condition |
|---------------|-------------|-----------|
| `Method not allowed` | 405 | Non-POST methods |
| `required` in message | 400 | Missing required fields (content, project_id) |
| `status` property in error object | Use error.status | OpenAI API errors with status codes |
| Default | 500 | All other errors |

```typescript
export function getErrorStatusCode(error: Error | string): number {
  const errorMessage = error instanceof Error ? error.message : error;

  if (errorMessage.includes(''Method not allowed'')) {
    return 405;
  }

  if (errorMessage.includes(''required'')) {
    return 400;
  }

  if (error instanceof Error && ''status'' in error && typeof error.status === ''number'') {
    return error.status;
  }

  return 500;
}
```

### i18n Error Categories

Error messages are grouped into the following categories for frontend mapping:

| Category | Cause | Frontend Translation Key Pattern |
|----------|-------|----------------------------------|
| Authentication | `OPENAI_API_KEY` not configured | `error.auth.configuration` |
| Rate Limiting | OpenAI API throttling | `error.api.rate_limit` |
| Validation | Missing or invalid request fields | `error.validation.{field}` |
| Generation | Document generation failure | `error.generation.failed` |
| Storage | Database insert failure | `error.storage.failed` |

**Error Response Structure:**

```typescript
{
  success: false,
  error: "API key not configured"  // Raw error for debugging
}
```

The frontend maps these error strings to localized messages using the `useI18n` hook with keys from `src/locales/pt-br.ts` and `src/locales/en-us.ts`.

### Graceful Degradation

The `PlatformSettingsService` implements graceful degradation for configuration retrieval:

- Database errors: Logged and return `null` (fallback to defaults)
- Not found: Return `null` without logging (expected case)
- Invalid structure: Logged and return `null`
- Validation failure: Logged and return `null`

```typescript
async getAIConfiguration(key: AIConfigurationKey): Promise<AIConfiguration | null> {
  try {
    const { data, error } = await this.supabase
      .from(''platform_settings'')
      .select(''*'')
      .eq(''section'', ''ai'')
      .eq(''key'', key)
      .is(''deleted_at'', null)
      .single();

    if (error) {
      if (error.code === ''PGRST116'') {
        return null; // Not found - expected case
      }
      console.error(''[PlatformSettingsService] Database query error:'', error);
      return null; // Database error - graceful degradation
    }

    if (!validateAIConfiguration(jsonValue)) {
      return null; // Invalid structure - graceful degradation
    }

    return jsonValue;
  } catch (error) {
    return null; // Unexpected error - graceful degradation
  }
}
```

## Retry Logic with Exponential Backoff

The current implementation relies on Supabase''s built-in retry mechanism for transient failures. Document generation functions do not implement custom retry logic at the application level, relying instead on:

1. **Supabase Platform Retries:** Automatic retry for network-level transient failures
2. **OpenAI Responses API Retries:** The SDK handles rate limit responses with backoff
3. **Frontend Retry UI:** Users can re-attempt failed requests through the client interface

For future implementation, a pattern for exponential backoff would be:

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxAttempts) break;

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
```

## OpenAI API Key Management

### Environment Variable Configuration

API keys are stored as Supabase secrets and injected as environment variables at runtime.

**Required Environment Variable:**

```typescript
const OPENAI_API_KEY = Deno.env.get(''OPENAI_API_KEY'');
if (!OPENAI_API_KEY) {
  throw new Error(''OPENAI_API_KEY environment variable is required'');
}
```

**Secrets Configuration (Supabase Dashboard):**

1. Navigate to Project > Edge Functions > Secrets
2. Add `OPENAI_API_KEY` with the value `sk-...`
3. Secrets are encrypted at rest and injected into the runtime environment

### Supabase Client Authentication

The shared Supabase client uses the service role key for full database access, bypassing Row Level Security (RLS) policies.

```typescript
export function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get(''SUPABASE_URL'');
  const supabaseServiceRoleKey = Deno.env.get(''SUPABASE_SERVICE_ROLE_KEY'');

  if (!supabaseUrl) {
    throw new Error(''Missing required environment variable: SUPABASE_URL'');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(''Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY'');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}
```

**Singleton Pattern:** The client uses a singleton to avoid repeated initialization overhead across function invocations.

## Configuration Management

### Configuration Precedence

AI configuration is resolved with the following precedence order:

1. **Request Override** -- Values provided in the API request body
2. **Database Configuration** -- Values stored in `platform_settings` table (section = ''ai'')
3. **Default Configuration** -- Hardcoded defaults in each function''s `config.ts`

### Configuration Keys

The following configuration keys are defined in `_shared/platform-settings/types.ts`:

| Key | Purpose |
|-----|---------|
| `ai-create-prd` | Product Requirements Document generation |
| `ai-create-user-story` | User story generation |
| `ai-create-meeting-notes` | Meeting notes generation |
| `ai-create-technical-specs` | Technical specification generation |
| `ai-create-test-cases` | Test case generation |
| `ai-chat-style-guide` | Style guide chat processing |
| `ai-improve-writing` | Writing improvement |
| `ai-correct-spelling-grammar` | Spelling and grammar correction |
| `ai-format-organize` | Text formatting and organization |

### Per-Function Defaults

Each document generation function has a `config.ts` file defining its default configuration:

```typescript
// Example: create-prd/config.ts
export const CONFIG_KEY = ''ai-create-prd'';

export const OPENAI_CONFIG: OpenAIConfig = {
  model: ''gpt-4o'',
  max_output_tokens: 8000,
  token_limit: 8000,
  temperature: 0.6,
  store: false,
  system_prompt: DEFAULT_SYSTEM_PROMPT,
  prompt: DEFAULT_USER_PROMPT
};
```

## Deployment

### Deployment Commands

Deploy individual functions:

```bash
supabase functions deploy create-prd
supabase functions deploy create-user-story
supabase functions deploy create-meeting-notes
supabase functions deploy create-technical-specs
supabase functions deploy create-test-cases
supabase functions deploy create-unit-tests
supabase functions deploy analyze-transcript
```

Deploy all functions in a project:

```bash
supabase functions deploy --all
```

Deploy with secrets:

```bash
# Deploy and set secrets in one command
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase functions deploy create-prd
```

### Function URLs

After deployment, functions are accessible at:

```
https://{project-ref}.supabase.co/functions/v1/{function-name}
```

For example:
```
https://xyzabc.supabase.co/functions/v1/create-prd
```

### Secrets Deployment

Ensure secrets are set before deployment:

```bash
# List current secrets
supabase secrets list

# Set a new secret
supabase secrets set OPENAI_API_KEY=sk-your-key

# Unset a secret
supabase secrets unset OPENAI_API_KEY
```

### Deployment Verification

Verify deployment success by checking function logs:

```bash
supabase functions logs create-prd
```

Or by calling the function endpoint:

```bash
curl -X POST https://{project-ref}.supabase.co/functions/v1/create-prd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {anon-key}" \
  -d ''{"content": "test", "project_id": "test-id"}''
```

## Local Development

### Starting the Local Functions Server

Run all Edge Functions locally:

```bash
supabase functions serve
```

Run with specific port:

```bash
supabase functions serve --port 54321
```

### Calling Local Functions

Functions are available at `http://localhost:54321/functions/v1/{function-name}`:

```bash
curl -X POST http://localhost:54321/functions/v1/create-prd \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {anon-key}" \
  -d ''{"content": "test content", "project_id": "test-project-id"}''
```

### Environment Variables for Local Development

Create a `.env` file or export variables:

```bash
# Required for local development
export SUPABASE_URL=http://localhost:54321
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export OPENAI_API_KEY=sk-your-openai-key

# Start the server
supabase functions serve
```

### Using the Supabase CLI

```bash
# Login to Supabase
supabase login

# Link to a project
supabase link --project-ref {project-ref}

# Start local development
supabase dev

# Deploy after local testing
supabase functions deploy create-prd
```

### Debug Mode

Enable verbose logging during local development:

```bash
# Enable debug output
export DEBUG=supabase:functions
supabase functions serve
```

### Watching for Changes

During local development, restart the server when function code changes:

```bash
# Kill the existing server
pkill -f "supabase functions serve"

# Restart
supabase functions serve
```

## Document Generation Functions

The following functions use the shared document generation infrastructure:

| Function | Endpoint | Document Type |
|---------|----------|---------------|
| `create-prd` | `/functions/v1/create-prd` | PRD |
| `create-user-story` | `/functions/v1/create-user-story` | User Story |
| `create-meeting-notes` | `/functions/v1/create-meeting-notes` | Meeting Notes |
| `create-technical-specs` | `/functions/v1/create-technical-specs` | Technical Specs |
| `create-test-cases` | `/functions/v1/create-test-cases` | Test Cases |
| `create-unit-tests` | `/functions/v1/create-unit-tests` | Unit Tests |
| `analyze-transcript` | `/functions/v1/analyze-transcript` | Transcript Analysis |

### Common Request Format

All document generation functions accept the same request body structure:

```json
{
  "content": "string (required) - Input content for generation",
  "project_id": "string (required) - Project context identifier",
  "user_id": "string (optional) - User identifier",
  "system_prompt": "string (optional) - Override system prompt",
  "user_prompt": "string (optional) - Override user prompt",
  "previous_response_id": "string (optional) - For conversation continuity",
  "model": "string (optional) - Model override (e.g., ''gpt-4o-mini'')",
  "temperature": "number (optional) - Override temperature (0.0-2.0)",
  "token_limit": "number (optional) - Override token limit",
  "meeting_transcript_id": "string (optional) - Transcript reference"
}
```

### Common Response Format

```json
{
  "success": true,
  "document": "string - Generated document (Markdown)",
  "response_id": "string - OpenAI response ID",
  "document_id": "string - Stored document ID",
  "document_name": "string - Document name",
  "ai_interaction_id": "string - AI interaction tracking ID"
}
```

### Error Response Format

```json
{
  "success": false,
  "error": "string - Error message"
}
```

## Related Documentation

- [API Documentation](api-documentation.md) -- REST API endpoints and response formats
- [Database Schema](schema.md) -- Table structures for `ai_interactions`, `generated_documents`, `platform_settings`
- [Frontend Integration](../frontend/integration.md) -- Calling Edge Functions from the frontend client
', 'docs/12-supabase-functions/functions.md'),
    ('general', 'Database View Patterns', '---
name: database-views
description: Database view patterns, complex query encapsulation, view naming conventions
area: 13
maintained_by: views-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Database View Patterns

This document covers the rationale, conventions, and implementation patterns for database views in the Workforce project. Views encapsulate complex JOIN logic at the database layer, reducing query duplication across the codebase and enforcing project_id filtering consistently.

---

## 1. Why Complex JOINs Should Be Database Views

The Workforce database is built around a strict project isolation model. Every meaningful query joins at least two tables and filters by `project_id`. Without views, this pattern is repeated across every component that needs combined data, leading to several categories of problems.

### 1.1 Query Duplication

Consider the common need to display a task list with sprint information. Without a view, every component that needs this data must independently write:

```sql
SELECT
  t.id,
  t.title,
  t.status,
  t.story_points,
  s.name AS sprint_name,
  s.start_date,
  s.end_date,
  s.status AS sprint_status
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id = $1
ORDER BY t.created_at DESC;
```

This exact query (or minor variations) would appear in multiple places: a task list component, a sprint board component, a backlog view, a sprint report. When the schema evolves -- adding a new column to sprints, for instance -- every copy of this query must be updated. A view centralizes the JOIN logic so a single change propagates everywhere automatically.

### 1.2 Inconsistent Filtering Risk

The project isolation rule requires `.eq(''project_id'', selectedProjectId)` on every table query. Complex JOINs involving three or more tables make it easy to forget the filter on one of the joined tables, creating a potential data leak across projects. A view enforces the filter at the source:

```sql
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,           -- always present, always filtered
  t.title,
  t.status,
  t.story_points,
  s.name AS sprint_name,
  s.start_date,
  s.end_date
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.deleted_at IS NULL;  -- filter encapsulated here
```

The frontend then queries the view with a single `.eq(''project_id'', selectedProjectId)`, and the underlying tables are never queried directly for this combined data.

### 1.3 Performance Benefits

Views that reference base tables with existing indexes allow the query planner to use those indexes directly. When the view encapsulates a stable, frequently-used JOIN pattern, the planner optimizes it as if it were a hand-written query, while the application benefits from a simpler surface area.

### 1.4 When NOT to Use Views

- **Highly dynamic queries**: When filters, columns, or JOINs change frequently based on user configuration, a view adds rigidity without benefit.
- **Write operations**: Views are generally read-only. For insert/update/delete operations, continue using the base tables.
- **One-off exploratory queries**: Views should represent stable, reusable data combinations, not ad-hoc analysis.

---

## 2. View Naming Conventions

The Workforce project follows a consistent naming scheme for views that communicates their purpose and scope.

### 2.1 Pattern

```
<base_table>_with_<related_table>[_and_<related_table>]
```

The name begins with the primary table being queried, followed by `_with_` and the names of joined tables in order of importance. When a third table is included, it is appended with `_and_`.

### 2.2 Examples

| View Name | Purpose |
|-----------|---------|
| `tasks_with_sprints` | Tasks joined with sprint information |
| `documents_with_transcripts` | Generated documents joined with their source transcripts |
| `documents_with_interactions` | Documents joined with AI interaction metadata |
| `member_task_counts` | Aggregated task counts per team member |
| `sprint_velocity_summary` | Sprint velocity and point tracking |
| `tasks_with_members_and_sprints` | Tasks joined with both assignees and sprint data |

### 2.3 Naming Rules

- Use lowercase with underscores (snake_case).
- Pluralize the base table name (`tasks`, not `task`).
- Do not include the `_v` or `_view` suffix -- the context of the `views` directory makes this redundant.
- Prefix administrative or cross-project views with their domain: `admin_`, `cross_project_`, etc.

---

## 3. project_id Filtering Enforcement in Views

Views are the primary mechanism for enforcing project_id filtering on complex queries. Every view that spans multiple tables must ensure that project isolation is applied at the view level, not delegated to the caller.

### 3.1 Rule: Filter at the Outer Level

The project_id filter should appear in the WHERE clause of the view''s defining query, not just in the RLS policy. This ensures that even queries bypassing RLS (e.g., service role queries) still respect project boundaries.

```sql
-- CORRECT: project_id filter is explicit in the view definition
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,
  t.title,
  t.status,
  t.story_points,
  s.name        AS sprint_name,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (s.id IS NULL OR s.deleted_at IS NULL);

-- INCORRECT: project_id filter is omitted from the view
-- This relies entirely on RLS, which can be bypassed
CREATE VIEW tasks_with_sprints_broken AS
SELECT t.*, s.*
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.deleted_at IS NULL;
```

### 3.2 Why Both View Filtering and RLS?

View-level filtering provides defense in depth:

- **RLS** enforces project isolation for all authenticated user queries automatically.
- **View-level WHERE clauses** protect against service role queries, direct database access, and future API clients that might not enforce RLS.

Both layers should be present. The view defines the logical boundary; RLS enforces it at runtime for the application.

### 3.3 Optional project_id Parameter in View Definitions

If a view should support querying across multiple projects (for administrative purposes), this must be explicit. Do not default to cross-project behavior -- the standard pattern is project-scoped only.

```sql
-- Administrative view: explicitly labeled and documented
CREATE VIEW admin_all_tasks AS
SELECT
  t.id,
  t.project_id,
  p.name AS project_name,
  t.title,
  t.status,
  t.story_points,
  tm.name AS assigned_member_name
FROM dev_tasks t
JOIN project_knowledge_base p ON p.id = t.project_id
LEFT JOIN team_members tm ON tm.id = t.assigned_to
WHERE t.deleted_at IS NULL;
```

---

## 4. Useful View Examples

### 4.1 Tasks with Sprint Information

Returns all tasks for a project with their associated sprint details. This is the most frequently needed combined query, used by the sprint board, backlog view, and sprint report.

```sql
CREATE VIEW tasks_with_sprints AS
SELECT
  t.id,
  t.project_id,
  t.sprint_id,
  t.assigned_to,
  t.status,
  t.priority,
  t.task_type,
  t.title,
  t.description,
  t.story_points,
  t.estimated_hours,
  t.actual_hours,
  t.tags,
  t.created_at,
  t.updated_at,
  s.name        AS sprint_name,
  s.status      AS sprint_status,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date,
  s.planned_points,
  s.completed_points,
  s.velocity    AS sprint_velocity
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (t.sprint_id IS NULL OR s.deleted_at IS NULL);
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: tasks } = await supabase
  .from(''tasks_with_sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .eq(''sprint_status'', ''active'')
  .order(''priority'', { ascending: false });
```

### 4.2 Documents with Transcript Information

Returns generated documents enriched with their source transcript metadata. Used by the document review interface and transcript-to-document navigation.

```sql
CREATE VIEW documents_with_transcripts AS
SELECT
  d.id,
  d.project_id,
  d.meeting_transcript_id,
  d.ai_interaction_id,
  d.status,
  d.document_type,
  d.document_name,
  d.content,
  d.version,
  d.is_current_version,
  d.word_count,
  d.section_count,
  d.estimated_reading_time,
  d.quality_score,
  d.quality_issues,
  d.created_at,
  d.updated_at,
  mt.title              AS transcript_title,
  mt.meeting_date       AS transcript_meeting_date,
  mt.transcript_text    AS transcript_preview,
  mt.tags               AS transcript_tags,
  ai.interaction_type   AS ai_interaction_type,
  ai.request_model      AS ai_model,
  ai.cost_usd           AS ai_cost
FROM generated_documents d
LEFT JOIN meeting_transcripts mt ON mt.id = d.meeting_transcript_id
LEFT JOIN ai_interactions ai ON ai.id = d.ai_interaction_id
WHERE d.project_id IS NOT NULL
  AND d.deleted_at IS NULL
  AND (d.meeting_transcript_id IS NULL OR mt.deleted_at IS NULL);
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: documents } = await supabase
  .from(''documents_with_transcripts'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .eq(''is_current_version'', true)
  .order(''created_at'', { ascending: false });
```

### 4.3 Member Task Counts

Returns aggregated task counts per team member for a project, used by the team workload dashboard and assignment recommendations.

```sql
CREATE VIEW member_task_counts AS
SELECT
  ptm.project_id,
  ptm.member_id,
  tm.name        AS member_name,
  tm.email       AS member_email,
  tm.headline    AS member_headline,
  tm.avatar_url  AS member_avatar_url,
  COUNT(t.id) FILTER (WHERE t.status = ''todo'')       AS tasks_todo,
  COUNT(t.id) FILTER (WHERE t.status = ''in_progress'') AS tasks_in_progress,
  COUNT(t.id) FILTER (WHERE t.status = ''done'')       AS tasks_done,
  COUNT(t.id) FILTER (WHERE t.status = ''blocked'')    AS tasks_blocked,
  COUNT(t.id)                                        AS tasks_total,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status = ''done''), 0)
    AS completed_story_points,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status IN (''todo'', ''in_progress'')), 0)
    AS remaining_story_points,
  COALESCE(AVG(t.story_points) FILTER (WHERE t.status = ''done''), 0)::numeric(3,1)
    AS avg_story_points_per_completed_task
FROM project_team_members ptm
JOIN team_members tm ON tm.id = ptm.member_id
LEFT JOIN dev_tasks t ON t.assigned_to = ptm.member_id
  AND t.project_id = ptm.project_id
  AND t.deleted_at IS NULL
WHERE ptm.deleted_at IS NULL
  AND tm.deleted_at IS NULL
  AND ptm.project_id IS NOT NULL
GROUP BY
  ptm.project_id,
  ptm.member_id,
  tm.name,
  tm.email,
  tm.headline,
  tm.avatar_url;
```

**Frontend usage:**

```typescript
const { selectedProject } = useProjectSelection();

const { data: workload } = await supabase
  .from(''member_task_counts'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .order(''tasks_in_progress'', { ascending: false });
```

### 4.4 Sprint Velocity Summary

Returns sprint-level metrics including planned vs. completed points, task counts, and date ranges. Used by sprint reporting and velocity tracking charts.

```sql
CREATE VIEW sprint_velocity_summary AS
SELECT
  s.id,
  s.project_id,
  s.name,
  s.status,
  s.start_date,
  s.end_date,
  s.planned_points,
  s.completed_points,
  s.velocity,
  s.goals,
  COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL)     AS total_tasks,
  COUNT(t.id) FILTER (WHERE t.status = ''todo'')        AS tasks_todo,
  COUNT(t.id) FILTER (WHERE t.status = ''in_progress'') AS tasks_in_progress,
  COUNT(t.id) FILTER (WHERE t.status = ''done'')         AS tasks_completed,
  COUNT(t.id) FILTER (WHERE t.status = ''blocked'')      AS tasks_blocked,
  COALESCE(SUM(t.story_points) FILTER (WHERE t.status = ''done''), 0)
    AS actual_completed_points,
  COALESCE(SUM(t.estimated_hours) FILTER (WHERE t.status = ''done''), 0)
    AS actual_completed_hours,
  CASE
    WHEN s.planned_points > 0
    THEN ROUND((COUNT(t.id) FILTER (WHERE t.status = ''done'')::numeric
      / NULLIF(COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL), 0)) * 100, 1)
    ELSE NULL
  END AS task_completion_rate_pct
FROM sprints s
LEFT JOIN dev_tasks t ON t.sprint_id = s.id
WHERE s.project_id IS NOT NULL
  AND s.deleted_at IS NULL
GROUP BY
  s.id, s.project_id, s.name, s.status,
  s.start_date, s.end_date, s.planned_points,
  s.completed_points, s.velocity, s.goals;
```

### 4.5 Tasks with Members and Sprints

A three-table view combining tasks with both assignee information and sprint details. Used by the sprint board where full context is needed in a single row.

```sql
CREATE VIEW tasks_with_members_and_sprints AS
SELECT
  t.id,
  t.project_id,
  t.sprint_id,
  t.assigned_to,
  t.parent_task_id,
  t.feature_id,
  t.status,
  t.priority,
  t.task_type,
  t.title,
  t.description,
  t.story_points,
  t.estimated_hours,
  t.actual_hours,
  t.tags,
  t.component_area,
  t.created_at,
  t.updated_at,
  -- Sprint fields
  s.name        AS sprint_name,
  s.status      AS sprint_status,
  s.start_date  AS sprint_start_date,
  s.end_date    AS sprint_end_date,
  -- Member fields
  tm.name       AS member_name,
  tm.email      AS member_email,
  tm.avatar_url AS member_avatar_url,
  tm.headline   AS member_headline
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
LEFT JOIN team_members tm ON tm.id = t.assigned_to
WHERE t.project_id IS NOT NULL
  AND t.deleted_at IS NULL
  AND (t.sprint_id IS NULL OR s.deleted_at IS NULL)
  AND (t.assigned_to IS NULL OR tm.deleted_at IS NULL);
```

---

## 5. Frontend Queries: Views vs. Tables

The frontend queries views using the same Supabase client as tables. The only semantic difference is that views represent pre-joined, pre-filtered datasets.

### 5.1 Querying a View

```typescript
import { useI18n } from ''@/hooks/useI18n'';
import { useProjectSelection } from ''@/contexts/ProjectSelectionContext'';

const { selectedProject } = useProjectSelection();

const { data, error, isLoading } = await supabase
  .from(''tasks_with_sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)
  .eq(''sprint_status'', ''active'')
  .order(''priority'', { ascending: false });
```

### 5.2 Querying a Table Directly

Direct table queries are still appropriate for simple, single-table operations:

```typescript
// Creating a task: direct table insert
const { data, error } = await supabase
  .from(''dev_tasks'')
  .insert({
    project_id: selectedProject?.id,
    title: newTask.title,
    status: ''todo'',
    priority: ''medium'',
    task_type: ''feature'',
  })
  .select()
  .single();

// Updating a task status: direct table update
const { data, error } = await supabase
  .from(''dev_tasks'')
  .update({ status: ''done'', updated_at: new Date().toISOString() })
  .eq(''id'', taskId)
  .eq(''project_id'', selectedProject?.id)
  .select()
  .single();
```

### 5.3 Decision Matrix

| Scenario | Approach | Reason |
|----------|----------|--------|
| Read task with sprint name | View | Avoids JOIN duplication |
| Read document with transcript title | View | Encapsulates multi-table JOIN |
| Read aggregated member workload | View | Aggregation logic centralized |
| Read single task by ID | Table | No JOIN needed; direct PK lookup is faster |
| Insert a new task | Table | View is read-only |
| Update task status | Table | Write operation on base table |
| Bulk update tasks | Table | Write operations |
| Read tasks for a specific sprint | View | Consistent JOIN pattern |
| Read sprint velocity metrics | View | Aggregation centralized |

### 5.4 Query Consistency Pattern

All Supabase queries that access project-scoped data must follow this pattern:

```typescript
// ALWAYS: Include project_id filter
const { data } = await supabase
  .from(''tasks_with_sprints'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id);  // Required on every query

// NEVER: Omit project_id filter on project-scoped data
// const { data } = await supabase
//   .from(''tasks_with_sprints'')
//   .select(''*'');  // Missing project_id -- violates isolation
```

---

## 6. RLS Policies on Views

Views in PostgreSQL do not have their own storage; they execute their defining query at runtime. RLS policies on views behave differently depending on whether the view is defined as `SECURITY DEFINER` or `SECURITY INVOKER`.

### 6.1 Security Invoker Views (Default)

Views created without `SECURITY DEFINER` run with the privileges of the invoking user. RLS policies from the underlying base tables are applied as part of the view''s query execution.

```sql
-- This view runs with the caller''s RLS context
CREATE VIEW tasks_with_sprints AS
SELECT t.*, s.name AS sprint_name
FROM dev_tasks t
LEFT JOIN sprints s ON s.id = t.sprint_id
WHERE t.project_id IS NOT NULL;
```

With this default definition, when a user queries `tasks_with_sprints`, PostgreSQL applies the RLS policy from `dev_tasks` (which restricts to the user''s accessible project_ids) before the JOIN with `sprints` is evaluated. The view naturally respects project isolation through inherited RLS.

### 6.2 Security Definer Views

Views created with `SECURITY DEFINER` run with the privileges of the view owner (typically the schema owner or a service role). RLS policies from base tables are bypassed. In the Workforce project, `SECURITY DEFINER` views should only be used when RLS must be deliberately overridden, such as for administrative views.

```sql
-- Runs with owner privileges; base table RLS is bypassed
CREATE OR REPLACE VIEW admin_all_tasks
  (id, project_id, project_name, title, status, story_points)
SECURITY DEFINER
AS
SELECT
  t.id,
  t.project_id,
  p.name,
  t.title,
  t.status,
  t.story_points
FROM dev_tasks t
JOIN project_knowledge_base p ON p.id = t.project_id
WHERE t.deleted_at IS NULL;
```

**Important**: `SECURITY DEFINER` views bypass RLS entirely. Project isolation must be enforced through explicit WHERE clauses in the view definition (as shown in Section 3). Always document `SECURITY DEFINER` views clearly.

### 6.3 RLS Policies on the View Itself

You can attach RLS policies directly to a view, independent of the underlying tables:

```sql
-- Policy on the view itself
CREATE POLICY view_tasks_with_sprints_select ON tasks_with_sprints
  FOR SELECT USING (
    project_id IN (
      SELECT upa.project_id
      FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
        AND upa.deleted_at IS NULL
    )
  );

ALTER VIEW tasks_with_sprints ENABLE ROW LEVEL SECURITY;
```

When both view-level and table-level RLS policies exist, PostgreSQL applies them as `AND` conditions. This provides double enforcement: even if a table''s RLS is somehow misconfigured, the view''s policy acts as a safety net.

### 6.4 Recommended Policy Structure for Views

```sql
-- Apply RLS directly on the view
CREATE POLICY tasks_with_sprints_rls ON tasks_with_sprints
  FOR SELECT
  USING (
    project_id IN (
      SELECT upa.project_id
      FROM user_project_access upa
      WHERE upa.user_id = auth.uid()
        AND upa.deleted_at IS NULL
    )
  );

-- Enable RLS on the view
ALTER VIEW tasks_with_sprints ENABLE ROW LEVEL SECURITY;

-- Grant access to authenticated users
GRANT SELECT ON tasks_with_sprints TO authenticated;
```

### 6.5 Testing RLS on Views

Verify that RLS is working correctly on views by testing with different user contexts:

```sql
-- As an unprivileged user, check that only accessible projects are visible
SELECT DISTINCT project_id
FROM tasks_with_sprints;

-- The result should match the user''s entries in user_project_access

-- As a service role (bypassing RLS), verify data completeness
SET ROLE service_role;
SELECT COUNT(*) FROM tasks_with_sprints;
RESET ROLE;
```

---

## 7. Summary of Best Practices

1. **Encapsulate multi-table JOINs in views**: Any query joining two or more tables and filtering by `project_id` should be a view. This prevents duplication and enforces consistent filtering.
2. **Name views following the snake_case pattern**: `<base_table>_with_<related>[_and_<related>]`.
3. **Filter at the outer level**: Always include explicit `project_id IS NOT NULL` and soft-delete filters in the view''s WHERE clause. Do not rely solely on RLS.
4. **Default to Security Invoker**: Use `SECURITY DEFINER` only for administrative views that must bypass RLS, and document this explicitly.
5. **Attach RLS policies to views**: Apply project isolation policies directly on the view in addition to the base tables for defense in depth.
6. **Query views with project_id**: Frontend code must always pass `.eq(''project_id'', selectedProject?.id)` when querying views, just as it does for tables.
7. **Use views for reads, tables for writes**: Views are read-only. All insert, update, and delete operations continue to target base tables.
8. **Keep views stable**: Views represent established data combinations. If a query need changes frequently, it may not be a good candidate for a view.

---

## 8. Related Documentation

- [Database Schema](../04-database-schema/schema.md) -- Tables, columns, relationships, and base RLS policies
- [Project Context System](../06-project-context/context-system.md) -- `useProjectSelection()` hook and project isolation enforcement
- [Supabase Functions](../12-supabase-functions/functions.md) -- Edge Function API patterns that query views server-side
', 'docs/13-database-views/views.md'),
    ('general', 'Component Organization', '---
name: component-organization
description: UI components, project components, naming conventions, component structure patterns
area: 14
maintained_by: component-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Component Organization

The workforce application organizes its React components into two primary directories following a clear separation of concerns between generic UI primitives and domain-specific project features.

## Directory Structure

```
src/components/
  ui/          # Shadcn/ui base components (49 files)
  projects/    # Project-specific components (37 files)
```

## src/components/ui/ - Base Component Library

All components in `src/components/ui/` are built on top of Radix UI primitives and styled with Tailwind CSS. These are generic, reusable components that are not tied to any specific business domain.

### Core Components (49 files)

| Component | Purpose |
|-----------|---------|
| button.tsx | Button with CVA variants (default, destructive, outline, secondary, ghost, link, area) |
| dialog.tsx | Modal dialog built on @radix-ui/react-dialog |
| badge.tsx | Status badge component |
| card.tsx | Card container component |
| input.tsx | Text input field |
| select.tsx | Dropdown select built on Radix |
| table.tsx | Data table structure |
| form.tsx | Form wrapper with validation |
| toast.tsx | Toast notification (sonner) |
| dropdown-menu.tsx | Dropdown menu built on Radix |
| tooltip.tsx | Tooltip component |
| tabs.tsx | Tabbed interface |
| calendar.tsx | Date picker calendar |
| chart.tsx | Chart visualization wrapper |
| checkbox.tsx | Checkbox input |
| switch.tsx | Toggle switch |
| textarea.tsx | Multi-line text input |
| alert.tsx | Alert message component |
| alert-dialog.tsx | Alert dialog confirmation |
| progress.tsx | Progress bar indicator |
| skeleton.tsx | Loading skeleton placeholder |
| pagination.tsx | Pagination controls |
| sidebar.tsx | Sidebar navigation container |
| sheet.tsx | Side panel (drawer) |
| scroll-area.tsx | Scrollable container |
| resizable.tsx | Resizable panel |
| avatar.tsx | User avatar image |
| breadcrumb.tsx | Breadcrumb navigation |
| carousel.tsx | Carousel/slider component |
| accordion.tsx | Collapsible accordion panels |
| collapsible.tsx | Collapsible container |
| popover.tsx | Popover menu |
| context-menu.tsx | Right-click context menu |
| menubar.tsx | Menu bar container |
| combobox.tsx | Searchable combobox |
| code-editor.tsx | Code editor wrapper |
| file-upload.tsx | File upload component |
| input-otp.tsx | OTP input code |
| radio-group.tsx | Radio button group |
| slider.tsx | Range slider |
| toggle.tsx | Toggle button |
| toggle-group.tsx | Toggle button group |
| hover-card.tsx | Hover card popover |
| separator.tsx | Horizontal/vertical separator |
| label.tsx | Form label |
| aspect-ratio.tsx | Aspect ratio container |
| sonner.tsx | Sonner toast provider |

### Architecture Pattern

All Shadcn/ui components follow a consistent pattern:

1. Import React and Radix primitive
2. Import `cn` utility from `@/lib/utils`
3. Define component with `React.forwardRef` for ref forwarding
4. Apply Tailwind classes with `cn()` utility for conditional styling

Example from `button.tsx`:

```typescript
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// CVA (Class Variance Authority) for variant management
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium...",
  {
    variants: {
      variant: {
        default: "bg-[color:var(--phase-primary)] text-white...",
        destructive: "bg-destructive text-destructive-foreground...",
        outline: "border border-input bg-background...",
        // ...
      },
      size: { default: "h-10 px-4 py-2", sm: "h-9...", lg: "h-11...", icon: "h-10 w-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

// Forward ref pattern for ref accessibility
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

## src/components/projects/ - Domain-Specific Components

Components in `src/components/projects/` implement business logic tied to project management features. They consume the base UI components and integrate with application contexts.

### Component Inventory (37 files)

| Component | Purpose |
|-----------|---------|
| ProjectAccessBadge.tsx | Badge showing user access level (owner/granted/denied) |
| ProjectAccessControl.tsx | Access control settings for projects |
| ProjectAccessManager.tsx | Full access management interface |
| ProjectActionsDropdown.tsx | Actions menu for project items |
| ProjectActivityFeed.tsx | Activity stream display |
| ProjectAvatar.tsx | Project visual identifier |
| ProjectBrandingFields.tsx | Branding configuration form |
| ProjectCollaborators.tsx | Collaborator list display |
| ProjectDeleteDialog.tsx | Project deletion confirmation |
| ProjectDetailsCard.tsx | Project summary card |
| ProjectDetailsHeader.tsx | Project header section |
| ProjectFilters.tsx | Filter controls for project views |
| ProjectFormDialog.tsx | Create/edit project form |
| ProjectImportExportDialog.tsx | Data import/export interface |
| ProjectLeaderManager.tsx | Project leader assignment |
| ProjectMemberManager.tsx | Team member management |
| ProjectOverviewTab.tsx | Overview tab content |
| ProjectPermissionRules.tsx | Permission rule configuration |
| ProjectPermissionsDialog.tsx | Permission settings dialog |
| ProjectStatsCards.tsx | Statistics display cards |
| ProjectTeamSelector.tsx | Team selection control |
| ProjectVisibilitySettings.tsx | Visibility configuration |
| ProjectVisibilityToggle.tsx | Visibility toggle control |
| TeamMemberManager.tsx | Team member operations |
| DocumentList.tsx | Document listing wrapper |
| DocumentManager.tsx | Full document management |
| DocumentUpload.tsx | Document upload interface |
| GitRepositoryForm.tsx | Git repository configuration |
| GitRepositoryItem.tsx | Repository list item |
| GitRepositoryManager.tsx | Repository management interface |
| MemberListItem.tsx | Team member list entry |
| BulkAccessDialog.tsx | Bulk access operations |
| BulkActionsBar.tsx | Bulk action toolbar |
| BulkDeleteDialog.tsx | Bulk deletion confirmation |
| BulkOwnerAssignDialog.tsx | Bulk owner assignment |
| AccessStatusBadge.tsx | Access status indicator |
| ProjectAccessBadge.example.tsx | Example usage documentation |

### Naming Conventions

| Pattern | Example | Usage |
|---------|---------|-------|
| `Project[Feature].tsx` | `ProjectDetailsCard.tsx` | Project entity feature |
| `[Feature]List.tsx` | `DocumentList.tsx` | List/collection views |
| `[Feature]Manager.tsx` | `TeamMemberManager.tsx` | Full CRUD management |
| `[Feature]Dialog.tsx` | `ProjectDeleteDialog.tsx` | Modal dialogs |
| `[Feature]Badge.tsx` | `ProjectAccessBadge.tsx` | Status indicators |
| `Bulk[Action]Dialog.tsx` | `BulkDeleteDialog.tsx` | Batch operations |
| `[Feature]Item.tsx` | `MemberListItem.tsx` | List item components |

## Component Structure Pattern

All components follow a consistent internal structure to ensure maintainability and readability.

### Standard Component Template

```typescript
/**
 * [ComponentName] Component
 *
 * Brief description of what the component does and its main use cases.
 */

import React, { useState, useCallback } from ''react'';
import { Badge } from ''@/components/ui/badge'';
import { Button } from ''@/components/ui/button'';
import { useUserProjectAccess } from ''@/hooks/useUserProjectAccess'';
import { useAuth } from ''@/contexts/AuthContext'';
import { AccessStatus } from ''@/types/project'';
import { useI18n } from ''@/hooks/useI18n'';
import { cn } from ''@/lib/utils'';

// 1. Type definitions and interfaces at the top
export interface ComponentNameProps {
  /** Primary prop description */
  propA: string;
  /** Optional callback description */
  onAction?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// 2. Helper functions (outside component or before hooks)
function getVariant(status: Status): ''variant-a'' | ''variant-b'' {
  switch (status) {
    case Status.ACTIVE: return ''variant-a'';
    case Status.INACTIVE: return ''variant-b'';
  }
}

// 3. Main component with hooks at the top
export const ComponentName: React.FC<ComponentNameProps> = ({
  propA,
  onAction,
  className
}) => {
  // Context hooks
  const { user } = useAuth();
  const { t } = useI18n(''namespace'');

  // Data hooks
  const { hasAccess, isLoading } = useUserProjectAccess(propA);

  // Local state hooks
  const [localState, setLocalState] = useState<string>('''');
  const [isRetrying, setIsRetrying] = useState(false);

  // 4. Event handlers (useCallback for stability)
  const handleAction = useCallback(async () => {
    // Handler implementation
    onAction?.();
  }, [onAction]);

  const handleRetry = useCallback(async () => {
    // Retry logic
  }, []);

  // 5. Derived values and conditional logic
  const derivedValue = localState ? `prefix-${localState}` : ''default'';

  // 6. Render logic at the bottom
  if (isLoading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className={cn("container-class", className)}>
      {/* Component content */}
    </div>
  );
};

export default ComponentName;
```

### Structure Rules

1. **Type definitions at top** - Export interface before component function
2. **Hooks at top of function** - All hooks called before any conditional logic
3. **Helper functions outside component** - Pure functions for reusable logic
4. **Event handlers use useCallback** - Memoized for performance
5. **Derived values computed before render** - Logical separation of concerns
6. **Render logic at bottom** - Return statement with JSX

## The @/ Alias

The `@/` path alias maps to `./src/` in the project root. This alias is configured in `tsconfig.json` and allows consistent imports regardless of file location.

### Usage Examples

```typescript
// From any file in src/, use @/ to reference src/
import { Button } from ''@/components/ui/button'';      // src/components/ui/button.tsx
import { useI18n } from ''@/hooks/useI18n'';            // src/hooks/useI18n.ts
import { supabase } from ''@/integrations/supabase/client''; // src/integrations/supabase/client.ts
import type { Project } from ''@/types/project'';      // src/types/project.ts
import { cn } from ''@/lib/utils'';                     // src/lib/utils.ts
```

### Why @/ Alias

- Avoids deep relative paths like `../../../../components/...`
- Makes refactoring easier (moving files does not break imports)
- Clear intent: `@/` means "from src root"
- Standard practice in modern React + TypeScript projects

## useProjectSelection Hook

The `useProjectSelection` hook provides access to the currently selected project throughout the application. It is the primary mechanism for project-scoped data filtering.

### Import and Usage

```typescript
import { useProjectSelection } from ''@/contexts/ProjectSelectionContext'';

// Inside component
const { selectedProject } = useProjectSelection();

// Access project ID for database queries
const selectedProjectId = selectedProject?.id;

// Access full project object
console.log(selectedProject?.name);
console.log(selectedProject?.created_at);
```

### Context Interface

```typescript
interface ProjectSelectionContextType {
  selectedProject: Project | null;      // Currently selected project
  setSelectedProject: (project: Project | null) => void;
  clearSelectedProject: () => void;
  isProjectMode: boolean;               // Whether in project-scoped mode
  setIsProjectMode: (mode: boolean) => void;
  isLoading: boolean;                   // Loading state
  projectHistory: Project[];            // Recent project selection history
  addToHistory: (project: Project) => void;
  clearHistory: () => void;
}
```

### Project-Scoped Query Pattern

All Supabase queries in project-scoped contexts must filter by `project_id`:

```typescript
const { data, error } = await supabase
  .from(''tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id)  // Always filter by project
  .order(''created_at'', { ascending: false });

// Cross-table queries also use project_id
const { data: documents } = await supabase
  .from(''project_documents'')
  .select(''*'')
  .eq(''project_id'', selectedProject?.id);
```

### Common Mistake: selectedProjectId Property

The `useProjectSelection` hook returns `selectedProject` (the full object), not `selectedProjectId`. Common mistakes:

```typescript
// INCORRECT - property does not exist
const { selectedProjectId } = useProjectSelection();

// CORRECT - access the id property of the selectedProject object
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;
```

### Provider Setup

Wrap the application (or relevant routes) with the provider:

```typescript
// In your app/router setup
import { ProjectSelectionProvider } from ''@/contexts/ProjectSelectionContext'';

function App() {
  return (
    <ProjectSelectionProvider>
      <YourRoutes />
    </ProjectSelectionProvider>
  );
}
```

## useI18n Hook for Translations

The `useI18n` hook wraps `react-i18next` and provides a namespaced translation interface. All user-facing text should use this hook for internationalization support.

### Import and Usage

```typescript
import { useI18n } from ''@/hooks/useI18n'';

// Basic usage with namespace
const { t } = useI18n(''projects'');  // Use translations from ''projects'' namespace

// Usage with explicit key
<span>{t(''member.create'')}</span>  // Translates to "Criar Membro" (pt-BR) or "Create Member" (en-US)

// With interpolation parameters
{t(''member.welcome'', { name: ''John'' })}  // "Welcome, John"
```

### Hook Return Interface

```typescript
interface I18nReturn {
  t: (key: string, options?: object) => string;  // Translation function
  language: string;                               // Current language code (e.g., ''pt-BR'')
  changeLanguage: (lng: string) => void;        // Switch language programmatically
  isReady: boolean;                               // Whether translations are loaded
}
```

### Translation Files

Translations are stored in `src/locales/` with one file per language:

```
src/locales/
  pt-br.ts   # Portuguese (Brazil)
  en-us.ts   # English (United States)
```

### Namespace Organization

Translation keys are organized by feature namespace:

```typescript
// src/locales/pt-br.ts
export const projects = {
  member: {
    create: "Criar Membro",
    edit: "Editar Membro",
    save: "Salvar Alteracoes",
    errors: {
      nameRequired: "Nome e obrigatorio"
    }
  }
};

export const tasks = {
  status: {
    todo: "A Fazer",
    in_progress: "Em Andamento",
    done: "Concluido"
  }
};
```

### Using with UI Components

Combine `useI18n` with UI components for translated interfaces:

```typescript
export const ProjectAccessBadge: React.FC<ProjectAccessBadgeProps> = ({ projectId, ... }) => {
  const { t } = useI18n(''projects'');  // Use ''projects'' namespace

  return (
    <Badge variant={variant}>
      {t(''accessBadge.ownerLabel'')}  // Translates based on current language
    </Badge>
  );
};
```

### Language Switching

Components can trigger language changes:

```typescript
const { changeLanguage, language } = useI18n();

// Switch to Portuguese
changeLanguage(''pt-BR'');

// Switch to English
changeLanguage(''en-US'');

// Current language
console.log(language);  // ''pt-BR''
```

## Best Practices Summary

| Practice | Implementation |
|----------|----------------|
| Base components | Use `src/components/ui/` for all Shadcn/ui components |
| Project components | Use `src/components/projects/` for domain features |
| Imports | Always use `@/` alias for src-relative paths |
| Project context | Use `useProjectSelection()` to access `selectedProject` |
| Translations | Use `useI18n(''namespace'')` for all UI text |
| Component structure | Types -> Hooks -> Handlers -> Render |
| Ref forwarding | Use `React.forwardRef` for components needing refs |
| Variant management | Use CVA (class-variance-authority) for variant props |

## Related Topics

- [Folder Structure](../02-folder-structure/structure.md)
- [Routing System](../15-routing-system/routes.md)
- [State Management Patterns](../07-state-management/state-patterns.md)
- [Project Context System](../06-project-context/context-system.md)', 'docs/14-component-organization/components.md'),
    ('general', 'Routing System', '---
name: routing-system
description: Route structure, lazy loading, route guards, navigation patterns
area: 15
maintained_by: routing-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Routing System

## Overview

The application uses React Router v6 for client-side routing with a hierarchical area-based structure. Routes are organized by workflow areas (planning, development, quality, governance, legacy-code) with guards enforcing authentication, project selection, and area-specific access permissions.

## Route Structure

Routes are defined in `src/App.tsx` using React Router''s declarative `<Routes>` component. The structure follows a three-tier hierarchy:

1. **Public Routes** -- no authentication required
2. **Protected Routes** -- wrapped in `ProtectedRoute`, require authentication
3. **Area-Guard Routes** -- wrapped in `AreaAccessGuard`, require area-specific permissions

```
BrowserRouter
  AuthProvider
    AreaAccessProvider
      AreaProvider
        GovernanceProvider
          Suspense (PageLoader fallback)
            Routes
              Public Routes
              ProtectedRoute (Layout)
                AreaAccessGuard (planning)
                  Planning Routes
                AreaAccessGuard (development)
                  Development Routes
                AreaAccessGuard (quality)
                  Quality Routes
                AreaAccessGuard (governance)
                  Governance Routes
                AreaAccessGuard (legacy-code)
                  Legacy Code Routes
                MultiAreaAccessGuard
                  Shared Routes (sprints, bugs)
                Cross-Area Routes
```

## Lazy Loading Pattern

All page components are loaded lazily using `React.lazy()` combined with a custom `lazyWithRetry` wrapper (`src/lib/lazy-with-retry.ts`) that retries failed chunk loads up to 3 times with exponential backoff.

### Usage

```tsx
import { lazy } from ''react'';
import { lazyWithRetry as lazy } from ''@/lib/lazy-with-retry'';

const Dashboard = lazy(() => import(''./pages/Dashboard''));
const Tasks = lazy(() => import(''./pages/Tasks''));
const BugListPage = lazy(() => import(''./pages/quality/BugListPage''));
```

### Suspense Boundary

A single `Suspense` boundary at the root level wraps all routes with a `PageLoader` fallback:

```tsx
<Suspense fallback={<PageLoader />}>
  <Routes>
    {/* all routes */}
  </Routes>
</Suspense>
```

Some routes include nested `Suspense` for particularly heavy components:

```tsx
<Route
  path="/quality/accessibility-test"
  element={
    <Suspense fallback={<PageLoader />}>
      <AccessibilityTestPage />
    </Suspense>
  }
/>
```

### Retry Logic

The `lazyWithRetry` wrapper catches chunk load failures (network errors, stale caches) and retries up to 3 times with a 1-second delay between attempts:

```typescript
// src/lib/lazy-with-retry.ts
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function lazyWithRetry(factory: LazyFactory) {
  return lazy(() => retryImport(factory, MAX_RETRIES));
}
```

## Route Guards

The application implements three layers of route protection:

### 1. ProtectedRoute

Checks authentication and project selection before rendering protected content.

**Location:** `src/components/ProtectedRoute.tsx`

**Behavior:**
- While auth is loading, renders `PageLoader`
- If not authenticated, redirects to `/login` preserving `location.state`
- While project selection is loading, renders `PageLoader`
- If no project is selected and route is not exempt, redirects to `/project-selector`

**Exempt Routes** (no project required):
```typescript
const PROJECT_EXEMPT_ROUTES = [
  ''/project-selector'', ''/projects'', ''/products/create'',
  ''/team'', ''/profile'', ''/governance'', ''/privacy-policy'',
  ''/terms-of-service'', ''/admin'',
];
```

### 2. AreaAccessGuard

Validates the authenticated user has permission for a specific workflow area.

**Location:** `src/components/navigation/AreaAccessGuard.tsx`

**Behavior:**
- While area access is loading, renders `PageLoader`
- If user lacks access, shows a toast warning and redirects to `redirectTo` (default: `/`)
- Admin users always pass through

**Usage:**
```tsx
<Route element={<AreaAccessGuard area="planning"><Outlet /></AreaAccessGuard>}>
  <Route path="/planning" element={<PlanningLanding />} />
  <Route path="/planning/features" element={<FeaturesListPage />} />
</Route>
```

### 3. MultiAreaAccessGuard

Allows access when the user has permission for at least one of multiple areas.

**Location:** `src/components/navigation/MultiAreaAccessGuard.tsx`

**Usage:**
```tsx
<Route element={
  <MultiAreaAccessGuard areas={[''planning'', ''development'']}>
    <Outlet />
  </MultiAreaAccessGuard>
}>
  <Route path="/sprints" element={<SprintList />} />
</Route>
```

### 4. AreaRouteGuard

Validates and enforces area context on route changes for `/tasks` routes.

**Location:** `src/components/navigation/AreaRouteGuard.tsx`

**Behavior:**
- Validates the `area` query parameter on `/tasks` routes
- Redirects invalid or missing area to a valid fallback (navigation history, localStorage, or default `planning`)
- Uses `sessionStorage` to maintain navigation history for back button support

## Area Theme System

Each workflow area applies a distinct color theme via the `data-area` CSS attribute on a container element. This is applied by the `Layout` component using the `AreaContext`.

### Area Color Palettes

| Area | Primary Color | CSS Attribute |
|------|--------------|---------------|
| Planning | Dark Gold `#B8860B` | `data-area="planning"` |
| Development | Gray `#9E9E9E` | `data-area="development"` |
| Quality | Bronze `#CD7F32` | `data-area="quality"` |
| Governance | Dark Green `#1B4332` | `data-area="governance"` |
| Legacy Code | Dark Terracotta `#8B3A1A` | `data-area="legacy-code"` |

### CSS Variable Usage

Components consume area-specific colors through CSS variables:

```css
[data-area="planning"] {
  --phase-primary: #B8860B;
  --phase-accent: #DAA520;
  --phase-bg: rgba(255, 249, 230, 0.4);
}

.my-component {
  background-color: var(--phase-bg);
  border-color: var(--phase-primary);
}
```

## Route Table

| Path | Component | Area Guard | Auth Required |
|------|-----------|-----------|-------------|
| `/` | `Dashboard` | None | Yes |
| `/project-selector` | `ProjectSelector` | None | Yes |
| `/login` | `Login` | None | No |
| `/forgot-password` | `ForgotPassword` | None | No |
| `/reset-password` | `ResetPassword` | None | No |
| `/privacy-policy` | `PrivacyPolicyPage` | None | Yes |
| `/terms-of-service` | `TermsOfServicePage` | None | Yes |
| `/demos` | `DemosPage` | None | No |
| `/meetings/share/:token` | `PublicMeetingSharePage` | None | No |
| `/profile/edit` | `UserProfileEditPage` | None | Yes |
| `/upload-media` | `UploadMedia` | None | Yes |
| `/chat` | `ChatPage` | None | Yes |
| `/my-drafts` | `MyDraftsPage` | None | Yes |
| `/calendar/events/:id` | `CalendarEventDetailPage` | None | Yes |
| `/admin/indexing` | `IndexingManagementPage` | None | Yes |
| `/auth/calendar-callback` | `CalendarOAuthCallback` | None | No |
| `/planning` | `PlanningLanding` | `planning` | Yes |
| `/planning/prds-user-stories` | `PlanningDocumentsPage` | `planning` | Yes |
| `/planning/features` | `FeaturesListPage` | `planning` | Yes |
| `/planning/features/create` | `FeatureCreationPage` | `planning` | Yes |
| `/planning/features/:featureId` | `FeatureDetailPage` | `planning` | Yes |
| `/planning/backlog` | `BacklogHubPage` | `planning` | Yes |
| `/planning/backlog/statistics` | `BacklogStatisticsPage` | `planning` | Yes |
| `/planning/backlog/list` | `BacklogListPage` | `planning` | Yes |
| `/planning/backlog/prioritize` | `BacklogPrioritizationPage` | `planning` | Yes |
| `/planning/backlog/board` | `BacklogBoardPage` | `planning` | Yes |
| `/planning/backlog/generate` | `BacklogGenerationPage` | `planning` | Yes |
| `/planning/projects/edit/:id` | `ProjectForm` | `planning` | Yes |
| `/transcriptions` | `TranscriptionsPage` | `planning` | Yes |
| `/transcriptions/upload` | `TranscriptionUploadPage` | `planning` | Yes |
| `/transcriptions/:id` | `TranscriptionDetailPage` | `planning` | Yes |
| `/transcriptions/:id/edit` | `TranscriptionEditPage` | `planning` | Yes |
| `/team` | `Teams` | `planning` | Yes |
| `/team/create` | `CreateTeam` | `planning` | Yes |
| `/team/expand` | `TeamExpansionPage` | `planning` | Yes |
| `/team/:id` | `TeamMemberDetailPage` | `planning` | Yes |
| `/meetings` | `MeetingList` | `planning` | Yes |
| `/meetings/create` | `MeetingCreate` | `planning` | Yes |
| `/meetings/edit/:id` | `MeetingEdit` | `planning` | Yes |
| `/meetings/:id` | `MeetingDetailPage` | `planning` | Yes |
| `/development` | `DevelopmentLanding` | `development` | Yes |
| `/development/pull-requests` | `PullRequestsDashboard` | `development` | Yes |
| `/development/pr-metrics` | `PRMetricsDashboard` | `development` | Yes |
| `/development/code-review-metrics` | `CodeReviewMetricsPage` | `development` | Yes |
| `/development/performance` | `DevPerformanceDashboard` | `development` | Yes |
| `/development/performance/compare` | `DevPerformanceComparePage` | `development` | Yes |
| `/development/performance/:login` | `DevPerformanceDetailPage` | `development` | Yes |
| `/development/refactor-insights` | `RefactorInsightsPage` | `development` | Yes |
| `/development/repositories` | `RepositoriesListingPage` | `development` | Yes |
| `/development/analysis-reports` | `AnalysisReportsPage` | `development` | Yes |
| `/development/analysis-reports/:id` | `AnalysisReportDetailPage` | `development` | Yes |
| `/development/ai-agents` | `AIAgentsListPage` | `development` | Yes |
| `/development/ai-agents/:memberId` | `AIAgentConfigPage` | `development` | Yes |
| `/development/style-guides` | `StyleGuidesPage` | `development` | Yes |
| `/development/style-guides/settings` | `StyleGuideChatSettingsPage` | `development` | Yes |
| `/development/style-guides/new` | `StyleGuideDetailPage` | `development` | Yes |
| `/development/style-guides/:id` | `StyleGuideDetailPage` | `development` | Yes |
| `/documents` | `DocumentsListingPage` | `development` | Yes |
| `/documents/task-viewer` | `TaskDocumentViewerPage` | `development` | Yes |
| `/quality` | `QualityLanding` | `quality` | Yes |
| `/quality/test-cases` | `TestCasesPage` | `quality` | Yes |
| `/quality/bug-reports` | `BugReportsDashboard` | `quality` | Yes |
| `/quality/automated-tests` | `AutomatedTestingDashboard` | `quality` | Yes |
| `/quality/test-generator` | `TestGeneratorPage` | `quality` | Yes |
| `/quality/accessibility-reports` | `AccessibilityReportsPage` | `quality` | Yes |
| `/quality/performance-reports` | `PerformanceReportsPage` | `quality` | Yes |
| `/quality/accessibility-test` | `AccessibilityTestPage` | `quality` | Yes |
| `/quality/performance-test` | `PerformanceTestPage` | `quality` | Yes |
| `/quality/bugs` | `BugListPage` | `quality` or `development` | Yes |
| `/quality/bugs/:bugId` | `BugDetailPage` | `quality` or `development` | Yes |
| `/governance` | `GovernanceLanding` | `governance` | Yes |
| `/governance/documents` | `GovernanceDocumentsPage` | `governance` | Yes |
| `/governance/indexing` | `GovernanceIndexingPage` | `governance` | Yes |
| `/governance/permissions-visibility` | `PermissionsVisibilityPage` | `governance` | Yes |
| `/governance/jira` | `GovernanceJiraIntegrationsListPage` | `governance` | Yes |
| `/governance/jira/:projectId` | `GovernanceJiraConfigFormPage` | `governance` | Yes |
| `/governance/ai-settings` | `PlatformSettingsPage` | `governance` | Yes |
| `/governance/access-control` | `AccessControlPage` | `governance` | Yes |
| `/governance/area-access` | `AreaAccessPage` | `governance` | Yes |
| `/governance/allocation-requests` | `AllocationRequestsPage` | `governance` | Yes |
| `/governance/users` | `UserManagementPage` | `governance` | Yes |
| `/governance/meeting-recording` | `MeetingRecordingConfigPage` | `governance` | Yes |
| `/governance/rag-config` | `RagConfigPage` | `governance` | Yes |
| `/governance/meeting-share` | `GovernanceMeetingSharePage` | `governance` | Yes |
| `/governance/projects/edit/:id` | `ProjectForm` | `governance` | Yes |
| `/knowledge` | `KnowledgeListPage` | `governance` | Yes |
| `/knowledge/new` | `KnowledgeFormPage` | `governance` | Yes |
| `/knowledge/:id` | `KnowledgeEntryDetail` | `governance` | Yes |
| `/projects` | `ManageProjects` | `governance` | Yes |
| `/projects/edit/:id` | `ProjectForm` | `governance` | Yes |
| `/projects/:projectId` | `ProjectDetails` | `governance` | Yes |
| `/products/create` | `ProductCreationPage` | `governance` | Yes |
| `/legacy-code` | `LegacyCodeLanding` | `legacy-code` | Yes |
| `/legacy-code/code-health` | `CodeHealthDashboard` | `legacy-code` | Yes |
| `/legacy-code/migration-tracker` | `MigrationTrackerPage` | `legacy-code` | Yes |
| `/legacy-code/tech-debt` | `TechDebtRegistryPage` | `legacy-code` | Yes |
| `/legacy-code/compatibility` | `CompatibilityPage` | `legacy-code` | Yes |
| `/legacy-code/refactoring-plans` | `RefactoringPlansPage` | `legacy-code` | Yes |
| `/sprints` | `SprintList` | `planning` or `development` | Yes |
| `/sprints/new` | `SprintForm` | `planning` or `development` | Yes |
| `/sprints/analytics` | `SprintAnalyticsPage` | `planning` or `development` | Yes |
| `/sprints/:id` | `SprintDetails` | `planning` or `development` | Yes |
| `/sprints/:id/edit` | `SprintForm` | `planning` or `development` | Yes |
| `/sprints/:id/tasks` | `SprintTasks` | `planning` or `development` | Yes |
| `/tasks` | `Tasks` | None | Yes |
| `/tasks/hub` | `TasksLandingPage` | None | Yes |
| `/tasks/ai-suggestions` | `AISuggestedTasksPage` | None | Yes |
| `/tasks/:id/edit` | `TaskEditPage` | None | Yes |
| `/suggested-tasks` | `SuggestedTasks` | None | Yes |
| `/code` | `Code` | None | Yes |
| `/qa` | `QA` | None | Yes |
| `/metrics` | `Metrics` | None | Yes |
| `*` | `NotFound` | None | Yes |

## Navigation Configuration

Navigation items for each area are centralized in `src/config/navigation.ts` and typed via `src/types/navigation.ts`.

### Navigation Item Structure

```typescript
interface NavigationItem {
  id: string;
  label: string;        // i18n key, e.g. ''navigation.tasks''
  route: string;        // React Router path
  icon: LucideIcon;
  description?: string; // i18n key for tooltip
  badge?: number | string | boolean;
  isNew?: boolean;
  requiresPermission?: string;
}
```

### Area Navigation Config

```typescript
export const navigationConfig: NavigationConfig = {
  planning: [
    { id: ''backlog'', label: ''navigation.backlog'', route: ''/planning/backlog'', icon: ListTodo },
    { id: ''features'', label: ''navigation.features'', route: ''/planning/features/list'', icon: Boxes },
    { id: ''tasks'', label: ''navigation.tasks'', route: ''/tasks'', icon: CheckSquare },
    { id: ''team'', label: ''navigation.team'', route: ''/team'', icon: Users },
    { id: ''meetings'', label: ''navigation.meetings'', route: ''/meetings'', icon: Calendar },
  ],
  development: [ /* ... */ ],
  quality: [ /* ... */ ],
  governance: [ /* ... */ ],
  ''legacy-code'': [ /* ... */ ],
};
```

### Area Detection

Area detection uses route patterns defined in `src/lib/navigation/areaMapping.ts`. Each area has a priority-based set of route patterns:

| Priority | Pattern Type | Example |
|----------|-------------|---------|
| 100 | Exact match | `/planning`, `/quality` |
| 50 | Parameterized | `/projects/:id`, `/development/:path` |
| 40 | Nested catch-all | `/planning/*`, `/governance/*` |

## useI18n for Route Labels

All user-facing labels in the navigation use the `useI18n` hook for internationalization.

### Hook Definition

```typescript
// src/hooks/useI18n.ts
export const useI18n = (namespace?: string) => {
  const { t, i18n } = useTranslation();

  return {
    t: (key: string, options?: any) =>
      t(namespace ? `${namespace}.${key}` : key, options),
    language: i18n.language,
    changeLanguage: (lng: string) => i18n.changeLanguage(lng),
    isReady: i18n.isInitialized,
  };
};
```

### Usage in Components

```tsx
import { useI18n } from ''@/hooks/useI18n'';

export default function Layout() {
  const { t } = useI18n(''navigation'');

  const navItems = [
    { href: ''/team'', label: t(''layout.teams'') },
    { href: ''/knowledge'', label: t(''knowledge'') },
    { href: ''/meetings'', label: t(''layout.meetings'') },
    { href: ''/tasks'', label: t(''tasks'') },
  ];

  return (/* ... */);
}
```

### Translation Structure

Translation keys for navigation are organized in `src/locales/modules/core/en-us/navigation.ts`:

```typescript
export const navigation = {
  dashboard: "Dashboard",
  tasks: "Tasks",
  teams: "Teams",
  meetings: "Meetings",
  backlog: "Product Backlog",
  features: "Features",
  knowledge: "Knowledge Base",
  // ...
  areas: {
    planning: "Planning",
    development: "Development",
    quality: "Quality",
    governance: "Governance",
    legacyCode: "Legacy Code",
  },
  layout: {
    teams: "Team",
    meetings: "Meetings",
    menu: "Menu",
    account: "Account",
  },
};
```

## Layout Component

The `Layout` component (`src/components/Layout.tsx`) wraps all authenticated routes and provides:

- **TopNavigationMenu** -- sticky top navigation bar
- **AreaSidebar** -- collapsible sidebar with area-specific navigation
- **SidebarNavigation** -- area-aware navigation items from `navigationConfig`
- **Footer** -- bottom footer with sidebar offset
- **FloatingChatButton** -- AI assistant chat button
- **Area context** -- sets `data-area` attribute for theming

The sidebar visibility is tied to the current area:

```tsx
const { currentArea } = useArea();
const showSidebar = currentArea !== null && currentArea !== undefined;
```

## Redirect Routes

Legacy routes are maintained for backward compatibility via redirect routes:

| Legacy Path | Redirects To |
|------------|-------------|
| `/manage-projects` | `/projects` |
| `/dashboard` | `/` |
| `/projects/new` | `/products/create` |
| `/presigned-upload-demo` | `/upload-media` |
| `/settings/jira` | `/governance/jira` |

## Related Topics

- [UI Theming](../16-ui-theming/themes.md) -- area color themes and CSS variables
- [Component Organization](../14-component-organization/components.md) -- component structure
- [Auth System](../10-auth-system/auth.md) -- authentication and session management
', 'docs/15-routing-system/routes.md'),
    ('general', 'UI Theming', '---
name: ui-theming
description: Four-area color theming system with CSS data-area attribute
area: 16
maintained_by: theming-specialist
created: 2026-03-30
updated: 2026-03-30
---

# UI Theming

## Overview

The application implements a four-area color theme system that applies distinct visual identities to different functional domains. Each area (planning, development, testing, governance) has its own primary color, accent color, and background tint that propagate to all child components through CSS custom properties.

The theming system uses the `[data-area]` HTML attribute selector, which must be set on a container element to activate area-specific styles for all nested content.

## Color Palettes

### Planning Area

Dark Gold theme for product planning and roadmapping workflows.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#B8860B` | Headers, borders, active states |
| `--phase-accent` | `#DAA520` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(255, 249, 230, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #B8860B  [========]  Dark Gold
Accent    #DAA520  [========]  Goldenrod
Background rgba(255, 249, 230, 0.4)
```

### Development Area

Gray/Silver theme for code and technical implementation work.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#9E9E9E` | Headers, borders, active states |
| `--phase-accent` | `#C0C0C0` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(245, 245, 245, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #9E9E9E  [========]  Gray
Accent    #C0C0C0  [========]  Silver
Background rgba(245, 245, 245, 0.4)
```

### Testing/Quality Area

Bronze theme for QA, bug tracking, and quality assurance processes.

This area responds to two attribute values: `data-area="testing"` and `data-area="quality"`. Both values apply the same color palette.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#CD7F32` | Headers, borders, active states |
| `--phase-accent` | `#D4A574` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(255, 245, 235, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #CD7F32  [========]  Bronze
Accent    #D4A574  [========]  Light Bronze
Background rgba(255, 245, 235, 0.4)
```

### Governance Area

Dark Green theme for configuration, access control, and administrative settings.

| Variable | Value | Usage |
|----------|-------|-------|
| `--phase-primary` | `#1B4332` | Headers, borders, active states |
| `--phase-accent` | `#2D6A4F` | Highlights, hover states, secondary actions |
| `--phase-bg` | `rgba(240, 247, 244, 0.4)` | Container backgrounds, card fills |

Color swatches:

```
Primary   #1B4332  [========]  Dark Green
Accent    #2D6A4F  [========]  Green
Background rgba(240, 247, 244, 0.4)
```

## Applying the Theme

### Container-Level Application

Set the `data-area` attribute on a top-level container element. All child elements inherit the theme automatically through CSS inheritance of custom properties.

```html
<!-- Planning area -->
<div data-area="planning">
  <FeatureCard />
  <SprintBoard />
</div>

<!-- Development area -->
<div data-area="development">
  <CodeEditor />
  <PRMetrics />
</div>

<!-- Testing/Quality area -->
<div data-area="testing">
  <BugList />
  <TestResults />
</div>
```

### JSX/TSX Example

```tsx
export function UserManagementPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl" data-area="governance">
      <PageHeader />
      <AccessControlTable />
    </div>
  );
}
```

### Valid Attribute Values

| Value | Theme Applied | Use Cases |
|-------|---------------|-----------|
| `planning` | Dark Gold | Features, PRDs, roadmaps, user stories |
| `development` | Gray/Silver | Code review, style guides, AI agent configs |
| `testing` | Bronze | Bug tracking, test cases, quality metrics |
| `quality` | Bronze | Alias for testing, quality reports |
| `governance` | Dark Green | User management, system configuration, access control |

## CSS Variable Usage

Components reference the three phase variables to apply area-specific styling:

```css
/* Using CSS custom properties */
.phase-header {
  background-color: var(--phase-bg);
  border-left: 4px solid var(--phase-primary);
  color: var(--phase-primary);
}

.phase-badge {
  background-color: var(--phase-accent);
  color: white;
}

.phase-card {
  border: 1px solid var(--phase-primary);
  box-shadow: 0 2px 4px var(--phase-bg);
}
```

```tsx
// Tailwind with CSS variable interpolation
<div
  className="rounded-lg border p-4"
  style={{
    borderColor: ''var(--phase-primary)'',
    backgroundColor: ''var(--phase-bg)'',
  }}
>
  Content
</div>

// Tailwind arbitrary value syntax
<div className="bg-[var(--phase-bg)] border-[var(--phase-primary)]">
  Content
</div>
```

## Tailwind Custom Theme Configuration

The Tailwind configuration does not need modification to use area themes. The CSS variables are defined globally and referenced at runtime on container elements.

### Recommended Tailwind Extensions

Add to your Tailwind config to enable type-safe access to phase variables:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        ''phase-primary'': ''var(--phase-primary)'',
        ''phase-accent'': ''var(--phase-accent)'',
        ''phase-bg'': ''var(--phase-bg)'',
      },
    },
  },
};
```

After extending the theme, use in components:

```tsx
<div className="bg-phase-bg border-phase-primary text-phase-primary">
  Area-themed content
</div>
```

## Default Fallback Values

The `:root` selector defines default phase values when no `data-area` attribute is present:

```css
:root {
  --phase-primary: #B8860B;   /* Planning as default */
  --phase-accent: #DAA520;
  --phase-bg: #FFF9E6;        /* Solid fallback, not rgba */
}
```

Pages without a `data-area` attribute inherit the Planning theme defaults.

## Dark Mode Support

The area theming system is designed to work alongside dark mode. Phase variables are redefined within the `.dark` class scope, but the application currently maintains consistent phase colors across both light and dark modes.

```css
.dark [data-area="governance"] {
  /* Dark mode adjustments can be added here */
  --phase-bg: rgba(27, 67, 50, 0.3);
}
```

## Best Practices

### Do

- Set `data-area` on the page-level container, not individual components
- Use the exact attribute values: `planning`, `development`, `testing`, `quality`, `governance`
- Apply the attribute at the route level so all child pages inherit the theme
- Use CSS variables for all area-themed styles to maintain consistency

### Do Not

- Use custom area names not listed in the valid values table
- Override phase variables inline when the area attribute should handle it
- Set conflicting `data-area` values on nested containers
- Mix area color values with hardcoded hex colors in themed components

## Troubleshooting

### Theme not applying

1. Verify the `data-area` attribute is set on the container element
2. Check that the attribute value matches exactly: lowercase, no spaces
3. Ensure the CSS defining `[data-area="X"]` selectors is loaded
4. Confirm the element is not wrapped in a component that strips attributes

### Inconsistent colors across pages

1. Each page route should set its own `data-area` attribute
2. Check for missing `data-area` on new page components
3. Verify parent layout components do not override child attributes

### CSS variable shows invalid value

1. Open browser DevTools and inspect the computed style of the container
2. Check that `:root` defaults are loaded before area overrides
3. Ensure `@layer base` scope is not preventing variable cascade

## Related Documentation

- [Component Organization](../14-component-organization/components.md) - How components use area context
- [Tasks](../21-tasks/tasks.md) - Tasks include area assignment
- [Routes](../15-routing-system/routes.md) - Area-to-route mapping
- [AreaContext](../06-project-context/context-system.md) - React context for area state', 'docs/16-ui-theming/themes.md'),
    ('general', 'Team Members Management', '---
name: team-members
description: team_members table, profile management, TeamContext, member roles
area: 17
maintained_by: team-specialist
created: 2026-03-30
updated: 2026-03-30
---

# Team Members Management

This document covers the complete team member management system, including database structure, profile types, team-project associations, context providers, and permission hierarchies.

---

## 1. team_members Table Structure

The `team_members` table stores individual team member profiles with their professional attributes. It is a global resource visible across projects, but members must be explicitly assigned to a project via the `project_team_members` join table to participate in that project''s context.

### Columns

| Column | Type | Nullable | Default | Purpose |
|--------|------|----------|---------|---------|
| id | uuid | NO | gen_random_uuid() | Primary key |
| name | text | NO | null | Full display name |
| slug | text | NO | null | URL-friendly unique identifier |
| headline | text | YES | null | Short professional headline |
| avatar_url | text | YES | null | Profile picture URL |
| profile | text | NO | ''fullstack'' | Professional profile/specialization |
| status | text | NO | ''active'' | Member status: active, suspended, archived |
| member_type | character varying | YES | ''human'' | human or ai-agent |
| created_by | text | YES | null | Creator reference ID |
| created_at | timestamp with time zone | NO | now() | Creation timestamp |
| updated_at | timestamp with time zone | NO | now() | Last modification timestamp |
| deleted_at | timestamp with time zone | YES | null | Soft-delete timestamp |

### Supporting Tables

**team_member_skills** -- Stores detailed skills with proficiency levels.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| team_member_id | uuid | FK to team_members.id |
| skill_name | text | Name of the skill |
| skill_type | text | technical, soft, language, domain |
| proficiency_level | integer | 1 to 5 scale |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

**team_member_tools** -- Stores tools, frameworks, and languages with proficiency.

| Column | Type | Purpose |
|--------|------|---------|
| id | uuid | Primary key |
| team_member_id | uuid | FK to team_members.id |
| tool_name | text | Name of the tool |
| proficiency_level | integer | 1 to 5 scale |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

---

## 2. Profile Management

Each team member has a `profile` field that defines their professional specialization. Profiles are grouped into four organizational areas, each with its own color theme.

### Profile Types

**Planning Area**

| Profile | Label |
|---------|-------|
| pm | Product Manager |
| po | Product Owner |
| analyst | Analyst |
| requirements_analyst | Requirements Analyst |
| business_analyst | Business Analyst |
| designer | Designer |
| ux_researcher | UX Researcher |

**Development Area**

| Profile | Label |
|---------|-------|
| fullstack | Full Stack |
| frontend | Frontend |
| backend | Backend |
| mobile | Mobile |
| devops | DevOps |
| tech_lead | Tech Lead |
| architect | Architect |
| data_engineer | Data Engineer |

**Quality Area**

| Profile | Label |
|---------|-------|
| qa | QA Engineer |
| test_analyst | Test Analyst |
| automation_qa | Automation QA |
| code_reviewer | Code Reviewer |

**Governance Area**

| Profile | Label |
|---------|-------|
| admin | Administrator |
| director | Director |
| cto | CTO |
| ceo | CEO |
| scrum_master | Scrum Master |

### Profile Configuration

The `PROFILE_CONFIG` constant maps each profile to a display label and icon.

```typescript
export const PROFILE_CONFIG: Record<TeamMemberProfile, { label: string; icon: string }> = {
  fullstack: { label: ''Full Stack'', icon: ''...'' },
  frontend: { label: ''Frontend'', icon: ''...'' },
  // ...
};
```

### Area Mapping

Each profile belongs to an area that determines the CSS color theme applied in the interface.

```typescript
export const TEAM_AREA_CONFIG: Record<TeamArea, {
  label: string;
  profiles: TeamMemberProfile[];
}> = {
  planning: {
    label: ''Planning'',
    profiles: [''pm'', ''po'', ''analyst'', ''requirements_analyst'', ''business_analyst'', ''designer'', ''ux_researcher''],
  },
  development: {
    label: ''Development'',
    profiles: [''fullstack'', ''frontend'', ''backend'', ''mobile'', ''devops'', ''tech_lead'', ''architect'', ''data_engineer''],
  },
  quality: {
    label: ''Quality'',
    profiles: [''qa'', ''test_analyst'', ''automation_qa'', ''code_reviewer''],
  },
  governance: {
    label: ''Governance'',
    profiles: [''admin'', ''director'', ''cto'', ''ceo'', ''scrummaster''],
  },
};
```

CSS variables define the colors per area:

```css
[data-area="planning"] {
  --phase-primary: #B8860B;
  --phase-accent: #DAA520;
  --phase-bg: rgba(255, 249, 230, 0.4);
}

[data-area="development"] {
  --phase-primary: #9E9E9E;
  --phase-accent: #C0C0C0;
  --phase-bg: rgba(245, 245, 245, 0.4);
}

[data-area="quality"] {
  --phase-primary: #CD7F32;
  --phase-accent: #D4A574;
  --phase-bg: rgba(255, 245, 235, 0.4);
}

[data-area="governance"] {
  --phase-primary: #1B4332;
  --phase-accent: #2D6A4F;
  --phase-bg: rgba(240, 247, 244, 0.4);
}
```

---

## 3. TeamContext for Team State

`TeamContext` provides app-wide team selection state and persistence. It wraps the application and exposes team-related data and operations to all components.

### Provider Setup

```typescript
// Wrap your app with TeamProvider
import { TeamProvider } from ''@/contexts/TeamContext'';

function App() {
  return (
    <TeamProvider>
      <YourApp />
    </TeamProvider>
  );
}
```

### Context Value

```typescript
interface TeamContextValue {
  // Current team state
  currentTeam: Team | null;
  teams: Team[];

  // Loading and error states
  isLoading: boolean;
  error: string | null;

  // Team selection operations
  selectTeam: (teamId: string | null) => Promise<void>;
  refreshTeams: () => Promise<void>;
  clearTeamSelection: () => void;

  // Team selector UI state
  isTeamSelectorOpen: boolean;
  setTeamSelectorOpen: (open: boolean) => void;
}
```

### Persistence

Team selection is persisted to localStorage under the key `dr-meet-transform-current-team`. On mount, the provider restores the previously selected team or auto-selects the first available team if none is persisted.

Selection priority on mount:

1. `initialTeamId` prop if provided.
2. Persisted team ID from localStorage.
3. First team in the list if no prior selection exists.

### Convenience Hooks

```typescript
// Full context access
const { currentTeam, teams, selectTeam } = useTeamContext();

// Just the current team
const currentTeam = useCurrentTeam();

// Check if a team is selected
const hasTeam = useHasTeam(); // returns boolean
```

---

## 4. Member Roles and Permissions

The system uses a role-based access control model with four roles: `owner`, `admin`, `member`, and `viewer`. Role hierarchy is enforced numerically, with `owner` at the top.

### Role Hierarchy

```typescript
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};
```

### Permission Matrix

| Role | Team | Project | Document |
|------|------|---------|----------|
| owner | view, edit, delete, manage, invite | view, edit, delete, manage, invite | view, edit, delete, manage |
| admin | view, edit, manage, invite | view, edit, delete, manage, invite | view, edit, delete, manage |
| member | view | view, edit | view, edit |
| viewer | view | view | view |

### Permission Service

`PermissionService` is a singleton that handles all permission checks with caching.

```typescript
import { permissionService } from ''@/lib/services/permission-service'';

// Check team-level permission
const permission = await permissionService.checkTeamPermission(
  userId,
  teamId,
  ''edit''
);

// Check project-level permission
const permission = await permissionService.checkProjectPermission(
  userId,
  projectId,
  ''manage''
);

// Check if user can perform an action
const can = await permissionService.canPerformAction(
  userId,
  ''invite_member'',
  { teamId: ''...'' }
);

// Get all permissions for a user
const permissions = await permissionService.getUserPermissions(userId);
```

### useTeamPermissions Hook

The `useTeamPermissions` hook provides React bindings for the permission service with caching, batching, and state management.

```typescript
import { useTeamPermissions } from ''@/hooks/useTeamPermissions'';

function MyComponent() {
  const {
    permissions,
    hasPermission,
    canPerformAction,
    checkTeamPermission,
    checkProjectPermission,
    isLoading,
    error,
    refreshPermissions,
    clearCache
  } = useTeamPermissions({
    enabled: true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    preloadPermissions: [
      { resource: ''team'', resourceId: teamId, action: ''view'' },
      { resource: ''project'', resourceId: projectId, action: ''edit'' }
    ]
  });

  // Check a specific permission
  const canEdit = await hasPermission(''project'', projectId, ''edit'');

  // Check action-based permission
  const canInvite = await canPerformAction(''invite_member'', { teamId });

  // Check team permission with caching
  const teamPerm = await checkTeamPermission(teamId, ''manage'');

  return <div>{/* ... */}</div>;
}
```

### Subscription Tier Limits

Permission checks also validate subscription tier limits.

| Tier | Max Teams | Max Projects | Max Members |
|------|-----------|--------------|-------------|
| free | 1 | 3 | 5 |
| starter | 3 | 10 | 15 |
| professional | 10 | 50 | 50 |
| enterprise | unlimited | unlimited | unlimited |

```typescript
const { withinLimit, current, limit } = await permissionService.checkSubscriptionLimits(
  teamId,
  ''members''
);
```

---

## 5. Team-Project Associations

Members do not belong directly to teams. Instead, they are assigned to projects via the `project_team_members` join table.

### project_team_members Table

| Column | Type | Purpose |
|--------|------|---------|
| id | bigint | Primary key |
| project_id | uuid | FK to project_knowledge_base.id |
| member_id | uuid | FK to team_members.id |
| role | text | Project-specific role (optional) |
| joined_at | timestamp | When member joined the project |
| created_at | timestamp | Creation timestamp |
| updated_at | timestamp | Last update timestamp |
| deleted_at | timestamp | Soft-delete timestamp |

### Service Operations

```typescript
import {
  getProjectMembers,
  getMemberProjects,
  addMemberToProject,
  removeMemberFromProject,
  bulkAddMembersToProject,
  bulkRemoveMembersFromProject,
  updateProjectMemberRelationship
} from ''@/lib/services/project-team-member-service'';

// Get all members assigned to a project
const members = await getProjectMembers(projectId);

// Get all projects for a member
const projects = await getMemberProjects(memberId);

// Assign a member to a project
await addMemberToProject({
  project_id: projectId,
  member_id: memberId,
  role: ''developer''
});

// Remove a member from a project
await removeMemberFromProject(projectId, memberId);

// Bulk assign multiple members
await bulkAddMembersToProject(projectId, [id1, id2, id3], ''developer'');
```

### useProjectTeams Hook

```typescript
import { useProjectTeams } from ''@/hooks/useProjectTeams'';

function ProjectTeamPanel({ projectId }: { projectId: string }) {
  const {
    projectTeam,        // Members assigned to this project
    orgTeam,            // All organization team members
    availableMembers,   // Members not yet in the project
    isLoadingProject,
    isLoadingOrg,
    addMember,
    removeMember,
    addMultipleMembers,
    getMemberProjects,
    isAddingMember,
    isRemovingMember
  } = useProjectTeams(projectId);

  return (
    <div>
      {/* Assigned members */}
      {projectTeam.map(pt => (
        <div key={pt.id}>
          {pt.member.name}
          <button onClick={() => removeMember(pt.member_id)}>Remove</button>
        </div>
      ))}

      {/* Add available members */}
      {availableMembers.map(member => (
        <button key={member.id} onClick={() => addMember({ memberId: member.id })}>
          Add {member.name}
        </button>
      ))}
    </div>
  );
}
```

### Views for Project-Member Data

The system provides database views for efficient querying of member-project relationships:

- `view_project_team_members_detail` -- Full details of member-project relationships with member and project info.
- `view_project_member_counts` -- Per-project member counts.
- `view_member_project_counts` -- Per-member project counts.

---

## 6. Common Team Member Operations

### useTeamMembers Hook

```typescript
import { useTeamMembers } from ''@/hooks/useTeamMembers'';

// Read-only usage
const {
  members,
  selectedMember,
  selectedMemberId,
  isLoading,
  error,
  memberStats,
  selectMember,
  refreshMembers,
  clearSelection
} = useTeamMembers();

// With management operations enabled
const {
  members,
  selectedMember,
  addMember,
  updateMember,
  updateMemberStatus,
  removeMember,
  mutationStates
} = useTeamMembers(filters, true);

// Fetch with project data for card display
const { members } = useTeamMembers(undefined, false, true); // fetchWithProjects = true
```

### Creating a Team Member

```typescript
import { addTeamMember } from ''@/lib/services/team-member-service'';

const member = await addTeamMember({
  name: ''John Smith'',
  slug: ''john-smith'',          // Optional, auto-generated from name
  headline: ''Senior Developer'',
  avatar_url: ''https://...'',
  profile: ''fullstack'',
  member_type: ''human'',
  status: ''active'',
  created_by: userId,
  bio: ''Experienced full-stack developer...'',
  email: ''john@example.com''
});
```

### Updating a Team Member

```typescript
import { updateTeamMember } from ''@/lib/services/team-member-service'';

const updated = await updateTeamMember(memberId, {
  name: ''John A. Smith'',
  headline: ''Lead Engineer'',
  profile: ''tech_lead''
});
```

### Changing Member Status

```typescript
import { updateMemberStatus } from ''@/lib/services/team-member-service'';

// Suspend a member
await updateMemberStatus(memberId, ''suspended'');

// Archive a member (soft delete)
await updateMemberStatus(memberId, ''archived'');
```

### Managing Skills and Tools

```typescript
import { getMemberSkills, updateMemberSkills, getMemberTools, updateMemberTools } from ''@/lib/services/team-member-service'';

// Get current skills
const skills = await getMemberSkills(memberId);

// Update skills
await updateMemberSkills(memberId, [
  { skill_name: ''TypeScript'', skill_type: ''technical'', proficiency_level: 5 },
  { skill_name: ''React'', skill_type: ''technical'', proficiency_level: 4 }
]);

// Get current tools
const tools = await getMemberTools(memberId);

// Update tools
await updateMemberTools(memberId, [
  { tool_name: ''VS Code'', proficiency_level: 5 },
  { tool_name: ''Docker'', proficiency_level: 4 }
]);
```

### Filters for Querying Members

```typescript
const filters: TeamMemberFilters = {
  status: ''active'',           // active, suspended, archived
  member_type: ''human'',       // human, ai-agent
  profile: ''fullstack'',
  search: ''John'',
  include_deleted: false
};

const { members } = useTeamMembers(filters);
```

### Checking Slug Availability

```typescript
import { isSlugAvailable } from ''@/lib/services/team-member-service'';

const available = await isSlugAvailable(''john-smith'', excludeId);
```

---

## 7. Utility Functions

The `TeamMemberUtils` object provides helper functions for common operations.

```typescript
import { TeamMemberUtils } from ''@/types/team'';

// Check member type
TeamMemberUtils.isHuman(member);      // true for humans
TeamMemberUtils.isAIAgent(member);    // true for AI agents

// Check status
TeamMemberUtils.isActive(member);     // status === ''active'' && !deleted_at
TeamMemberUtils.isDeleted(member);    // !!deleted_at

// Generate slug from name
const slug = TeamMemberUtils.generateSlug(''John Smith''); // ''john-smith''

// Get display labels
TeamMemberUtils.getProfileLabel(''fullstack'');     // ''Full Stack''
TeamMemberUtils.getMemberTypeLabel(''human'');      // ''Human''
TeamMemberUtils.getStatusConfig(''active'');        // { label: ''Active'', color: ''success'' }

// Create a member payload with defaults
const payload = TeamMemberUtils.createPayload(''Jane Doe'', {
  profile: ''frontend'',
  member_type: ''human''
});
```

---

## 8. Related Files

| File | Purpose |
|------|---------|
| `src/types/team.ts` | All type definitions for team members, profiles, areas |
| `src/contexts/TeamContext.tsx` | Global team state provider |
| `src/hooks/useTeamMembers.ts` | React hook for team member data management |
| `src/hooks/useTeamPermissions.ts` | React hook for permission checking |
| `src/hooks/useProjectTeams.ts` | React hook for project-member associations |
| `src/lib/services/team-member-service.ts` | CRUD operations for team_members table |
| `src/lib/services/project-team-member-service.ts` | Project-member relationship management |
| `src/lib/services/permission-service.ts` | Role-based access control and caching |
| `docs/04-database-schema/schema.md` | Database schema reference |

---

## 9. Key Design Decisions

1. **Global team_members, project-scoped usage** -- The team_members table is not tied to a team_id. Members are globally available and assigned to projects via the join table. This allows the same member to participate in multiple projects with potentially different roles.

2. **Soft deletes everywhere** -- All member status changes (suspended, archived) and project-team associations use soft delete via the `deleted_at` column. No hard deletes occur.

3. **Separation of profile from role** -- A member''s `profile` (fullstack, qa, etc.) is their professional specialization, distinct from the project-level `role` that controls their permissions within a specific project.

4. **Permission caching** -- The `PermissionService` caches role lookups and permission results for 5 minutes to reduce database queries. The `useTeamPermissions` hook also maintains a local cache keyed by userId and resource.

5. **Area-based theming** -- CSS variables driven by `data-area` attributes apply consistent color themes to components based on the profile area (Planning, Development, Quality, Governance).', 'docs/17-team-members/members.md'),
    ('general', 'Permissions and Roles', '---
name: permissions-roles
description: RBAC, Supabase RLS policies, project-level isolation, permission checks
area: 19
maintained_by: permissions-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Permissions and Roles

## Overview

Workforce implements a two-layered security model that separates authentication from authorization. Authentication verifies user identity through Supabase Auth, while authorization enforces what each user can do through Role-Based Access Control (RBAC) combined with Supabase Row Level Security (RLS) policies. This document describes both layers, the role model, how project isolation works, and how permissions are checked throughout the application.

## Authentication vs Authorization

These two concepts serve distinct purposes in the security model.

| Concept | Layer | Purpose | Implementation |
|---------|-------|---------|----------------|
| Authentication | Identity | Verifies who the user is | Supabase Auth (email/password, session tokens) |
| Authorization | Access | Determines what the user can do | RBAC + RLS policies |
| Auth Context | Frontend | Exposes `user`, `isAuthenticated`, `signIn`, `signOut` | `AuthContext` in `src/contexts/AuthContext.tsx` |
| Permission Service | Frontend | Validates role-based actions | `PermissionService` in `src/lib/services/permission-service.ts` |

Authentication happens once at login. Every subsequent request to the database is automatically scoped to the authenticated user via `auth.uid()`. Authorization is evaluated on every operation, both at the frontend level (for UI gating) and at the database level (for query enforcement).

The `AuthContext` manages the user session:

```typescript
// src/contexts/AuthContext.tsx
const { user, isAuthenticated } = useAuth();
```

The `PermissionService` evaluates role-based actions:

```typescript
// src/lib/services/permission-service.ts
const hasAccess = await hasPermission(
  userId,
  ''project'',
  projectId,
  ''edit''
);
```

## Role Hierarchy

Workforce defines four user roles with a strict hierarchy. Higher roles inherit all permissions of lower roles.

### Role Definitions

| Role | Hierarchy Level | Description |
|------|-----------------|-------------|
| `owner` | 4 (highest) | Full control over team and all projects. Can delete team. |
| `admin` | 3 | Full control over team and projects. Cannot delete team. |
| `member` | 2 | Standard access. Can view and edit team and project resources. |
| `viewer` | 1 (lowest) | Read-only access to team and projects. |

### Permission Matrix

Each role grants different capabilities per resource type (team, project, document).

**Team Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | No | No |
| delete | Yes | No | No | No |
| manage | Yes | Yes | No | No |
| invite | Yes | Yes | No | No |

**Project Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | Yes | No |
| delete | Yes | Yes | No | No |
| manage | Yes | Yes | No | No |
| invite | Yes | Yes | No | No |

**Document Permissions:**

| Action | Owner | Admin | Member | Viewer |
|--------|-------|-------|--------|--------|
| view | Yes | Yes | Yes | Yes |
| edit | Yes | Yes | Yes | No |
| delete | Yes | Yes | No | No |
| manage | Yes | Yes | No | No |

The role hierarchy constant used in code:

```typescript
// src/lib/services/permission-service.ts
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1
};
```

### Subscription Tier Limits

Roles are further constrained by subscription tier limits:

| Tier | Max Teams | Max Projects | Max Members | Features |
|------|-----------|--------------|------------|----------|
| free | 1 | 3 | 5 | basic_permissions, view_documents |
| starter | 3 | 10 | 15 | basic_permissions, edit_documents, api_access |
| professional | 10 | 50 | 50 | advanced_permissions, edit_documents, api_access, audit_logs |
| enterprise | Unlimited | Unlimited | Unlimited | advanced_permissions, edit_documents, api_access, audit_logs, sso, custom_roles |

## Supabase RLS Policies

RLS provides database-level enforcement. When enabled on a table, every query and mutation is filtered by the applicable policies before results are returned.

### RLS Migration

The migration `20260323_enable_rls_all_tables.sql` enables RLS on all tables in the public schema and creates a fallback policy for authenticated users:

```sql
-- supabase/migrations/20260323_enable_rls_all_tables.sql
DO $$
DECLARE
    tbl RECORD;
    policy_exists BOOLEAN;
    policy_name TEXT;
BEGIN
    FOR tbl IN
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = ''public''
        ORDER BY tablename
    LOOP
        -- Enable RLS if not already active
        IF NOT tbl.rowsecurity THEN
            EXECUTE format(''ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY'', tbl.tablename);
        END IF;

        -- Create fallback policy for authenticated users if none exists
        SELECT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = ''public''
              AND tablename = tbl.tablename
        ) INTO policy_exists;

        IF NOT policy_exists THEN
            policy_name := ''authenticated_access_'' || tbl.tablename;
            EXECUTE format(
                ''CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)'',
                policy_name,
                tbl.tablename
            );
        END IF;
    END LOOP;
END;
$$;
```

### Project-Level Isolation Policy Pattern

All RLS policies follow a consistent pattern that enforces project isolation. Every policy checks that the requesting user belongs to the team or project associated with the data being accessed.

```sql
-- Users can only read tasks in projects they belong to
CREATE POLICY "Members can read tasks"
ON dev_tasks FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);

-- Users can only insert tasks into projects they have edit access to
CREATE POLICY "Members can insert tasks"
ON dev_tasks FOR INSERT
WITH CHECK (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);

-- Users can only read documents in their projects
CREATE POLICY "Users can read project documents"
ON generated_documents FOR SELECT
USING (
  project_id IN (
    SELECT project_id
    FROM team_members
    WHERE user_id = auth.uid()
  )
);
```

The `USING` clause filters which rows are visible on SELECT. The `WITH CHECK` clause validates that inserted or updated rows satisfy the same constraint.

### Key RLS Principles

1. Every table with user data must have RLS enabled.
2. Every RLS policy must reference `auth.uid()` to identify the requesting user.
3. Policies must filter by `project_id` or `team_id` to enforce isolation.
4. Service role keys bypass RLS entirely. Never expose service role keys to the client.

## Project-Level Isolation

All data in Workforce is scoped to a project. The `project_id` column appears on every user-facing table and every query must filter by it.

### Project Selection Pattern

The `ProjectSelectionContext` manages the active project across the application:

```typescript
// src/contexts/ProjectSelectionContext.tsx
const { selectedProject } = useProjectSelection();
const selectedProjectId = selectedProject?.id;

// Every query MUST include project_id
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId);
```

### Access Validation Flow

When a user selects a project, the context validates access:

```typescript
// src/contexts/ProjectSelectionContext.tsx
const setSelectedProject = async (project: Project | null) => {
  const { data: { user } } = await supabase.auth.getUser();

  const userIsAdmin = isAdminUser(user.id);

  if (!userIsAdmin) {
    const hasAccess = await checkUserHasAccess(user.id, project.id);
    if (!hasAccess) {
      toast.error("You don''t have access to this project");
      navigate(''/project-selector'');
      return;
    }
  }

  setSelectedProjectState(project);
};
```

### Required Pattern for All Queries

ALL Supabase queries in the application must follow this pattern:

```typescript
// Correct — includes project_id filter
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .eq(''project_id'', selectedProjectId)
  .order(''created_at'', { ascending: false });

// Incorrect — missing project_id filter
const { data } = await supabase
  .from(''dev_tasks'')
  .select(''*'')
  .order(''created_at'', { ascending: false });
```

The project context is available via the `useProjectSelection()` hook. Never extract a raw `selectedProjectId` variable; always access it through `selectedProject?.id` from the hook.

## Permission Checks in Components

The frontend enforces permissions at multiple levels: context providers, hooks, and service methods.

### Area Access Control

Platform-level area access (planning, development, quality, governance) is managed by `AreaAccessContext`:

```typescript
// src/contexts/AreaAccessContext.tsx
const { allowedAreas, hasAreaAccess, isLoadingAreaAccess } = useAreaAccessContext();

if (isLoadingAreaAccess) return <Spinner />;
if (!hasAreaAccess(''planning'')) return <Redirect to="/" />;
```

Internally, this uses `useMyAreaAccess()` which fetches areas from the `user_area_access` table. Admin users automatically receive all areas without a database query.

### Permission Service API

The `PermissionService` provides a comprehensive API for checking permissions:

```typescript
// Check team permission
const permission = await checkTeamPermission(userId, teamId, ''edit'');
if (!permission.granted) {
  console.error(permission.reason);
}

// Check project permission
const projectPerm = await checkProjectPermission(userId, projectId, ''delete'');

// Convenience method — returns boolean
const canDelete = await hasPermission(userId, ''project'', projectId, ''delete'');

// Action-based check — maps action names to permissions
const canInvite = await canPerformAction(userId, ''invite_member'', { teamId });

// Get all permissions for a user
const allPermissions = await getUserPermissions(userId);
```

### Action Mapping

The `canPerformAction` method maps high-level action names to resource/permission pairs:

```typescript
const actionMapping: Record<string, { resource: ''team'' | ''project'' | ''document''; permission: string }> = {
  ''create_project'': { resource: ''team'', permission: ''manage'' },
  ''delete_project'': { resource: ''project'', permission: ''delete'' },
  ''invite_member'': { resource: ''team'', permission: ''invite'' },
  ''remove_member'': { resource: ''team'', permission: ''manage'' },
  ''edit_document'': { resource: ''document'', permission: ''edit'' },
  ''delete_document'': { resource: ''document'', permission: ''delete'' },
  ''manage_team'': { resource: ''team'', permission: ''manage'' },
  ''view_team'': { resource: ''team'', permission: ''view'' },
  ''view_project'': { resource: ''project'', permission: ''view'' },
  ''edit_project'': { resource: ''project'', permission: ''edit'' }
};
```

### Caching

The permission service caches role and permission data for 5 minutes to reduce database load:

```typescript
// src/lib/services/permission-service.ts
private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Cache is cleared when:
// 1. TTL expires (automatic cleanup every 5 minutes)
// 2. User calls clearUserCache(userId)
// 3. User calls clearAllCaches()
permissionService.clearUserCache(userId);
```

## Database Schema

The permissions system relies on these core tables:

### team_members

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| team_id | uuid | Reference to the team |
| role | text | One of: owner, admin, member, viewer |
| created_at | timestamp | Membership creation time |

### project_members

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| project_id | uuid | Reference to the project |
| role | text | One of: owner, admin, member, viewer |
| team_id | uuid | Optional team association |

### user_area_access

| Column | Type | Description |
|--------|------|-------------|
| user_id | uuid | Reference to the user |
| area | text | One of: planning, development, quality, governance |
| is_active | boolean | Whether access is currently active |

## Testing

Permission service behavior is validated through comprehensive unit tests in `src/lib/services/__tests__/permission-service.test.ts`:

- Role permission evaluation for each role/resource combination
- Caching behavior (second calls use cache, cleared cache forces database query)
- Subscription tier feature and limit checks
- Role hierarchy comparison
- Invalid input handling
- Action-to-permission mapping

## Security Considerations

1. **Never expose service role keys** to the client. Service role keys bypass all RLS policies.
2. **Always filter by project_id** in queries. RLS provides a safety net, but frontend queries should enforce isolation explicitly.
3. **Validate on both layers**. Frontend checks provide a better user experience. RLS provides defense in depth.
4. **Sanitize all inputs**. The permission service uses UUID sanitization before database queries.
5. **Rate limiting**. Permission checks are rate-limited to 100 checks per minute per user to prevent abuse.

## Related Topics

- [Authentication](../05-authentication/auth-flows.md) — Auth context, session management, sign-in flows
- [Project Context](../06-project-context/context-system.md) — Project selection context, state management patterns
- [Team Members](../17-team-members/members.md) — Member management, team operations
- [Database Schema](../04-database-schema/schema.md) — Core tables, relationships, and constraints
', 'docs/19-permissions/roles.md'),
    ('general', 'Meeting Transcripts', '---
name: meeting-transcripts
description: meeting_transcripts table, recording process, AI processing, storage
area: 23
maintained_by: transcript-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Meeting Transcripts

## Overview

Meeting transcripts are text recordings of meetings stored in the database. They serve as primary input for AI document generation, enabling the system to transform spoken content into structured documents such as meeting notes, PRDs, user stories, and test cases.

The transcript system maintains a bidirectional relationship with the `meetings` table, allowing transcripts to be linked to scheduled meetings or exist independently as standalone recordings.

## meeting_transcripts Table Schema

The `meeting_transcripts` table stores all transcript data with the following structure:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, DEFAULT gen_random_uuid() | Unique identifier for the transcript |
| project_id | UUID | NOT NULL, FK to project_knowledge_base | Project association for data isolation |
| meeting_id | UUID | FK to meetings (ON DELETE SET NULL) | Optional link to scheduled meeting |
| title | TEXT | NOT NULL | Meeting or transcript title |
| description | TEXT | NULL | Optional description or summary |
| transcript_text | TEXT | NULL | Full text content of the transcript |
| meeting_date | TIMESTAMP | NULL | Date and time the meeting occurred |
| duration_minutes | INTEGER | NULL | Duration of the meeting in minutes |
| recorded_by | UUID | FK to team_members | Team member who recorded the transcript |
| tags | TEXT[] | DEFAULT ''{}'' | Array of tags for categorization |
| is_public | BOOLEAN | DEFAULT false | Visibility flag for sharing |
| created_by | TEXT | NULL | Email of the user who created the record |
| transcript_metadata | JSONB | DEFAULT ''{}'' | AI-extracted metadata including analysis results |
| created_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Record creation timestamp |
| updated_at | TIMESTAMP WITH TIME ZONE | DEFAULT NOW() | Last update timestamp |

### transcript_metadata Structure

The `transcript_metadata` JSONB field stores AI-extracted analysis results with the following structure:

```json
{
  "duration": 3600,
  "word_count": 8500,
  "speakers": ["John", "Sarah", "Mike"],
  "language": "en-US",
  "ai_suggestions": {
    "recommended_documents": ["prd", "user-stories", "meeting-notes"]
  }
}
```

### Key Indexes

- `idx_meeting_transcripts_project_id` - Filter transcripts by project
- `idx_meeting_transcripts_meeting_id` - Link to scheduled meetings
- `idx_meeting_transcripts_created_at` - Sort by creation date
- `idx_meeting_transcripts_tags` - Search by tags (GIN index)

## Recording Process

### Upload Flow

The transcript recording process follows these steps:

1. **Initiation**: User accesses the transcription upload interface through the Planning area
2. **Content Input**: User provides transcript content via one of two methods:
   - **File Upload**: Upload .txt, .md, or .docx files via drag-and-drop
   - **Direct Input**: Paste or type transcript text directly
3. **Metadata Entry**: User fills in metadata:
   - Title (required)
   - Description (optional)
   - Meeting date and time (required)
   - Tags for categorization (optional)
4. **Visibility Selection**: Choose between public (project-wide) or private visibility
5. **AI Processing Option**: Toggle automatic AI notes generation
6. **Submission**: Form validates and saves transcript to database

### Implementation Example

```typescript
// TranscriptionUploadForm.tsx - Upload handler
const handleSubmit = async (values: FormValues) => {
  // Insert transcript into database
  const { data, error: insertError } = await supabase
    .from(''meeting_transcripts'')
    .insert({
      title: values.title,
      description: values.description,
      meeting_date: format(values.meeting_date, ''yyyy-MM-dd HH:mm:ss''),
      transcript_text: fileContent || values.transcript_text,
      tags: values.tags,
      is_public: values.is_public,
      project_id: selectedProject?.id,
      created_by: user?.email,
      transcript_metadata: {
        upload_method: fileContent ? ''file'' : ''text'',
        file_name: uploadedFile?.name
      }
    })
    .select()
    .single();

  // Trigger AI notes generation if enabled
  if (values.generate_ai_notes && data) {
    await generateMeetingNotesFromTranscription(
      data.id,
      data.title,
      selectedProject?.id
    );
  }
};
```

### Supported File Formats

| Format | Extension | MIME Type |
|--------|-----------|-----------|
| Plain Text | .txt | text/plain |
| Markdown | .md | text/markdown |
| Word Document | .docx | application/vnd.openxmlformats-officedocument.wordprocessingml.document |

## AI Processing Pipeline

### Pipeline Overview

The AI processing pipeline transforms raw transcript text into structured, useful documents through two main stages:

```
Transcript Text
     |
     v
analyze-transcript Edge Function
(Extract metadata, tags, recommendations)
     |
     v
User selects document type
     |
     v
Document-specific Edge Function
(create-prd, create-user-story, etc.)
     |
     v
OpenAI API generates document
     |
     v
Document saved to generated_documents table
```

### Stage 1: Transcript Analysis

The `analyze-transcript` Edge Function processes raw transcript text to extract:

- **Title**: Concise, descriptive title (max 100 characters)
- **Description**: Summary description (3-4 sentences)
- **Meeting Date**: ISO format date if mentioned in transcript
- **Tags**: 3-5 relevant topics or categories
- **Recommended Documents**: List of document types suitable for the content
- **Confidence Scores**: Per-field confidence ratings (0.0-1.0)

#### Request Format

```typescript
interface AnalyzeTranscriptRequest {
  content: string;           // Raw transcript text
  project_id?: string;       // Project context
  user_id?: string;         // User tracking
  model?: string;           // Optional model override
  temperature?: number;      // Optional temperature override
  token_limit?: number;     // Optional token limit
}
```

#### Response Format

```typescript
interface TranscriptAnalysis {
  title: string;
  description: string;
  meeting_date: string | null;
  tags: string[];
  recommended_documents: string[];
  confidence_scores: {
    title: number;
    description: number;
    meeting_date: number;
  };
}
```

### Stage 2: Document Generation

After analysis, users can generate various document types from the transcript:

| Document Type | Edge Function | Use Case |
|--------------|---------------|----------|
| Meeting Notes | create-meeting-notes | Structured summary with action items |
| PRD | create-prd | Product requirements and specifications |
| User Stories | create-user-story | User-centric feature descriptions |
| Tasks | create-tasks | Technical implementation tasks |
| Test Cases | create-test-cases | QA testing scenarios |
| Technical Specs | create-technical-specs | Implementation details |
| Unit Tests | create-unit-tests | Automated test coverage |

### Document Generation Flow

```typescript
// RelatedDocuments.tsx - Document generation handler
const handleGenerateDocument = async (documentType: string) => {
  // Fetch transcript data
  const { data: transcript } = await supabase
    .from(''meeting_transcripts'')
    .select(''transcript_text, project_id'')
    .eq(''id'', meetingTranscriptId)
    .single();

  // Call document generation API
  const result = await generateDocumentAPI(
    documentType,           // e.g., ''prd'', ''user-stories'', ''meeting-notes''
    transcript.transcript_text,
    transcript.project_id,
    meetingTranscriptId,    // Links document back to transcript
    user?.id
  );

  if (result.success) {
    toast.success(''Document generated successfully'');
  }
};
```

## Relationship to generated_documents

### One-to-Many Relationship

Each meeting transcript can generate multiple documents. The relationship is maintained through the `meeting_transcript_id` foreign key in the `generated_documents` table:

```
meeting_transcripts (1) ----< (N) generated_documents
     |                              |
     +-- id                          +-- meeting_transcript_id
```

### Database Constraint

```sql
ALTER TABLE generated_documents
ADD COLUMN IF NOT EXISTS meeting_transcript_id UUID;

ALTER TABLE generated_documents
ADD CONSTRAINT fk_generated_documents_transcript
FOREIGN KEY (meeting_transcript_id)
REFERENCES meeting_transcripts(id)
ON DELETE SET NULL;
```

### Viewing Related Documents

The `view_meeting_related_documents` database view provides a convenient way to fetch all documents generated from a specific transcript:

```typescript
const fetchRelatedDocuments = async (meetingTranscriptId: string) => {
  const { data, error } = await supabase
    .from(''view_meeting_related_documents'')
    .select(''*'')
    .eq(''meeting_transcript_id'', meetingTranscriptId)
    .order(''created_at'', { ascending: false });

  return data;
};
```

### Document Grouping by Category

Documents are automatically grouped by category for display:

```typescript
const groupDocumentsByCategory = (documents: MeetingRelatedDocument[]) => {
  return Object.entries(grouped).map(([category, docs]) => ({
    category,
    documents: docs,
    count: docs.length
  }));
};
```

## Storage Architecture

### Supabase Storage Integration

Transcripts are stored directly in PostgreSQL as text content within the `transcript_text` column. This approach provides:

- **ACID Compliance**: Atomic transactions for data integrity
- **Full-Text Search**: Native PostgreSQL text search capabilities
- **Efficient Retrieval**: No network overhead for file downloads
- **Automatic Backups**: Included in Supabase database backups

### RAG Vector Embeddings

Transcript content is also indexed in the `document_embeddings` table for semantic search capabilities:

```typescript
// document_embeddings table structure
{
  id: UUID,
  content_chunk: TEXT,        // Chunked transcript text
  source_table: ''meeting_transcripts'',
  source_id: UUID,             // meeting_transcripts.id
  embedding: vector(1536),      // OpenAI text-embedding-ada-002
  project_id: UUID,            // Project scoping
  metadata: JSONB,              // Additional context
  checksum: TEXT,               // Change detection
  token_count: INTEGER,         // Cost tracking
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP
}
```

### Indexes for Efficient Storage Queries

```sql
-- Create indexes for document_embeddings
CREATE INDEX idx_document_embeddings_project_source
  ON document_embeddings(project_id, source_table);

CREATE INDEX idx_document_embeddings_vector
  ON document_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

## Retrieval Patterns

### Using the useMeetingTranscripts Hook

The recommended way to fetch transcripts for a project:

```typescript
// hooks/useMeetingTranscripts.ts
import { useQuery } from ''@tanstack/react-query'';
import { supabase } from ''@/lib/supabase'';

export function useMeetingTranscripts(projectId: string | undefined) {
  return useQuery({
    queryKey: [''meetingTranscripts'', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from(''meeting_transcripts'')
        .select(''id, title, description, meeting_date, tags'')
        .eq(''project_id'', projectId)
        .order(''meeting_date'', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });
}
```

### Using MeetingService

For more complex queries involving meeting-transcript relationships:

```typescript
// MeetingService.ts - fetchMeetingWithTranscript
const fetchMeetingWithTranscript = async (meetingId: string) => {
  const { data, error } = await supabase
    .from(''view_meeting_with_transcript'')
    .select(''*'')
    .eq(''id'', meetingId)
    .maybeSingle();

  if (error) throw error;
  return data;
};
```

### View: view_meeting_with_transcript

This database view combines meetings and transcripts using a LEFT JOIN:

```sql
CREATE VIEW view_meeting_with_transcript AS
  SELECT
    m.*,
    mt.id AS transcript_id,
    mt.transcript_text,
    mt.transcript_metadata,
    mt.tags AS transcript_tags,
    mt.title AS transcript_title,
    mt.description AS transcript_description,
    mt.meeting_date AS transcript_meeting_date
  FROM meetings m
  LEFT JOIN meeting_transcripts mt ON m.id = mt.meeting_id;
```

### Query Pattern: Project-Context Filtering

All queries must filter by `project_id` to enforce data isolation:

```typescript
const fetchTranscriptForProject = async (transcriptId: string, projectId: string) => {
  const { data, error } = await supabase
    .from(''meeting_transcripts'')
    .select(''*'')
    .eq(''id'', transcriptId)
    .eq(''project_id'', projectId)  // Enforce project isolation
    .single();

  return data;
};
```

## Usage Examples

### Creating a Transcript Programmatically

```typescript
const createTranscript = async (
  title: string,
  transcriptText: string,
  projectId: string,
  meetingDate: Date
) => {
  const { data, error } = await supabase
    .from(''meeting_transcripts'')
    .insert({
      title,
      transcript_text: transcriptText,
      project_id: projectId,
      meeting_date: format(meetingDate, ''yyyy-MM-dd HH:mm:ss''),
      tags: [''planning'', ''discussion''],
      is_public: false
    })
    .select()
    .single();

  return { data, error };
};
```

### Fetching Transcripts with Related Documents

```typescript
const fetchTranscriptWithDocuments = async (transcriptId: string) => {
  // Fetch transcript
  const transcriptPromise = supabase
    .from(''meeting_transcripts'')
    .select(''*'')
    .eq(''id'', transcriptId)
    .single();

  // Fetch related documents
  const documentsPromise = supabase
    .from(''view_meeting_related_documents'')
    .select(''*'')
    .eq(''meeting_transcript_id'', transcriptId);

  const [transcriptResult, documentsResult] = await Promise.all([
    transcriptPromise,
    documentsPromise
  ]);

  return {
    transcript: transcriptResult.data,
    documents: documentsResult.data
  };
};
```

### Generating a Document from Transcript

```typescript
const generateDocument = async (
  transcriptId: string,
  documentType: ''prd'' | ''user-stories'' | ''meeting-notes'',
  projectId: string
) => {
  // Fetch transcript
  const { data: transcript } = await supabase
    .from(''meeting_transcripts'')
    .select(''transcript_text'')
    .eq(''id'', transcriptId)
    .single();

  if (!transcript) {
    throw new Error(''Transcript not found'');
  }

  // Generate document via Edge Function
  const result = await generateDocumentAPI(
    documentType,
    transcript.transcript_text,
    projectId,
    transcriptId
  );

  return result;
};
```

## Related Documentation

- [Generated Documents](../24-generated-documents/gen-docs.md) - Document storage and retrieval
- [Document Generation Edge Functions](../08-document-generation/edge-functions.md) - AI document creation
- [AI Tracking](../10-ai-tracking/tracking.md) - Token usage and cost management
- [Database Views](../13-database-views/views.md) - view_meeting_with_transcript and related views
- [Project Context System](../06-project-context/context-system.md) - Project isolation patterns
', 'docs/23-meeting-transcripts/transcripts.md')
;

-- Verify insertion:
SELECT area, COUNT(*) FROM kb_documents GROUP BY area;