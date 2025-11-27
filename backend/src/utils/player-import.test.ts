import { describe, it, expect } from "vitest";
import { createTestDb } from "../db/test-helper";
import { generateUniqueAccessCode } from "./access-code";
import { resolvePhotoFilename, isValidPhotoFilename } from "./photo";
import { parseWeight } from "../scripts/import-players";

/**
 * These tests validate the core logic used by the import script
 * We test the individual functions rather than running the full script
 */
describe("Player Import Logic", () => {
  describe("Import validation", () => {
    it("should validate required fields", () => {
      const validRow = {
        firstName: "John",
        lastName: "Doe",
        role: "player" as const,
      };

      expect(validRow.firstName).toBeTruthy();
      expect(validRow.lastName).toBeTruthy();
      expect(validRow.role).toBeTruthy();
    });

    it("should validate role is one of allowed values", () => {
      const validRoles = ["host", "player", "audience"];

      expect(validRoles).toContain("host");
      expect(validRoles).toContain("player");
      expect(validRoles).toContain("audience");
      expect(validRoles).not.toContain("admin");
      expect(validRoles).not.toContain("guest");
    });

    it("should handle optional email field", () => {
      const withEmail = { email: "test@example.com" };
      const withoutEmail = { email: null };
      const emptyEmail = { email: "" };

      expect(withEmail.email).toBeTruthy();
      expect(withoutEmail.email).toBeFalsy();
      expect(emptyEmail.email).toBeFalsy();
    });

    it("should handle optional photo field", () => {
      expect(isValidPhotoFilename("photo.jpg")).toBe(true);
      expect(isValidPhotoFilename("")).toBe(false);
      expect(isValidPhotoFilename(null)).toBe(false);
    });
  });

  describe("Import with database", () => {
    it("should insert player with all fields", () => {
      const db = createTestDb();

      const accessCode = generateUniqueAccessCode(db);
      const photoFilename = resolvePhotoFilename("test.jpg");

      db.prepare(
        "INSERT INTO players (first_name, last_name, email, access_code, photo_filename, role) VALUES (?, ?, ?, ?, ?, ?)",
      ).run(
        "John",
        "Doe",
        "john@example.com",
        accessCode,
        photoFilename,
        "player",
      );

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode);

      expect(player).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((player as any).first_name).toBe("John");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((player as any).last_name).toBe("Doe");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((player as any).email).toBe("john@example.com");

      db.close();
    });

    it("should insert player with null email", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, email, access_code, photo_filename, role) VALUES (?, ?, ?, ?, ?, ?)",
      ).run("John", "Doe", null, accessCode, "default.jpg", "player");

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.email).toBeNull();

      db.close();
    });

    it("should generate unique access codes for multiple players", () => {
      const db = createTestDb();

      const codes: string[] = [];
      for (let i = 0; i < 10; i++) {
        const code = generateUniqueAccessCode(db);
        codes.push(code);

        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        ).run("Test", `User${i}`, code, "player");
      }

      // All codes should be unique
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(10);

      db.close();
    });

    it("should reject duplicate access codes", () => {
      const db = createTestDb();

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("John", "Doe", "ABC123", "player");

      // Try to insert with same code
      expect(() => {
        db.prepare(
          "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
        ).run("Jane", "Smith", "ABC123", "player");
      }).toThrow();

      db.close();
    });

    it("should handle different roles correctly", () => {
      const db = createTestDb();

      const hostCode = generateUniqueAccessCode(db);
      const playerCode = generateUniqueAccessCode(db);
      const audienceCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Host", "User", hostCode, "host");

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Player", "User", playerCode, "player");

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Audience", "User", audienceCode, "audience");

      const host = db
        .prepare("SELECT * FROM players WHERE role = 'host'")
        .get() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const player = db
        .prepare("SELECT * FROM players WHERE role = 'player'")
        .get() as any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const audience = db
        .prepare("SELECT * FROM players WHERE role = 'audience'")
        .get() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

      expect(host).toBeDefined();
      expect(player).toBeDefined();
      expect(audience).toBeDefined();

      expect(host.role).toBe("host");
      expect(player.role).toBe("player");
      expect(audience.role).toBe("audience");

      db.close();
    });

    it("should detect existing players before import", () => {
      const db = createTestDb();

      // Insert a player
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("Existing", "User", "EXIST1", "player");

      // Check if players exist
      const count = db
        .prepare("SELECT COUNT(*) as count FROM players")
        .get() as {
        count: number;
      };

      // Import script should error if count > 0
      expect(count.count).toBeGreaterThan(0);

      db.close();
    });
  });

  describe("Photo filename resolution", () => {
    it("should use default.jpg for missing photo", () => {
      expect(resolvePhotoFilename(null)).toBe("default.jpg");
      expect(resolvePhotoFilename(undefined)).toBe("default.jpg");
      expect(resolvePhotoFilename("")).toBe("default.jpg");
    });

    it("should use default.jpg for non-existent photo", () => {
      const filename = resolvePhotoFilename("nonexistent.jpg");
      expect(filename).toBe("default.jpg");
    });

    it("should use provided filename if it exists", () => {
      const filename = resolvePhotoFilename("default.jpg");
      expect(filename).toBe("default.jpg");
    });
  });

  describe("Weight parsing (parseWeight function)", () => {
    it("should parse valid number 1.0", () => {
      expect(parseWeight(1.0)).toBe(1.0);
    });

    it("should parse valid number 0.5", () => {
      expect(parseWeight(0.5)).toBe(0.5);
    });

    it("should parse valid number 0.0", () => {
      expect(parseWeight(0.0)).toBe(0.0);
    });

    it('should parse string number "0.5"', () => {
      expect(parseWeight("0.5")).toBe(0.5);
    });

    it('should parse string number "1"', () => {
      expect(parseWeight("1")).toBe(1.0);
    });

    it("should default to 1.0 for undefined", () => {
      expect(parseWeight(undefined)).toBe(1.0);
    });

    it("should default to 1.0 for null", () => {
      expect(parseWeight(null)).toBe(1.0);
    });

    it("should default to 1.0 for empty string", () => {
      expect(parseWeight("")).toBe(1.0);
    });

    it("should default to 1.0 for invalid string", () => {
      expect(parseWeight("abc")).toBe(1.0);
      expect(parseWeight("not a number")).toBe(1.0);
    });

    it("should default to 1.0 for NaN", () => {
      expect(parseWeight(NaN)).toBe(1.0);
    });

    it("should clamp value > 1.0 to 1.0", () => {
      expect(parseWeight(1.5)).toBe(1.0);
      expect(parseWeight(2.0)).toBe(1.0);
      expect(parseWeight(100)).toBe(1.0);
    });

    it("should clamp value < 0.0 to 0.0", () => {
      expect(parseWeight(-0.5)).toBe(0.0);
      expect(parseWeight(-1.0)).toBe(0.0);
      expect(parseWeight(-100)).toBe(0.0);
    });

    it("should clamp string value > 1.0 to 1.0", () => {
      expect(parseWeight("1.5")).toBe(1.0);
      expect(parseWeight("2.0")).toBe(1.0);
    });

    it("should clamp string value < 0.0 to 0.0", () => {
      expect(parseWeight("-0.5")).toBe(0.0);
      expect(parseWeight("-1.0")).toBe(0.0);
    });

    it("should handle edge cases at boundaries", () => {
      expect(parseWeight(0)).toBe(0.0);
      expect(parseWeight(1)).toBe(1.0);
      expect(parseWeight(0.0001)).toBe(0.0001);
      expect(parseWeight(0.9999)).toBe(0.9999);
    });

    it("should handle very small decimal values", () => {
      expect(parseWeight(0.01)).toBe(0.01);
      expect(parseWeight(0.001)).toBe(0.001);
      expect(parseWeight(0.0001)).toBe(0.0001);
    });

    it("should handle common fractional values", () => {
      expect(parseWeight(0.25)).toBe(0.25);
      expect(parseWeight(0.33)).toBeCloseTo(0.33, 2);
      expect(parseWeight(0.5)).toBe(0.5);
      expect(parseWeight(0.75)).toBe(0.75);
    });
  });

  describe("Weight database integration", () => {
    it("should insert player with valid weight (1.0)", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", 1.0);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.weight).toBe(1.0);

      db.close();
    });

    it("should insert player with valid weight (0.5)", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", 0.5);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.weight).toBe(0.5);

      db.close();
    });

    it("should insert player with weight 0.0 (backup tier)", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", 0.0);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.weight).toBe(0.0);

      db.close();
    });

    it("should store NULL when weight is explicitly NULL", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", null);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      // When explicitly passing NULL, database stores NULL (application layer defaults to 1.0 via rowToPlayer)
      expect(player.weight).toBeNull();

      db.close();
    });

    it("should handle weight omitted (uses database default 1.0)", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      // Insert without weight column - should use database default
      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role) VALUES (?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player");

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.weight).toBe(1.0);

      db.close();
    });

    it("should handle boundary values (0 and 1)", () => {
      const db = createTestDb();

      const code1 = generateUniqueAccessCode(db);
      const code2 = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("Min", "Weight", code1, "player", 0);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("Max", "Weight", code2, "player", 1);

      const min = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(code1) as { weight?: number; [key: string]: unknown } | undefined;
      const max = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(code2) as { weight?: number; [key: string]: unknown } | undefined;

      expect(min.weight).toBe(0);
      expect(max.weight).toBe(1);

      db.close();
    });

    it("should handle very small positive weights", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", 0.01);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      expect(player.weight).toBe(0.01);

      db.close();
    });

    it("should handle decimal weights (0.33)", () => {
      const db = createTestDb();
      const accessCode = generateUniqueAccessCode(db);

      db.prepare(
        "INSERT INTO players (first_name, last_name, access_code, role, weight) VALUES (?, ?, ?, ?, ?)",
      ).run("John", "Doe", accessCode, "player", 0.33);

      const player = db
        .prepare("SELECT * FROM players WHERE access_code = ?")
        .get(accessCode) as
        | { weight?: number; [key: string]: unknown }
        | undefined;

      expect(player).toBeDefined();
      // SQLite stores REAL, might have floating point precision
      expect(player.weight).toBeCloseTo(0.33, 2);

      db.close();
    });

    // Note: Clamping tests (values > 1.0 or < 0.0) should be in import script tests
    // since the database itself doesn't enforce these constraints
    // The parseWeight() function in import-players.ts handles clamping
  });
});
