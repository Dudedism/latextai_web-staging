#!/bin/bash
#
# Auto-deploy script for latextai_web backend.
# Called by the webhook listener on pushes to staging or main.
#
# Usage: ./autodeploy.sh <branch>
#
# Backend is a Docker container — code is COPY'd into the image,
# so any backend/ change requires a full rebuild.

set -euo pipefail

BRANCH="${1:?Usage: autodeploy.sh <branch>}"
REPO_DIR="/opt/latextai_web"
LOG="/var/log/latextai-webhook.log"
BACKEND_ENV=".env.production"

cd "$REPO_DIR"

log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [web/$BRANCH] $1" >> "$LOG"
}

# Preserve production .env
if [ -f "backend/$BACKEND_ENV" ]; then
    cp "backend/$BACKEND_ENV" "backend/${BACKEND_ENV}.backup"
fi

# Fetch latest from origin
OLD_HEAD=$(git rev-parse HEAD)
git fetch origin "$BRANCH" >> "$LOG" 2>&1
NEW_HEAD=$(git rev-parse "origin/$BRANCH")

if [ "$OLD_HEAD" = "$NEW_HEAD" ]; then
    log "No new commits — nothing to deploy"
    [ -f "backend/${BACKEND_ENV}.backup" ] && cp "backend/${BACKEND_ENV}.backup" "backend/$BACKEND_ENV"
    exit 0
fi

# Update working tree
git reset --hard "origin/$BRANCH" >> "$LOG" 2>&1

# Restore production .env
[ -f "backend/${BACKEND_ENV}.backup" ] && cp "backend/${BACKEND_ENV}.backup" "backend/$BACKEND_ENV"

# Determine what changed
CHANGED=$(git diff --name-only "$OLD_HEAD" "$NEW_HEAD")
SHORT_OLD=$(echo "$OLD_HEAD" | cut -c1-7)
SHORT_NEW=$(git rev-parse --short HEAD)

if echo "$CHANGED" | grep -qE '^backend/'; then
    # Targeted rebuild instead of deploy.sh (which runs docker system prune -af
    # and would nuke the latextai-service container).
    log "Backend changed — rebuilding Docker container"
    cd "$REPO_DIR/backend"
    docker stop latext-backend >> "$LOG" 2>&1 || true
    docker rm latext-backend >> "$LOG" 2>&1 || true
    docker rmi backend-backend >> "$LOG" 2>&1 || true
    docker network create latext-network >> "$LOG" 2>&1 || true
    ENV=production docker compose up --build -d >> "$LOG" 2>&1
    # Restore .env after rebuild
    [ -f "${BACKEND_ENV}.backup" ] && cp "${BACKEND_ENV}.backup" "$BACKEND_ENV"
    cd "$REPO_DIR"
else
    log "No backend changes — nothing to rebuild"
fi

log "Deployed ${SHORT_OLD} -> ${SHORT_NEW}"
