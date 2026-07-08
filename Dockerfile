# Build stage
FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM node:24-alpine AS production

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

RUN addgroup --system --gid 1001 cruz && \
    adduser --system --uid 1001 cruz

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./

RUN pnpm install --frozen-lockfile --prod

COPY entry.sh ./

RUN chown -R cruz:cruz /app && \
    chmod +x entry.sh

USER cruz

EXPOSE 3000

ENV NODE_ENV=production
ENV DOCKER_CONTAINER=true

ENTRYPOINT ["/bin/sh", "./entry.sh"]

CMD ["node", "dist/server.js"]