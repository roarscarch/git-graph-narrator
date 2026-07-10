import { describe, it, expect } from 'vitest';
import { classifyBranch, BranchRole, BranchProfile } from '../branch-classifier.js';
import { CommitNode } from '../parser.js';
import { CommitType } from '../classifier.js';

describe('classifyBranch', () => {
  it('should classify main branch as MAIN', () => {
    const commits: CommitNode[] = [
      { hash: 'a', message: 'initial', author: 'Alice', date: new Date(), branches: ['main'], weight: 1.0, type: CommitType.CHORE },
      { hash: 'b', message: 'feat: add feature', author: 'Alice', date: new Date(), branches: ['main'], weight: 2.0, type: CommitType.FEAT },
    ];
    const profile = classifyBranch(commits, 'main');
    expect(profile.role).toBe(BranchRole.MAIN);
    expect(profile.branchName).toBe('main');
    expect(profile.totalCommits).toBe(2);
  });

  it('should classify feature branch as FEATURE', () => {
    const commits: CommitNode[] = [
      { hash: 'c', message: 'feat: add login', author: 'Bob', date: new Date(), branches: ['feature/login'], weight: 1.5, type: CommitType.FEAT },
      { hash: 'd', message: 'fix: handle edge case', author: 'Bob', date: new Date(), branches: ['feature/login'], weight: 1.0, type: CommitType.FIX },
    ];
    const profile = classifyBranch(commits, 'feature/login');
    expect(profile.role).toBe(BranchRole.FEATURE);
    expect(profile.totalCommits).toBe(2);
    expect(profile.featCount).toBe(1);
    expect(profile.fixCount).toBe(1);
  });

  it('should classify bugfix branch as BUGFIX', () => {
    const commits: CommitNode[] = [
      { hash: 'e', message: 'fix: resolve crash', author: 'Carol', date: new Date(), branches: ['bugfix/crash'], weight: 1.0, type: CommitType.FIX },
    ];
    const profile = classifyBranch(commits, 'bugfix/crash');
    expect(profile.role).toBe(BranchRole.BUGFIX);
    expect(profile.totalCommits).toBe(1);
    expect(profile.fixCount).toBe(1);
  });

  it('should classify release branch as RELEASE', () => {
    const commits: CommitNode[] = [
      { hash: 'f', message: 'chore: prepare release v1.0', author: 'Dave', date: new Date(), branches: ['release/v1.0'], weight: 1.0, type: CommitType.CHORE },
      { hash: 'g', message: 'docs: update changelog', author: 'Dave', date: new Date(), branches: ['release/v1.0'], weight: 1.0, type: CommitType.DOCS },
    ];
    const profile = classifyBranch(commits, 'release/v1.0');
    expect(profile.role).toBe(BranchRole.RELEASE);
  });

  it('should classify hotfix branch as HOTFIX', () => {
    const commits: CommitNode[] = [
      { hash: 'h', message: 'fix: critical security patch', author: 'Eve', date: new Date(), branches: ['hotfix/security'], weight: 2.0, type: CommitType.FIX },
    ];
    const profile = classifyBranch(commits, 'hotfix/security');
    expect(profile.role).toBe(BranchRole.HOTFIX);
  });

  it('should classify unknown branch as OTHER', () => {
    const commits: CommitNode[] = [
      { hash: 'i', message: 'experimental work', author: 'Frank', date: new Date(), branches: ['experiment'], weight: 0.5, type: CommitType.UNKNOWN },
    ];
    const profile = classifyBranch(commits, 'experiment');
    expect(profile.role).toBe(BranchRole.OTHER);
  });

  it('should compute lifespan correctly', () => {
    const start = new Date('2024-01-01T10:00:00Z');
    const end = new Date('2024-01-10T10:00:00Z');
    const commits: CommitNode[] = [
      { hash: 'j', message: 'first', author: 'Grace', date: start, branches: ['feature/long'], weight: 1.0, type: CommitType.FEAT },
      { hash: 'k', message: 'last', author: 'Grace', date: end, branches: ['feature/long'], weight: 1.0, type: CommitType.FIX },
    ];
    const profile = classifyBranch(commits, 'feature/long');
    expect(profile.lifespanDays).toBeCloseTo(9, 0);
  });

  it('should handle empty commits list', () => {
    const profile = classifyBranch([], 'orphan');
    expect(profile.role).toBe(BranchRole.OTHER);
    expect(profile.totalCommits).toBe(0);
    expect(profile.lifespanDays).toBe(0);
  });
});
