import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, access, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { init } from "../commands/init.js";

describe("init command", () => {
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory
    testDir = join(tmpdir(), `ztructure-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    await mkdir(testDir, { recursive: true });
    process.chdir(testDir);
  });

  afterEach(async () => {
    // Force remove even if not empty
    try {
      await rm(testDir, { recursive: true, force: true, retryDelay: 100, maxRetries: 3 });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("creates .project-spec directory structure", async () => {
    await init({ force: false });

    const specPath = join(testDir, ".project-spec");
    const specStat = await stat(specPath);
    expect(specStat.isDirectory()).toBe(true);

    // Check all subdirectories exist
    const subdirs = ["changes", "decisions", "constraints", "domains", "queries"];
    for (const subdir of subdirs) {
      const subdirStat = await stat(join(specPath, subdir));
      expect(subdirStat.isDirectory()).toBe(true);
    }
  });

  it("creates config.yaml", async () => {
    await init({});

    const configPath = join(testDir, ".project-spec", "config.yaml");
    const configStat = await stat(configPath);
    expect(configStat.isFile()).toBe(true);
  });

  it("creates .gitignore in .project-spec", async () => {
    await init({});

    const gitignorePath = join(testDir, ".project-spec", ".gitignore");
    const gitignoreStat = await stat(gitignorePath);
    expect(gitignoreStat.isFile()).toBe(true);
  });

  it("creates a single domain when specified", async () => {
    await init({ domain: ["billing"] });

    const billingDomain = join(testDir, ".project-spec", "domains", "DOMAIN-billing.yaml");
    const domainStat = await stat(billingDomain);
    expect(domainStat.isFile()).toBe(true);
  });

  it("throws error if already exists without force", async () => {
    await init({});

    await expect(init({})).rejects.toThrow("ya existe");
  });

  it("overwrites with force flag", async () => {
    await init({});
    
    // Should not throw with force
    await expect(init({ force: true })).resolves.toBeUndefined();
  });
});
