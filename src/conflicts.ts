// ---------------------------------------------------------------------------
// Merge storm detection — identifies periods of unusually high merge activity
// ---------------------------------------------------------------------------

import { CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

/**
 * Represents a detected merge storm.
 */
export interface MergeStorm {
  /** Start date of the storm */
  startDate: Date;
  /** End date of the storm */
  endDate: Date;
  /** Number of merges during the storm */
  mergeCount: number;
  /** Average merges per day during the storm */
  intensity: number;
  /** Branches involved in the storm */
  branches: string[];
  /** Hashes of merge commits */
  mergeHashes: string[];
}

/**
 * Options for merge storm detection.
 */
export interface MergeStormOptions {
  /** Minimum number of merges per day to qualify as a storm */
  minMergesPerDay: number;
  /** Minimum storm duration in days */
  minDurationDays: number;
  /** Maximum gap between merges in minutes to be considered part of the same storm */
  maxGapMinutes: number;
}

const DEFAULT_OPTIONS: MergeStormOptions = {
  minMergesPerDay: 3,
  minDurationDays: 1,
  maxGapMinutes: 1440, // 24 hours
};

/**
 * Detects merge storms from a list of commit nodes.
 * Returns an array of MergeStorm objects sorted by start date.
 */
export function detectMergeStorms(
  commits: CommitNode[],
  options: Partial<MergeStormOptions> = {}
): MergeStorm[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Filter merge commits (those with type MERGE or multiple parents)
  const mergeCommits = commits
    .filter(c => c.type === CommitType.MERGE || c.parents.length > 1)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (mergeCommits.length === 0) return [];

  // Group merges into storms based on temporal proximity
  const storms: MergeStorm[] = [];
  let currentStorm: CommitNode[] = [mergeCommits[0]];

  for (let i = 1; i < mergeCommits.length; i++) {
    const prev = mergeCommits[i - 1];
    const curr = mergeCommits[i];
    const gapMinutes = (curr.date.getTime() - prev.date.getTime()) / 60000;

    if (gapMinutes <= opts.maxGapMinutes) {
      currentStorm.push(curr);
    } else {
      if (currentStorm.length >= opts.minMergesPerDay * (opts.minDurationDays || 1)) {
        storms.push(buildStorm(currentStorm));
      }
      currentStorm = [curr];
    }
  }

  // Handle last storm
  if (currentStorm.length >= opts.minMergesPerDay * (opts.minDurationDays || 1)) {
    storms.push(buildStorm(currentStorm));
  }

  return storms;
}

/**
 * Build a MergeStorm from a list of consecutive merge commits.
 */
function buildStorm(merges: CommitNode[]): MergeStorm {
  const startDate = merges[0].date;
  const endDate = merges[merges.length - 1].date;
  const durationDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / 86400000);
  const branches = new Set<string>();
  const mergeHashes: string[] = [];

  for (const m of merges) {
    mergeHashes.push(m.hash);
    for (const b of m.branches) {
      branches.add(b);
    }
  }

  return {
    startDate,
    endDate,
    mergeCount: merges.length,
    intensity: Math.round((merges.length / durationDays) * 100) / 100,
    branches: Array.from(branches).sort(),
    mergeHashes,
  };
}

/**
 * Returns a human-readable summary of a merge storm.
 */
export function formatMergeStorm(storm: MergeStorm): string {
  const durationMs = storm.endDate.getTime() - storm.startDate.getTime();
  const durationDays = Math.round(durationMs / 86400000);
  const branchList = storm.branches.join(', ');
  return `Merge storm: ${storm.mergeCount} merges over ${durationDays} day(s) (${storm.intensity} merges/day) involving branches: ${branchList}`;
}
