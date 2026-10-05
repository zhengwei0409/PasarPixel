FROM node:24-alpine

RUN npm install -g pnpm@10.33.3

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY services/auth-service/package.json ./services/auth-service/
COPY services/main-api/package.json ./services/main-api/
COPY services/blockchain-service/package.json ./services/blockchain-service/
COPY services/notification-service/package.json ./services/notification-service/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile --filter auth-service...

COPY shared ./shared
COPY services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service
RUN pnpm exec prisma generate
RUN pnpm run build

RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3001

CMD ["./docker-entrypoint.sh"]
