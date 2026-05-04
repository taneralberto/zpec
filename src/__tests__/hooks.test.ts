import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { installHooks, uninstallHooks, checkHooks, isGitRepository } from "../commands/hooks/index.js";

describe("hooks commands", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `ztructure-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
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

  describe("isGitRepository", () => {
    it("returns false when not a git repo", async () => {
      expect(await isGitRepository()).toBe(false);
    });

    it("returns true when in a git repo", async () => {
      execSync("git init", { cwd: testDir });
      expect(await isGitRepository()).toBe(true);
    });
  });

  describe("installHooks", () => {
    it("throws error when not in a git repo", async () => {
      await expect(installHooks({})).rejects.toThrow("No es un repositorio git");
    });

    it("installs hooks in git repo", async () => {
      execSync("git init", { cwd: testDir });
      await installHooks({});

      // Check files exist
      const postMerge = await readFile(join(testDir, ".git", "hooks", "post-merge"), "utf-8");
      const preCommit = await readFile(join(testDir, ".git", "hooks", "pre-commit"), "utf-8");

      expect(postMerge).toContain("Ztructure");
      expect(postMerge).toContain("spec rebuild");
      expect(preCommit).toContain("Ztructure");
      expect(preCommit).toContain("spec validate");
    });

    it("does not overwrite existing hooks without force", async () => {
      execSync("git init", { cwd: testDir });
      
      // Create existing hook
      const hooksDir = join(testDir, ".git", "hooks");
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "post-merge"), "#!/bin/bash\necho 'existing'", { mode: 0o755 });

      // Should not throw, but should warn
      await installHooks({});

      const content = await readFile(join(hooksDir, "post-merge"), "utf-8");
      expect(content).toContain("existing");
    });

    it("overwrites existing hooks with force", async () => {
      execSync("git init", { cwd: testDir });
      
      // Create existing hook
      const hooksDir = join(testDir, ".git", "hooks");
      await mkdir(hooksDir, { recursive: true });
      await writeFile(join(hooksDir, "post-merge"), "#!/bin/bash\necho 'existing'", { mode: 0o755 });

      await installHooks({ force: true });

      const content = await readFile(join(hooksDir, "post-merge"), "utf-8");
      expect(content).toContain("Ztructure");
      expect(content).not.toContain("existing");
    });
  });

  describe("uninstallHooks", () => {
    it("removes ztructure hooks", async () => {
      execSync("git init", { cwd: testDir });
      await installHooks({});
      await uninstallHooks();

      const postMerge = await readFile(join(testDir, ".git", "hooks", "post-merge"), "utf-8");
      expect(postMerge).toBe("");
    });
  });

  describe("checkHooks", () => {
    it("shows not installed when no hooks", async () => {
      execSync("git init", { cwd: testDir });
      
      // This is just a smoke test - we're checking it doesn't throw
      await checkHooks();
    });

    it("shows installed when hooks are present", async () => {
      execSync("git init", { cwd: testDir });
      await installHooks({});
      
      // This is just a smoke test - we're checking it doesn't throw
      await checkHooks();
    });
  });
});
