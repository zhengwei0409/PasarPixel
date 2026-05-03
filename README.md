# PasarPixel

A web-based marketplace for buying and selling digital assets — supporting both traditional licensing and blockchain-based NFT ownership on Solana.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, shadcn/ui |
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
├── client/                  # React frontend
├── services/
│   ├── auth-service/        # Authentication & authorisation (OAuth 2.0, Google Sign-In)
│   ├── main-api/            # Core business logic (users, listings, orders)
│   └── blockchain-service/  # NFT minting, transfer, ownership (Solana + Metaplex)
├── gateway/
│   └── kong/                # Kong API gateway config
├── infra/
│   ├── docker/              # Docker Compose for local development
│   └── scripts/             # Database seed scripts
└── shared/                  # Shared TypeScript types and utilities
```

---

## User Roles

| Role | Description |
|---|---|
| Admin | Platform management, content moderation |
| Seller | Upload and list digital assets |
| Buyer | Browse and purchase digital assets |

---

## Blockchain

- Network: **Solana Devnet** (development)
- NFT Standard: **Metaplex**
- Wallet: **Phantom Wallet** (browser extension)
