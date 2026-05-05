# syntax=docker/dockerfile:1.6

# ─── Builder ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Deps primeiro (cache friendly)
COPY package.json package-lock.json ./
RUN npm ci

# Source + build
COPY . .
RUN npx prisma generate
RUN npm run build

# ─── Runner ──────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# tini = init minimo para forwarding correto de SIGTERM/SIGINT
RUN apk add --no-cache tini wget

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone do Next (server.js + node_modules necessarios pro web)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma runtime: schema.prisma + migrations sao usados pelo entrypoint
COPY --from=builder /app/prisma ./prisma

# Workers: tsx em runtime precisa do source TS + tsconfig + package.json + node_modules completo
# (standalone so cobre o web; workers compartilham a imagem mas rodam outro CMD)
COPY --from=builder /app/src/workers ./src/workers
COPY --from=builder /app/src/lib ./src/lib
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000

# Healthcheck do Docker — bate na rota /api/health do proprio container.
# So tem efeito quando o servico expoe a porta 3000 (web). Workers desabilita
# isso no docker-stack.yml com `healthcheck: disable: true`.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -q --spider http://localhost:3000/api/health || exit 1

# tini repassa sinais corretamente para o processo Node, garantindo graceful
# shutdown de workers BullMQ e do Next quando Swarm faz update/rollback.
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]
CMD ["node", "server.js"]
