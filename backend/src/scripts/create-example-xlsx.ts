import * as XLSX from "xlsx";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample data
const data = [
  {
    "First Name": "Alice",
    "Last Name": "Johnson",
    Role: "host",
    Photo: "alice-johnson.jpg",
    Email: "alice@example.com",
  },
  {
    "First Name": "Bob",
    "Last Name": "Smith",
    Role: "player",
    Photo: "bob-smith.jpg",
    Email: "bob@example.com",
  },
  {
    "First Name": "Carol",
    "Last Name": "Williams",
    Role: "audience",
    Photo: "",
    Email: "",
  },
];

// Create worksheet
const worksheet = XLSX.utils.json_to_sheet(data);

// Create workbook
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Players");

// Write file
const outputPath = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "players.example.xlsx",
);
XLSX.writeFile(workbook, outputPath);

console.log(`Example XLSX file created: ${outputPath}`);
