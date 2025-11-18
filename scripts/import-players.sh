#!/bin/bash

# Import players from XLSX file into the database

if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/import-players.sh <path-to-xlsx-file>"
  echo ""
  echo "Example:"
  echo "  ./scripts/import-players.sh players.xlsx"
  exit 1
fi

XLSX_FILE="$1"

if [ ! -f "$XLSX_FILE" ]; then
  echo "Error: File not found: $XLSX_FILE"
  exit 1
fi

echo "Importing players from $XLSX_FILE..."
echo ""

# Copy file into container and run import script
docker cp "$XLSX_FILE" price-is-right-backend:/tmp/import.xlsx
docker-compose exec -T backend npm run import-players /tmp/import.xlsx
