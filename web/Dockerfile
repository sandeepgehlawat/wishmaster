# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies (skip native scripts)
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public assets (logo, favicon, etc.)
COPY --from=builder /app/public ./public

# Railway sets PORT dynamically
EXPOSE 3000

# Use shell form to expand PORT variable
CMD node server.js
