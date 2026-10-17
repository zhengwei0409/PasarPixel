#!/bin/sh
set -eu

# Compose waits for PostgreSQL health. Migration errors should fail visibly.
pnpm exec prisma migrate deploy
exec pnpm start
