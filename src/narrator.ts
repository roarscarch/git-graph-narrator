import { CommitGraph, CommitNode } from './parser.js';
import { classifyBranch, BranchProfile, BranchRole } from './branch-classifier.js';
import { CommitType } from './classifier.js';

/**
 * A merge storm is defined as a period (in days) where merge commits occur at a high frequency.
 */
export interface MergeStorm {
  startDate: Date;
  endDate: Date;
  mergeCount: number;
  branchesInvolved: string[];
  description: string;
}

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchProfile[];
  mergeStorms: MergeStorm[];
  refactorHotspots: { branch: string; commitCount: number }[];
  longLivedBranches: { branch: string; days: number }[];
}

/**
 * Detect merge storms from a commit graph.
 * A merge storm is detected when there are more than `threshold` merges within `windowDays` days.
 */
export function detectMergeStorms(
  graph: CommitGraph,
  windowDays: number = 7,
  threshold: number = 5
): MergeStorm[] {
  const mergeCommits = graph.commits.filter(
    (c) => c.type === CommitType.MERGE
  );
  if (mergeCommits.length === 0) return [];

  // Sort by date
  mergeCommits.sort((a, b) => a.date.getTime() - b.date.getTime());

  const storms: MergeStorm[] = [];
  let i = 0;
  while (i < mergeCommits.length) {
    const start = mergeCommits[i];
    const windowEnd = new Date(start.date.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const cluster: CommitNode[] = [start];
    let j = i + 1;
    while (j < mergeCommits.length && mergeCommits[j].date <= windowEnd) {
      cluster.push(mergeCommits[j]);
      j++;
    }
    if (cluster.length >= threshold) {
      const branches = new Set<string>();
      cluster.forEach((c) => c.branches.forEach((b) => branches.add(b)));
      storms.push({
        startDate: cluster[0].date,
        endDate: cluster[cluster.length - 1].date,
        mergeCount: cluster.length,
        branchesInvolved: Array.from(branches),
        description: `Merge storm: ${cluster.length} merges in ${windowDays} days involving ${branches.size} branches`,
      });
      i = j; // skip ahead
    } else {
      i++;
    }
  }
  return storms;
}

/**
 * Identify long-lived branches (branches that existed for more than `maxDays` days).
 */
export function findLongLivedBranches(
  graph: CommitGraph,
  maxDays: number = 30
): { branch: string; days: number }[] {
  const branchDates: Map<string, { first: Date; last: Date }> = new Map();
  for (const commit of graph.commits) {
    for (const branch of commit.branches) {
      const existing = branchDates.get(branch);
      if (existing) {
        if (commit.date < existing.first) existing.first = commit.date;
        if (commit.date > existing.last) existing.last = commit.date;
      } else {
        branchDates.set(branch, { first: commit.date, last: commit.date });
      }
    }
  }
  const longLived: { branch: string; days: number }[] = [];
  for (const [branch, dates] of branchDates) {
    const days = (dates.last.getTime() - dates.first.getTime()) / (1000 * 60 * 60 * 24);
    if (days > maxDays) {
      longLived.push({ branch, days: Math.round(days) });
    }
  }
  return longLived;
}

/**
 * Identify refactor hotspots: branches with many refactor commits.
 */
export function findRefactorHotspots(
  graph: CommitGraph,
  minRefactorCount: number = 3
): { branch: string; commitCount: number }[] {
  const branchRefactorCounts: Map<string, number> = new Map();
  for (const commit of graph.commits) {
    if (commit.type === CommitType.REFACTOR) {
      for (const branch of commit.branches) {
        branchRefactorCounts.set(
          branch,
          (branchRefactorCounts.get(branch) || 0) + 1
        );
      }
    }
  }
  const hotspots: { branch: string; commitCount: number }[] = [];
  for (const [branch, count] of branchRefactorCounts) {
    if (count >= minRefactorCount) {
      hotspots.push({ branch, commitCount: count });
    }
  }
  return hotspots;
}

/**
 * Build a full narrative from the commit graph.
 */
export function buildNarrative(graph: CommitGraph): Narrative {
  // Classify each branch
  const branchNames = new Set<string>();
  graph.commits.forEach((c) => c.branches.forEach((b) => branchNames.add(b)));
  const profiles: BranchProfile[] = [];
  for (const branchName of branchNames) {
    const branchCommits = graph.commits.filter((c) =>
      c.branches.includes(branchName)
    );
    const profile = classifyBranch(branchCommits, branchName);
    profiles.push(profile);
  }

  // Sort profiles: main first, then by totalCommits descending
  profiles.sort((a, b) => {
    if (a.role === BranchRole.MAIN) return -1;
    if (b.role === BranchRole.MAIN) return 1;
    return b.totalCommits - a.totalCommits;
  });

  // Detect merge storms
  const mergeStorms = detectMergeStorms(graph);

  // Find long-lived branches
  const longLivedBranches = findLongLivedBranches(graph);

  // Find refactor hotspots
  const refactorHotspots = findRefactorHotspots(graph);

  // Build summary
  let summary = '';
  const mainProfile = profiles.find((p) => p.role === BranchRole.MAIN);
  if (mainProfile) {
    summary = `The epic of ${mainProfile.branchName}: `;
    summary += `${mainProfile.totalCommits} commits over ${profiles.length} branches. `;
    const featureBranches = profiles.filter((p) => p.role === BranchRole.FEATURE);
    if (featureBranches.length > 0) {
      summary += `${featureBranches.length} feature branches contributed to the plot. `;
    }
    if (mergeStorms.length > 0) {
      summary += `${mergeStorms.length} merge storm${mergeStorms.length > 1 ? 's' : ''} detected. `;
    }
    if (longLivedBranches.length > 0) {
      summary += `${longLivedBranches.length} long-lived branch${longLivedBranches.length > 1 ? 'es' : ''} found. `;
    }
    if (refactorHotspots.length > 0) {
      summary += `${refactorHotspots.length} refactor hotspot${refactorHotspots.length > 1 ? 's' : ''} identified.`;
    }
  } else {
    summary = 'No main branch found. The story is fragmented.';
  }

  const title = `The Epic of ${mainProfile ? mainProfile.branchName : 'Git'}`;

  return {
    title,
    summary,
    protagonistBranches: profiles,
    mergeStorms,
    refactorHotspots,
    longLivedBranches,
  };
}