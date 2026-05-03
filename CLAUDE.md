
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

## Key Technical Concepts

- **RESTful API** — HTTP REST endpoints for all client-server communication
- **RBAC (Role-Based Access Control)** — Permission enforcement per role at API level
- **Microservices** — Three independent services routed via Kong
- **NFT (Non-Fungible Token)** — Blockchain-based digital ownership on Solana
- **Metaplex** — NFT standard and tooling on Solana
- **Prisma ORM** — TypeScript-native database access over PostgreSQL
- **RabbitMQ** — Decouples services for async tasks (email, blockchain events)

---

## Development Notes

- **Language:** TypeScript throughout (front-end and back-end)
- **Blockchain Network:** Solana **Devnet** during development
- **Containerisation:** Docker Compose to run all services locally
- **Testing:** Functional testing + UAT planned