# Findcon – Implementation Plan

## Goal Description
Add a fully functional authentication flow (login & register) with protected dashboard routes, fix existing router setup, and apply a premium dark‑mode theme with teal accent and glass‑morphism styling. Ensure the app is mobile‑responsive across all screen sizes.

## User Review Required
> [!IMPORTANT] 
> The plan introduces a new `AuthContext` for global auth state and uses the provided environment variables (`VITE_USER_API`, etc.) to communicate with the mock backend. Verify that a simple mock API is acceptable; if you have a real backend endpoint, please replace the URLs accordingly.

## Open Questions
> [!WARNING] 
> 1. **Email verification flow** – The mock backend does not send real emails. Should we simulate verification by showing the generated code on screen, or would you prefer to integrate an email‑service (e.g., SendGrid)?
> 2. **Password reset** – Do you need a password‑reset feature now?
> 3. **User profile picture storage** – The API expects a `profilepic` field. Should we upload to an external image host (e.g., imgbb) or store the URL directly from a file input?

## Proposed Changes
---
### Package.json
Add `react-router-dom` (v6) as a dependency.

### src/App.jsx
- Wrap the app with `<BrowserRouter>`.
- Define `<Routes>` for `/login`, `/register`, `/dashboard`, `/home`, `/matches`, `/messages`, `/search`.
- Use a `<ProtectedRoute>` component to guard dashboard‑related routes.

### src/pages/Login.jsx
- Form with email & password fields.
- Client‑side validation (password ≥ 6 chars).
- On submit, `GET` the user list from `VITE_USER_API` and verify credentials.
- Store auth token (simple user object) in `AuthContext` and redirect to `/dashboard`.

### src/pages/Register.jsx
- Form fields: email, password, confirm password, optional profile picture upload.
- Generate a 6‑digit verification code displayed in UI (simulated email).
- Require user to enter the code before enabling the final **Register** button.
- `POST` new user object to `VITE_USER_API`.
- Upon success, log the user in and redirect to `/dashboard`.

### src/components/ProtectedRoute.jsx
```tsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};
```

### src/context/AuthContext.jsx
Create a React context to hold `user`, `login`, `logout` functions and expose via `useAuth` hook.
Persist user in `localStorage` for page reloads.

### Styling (src/index.css)
- Dark background: `hsl(220, 10%, 10%)`.
- Teal accent: `hsl(170, 70%, 45%)`.
- Glass‑morphism cards: `background: rgba(255,255,255,0.08); backdrop-filter: blur(10px); border-radius: 12px;`.
- Global CSS variables for colors and transition effects.
- Media queries for mobile (`max‑width: 600px`) to stack navigation, use full‑width inputs, etc.
- Add smooth hover animations for buttons and nav items.

### src/components/BottomNav.jsx (existing)
Update to use `<NavLink>` from `react-router-dom` and apply the new theme classes.

### src/pages/Dashboard.jsx (existing)
Wrap the content in a glass‑morphism container and ensure it uses the dark theme colors.

### Environment Variables
Ensure `.env` is loaded via Vite (`import.meta.env.VITE_USER_API`). No code changes needed beyond using those variables.

## Verification Plan
- **Automated**: Run `npm run dev`, navigate to `/register`, complete the simulated verification, create a user, then log in via `/login` and access `/dashboard`.
- **Responsive Test**: Open Chrome devtools, toggle device toolbar for mobile sizes (iPhone X, Galaxy S9) and verify layout.
- **Theme Check**: Confirm dark background, teal accents, and glass‑morphism cards are rendered.
- **Protected Route**: Attempt to access `/dashboard` without login – should redirect to `/login`.

---
*Please review the open questions and confirm the authentication approach and any preferences for email verification or image upload.*
