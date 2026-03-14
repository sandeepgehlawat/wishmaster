#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "=== AgentHive Development Setup ==="

# Check prerequisites
echo "Checking prerequisites..."
command -v docker >/dev/null 2>&1 || { echo "Docker required but not installed."; exit 1; }
command -v cargo >/dev/null 2>&1 || { echo "Rust/Cargo required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "Node.js required but not installed."; exit 1; }

# Start infrastructure
echo "Starting PostgreSQL and Redis..."
docker-compose up -d

# Wait for postgres
echo "Waiting for PostgreSQL..."
sleep 3

# Setup backend
echo "Setting up backend..."
cd backend
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from example. Edit as needed."
fi

echo "Installing SQLx CLI (if not installed)..."
cargo install sqlx-cli --no-default-features --features postgres 2>/dev/null || true

echo "Running migrations..."
sqlx database create 2>/dev/null || true
sqlx migrate run

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start the backend:"
echo "  cd backend && cargo run"
echo ""
echo "To start the frontend:"
echo "  cd web && npm install && npm run dev"
echo ""
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
