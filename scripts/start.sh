#!/bin/bash

# Start all Docker services
echo "Starting Price is Right application..."

# Check if .env file exists, if not copy from .env.example
if [ ! -f .env ]; then
  echo "Creating .env file from .env.example..."
  cp .env.example .env
fi

# Build and start containers
docker-compose up --build -d

echo "Application started!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
echo ""
echo "To view logs, run: docker-compose logs -f"
echo "To stop, run: ./scripts/stop.sh"
