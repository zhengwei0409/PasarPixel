FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/auth-service/package.json ./services/auth-service/
COPY services/main-api/package.json ./services/main-api/
COPY services/blockchain-service/package.json ./services/blockchain-service/
COPY client/package.json ./client/

RUN pnpm install --frozen-lockfile --filter main-api...

COPY shared ./shared
COPY services/main-api ./services/main-api

WORKDIR /app/services/main-api
RUN npx prisma generate
RUN pnpm run build

RUN chmod +x docker-entrypoint.sh

EXPOSE 3002

CMD ["./docker-entrypoint.sh"]
