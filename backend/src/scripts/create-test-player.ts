import { initDatabase, closeDatabase } from "../db/connection";
import { runMigrations } from "../db/migrator";

const db = initDatabase();
runMigrations(db);

// Insert test player
const existingPlayer = db
  .prepare("SELECT * FROM players WHERE access_code = ?")
  .get("TEST01");

if (!existingPlayer) {
  db.prepare(
    "INSERT INTO players (first_name, last_name, access_code, role, photo_filename) VALUES (?, ?, ?, ?, ?)",
  ).run("Test", "Player", "TEST01", "player", "default.jpg");
  console.log("✅ Created test player with access code: TEST01");
} else {
  console.log("✅ Test player already exists with access code: TEST01");
}

// Create a host user too
const existingHost = db
  .prepare("SELECT * FROM players WHERE access_code = ?")
  .get("HOST01");

if (!existingHost) {
  db.prepare(
    "INSERT INTO players (first_name, last_name, access_code, role, photo_filename) VALUES (?, ?, ?, ?, ?)",
  ).run("Test", "Host", "HOST01", "host", "default.jpg");
  console.log("✅ Created test host with access code: HOST01");
} else {
  console.log("✅ Test host already exists with access code: HOST01");
}

// Create an audience member too
const existingAudience = db
  .prepare("SELECT * FROM players WHERE access_code = ?")
  .get("AUD001");

if (!existingAudience) {
  db.prepare(
    "INSERT INTO players (first_name, last_name, access_code, role, photo_filename) VALUES (?, ?, ?, ?, ?)",
  ).run("Test", "Audience", "AUD001", "audience", "default.jpg");
  console.log("✅ Created test audience member with access code: AUD001");
} else {
  console.log(
    "✅ Test audience member already exists with access code: AUD001",
  );
}

closeDatabase();
