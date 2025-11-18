import "dotenv/config";
import * as XLSX from "xlsx";
import { initDatabase, getDatabase, closeDatabase } from "../db/connection.js";
import { generateUniqueAccessCode } from "../utils/access-code.js";
import { resolvePhotoFilename, isValidPhotoFilename } from "../utils/photo.js";
import type { PlayerRole } from "../types/player.js";

interface PlayerRow {
  "First Name": string;
  "Last Name": string;
  Role: string;
  Photo?: string;
  Email?: string;
}

const VALID_ROLES: PlayerRole[] = ["host", "player", "audience"];

function validateRole(role: string): PlayerRole {
  const normalized = role.toLowerCase().trim();
  if (!VALID_ROLES.includes(normalized as PlayerRole)) {
    throw new Error(
      `Invalid role: "${role}". Must be one of: ${VALID_ROLES.join(", ")}`,
    );
  }
  return normalized as PlayerRole;
}

function importPlayersFromXLSX(filePath: string): void {
  console.log(`Importing players from ${filePath}...`);

  // Initialize database
  initDatabase();
  const db = getDatabase();

  // Check if there are existing players
  const existingCount = db
    .prepare("SELECT COUNT(*) as count FROM players")
    .get() as {
    count: number;
  };

  if (existingCount.count > 0) {
    console.error(
      `\nError: Database already contains ${existingCount.count} player(s).`,
    );
    console.error("Please reset the database before importing:");
    console.error("  ./scripts/reset-db.sh");
    closeDatabase();
    process.exit(1);
  }

  // Read the XLSX file
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<PlayerRow>(worksheet);

  if (data.length === 0) {
    console.error("Error: No data found in XLSX file");
    closeDatabase();
    process.exit(1);
  }

  console.log(`Found ${data.length} player(s) to import`);

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  const insertStmt = db.prepare(`
    INSERT INTO players (first_name, last_name, email, access_code, photo_filename, role)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 2; // +2 because Excel rows start at 1 and row 1 is header

    try {
      // Validate required fields
      if (!row["First Name"] || !row["Last Name"] || !row.Role) {
        throw new Error(
          "Missing required fields (First Name, Last Name, or Role)",
        );
      }

      const firstName = row["First Name"].toString().trim();
      const lastName = row["Last Name"].toString().trim();
      const email = row.Email?.toString().trim() || null;
      const role = validateRole(row.Role.toString());

      // Validate and resolve photo
      let photoFilename = "default.png";
      if (row.Photo) {
        const photoValue = row.Photo.toString().trim();
        if (photoValue) {
          if (!isValidPhotoFilename(photoValue)) {
            throw new Error(`Invalid photo filename: "${photoValue}"`);
          }
          photoFilename = resolvePhotoFilename(photoValue);
        }
      }

      // Generate unique access code
      const accessCode = generateUniqueAccessCode(db);

      // Insert player
      insertStmt.run(
        firstName,
        lastName,
        email,
        accessCode,
        photoFilename,
        role,
      );

      successCount++;
      console.log(
        `✓ Row ${rowNumber}: ${firstName} ${lastName} (${role}) - Code: ${accessCode}`,
      );
    } catch (error) {
      errorCount++;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      errors.push(`Row ${rowNumber}: ${errorMessage}`);
      console.error(`✗ Row ${rowNumber}: ${errorMessage}`);
    }
  }

  closeDatabase();

  console.log("\n" + "=".repeat(60));
  console.log(`Import complete!`);
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log("=".repeat(60));

  if (errorCount > 0) {
    console.error("\nErrors encountered:");
    errors.forEach((error) => console.error(`  ${error}`));
    process.exit(1);
  }
}

// Main execution
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Usage: npm run import-players <path-to-xlsx-file>");
  process.exit(1);
}

const filePath = args[0];

try {
  importPlayersFromXLSX(filePath);
} catch (error) {
  console.error("Fatal error:", error);
  closeDatabase();
  process.exit(1);
}
