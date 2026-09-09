# ParkEase Frontend — Working Rules

This is the Angular frontend for **ParkEase**, a microservices-based parking
management system. Read this file at the start of every session and follow it
without being reminded.

We build **page by page**. Each page goes through two strict phases. Do not
skip ahead, combine phases, or start a new page without being told.

For each page, I will provide:
1. A **screenshot/exported image** of the Figma design for that page (attached
   directly in the prompt — there is no Figma MCP connection, so never try to
   fetch a Figma URL or call Figma tools; work only from the attached image).
2. Sometimes accompanying text notes (exact hex values, spacing in px, font
   sizes) to remove ambiguity where the image alone isn't precise enough.
3. An **API documentation excerpt** for that page's endpoints (request JSON
   body, response JSON, status codes, auth requirements) — provided only when
   we reach Phase 2 for that page.

---

## PHASE 1 — Static Page (UI only, no backend)

- Build the page purely from the attached screenshot: layout, styling,
  responsive behavior, component structure.
- If any visual detail is ambiguous (exact color, spacing, font weight) and no
  text notes were given, ask rather than guess on anything that affects the
  design system broadly (e.g. a color that looks like it's a reused token).
  Minor per-page guesses are fine.
- Use static/mock/hardcoded data only — no HTTP calls, no services wired up.
- Use standalone Angular components. Create the page under `pages/<page-name>/`
  in kebab-case, with the component class as the PascalCase of that name (no
  `Component` suffix) — see "Current Project Structure" below for the exact
  file layout (full 4-file page vs. inline-template stub).
- Reuse the existing design tokens/theme already established in the project
  (check first) rather than inventing new ones. Only introduce new tokens if
  the screenshot clearly needs something not yet defined, and flag it as new.
- Do NOT create services, interceptors, API models, enums, or mappers yet —
  that's Phase 2 only.
- Keep the component isolated and reusable where sensible.

**When Phase 1 is done, provide:**
1. A short summary of what was built and where the files live.
2. A suggested git commit message, e.g.
   `feat(booking-page): add static UI for booking screen`

**Then stop.** Wait for explicit instruction ("move to phase 2") before continuing.

---

## API Reference

Endpoint contracts live in `docs/api/`, one Markdown file per backend service:

```
docs/api/
  auth.md
  parkinglot.md
  spot.md
  vehicle.md
  booking.md
  payment.md
  notification.md
  gateway.md
```

Each file contains that service's routes, auth requirements, request/response
JSON, error shapes, enums (wire values), and rate limits.

Before writing any Phase 2 code, read the file(s) relevant to the page you're
integrating. Many pages need more than one — e.g. a Booking page typically
also needs `vehicle.md` for a vehicle dropdown, or `spot.md` for availability.
Check all services the page's UI actually touches, not just the obvious one.

If a route, field, or enum value the page needs isn't documented in these
files, **ask rather than guess** — do not invent a contract. Some entries in
these docs may be marked "⚠️ verify against actual controller" — treat those
as unconfirmed and flag it back if the page depends on one.

---

## PHASE 2 — Backend Integration

Only start when explicitly told to proceed, and only once told which
`docs/api/*.md` file(s) apply to this page.

- Wire the static page from Phase 1 to the real backend using the relevant
  file(s) in `docs/api/`.
- Follow the structure below (see "Current Project Structure"). Check the
  existing repo first and reuse what's already there — don't create a
  parallel structure for a page that already has shared infra from an
  earlier page.
- Handle loading, error, and empty states based on the actual API responses.
- Write Jasmine + Karma unit tests for the individual components touched in
  this phase only — not the whole app.
- Build on top of Phase 1's components. If a shared service/model/enum already
  exists from a previous page's Phase 2, reuse or extend it instead of
  duplicating — but don't force a dependency that doesn't naturally exist.

**When Phase 2 is done, provide:**
1. Summary of what was integrated (services, models, mappers, tests added).
2. A suggested git commit message, e.g.
   `feat(booking-page): integrate booking API with services, models, tests`

**Then stop.** Wait for the next instruction before moving to the next page.

---

## Current Project Structure

This is the actual structure as of the auth/register-driver pages (Phase 2
complete for both). Treat this as the canonical layout — extend it, don't
reinvent it, for every new page.

```
src/
├── environments/
│   ├── environment.ts                    # dev config (apiBaseUrl, production flag)
│   └── environment.production.ts
│
└── app/
    ├── app.config.ts                     # providers: router, HttpClient + interceptors
    ├── app.routes.ts                     # flat route list, canActivate: [authGuard] on protected routes
    │
    ├── core/                             # cross-cutting infra (not feature-specific)
    │   ├── guards/
    │   │   └── auth.guard.ts
    │   └── interceptors/
    │       └── auth.interceptor.ts       # attaches Bearer token from session
    │
    ├── constants/                        # flat, one file per domain
    │   └── auth.constants.ts             # e.g. AUTH_API route paths
    │
    ├── models/                           # flat top-level + per-domain subfolders
    │   ├── api-response.model.ts         # shared envelope: { success, message, data, errors }
    │   └── auth/                         # domain subfolder once a domain has >1 model
    │       ├── auth.model.ts             # request/response DTOs (LoginRequest, AuthResponse...)
    │       ├── user.model.ts             # AuthUser
    │       └── user-role.enum.ts         # UserRole enum
    │
    ├── services/                         # flat, one Angular service per domain
    │   ├── api.service.ts                # generic HttpClient wrapper (get/post/put/patch/delete), used by all other services
    │   └── auth.service.ts               # domain service, built on ApiService
    │
    └── pages/                            # one folder per page/screen
        ├── login/
        │   ├── login.ts
        │   ├── login.html
        │   ├── login.css
        │   └── login.spec.ts
        ├── register-driver/
        │   ├── register-driver.ts
        │   ├── register-driver.html
        │   ├── register-driver.css
        │   └── register-driver.spec.ts
        ├── driver-lots/                  # Phase-1-only stub so far (inline template, no .html/.css)
        │   └── driver-lots.ts
        └── manager-lots/                 # same, stub
            └── manager-lots.ts
```

**Conventions to follow for every new page:**

- **`ApiService`** (`services/api.service.ts`) is the single generic HTTP
  wrapper. Every domain service injects it rather than `HttpClient` directly,
  and every response is typed `ApiResponse<T>`. Do not create a second
  wrapper.
- **`environment.apiBaseUrl`** holds the base URL; `ApiService` prefixes all
  paths with it. Never hardcode a host in a service.
- **Route path constants** live in `constants/<domain>.constants.ts` (e.g.
  `AUTH_API.login`), not hardcoded strings inside services.
- **Models**: a shared `ApiResponse<T>` envelope stays at the top level of
  `models/`. Domain-specific DTOs/enums get their own subfolder under
  `models/<domain>/` once there's more than one file for that domain
  (singular filenames: `*.model.ts`, `*.enum.ts`). A domain with only one
  model file can stay flat at `models/` until it grows.
- **`core/`** is reserved for app-wide, feature-agnostic infra (guards,
  interceptors) — never per-page logic.
- **`mappers/`** — add only when a page's Phase 2 API shape genuinely
  diverges from its UI view-model. None exist yet; don't add one
  preemptively.
- **Session/auth state** lives in `AuthService` via `localStorage` — don't
  introduce a separate state service for this unless asked.
- **Pages**: standalone components, one folder per page under `pages/`,
  folder name in kebab-case, component class the PascalCase of that same
  name with no `Component` suffix (e.g. `pages/register-driver/` →
  `export class RegisterDriver`). A fully built page has 4 files: `.ts`,
  `.html`, `.css`, `.spec.ts`.
- **Stub pages** (routed to but not yet given a screenshot/Phase 1) are a
  single `.ts` file with the template written inline via the `template:`
  property — no `.html`/`.css`/`.spec.ts` until the page actually goes
  through Phase 1. When Phase 1 happens for a stub, split the inline
  template out into the standard 4-file layout.

---

## General Rules

- Never jump to Phase 2 without explicit go-ahead.
- Never start a new page until its screenshot (and, for Phase 2, its endpoint
  doc) is provided.
- Don't over-engineer shared infrastructure preemptively — build it when a
  page actually needs it. Don't refactor earlier pages unless asked.
- Ask clarifying questions only when the screenshot or endpoint doc is
  ambiguous in a way that affects data contracts or shared design tokens —
  don't guess silently on those.
- Never attempt to use a Figma MCP tool, fetch a Figma URL, or assume design
  data beyond what's in the attached image/notes.
