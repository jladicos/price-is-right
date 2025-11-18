import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPPORTED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif"];
const DEFAULT_PHOTO = "default.jpg";

/**
 * Get the path to the players photos directory
 */
export function getPlayersPhotoDir(): string {
  return path.join(__dirname, "..", "..", "public", "images", "players");
}

/**
 * Check if a photo file exists in the players directory
 */
export function photoExists(filename: string): boolean {
  const photoPath = path.join(getPlayersPhotoDir(), filename);
  return fs.existsSync(photoPath);
}

/**
 * Get the appropriate photo filename for a player
 * Returns the filename if it exists, otherwise returns default.png
 */
export function resolvePhotoFilename(
  filename: string | null | undefined,
): string {
  // If no filename provided, use default
  if (!filename || filename.trim() === "") {
    return DEFAULT_PHOTO;
  }

  const trimmed = filename.trim();

  // If the provided filename exists, use it
  if (photoExists(trimmed)) {
    return trimmed;
  }

  // Try adding supported extensions if no extension provided
  const ext = path.extname(trimmed).toLowerCase();
  if (!ext) {
    for (const extension of SUPPORTED_EXTENSIONS) {
      const filenameWithExt = trimmed + extension;
      if (photoExists(filenameWithExt)) {
        return filenameWithExt;
      }
    }
  }

  // If nothing found, return default
  return DEFAULT_PHOTO;
}

/**
 * Validate that a photo filename is safe (no path traversal)
 */
export function isValidPhotoFilename(filename: unknown): boolean {
  if (!filename || typeof filename !== "string") {
    return false;
  }

  // Check for path traversal attempts
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    return false;
  }

  // Check for valid extension
  const ext = path.extname(filename).toLowerCase();
  if (ext && !SUPPORTED_EXTENSIONS.includes(ext)) {
    return false;
  }

  return true;
}
