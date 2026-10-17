FROM node:24-alpine

RUN apk add --no-cache openssl
RUN npm install -g pnpm@10.33.3
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/auth-service/package.json ./services/auth-service/
COPY services/main-api/package.json ./services/main-api/
COPY services/blockchain-service/package.json ./services/blockchain-service/
COPY services/notification-service/package.json ./services/notification-service/
COPY client/package.json ./client/
RUN pnpm install --frozen-lockfile --filter blockchain-service...
COPY services/blockchain-service ./services/blockchain-service
WORKDIR /app/services/blockchain-service
RUN pnpm build
EXPOSE 3004
CMD ["sh", "docker-entrypoint.sh"]
