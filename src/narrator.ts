import { CommitGraph, CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

/**
 * Represents a detected merge storm — a short period with many merges.
 */
export interface MergeStorm {
  /** Time window start */
  start: Date;
  /** Time window end */
  end: Date;
  /** Number of merge commits in this window */
  count: number;
  /** Hashes of involved merge commits */
  mergeHashes: string[];
}

/**
 * Represents a protagonist branch — a branch with high narrative weight.
 */
export interface ProtagonistBranch {
  branchName: string;
  commits: Omit<CommitNode, 'weight' | 'type'>[];
  startDate: Date;
  endDate: Date;
  mergeCount: number;
  narrativeWeight: number;
}

/**
 * Represents a conflict arc — a period of diverging branches that later merge.
 */
export interface ConflictArc {
  /** Branches involved in the conflict */
  branches: string[];
  /** The merge commit that resolved the conflict */
  mergeHash: string;
  /** The date of the merge */
  date: Date;
  /** Number of commits that diverged */
  divergedCommits: number;
}

/**
 * The final narrative output.
 */
export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: ProtagonistBranch[];
  conflictArcs: ConflictArc[];
  mergeStorms: MergeStorm[];
}

/**
 * Detects merge storms — periods (default 7 days) with more than `threshold` merge commits.
 * @param graph - The commit graph
 * @param windowDays - The time window in days (default 7)
 * @param threshold - Minimum merges to consider a storm (default 3)
 * @returns Array of detected merge storms
 */
export function detectMergeStorms(
  graph: CommitGraph,
  windowDays: number = 7,
  threshold: number = 3
): MergeStorm[] {
  const mergeCommits = graph.commits.filter((c) => c.type === CommitType.MERGE);
  if (mergeCommits.length < threshold) return [];

  // Sort by date
  const sorted = [...mergeCommits].sort((a, b) => a.date.getTime() - b.date.getTime());

  const storms: MergeStorm[] = [];
  let i = 0;
  while (i < sorted.length) {
    const windowStart = sorted[i].date;
    const windowEnd = new Date(windowStart.getTime() + windowDays * 24 * 60 * 60 * 1000);
    const windowMerges: string[] = [];
    let j = i;
    while (j < sorted.length && sorted[j].date <= windowEnd) {
      windowMerges.push(sorted[j].hash);
      j++;
    }
    if (windowMerges.length >= threshold) {
      storms.push({
        start: windowStart,
        end: windowEnd,
        count: windowMerges.length,
        mergeHashes: windowMerges,
      });
    }
    i = j;
  }

  return storms;
}

/**
 * Identifies conflict arcs — periods where branches diverged and later merged.
 * @param graph - The commit graph
 * @returns Array of conflict arcs
 */
export function detectConflictArcs(graph: CommitGraph): ConflictArc[] {
  const arcs: ConflictArc[] = [];

  // For each merge commit, find the branches that were merged
  for (const merge of graph.commits) {
    if (merge.type !== CommitType.MERGE) continue;

    // Find parent commits (assumes merge has multiple parents)
    const parents = graph.commits.filter((c) =>
      merge.parentHashes?.includes(c.hash)
    );
    if (parents.length < 2) continue;

    // Identify branches involved
    const branchSet = new Set<string>();
    for (const parent of parents) {
      for (const branch of parent.branches) {
        branchSet.add(branch);
      }
    }
    const branches = Array.from(branchSet);
    if (branches.length < 2) continue;

    // Count diverged commits (commits on those branches not on main before merge)
    const mainBranch = 'main';
    const mainParent = parents.find((p) => p.branches.includes(mainBranch));
    const otherParents = parents.filter((p) => !p.branches.includes(mainBranch));

    let divergedCommits = 0;
    // Simple heuristic: count commits on non-main branches that are ancestors of the merge
    const otherBranchCommits = graph.commits.filter((c) => {
      if (c.branches.includes(mainBranch)) return false;
      // Check if this commit is an ancestor of any other parent (simplified: just check branch membership)
      return otherParents.some((op) =>
        c.branches.some((b) => op.branches.includes(b))
      );
    });
    divergedCommits = otherBranchCommits.length;

    arcs.push({
      branches,
      mergeHash: merge.hash,
      date: merge.date,
      divergedCommits,
    });
  }

  return arcs;
}

/**
 * Identifies protagonist branches — branches with the highest total narrative weight.
 * @param graph - The commit graph
 * @param topN - Number of protagonist branches to return (default 3)
 * @returns Array of protagonist branches
 */
export function identifyProtagonistBranches(
  graph: CommitGraph,
  topN: number = 3
): ProtagonistBranch[] {
  // Group commits by branch
  const branchMap = new Map<string, Omit<CommitNode, 'weight' | 'type'>[]>();
  for (const commit of graph.commits) {
    for (const branch of commit.branches) {
      if (!branchMap.has(branch)) {
        branchMap.set(branch, []);
      }
      branchMap.get(branch)!.push({
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        branches: commit.branches,
      });
    }
  }

  // Calculate narrative weight for each branch
  const branchWeights: { branchName: string; commits: Omit<CommitNode, 'weight' | 'type'>[]; narrativeWeight: number }[] = [];
  for (const [branchName, commits] of branchMap.entries()) {
    // Weight based on number of commits and their individual weights
    const totalWeight = commits.reduce((sum, c) => {
      const node = graph.commits.find((n) => n.hash === c.hash);
      return sum + (node ? node.weight : 1.0);
    }, 0);
    branchWeights.push({ branchName, commits, narrativeWeight: totalWeight });
  }

  // Sort by weight descending
  branchWeights.sort((a, b) => b.narrativeWeight - a.narrativeWeight);

  // Return top N
  const topBranches = branchWeights.slice(0, topN);
  return topBranches.map((b) => {
    const dates = b.commits.map((c) => c.date).sort((a, b) => a.getTime() - b.getTime());
    const mergeCount = b.commits.filter((c) =>
      graph.commits.find((n) => n.hash === c.hash)?.type === CommitType.MERGE
    ).length;
    return {
      branchName: b.branchName,
      commits: b.commits,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      mergeCount,
      narrativeWeight: b.narrativeWeight,
    };
  });
}