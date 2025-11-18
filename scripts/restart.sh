#!/bin/bash

# Restart all Docker services
echo "Restarting Price is Right application..."
docker-compose down
docker-compose up --build -d
echo "Application restarted!"
echo "Frontend: http://localhost:3000"
echo "Backend: http://localhost:3001"
