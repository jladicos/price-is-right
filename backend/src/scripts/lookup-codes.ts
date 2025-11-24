import { initDatabase, closeDatabase } from "../db/connection";

const db = initDatabase();

const jason = db
  .prepare(
    "SELECT first_name, last_name, access_code FROM players WHERE first_name LIKE ? AND last_name LIKE ?",
  )
  .get("%Jason%", "%Ladicos%") as {
  first_name: string;
  last_name: string;
  access_code: string;
} | null;

const cory = db
  .prepare(
    "SELECT first_name, last_name, access_code FROM players WHERE first_name LIKE ? AND last_name LIKE ?",
  )
  .get("%Cory%", "%MacKenzie%") as {
  first_name: string;
  last_name: string;
  access_code: string;
} | null;

console.log("\nAccess Codes:");
console.log("=============");
if (jason) {
  console.log(`${jason.first_name} ${jason.last_name}: ${jason.access_code}`);
} else {
  console.log("Jason Ladicos: NOT FOUND");
}

if (cory) {
  console.log(`${cory.first_name} ${cory.last_name}: ${cory.access_code}`);
} else {
  console.log("Cory MacKenzie: NOT FOUND");
}

closeDatabase();
