FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .

RUN pnpm run build

EXPOSE 3001

CMD ["node", "dist/index.js"]

