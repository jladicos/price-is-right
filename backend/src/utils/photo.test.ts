import { describe, it, expect } from "vitest";
import {
  resolvePhotoFilename,
  isValidPhotoFilename,
  photoExists,
} from "./photo";

describe("Photo Utilities", () => {
  describe("photoExists", () => {
    it("should find default.jpg", () => {
      expect(photoExists("default.jpg")).toBe(true);
    });

    it("should return false for non-existent file", () => {
      expect(photoExists("nonexistent.jpg")).toBe(false);
    });
  });

  describe("resolvePhotoFilename", () => {
    it("should return default.jpg for null/undefined", () => {
      expect(resolvePhotoFilename(null)).toBe("default.jpg");
      expect(resolvePhotoFilename(undefined)).toBe("default.jpg");
      expect(resolvePhotoFilename("")).toBe("default.jpg");
      expect(resolvePhotoFilename("   ")).toBe("default.jpg");
    });

    it("should return existing filename", () => {
      expect(resolvePhotoFilename("default.jpg")).toBe("default.jpg");
    });

    it("should return default.jpg for non-existent file", () => {
      expect(resolvePhotoFilename("nonexistent.jpg")).toBe("default.jpg");
    });
  });

  describe("isValidPhotoFilename", () => {
    it("should accept valid filenames", () => {
      expect(isValidPhotoFilename("photo.jpg")).toBe(true);
      expect(isValidPhotoFilename("photo.jpeg")).toBe(true);
      expect(isValidPhotoFilename("photo.png")).toBe(true);
      expect(isValidPhotoFilename("photo.gif")).toBe(true);
      expect(isValidPhotoFilename("my-photo.jpg")).toBe(true);
      expect(isValidPhotoFilename("my_photo.jpg")).toBe(true);
      expect(isValidPhotoFilename("photo123.jpg")).toBe(true);
    });

    it("should accept filenames without extensions", () => {
      expect(isValidPhotoFilename("photo")).toBe(true);
      expect(isValidPhotoFilename("john-smith")).toBe(true);
    });

    it("should reject path traversal attempts", () => {
      expect(isValidPhotoFilename("../photo.jpg")).toBe(false);
      expect(isValidPhotoFilename("../../photo.jpg")).toBe(false);
      expect(isValidPhotoFilename("subdir/photo.jpg")).toBe(false);
      expect(isValidPhotoFilename("subdir\\photo.jpg")).toBe(false);
    });

    it("should reject invalid extensions", () => {
      expect(isValidPhotoFilename("photo.exe")).toBe(false);
      expect(isValidPhotoFilename("photo.sh")).toBe(false);
      expect(isValidPhotoFilename("photo.txt")).toBe(false);
    });

    it("should handle invalid inputs", () => {
      expect(isValidPhotoFilename("")).toBe(false);
      expect(isValidPhotoFilename(null)).toBe(false);
      expect(isValidPhotoFilename(undefined)).toBe(false);
      expect(isValidPhotoFilename(123)).toBe(false);
    });
  });
});
