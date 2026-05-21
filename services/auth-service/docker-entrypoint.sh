#!/bin/sh
set -e

echo "Waiting for postgres to be ready..."
until npx prisma migrate deploy; do
  echo "Migration failed, postgres may not be ready yet. Retrying in 3s..."
  sleep 3
done

echo "Running seed..."
npx prisma db seed || echo "Seed failed or already seeded, continuing..."

echo "Starting auth-service..."
exec pnpm start
