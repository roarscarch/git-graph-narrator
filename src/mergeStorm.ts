import { CommitGraph, CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

/**
 * Represents a detected merge storm — a period of high merge activity.
 */
export interface MergeStorm {
  /** Start date of the storm */
  startDate: Date;
  /** End date of the storm */
  endDate: Date;
  /** Number of merges in this storm */
  mergeCount: number;
  /** The branches involved */
  branches: string[];
  /** The hashes of merge commits */
  mergeCommits: string[];
}

/**
 * Configuration for merge storm detection.
 */
export interface MergeStormConfig {
  /** Maximum time window (in milliseconds) to consider as a storm. Default: 24 hours. */
  windowMs: number;
  /** Minimum number of merges within the window to qualify as a storm. Default: 5. */
  minMerges: number;
}

const DEFAULT_CONFIG: MergeStormConfig = {
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  minMerges: 5,
};

/**
 * Detects merge storms in the commit graph.
 * A merge storm is defined as a period where a high number of merge commits occur within a sliding time window.
 *
 * @param graph - The parsed commit graph.
 * @param config - Optional configuration overrides.
 * @returns An array of detected MergeStorm objects, sorted chronologically.
 */
export function detectMergeStorms(
  graph: CommitGraph,
  config: Partial<MergeStormConfig> = {}
): MergeStorm[] {
  const cfg: MergeStormConfig = { ...DEFAULT_CONFIG, ...config };

  // Filter merge commits (commits with type MERGE)
  const mergeCommits: CommitNode[] = graph.commits.filter(
    (c) => c.type === CommitType.MERGE
  );

  if (mergeCommits.length < cfg.minMerges) {
    return [];
  }

  // Sort merge commits by date
  mergeCommits.sort((a, b) => a.date.getTime() - b.date.getTime());

  const storms: MergeStorm[] = [];
  let windowStart = 0;

  while (windowStart < mergeCommits.length) {
    const windowEnd = findWindowEnd(mergeCommits, windowStart, cfg.windowMs);
    const countInWindow = windowEnd - windowStart + 1;

    if (countInWindow >= cfg.minMerges) {
      // Collect branches and hashes
      const branchesSet = new Set<string>();
      const mergeHashes: string[] = [];
      for (let i = windowStart; i <= windowEnd; i++) {
        const mc = mergeCommits[i];
        mc.branches.forEach((b) => branchesSet.add(b));
        mergeHashes.push(mc.hash);
      }

      storms.push({
        startDate: mergeCommits[windowStart].date,
        endDate: mergeCommits[windowEnd].date,
        mergeCount: countInWindow,
        branches: Array.from(branchesSet),
        mergeCommits: mergeHashes,
      });

      // Move window start to next commit after current window
      windowStart = windowEnd + 1;
    } else {
      windowStart++;
    }
  }

  return storms;
}

/**
 * Finds the index of the last merge commit that falls within the time window starting at startIdx.
 *
 * @param commits - Sorted array of merge commit nodes.
 * @param startIdx - Starting index.
 * @param windowMs - Time window in milliseconds.
 * @returns Index of the last commit within the window.
 */
function findWindowEnd(
  commits: CommitNode[],
  startIdx: number,
  windowMs: number
): number {
  const startTime = commits[startIdx].date.getTime();
  let end = startIdx;
  while (
    end + 1 < commits.length &&
    commits[end + 1].date.getTime() - startTime <= windowMs
  ) {
    end++;
  }
  return end;
}

/**
 * Generates a human-readable description of merge storms.
 *
 * @param storms - Array of detected merge storms.
 * @returns A string summarizing the storms.
 */
export function describeMergeStorms(storms: MergeStorm[]): string {
  if (storms.length === 0) {
    return 'No significant merge storms detected.';
  }

  const lines: string[] = [];
  lines.push(`Detected ${storms.length} merge storm(s):`);
  lines.push('');

  for (let i = 0; i < storms.length; i++) {
    const storm = storms[i];
    const durationMs = storm.endDate.getTime() - storm.startDate.getTime();
    const durationHours = (durationMs / (1000 * 60 * 60)).toFixed(1);
    lines.push(`Storm #${i + 1}:`);
    lines.push(`  Period: ${storm.startDate.toISOString()} to ${storm.endDate.toISOString()} (${durationHours} hours)`);
    lines.push(`  Merges: ${storm.mergeCount}`);
    lines.push(`  Branches involved: ${storm.branches.join(', ')}`);
    lines.push(`  Merge commits: ${storm.mergeCommits.join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
