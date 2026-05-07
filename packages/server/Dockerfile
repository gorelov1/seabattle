# ---- Build stage ----
FROM node:20-slim AS builder

WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./

# Copy package manifests for all workspaces
COPY packages/domain/package.json ./packages/domain/
COPY packages/server/package.json ./packages/server/

# Install all dependencies (including dev deps needed for tsc)
RUN npm ci --workspace=packages/domain --workspace=packages/server

# Copy source
COPY packages/domain/ ./packages/domain/
COPY packages/server/ ./packages/server/

# Build domain first, then server (build script also copies migrations)
RUN npm run build --workspace=packages/domain
RUN npm run build --workspace=packages/server

# ---- Runtime stage ----
FROM node:20-slim

WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json ./

# Copy package manifests
COPY packages/domain/package.json ./packages/domain/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only (native modules will be compiled here)
RUN npm ci --workspace=packages/domain --workspace=packages/server --omit=dev

# Copy compiled output from builder
COPY --from=builder /app/packages/domain/dist ./packages/domain/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist

# Expose port
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "packages/server/dist/server.js"]
