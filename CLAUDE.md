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
- Use standalone Angular components matching whatever convention the project
  already uses.
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
- Follow this folder structure. Check the existing repo first and reuse what's
  already there — don't create a parallel structure for a page that already
  has shared infra from an earlier page.

```
/core or /shared
  /enums         → typed enums matching backend contracts
  /constants     → route constants, config constants
  /models        → request/response DTOs typed from the JSON
  /services      → Angular services per domain/feature, using HttpClient
  /interceptors  → only if this page/feature needs one not already present
  /mappers       → API DTO <-> UI view-model mapping, if shapes differ
```

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
