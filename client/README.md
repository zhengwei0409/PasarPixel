# PasarPixel — Client

The React frontend for **PasarPixel**, a web-based marketplace for digital multimedia assets. Buyers can purchase usage licences or acquire blockchain-backed NFT ownership via Solana; sellers can list and manage their digital products.

All HTTP traffic is routed through the Kong API Gateway — the client never calls backend services directly.

---

## Tech Stack

| Technology | Role |
|---|---|
| React 19 + TypeScript | UI library with static type safety |
| Vite | Build tool & dev server |
| Tailwind CSS v4 | Utility-first styling |
| shadcn/ui + Radix UI | Accessible, pre-built UI components |
| TanStack Query v5 | Server state management (caching, refetching, mutations) |
| React Hook Form + Zod | Form state & schema validation |
| Axios | HTTP client with JWT interceptor |
| React Router v7 | Client-side routing |
| Phantom Wallet | Solana wallet integration |

---

## Project Structure

```
src/
├── pages/          # Route-level page components (UI only, no data-fetching logic)
├── components/
│   ├── ui/         # shadcn/ui base components
│   └── layout/     # Navbar, Footer, PageWrapper, ProtectedRoute
├── hooks/          # TanStack Query hooks — one hook per resource (useAuth, useProfile, ...)
├── services/       # API functions — one function per endpoint (authService, profileService, ...)
├── types/          # Shared TypeScript types (auth, profile, notification, sellerApplication)
└── lib/
    ├── apiClient.ts    # Axios instance — base URL from VITE_API_URL, auto-attaches Bearer token
    ├── queryClient.ts  # TanStack Query client config
    ├── errors.ts       # Centralised error handling helpers
    └── utils.ts        # General utility functions
```

---

## Getting Started

### Prerequisites

- Docker + Docker Compose
- The `.env` file configured (see below)

### Configure environment

```env
VITE_API_URL=http://localhost:8000   # Kong gateway — do not point directly at individual services
```

### Start the full stack

Run everything (client + all backend services + Kong) from the repo root:

```bash
docker compose up --build
```

The client will be available at `http://localhost:5173`.

---

## Architecture Notes

- **Single API client** — `src/lib/apiClient.ts` is the only place that creates an Axios instance. All services import from it. The JWT Bearer token is attached automatically via a request interceptor; public auth paths are excluded.
- **Pages vs hooks** — Pages are pure UI. All data-fetching and mutation logic lives in `src/hooks/`. Pages consume hooks and pass data down to components.
- **Services layer** — `src/services/` contains plain async functions that call the API. Hooks wrap these functions with TanStack Query (`useQuery` / `useMutation`). Services have no query caching knowledge.
- **Protected routes** — `src/components/ProtectedRoute.tsx` guards routes by role (Admin, Seller, Buyer). Unauthenticated users are redirected to `/login`; unauthorised users land on `/403`.

---

## Available Scripts

These are for one-off local use (e.g. type-checking, linting) — normal development runs via Docker Compose.

| Script | Description |
|---|---|
| `pnpm build` | Type-check + production build |
| `pnpm lint` | Run ESLint |

---

## Docker

A `Dockerfile` is included for containerised deployments. The image is built and orchestrated alongside the backend services via the root `docker-compose.yml`.
