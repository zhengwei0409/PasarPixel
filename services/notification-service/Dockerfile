FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/auth-service/package.json ./services/auth-service/
COPY services/main-api/package.json ./services/main-api/
COPY services/blockchain-service/package.json ./services/blockchain-service/
COPY services/notification-service/package.json ./services/notification-service/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile --filter notification-service...

COPY shared ./shared
COPY services/notification-service ./services/notification-service

WORKDIR /app/services/notification-service
RUN pnpm exec prisma generate
RUN pnpm run build

RUN chmod +x docker-entrypoint.sh

EXPOSE 3003

CMD ["./docker-entrypoint.sh"]
