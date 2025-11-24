/**
 * Centralized utility for constructing image URLs
 */

const BASE_URL =
  import.meta.env.VITE_API_URL?.replace("/api", "") || "http://localhost:3001";

/**
 * Get the URL for a player photo
 */
export function getPlayerPhotoUrl(photoFilename: string): string {
  return `${BASE_URL}/images/players/${photoFilename}`;
}

/**
 * Get the URL for a product image
 */
export function getProductImageUrl(imageName: string): string {
  return `${BASE_URL}/images/products/${imageName}`;
}

/**
 * Get URLs for all product images
 */
export function getProductImageUrls(imageNames: string[]): string[] {
  return imageNames.map((imageName) => getProductImageUrl(imageName));
}
