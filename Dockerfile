# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
FROM node:24-alpine@sha256:51dbfc749ec3018c7d4bf8b9ee65299ff9a908e38918ce163b0acfcd5dd931d9 AS builder

# Build application
WORKDIR /app
COPY package.json package-lock.json* tsconfig.json ./
COPY src ./src

# Install dependencies
RUN npm ci --omit=dev

# Runtime image
FROM node:24-alpine@sha256:51dbfc749ec3018c7d4bf8b9ee65299ff9a908e38918ce163b0acfcd5dd931d9

# Add non-root user
RUN adduser -D ollama-exporter

# Copy dependencies and source code
WORKDIR /app
COPY --from=builder --chown=ollama-exporter:ollama-exporter /app/node_modules ./node_modules
COPY --from=builder --chown=ollama-exporter:ollama-exporter /app/src ./src
COPY --from=builder --chown=ollama-exporter:ollama-exporter /app/package.json ./
COPY --chown=ollama-exporter:ollama-exporter docker-entrypoint.sh docker-healthcheck.sh ./
RUN chmod +x docker-entrypoint.sh docker-healthcheck.sh

# Labels
LABEL org.opencontainers.image.title="ollama-exporter" \
      org.opencontainers.image.description="Prometheus exporter for Ollama metrics" \
      org.opencontainers.image.licenses="GPL-3.0-only" \
      org.opencontainers.image.authors="Luca Becker <hello@luca-becker.me>" \
      org.opencontainers.image.url="https://luca-becker.me"

# Switch to non-root user
USER ollama-exporter

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ["./docker-healthcheck.sh"]

EXPOSE 8000

# Environment variables
ENV PORT=8000 \
    INTERVAL=30 \
    OLLAMA_HOST=localhost:11434 \
    API_TIMEOUT=30 \
    LOG_LEVEL=INFO

ENTRYPOINT ["./docker-entrypoint.sh"]