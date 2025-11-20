import { describe, it, expect } from "vitest";
import {
  generateAccessCode,
  generateUniqueAccessCode,
  isValidAccessCodeFormat,
  normalizeAccessCode,
} from "./access-code";
import { createTestDb } from "../db/test-helper";

describe("Access Code Utilities", () => {
  describe("generateAccessCode", () => {
    it("should generate a 6-character code", () => {
      const code = generateAccessCode();
      expect(code).toHaveLength(6);
    });

    it("should only contain uppercase letters and digits", () => {
      const code = generateAccessCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });

    it("should only use characters from the allowed set (A-Z, 0-9)", () => {
      const allowedChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const code = generateAccessCode();

      for (const char of code) {
        expect(allowedChars).toContain(char);
      }
    });

    it("should generate different codes on subsequent calls (statistical test)", () => {
      // With 36 possible characters and 6 positions, collision probability is very low
      // But we test the behavior, not rely on probability
      const codes = new Set();
      for (let i = 0; i < 20; i++) {
        codes.add(generateAccessCode());
      }
      // If all 20 are identical, something is wrong with randomness
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("generateUniqueAccessCode", () => {
    it("should generate a unique code not in database", () => {
      const db = createTestDb();
      const code = generateUniqueAccessCode(db);

      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[A-Z0-9]+$/);

      const existing = db
        .prepare("SELECT id FROM players WHERE access_code = ?")
        .get(code);
      expect(existing).toBeUndefined();

      db.close();
    });

    it("should avoid generating codes that already exist in database", () => {
      const db = createTestDb();

      // Insert 5 players with codes
      const existingCodes = ["CODE01", "CODE02", "CODE03", "CODE04", "CODE05"];
      for (const code of existingCodes) {
        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        ).run("Test", "User", code, "player");
      }

      // Generate a new unique code
      const newCode = generateUniqueAccessCode(db);

      // Verify it doesn't match any existing codes
      expect(existingCodes).not.toContain(newCode);

      // Verify it was actually checked against the database
      const inDb = db
        .prepare("SELECT id FROM players WHERE access_code = ?")
        .get(newCode);
      expect(inDb).toBeUndefined();

      db.close();
    });

    it("should keep trying until it finds a unique code", () => {
      const db = createTestDb();

      // Fill database with many codes to test retry logic
      const codes = [];
      for (let i = 0; i < 50; i++) {
        const code = generateUniqueAccessCode(db);
        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        ).run("Test", `User${i}`, code, "player");
        codes.push(code);
      }

      // Generate one more - should still work
      const newCode = generateUniqueAccessCode(db);
      expect(newCode).toHaveLength(6);
      expect(codes).not.toContain(newCode);

      db.close();
    });

    it("should handle case-insensitive uniqueness check", () => {
      const db = createTestDb();

      // Insert a player with uppercase code
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Test", "User", "TEST99", "player");

      // The generated code should not be 'test99' or 'TEST99' or any case variation
      const newCode = generateUniqueAccessCode(db);
      expect(newCode.toUpperCase()).not.toBe("TEST99");

      db.close();
    });
  });

  describe("isValidAccessCodeFormat", () => {
    it("should validate correct codes", () => {
      expect(isValidAccessCodeFormat("ABC123")).toBe(true);
      expect(isValidAccessCodeFormat("XYZABC")).toBe(true);
      expect(isValidAccessCodeFormat("123456")).toBe(true);
      expect(isValidAccessCodeFormat("A1B2C3")).toBe(true);
    });

    it("should accept lowercase codes", () => {
      expect(isValidAccessCodeFormat("abc123")).toBe(true);
      expect(isValidAccessCodeFormat("AbC123")).toBe(true);
    });

    it("should reject invalid codes", () => {
      expect(isValidAccessCodeFormat("ABC12")).toBe(false); // Too short
      expect(isValidAccessCodeFormat("ABC1234")).toBe(false); // Too long
      expect(isValidAccessCodeFormat("ABC-123")).toBe(false); // Invalid character
      expect(isValidAccessCodeFormat("ABC 123")).toBe(false); // Space
      expect(isValidAccessCodeFormat("")).toBe(false); // Empty
      expect(isValidAccessCodeFormat("abc!23")).toBe(false); // Special char
    });

    it("should handle non-string inputs", () => {
      expect(isValidAccessCodeFormat(123456)).toBe(false);
      expect(isValidAccessCodeFormat(null)).toBe(false);
      expect(isValidAccessCodeFormat(undefined)).toBe(false);
    });
  });

  describe("normalizeAccessCode", () => {
    it("should convert to uppercase", () => {
      expect(normalizeAccessCode("abc123")).toBe("ABC123");
      expect(normalizeAccessCode("AbC123")).toBe("ABC123");
      expect(normalizeAccessCode("ABC123")).toBe("ABC123");
    });
  });
});
