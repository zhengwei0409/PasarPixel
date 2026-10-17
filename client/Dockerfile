FROM node:24-alpine

RUN npm install -g pnpm@10.33.3

WORKDIR /app

COPY package.json ./
RUN pnpm install

COPY . .

EXPOSE 5173

CMD ["pnpm", "dev", "--host"]
