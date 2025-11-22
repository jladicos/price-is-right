/**
 * Sanitize a player name to create a safe filename
 * Example: "John Smith" -> "john-smith"
 */
export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^a-z0-9-]/g, '') // Remove non-alphanumeric characters (except hyphens)
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a filename for a player's photo
 * Example: firstName="John", lastName="Smith", extension=".jpg" -> "john-smith.jpg"
 */
export function generatePlayerPhotoFilename(
  firstName: string,
  lastName: string,
  extension: string,
): string {
  const fullName = `${firstName} ${lastName}`;
  const sanitized = sanitizeFilename(fullName);

  // Ensure extension starts with a dot
  const ext = extension.startsWith('.') ? extension : `.${extension}`;

  return `${sanitized}${ext}`;
}

/**
 * Get file extension from filename or mimetype
 */
export function getFileExtension(filename: string, mimetype?: string): string {
  // Try to get extension from filename first
  const match = filename.match(/\.([^.]+)$/);
  if (match) {
    return match[1].toLowerCase();
  }

  // Fallback to mimetype
  if (mimetype) {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
    };
    return mimeMap[mimetype.toLowerCase()] || 'jpg';
  }

  return 'jpg'; // Default
}

/**
 * Validate that a file is an allowed image type
 */
export function isValidImageType(mimetype: string): boolean {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
  return allowedTypes.includes(mimetype.toLowerCase());
}
