#!/bin/bash

# Run tests in Docker containers
echo "Running tests..."
echo ""

echo "=== Backend Tests ==="
docker-compose exec backend npm test

echo ""
echo "=== Frontend Tests ==="
docker-compose exec frontend npm test

echo ""
echo "Tests complete!"
