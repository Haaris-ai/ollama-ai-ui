# Stage 1: Build Environment
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Production Environment
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DB_PATH=/app/data/ollama-webui.db

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server

# Create data directory for SQLite with correct permissions
RUN mkdir -p /app/data && chown -R node:node /app/data

EXPOSE 3000
USER node

CMD ["node", "dist-server/server.js"]
