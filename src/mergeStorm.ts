import { CommitGraph, CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export interface MergeStorm {
  startDate: Date;
  endDate: Date;
  branch: string;
  totalMerges: number;
  commitsInvolved: number;
  description: string;
}

const MERGE_STORM_THRESHOLD = 3; // minimum number of merges in a short period
const STORM_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Detects merge storms: periods where a branch experiences an unusually high number of merges
 * within a short time window.
 */
export function detectMergeStorms(graph: CommitGraph): MergeStorm[] {
  const storms: MergeStorm[] = [];
  const branchMergeTimes: Map<string, Date[]> = new Map();

  for (const commit of graph.commits) {
    if (commit.type === CommitType.MERGE) {
      for (const branch of commit.branches) {
        const times = branchMergeTimes.get(branch) || [];
        times.push(commit.date);
        branchMergeTimes.set(branch, times);
      }
    }
  }

  for (const [branch, times] of branchMergeTimes.entries()) {
    if (times.length < MERGE_STORM_THRESHOLD) continue;

    // Sort times in ascending order
    times.sort((a, b) => a.getTime() - b.getTime());

    let windowStart = 0;
    while (windowStart <= times.length - MERGE_STORM_THRESHOLD) {
      const windowEnd = windowStart + MERGE_STORM_THRESHOLD - 1;
      const timeSpan = times[windowEnd].getTime() - times[windowStart].getTime();
      if (timeSpan <= STORM_WINDOW_MS) {
        // Found a storm window; expand to include all merges within the window
        const stormStart = times[windowStart];
        const stormEnd = times[windowEnd];
        let count = 0;
        for (let i = windowStart; i < times.length; i++) {
          if (times[i].getTime() - stormStart.getTime() <= STORM_WINDOW_MS) {
            count++;
          } else {
            break;
          }
        }
        const commitsInvolved = graph.commits.filter(
          (c) =>
            c.type === CommitType.MERGE &&
            c.branches.includes(branch) &&
            c.date >= stormStart &&
            c.date <= new Date(stormStart.getTime() + STORM_WINDOW_MS)
        ).length;

        storms.push({
          startDate: stormStart,
          endDate: stormEnd,
          branch,
          totalMerges: count,
          commitsInvolved,
          description: `Merge storm on ${branch}: ${count} merges within 24 hours (${stormStart.toISOString().split('T')[0]} to ${stormEnd.toISOString().split('T')[0]})`,
        });
        break; // Only report one storm per branch for simplicity
      }
      windowStart++;
    }
  }

  return storms;
}
