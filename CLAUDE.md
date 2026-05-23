
## Project Overview

A **web-based marketplace platform** that supports both:
- **Traditional licensing** — buyers purchase usage rights for multimedia assets
- **Blockchain-based ownership** — assets tokenised as NFTs on the Solana blockchain
- Monorepo with pnpm as package manager.

---

## System Architecture

6-layer microservices architecture:

```
Client Layer (React SPA + Phantom Wallet)
        ↓ HTTPS
API Gateway Layer (Kong)
        ↓ Routes by URL path
Backend Services Layer
  ├── Auth Service          → authentication & authorisation (OAuth 2.0, Google Sign-In)
  ├── Main API Service      → core business logic (users, listings, orders, admin panel)
  ├── Notification Service  → email (Resend) + in-app notifications (RabbitMQ consumers + REST API)
  └── Blockchain Service    → NFT minting, transfer, ownership verification
        ↓ async tasks
Message Queue Layer (RabbitMQ)
        ↓
Data Layer
  ├── PostgreSQL           → structured data (users, products, transactions, RBAC)
  └── Amazon S3            → object storage (images, 3D models, multimedia files)
        ↓
External Services
  ├── Stripe               → payment processing
  ├── Resend               → transactional email
  └── Solana Devnet        → blockchain test network
```

---

## Tech Stack

### Client Layer
| Technology | Role |
|---|---|
| React | Component-based UI library |
| TypeScript | Static type checking |
| Vite | Build tool & dev server |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Pre-built accessible UI components |
| TanStack Query | Server state management (caching, refetching, mutations) |
| React Hook Form + Zod | Form state & validation |
| Axios | HTTP client |
| Phantom Wallet | Solana wallet integration |

### API Gateway
| Technology | Role |
|---|---|
| Kong | Request routing, rate limiting, logging, load balancing |

### Back-End Services
| Technology | Role |
|---|---|
| Node.js + Express.js | Auth, Main API, Notification services |
| TypeScript | Type safety across back-end |
| OAuth 2.0 + Google Sign-In | Auth Service |
| Resend | Notification Service — transactional email |
| Solana + Metaplex | Blockchain Service — NFT operations |

### Data & Storage
| Technology | Role |
|---|---|
| PostgreSQL | Primary relational database |
| Prisma | ORM — type-safe queries with TypeScript |
| Amazon S3 | Object storage for digital asset files |

### Service Communication
| Technology | Role |
|---|---|
| RabbitMQ | Async message broker between services |

### External Services
| Technology | Role |
|---|---|
| Stripe | Payment processing |
| Resend | Transactional email |
| Solana Devnet | Blockchain test network |

### Infrastructure
| Technology | Role |
|---|---|
| Docker | Containerisation of all services |
| Git + GitHub | Version control |

---

## User Roles

| Role | Description |
|---|---|
| **Admin** | Platform management — users, content moderation, monitoring |
| **Seller** | Upload and list digital assets |
| **Buyer** | Browse and purchase digital assets |

---

## Development Notes

- **Language:** TypeScript throughout (front-end and back-end)
- **Blockchain Network:** Solana **Devnet** during development
- **Containerisation:** Docker Compose to run all services locally
- **Testing:** Functional testing + UAT planned

### Architectural Conventions

- **API Gateway:** All client traffic goes through Kong (`http://localhost:8000`). Backend services are not exposed to the host — they communicate over Docker's internal network. CORS is configured once at Kong, not per-service.
- **Frontend HTTP:** One `apiClient.ts` (axios) with base URL `import.meta.env.VITE_API_URL`. Token interceptor auto-attaches Bearer except for public auth paths.
- **Service-to-service auth:** Services that need to know the caller's identity (main-api, notification-service) call `auth-service`'s `/auth/me` via HTTP to verify the JWT and fetch roles — not by sharing `JWT_SECRET`.
- **Pub/sub events:** RabbitMQ **fanout exchanges**. Exchange name = event name (e.g. `user.registered`). Each consumer service binds its own named queue (e.g. `user.registered.main-api`, `user.registered.notification`) so all consumers receive every message.
- **Notification consumers** must isolate email failures from in-app writes — wrap `sendEmail()` in its own try/catch so a Resend failure doesn't drop the DB notification record.
- **Shared constants:** Exchange names live in `shared/utils/messaging.ts`. Event payload types live in `shared/types/events.ts`.


## Project Structure

```
PasarPixel/
├── client/                          # React frontend (Vite + Tailwind + shadcn/ui)
│   ├── public/                      # Static assets (favicon, robots.txt)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui base components
│   │   │   ├── layout/              # Navbar, Footer, PageWrapper
│   │   │   └── marketplace/         # Listing cards, filters, asset preview
│   │   ├── pages/                   # Route-level page components (UI only)
│   │   ├── hooks/                   # TanStack Query hooks (useX, useUpdateX)
│   │   ├── services/                # API functions: one function per endpoint
│   │   ├── types/                   # Shared TypeScript types
│   │   └── lib/                     # Infrastructure (apiClient, queryClient, helpers)
│   ├── .env                         # VITE_API_URL (Kong gateway URL)
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── services/
│   ├── auth-service/                # OAuth 2.0 + Google Sign-In, publishes user.registered & password.reset events
│   │   └── src/
│   │       ├── controllers/
│   │       ├── middleware/
│   │       ├── routes/
│   │       ├── lib/                 # rabbitmq publisher, consumer, prisma
│   │       └── types/
│   │
│   ├── main-api/                    # Core business logic (users, listings, seller applications)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── controllers/
│   │       ├── middleware/          # auth.middleware verifies JWT via HTTP call to auth-service
│   │       ├── routes/
│   │       ├── lib/                 # rabbitmq publisher (seller.approved/rejected), consumer (user.registered)
│   │       ├── services/
│   │       └── types/
│   │
│   ├── notification-service/        # Email (Resend) + in-app notifications
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Notification model
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── consumers/           # RabbitMQ consumers (user.registered, password.reset, seller.approved, seller.rejected)
│   │       ├── controllers/         # REST API for notification list / mark-read
│   │       ├── middleware/          # auth.middleware (same pattern as main-api)
│   │       ├── routes/
│   │       └── lib/                 # rabbitmq, prisma, resend
│   │
│   └── blockchain-service/          # Solana NFT minting, transfer, verification
│       └── src/
│           ├── controllers/
│           ├── routes/
│           ├── services/
│           └── types/
│
├── gateway/
│   └── kong/
│       └── kong.yml                 # Kong routes (DB-less mode) + global CORS plugin
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml       # Spins up all services locally (Kong is the only host-exposed gateway)
│   └── scripts/
│       └── seed.ts                  # Database seed script
│
├── shared/
│   ├── types/                       # Shared event payloads (UserRegisteredEvent, SellerApprovedEvent, etc.)
│   └── utils/                       # Shared helpers (messaging.ts — RabbitMQ exchange name constants)
│
├── .gitignore
├── README.md
└── CLAUDE.md
```

Check `FunctionalRequirement.md` for functional requirement. 
Check `DatabaseRelationship.md` for database info. 

