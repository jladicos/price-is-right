#!/bin/bash

# Run linting in Docker containers
echo "Running linting..."
echo ""

echo "=== Backend Linting ==="
docker-compose exec backend npm run lint

echo ""
echo "=== Frontend Linting ==="
docker-compose exec frontend npm run lint

echo ""
echo "Linting complete!"
