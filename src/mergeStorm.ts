import { CommitGraph, CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export interface MergeStorm {
  branchName: string;
  mergeCount: number;
  timeSpan: { start: Date; end: Date };
  averageIntervalMs: number;
  isStorm: boolean;
}

/**
 * Detects merge storms: branches that have a high density of merge commits within a short time window.
 * A storm is defined as >= 3 merges within a 1-hour window.
 */
export function detectMergeStorms(graph: CommitGraph, threshold: number = 3, windowMs: number = 3600000): MergeStorm[] {
  const branchMerges: Map<string, Date[]> = new Map();

  for (const commit of graph.commits) {
    if (commit.type === CommitType.MERGE) {
      // Merge commits typically have multiple parents, so we check for merge type
      // If not classified, fallback: message contains 'merge' or is a merge commit
      if (commit.message.toLowerCase().includes('merge') || commit.type === CommitType.MERGE) {
        // Assign to the branch that the merge was made into (first parent's branch?)
        // For simplicity, we assign to all branches listed, but typically merge is on the target branch
        for (const branch of commit.branches) {
          if (!branchMerges.has(branch)) {
            branchMerges.set(branch, []);
          }
          branchMerges.get(branch)!.push(commit.date);
        }
      }
    }
  }

  const storms: MergeStorm[] = [];

  for (const [branchName, dates] of branchMerges.entries()) {
    if (dates.length < threshold) continue;

    // Sort dates ascending
    dates.sort((a, b) => a.getTime() - b.getTime());

    // Sliding window to find storm clusters
    let i = 0;
    while (i < dates.length) {
      let j = i;
      while (j < dates.length && dates[j].getTime() - dates[i].getTime() <= windowMs) {
        j++;
      }
      const count = j - i;
      if (count >= threshold) {
        const start = dates[i];
        const end = dates[j - 1];
        const totalMs = end.getTime() - start.getTime();
        const averageIntervalMs = count > 1 ? totalMs / (count - 1) : 0;
        storms.push({
          branchName,
          mergeCount: count,
          timeSpan: { start, end },
          averageIntervalMs,
          isStorm: true,
        });
        i = j; // Move past this cluster
      } else {
        i++;
      }
    }
  }

  return storms;
}

/**
 * Generates a human-readable summary of merge storms.
 */
export function summarizeMergeStorms(storms: MergeStorm[]): string {
  if (storms.length === 0) {
    return 'No merge storms detected.';
  }

  const lines: string[] = ['Merge Storms:'];
  for (const storm of storms) {
    const intervalMin = (storm.averageIntervalMs / 60000).toFixed(1);
    lines.push(`  - On branch "${storm.branchName}": ${storm.mergeCount} merges between ${storm.timeSpan.start.toISOString()} and ${storm.timeSpan.end.toISOString()} (avg interval: ${intervalMin} min)`);
  }
  return lines.join('\n');
}