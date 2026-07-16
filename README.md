# Kindamba UI — Smart Medical Specialist Directory

Patient/hospital/admin web app for the Kindamba Smart Medical Specialist Directory. Built with [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR) and talks to the [`Kindamba`](../Kindamba) Django REST API for **all** data — there is no other backend or BaaS involved. Patients search nearby specialists, hospitals manage their specialists/availability/appointments, and a super admin verifies hospitals.

Companion backend: [`Kindamba`](../Kindamba) (Django REST Framework API) — its README is the source of truth for exact request/response shapes; this document explains how this app calls into it.

## Table of contents

- [Tech stack](#tech-stack)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Authentication in detail](#authentication-in-detail)
- [The API client](#the-api-client-srclibapi-clientts)
- [API modules — every function and the endpoint it calls](#api-modules--every-function-and-the-endpoint-it-calls)
- [Routes](#routes)
- [Known gaps / caveats](#known-gaps--caveats)
- [Pushing changes](#pushing-changes)

## Tech stack

- **Framework:** TanStack Start (React 19, file-based routing via `src/routes/`, SSR with a custom error-page wrapper)
- **Bundler:** Vite 8, configured directly in `vite.config.ts` (Tailwind, tsconfig-paths, `@tanstack/react-start`'s Vite plugin, `nitro` for the production server bundle targeting the `cloudflare-module` preset, `@vitejs/plugin-react`) — no external Lovable build wrapper
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives) — see `components.json` for the shadcn config
- **Data:** TanStack Query for server cache/state, a hand-written `fetch`-based API client for the actual HTTP calls (no generated client, no axios)
- **Routing:** TanStack Router, file-based (`src/routes/`) with an auto-generated `src/routeTree.gen.ts` — never edit that file by hand, it's regenerated on every dev-server file change
- **Forms/validation:** react-hook-form + zod are dependencies, but most forms in this app are currently plain `useState` + manual validation (e.g. `src/lib/phone.ts`'s `normalizeTzPhone`) rather than `react-hook-form` — zod is used for route search-param validation (`validateSearch` in `auth.tsx`)
- **Package manager:** Bun (`bun install`, `bun run dev`, etc.)

## Project layout

```
src/
├── routes/                       # file-based routes — see src/routes/README.md for TanStack Start's routing conventions
│   ├── __root.tsx                 # app shell: <html>, QueryClientProvider, AuthProvider, Toaster, 404/error components
│   ├── index.tsx                  # public nearby-search landing page
│   ├── auth.tsx                   # sign in / patient sign up (phone + password)
│   ├── verify-phone.tsx           # OTP entry screen after registration or an unverified login
│   ├── register-hospital.tsx      # hospital self-registration (2-step form)
│   ├── pending.tsx                # "your hospital is awaiting verification" holding page
│   ├── specialist.$id.tsx         # public specialist detail + booking
│   ├── appointments.tsx           # patient's own appointments
│   ├── hospital.tsx               # hospital admin layout — auth-gates on role hospital_admin, renders <Outlet/>
│   ├── hospital.index.tsx         #   overview (specialist/appointment counts)
│   ├── hospital.specialists.tsx   #   specialist CRUD
│   ├── hospital.availability.tsx  #   availability management (7-day grid)
│   ├── hospital.appointments.tsx  #   appointment management (confirm/cancel/complete)
│   └── admin.tsx                  # super admin dashboard — hospital verification + reports
├── lib/
│   ├── api-client.ts     # fetch wrapper: JWT attach, auto-refresh-on-401, response envelope unwrap
│   ├── api/               # one module per backend Django app — see below
│   │   ├── auth.ts / hospitals.ts / specialists.ts / availability.ts / search.ts / appointments.ts / reports.ts
│   │   └── index.ts       # re-exports all of the above
│   ├── auth-context.tsx   # AuthProvider/useAuth() — current user, derived roles, loading state
│   ├── phone.ts           # normalizeTzPhone/tzPhoneSchema — client-side mirror of the backend's phone validation
│   ├── error-capture.ts / error-page.ts   # SSR crash-page fallback (unrelated to the API; catches unhandled SSR errors)
│   └── utils.ts           # cn() (clsx + tailwind-merge), shadcn convention
├── components/
│   ├── AppHeader.tsx      # top nav — shows signed-in username + role-aware links
│   ├── LocationPicker.tsx # Leaflet map picker used by search + hospital registration
│   ├── StatusBadge.tsx    # AVAILABLE/BUSY/OFF pill
│   └── ui/                # shadcn primitives (button, input, dialog, ...) + password-input.tsx (custom)
├── server.ts / start.ts   # SSR entry points — wrap the TanStack Start handler with a fallback error page
├── router.tsx             # createRouter() + a fresh QueryClient per request
└── styles.css
```

Roles surfaced by `useAuth()` (`src/lib/auth-context.tsx`): `patient`, `hospital_admin`, `super_admin` — mapped from the Django `User.role` enum (`PATIENT`/`HOSPITAL_ADMIN`/`SUPER_ADMIN`) via `ROLE_MAP`. `useAuth()` also exposes `hospitalId` (from `user.hospital`), `loading`, `refresh()` (re-fetches `/api/auth/me/`), and `signOut()`.

## Getting started

### Prerequisites

- [Bun](https://bun.sh) — `bunfig.toml` configures the lockfile format and a 24h supply-chain guard on newly published package versions
- The [Kindamba API](../Kindamba) running locally (or a reachable deployment) — nothing in this app works without it

### Setup

```bash
cd kindamba-ui
bun install
```

Create `.env` (not committed):

| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Kindamba API | `http://localhost:8000` |

If unset, it defaults to `http://localhost:8000` (`src/lib/api-client.ts`, `const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"`).

### Run the dev server

```bash
bun run dev      # vite dev — http://localhost:8080 (server.port is hardcoded in vite.config.ts)
```

Start the Kindamba backend first (`python manage.py runserver` in `../Kindamba/backend`), otherwise every API call fails and most pages render empty/error states.

### Build / preview

```bash
bun run build      # production build — nitro targets the cloudflare-module preset (see vite.config.ts)
bun run preview    # preview the production build locally
```

### Lint / format

```bash
bun run lint       # eslint . — note: there is pre-existing prettier debt across parts of this codebase not touched recently
bun run format     # prettier --write .
```

## Authentication in detail

The UI's auth model mirrors the API exactly: **phone number + password**, not username/email (see the backend README's [Authentication](../Kindamba/README.md#authentication--authorization) section for the server-side rules — phone normalization, OTP TTL, JWT claims, etc.).

### Sign-up / sign-in flow

1. `src/routes/auth.tsx` renders a two-tab form (sign in / create account). Both collect a **phone number** (`type="tel"`, validated client-side with `normalizeTzPhone` from `src/lib/phone.ts` before submitting — same accepted formats as the backend: `0712345678`, `255712345678`, `+255712345678`, with spaces/dashes) and a password (via the custom `PasswordInput` component, see below).
2. Sign-up calls `registerPatient({phone_number, password})` → `POST /api/auth/register/patient/`. Sign-in calls `loginUser({phone_number, password})` → `POST /api/auth/login/`. Both store the returned `access`/`refresh` pair in `localStorage` and immediately call `refresh()` (from `useAuth()`) to populate the current user.
3. After either flow, the user is routed to `/verify-phone` **unless** `user.phone_verified` is already `true`, in which case they land on `redirect` (an optional `?redirect=` search param) or `/`.
4. `src/routes/verify-phone.tsx` collects the 6-digit OTP (`verifyOtp(code)` → `POST /api/auth/verify-otp/`) with a "Resend code" action (`resendOtp()` → `POST /api/auth/resend-otp/`, disabled for 30 seconds after each send to discourage spamming the SMS gateway) and a "Skip for now" link straight to `/` — verification is a UX nudge, not a hard gate; the JWT is already valid regardless of `phone_verified`.

### Hospital registration is a separate flow

`src/routes/register-hospital.tsx` posts to `POST /api/hospitals/register/` with `admin_phone_number` (the admin's future login identity) instead of the patient flow's `phone_number`. **This endpoint does not return tokens** (see backend README) — the new admin is sent to `/auth` to log in manually with `admin_phone_number` + the password they just set, at which point the normal sign-in flow above (step 3) picks up and routes them to `/verify-phone`.

### Password visibility toggle

`src/components/ui/password-input.tsx` wraps the base `Input` shadcn component with an eye/eye-off icon (lucide-react `Eye`/`EyeOff`) that toggles `type="password"` ↔ `type="text"`. Used everywhere a password is entered: `auth.tsx` (both forms) and `register-hospital.tsx`.

### Token refresh — a subtlety worth knowing

`/api/auth/refresh/` is the **one** backend endpoint that doesn't use the standard `{success, data, ...}` envelope (it's DRF-simplejwt's stock view) — it returns a raw `{"access": "...", "refresh": "..."}`. `refreshAccessToken()` in `api-client.ts` parses that raw shape directly (`body.access`, not `body.data?.access`). This was previously broken — it read the response as if it were enveloped, so `body.success` was always `undefined` and every session silently failed to refresh and force-logged the user out ~60 minutes after login (the access token's lifetime) regardless of activity. Fixed; if you ever touch `refreshAccessToken()`, keep this endpoint's raw shape in mind.

## The API client (`src/lib/api-client.ts`)

Everything in `src/lib/api/*.ts` is a thin wrapper around a handful of exported helpers from this one file:

```ts
apiGet<T>(path)                          // GET, returns unwrapped `data`
apiPost<T>(path, body?)                  // POST, JSON.stringify(body)
apiPatch<T>(path, body)                  // PATCH, JSON.stringify(body)
apiDelete<T>(path)                       // DELETE
apiGetPaginated<T>(path, params?)        // GET with query params, returns { items, meta }
```

Behavior common to all of them (`apiFetch`, the shared implementation):

- Reads the access token from `localStorage["kindamba_tokens"]` and attaches `Authorization: Bearer <access>` unless the caller already set that header.
- Sets `Content-Type: application/json` automatically when the body is a JSON string (no multipart/`FormData` support — see [Known gaps](#known-gaps--caveats) re: photo uploads).
- Unwraps the backend's `{success, message, data, errors, meta}` envelope: on `success: true`, callers just get `data` back directly — none of the `lib/api/*.ts` functions deal with the envelope themselves.
- On `success: false`, throws an `Error` whose `.message` is the backend's `message` and whose `.errors` property carries the backend's field-level `errors` dict, so `catch (err) { toast.error(err.message) }` works everywhere without each call site re-parsing the envelope.
- **On a `401`:** attempts exactly one silent refresh-and-retry. Concurrent requests that all 401 at once share a single in-flight refresh (`isRefreshing` flag + `refreshQueue` array of pending resolvers) rather than each firing their own refresh call. If refresh fails, tokens are cleared and the browser is hard-redirected to `/auth` (`window.location.href`), which also aborts whatever the original request's caller was awaiting.

`apiGetPaginated` is separate from the others because it needs the raw `meta.pagination` object (for `count`/`next`/`previous`) rather than just `data` — currently only `listHospitals()` uses it, since `GET /api/hospitals/` is the only backend list endpoint that's actually paginated (every other list endpoint returns a plain array — see the backend README's [Pagination](../Kindamba/README.md#pagination--throttling) section).

## API modules — every function and the endpoint it calls

Each file in `src/lib/api/` corresponds 1:1 to a Django app on the backend. All are re-exported from `src/lib/api/index.ts`, so route components typically `import { X } from "@/lib/api/hospitals"` directly (some also go through the barrel).

### `auth.ts` → `/api/auth/`

| Function | Endpoint | Notes |
|---|---|---|
| `loginUser({phone_number, password})` | `POST /api/auth/login/` | stores tokens on success |
| `registerPatient({phone_number, password, username?, email?})` | `POST /api/auth/register/patient/` | stores tokens on success; triggers a backend OTP send |
| `getMe()` | `GET /api/auth/me/` | called by `AuthProvider` on mount and by `refresh()` |
| `verifyOtp(code)` | `POST /api/auth/verify-otp/` | |
| `resendOtp()` | `POST /api/auth/resend-otp/` | |
| `logout()` | (local only) | clears `localStorage`, no API call |
| `isLoggedIn()` | (local only) | just checks whether a token blob exists in `localStorage` |

### `hospitals.ts` → `/api/hospitals/`

| Function | Endpoint |
|---|---|
| `registerHospital(payload)` | `POST /api/hospitals/register/` |
| `getMyHospital()` | `GET /api/hospitals/me/` |
| `updateMyHospital(data)` | `PATCH /api/hospitals/me/` |
| `verifyHospital(id, status)` | `PATCH /api/hospitals/<id>/verify/` |
| `listHospitals()` | `GET /api/hospitals/` (paginated — unwraps to a flat array via `apiGetPaginated`, discarding pagination metadata; there's no "load more" UI, so results beyond the first page aren't currently reachable) |

### `specialists.ts` → `/api/specialists/`

| Function | Endpoint |
|---|---|
| `createSpecialist(data)` | `POST /api/specialists/` |
| `updateSpecialist(id, data)` | `PATCH /api/specialists/<id>/` |
| `deleteSpecialist(id)` | `DELETE /api/specialists/<id>/delete/` |
| `getHospitalSpecialists()` | `GET /api/specialists/mine/` |
| `getPublicSpecialist(id)` | `GET /api/specialists/public/<id>/` |

### `availability.ts` → `/api/availability/`

| Function | Endpoint |
|---|---|
| `setAvailability(data)` | `POST /api/availability/` |
| `listAvailability({specialist_id?, date_from?, date_to?})` | `GET /api/availability/list/` (query string built manually) |
| `applyScheduleTemplate(data)` | `POST /api/availability/schedule-template/` |

### `search.ts` → `/api/search/`

`searchNearby({lat, lng, specialization?, radius?})` calls `GET /api/search/nearby/` — **this is the one function that bypasses `api-client.ts` entirely** and does its own `fetch` + manual token attachment + manual envelope check. It's public (`AllowAny` on the backend, so attaching a token is optional/best-effort here), but the duplicated logic means it won't benefit from future changes to `apiFetch` (e.g. the 401-refresh flow) — worth consolidating into the shared client if this endpoint ever starts requiring auth.

### `appointments.ts` → `/api/appointments/`

| Function | Endpoint |
|---|---|
| `createAppointment(data)` | `POST /api/appointments/` |
| `getMyAppointments()` | `GET /api/appointments/mine/` |
| `getHospitalAppointments()` | `GET /api/appointments/hospital/` |
| `updateAppointmentStatus(id, status)` | `PATCH /api/appointments/<id>/status/` |

The local `Appointment` type declares optional `specialist_detail`/`hospital_detail` nested objects that **the backend never actually returns** — the real `AppointmentSerializer` sends flat `specialist_name`/`hospital_name`/`patient_name` strings instead (documented in the backend README). Nothing currently reads `specialist_detail`/`hospital_detail`, so it's dead code rather than an active bug, but don't rely on those fields being populated if you start using them.

### `reports.ts` → `/api/reports/`

| Function | Endpoint |
|---|---|
| `getOverviewReport()` | `GET /api/reports/overview/` |
| `getSearchReport()` | `GET /api/reports/searches/` |

Both `Super Admin`-only on the backend; only `admin.tsx` calls these.

## Routes

| Route | File | Access | Talks to |
|---|---|---|---|
| `/` | `index.tsx` | public | `search.ts: searchNearby` |
| `/auth` | `auth.tsx` | public (redirects away if already signed in) | `auth.ts: loginUser, registerPatient` |
| `/verify-phone` | `verify-phone.tsx` | signed in, unverified (redirects to `/auth` if signed out, to `/` if already verified) | `auth.ts: verifyOtp, resendOtp` |
| `/register-hospital` | `register-hospital.tsx` | public | `hospitals.ts: registerHospital` |
| `/pending` | `pending.tsx` | signed-in hospital admin whose hospital isn't verified yet | `hospitals.ts: getMyHospital` |
| `/specialist/$id` | `specialist.$id.tsx` | public detail, booking requires sign-in | `specialists.ts: getPublicSpecialist`, `availability.ts: listAvailability`, `appointments.ts: createAppointment` |
| `/appointments` | `appointments.tsx` | patient | `appointments.ts: getMyAppointments, updateAppointmentStatus` |
| `/hospital` (layout) | `hospital.tsx` | hospital_admin — redirects to `/auth` if signed out, to `/` if wrong role | `hospitals.ts: getMyHospital` |
| `/hospital/` | `hospital.index.tsx` | hospital_admin | `specialists.ts: getHospitalSpecialists`, `appointments.ts: getHospitalAppointments` |
| `/hospital/specialists` | `hospital.specialists.tsx` | hospital_admin | `specialists.ts` (full CRUD) |
| `/hospital/availability` | `hospital.availability.tsx` | hospital_admin | `availability.ts` (7-day grid, per specialist) |
| `/hospital/appointments` | `hospital.appointments.tsx` | hospital_admin | `appointments.ts: getHospitalAppointments, updateAppointmentStatus` (30s polling via `refetchInterval`) |
| `/admin` | `admin.tsx` | super_admin | `hospitals.ts: listHospitals, verifyHospital`, `reports.ts: getOverviewReport` |

Routing conventions (file → URL mapping, dynamic/splat segments) are documented in [`src/routes/README.md`](src/routes/README.md) — don't create `src/pages/` or Next.js-style directories, this is TanStack Start's own file-based router.

## Known gaps / caveats

- **Specialist photo upload doesn't actually work end-to-end.** `createSpecialist({..., photo: File})` passes the `File` through `apiPost`, which unconditionally `JSON.stringify`s the request body — a `File` object serializes to `{}`, so the photo is silently dropped before it ever reaches the network. Even if that were fixed with real `multipart/form-data` handling, the backend has no `MEDIA_ROOT`/`MEDIA_URL` configured (see the backend README), so uploaded images wouldn't be served back anyway. Treat photo upload as unimplemented, not just untested.
- **`listHospitals()` discards pagination.** The admin dashboard shows only the first page (25) of hospitals; there's no "load more" affordance if you have more than that in a real deployment.
- **`searchNearby` bypasses the shared API client** (see above) — no 401-retry benefit, and it's the only place phone/pagination-envelope logic is duplicated instead of reused.
- **Pre-existing prettier debt.** `bun run lint` reports formatting violations in files unrelated to recent changes (mostly older route files) — not something introduced by any change described in this README, but worth knowing before assuming `lint` output is a regression.

## Pushing changes

This repo is separate from the backend (`Kindamba`) and has its own git history and remote — commit and push it independently, on `main`:

```bash
git status
git add <files>
git commit -m "..."
git push origin main
```
