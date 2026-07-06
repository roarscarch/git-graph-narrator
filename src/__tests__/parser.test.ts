import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { parseGitLog, CommitGraph, CommitNode } from '../parser.js';

describe('parseGitLog', () => {
  let tempDir: string;
  let cwd: string;

  beforeAll(() => {
    // Create a temporary git repo with known history
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ggn-test-'));
    cwd = tempDir;
    execSync('git init', { cwd });
    execSync('git config user.email "test@test.com"', { cwd });
    execSync('git config user.name "Test User"', { cwd });

    // Create initial commit on main
    fs.writeFileSync(path.join(tempDir, 'a.txt'), 'a');
    execSync('git add a.txt && git commit -m "initial commit"', { cwd });

    // Create a feature branch
    execSync('git checkout -b feature/foo', { cwd });
    fs.writeFileSync(path.join(tempDir, 'b.txt'), 'b');
    execSync('git add b.txt && git commit -m "feat: add b"', { cwd });

    // Merge feature into main
    execSync('git checkout main', { cwd });
    execSync('git merge feature/foo --no-ff -m "merge feature/foo"', { cwd });

    // Another commit on main
    fs.writeFileSync(path.join(tempDir, 'c.txt'), 'c');
    execSync('git add c.txt && git commit -m "chore: add c"', { cwd });
  });

  afterAll(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should return a CommitGraph with commits map and rootHashes', () => {
    const graph = parseGitLog(cwd);
    expect(graph).toBeDefined();
    expect(graph.commits).toBeInstanceOf(Map);
    expect(Array.isArray(graph.rootHashes)).toBe(true);
    expect(graph.commits.size).toBeGreaterThanOrEqual(4);
  });

  it('should parse commit fields correctly', () => {
    const graph = parseGitLog(cwd);
    const commits = Array.from(graph.commits.values());

    // Find the initial commit
    const initial = commits.find(c => c.message === 'initial commit');
    expect(initial).toBeDefined();
    expect(initial!.author).toBe('Test User');
    expect(initial!.date).toBeInstanceOf(Date);
    expect(initial!.parents).toEqual([]);
    expect(initial!.branches).toContain('main');
  });

  it('should handle merge commits with two parents', () => {
    const graph = parseGitLog(cwd);
    const mergeCommit = Array.from(graph.commits.values())
      .find(c => c.message === 'merge feature/foo');
    expect(mergeCommit).toBeDefined();
    expect(mergeCommit!.parents.length).toBe(2);
  });

  it('should include branch names from ref decorations', () => {
    const graph = parseGitLog(cwd);
    const commits = Array.from(graph.commits.values());

    // The feature branch commit should have 'feature/foo' in branches
    const featCommit = commits.find(c => c.message === 'feat: add b');
    expect(featCommit).toBeDefined();
    // Branch may be listed as 'feature/foo' or not if not a tip
    // At minimum, the branch name should appear somewhere
    const allBranches = commits.flatMap(c => c.branches);
    expect(allBranches).toContain('feature/foo');
  });

  it('should throw when git is not available or not a git repo', () => {
    const fakeDir = path.join(os.tmpdir(), 'nonexistent-repo-' + Date.now());
    fs.mkdirSync(fakeDir, { recursive: true });
    expect(() => parseGitLog(fakeDir)).toThrow();
    fs.rmSync(fakeDir, { recursive: true, force: true });
  });

  it('should handle empty repository (no commits)', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ggn-empty-'));
    execSync('git init', { cwd: emptyDir });
    execSync('git config user.email "test@test.com"', { cwd: emptyDir });
    execSync('git config user.name "Test User"', { cwd: emptyDir });

    const graph = parseGitLog(emptyDir);
    expect(graph.commits.size).toBe(0);
    expect(graph.rootHashes).toEqual([]);

    fs.rmSync(emptyDir, { recursive: true, force: true });
  });
});
