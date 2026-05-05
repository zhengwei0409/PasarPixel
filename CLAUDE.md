
## Project Overview

A **web-based marketplace platform** that supports both:
- **Traditional licensing** — buyers purchase usage rights for multimedia assets
- **Blockchain-based ownership** — assets tokenised as NFTs on the Solana blockchain

---

## System Architecture

6-layer microservices architecture:

```
Client Layer (React SPA + Phantom Wallet)
        ↓ HTTPS
API Gateway Layer (Kong)
        ↓ Routes by URL path
Backend Services Layer
  ├── Auth Service         → authentication & authorisation (OAuth 2.0, Google Sign-In)
  ├── Main API Service     → core business logic (users, listings, orders, admin panel)
  └── Blockchain Service  → NFT minting, transfer, ownership verification
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
| Phantom Wallet | Solana wallet integration |

### API Gateway
| Technology | Role |
|---|---|
| Kong | Request routing, rate limiting, logging, load balancing |

### Back-End Services
| Technology | Role |
|---|---|
| Node.js + Express.js | Main API Service |
| TypeScript | Type safety across back-end |
| OAuth 2.0 + Google Sign-In | Auth Service |
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
│   │   ├── pages/                   # Route-level page components
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/                     # API clients, Phantom wallet utils
│   │   ├── store/                   # Global state management
│   │   └── types/                   # Frontend TypeScript types
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── tsconfig.json
│
├── services/
│   ├── auth-service/                # OAuth 2.0 + Google Sign-In
│   │   └── src/
│   │       ├── controllers/
│   │       ├── middleware/
│   │       ├── routes/
│   │       └── types/
│   │
│   ├── main-api/                    # Core business logic (users, listings, orders)
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── controllers/
│   │       ├── middleware/
│   │       ├── routes/
│   │       ├── services/
│   │       └── types/
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
│       └── kong.yml                 # Kong routing + rate limiting config
│
├── infra/
│   ├── docker/
│   │   └── docker-compose.yml       # Spins up all services locally
│   └── scripts/
│       └── seed.ts                  # Database seed script
│
├── shared/
│   ├── types/                       # Shared TypeScript types across services
│   └── utils/                       # Shared helper functions
│
├── .gitignore
├── README.md
└── CLAUDE.md
```

Check `FunctionalRequirement.md` for functional requirement. 
Check `DatabaseRelationship.md` for database info. 
