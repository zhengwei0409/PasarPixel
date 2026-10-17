# EC2 deployment

Push to `main` builds five Linux AMD64 images in GitHub Actions, tags them with
the commit SHA and pushes them to GHCR. The deploy job assumes an AWS role using
OIDC and runs the deployment through SSM. No inbound SSH from GitHub runners is
needed. The existing SSH rule can remain restricted to your IP.

## 1. Publish the deployment files

Review and commit these changes, then push to `main`. Images can build before AWS
setup is finished; the deploy job will fail until its repository variables are set.
The workflow also supports **Actions → Deploy EC2 → Run workflow** on `main`.

After the first build, open each package under your GitHub profile → Packages:
`pasarpixel-auth-service`, `pasarpixel-main-api`,
`pasarpixel-notification-service`, `pasarpixel-blockchain-service`, `pasarpixel-client`.
In each package's settings, change **visibility to public**, so EC2 can pull
without registry credentials. Public repository code does not automatically
make its GHCR packages public. Do not put secrets into Docker images.

## 2. Enable SSM and GitHub OIDC

On your Mac, with AWS CLI authenticated, review then run:

```bash
python3 infra/ec2/setup-aws.py --instance-id i-0c0c2c3720b5d911b
```

This creates an SSM instance role/profile, associates it with the existing EC2,
and creates a GitHub deployment role trusted only by this repository's `main`.
The deployment role can send shell commands only to the specified instance.
That is root command access on this instance: protect `main` and only merge
trusted code. Do not run production deployments for pull requests.

Add the two printed values under repository **Settings → Secrets and variables
→ Actions → Variables**: `EC2_INSTANCE_ID` and `AWS_DEPLOY_ROLE_ARN`.

On EC2, check the SSM agent:

```bash
sudo snap list amazon-ssm-agent
sudo snap start amazon-ssm-agent
```

If it is not installed, install the AWS-supported snap and start it:

```bash
sudo snap install amazon-ssm-agent --classic
sudo snap start amazon-ssm-agent
```

Verify from your Mac (allow a few minutes for registration):

```bash
aws ssm describe-instance-information \
  --filters Key=InstanceIds,Values=i-0c0c2c3720b5d911b \
  --query 'InstanceInformationList[].{ID:InstanceId,Status:PingStatus}' \
  --output table --no-cli-pager
```

It must show `Online`. SSM requires outbound HTTPS connectivity. The instance
does not need a new inbound rule.

## 3. Configure the server

On EC2, after the files have been pushed:

```bash
cd ~/PasarPixel
git pull --ff-only origin main
umask 077
cp infra/docker/.env.ec2.example infra/docker/.env.ec2
cp services/auth-service/.env.example services/auth-service/.env
cp services/main-api/.env.example services/main-api/.env
cp services/notification-service/.env.example services/notification-service/.env
```

Only copy examples on the FIRST setup; preserve filled `.env` files later.

Edit `infra/docker/.env.ec2`: set `ACME_EMAIL` and generate different database
and broker passwords with `openssl rand -hex 32`. Use hex passwords to avoid
URL escaping problems. `IMAGE_TAG` is overridden by the deployment script with
the exact commit SHA. Keep `SITE_ADDRESS=pasarpixel-demo.duckdns.org`.

Fill service `.env` files with your external credentials. Required application
settings include:

- **auth-service:** `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- **main-api:** the same `JWT_SECRET`, `DOWNLOAD_TOKEN_SECRET`,
  `AWS_REGION`, S3 credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`),
  `S3_BUCKET_NAME`, `S3_PRESIGNED_URL_EXPIRES_IN`,
  `DOWNLOAD_TOKEN_EXPIRES_IN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **notification-service:** `RESEND_API_KEY`.
- **blockchain-service:** no external credentials for wallet binding. Master minting additionally needs a dedicated Devnet sponsor in `services/blockchain-service/.secrets/devnet-sponsor.json` and `MINT_ENABLED=true` in the service `.env`. Follow the root README setup on the server; do not reuse a wallet containing real funds. Compose mounts the key directory read-only and supplies its isolated schema, internal service URLs and public HTTPS metadata URL. The Devnet RPC endpoint is configurable and checked against the full genesis hash.

Compose supplies the database/broker URLs, frontend URLs and internal service
URLs. Each service uses its own PostgreSQL schema and migration history in the
same database. This is a new deployment; existing local data is not imported.

Google OAuth uses:

```text
JavaScript origin: https://pasarpixel-demo.duckdns.org
Redirect URI: https://pasarpixel-demo.duckdns.org/api/auth/google/callback
```

For an OAuth app in Testing, add your testers in Google's consent screen.
Google's separate production verification/domain ownership requirements may
require a domain you own; this setup does not bypass those requirements.

Stripe webhook endpoint:

```text
https://pasarpixel-demo.duckdns.org/api/checkout/webhook
```

Subscribe to the events handled by the checkout controller. Use the signing
secret for this endpoint, not a local Stripe CLI signing secret. Keep Stripe in
test mode for the demo. Add the HTTPS origin to S3 CORS if uploads use presigned
URLs. Resend sender-domain requirements are independent of website HTTPS.

## 4. Deploy and check

Run the workflow after SSM is online, variables are set, package visibility is
public and server configuration is filled. The script pulls images first,
waits for container health and checks the public HTTPS URL. Caddy obtains and
persists certificates automatically. Inbound TCP 80 and 443 must be open, and
DuckDNS must point to the current EC2 public IP.

For manual initial deployment, after the image build succeeds:

```bash
cd ~/PasarPixel
sudo bash infra/ec2/deploy.sh "$(git rev-parse HEAD)"
```

Check page refresh, registration/password login, Google login, upload/download,
notifications and Stripe test checkout. Health endpoints check HTTP service
readiness, not successful delivery of emails or queue consumers.

Production seeds only the auth roles; it does not create `admin@test.com` with
a known password or a demo admin profile. Register your own account, then grant
its admin role explicitly if needed. Blockchain-service is included through
Kong's `/blockchain` route (`/api/blockchain` on the public website). Its health
check verifies database connectivity. Settings supports Phantom wallet binding;
Seller Master minting can be enabled after configuring/funding the Devnet sponsor;
buyer License NFTs and SOL purchases are implemented behind `PURCHASE_ENABLED`, and the program / SDK purchase are verified on Devnet. Buyer Phantom UI payment remains a manual check. Keep it false in a fresh server configuration until completing the root README setup steps. Configure the same private `INTERNAL_SERVICE_TOKEN` in auth-service, main-api and blockchain-service; never put it in client env. For the existing program ID, securely migrate the same sponsor authority key and database / snapshots; a newly generated sponsor cannot use its existing Config PDA. Keep key files outside git and container images, then enable purchases. The sponsor must be the deployment upgrade authority for first initialization, and the treasury setting becomes fixed in its Config PDA.

## Maintenance and limits

- SSH stays restricted to **My IP**. Only Caddy publishes host ports.
- Use a fixed Elastic IP or update DuckDNS and SSH targets after EC2 stop/start.
- Back up PostgreSQL and verify restore before important data is stored.
- Deployments can briefly interrupt service and run database migrations. There
  is no automatic database rollback. Take a backup before destructive changes.
- Named volumes persist through updates. Never use `down -v` to update.
- Images are not automatically pruned, so monitor the 20 GiB disk. Remove old
  images carefully while preserving any releases you need for rollback.
- SSM/GitHub configuration is prepared locally; it is not applied by editing
  these files. The user must run setup and provide server-only credentials.

References: [GitHub OIDC on AWS](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws),
[SSM Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/walkthrough-cli.html).
