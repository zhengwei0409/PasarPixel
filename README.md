# PasarPixel

A marketplace for digital assets with traditional payments and Solana Devnet NFT licenses.

**Buyers** purchase and download assets. **Sellers** upload and sell their work. **Admins** review listings and manage the platform.

## Run locally

Install **Git** and **Docker Desktop**, then open the project folder in your terminal. Run all commands below from that folder.

### 1. Create your environment files

These files store the settings and credentials used by each service:

```bash
cp services/auth-service/.env.example services/auth-service/.env
cp services/main-api/.env.example services/main-api/.env
cp services/notification-service/.env.example services/notification-service/.env
cp services/blockchain-service/.env.example services/blockchain-service/.env
printf 'VITE_API_URL=http://localhost:8000\n' > client/.env
```

Do this once. Keep your existing `.env` files when updating the project.

### 2. Fill in your credentials

Open the new `.env` files and configure Google sign-in, S3 storage, Stripe test payments, Resend email, and the application secrets. The [local setup guide](docs/local-development.md#credentials) explains which values go in each service.

Leave `MINT_ENABLED=false` and `PURCHASE_ENABLED=false` for your first run. Docker supplies the database and message queue connection settings.

### 3. Start the app

Make sure Docker Desktop is running:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

Open **[http://localhost:5173](http://localhost:5173)**. The API gateway runs at `http://localhost:8000`. Services run their database migrations automatically.

For payment webhooks and common setup issues, see the [local setup guide](docs/local-development.md).

## Try blockchain features

Install **Phantom** in your browser, sign in, and open **Settings → Phantom wallet** to connect and verify your wallet. Wallet verification does not require SOL.

Minting and SOL checkout need additional setup: a funded Devnet sponsor key and, for checkout, a shared internal token. Follow the [blockchain setup guide](docs/blockchain-setup.md). Use test SOL only.

## Everyday commands

View service status and logs:

```bash
docker compose -f infra/docker/docker-compose.yml ps
docker compose -f infra/docker/docker-compose.yml logs -f
```

Stop the app while keeping its database data:

```bash
docker compose -f infra/docker/docker-compose.yml down
```

## Project layout

```text
client/       React frontend
services/     Auth, main API, notifications, and blockchain services
gateway/      Kong API gateway
shared/       Code shared by services and the frontend
programs/     Solana purchase smart contract
infra/        Docker and EC2 deployment configuration
docs/         Setup guides and project documentation
```

Built with React, TypeScript, Node.js, PostgreSQL, Prisma, RabbitMQ, Amazon S3, Stripe, Resend, Solana, and Docker.

## Documentation

| Guide | What it covers |
|---|---|
| [Local setup](docs/local-development.md) | Credentials, Stripe webhooks, and troubleshooting |
| [Blockchain setup](docs/blockchain-setup.md) | Sponsor wallet, minting, SOL checkout, and testing |
| [EC2 deployment](docs/ec2-deployment.md) | Server configuration and CI/CD deployment |
| [Blockchain design](docs/BlockchainDesign.md) | NFT rules, smart contract, and verification |
| [Requirements](docs/FunctionalRequirement.md) | Application features and user roles |
| [Database](docs/DatabaseRelationship.md) | Data models and relationships |

Keep `.env` files and wallet private keys out of Git. Share only the test credentials a teammate needs, using a secure channel.
