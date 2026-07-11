import { CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export interface MergeStorm {
  startDate: Date;
  endDate: Date;
  branchCount: number;
  commitCount: number;
  branches: string[];
  intensity: number; // 0..1 based on commit frequency
}

export function detectMergeStorms(
  commits: CommitNode[],
  windowHours: number = 24,
  minBranchThreshold: number = 3
): MergeStorm[] {
  if (commits.length === 0) return [];

  const sorted = [...commits].sort((a, b) => a.date.getTime() - b.date.getTime());
  const storms: MergeStorm[] = [];

  let windowStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[windowStart].date.getTime();
    const current = sorted[i].date.getTime();
    if (current - start > windowHours * 60 * 60 * 1000) {
      // Process the window
      const windowCommits = sorted.slice(windowStart, i);
      const branches = new Set<string>();
      let commitCount = 0;
      for (const c of windowCommits) {
        for (const b of c.branches) {
          branches.add(b);
        }
        commitCount++;
      }
      if (branches.size >= minBranchThreshold) {
        storms.push({
          startDate: new Date(start),
          endDate: new Date(current),
          branchCount: branches.size,
          commitCount,
          branches: Array.from(branches),
          intensity: Math.min(1, commitCount / (branches.size * 2)),
        });
      }
      windowStart = i;
    }
  }

  // Handle last window
  const lastWindow = sorted.slice(windowStart);
  if (lastWindow.length > 0) {
    const branches = new Set<string>();
    let commitCount = 0;
    for (const c of lastWindow) {
      for (const b of c.branches) {
        branches.add(b);
      }
      commitCount++;
    }
    if (branches.size >= minBranchThreshold) {
      const start = lastWindow[0].date.getTime();
      const end = lastWindow[lastWindow.length - 1].date.getTime();
      storms.push({
        startDate: new Date(start),
        endDate: new Date(end),
        branchCount: branches.size,
        commitCount,
        branches: Array.from(branches),
        intensity: Math.min(1, commitCount / (branches.size * 2)),
      });
    }
  }

  return storms;
}
