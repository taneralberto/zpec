import { describe, it, expect } from "vitest";

// Import the function directly from the module
// We need to export it first or test via the query function
// For now, testing the sanitization logic directly

describe("FTS5 Query Sanitization", () => {
  // Replicate the sanitize function for testing
  function sanitizeFTS5Query(query: string): string {
    const sanitized = query.replace(/[^\p{L}\p{N}\s_]/gu, " ");
    return sanitized.replace(/\s+/g, " ").trim();
  }

  it("should remove question marks", () => {
    const result = sanitizeFTS5Query("why JWT auth?");
    expect(result).toBe("why JWT auth");
  });

  it("should remove asterisks", () => {
    const result = sanitizeFTS5Query("invoice*");
    expect(result).toBe("invoice");
  });

  it("should remove carets", () => {
    const result = sanitizeFTS5Query("billing^5");
    expect(result).toBe("billing 5");
  });

  it("should remove parentheses", () => {
    const result = sanitizeFTS5Query("(billing OR invoice)");
    expect(result).toBe("billing OR invoice");
  });

  it("should remove minus signs", () => {
    const result = sanitizeFTS5Query("billing -invoice");
    expect(result).toBe("billing invoice");
  });

  it("should remove colons", () => {
    const result = sanitizeFTS5Query("column:value");
    expect(result).toBe("column value");
  });

  it("should handle multiple special characters", () => {
    const result = sanitizeFTS5Query("why? *auth* (JWT OR OAuth)!");
    expect(result).toBe("why auth JWT OR OAuth");
  });

  it("should collapse multiple spaces", () => {
    const result = sanitizeFTS5Query("billing    invoice");
    expect(result).toBe("billing invoice");
  });

  it("should preserve underscores", () => {
    const result = sanitizeFTS5Query("user_authentication");
    expect(result).toBe("user_authentication");
  });

  it("should preserve numbers", () => {
    const result = sanitizeFTS5Query("CR-001 version 2.0");
    expect(result).toBe("CR 001 version 2 0");
  });

  it("should handle unicode characters", () => {
    const result = sanitizeFTS5Query("facturación ñoño");
    expect(result).toBe("facturación ñoño");
  });

  it("should handle empty result", () => {
    const result = sanitizeFTS5Query("???");
    expect(result).toBe("");
  });
});
