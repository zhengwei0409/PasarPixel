#!/bin/sh
set -e

echo "Waiting for postgres to be ready..."
until npx prisma migrate deploy; do
  echo "Migration failed, postgres may not be ready yet. Retrying in 3s..."
  sleep 3
done

echo "Starting notification-service..."
exec pnpm start
