import { CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export enum BranchRole {
  MAIN = 'main',
  FEATURE = 'feature',
  BUGFIX = 'bugfix',
  RELEASE = 'release',
  HOTFIX = 'hotfix',
  OTHER = 'other',
}

export interface BranchProfile {
  branchName: string;
  role: BranchRole;
  totalCommits: number;
  featCount: number;
  fixCount: number;
  choreCount: number;
  refactorCount: number;
  testCount: number;
  mergeCount: number;
  startDate: Date;
  endDate: Date;
  authors: Set<string>;
  commitMessages: string[];
}

function inferBranchRole(branchName: string): BranchRole {
  if (branchName === 'main' || branchName === 'master') {
    return BranchRole.MAIN;
  }
  if (/^feature\//.test(branchName)) {
    return BranchRole.FEATURE;
  }
  if (/^bugfix\//.test(branchName)) {
    return BranchRole.BUGFIX;
  }
  if (/^release\//.test(branchName)) {
    return BranchRole.RELEASE;
  }
  if (/^hotfix\//.test(branchName)) {
    return BranchRole.HOTFIX;
  }
  return BranchRole.OTHER;
}

export function classifyBranch(commits: CommitNode[], branchName: string): BranchProfile {
  const role = inferBranchRole(branchName);
  let featCount = 0;
  let fixCount = 0;
  let choreCount = 0;
  let refactorCount = 0;
  let testCount = 0;
  let mergeCount = 0;
  let startDate: Date = new Date(8640000000000000);
  let endDate: Date = new Date(0);
  const authors = new Set<string>();
  const commitMessages: string[] = [];

  for (const commit of commits) {
    if (commit.branches.includes(branchName)) {
      switch (commit.type) {
        case CommitType.FEAT:
          featCount++;
          break;
        case CommitType.FIX:
          fixCount++;
          break;
        case CommitType.CHORE:
          choreCount++;
          break;
        case CommitType.REFACTOR:
          refactorCount++;
          break;
        case CommitType.TEST:
          testCount++;
          break;
        default:
          break;
      }
      if (/^merge/i.test(commit.message)) {
        mergeCount++;
      }
      if (commit.date < startDate) startDate = commit.date;
      if (commit.date > endDate) endDate = commit.date;
      authors.add(commit.author);
      commitMessages.push(commit.message);
    }
  }

  return {
    branchName,
    role,
    totalCommits: commits.filter(c => c.branches.includes(branchName)).length,
    featCount,
    fixCount,
    choreCount,
    refactorCount,
    testCount,
    mergeCount,
    startDate,
    endDate,
    authors,
    commitMessages,
  };
}

export function classifyAllBranches(commits: CommitNode[]): Map<string, BranchProfile> {
  const branchSet = new Set<string>();
  for (const commit of commits) {
    for (const branch of commit.branches) {
      branchSet.add(branch);
    }
  }

  const profiles = new Map<string, BranchProfile>();
  for (const branchName of branchSet) {
    profiles.set(branchName, classifyBranch(commits, branchName));
  }
  return profiles;
}
