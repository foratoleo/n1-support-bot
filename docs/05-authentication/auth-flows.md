---
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
    navigate('/project-selector', { replace: true });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    if (errorMessage.includes('Invalid login credentials')) {
      setError(t('login.errors.invalidCredentials'));
    } else if (errorMessage.includes('Email not confirmed')) {
      setError(t('login.errors.emailNotConfirmed'));
    } else if (errorMessage.includes('Too many requests')) {
      setError(t('login.errors.tooManyRequests'));
    } else {
      setError(t('login.errors.genericError'));
    }
  } finally {
    setIsLoading(false);
  }
};
```

The `LoginForm` also persists the user's email address when "Remember me" is checked, storing it under the `rememberEmail` / `savedEmail` keys in localStorage.

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
    console.error('Logout failed:', error);
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
3. `AuthContext.forgotPassword()` calls `supabaseAuth.resetPasswordForEmail()`. This helper wraps `supabase.auth.resetPasswordForEmail(email, { redirectTo: '<origin>/reset-password' })`, sending Supabase a password-reset email to the given address with a link back to the application's reset-password route.
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

`AuthProvider`'s initial `getSession()` call restores the session from localStorage without a network round-trip, provided a non-expired token is present. If the token has expired, `getSession()` will attempt a silent refresh.

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
  '/project-selector',
  '/projects',
  '/products/create',
  '/team',
  '/profile',
  '/governance',
  '/privacy-policy',
  '/terms-of-service',
  '/admin',
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

After a successful login, `LoginForm` navigates to `/project-selector` (not directly to `/`). This ensures the user selects or creates a project before entering the main application, satisfying `ProtectedRoute`'s project-selection requirement.

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
2. Account was created but email was never confirmed. In Supabase Auth's default email confirmation mode, the account exists but `signInWithPassword` will fail with "Email not confirmed" if confirmation is pending. If the user sees "Invalid email or password" instead, it may mean the email confirmation was attempted but the link expired. Resolution: use the forgot-password flow to receive a new link.
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

1. The i18n configuration is not initialized. `useI18n` requires the i18n provider to be mounted. Check that `src/i18n/config` is imported in `App.tsx` (it is, as `import './i18n/config'`).
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
