import "dotenv/config";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { initDatabase, getDatabase, closeDatabase } from "../db/connection.js";

interface Player {
  first_name: string;
  last_name: string;
  access_code: string;
}

async function generatePDFCodes(): Promise<void> {
  console.log("Generating PDF access codes for all players...\n");

  // Initialize database
  initDatabase();
  const db = getDatabase();

  // Get all players
  const players = db
    .prepare("SELECT first_name, last_name, access_code FROM players ORDER BY last_name, first_name")
    .all() as Player[];

  if (players.length === 0) {
    console.log("No players found in the database.");
    closeDatabase();
    return;
  }

  console.log(`Found ${players.length} player(s)\n`);

  // Create output directory (in container at /app/output)
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let successCount = 0;
  let errorCount = 0;

  for (const player of players) {
    try {
      const fullName = `${player.first_name} ${player.last_name}`;
      const filename = `${player.first_name.toLowerCase()}_${player.last_name.toLowerCase()}.pdf`;
      const filepath = path.join(outputDir, filename);

      // Create PDF
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 50,
      });

      const writeStream = fs.createWriteStream(filepath);
      doc.pipe(writeStream);

      // Add content
      doc.fontSize(24).text(fullName, { align: "center" });
      doc.moveDown(2);
      doc.fontSize(16).text(
        "Here is your access code to our holiday party game:",
        { align: "center" }
      );
      doc.moveDown(1);
      doc.fontSize(48).text(player.access_code, { align: "center" });

      doc.end();

      // Wait for the write to complete
      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      console.log(`✓ ${fullName} -> ${filename}`);
      successCount++;
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`✗ ${player.first_name} ${player.last_name}: ${errorMessage}`);
    }
  }

  closeDatabase();

  console.log("\n" + "=".repeat(50));
  console.log("PDF Generation Complete!");
  console.log(`  Success: ${successCount}`);
  console.log(`  Errors:  ${errorCount}`);
  console.log("=".repeat(50));
}

// Main execution
generatePDFCodes().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
