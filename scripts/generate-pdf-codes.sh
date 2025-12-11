#!/bin/bash

# Generate PDF files with access codes for all players
# Outputs to scripts/output/ directory

set -e

echo "Generating PDF access codes..."
echo ""

# Run the TypeScript script in the backend container
docker-compose exec -T backend npx tsx src/scripts/generate-pdf-codes.ts

# Copy the output files from the container to the host
echo ""
echo "Copying PDF files to scripts/output/..."

# Create output directory on host if it doesn't exist
mkdir -p scripts/output

# Copy all PDFs from container to host
docker cp price-is-right-backend:/app/output/. scripts/output/

echo ""
echo "Done! PDF files are in scripts/output/"
