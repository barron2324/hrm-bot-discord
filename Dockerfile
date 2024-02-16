FROM node:18.17-alpine as base
RUN npm i -g pnpm

FROM base as dependeneies
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

FROM base as builder
WORKDIR /app
COPY . .
COPY --from=dependeneies /app/node_modules ./node_modules
RUN pnpm build
RUN pnpm prune --prod

FROM base as runner
WORKDIR /app
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/main.js"]
