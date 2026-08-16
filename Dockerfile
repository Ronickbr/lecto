# Stage 1: Build (Bun é o gerenciador oficial do projeto)
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy manifests
COPY package.json bun.lock* ./

# Install dependencies (frozen quando há lockfile)
RUN if [ -f bun.lock ]; then bun install --frozen-lockfile; else bun install; fi

# Copy source files
COPY . .

# Build TanStack Start for Node.js (Nitro preset node-server)
ENV NODE_ENV=production
ENV NITRO_PRESET=node-server
RUN bun run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy output from builder
COPY --from=builder /app/.output ./.output

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
