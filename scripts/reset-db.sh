#!/bin/bash

# Reset the database by removing the database file and restarting the backend

echo "Resetting database..."
echo ""

# Stop the backend container
echo "Stopping backend service..."
docker-compose stop backend

# Remove the database file from the Docker volume
echo "Removing database file..."
docker-compose run --rm backend sh -c "rm -f /app/data/*.db /app/data/*.db-*"

# Restart the backend (migrations will run automatically)
echo "Restarting backend service..."
docker-compose up -d backend

echo ""
echo "Database reset complete!"
echo "Migrations will run automatically on startup."
