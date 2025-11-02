#!/bin/bash -e

# Direct deployment script (no Docker) - genotyper method
# This builds the frontend directly on the server and serves with nginx

ENV=$1

if [ -z "$ENV" ]; then
    echo "Usage: ./deploy.sh [development|staging|production]"
    echo "Example: ./deploy.sh staging"
    exit 1
fi

# Validate environment
if [ "$ENV" != "development" ] && [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo "Error: Invalid environment. Must be 'development', 'staging', or 'production'"
    exit 1
fi

echo "🚀 Deploying frontend directly (no Docker) with environment: $ENV"

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Remove old build
echo "🗑️  Removing old build..."
rm -rf ./dist 2>/dev/null || true

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build with environment-specific variables
echo "🏗️  Building frontend for $ENV..."
npm run build:$ENV || exit $?

# Determine target directory based on environment
if [ "$ENV" = "development" ]; then
    TARGET_DIR="/var/www/latext-dev"
elif [ "$ENV" = "staging" ]; then
    TARGET_DIR="/var/www/latext-staging"
else
    TARGET_DIR="/var/www/latext-production"
fi

# Deploy to nginx directory
echo "📂 Deploying to $TARGET_DIR..."
sudo rm -rf "$TARGET_DIR" 2>/dev/null || true
sudo mkdir -p "$TARGET_DIR"
sudo cp -r ./dist/* "$TARGET_DIR/"
sudo chown -R www-data:www-data "$TARGET_DIR"
sudo chmod -R 755 "$TARGET_DIR"

# Test nginx config
echo "✅ Testing nginx configuration..."
sudo nginx -t

# Reload nginx
echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

echo "✨ Deployment complete! Frontend is now serving from $TARGET_DIR"
