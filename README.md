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
- NFT Standard: **Metaplex Core** (v1 design)
- Wallet: **Phantom Wallet** (browser extension)

Wallet binding is implemented: sign in, open **Settings → Phantom wallet**, then connect and sign the five-minute verification message. Disconnecting Phantom preserves the account binding. The service uses its own PostgreSQL `blockchain` schema; Docker Compose runs its migrations automatically.

Seller Master NFT minting is implemented behind `MINT_ENABLED`. SOL checkout and buyer License NFTs remain future work. The [Blockchain v1 Design](docs/BlockchainDesign.md) defines their rules.

For local testing, start Docker Desktop and run `docker compose -f infra/docker/docker-compose.yml up -d --build` from the project root. Open `http://localhost:5173` in the browser where Phantom is installed. Wallet binding only signs a message; no SOL or funding is required. Disconnect and reload to confirm the bound address is still saved.

Automated checks: `pnpm --filter blockchain-service test`, `pnpm --filter auth-service test`, and `node --test client/tests/wallet-binding.test.cjs`. PostgreSQL integration tests use `TEST_DATABASE_URL=<local-test-database-url> pnpm --filter blockchain-service test:integration`; the runner creates and removes its own temporary schema.

To enable seller minting on Devnet:

1. Copy `services/blockchain-service/.env.example` to `.env` if it does not exist. Keep `MINT_ENABLED=false` during setup.
2. Run `pnpm --filter blockchain-service wallet:create` once. This creates a dedicated key file in the ignored `.secrets` directory and prints only its public address. It refuses to overwrite an existing file. Keep the file private and backed up; retries derive the same NFT signer from this key and the saved mint reference.
3. Request free **Devnet SOL** for the printed address at [Solana Faucet](https://faucet.solana.com/). No real SOL is needed. Use a dedicated test sponsor, not a wallet with real funds.
4. Set `MINT_ENABLED=true` in the blockchain service `.env`. Keep `SOLANA_RPC_URL` on Devnet; the service checks the full Devnet genesis hash before building, sending or verifying transactions. Sponsorship defaults to a maximum of 0.03 Devnet SOL per mint, checked by simulation before sending.
5. Rebuild locally with `docker compose -f infra/docker/docker-compose.yml up -d --build`. Compose mounts the private sponsor directory read-only and runs both services' migrations. For EC2, create/fund a dedicated sponsor on the server and keep it outside the image; Compose sets public metadata URLs to the HTTPS `/api` endpoint.
6. Sign in as a seller with a bound Phantom wallet. Upload a Blockchain listing, set at least one Personal / Commercial SOL price, and obtain admin approval. In **My Listings**, click **Mint Master NFT** and approve the purpose-specific message in Phantom. No SOL is transferred from the seller wallet. Wait for **Master NFT ready**, then inspect the Devnet Explorer link.

Minting locks the bound wallet while preparation, authorization or confirmation is pending, and permanently after the NFT is ready. Cancelling a signature leaves the approval pending for up to five minutes. A pre-send failure or a definitively failed/expired transaction can be retried; unknown RPC results stay pending. Signed transaction bytes are stored before broadcast, and the background worker recovers after restart without creating a second NFT address. The Master is frozen against transfer/burn, has immutable metadata, and relinquishes update authority in the same transaction.

Public metadata and previews are served from immutable, content-addressed database records; PostgreSQL triggers reject updates/deletes. Original bytes are copied to private S3 `nft-originals/<sha256>` objects using conditional writes, and no download URL or storage key is published. Restrict privileged S3 overwrite/delete access to this prefix in the bucket/IAM configuration as well; changing app code cannot enforce restrictions on external AWS administrators. Retain the database, S3 snapshots and public domain for minted metadata to remain available.

All new NFT display images use the same bundled PasarPixel logo, regardless of asset category or listing cover. The logo is snapshotted as PNG before minting; existing snapshots and minted NFTs retain their original image.

Additional checks: `node --test client/tests/master-mint.test.cjs client/tests/wallet-connection.test.cjs client/tests/sol-price.test.cjs`, `pnpm --filter main-api test`, and `TEST_DATABASE_URL=<local-test-database-url> pnpm --filter main-api test:integration` after generating/building main-api. Both integration suites use isolated temporary schemas. Once the test sponsor is funded, `pnpm --filter blockchain-service test:devnet` performs a real SDK smoke mint and simulates blocked transfer/burn, metadata updates and thaw. Each normal run creates one test-only NFT, separate from marketplace listings. To recheck the saved NFT without another mint, run `node scripts/devnet-smoke.cjs --resume` from the blockchain service directory. Recovery data, including the temporary test owner's keypair, stays in the ignored private `.secrets` file.

Verified on 2026-10-17: [Devnet smoke NFT](https://explorer.solana.com/address/CSvU5rF5dwYGLEf4Qz65jJv2pZFtjzPxCqm7Xp4J7VsZ?cluster=devnet) finalized successfully; owner transfer/burn and sponsor metadata update/thaw simulations were rejected. Metadata immutability uses update authority `None`, because an `ImmutableMetadata` plugin would reject the authority-removal instruction. This SDK test uses a temporary owner wallet; the complete marketplace listing and Phantom approval flow still requires manual testing.
