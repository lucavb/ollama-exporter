#!/bin/bash
set -euo pipefail

# Docker publish script for semantic-release
# Usage: ./scripts/docker-publish.sh <version> <dockerhub_username>

VERSION="${1:-}"
DOCKERHUB_USERNAME="${2:-}"

if [ -z "$VERSION" ] || [ -z "$DOCKERHUB_USERNAME" ]; then
    echo "Usage: $0 <version> <dockerhub_username>"
    echo "Example: $0 1.0.0 myusername"
    exit 1
fi

IMAGE_NAME="$DOCKERHUB_USERNAME/ollama-exporter"

echo "Building and pushing Docker images..."
echo "Version: $VERSION"
echo "Image: $IMAGE_NAME"

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --push \
    --tag "$IMAGE_NAME:latest" \
    --tag "$IMAGE_NAME:$VERSION" \
    --label "org.opencontainers.image.title=ollama-exporter" \
    --label "org.opencontainers.image.description=A TypeScript/Node.js Prometheus exporter that collects and exposes metrics from Ollama API for monitoring and observability" \
    --label "org.opencontainers.image.version=$VERSION" \
    --label "org.opencontainers.image.licenses=GPL-3.0-only" \
    .

echo "Successfully published Docker images:"
echo "  - $IMAGE_NAME:latest"
echo "  - $IMAGE_NAME:$VERSION"
