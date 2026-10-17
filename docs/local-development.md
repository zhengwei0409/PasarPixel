# Local development

Follow the [README quick start](../README.md#run-locally) to create your `.env` files and start Docker. Run the commands in this guide from the project root.

## Credentials

Each `.env.example` lists the settings for its service. Copy the examples once, then fill in your own development credentials. Docker Compose supplies `DATABASE_URL`, `RABBITMQ_URL`, and the internal URLs configured in the Compose file.

| Service | Settings to configure |
|---|---|
| `auth-service` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random `JWT_SECRET` |
| `main-api` | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PRESIGNED_URL_EXPIRES_IN`, `DOWNLOAD_TOKEN_SECRET`, `DOWNLOAD_TOKEN_EXPIRES_IN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `CLIENT_URL=http://localhost:5173` |
| `notification-service` | `RESEND_API_KEY` and `AUTH_SERVICE_URL=http://auth-service:3001` |
| `blockchain-service` | Leave `MINT_ENABLED=false` and `PURCHASE_ENABLED=false` until you follow the [blockchain setup guide](blockchain-setup.md) |
| `client` | `VITE_API_URL=http://localhost:8000` |

Get Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/), S3 credentials from AWS, Stripe **test-mode** keys from the [Stripe dashboard](https://dashboard.stripe.com/test/apikeys), and an email API key from [Resend](https://resend.com/).

For local Google sign-in, use this callback URL:

```text
http://localhost:8000/auth/google/callback
```

Generate each application secret separately, for example:

```bash
openssl rand -hex 32
```

Use the generated value for `JWT_SECRET`, and generate a different value for `DOWNLOAD_TOKEN_SECRET`. Set expiry values such as `S3_PRESIGNED_URL_EXPIRES_IN` and `DOWNLOAD_TOKEN_EXPIRES_IN` to `900` seconds to start.

`INTERNAL_SERVICE_TOKEN` is needed for SOL checkout. The value must match in your local auth-service, main-api, and blockchain-service. It can differ from another developer's token or the EC2 token.

## Test Stripe payments

Install and sign in to the [Stripe CLI](https://stripe.com/docs/stripe-cli), then forward webhook events to your local API:

```bash
stripe listen --forward-to http://localhost:8000/checkout/webhook
```

Keep this command running. Copy its `whsec_...` signing secret into `STRIPE_WEBHOOK_SECRET` in `services/main-api/.env`, then recreate main-api so it loads the updated setting:

```bash
docker compose -f infra/docker/docker-compose.yml up -d --build main-api
```

Use test card `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. A successful webhook marks the order `COMPLETED` and clears the cart.

## Common setup issues

| Problem | First thing to check |
|---|---|
| The app does not open | Docker Desktop is running and `docker compose -f infra/docker/docker-compose.yml ps` shows running services |
| A backend keeps restarting | Check its logs and confirm its required `.env` values are filled in |
| Settings changes do not take effect | Recreate the affected service with `docker compose -f infra/docker/docker-compose.yml up -d SERVICE_NAME` |
| Stripe payment stays pending | Keep `stripe listen` running and check that its current signing secret matches `STRIPE_WEBHOOK_SECRET` |
| Minting or SOL checkout is unavailable | These features are disabled by default; complete the [blockchain setup](blockchain-setup.md) first |

For example, view auth-service logs with:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f auth-service
```

Database migrations run when services start. The local development setup also seeds auth-service and main-api; it does not import data from EC2 or another developer's machine.

## Run checks outside Docker

Install Node.js 24 and pnpm 10.33.3 if you want to run scripts directly on your computer:

```bash
pnpm install
pnpm --filter client build
pnpm --filter blockchain-service test
```

See the [blockchain guide](blockchain-setup.md) for database integration tests and Devnet checks.
