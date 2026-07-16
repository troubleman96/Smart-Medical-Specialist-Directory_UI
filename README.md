# Kindamba UI — Smart Medical Specialist Directory

Patient/hospital/admin web app for the Kindamba Smart Medical Specialist Directory. Built with [TanStack Start](https://tanstack.com/start) (React 19, file-based routing, SSR) and talks to the [`Kindamba`](../Kindamba) Django REST API for all data — patients search nearby specialists, hospitals manage their specialists/availability/appointments, and a super admin verifies hospitals.

Companion backend: [`Kindamba`](../Kindamba) (Django REST Framework API).

## Tech stack

- **Framework:** TanStack Start (React 19, file-based routing via `src/routes/`, SSR)
- **Bundler:** Vite 8 + `@lovable.dev/vite-tanstack-config`
- **Styling:** Tailwind CSS 4 + shadcn/ui (Radix primitives)
- **Data:** TanStack Query for server state, `fetch`-based API client with JWT auth
- **Forms/validation:** react-hook-form + zod
- **Package manager:** Bun

## Project layout

```
src/
├── routes/              # file-based routes (see src/routes/README.md for conventions)
│   ├── index.tsx             # public nearby-search landing page
│   ├── auth.tsx               # login / patient registration
│   ├── register-hospital.tsx  # hospital self-registration
│   ├── pending.tsx             # hospital awaiting verification
│   ├── specialist.$id.tsx      # public specialist detail + booking
│   ├── appointments.tsx        # patient's appointments
│   ├── hospital.tsx             # hospital admin layout (auth-gated)
│   ├── hospital.index.tsx        #   overview
│   ├── hospital.specialists.tsx  #   specialist CRUD
│   ├── hospital.availability.tsx #   availability management
│   ├── hospital.appointments.tsx #   appointment management
│   └── admin.tsx                  # super admin dashboard (hospital verification, reports)
├── lib/
│   ├── api-client.ts     # fetch wrapper: JWT attach, auto-refresh, response envelope unwrap
│   ├── api/               # one module per backend app (auth, hospitals, specialists, availability, search, appointments, reports)
│   ├── auth-context.tsx   # AuthProvider — current user, roles, loading state
│   └── phone.ts
├── components/            # AppHeader, LocationPicker, StatusBadge, ui/ (shadcn primitives)
├── server.ts / start.ts   # SSR entry points
└── router.tsx
```

Roles surfaced by `useAuth()` (`src/lib/auth-context.tsx`): `patient`, `hospital_admin`, `super_admin` — mapped from the Django `User.role` enum.

## Getting started

All data comes from the Django API — there is no other backend or BaaS involved.

### Prerequisites

- [Bun](https://bun.sh) (used for install/dev/build — `bunfig.toml` configures the lockfile and a 24h supply-chain guard on new package versions)
- The [Kindamba API](../Kindamba) running locally (or a reachable deployment)

### Setup

```bash
cd kindamba-ui
bun install

cp .env.example .env    # if present — otherwise create .env with the var below
```

`.env`:

| Variable | Purpose | Example |
|---|---|---|
| `VITE_API_BASE_URL` | Base URL of the Kindamba API | `http://localhost:8000` |

If unset, it defaults to `http://localhost:8000` (see `src/lib/api-client.ts`).

### Run the dev server

```bash
bun run dev      # vite dev — http://localhost:8080 (see server.port in vite.config.ts)
```

Make sure the Kindamba backend is running first (`python manage.py runserver` in `../Kindamba/backend`), otherwise API calls will fail.

### Build / preview

```bash
bun run build      # production build (nitro targets the cloudflare-module preset — see vite.config.ts)
bun run preview    # preview the production build locally
```

### Lint / format

```bash
bun run lint
bun run format
```

## Auth flow

- Login/registration hit `/api/auth/login/` and `/api/auth/register/patient/` on the Django API; the response's JWT `access`/`refresh` pair is stored in `localStorage` under `kindamba_tokens` (`src/lib/api-client.ts`).
- `apiFetch` attaches `Authorization: Bearer <access>` to every request and transparently refreshes the access token on a `401` via `/api/auth/refresh/`, retrying the original request once. If refresh fails, tokens are cleared and the user is redirected to `/auth`.
- `AuthProvider` (`src/lib/auth-context.tsx`) loads the current user via `/api/auth/me/` on mount and exposes `user`, `roles`, and `hospitalId` through `useAuth()`; routes gate on `roles` (e.g. `hospital.tsx` requires `hospital_admin`).

## Pushing changes

This repo is separate from the backend (`Kindamba`) and has its own git history and remote — commit and push it independently, on `main`:

```bash
git status
git add <files>
git commit -m "..."
git push origin main
```
