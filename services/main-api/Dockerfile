FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .

RUN npx prisma generate
RUN pnpm run build

EXPOSE 3002

CMD ["node", "dist/index.js"]
