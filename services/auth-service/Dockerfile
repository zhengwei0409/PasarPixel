FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY services/auth-service/package.json ./services/auth-service/
WORKDIR /app/services/auth-service
RUN pnpm install

WORKDIR /app
COPY shared ./shared
COPY services/auth-service ./services/auth-service

WORKDIR /app/services/auth-service
RUN npx prisma generate
RUN pnpm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]
