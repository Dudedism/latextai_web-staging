#!/bin/bash

ENV=$1

if [ -z "$ENV" ]; then
    echo "Usage: ./deploy.sh [staging|production]"
    echo "Example: ./deploy.sh staging"
    exit 1
fi

# Validate environment
if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo "Error: Invalid environment. Must be 'staging' or 'production'"
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env.$ENV" ]; then
    echo "Error: .env.$ENV file not found"
    exit 1
fi

echo "🚀 Deploying backend with environment: $ENV"

# Stop and remove existing container
echo "🛑 Stopping existing backend container..."
docker stop latext-backend 2>/dev/null || true
docker rm latext-backend 2>/dev/null || true

# Remove old image to force rebuild
echo "🗑️  Removing old backend image..."
docker rmi backend-backend 2>/dev/null || true

# Create network if it doesn't exist
echo "🌐 Ensuring Docker network exists..."
docker network create latext-network 2>/dev/null || echo "Network already exists"

# Build and start backend
echo "🏗️  Building and starting backend..."
ENV=$ENV docker compose up -d --build
