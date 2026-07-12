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
      { hash: 'f', message: 'chore: bump version to 1.0', author: 'Dave', date: new Date(), branches: ['release/1.0'], weight: 1.0, type: CommitType.CHORE },
      { hash: 'g', message: 'fix: correct release bug', author: 'Dave', date: new Date(), branches: ['release/1.0'], weight: 1.2, type: CommitType.FIX },
    ];
    const profile = classifyBranch(commits, 'release/1.0');
    expect(profile.role).toBe(BranchRole.RELEASE);
    expect(profile.totalCommits).toBe(2);
    expect(profile.choreCount).toBe(1);
    expect(profile.fixCount).toBe(1);
  });

  it('should classify branch with no obvious pattern as OTHER', () => {
    const commits: CommitNode[] = [
      { hash: 'h', message: 'random work', author: 'Eve', date: new Date(), branches: ['experiment'], weight: 1.0, type: CommitType.CHORE },
    ];
    const profile = classifyBranch(commits, 'experiment');
    expect(profile.role).toBe(BranchRole.OTHER);
  });

  it('should detect conflict arcs in a branch', () => {
    const commits: CommitNode[] = [
      { hash: 'i', message: 'feat: add feature A', author: 'Frank', date: new Date(), branches: ['feature/conflict'], weight: 2.0, type: CommitType.FEAT },
      { hash: 'j', message: 'fix: resolve conflict with main', author: 'Frank', date: new Date(), branches: ['feature/conflict'], weight: 1.5, type: CommitType.FIX },
      { hash: 'k', message: 'merge branch main into feature/conflict', author: 'Frank', date: new Date(), branches: ['feature/conflict'], weight: 1.2, type: CommitType.MERGE },
      { hash: 'l', message: 'feat: complete feature after merge', author: 'Frank', date: new Date(), branches: ['feature/conflict'], weight: 2.5, type: CommitType.FEAT },
    ];
    const profile = classifyBranch(commits, 'feature/conflict');
    expect(profile.role).toBe(BranchRole.FEATURE);
    expect(profile.hasConflictArc).toBe(true);
    expect(profile.mergeCount).toBe(1);
  });

  it('should not flag conflict arcs if no merge commits present', () => {
    const commits: CommitNode[] = [
      { hash: 'm', message: 'feat: simple feature', author: 'Grace', date: new Date(), branches: ['feature/simple'], weight: 1.0, type: CommitType.FEAT },
    ];
    const profile = classifyBranch(commits, 'feature/simple');
    expect(profile.role).toBe(BranchRole.FEATURE);
    expect(profile.hasConflictArc).toBe(false);
    expect(profile.mergeCount).toBe(0);
  });
});