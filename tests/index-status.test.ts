import { describe, it, expect } from "vitest";
import { formatStaleWarning } from "../src/utils/index-status.js";

describe("Index Status", () => {
  describe("formatStaleWarning", () => {
    it("should return empty string if not stale", () => {
      const status = {
        exists: true,
        stale: false,
        dbTimestamp: Date.now(),
        newestYamlTimestamp: Date.now() - 1000,
        unindexedFiles: [],
      };

      const warning = formatStaleWarning(status);
      expect(warning).toBe("");
    });

    it("should format warning with unindexed files", () => {
      const status = {
        exists: true,
        stale: true,
        dbTimestamp: Date.now() - 10000,
        newestYamlTimestamp: Date.now(),
        unindexedFiles: [
          ".project-spec/changes/CR-001.yaml",
          ".project-spec/decisions/ADR-001.yaml",
        ],
      };

      const warning = formatStaleWarning(status);
      
      expect(warning).toContain("índice está desactualizado");
      expect(warning).toContain("2 archivo(s)");
      expect(warning).toContain("CR-001.yaml");
      expect(warning).toContain("ADR-001.yaml");
      expect(warning).toContain("spec rebuild");
    });

    it("should truncate list of unindexed files if more than 5", () => {
      const status = {
        exists: true,
        stale: true,
        dbTimestamp: Date.now() - 10000,
        newestYamlTimestamp: Date.now(),
        unindexedFiles: [
          ".project-spec/changes/CR-001.yaml",
          ".project-spec/changes/CR-002.yaml",
          ".project-spec/changes/CR-003.yaml",
          ".project-spec/changes/CR-004.yaml",
          ".project-spec/changes/CR-005.yaml",
          ".project-spec/changes/CR-006.yaml",
        ],
      };

      const warning = formatStaleWarning(status);
      
      expect(warning).toContain("6 archivo(s)");
      expect(warning).toContain("... y 1 más");
    });

    it("should handle 7+ unindexed files", () => {
      const status = {
        exists: true,
        stale: true,
        dbTimestamp: Date.now() - 10000,
        newestYamlTimestamp: Date.now(),
        unindexedFiles: [
          ".project-spec/changes/CR-001.yaml",
          ".project-spec/changes/CR-002.yaml",
          ".project-spec/changes/CR-003.yaml",
          ".project-spec/changes/CR-004.yaml",
          ".project-spec/changes/CR-005.yaml",
          ".project-spec/changes/CR-006.yaml",
          ".project-spec/changes/CR-007.yaml",
        ],
      };

      const warning = formatStaleWarning(status);
      
      expect(warning).toContain("7 archivo(s)");
      expect(warning).toContain("... y 2 más");
    });

    it("should handle non-existent index", () => {
      const status = {
        exists: false,
        stale: false,
        dbTimestamp: null,
        newestYamlTimestamp: Date.now(),
        unindexedFiles: [],
      };

      const warning = formatStaleWarning(status);
      
      expect(warning).toContain("índice está desactualizado");
    });
  });
});
