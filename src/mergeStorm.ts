import { CommitNode } from './parser.js';
import { BranchProfile } from './branch-classifier.js';

export interface MergeStorm {
  startDate: Date;
  endDate: Date;
  branchNames: string[];
  commitCount: number;
  mergeCount: number;
}

export function detectMergeStorms(
  branches: BranchProfile[],
  allCommits: CommitNode[],
  windowMinutes: number = 60,
  minMerges: number = 3
): MergeStorm[] {
  const storms: MergeStorm[] = [];
  const sortedCommits = [...allCommits].sort((a, b) => a.date.getTime() - b.date.getTime());

  let i = 0;
  while (i < sortedCommits.length) {
    const windowStart = sortedCommits[i].date;
    const windowEnd = new Date(windowStart.getTime() + windowMinutes * 60 * 1000);
    const windowCommits = sortedCommits.filter(
      (c) => c.date >= windowStart && c.date <= windowEnd
    );

    const mergeCommits = windowCommits.filter((c) =>
      c.message.toLowerCase().startsWith('merge')
    );

    if (mergeCommits.length >= minMerges) {
      const branchNames = [...new Set(windowCommits.flatMap((c) => c.branches))];
      storms.push({
        startDate: windowStart,
        endDate: windowEnd,
        branchNames,
        commitCount: windowCommits.length,
        mergeCount: mergeCommits.length,
      });
    }

    i++;
  }

  return storms;
}
