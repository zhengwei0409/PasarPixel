# PasarPixel

A web-based marketplace for buying and selling digital assets — supporting both traditional licensing and blockchain-based NFT ownership on Solana.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| API Gateway | Kong |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL, Prisma ORM |
| Storage | Amazon S3 |
| Blockchain | Solana, Metaplex |
| Message Queue | RabbitMQ |
| Payments | Stripe |
| Email | Resend |
| Infrastructure | Docker, Docker Compose |

---

## Project Structure

```
PasarPixel/
├── client/                  # React frontend (4-layer: lib → services → hooks → pages)
├── services/
│   ├── auth-service/         # Authentication & authorisation (OAuth 2.0, Google Sign-In)
│   ├── main-api/             # Core business logic (users, listings, orders)
│   ├── notification-service/ # Email + in-app notifications (RabbitMQ consumers + REST API)
│   └── blockchain-service/   # NFT minting, transfer, ownership (Solana + Metaplex)
├── gateway/
│   └── kong/                 # Kong API gateway config (kong.yml, DB-less mode)
├── infra/
│   └── docker/               # Docker Compose for local development
└── shared/
    ├── types/                # Shared event payloads + DTOs across services
    └── utils/                # Shared helpers (e.g. RabbitMQ exchange names)
```

---

## User Roles

| Role | Description |
|---|---|
| Admin | Platform management, content moderation |
| Seller | Upload and list digital assets |
| Buyer | Browse and purchase digital assets |

---

## Service Communication

All client requests go through **Kong API Gateway** (`localhost:8000`) which routes to backend services on the internal Docker network. Backend services are not exposed to the host.

Asynchronous events between services use **RabbitMQ fanout exchanges** for pub/sub — one publisher can broadcast to multiple consumer queues (e.g. `user.registered` triggers both `main-api` profile creation and `notification-service` welcome email).

---

## Blockchain

- Network: **Solana Devnet** (development)
- NFT Standard: **Metaplex**
- Wallet: **Phantom Wallet** (browser extension)
