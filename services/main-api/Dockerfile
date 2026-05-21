FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY services/main-api/package.json ./services/main-api/
WORKDIR /app/services/main-api
RUN pnpm install

WORKDIR /app
COPY shared ./shared
COPY services/main-api ./services/main-api

WORKDIR /app/services/main-api
RUN npx prisma generate
RUN pnpm run build

EXPOSE 3002

CMD ["node", "dist/index.js"]
