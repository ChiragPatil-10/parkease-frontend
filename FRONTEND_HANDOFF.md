# ParkEase Frontend — Development Handoff

Audit date basis: repository state at commit `404f9f1` (`Merge pull request #7 from ChiragPatil-10/feature/manager-create-edit-lot`), branch `develop`. This document was produced by reading the actual source files, `docs/api/*.md`, `package.json`, `angular.json`, and `git log` — nothing here is assumed or idealized. Anything not directly confirmable from the code is marked `NEEDS VERIFICATION`.

---

# EXECUTIVE SUMMARY

**What is already built:** A working Angular 22 standalone app with JWT-based login/registration for two roles (Driver, Manager), an Admin approval workflow for manager applications and lots, and a full Manager "lots" CRUD slice (list, create, edit) integrated against a real backend (`ParkEase.Auth` and `ParkEase.ParkingLot` services via a YARP Gateway). 8 of 12 page folders are fully implemented (UI + API + tests); 4 are one-line placeholder stubs.

**What is working (end-to-end, against real endpoints):**
- Driver registration → auto-login → redirect to `/lots`.
- Manager registration → pending-application screen (no token issued, matches backend behavior).
- Login (Driver/Manager) with role-based redirect; Admin login succeeds but has nowhere to redirect to (explicit in-app notice).
- Admin: paginated review of pending manager applications (approve/reject) and pending lots (approve only — reject is disabled in the UI).
- Manager: My Lots dashboard (list, status pills, submitted-time), Create Lot, Edit Lot, full client + server-side validation, error mapping.

**What is partially working:** Admin's lot-approval screen can approve but not reject a lot (button is present but `disabled`). The `AdminNav` header shows 4 tabs ("Users", "Manager Applications", "Lot Approvals", "All Lots") but only 2 are real/clickable — "Users" and "All Lots" are static, non-interactive labels with no route behind them.

**What is missing:**
- No Driver-facing functionality beyond the login redirect — `/lots` is a one-line "coming soon" stub with **no page shell, no nav, no logout, no way to navigate anywhere else**.
- No logout anywhere in the app (see Dead Ends). No password reset, no Google OAuth (both present as visibly disabled/inert UI on the Login page). No Sign-up link from Login actually works (`href="#"`, not wired to a route — this is a bug, not a "coming soon").
- No Admin "Users" management page, no Admin "All Lots" page, despite both having documented backend endpoints (`GET /api/v1/auth/users`, `GET /api/v1/lots/all`) and nav placeholders.
- Nothing exists yet for Spot, Vehicle, Booking, Payment, or Notification services — no frontend code, no `docs/api/*.md` files for them either.

**Where the application currently stops:** The single deepest, fully-connected, multi-page flow in the app is: **Register Manager → (admin approves, out of band) → Manager logs in → My Lots dashboard → Create/Edit a lot → back to dashboard**. Every step in that chain hits a real backend endpoint and handles loading/error/empty states. Nothing past that exists — there is no Spots management, no booking, no payment, and the Driver role has no functional page at all.

**What should be built next:** See §19. Short version: P0 fix the broken Login "Sign up" link; P1 build a real Driver "Nearby Lots" page (the Driver role currently has zero functionality) and/or the Manager "Spots" page (the natural next step after lot creation — a lot with `totalSpots` but no way to define individual spots is a dead end for the lot's actual purpose); P2 logout, Admin Users/All-Lots pages, lot-rejection.

---

# 1. PROJECT OVERVIEW

| Item | Value | Source |
|---|---|---|
| Project name | `parkease-frontend` (package.json `name`); app title in browser tab is the CLI default `ParkeaseFrontend` — never customized | `package.json`, `src/index.html` |
| Framework | Angular, standalone-components architecture (no `NgModule`), new `@angular/build:application` esbuild-based builder | `angular.json`, every `@Component` |
| Framework version | `^22.1.0` (core/common/compiler/forms/platform-browser/router), CLI `^22.1.3` | `package.json` |
| Language | TypeScript `~6.0.2` | `package.json` |
| UI libraries | None (no Angular Material, PrimeNG, etc.) — every page is hand-built with Tailwind utility classes | grep across `src/app` |
| CSS/styling | Tailwind CSS v4 (`@tailwindcss/postcss` + `tailwindcss` devDependencies), imported once via `@import 'tailwindcss'` in `src/styles.css`. A small custom design-token layer sits on top: `@theme { --color-surface, --color-card, --color-accent, --color-accent-hover, --color-ink, --color-muted, --color-border, --color-link }` | `src/styles.css` |
| State management | No NgRx / Akita / signal-store library. Local component state via Angular `signal()`/`computed()`. Session persisted directly to `localStorage` (key `parkease.session`) by `AuthService`, not through any state-management layer | `src/app/services/auth.service.ts` |
| Routing | `@angular/router`, one flat `Routes` array (`src/app/app.routes.ts`), functional `CanActivateFn` guards | `src/app/app.routes.ts` |
| HTTP/API approach | Single generic wrapper `ApiService` (`get/post/put/patch/delete`) over `HttpClient`; every response typed `ApiResponse<T>` (`{success, message, data, errors}`); one functional `HttpInterceptorFn` (`authInterceptor`) attaches `Authorization: Bearer <token>` from the stored session to every outgoing request (unconditionally, not scoped to protected endpoints) | `src/app/services/api.service.ts`, `src/app/core/interceptors/auth.interceptor.ts` |
| Authentication approach | Backend-issued JWT access token + opaque refresh token, both returned in one `AuthResponse` and stored together (as one JSON blob) in `localStorage["parkease.session"]`. **No refresh-token flow is implemented on the frontend** — a 401 just clears the session and redirects to `/login`; `POST /api/v1/auth/refresh` (documented in `auth.md`) is never called from the frontend | `src/app/services/auth.service.ts`, grep for `refresh` |
| Important dependencies | `@angular/forms` — specifically its newer **Signal Forms** API (`@angular/forms/signals`: `form()`, `FormField`, `FormRoot`, `submit()`, validators like `required`/`email`/`min`/`max`/`minLength`/`maxLength`/`validate`) used by **every** form in the app; `rxjs` (`firstValueFrom` to bridge Observables → async/await); `vitest` + `jsdom` for tests | `package.json`, every form page |
| Build/dev commands | `npm start` → `ng serve` (dev config, port default 4200); `npm run build` → `ng build` (prod config by default, `fileReplacements` swaps `environment.ts` → `environment.production.ts`); `npm run watch` → `ng build --watch --configuration development`; `npm test` → `ng test` (runs `@angular/build:unit-test`, which is Vitest under the hood, **not** Karma/Jasmine) | `package.json`, `angular.json` |
| Linting | No ESLint (or any lint) config/dependency found anywhere in the repo | `NEEDS VERIFICATION` — confirmed absent from `package.json` devDependencies and no `.eslintrc*`/`eslint.config.*` file exists |
| E2E testing | None configured (no Cypress/Playwright/Protractor dependency) | `package.json` |

---

# 2. ACTUAL PROJECT STRUCTURE

```
parkease_frontend/
├── docs/api/                        # Hand-maintained backend API reference (Markdown), read before each Phase 2
│   ├── auth.md                      # Auth service: register/login/refresh/logout/profile/admin user+application endpoints
│   ├── gateway.md                   # Cross-cutting conventions: envelope shape, auth scheme, rate limits, routing table
│   └── parkinglot-service.md        # ParkingLot service: lot CRUD, search, nearby, approve — NOTE: CLAUDE.md calls this
│                                     # file "parkinglot.md"; the actual filename on disk differs.
│   # NOT present yet: spot.md, vehicle.md, booking.md, payment.md, notification.md — those backend
│   # services have no documented contract in this repo yet.
│
├── design/                          # Reference screenshots used to build each page (e.g. manager-create-edit-lot.png)
├── src/
│   ├── index.html                   # Shell HTML; <title>ParkeaseFrontend</title> is the unedited CLI default
│   ├── main.ts                      # bootstrapApplication(App, appConfig)
│   ├── styles.css                   # Tailwind import + the app's only design-token definitions (@theme block)
│   │
│   ├── environments/
│   │   ├── environment.ts               # apiBaseUrl: 'http://localhost:5000', production: false
│   │   └── environment.production.ts    # apiBaseUrl: 'http://localhost:5000', production: true — SAME url as dev
│   │                                     # (NEEDS VERIFICATION: likely a placeholder never updated for a real deploy)
│   │
│   └── app/
│       ├── app.ts / app.html / app.css / app.spec.ts   # Root shell — app.html is just `<router-outlet />`
│       ├── app.config.ts            # providers: provideRouter(routes), provideHttpClient(withInterceptors([authInterceptor]))
│       ├── app.routes.ts            # The entire route table — one flat array, no lazy loading, no child routes
│       │
│       ├── core/                    # App-wide, feature-agnostic infra only
│       │   ├── guards/
│       │   │   ├── auth.guard.ts        # authGuard: requires a session, else redirect to '/'
│       │   │   └── role.guard.ts        # roleGuard(...roles): requires session AND role match, else '/' or '/403'
│       │   └── interceptors/
│       │       └── auth.interceptor.ts  # attaches Bearer token from session to every request
│       │
│       ├── constants/                # One file per backend domain, route-path string constants only
│       │   ├── auth.constants.ts        # AUTH_API.* (login, registerDriver, registerManager, userById, manager-applications, approve/reject)
│       │   └── parkinglot.constants.ts  # PARKINGLOT_API.* (pending, approve, byManager, create, byId)
│       │
│       ├── models/                   # Flat top-level + per-domain subfolders (no domain-spanning "types" dump file)
│       │   ├── api-response.model.ts    # ApiResponse<T> = {success, message, data, errors}
│       │   ├── paged-response.model.ts  # PagedResponse<T> = {items, totalCount, page, pageSize, totalPages}
│       │   ├── lot.model.ts             # LotResponse, ApproveLotRequest, LotRequest
│       │   └── auth/
│       │       ├── auth.model.ts            # LoginRequest, RegisterDriverRequest, RegisterManagerRequest, AuthResponse, ManagerApplicationDto
│       │       ├── user.model.ts            # AuthUser
│       │       ├── user-role.enum.ts        # UserRole: Driver | Manager | Admin
│       │       ├── application-status.enum.ts  # ApplicationStatus: Pending | Approved | Rejected
│       │       └── user-summary.model.ts    # UserSummaryDto (used only by admin-approval-queue's manager-name lookup)
│       │
│       ├── services/                 # Flat, one Angular service per domain, all built on ApiService
│       │   ├── api.service.ts           # Generic HttpClient wrapper — the ONLY thing that talks to HttpClient directly
│       │   ├── auth.service.ts          # login, registerDriver, registerManager, getUserById, getManagerApplications,
│       │   │                            # approveManagerApplication, rejectManagerApplication, resolvePostAuthRoute,
│       │   │                            # saveSession/getSession/getCurrentUser/clearSession (localStorage)
│       │   └── parkinglot.service.ts    # getPendingLots, getLotsByManager, getLotById, createLot, updateLot, approveLot
│       │
│       ├── shared/
│       │   ├── components/
│       │   │   ├── manager-nav/         # Top nav for all /manager/* pages — 4 tabs, ALL are real routerLinks
│       │   │   ├── admin-nav/           # Top nav for /admin/* pages — 4 tabs, but rendered as inert <span>s (NOT routerLinks)
│       │   │   └── pagination-controls/ # Dumb prev/next pager, input page+totalPages, output pageChange
│       │   └── pipes/
│       │       └── paginate.pipe.ts     # Client-side array slicing by page — used only for the lot-approvals list
│       │
│       └── pages/                     # One folder per page/screen — see §6 for full per-page detail
│           ├── login/                       # 4-file, Phase 1+2 done
│           ├── register-driver/             # 4-file, Phase 1+2 done
│           ├── register-manager/            # 4-file, Phase 1+2 done
│           ├── manager-application-submitted/ # 4-file, Phase 1+2 done (display-only, no API of its own)
│           ├── admin-approval-queue/        # 4-file, Phase 1+2 done
│           ├── manager-lots/                # 4-file, Phase 1+2 done (the Manager's "My Lots" dashboard)
│           ├── manager-lot-form/            # 4-file, Phase 1+2 done (shared create+edit form)
│           ├── forbidden/                   # 1-file inline-template ("403" page) — simple by design, not a stub
│           ├── driver-lots/                 # 1-file inline-template STUB ("Nearby Lots — coming soon.")
│           ├── manager-spots/               # 1-file inline-template STUB ("Spots — coming soon.")
│           ├── manager-lot-bookings/        # 1-file inline-template STUB ("Lot Bookings — coming soon.")
│           └── manager-applications/        # 1-file inline-template STUB ("Applications — coming soon.")
```

---

# 3. ROUTE AUDIT

All routes are declared in one flat array in `src/app/app.routes.ts`. There is no lazy loading and no nested/child route usage anywhere.

---
Route: `/`
Component: `Login`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: Same component as `/login` (two paths, one component). Role-based post-login redirect (see §11).

---
Route: `/login`
Component: `Login`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: Duplicate of `/`.

---
Route: `/register`
Component: `RegisterDriver`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: On success, saves session and redirects per role (effectively always Driver → `/lots`, since this endpoint only creates Drivers).

---
Route: `/register-manager`
Component: `RegisterManager`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: On success, does **not** save a session (backend doesn't issue one — account is inactive pending approval); navigates to `/register-manager/submitted` passing `{fullName, businessName, status, applicationId}` via router state.

---
Route: `/register-manager/submitted`
Component: `ManagerApplicationSubmitted`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: Reads its data from `router.getCurrentNavigation()?.extras.state`. If landed on directly (no state, e.g. a refresh or manually typed URL), falls back to a generic "check your email" message — does not fetch the application by id.

---
Route: `/lots`
Component: `DriverLots`
Access: `Authenticated (any role — no roleGuard applied)`
Guard: `authGuard`
Current Status: `NOT IMPLEMENTED`
Notes: One-line inline-template stub: `"Nearby Lots — coming soon."`. No nav/header component, no way to navigate elsewhere from this page, no logout. This is the Driver role's **only** route besides the public auth pages.

---
Route: `/manager/lots`
Component: `ManagerLots`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `COMPLETE`
Notes: The Manager's dashboard/home. Fetches `GET /api/v1/lots/manager/{managerId}`. Also reads an optional `history.state.errorMessage` (set by `manager-lot-form`'s 401/404 redirects) and shows it as a banner.

---
Route: `/manager/lots/new`
Component: `ManagerLotForm`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `COMPLETE`
Notes: Create mode (no `:id` param). `POST /api/v1/lots`.

---
Route: `/manager/lots/:id/edit`
Component: `ManagerLotForm`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `COMPLETE`
Notes: Edit mode. `id` route param drives `GET/PUT /api/v1/lots/{id}`.

---
Route: `/manager/spots`
Component: `ManagerSpots`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `NOT IMPLEMENTED`
Notes: One-line inline-template stub: `"Spots — coming soon."`. Linked from `ManagerNav`'s "Spots" tab, which IS a real, working `routerLink` — the destination is just not built yet.

---
Route: `/manager/lot-bookings`
Component: `ManagerLotBookings`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `NOT IMPLEMENTED`
Notes: One-line inline-template stub: `"Lot Bookings — coming soon."`. Linked from `ManagerNav`'s "Lot Bookings" tab (working link, unbuilt destination).

---
Route: `/manager/applications`
Component: `ManagerApplications`
Access: `Manager`
Guard: `authGuard, roleGuard(UserRole.Manager)`
Current Status: `NOT IMPLEMENTED`
Notes: One-line inline-template stub: `"Applications — coming soon."`. Linked from `ManagerNav`'s "Applications" tab (working link, unbuilt destination). Name is ambiguous — `NEEDS VERIFICATION` what this page is meant to show (a manager's own driver-facing lot applications? staffing applications? not specified anywhere in code or docs).

---
Route: `/admin/approvals`
Component: `AdminApprovalQueue`
Access: `Admin`
Guard: `authGuard, roleGuard(UserRole.Admin)`
Current Status: `COMPLETE` (for the two sub-tabs it implements — see §6 for the lot-rejection caveat)
Notes: Internal sub-tab state (`manager-applications` / `lot-approvals`) is component-local, not reflected in the URL (no query param, no child route) — refreshing the page always resets to the `manager-applications` sub-tab.

---
Route: `/403`
Component: `Forbidden`
Access: `Public`
Guard: none
Current Status: `COMPLETE`
Notes: Static "Access denied" page with a link back to `/`.

---
**Routes referenced by UI but that do not exist:** none found — every `routerLink`/`router.navigate` target in the codebase resolves to a route declared in `app.routes.ts`. (The `AdminNav`'s "Users" and "All Lots" tabs are inert `<span>`s with no `routerLink` at all, so they don't constitute broken navigation — they just do nothing. See §5.)

---

# 4. TRACE NAVIGATION FROM THE ACTUAL CODE

**Login → Driver**
```
Login (/  or /login)
↓ submit valid Driver credentials
↓ Login.loginForm submission action → AuthService.login() → POST /api/v1/auth/login
↓ on success: AuthService.saveSession(auth); AuthService.resolvePostAuthRoute('Driver') → '/lots'
↓ router.navigateByUrl('/lots')
DriverLots (/lots)
→ "Nearby Lots — coming soon." — dead end, no further navigation possible from this page
```

**Login → Manager**
```
Login
↓ submit valid Manager credentials
↓ same flow, resolvePostAuthRoute('Manager') → '/manager/lots'
ManagerLots (/manager/lots)
→ ngOnInit → ParkingLotService.getLotsByManager(managerId) → GET /api/v1/lots/manager/{managerId}
→ renders lot cards with status pill (Open/Closed/Awaiting approval)
→ Click "+ Add new lot" → routerLink '/manager/lots/new' → ManagerLotForm (create mode)
→ Click a lot's "Edit" → [routerLink]="['/manager/lots', lot.lotId, 'edit']" → ManagerLotForm (edit mode)
```

**Login → Admin**
```
Login
↓ submit valid Admin credentials
↓ resolvePostAuthRoute('Admin') → null
↓ Login.handleSuccess: adminNotice.set(true) — NO navigation happens
Login page (still on /login or /)
→ shows inline blue notice: "Admin accounts aren't supported in this app yet."
→ session IS saved to localStorage even though there's no redirect (NEEDS VERIFICATION whether this is
   intentional — an Admin who then manually navigates to /admin/approvals would pass authGuard+roleGuard
   and land there successfully, since the session and role are valid)
```

**Manager — Create Lot round trip**
```
ManagerLots
↓ click "+ Add new lot" (routerLink)
ManagerLotForm (create mode, /manager/lots/new)
↓ fill form, client-side validation (required fields, address ≥10 chars, maxPrice ≥ minPrice, totalSpots > 0)
↓ submit → lotForm submission action → ParkingLotService.createLot() → POST /api/v1/lots
↓ on success (response.data present): router.navigateByUrl('/manager/lots')
ManagerLots
→ re-fetches nothing automatically — NEEDS VERIFICATION: does the dashboard reload its list on this
   navigation? ManagerLots.ngOnInit() calls loadLots() on every component construction, and navigating
   back to '/manager/lots' from a different route DOES reconstruct the component (different route path
   was active), so the list WILL refresh and show the new lot. Confirmed by reading ManagerLots.ngOnInit.
```

**Manager — Edit Lot round trip**
```
ManagerLots
↓ click a lot's "Edit" (routerLink with lot.lotId)
ManagerLotForm (edit mode, /manager/lots/:id/edit)
↓ ngOnInit → loadLot() → ParkingLotService.getLotById(id) → GET /api/v1/lots/{id} → pre-fills form
↓ edit fields, submit → ParkingLotService.updateLot(id, body) → PUT /api/v1/lots/{id} (full body, not a patch)
↓ on success: router.navigateByUrl('/manager/lots')
↓ on 401 or 404 during load OR submit: router.navigate(['/manager/lots'], {state:{errorMessage: ...}})
ManagerLots
→ reads history.state.errorMessage in ngOnInit, shows it as a red banner above the list
```

**Admin — Manager application review**
```
AdminApprovalQueue (/admin/approvals, defaults to 'manager-applications' sub-tab)
↓ ngOnInit → loadApplications(1) → AuthService.getManagerApplications(1, 10, 'Pending') →
   GET /api/v1/admin/manager-applications?status=Pending&page=1&pageSize=10
↓ click "Approve" → AuthService.approveManagerApplication(id) → PUT /api/v1/admin/approve-manager/{id}
   → on success: successMessage set, list reloaded (same page)
↓ click "Reject" → AuthService.rejectManagerApplication(id) → PUT /api/v1/admin/reject-manager/{id}
   (feedback textarea in the template is NOT bound to any (input) handler or signal — see §5, it's
   pure decoration; the reject call always sends an empty body, never includes the typed feedback text)
↓ pagination via <app-pagination-controls> → changeApplicationsPage(page) → loadApplications(page)
```

**Admin — Lot approval review**
```
AdminApprovalQueue, click "Lot approvals" sub-tab (component-local state change, no navigation)
↓ selectSubTab('lot-approvals') → first time only: loadPendingLots() → ParkingLotService.getPendingLots()
   → GET /api/v1/lots/pending
↓ click "Approve" → ParkingLotService.approveLot(lotId, feedbackDraft) → PUT /api/v1/lots/{id}/approve
   (feedback textarea here IS wired — (input) updates lotFeedbackDrafts signal, sent as {feedback} in the body)
↓ click "Reject" → button is `disabled`, `title="Rejecting lots isn't supported yet"` — does nothing
↓ pagination here is CLIENT-SIDE ONLY via the `paginate` pipe over the full fetched array (no server paging
   params sent to GET /pending, unlike the manager-applications sub-tab which IS server-paged)
```

---

# DEAD ENDS

**Starting page:** Login (`/`, `/login`)
**User action:** Click "Forgot password?"
**Current behavior:** `(click)="$event.preventDefault()"`, `title="Coming soon"` — link is visually present but inert by design.
**Where it stops:** Right there; no route, no handler beyond `preventDefault()`.
**Reason:** Feature not built.
**What appears to be missing:** A password-reset flow and its backend endpoint (not documented in `docs/api/auth.md` either — no `/forgot-password` or `/reset-password` route exists on the backend per the docs read).

---

**Starting page:** Login
**User action:** Click "Continue with Google"
**Current behavior:** Plain `<button type="button" title="Coming soon">` with **no click handler at all** (not even a `preventDefault` no-op).
**Where it stops:** Immediately; nothing happens on click.
**Reason:** Feature not built on the frontend, even though the backend already documents `POST /api/v1/auth/oauth/google` in `auth.md`.
**What appears to be missing:** OAuth redirect/popup flow, an `AuthService.loginWithGoogle()`-style method (does not exist — confirmed by reading `auth.service.ts` in full).

---

**Starting page:** Login
**User action:** Click "Sign up"
**Current behavior:** `<a href="#" class="text-link hover:underline">Sign up</a>` — a real anchor tag pointing at `#`, not a `routerLink`.
**Where it stops:** Clicking it just jumps to the top of the current page; it does **not** navigate to `/register` or `/register-manager`.
**Reason:** This looks like an oversight, not an intentional stub — unlike "Forgot password?" and "Continue with Google", it has no `title="Coming soon"` and both registration pages already exist and work. This is the one dead end in the app that reads as a bug rather than an unbuilt feature.
**What appears to be missing:** Either a `routerLink` to one of the two registration routes, or (more likely, since there are two registration flows — Driver and Manager) a small chooser/menu, since a single link can't unambiguously target both `/register` and `/register-manager`.

---

**Starting page:** Any `/manager/*` page (via `ManagerNav`)
**User action:** Click "Spots"
**Current behavior:** Navigates successfully (real `routerLink="/manager/spots"`) to `ManagerSpots`.
**Where it stops:** `"Spots — coming soon."` — a single centered paragraph, no header/nav even (the stub does not render `<app-manager-nav>`, so from here the user cannot navigate onward at all without using the browser back button).
**Reason:** Page not yet built (Phase 1 not started).
**What appears to be missing:** Everything — screenshot/design, static UI, and API integration. This is also the most logically important missing page: lots have a `totalSpots` number but there is currently no way for a manager to define/manage the individual spots within a lot.

---

**Starting page:** Any `/manager/*` page (via `ManagerNav`)
**User action:** Click "Lot Bookings"
**Current behavior:** Navigates successfully to `ManagerLotBookings`.
**Where it stops:** `"Lot Bookings — coming soon."` — same bare stub, no nav rendered.
**Reason:** Not built.
**What appears to be missing:** Everything; also depends on a Booking service/API that doesn't exist in `docs/api/` yet.

---

**Starting page:** Any `/manager/*` page (via `ManagerNav`)
**User action:** Click "Applications"
**Current behavior:** Navigates successfully to `ManagerApplications`.
**Where it stops:** `"Applications — coming soon."` — same bare stub, no nav rendered.
**Reason:** Not built. Purpose of this page is itself ambiguous from the code (`NEEDS VERIFICATION`).
**What appears to be missing:** Everything, plus a product-level clarification of what this page is even meant to show.

---

**Starting page:** `AdminApprovalQueue` header (`AdminNav`)
**User action:** Click "Users"
**Current behavior:** `AdminNav` renders this tab as a plain `<span>` with no `(click)` handler and no `routerLink` — it is not a functional element at all, just a static label that highlights only when `activeTab() === 'users'` (which never happens, since no page ever passes that value).
**Where it stops:** Nothing happens; it isn't even a clickable target.
**Reason:** `GET /api/v1/auth/users` (list) and the per-user suspend/reactivate/delete admin endpoints are fully documented in `auth.md`, but there is no `getUsers()`/`suspendUser()`/etc. method anywhere in `AuthService`, and no route/page for it.
**What appears to be missing:** A whole Admin "Users" page + the corresponding `AuthService` methods.

---

**Starting page:** `AdminApprovalQueue` header (`AdminNav`)
**User action:** Click "All Lots"
**Current behavior:** Same as "Users" — inert `<span>`, no handler, no route.
**Where it stops:** Nothing happens.
**Reason:** `GET /api/v1/lots/all` (paged, Admin-only) is documented in `parkinglot-service.md`, but `ParkingLotService` has no method for it.
**What appears to be missing:** An Admin "All Lots" page + a `getAllLots()`-style method on `ParkingLotService`.

---

**Starting page:** `AdminApprovalQueue`, "Lot approvals" sub-tab
**User action:** Click "Reject" on a pending lot
**Current behavior:** `<button disabled title="Rejecting lots isn't supported yet">` — visibly present, permanently disabled.
**Where it stops:** Cannot be clicked at all.
**Reason:** `parkinglot-service.md` documents no lot-rejection endpoint at all (only `PUT /api/v1/lots/{id}/approve` exists) — this looks like an intentional stub reflecting a real backend gap, not a frontend oversight.
**What appears to be missing:** A backend "reject lot" endpoint, then the corresponding frontend wiring.

---

**Starting page:** `AdminApprovalQueue`, "Manager applications" sub-tab
**User action:** Type text into the per-application feedback `<textarea>`, then click "Reject"
**Current behavior:** The textarea has no `[value]`/`(input)` binding at all (compare with the lot-approvals textarea, which does bind to `lotFeedbackDrafts`) — anything typed is pure DOM state that vanishes on the next change detection cycle and is **never read** by `rejectApplication()`, which calls `AuthService.rejectManagerApplication(applicationId)` with no body/feedback argument at all.
**Where it stops:** The typed feedback text is silently discarded; the reject call still succeeds against the backend, just without the feedback.
**Reason:** Looks like an incomplete wiring — the lot-approval feedback path was built correctly but the manager-application one was not (or the backend's `PUT /api/v1/admin/reject-manager/{id}` doesn't actually accept a feedback body — `NEEDS VERIFICATION` against `auth.md`, which documents this endpoint as taking **no request body** at all, so the textarea may simply be dead UI copy-pasted from the lot-approval layout without a real backend field to send it to).
**What appears to be missing:** Either wire the textarea to state and confirm the backend endpoint accepts feedback, or remove the textarea if the backend genuinely has nowhere to put it.

---

**Starting page:** Any authenticated page (Driver/Manager/Admin)
**User action:** Look for a way to log out
**Current behavior:** No logout button/link exists anywhere in the entire codebase. `AuthService.clearSession()` exists and is called, but only internally, only in response to a `401` from a failed API call (in `manager-lots.ts` and `admin-approval-queue.ts`) — never from a user-initiated click.
**Where it stops:** A user can only end their session by manually clearing browser storage or waiting for a `401` to occur naturally.
**Reason:** Feature not built.
**What appears to be missing:** A logout button (and ideally a call to `POST /api/v1/auth/logout`, which is documented in `auth.md` and takes the refresh token — `AuthService` has no method for this endpoint either).

---

**Starting page:** `DriverLots` (`/lots`)
**User action:** Anything — this is the Driver role's only page
**Current behavior:** Renders one centered paragraph, `"Nearby Lots — coming soon."` No header, no nav, no logout, no links.
**Where it stops:** Immediately. This is a complete dead end for the entire Driver role.
**Reason:** Not built (Phase 1 not started for this page).
**What appears to be missing:** Everything — this is the most significant gap in the app, since Driver is one of only two roles that can self-register, and after doing so has literally nothing to do.

---

# 6. PAGE-BY-PAGE AUDIT

### Page: Login
Route: `/`, `/login`
Purpose: Authenticate an existing user (Driver or Manager; Admin login succeeds but has no destination).
UI implemented: YES
Functional logic: Signal-forms validation (email format, password required); submit action; role-based redirect via `AuthService.resolvePostAuthRoute`.
API integration: `POST /api/v1/auth/login` via `AuthService.login()`.
Navigation: On success → `/lots` (Driver) or `/manager/lots` (Manager); Admin → stays on page, shows notice. "Sign up" link is broken (`href="#"`, see Dead Ends).
Buttons/actions: Submit ("Log in"), "Forgot password?" (inert), "Continue with Google" (inert), "Sign up" (broken).
Forms: One form — email + password.
Loading state: Submit button text changes to "Logging in…" and is `disabled` while `loginForm().submitting()`.
Error state: `serverError` signal shown in a red banner; specific 429 message; falls back to backend `message` otherwise.
Empty state: N/A.
Mock/hardcoded data: None.
Current status: ✅ COMPLETE (as an auth entry point) / ⚠️ NEEDS VERIFICATION for the Admin no-redirect behavior being the intended final design vs. a temporary placeholder.

---

### Page: Register Driver
Route: `/register`
Purpose: Self-service Driver account creation.
UI implemented: YES
Functional logic: Signal-forms validation (full name, email, password complexity regex, optional phone pattern).
API integration: `POST /api/v1/auth/register/driver` via `AuthService.registerDriver()`.
Navigation: On success → session saved, redirected via `resolvePostAuthRoute('Driver')` → `/lots`. "Already have an account? Log in" → `routerLink="/"` (works).
Buttons/actions: Submit ("Create account").
Forms: fullName, email, password, phone (optional).
Loading state: Button text → "Creating account…", disabled while submitting.
Error state: 429-specific message; 409 (duplicate email) and 422 (validation) both surface the backend's top-level `message` directly (no per-field mapping on this page).
Empty state: N/A.
Mock/hardcoded data: None.
Current status: ✅ COMPLETE.

---

### Page: Register Manager
Route: `/register-manager`
Purpose: Manager application intake (creates an inactive account pending Admin approval).
UI implemented: YES
Functional logic: Signal-forms validation (fullName, email, password, phone **required** here — unlike driver's optional phone —, businessName, parkingAddress).
API integration: `POST /api/v1/auth/register/manager` via `AuthService.registerManager()`.
Navigation: On success → `/register-manager/submitted`, passing the returned `ManagerApplicationDto` fields via router state. "Already registered? Log in" → `routerLink="/"`.
Buttons/actions: Submit ("Submit application").
Forms: fullName, email, password, phone, businessName, parkingAddress.
Loading state: Button text → "Submitting…".
Error state: 429, 409, 422 — same generic top-level-message pattern as Register Driver.
Empty state: N/A.
Mock/hardcoded data: None.
Current status: ✅ COMPLETE.

---

### Page: Manager Application Submitted
Route: `/register-manager/submitted`
Purpose: Confirmation screen after a manager application is filed.
UI implemented: YES
Functional logic: Reads `router.getCurrentNavigation()?.extras.state`; falls back to a generic message if state is absent (e.g. direct URL visit).
API integration: None (pure display).
Navigation: "Back to log in" → `routerLink="/login"`.
Buttons/actions: One link, no buttons.
Forms: None.
Loading state: N/A.
Error state: N/A (silently degrades to generic copy if no state).
Empty state: The "no state" fallback case, described above.
Mock/hardcoded data: None.
Current status: ✅ COMPLETE.

---

### Page: Manager — My Lots (Dashboard)
Route: `/manager/lots`
Purpose: Manager's home page — list their lots with status, entry point to create/edit.
UI implemented: YES
Functional logic: Status derivation (`open`/`closed`/`awaiting-approval` from `isApproved`+`isOpen`), relative time formatting for submitted lots.
API integration: `GET /api/v1/lots/manager/{managerId}` via `ParkingLotService.getLotsByManager()`.
Navigation: "+ Add new lot" → `/manager/lots/new`; per-lot "Edit" → `/manager/lots/{lotId}/edit`. Both verified as real, correctly-parameterized `routerLink`s.
Buttons/actions: "+ Add new lot", "Edit" (per lot). No delete/toggle-open action exists on this page even though `ParkingLotService` has no `deleteLot`/`toggleOpen` methods either (backend has `DELETE /api/v1/lots/{id}` and `PUT /api/v1/lots/{id}/toggle-open` documented but unused).
Forms: None (list page).
Loading state: "Loading your lots…" text.
Error state: Red banner; specific 401 handling (clears session, redirects to `/login`); plus a separate `redirectError` banner for messages arriving via router state from the lot form's redirect-with-error flow.
Empty state: "You haven't added any lots yet."
Mock/hardcoded data: None.
Current status: ✅ COMPLETE.

---

### Page: Manager — Create/Edit Lot
Route: `/manager/lots/new`, `/manager/lots/:id/edit`
Purpose: Single form component handling both lot creation and editing.
UI implemented: YES
Functional logic: Signal-forms validation including a custom cross-field `validate()` (max price ≥ min price, reactive to both fields), `min()`/`required()`/`minLength()`/`maxLength()` for the rest. Mode determined by presence of the `:id` route param.
API integration: `GET /api/v1/lots/{id}` (edit, on load), `POST /api/v1/lots` (create), `PUT /api/v1/lots/{id}` (edit, full-object).
Navigation: Submit success → `/manager/lots`. Cancel button → `/manager/lots`. 401/404 during load or submit (edit only) → `/manager/lots` with an error message via router state.
Buttons/actions: "Save lot" (submit), "Cancel".
Forms: name, address, city, totalSpots, minPricePerHour, maxPricePerHour, openTime, closeTime, description (optional).
Loading state: "Loading lot details…" (edit mode, while fetching).
Error state: Per-field messages from client validation; 422 server errors mapped onto the matching field (case-insensitive key match against the documented-but-unconfirmed PascalCase casing); 409/other errors shown as a top-level `serverError` banner using the backend's message directly; `loadError` shown inline for non-401/404 load failures.
Empty state: N/A (create mode starts with an empty model).
Mock/hardcoded data: None (Phase 1's earlier hardcoded mock data was fully replaced in Phase 2).
Current status: ✅ COMPLETE.

---

### Page: Admin Approval Queue
Route: `/admin/approvals`
Purpose: Admin review surface for pending manager applications and pending lots.
UI implemented: YES
Functional logic: Two internal sub-tabs (component state, not URL-driven); manager-name resolution for lots (batched, deduped lookups via `getUserById`); relative-time formatting.
API integration: `GET /api/v1/admin/manager-applications` (server-paged), `PUT .../approve-manager/{id}`, `PUT .../reject-manager/{id}`, `GET /api/v1/lots/pending` (fetched once, then paged **client-side** via the `paginate` pipe), `PUT /api/v1/lots/{id}/approve`, `GET /api/v1/auth/users/{id}` (manager name lookup).
Navigation: None outward — this is a leaf page. `AdminNav`'s other two tabs ("Users", "All Lots") are non-functional (see Dead Ends).
Buttons/actions: "Manager applications"/"Lot approvals" (sub-tab switch), "Approve"/"Reject" (applications — reject discards typed feedback, see Dead Ends), "Approve" (lots, feedback wired correctly) / "Reject" (lots, permanently disabled), pagination controls (both sub-tabs, but only applications' pagination is server-driven).
Forms: Inline feedback `<textarea>`s per row (not a full \<form\>; one is properly wired to state, one is not — see Dead Ends).
Loading state: "Loading applications…" / "Loading lots…".
Error state: Red banners per sub-tab; explicit 401 (clear session → `/login`) and 403 (→ `/403`) handling, with a code comment noting these paths' exact response body shape is unconfirmed.
Empty state: "You're all caught up" (styled empty state, applications); plain text for lots ("No lots waiting for approval…").
Mock/hardcoded data: None.
Current status: 🟡 PARTIAL — both sub-tabs work for their primary (approve) action; lot rejection is a known, disabled gap; manager-application rejection silently drops user-entered feedback.

---

### Page: Forbidden (403)
Route: `/403`
Purpose: Generic access-denied landing page for `roleGuard` redirects.
UI implemented: YES (minimal, by design — not a stub)
Functional logic: None needed.
API integration: None.
Navigation: "Back to home" → `routerLink="/"`.
Buttons/actions: One link.
Forms: None.
Loading/Error/Empty state: N/A.
Mock/hardcoded data: None.
Current status: ✅ COMPLETE.

---

### Page: Driver — Nearby Lots
Route: `/lots`
Purpose: (Inferred from route name and `driver-lots` folder name — the Driver's main landing page for browsing/searching nearby lots. Not confirmed by any design doc or comment.) `NEEDS VERIFICATION`
UI implemented: NO
Functional logic: None.
API integration: None (`GET /api/v1/lots/nearby` and `/search` are documented in `parkinglot-service.md` but nothing in the frontend calls them).
Navigation: None — no nav rendered on this page at all.
Buttons/actions: None.
Forms: None.
Loading/Error/Empty state: N/A.
Mock/hardcoded data: The stub string itself is the only "content".
Current status: ❌ NOT IMPLEMENTED.

---

### Page: Manager — Spots
Route: `/manager/spots`
Purpose: (Inferred — managing individual parking spots within a manager's lot(s).) `NEEDS VERIFICATION`
UI implemented: NO
Functional logic: None.
API integration: None (no Spot service/models/constants exist anywhere in `src/app`, and `docs/api/spot.md` doesn't exist).
Navigation: Reachable via `ManagerNav`'s "Spots" tab (real link); the stub itself renders no nav onward.
Buttons/actions: None.
Forms: None.
Current status: ❌ NOT IMPLEMENTED.

---

### Page: Manager — Lot Bookings
Route: `/manager/lot-bookings`
Purpose: (Inferred — viewing bookings made against a manager's lots.) `NEEDS VERIFICATION`
UI implemented: NO
Functional logic: None.
API integration: None (no Booking service/models exist; `docs/api/booking.md` doesn't exist).
Navigation: Reachable via `ManagerNav`'s "Lot Bookings" tab.
Current status: ❌ NOT IMPLEMENTED.

---

### Page: Manager — Applications
Route: `/manager/applications`
Purpose: Unclear from the code — the name collides conceptually with the Admin's "manager applications" (which is about approving *managers*, a different concept from whatever this page is for a Manager). `NEEDS VERIFICATION` — this needs a product clarification, not just implementation.
UI implemented: NO
Functional logic: None.
API integration: None.
Navigation: Reachable via `ManagerNav`'s "Applications" tab.
Current status: ❌ NOT IMPLEMENTED.

---

# 7. BUTTON / CLICK ACTION AUDIT

| Page | Element | Label | Handler | Current behavior | Destination/API | Status |
|---|---|---|---|---|---|---|
| Login | button[type=submit] | "Log in" | `loginForm` submission action | Validates, calls API | `POST /api/v1/auth/login` | ✅ Works |
| Login | a | "Forgot password?" | `(click)="$event.preventDefault()"` | No-op by design | none | ⚪ Intentional stub |
| Login | button | "Continue with Google" | none | No-op | none | ⚪ Intentional stub |
| Login | a | "Sign up" | none (`href="#"`) | No-op (page-top jump) | none | 🔴 Broken (looks unintentional) |
| Register Driver | button[type=submit] | "Create account" | `registerForm` submission action | Validates, calls API, saves session, redirects | `POST /api/v1/auth/register/driver` | ✅ Works |
| Register Driver | a | "Log in" | `routerLink="/"` | Navigates | `/` | ✅ Works |
| Register Manager | button[type=submit] | "Submit application" | `registerForm` submission action | Validates, calls API, navigates with state | `POST /api/v1/auth/register/manager` | ✅ Works |
| Register Manager | a | "Log in" | `routerLink="/"` | Navigates | `/` | ✅ Works |
| Manager Application Submitted | a | "Back to log in" | `routerLink="/login"` | Navigates | `/login` | ✅ Works |
| Manager Lots (dashboard) | a | "+ Add new lot" | `routerLink="/manager/lots/new"` | Navigates | `ManagerLotForm` (create) | ✅ Works |
| Manager Lots (dashboard) | a (per row) | "Edit" | `[routerLink]="['/manager/lots', lot.lotId, 'edit']"` | Navigates with correct id | `ManagerLotForm` (edit) | ✅ Works |
| Manager Lot Form | button[type=submit] | "Save lot" | `lotForm` submission action | Validates, POST or PUT, navigates on success | `/api/v1/lots` or `/api/v1/lots/{id}` | ✅ Works |
| Manager Lot Form | button[type=button] | "Cancel" | `(click)="onCancel()"` → `router.navigateByUrl('/manager/lots')` | Navigates, no confirmation | `/manager/lots` | ✅ Works |
| Manager Nav (shared) | a×4 | My Lots / Spots / Lot Bookings / Applications | `routerLink` per item | All 4 navigate correctly | 1 real page + 3 stubs | 🟡 Links work, 3/4 destinations unbuilt |
| Admin Approval Queue | button | "Manager applications" / "Lot approvals" | `(click)="selectSubTab(...)"` | Switches local component state | none (client-side) | ✅ Works |
| Admin Approval Queue | button (per application) | "Approve" | `(click)="approveApplication(id)"` | Calls API, reloads list | `PUT /api/v1/admin/approve-manager/{id}` | ✅ Works |
| Admin Approval Queue | button (per application) | "Reject" | `(click)="rejectApplication(id)"` | Calls API with no body (typed feedback discarded) | `PUT /api/v1/admin/reject-manager/{id}` | 🟡 Works but drops feedback text |
| Admin Approval Queue | textarea (per application) | feedback | none | Not bound to any state | n/a | 🔴 Dead UI |
| Admin Approval Queue | button (per lot) | "Approve" | `(click)="approveLot(id)"` | Calls API with feedback draft, reloads | `PUT /api/v1/lots/{id}/approve` | ✅ Works |
| Admin Approval Queue | button (per lot) | "Reject" | none (`disabled`) | No-op | none | ⚪ Intentional stub (no backend endpoint) |
| Admin Approval Queue | textarea (per lot) | feedback | `(input)` → `updateLotFeedback()` | Bound to `lotFeedbackDrafts` signal | sent with Approve | ✅ Works |
| Admin Approval Queue | `<app-pagination-controls>`×2 | prev/next | `(pageChange)` | One is server-paged, one is client-array-paged | see §4 | 🟡 Works, inconsistent strategy |
| Admin Nav (shared) | span | "Users" | none | No-op, not even clickable styling change reachable | none | 🔴 Dead, no route exists |
| Admin Nav (shared) | span | "Manager Applications" | none (display only — actual switching is done by separate buttons in the page, not this nav) | Highlights when active | n/a | ⚪ Display-only by design |
| Admin Nav (shared) | span | "Lot Approvals" | same as above | Highlights when active | n/a | ⚪ Display-only by design |
| Admin Nav (shared) | span | "All Lots" | none | No-op | none | 🔴 Dead, no route exists |
| Forbidden | a | "Back to home" | `routerLink="/"` | Navigates | `/` | ✅ Works |
| (App-wide) | — | Logout | — | **Does not exist anywhere** | — | 🔴 Missing entirely |

---

# 8. COMPLETE USER JOURNEYS

**Login (all roles)**
```
/ or /login → enter email+password → Login.loginForm submit action → AuthService.login()
→ POST /api/v1/auth/login → AuthService.saveSession(auth) [always, incl. Admin]
→ resolvePostAuthRoute(role): Driver → '/lots', Manager → '/manager/lots', Admin → null (stays, shows notice)
```

**Driver registration**
```
/register → fill form → RegisterDriver.registerForm submit → AuthService.registerDriver()
→ POST /api/v1/auth/register/driver → saveSession → resolvePostAuthRoute('Driver') → '/lots' (stub)
```

**Manager registration → approval → login → first lot**
```
/register-manager → fill form → AuthService.registerManager() → POST /api/v1/auth/register/manager
→ (no session saved — account inactive) → navigate to /register-manager/submitted with application state
→ [OUT OF BAND: an Admin must log in separately and approve the application via /admin/approvals]
→ Manager logs in at /login → redirected to /manager/lots → GET /api/v1/lots/manager/{id} (likely empty)
→ click "+ Add new lot" → /manager/lots/new → fill form → POST /api/v1/lots → redirected back to /manager/lots
→ new lot now visible in the list
```

**Admin approval workflow**
```
/admin/approvals (defaults to 'manager-applications' sub-tab)
→ GET /api/v1/admin/manager-applications?status=Pending → list rendered
→ click Approve/Reject → PUT approve-manager/{id} or reject-manager/{id} → list reloads, success banner shown
→ click 'Lot approvals' sub-tab → GET /api/v1/lots/pending (first time only) → list rendered
→ click Approve → PUT /api/v1/lots/{id}/approve (with optional feedback) → list reloads
```

**Manager lot edit**
```
/manager/lots → click Edit on a lot → /manager/lots/{id}/edit
→ GET /api/v1/lots/{id} → form pre-filled → edit fields → Save
→ PUT /api/v1/lots/{id} (full object) → redirected to /manager/lots
```

**Journeys that do NOT exist / cannot be completed** (confirmed absent, not just "not asked about"):
- Logout (any role).
- Password reset / forgot password.
- Google OAuth login/registration.
- Driver: searching/browsing/booking a lot, selecting a spot, paying, viewing a ticket, booking history, vehicle management — **none of this exists in the frontend at all.**
- Manager: managing spots within a lot, viewing bookings made against their lots, whatever "Applications" is meant to be.
- Admin: managing users (suspend/reactivate/delete), viewing all lots, rejecting a lot.

---

# 9. EXACT STOPPING POINT

**"If I open the frontend right now and start using it, what is the furthest complete flow I can realistically reach?"**

```
Register as a Manager (/register-manager)
↓
Application submitted screen (/register-manager/submitted)
↓
[requires a separate Admin session to approve — /admin/approvals → Approve]
↓
Log in as the now-approved Manager (/login)
↓
Manager — My Lots dashboard (/manager/lots)   [GET /api/v1/lots/manager/{id}]
↓
Click "+ Add new lot" (/manager/lots/new)
↓
Fill out and submit the lot form            [POST /api/v1/lots]
↓
Redirected back to My Lots — the new lot appears in the list
↓
Click "Edit" on that lot (/manager/lots/{id}/edit)
↓
Form pre-fills from the server              [GET /api/v1/lots/{id}]
↓
Change something and save                   [PUT /api/v1/lots/{id}]
↓
Redirected back to My Lots — change reflected
↓
❌ CURRENT STOPPING POINT: click any other nav tab (Spots / Lot Bookings / Applications)
   → lands on a bare "coming soon" paragraph with no way to go further.
```

**Why development stops there:** This Manager lot-CRUD slice is the only feature area that has gone through both Phase 1 (static UI) and Phase 2 (backend integration) per the project's page-by-page workflow (see `CLAUDE.md`), all the way through. Every other page reachable from the Manager nav, the entire Driver role, and two of the four Admin nav tabs are either one-line stubs or simply don't exist as routes. There is no technical blocker (no broken build, no failing API call) causing the stop — it's purely that those pages have not been started yet, consistent with the project's explicit "build page by page, wait for the next screenshot" process described in `CLAUDE.md`.

A secondary, independently-complete path exists for Admin (application/lot approval review), but it's a leaf — it doesn't lead anywhere further either.

---

# 10. API AUDIT

Base URL: `environment.apiBaseUrl` = `http://localhost:5000` (same value in both dev and "production" environment files — `NEEDS VERIFICATION` whether this is a placeholder). All requests go through `ApiService`, which prefixes this base URL onto the constant path strings in `src/app/constants/*.constants.ts`. Every request gets an `Authorization: Bearer <token>` header attached by `authInterceptor` whenever a session exists in `localStorage` — this happens unconditionally, even for anonymous endpoints like login/register.

| Service | Method | Endpoint | Used by | Auth | Frontend status |
|---|---|---|---|---|---|
| Auth | POST | `/api/v1/auth/login` | `Login` via `AuthService.login()` | anonymous | CONNECTED |
| Auth | POST | `/api/v1/auth/register/driver` | `RegisterDriver` via `AuthService.registerDriver()` | anonymous | CONNECTED |
| Auth | POST | `/api/v1/auth/register/manager` | `RegisterManager` via `AuthService.registerManager()` | anonymous | CONNECTED |
| Auth | GET | `/api/v1/auth/users/{id}` | `AdminApprovalQueue` (resolving manager names for pending lots) via `AuthService.getUserById()` | Admin (per docs) | CONNECTED |
| Auth | GET | `/api/v1/admin/manager-applications` | `AdminApprovalQueue` via `AuthService.getManagerApplications()` | Admin | CONNECTED |
| Auth | PUT | `/api/v1/admin/approve-manager/{id}` | `AdminApprovalQueue` via `AuthService.approveManagerApplication()` | Admin | CONNECTED |
| Auth | PUT | `/api/v1/admin/reject-manager/{id}` | `AdminApprovalQueue` via `AuthService.rejectManagerApplication()` | Admin | CONNECTED (feedback textarea not wired — sends no body, see §5) |
| Auth | GET | `/api/v1/auth/profile` | none | JWT | NOT USED |
| Auth | PUT | `/api/v1/auth/profile` | none | JWT | NOT USED |
| Auth | PUT | `/api/v1/auth/password` | none | JWT | NOT USED |
| Auth | DELETE | `/api/v1/auth/deactivate` | none | JWT | NOT USED |
| Auth | POST | `/api/v1/auth/refresh` | none | anonymous (refresh token as credential) | NOT USED — no refresh flow implemented client-side |
| Auth | POST | `/api/v1/auth/logout` | none | anonymous | NOT USED — no logout feature exists |
| Auth | POST | `/api/v1/auth/oauth/google` | none | anonymous | NOT USED — "Continue with Google" button has no handler |
| Auth | GET | `/api/v1/auth/users` (list, paged) | none | Admin | NOT USED — no "Users" admin page |
| Auth | PUT | `/api/v1/auth/users/{id}/suspend` | none | Admin | NOT USED |
| Auth | PUT | `/api/v1/auth/users/{id}/reactivate` | none | Admin | NOT USED |
| Auth | DELETE | `/api/v1/auth/users/{id}` | none | Admin | NOT USED |
| ParkingLot | GET | `/api/v1/lots/manager/{managerId}` | `ManagerLots` via `ParkingLotService.getLotsByManager()` | Manager (own id) / Admin (any) | CONNECTED |
| ParkingLot | GET | `/api/v1/lots/{id}` | `ManagerLotForm` (edit mode) via `getLotById()` | anonymous per docs | CONNECTED |
| ParkingLot | POST | `/api/v1/lots` | `ManagerLotForm` (create mode) via `createLot()` | Manager | CONNECTED |
| ParkingLot | PUT | `/api/v1/lots/{id}` | `ManagerLotForm` (edit mode) via `updateLot()` | Manager (owner) | CONNECTED |
| ParkingLot | GET | `/api/v1/lots/pending` | `AdminApprovalQueue` via `getPendingLots()` | Admin | CONNECTED |
| ParkingLot | PUT | `/api/v1/lots/{id}/approve` | `AdminApprovalQueue` via `approveLot()` | Admin | CONNECTED |
| ParkingLot | DELETE | `/api/v1/lots/{id}` | none | Manager (owner) / Admin | NOT USED — no delete-lot UI anywhere |
| ParkingLot | PUT | `/api/v1/lots/{id}/toggle-open` | none | Manager (owner) | NOT USED — no open/close toggle UI anywhere, despite the dashboard displaying an Open/Closed status pill |
| ParkingLot | GET | `/api/v1/lots/all` (paged) | none | Admin | NOT USED — no "All Lots" admin page |
| ParkingLot | GET | `/api/v1/lots/search` | none | anonymous | NOT USED |
| ParkingLot | GET | `/api/v1/lots/nearby` | none | anonymous | NOT USED — this is presumably what `DriverLots` (`/lots`) is meant to call once built |
| Spot / Vehicle / Booking / Payment / Notification | — | — | none | — | NOT USED — no service, no docs file, no frontend code exists for any of these 5 backend services |

---

# 11. AUTHENTICATION & AUTHORIZATION

**Login:** `Login` page → `AuthService.login({email, password})` → `POST /api/v1/auth/login`. On success, the **entire** `AuthResponse` (`accessToken`, `refreshToken`, `expiresAt`, `user`) is JSON-stringified and stored as one blob in `localStorage["parkease.session"]` via `AuthService.saveSession()`.

**Register:** Two separate flows. `registerDriver()` returns a full `AuthResponse` (immediate session, like login). `registerManager()` returns a `ManagerApplicationDto` instead — **no session is created**, matching the backend's documented behavior that manager accounts start inactive pending Admin approval.

**Logout:** **Not implemented.** `AuthService.clearSession()` (a plain `localStorage.removeItem`) exists but is only ever invoked automatically inside two pages' error handlers, in response to a `401` from an API call — never by a user action. No call to the backend's `POST /api/v1/auth/logout` exists anywhere.

**JWT storage:** Plain `localStorage`, unencrypted, under the single key `parkease.session`, holding the raw JSON of the full `AuthResponse`. No separate secure/httpOnly cookie storage is used.

**Auth interceptor:** `authInterceptor` (functional `HttpInterceptorFn`, registered via `provideHttpClient(withInterceptors([authInterceptor]))` in `app.config.ts`) reads the session on every single outgoing HTTP request and, if present, clones the request to add `Authorization: Bearer <accessToken>`. It does not distinguish between endpoints that need auth and ones that don't — it always attaches the header if a session exists.

**Refresh token:** Present in the stored session data (`AuthResponse.refreshToken`) and the backend documents `POST /api/v1/auth/refresh`, but **no frontend code ever calls it**. There is no interceptor-level 401-retry-with-refresh logic; a 401 is handled per-page (clear session + hard redirect to `/login`), not centrally.

**Auth guard:** `authGuard` (`core/guards/auth.guard.ts`) — a `CanActivateFn` that checks `authService.getSession()` is non-null; redirects to `/` (the login page) if not. Applied to every protected route (`/lots`, all `/manager/*`, `/admin/approvals`).

**Role guard:** `roleGuard(...allowedRoles)` (`core/guards/role.guard.ts`) — a guard factory. Checks for a session first (redirect to `/` if absent — this duplicates `authGuard`'s check since both are applied together on every guarded route), then checks `user.role` is in the allowed list, redirecting to `/403` if not.

**Role-based navigation:** `AuthService.resolvePostAuthRoute(role)` is the single source of truth for where each role lands after login/registration: `Driver → '/lots'`, `Manager → '/manager/lots'`, `Admin → null` (caller — currently only `Login` — must handle the null case itself; `Login` shows an in-page notice rather than navigating).

**Unauthorized (401) handling:** Handled independently, per-page, in `ManagerLots`, `ManagerLotForm` (edit-mode load and submit), and `AdminApprovalQueue`. The pattern is consistent: call `authService.clearSession()` then `router.navigateByUrl('/login')` and surface a message — **except** in `ManagerLotForm`'s edit-mode 401 (which per the ParkingLot API docs means "not the owning manager", a *different* condition from "session expired"), where the session is deliberately **not** cleared, and the user is instead redirected back to `/manager/lots` with an error banner. This distinction is intentional and documented in the component's own code, not an inconsistency.

**Forbidden (403) handling:** Only `AdminApprovalQueue` has explicit 403 handling (redirects to `/403`), with a code comment flagging that the exact response body shape for this case is unconfirmed. No other integrated page handles a 403 specially.

**Token expiration:** No client-side expiry checking against `AuthResponse.expiresAt` exists anywhere — expiration is discovered reactively, only when an API call happens to return a 401.

---

# 12. ROLE-WISE AUDIT

**DRIVER**
Accessible routes: `/lots` (guarded by `authGuard` only — no `roleGuard`, so technically a Manager or Admin session could also load this route, since it isn't role-restricted).
Dashboard: None — `/lots` is a bare stub with no nav.
Navigation menu: None exists for this role.
Features: None implemented.
Restrictions: None enforced beyond requiring *some* valid session.
Missing functionality: Everything — search/browse lots, lot details, spot selection, booking, payment, ticket, booking history, vehicle management, profile, logout.

**MANAGER**
Accessible routes: `/manager/lots`, `/manager/lots/new`, `/manager/lots/:id/edit` (all fully working), `/manager/spots`, `/manager/lot-bookings`, `/manager/applications` (all stubs).
Dashboard: `/manager/lots` ("My Lots") — fully functional.
Navigation menu: `ManagerNav` (shared component), 4 tabs, all real links.
Features: Create lot, edit lot, view own lots with status. Nothing else.
Restrictions: `roleGuard(UserRole.Manager)` on every `/manager/*` route.
Missing functionality: Spot management, viewing bookings against their lots, whatever "Applications" is, open/close toggle, delete lot, logout.

**ADMIN**
Accessible routes: `/admin/approvals` only. No other Admin-specific route exists (no `/admin/users`, `/admin/all-lots`, or bare `/admin` landing page), despite `AdminNav` visually implying 4 sections.
Dashboard: `/admin/approvals`, defaulting to the "Manager applications" sub-tab.
Navigation menu: `AdminNav` — visually 4 tabs, but only 2 correspond to anything (and even those 2 are not the actual clickable controls — the real sub-tab switch buttons are separate elements rendered inside `AdminApprovalQueue` itself, not part of `AdminNav`).
Features: Approve/reject manager applications; approve (not reject) pending lots.
Restrictions: `roleGuard(UserRole.Admin)` on `/admin/approvals`.
Missing functionality: User management (suspend/reactivate/delete — endpoints documented, nothing built), "All Lots" browsing, lot rejection (no backend endpoint exists for this either), logout, any kind of Admin landing/overview page.

---

# 13. FORMS

**Login** — Page: `Login`. Fields: email, password. Validation: `required` both, `email` format on email. Submit handler: signal-forms `submission.action`, calls `AuthService.login()`. API: `POST /api/v1/auth/login`. Success: save session, role-based redirect (or in-page notice for Admin). Error: 429-specific copy, else backend `message`, else generic fallback. Redirect: role-dependent. Missing: no "remember me", no field-level server-error mapping (not needed — login only returns a generic top-level message per docs). Status: ✅ COMPLETE.

**Register Driver** — Page: `RegisterDriver`. Fields: fullName, email, password, phone (optional). Validation: required (fullName/email/password), email format, password complexity regex (`^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$`, min length 8), phone pattern only checked when non-empty. Submit handler: signal-forms action → `AuthService.registerDriver()`. API: `POST /api/v1/auth/register/driver`. Success: save session, redirect. Error: 429, else top-level backend message. Redirect: role-based (always Driver here). Missing: no field-level 422 mapping (top-level message only). Status: ✅ COMPLETE.

**Register Manager** — Page: `RegisterManager`. Fields: fullName, email, password, phone (required here), businessName, parkingAddress. Validation: same complexity rules as driver plus phone required. Submit handler: signal-forms action → `AuthService.registerManager()`. API: `POST /api/v1/auth/register/manager`. Success: navigate to submitted screen with state (no session). Error: 429, else top-level message. Redirect: `/register-manager/submitted`. Missing: no field-level 422 mapping. Status: ✅ COMPLETE.

**Manager — Create/Edit Lot** — Page: `ManagerLotForm`. Fields: name, address, city, totalSpots, minPricePerHour, maxPricePerHour, openTime, closeTime, description (optional). Validation: required on all but description; `minLength(address, 10)`; `min(totalSpots, 1)`; `min(minPricePerHour, 0)`; a custom cross-field `validate()` enforcing `maxPricePerHour >= minPricePerHour`; `maxLength(description, 1000)`. Submit handler: signal-forms action → `createLot()`/`updateLot()` depending on mode. API: `POST /api/v1/lots` or `PUT /api/v1/lots/{id}`. Success: navigate to `/manager/lots`. Error: 422 mapped per-field via the returned `ValidationError.WithOptionalFieldTree[]` from the submission action (Signal Forms' built-in server-error-targeting mechanism); 409/other → top-level `serverError` banner using the backend message directly. Redirect: `/manager/lots` on success, or with an error message on 401/404 (edit mode). Missing: nothing functionally — this is the most complete form in the app. Status: ✅ COMPLETE.

**Admin — inline feedback textareas** (not full `<form>`s) — Page: `AdminApprovalQueue`. Two separate textareas: one per pending manager application (unbound — see Dead Ends), one per pending lot (bound to a `lotFeedbackDrafts` signal, sent as `{feedback}` on Approve). No client-side validation on either (feedback is always optional). Status: 🟡 PARTIAL (one of the two is dead UI).

---

# 14. MOCK / HARDCODED / PLACEHOLDER DATA

A repo-wide search for `mock`, `dummy`, `fake`, `sample`, `hardcod`, `placeholder`, `TODO`, `FIXME`, `coming soon`, and `console.log` across `src/app/**/*.ts` and `*.html` (excluding `.spec.ts` test fixtures, which legitimately contain fixture data) found:

- The 4 stub pages' literal template strings: `"Nearby Lots — coming soon."`, `"Spots — coming soon."`, `"Lot Bookings — coming soon."`, `"Applications — coming soon."`.
- Two `title="Coming soon"` attributes on Login's "Forgot password?" and "Continue with Google".
- **No hardcoded/mock data arrays or fake API responses exist in any real (non-stub, non-test) page.** Both list-rendering pages that might tempt this (`ManagerLots`, `AdminApprovalQueue`) fetch exclusively from live signals populated by real HTTP calls — confirmed by reading both files in full. There is no page that "looks complete but is secretly using mock data."
- `main.ts` contains exactly one `console.error` (the standard Angular CLI bootstrap error handler boilerplate) — no debug `console.log` statements exist in application code.
- No commented-out functionality blocks were found in any page or service file.

---

# 15. COMPONENT & SERVICE DEPENDENCIES

```
Login
→ AuthService (login, saveSession, resolvePostAuthRoute)
→ FormField, FormRoot (@angular/forms/signals)

RegisterDriver / RegisterManager
→ AuthService (registerDriver / registerManager)
→ FormField, FormRoot

ManagerApplicationSubmitted
→ (no service — reads Router navigation state directly)

ManagerLots
→ AuthService (getCurrentUser, clearSession)
→ ParkingLotService (getLotsByManager)
→ ManagerNav (shared component)

ManagerLotForm
→ ParkingLotService (getLotById, createLot, updateLot)
→ ManagerNav (shared component)
→ FormField, FormRoot (@angular/forms/signals)

AdminApprovalQueue
→ AuthService (getManagerApplications, approveManagerApplication, rejectManagerApplication, getUserById, clearSession)
→ ParkingLotService (getPendingLots, approveLot)
→ AdminNav (shared component)
→ PaginationControls (shared component)
→ PaginatePipe (shared pipe, lot-approvals sub-tab only)

DriverLots / ManagerSpots / ManagerLotBookings / ManagerApplications (stubs)
→ nothing — no imports beyond @angular/core's Component decorator

Forbidden
→ RouterLink only

AuthService
→ ApiService (all HTTP calls go through this)

ParkingLotService
→ ApiService

ApiService
→ HttpClient (the only place in the app that touches it directly)

authInterceptor
→ AuthService (getSession)

authGuard / roleGuard
→ AuthService (getSession, implicitly via getCurrentUser for roleGuard)
```

**Reusable components/services that should be reused rather than recreated for future pages:**
- `ApiService` — every new domain service must be built on this, never inject `HttpClient` directly.
- `ManagerNav` / `AdminNav` — reuse for any new page under `/manager/*` or `/admin/*` respectively (note `AdminNav`'s current limitation: it's display-only, not a real nav — see §17 for the implication if a new Admin page is added).
- `PaginationControls` + `PaginatePipe` — reuse for any new paged list, though note the two existing usages already disagree on strategy (server-paged vs. client-array-paged) — pick one deliberately for new pages rather than copying whichever is closer.
- The Signal Forms pattern (`form()` + `FormField` + `FormRoot` + validators, submission-action error handling) established across all 4 existing forms — any new form should follow this, not introduce template-driven or reactive (`FormGroup`) forms.
- `ApiResponse<T>` / `PagedResponse<T>` — the two universal response envelopes; any new endpoint's response model should compose with these, not redefine an envelope shape.

---

# 16. ENVIRONMENT / CONFIGURATION

| Setting | Dev (`environment.ts`) | Prod (`environment.production.ts`) |
|---|---|---|
| `production` | `false` | `true` |
| `apiBaseUrl` | `http://localhost:5000` | `http://localhost:5000` — **identical to dev**, `NEEDS VERIFICATION` whether a real production URL was ever configured |

No proxy configuration file (`proxy.conf.json`) exists — the dev server does not proxy API calls; `ApiService` calls `apiBaseUrl` directly, meaning CORS must be enabled on the backend Gateway for `http://localhost:4200` (Angular's default dev-server port — `NEEDS VERIFICATION`, no explicit port is configured in `angular.json`'s `serve` target).

No `.env` files, no secrets, no API keys found anywhere in the repository. Build configuration is entirely within `angular.json` (standard Angular CLI esbuild application builder, production budget limits: 500kB warning / 1MB error initial bundle, 4kB/8kB per-component-style).

No `SECRET/PRIVATE VALUE OMITTED` cases were encountered — nothing sensitive exists in the inspected configuration.

---

# 17. BROKEN / RISKY AREAS

- **Login "Sign up" link is broken** (`href="#"`, not a `routerLink`) — see Dead Ends. This is the one issue in the whole codebase that looks like an actual bug rather than an intentionally unbuilt feature.
- **No logout anywhere** — a real usability gap once more of the app is built out; sessions can currently only end via a natural 401 or manually clearing storage.
- **`environment.production.ts` has the same `apiBaseUrl` as dev** — almost certainly needs updating before any real production deploy; currently harmless since nothing is deployed, but a landmine if forgotten.
- **422 field-error casing (`errors` dict keys) is unconfirmed** — `docs/api/gateway.md` explicitly flags this as PascalCase-per-source-but-never-observed-live. `ManagerLotForm` defends against this by matching case-insensitively, but no other form does per-field mapping at all, so this is only a live risk on that one page, and only if the assumed field *names* (not casing) also turn out to be wrong.
- **`GET /api/v1/lots/manager/{managerId}` mismatched-id case returns a native ASP.NET `Forbid()` (403) with an unconfirmed, possibly non-`ApiResponse`-shaped body** (per `parkinglot-service.md`) — `ManagerLots`'s error handling only special-cases 401, not 403; an unexpected 403 here would fall through to the generic body-parsing branch and, if the body isn't the expected shape, could show a slightly wrong (but not crashing) message. Low risk in practice since a Manager always requests their own id.
- **429 (rate limit) response body shape is documented as unconfirmed** (`gateway.md`) — every auth form assumes a specific friendly-message override for 429 regardless of body shape, so this is already defensively handled; only `ManagerLotForm`'s submit path has no 429-specific branch and would fall through to generic error handling if a 429 body doesn't parse as expected.
- **`TimeOnly` wire format assumed as `"HH:mm:ss"`** (`gateway.md` marks this unconfirmed too) — `ManagerLotForm` builds/parses against this assumption (`slice(0,5)` on load, `+ ':00'` on submit); if the backend actually returns fractional seconds or a different format, the edit-mode time fields would silently mis-parse.
- **Admin "reject manager application" discards the typed feedback textarea** — either dead UI that should be removed, or a wiring gap; see Dead Ends for detail. `auth.md` documents this endpoint as taking no request body at all, which suggests the textarea may be a copy-paste leftover from the lot-rejection UI pattern rather than a real intended feature.
- **`AdminNav` is not actually a navigation component** despite the name and despite `ManagerNav` (its sibling, same folder structure) being a real one — any future page reusing `AdminNav` should not assume clicking its tabs does anything.
- **Two different pagination strategies coexist on one page** (`AdminApprovalQueue`) — server-paged for applications, client-array-paged (via `paginate` pipe) for lots — worth resolving to one pattern before adding more paged lists.
- **No centralized 401/refresh handling** — every page that calls a protected endpoint re-implements its own 401 check/redirect/clear-session logic inline rather than a shared interceptor-level handler. Works today but will duplicate further as more pages are added.
- **Unused backend surface** — `DELETE /api/v1/lots/{id}`, `PUT /api/v1/lots/{id}/toggle-open`, all of the Auth admin user-management endpoints, `GET /api/v1/lots/all`, `/search`, `/nearby`, refresh, logout, and OAuth are all documented and presumably live on the backend, but have zero frontend code calling them. Not "broken", just confirmed unused.
- **No compilation issues found** — `ng build` was not re-run as part of this audit (per the no-code-changes constraint, and because it doesn't mutate source), but no syntax/import inconsistencies were observed while reading every source file directly.

---

# 18. FEATURE STATUS MATRIX

| Feature | UI | Logic | API | Navigation | Status |
|---|---|---|---|---|---|
| Login | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Register (Driver) | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Register (Manager) | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Manager application submitted screen | ✅ | ✅ | n/a | ✅ | COMPLETE |
| Forgot password | 🟡 (link only) | ❌ | ❌ | ❌ | NOT IMPLEMENTED |
| Google OAuth | 🟡 (button only) | ❌ | ❌ | ❌ | NOT IMPLEMENTED |
| Sign up (from Login) | 🟡 (link exists) | ❌ | n/a | ❌ | BROKEN |
| Logout | ❌ | ❌ | ❌ | ❌ | NOT IMPLEMENTED |
| Manager — My Lots dashboard | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Manager — Create Lot | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Manager — Edit Lot | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Manager — Delete/toggle-open Lot | ❌ | ❌ | ❌ (endpoint exists, unused) | ❌ | NOT IMPLEMENTED |
| Manager — Spots | ❌ | ❌ | ❌ | 🟡 (link works, page doesn't) | NOT IMPLEMENTED |
| Manager — Lot Bookings | ❌ | ❌ | ❌ | 🟡 (link works, page doesn't) | NOT IMPLEMENTED |
| Manager — Applications | ❌ | ❌ | ❌ | 🟡 (link works, page doesn't) | NOT IMPLEMENTED |
| Admin — Manager application approve/reject | ✅ | 🟡 (reject drops feedback) | ✅ | ✅ | PARTIAL |
| Admin — Lot approve | ✅ | ✅ | ✅ | ✅ | COMPLETE |
| Admin — Lot reject | 🟡 (disabled button) | ❌ | ❌ (no backend endpoint) | n/a | NOT IMPLEMENTED |
| Admin — Users management | ❌ | ❌ | ❌ (endpoints exist, unused) | ❌ (dead nav tab) | NOT IMPLEMENTED |
| Admin — All Lots | ❌ | ❌ | ❌ (endpoint exists, unused) | ❌ (dead nav tab) | NOT IMPLEMENTED |
| Driver — Nearby Lots / search / booking / payment / etc. | ❌ | ❌ | ❌ | 🟡 (route reachable, page is a stub) | NOT IMPLEMENTED |
| Token refresh | n/a | ❌ | ❌ (endpoint exists, unused) | n/a | NOT IMPLEMENTED |

---

# 19. DEVELOPMENT PRIORITY

**P0 — Broken / Blocking**
1. Fix the Login "Sign up" link (`href="#"` → a real route or a chooser). Why: it's the only genuinely broken (not just unbuilt) piece of UI in the app, and it's on the very first page every new user sees — currently a new Driver or Manager literally cannot discover how to register from the login screen without knowing a URL in advance.

**P1 — Complete an existing user flow**
1. Build a real Driver "Nearby Lots" page (`/lots`), at minimum wired to `GET /api/v1/lots/nearby` or `/search` (both already documented and unused). Why: Driver is one of exactly two self-registerable roles, and currently has literally zero functionality after registering/logging in — this is the single biggest functional gap relative to what already exists on the backend.
2. Build the Manager "Spots" page. Why: a lot is created with a `totalSpots` count but there is currently no way to define/manage the individual spots that make up that count — without this, a created lot has no real substance, and it's the most natural "next" page given `ManagerNav` already links to it.
3. Add a logout action (button + call to `POST /api/v1/auth/logout`, then `clearSession()` + redirect to `/login`). Why: baseline expected functionality for any authenticated app; currently completely absent, which will only become more awkward to bolt on as more pages accumulate their own header/nav.

**P2 — Missing important features**
1. Admin "Users" page (list + suspend/reactivate/delete), wiring up the already-documented, already-unused Auth admin endpoints. Why: `AdminNav` already visually promises this tab; leaving it a dead click is a worse experience than not showing it at all.
2. Admin "All Lots" page, using the already-documented, unused `GET /api/v1/lots/all`. Why: same reasoning as Users — it's advertised in the nav but does nothing.
3. Wire or remove the manager-application-rejection feedback textarea (confirm against the backend whether `PUT .../reject-manager/{id}` accepts a body at all; `auth.md` currently says it doesn't). Why: it's currently misleading dead UI that implies functionality that silently doesn't happen.
4. Manager lot delete / toggle-open actions on the dashboard, using the already-documented, unused `DELETE /api/v1/lots/{id}` and `PUT /api/v1/lots/{id}/toggle-open`. Why: the dashboard already displays an Open/Closed status pill with no way to ever change it.

**P3 — UI polish / improvements**
1. Reconcile the two different pagination strategies on the Admin approval queue (server-paged vs. client-array-paged) before more paged lists get added elsewhere.
2. Centralize 401 handling (e.g. in the interceptor or a shared error-handling service) instead of duplicating the clear-session-and-redirect logic per page.
3. Update `environment.production.ts`'s `apiBaseUrl` once a real production backend URL exists.
4. Clarify and rename `/manager/applications` if its intended purpose differs from what the current placeholder name suggests (needs a product decision, not just code).

---

# 20. CLAUDE CHROME CONTINUATION PROMPT

```
You are continuing an EXISTING Angular frontend project called ParkEase. Do not start from
scratch, do not restructure the project, and do not assume any architecture other than what is
described below — this description was produced by directly reading the actual source files.

PROJECT
ParkEase is a microservices-based parking management system. This repo is only the frontend.
Backend is reached through a YARP Gateway; per-service API contracts (request/response JSON,
auth requirements, enums) are documented in docs/api/*.md — read the relevant file(s) before
touching any API integration. Currently documented: auth.md, gateway.md, parkinglot-service.md.
NOT yet documented (and NOT yet built on the frontend at all): Spot, Vehicle, Booking, Payment,
Notification services.

TECH STACK
Angular 22 (standalone components, no NgModules), TypeScript ~6.0. Tailwind CSS v4 for all
styling (see src/styles.css for the small @theme design-token block — reuse those tokens,
don't invent new colors). Every form in the app uses Angular's newer Signal Forms API
(@angular/forms/signals: form(), FormField, FormRoot, submit(), required/email/min/max/
minLength/maxLength/validate) — use this same pattern for any new form, not FormGroup/
template-driven forms. State is plain Angular signals; there is no NgRx or similar. Tests are
Vitest (run via `ng test`), written in Jasmine-style describe/it/expect syntax — follow the
existing *.spec.ts files as templates. No ESLint config exists.

ARCHITECTURE (existing, reuse — do not recreate)
- src/app/services/api.service.ts — the ONLY class that talks to HttpClient directly. Every
  domain service (auth.service.ts, parkinglot.service.ts) is built on top of it, typing every
  response as ApiResponse<T> ({success, message, data, errors}). Any new domain service MUST
  follow this same pattern.
- src/app/constants/*.constants.ts — one file per backend domain, holding only route-path
  string constants (e.g. PARKINGLOT_API.byId(id)). Add new endpoint paths here, not inline.
- src/app/models/ — flat top-level files for cross-domain shapes (api-response.model.ts,
  paged-response.model.ts) plus a per-domain subfolder once a domain has >1 model file
  (models/auth/). Follow this convention for any new domain.
- src/app/core/guards/auth.guard.ts (requires a session) and role.guard.ts (roleGuard(...roles)
  factory) — apply both together on any new protected route, exactly as every existing
  /manager/* and /admin/* route does.
- src/app/core/interceptors/auth.interceptor.ts — attaches the Bearer token automatically;
  don't add auth headers manually anywhere.
- src/app/shared/components/manager-nav/ — real, working nav for all /manager/* pages, reuse
  as-is. src/app/shared/components/admin-nav/ — IMPORTANT: despite the name and despite looking
  like ManagerNav, this is NOT a functional nav — its 4 tab labels are plain <span>s with no
  routerLink and no click handler. Only 2 of its 4 labels correspond to anything real, and even
  those aren't the actual clickable controls (AdminApprovalQueue renders its own separate sub-tab
  buttons). If you build a new Admin page, either wire AdminNav's tabs to real routerLinks or be
  aware it currently doesn't function as navigation at all.
- src/app/shared/components/pagination-controls/ + shared/pipes/paginate.pipe.ts — reusable
  pager, but note the existing single usage-site (AdminApprovalQueue) inconsistently mixes
  server-side paging (manager applications) and client-side array-slicing via the pipe (lots) —
  pick one deliberately for new lists.

CURRENT ROUTES (src/app/app.routes.ts — flat array, no lazy loading, no child routes)
/ , /login              → Login (public)
/register               → RegisterDriver (public)
/register-manager       → RegisterManager (public)
/register-manager/submitted → ManagerApplicationSubmitted (public, reads router state)
/lots                   → DriverLots (authGuard only) — ONE-LINE STUB, "Nearby Lots — coming soon."
/manager/lots           → ManagerLots (authGuard + roleGuard(Manager)) — COMPLETE dashboard
/manager/lots/new       → ManagerLotForm create mode (same guards) — COMPLETE
/manager/lots/:id/edit  → ManagerLotForm edit mode (same guards) — COMPLETE
/manager/spots          → ManagerSpots (same guards) — ONE-LINE STUB
/manager/lot-bookings   → ManagerLotBookings (same guards) — ONE-LINE STUB
/manager/applications   → ManagerApplications (same guards) — ONE-LINE STUB, purpose unclear,
                          needs a product decision before building
/admin/approvals        → AdminApprovalQueue (authGuard + roleGuard(Admin)) — COMPLETE for its
                          2 sub-tabs (manager applications, lot approvals); lot rejection is
                          disabled (no backend endpoint exists for it)
/403                    → Forbidden (public)

WORKING FUNCTIONALITY
Login (all 3 roles, role-based redirect — Admin has no redirect target and shows an in-page
notice instead), Driver registration, Manager registration (creates a pending application, no
session), Admin approval of manager applications and lots, full Manager lot CRUD (list/create/
edit against real endpoints, with client + server-side validation and per-field 422 error
mapping on the lot form).

PARTIAL FUNCTIONALITY
Admin can approve but not reject a lot (no backend endpoint documented for lot rejection). Admin
can reject a manager application, but a feedback textarea next to that action is not wired to
any state and its contents are silently discarded (the endpoint may not even accept feedback —
verify against docs/api/auth.md before wiring it).

MISSING FUNCTIONALITY
No Driver functionality beyond the bare stub route (no search, lot details, booking, payment,
vehicles, history). No Manager Spots/Lot-Bookings/Applications pages. No Admin Users or All-Lots
pages (both have documented, unused backend endpoints already). No logout anywhere in the app.
No password reset. No Google OAuth (button exists, no handler). No token-refresh flow (backend
endpoint documented, unused).

DEAD ENDS (do not assume these work — verify before building on top of them)
- Login's "Sign up" link is `href="#"`, not wired to any route — this looks like an actual bug.
- Login's "Forgot password?" and "Continue with Google" are intentionally inert (title="Coming
  soon").
- AdminNav's "Users" and "All Lots" tabs are non-functional decoration, not real navigation.
- The manager-application-rejection feedback textarea is dead UI (see above).
- No logout exists anywhere.

CURRENT STOPPING POINT
The deepest fully-working, multi-page, real-backend-integrated flow in the app is:
Register Manager → (Admin approves, separately) → Manager logs in → My Lots dashboard →
Create a lot → lot appears in dashboard → Edit that lot → change saved. Nothing goes further
than that — every other nav tab leads to a one-line stub or doesn't exist as a page at all.

NEXT FEATURE TO BUILD (in priority order — see FRONTEND_HANDOFF.md §19 for full reasoning)
P0: Fix the broken Login "Sign up" link.
P1: Build the Driver "Nearby Lots" page (/lots) using the already-documented, unused
    GET /api/v1/lots/nearby and/or /api/v1/lots/search endpoints from parkinglot-service.md.
    This is the single largest functional gap in the app — Driver currently has nothing.
P1 (alternative/also): Build the Manager "Spots" page — a created lot currently has no way to
    define its individual spots.
P1 (alternative/also): Add a logout action.

CONSTRAINTS — DO NOT VIOLATE
1. Inspect the existing UI/code before changing anything — read the actual page you're
   extending or the actual component you're about to touch, don't assume its shape.
2. Preserve the current design language: Tailwind utility classes only, reuse the existing
   @theme color tokens in src/styles.css, match the visual patterns already established
   (rounded-2xl cards, bg-accent buttons, text-muted labels in small-caps tracking-wide style,
   red-50/red-600 error banners, etc.) — do not introduce a UI library or a new design system.
3. Reuse existing components (ManagerNav, AdminNav, PaginationControls) rather than building
   new ones, unless the existing one is genuinely unsuitable (as with AdminNav's lack of real
   navigation — extend it rather than replacing it, if you need it to actually navigate).
4. Reuse existing services (ApiService, AuthService, ParkingLotService) and extend them with
   new methods rather than creating parallel HTTP-calling code.
5. Reuse existing models (ApiResponse<T>, PagedResponse<T>, LotResponse, etc.) rather than
   redefining response shapes.
6. Reuse existing routes/guards where a new page fits an existing pattern (e.g. any new
   /manager/* page should use [authGuard, roleGuard(UserRole.Manager)] exactly like the
   existing ones).
7. Do not create functionality that duplicates something that already exists (e.g. don't build
   a second HTTP wrapper, a second nav component for the same role, a second pagination
   pattern without a reason).
8. Do not unnecessarily change working code — the Login/Register/Manager-lot-CRUD/Admin-approval
   flows are complete and tested; don't refactor them as a side effect of building something
   else.
9. Continue from the current stopping point described above — don't restart earlier flows or
   redesign completed pages.
10. Implement only the next logical feature per the priority list above (or whatever the human
    explicitly asks for) — this project is built page-by-page with an explicit "wait for the
    next screenshot/instruction" workflow (see CLAUDE.md in the repo root if present), not built
    all at once speculatively.
11. After implementing anything, verify navigation actually works: click through from wherever
    the new page is linked from, confirm the route loads the right component with the right
    params.
12. Verify that any new button actually leads to its intended destination/API call — don't
    leave a button that looks wired but silently does nothing (this repo already has a few of
    those — see the Dead Ends section of FRONTEND_HANDOFF.md — don't add more).
13. Verify that any newly implemented flow can actually continue to its next logical page,
    the same way this document traced Login → Dashboard → Create Lot → Edit Lot end-to-end.
```
