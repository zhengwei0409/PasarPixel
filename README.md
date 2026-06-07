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

## Local Development

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) — for testing payments locally

### 1. Set up environment variables

Each service ships a `.env.example`. Copy it to `.env` and fill in your own keys:

```bash
cp services/auth-service/.env.example         services/auth-service/.env
cp services/main-api/.env.example             services/main-api/.env
cp services/notification-service/.env.example services/notification-service/.env
cp services/blockchain-service/.env.example   services/blockchain-service/.env
```

You'll need credentials from these external services:

| Variable(s) | Where to get it |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/) → OAuth credentials |
| `JWT_SECRET`, `DOWNLOAD_TOKEN_SECRET` | Any random string you generate |
| `RESEND_API_KEY` | [Resend](https://resend.com/) dashboard |
| `AWS_*`, `S3_BUCKET_NAME` | AWS IAM user with S3 access |
| `STRIPE_SECRET_KEY` | [Stripe](https://dashboard.stripe.com/test/apikeys) (test mode) |
| `STRIPE_WEBHOOK_SECRET` | Printed by `stripe listen` (see below) |

The client also needs a `client/.env`:

```bash
echo "VITE_API_URL=http://localhost:8000" > client/.env
```

> `DATABASE_URL`, `RABBITMQ_URL`, and service URLs already point at Docker's internal network in the examples — leave them as-is.

### 2. Start everything

```bash
# Kong gateway on :8000, client on :5173
cd infra/docker && docker compose up -d --build
```

On startup, main-api automatically runs database migrations and seeds the DB — no manual Prisma commands needed.

### Testing Stripe payments locally

Stripe can't reach `localhost`, so the [Stripe CLI](https://stripe.com/docs/stripe-cli) tunnels webhook events to the backend:

```bash
stripe listen --forward-to http://localhost:8000/checkout/webhook
```

- On start it prints a `whsec_...` signing secret — put it in `services/main-api/.env` as `STRIPE_WEBHOOK_SECRET`, then rebuild main-api.
- Pay with test card `4242 4242 4242 4242`, any future expiry, any CVC.
- A successful payment flips the order to `COMPLETED` and clears the cart via the webhook.

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
