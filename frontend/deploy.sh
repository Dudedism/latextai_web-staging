#!/bin/bash

ENV=$1

if [ -z "$ENV" ]; then
    echo "Usage: ./deploy.sh [development|staging|production]"
    echo "Example: ./deploy.sh development"
    exit 1
fi

# Validate environment
if [ "$ENV" != "development" ] && [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo "Error: Invalid environment. Must be 'development', 'staging', or 'production'"
    exit 1
fi

echo "🚀 Deploying frontend with environment: $ENV"

# Stop and remove existing container
echo "🛑 Stopping existing frontend container..."
docker stop latext-frontend 2>/dev/null || true
docker rm latext-frontend 2>/dev/null || true

# Remove old image to force rebuild
echo "🗑️  Removing old frontend image..."
docker rmi frontend-frontend 2>/dev/null || true

# Create network if it doesn't exist
echo "🌐 Ensuring Docker network exists..."
docker network create latext-network 2>/dev/null || echo "Network already exists"

# Build and start frontend
echo "🏗️  Building and starting frontend..."
ENV=$ENV docker compose up -d --build
