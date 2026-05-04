import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validate } from "../commands/validate.js";

describe("validate command", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ztructure-validate-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    try {
      await rm(testDir, { recursive: true, force: true, retryDelay: 100, maxRetries: 3 });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function createSpecStructure() {
    const specPath = join(testDir, ".project-spec");
    await mkdir(join(specPath, "changes"), { recursive: true });
    await mkdir(join(specPath, "decisions"), { recursive: true });
    await mkdir(join(specPath, "constraints"), { recursive: true });
    await mkdir(join(specPath, "domains"), { recursive: true });

    // Create a valid config
    await writeFile(
      join(specPath, "config.yaml"),
      `schema: config/v1
project:
  name: test
  version: "0.1.0"
`
    );
  }

  it("validates all files and reports success", async () => {
    await createSpecStructure();

    // This should not throw
    await validate();
  });

  it("reports errors for invalid CR ID format", async () => {
    await createSpecStructure();

    // Create an invalid CR
    await writeFile(
      join(testDir, ".project-spec", "changes", "CR-001.yaml"),
      `schema: cr/v1
id: INVALID-ID
domain: billing
summary: "Test"
`
    );

    // Mock process.exit to prevent test from exiting
    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);

    await validate();

    expect(mockExit).toHaveBeenCalledWith(1);
    
    mockExit.mockRestore();
  });

  it("validates a specific file", async () => {
    await createSpecStructure();

    // Create a valid CR
    await writeFile(
      join(testDir, ".project-spec", "changes", "CR-001.yaml"),
      `schema: cr/v1
id: CR-001
domain: billing
summary: "Test CR"
`
    );

    // This should not throw and should not exit
    const mockExit = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
    
    await validate(".project-spec/changes/CR-001.yaml");
    
    expect(mockExit).not.toHaveBeenCalled();
    
    mockExit.mockRestore();
  });
});
