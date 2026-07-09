// ---------------------------------------------------------------------------
// Commit ranker — PageRank-like algorithm on merge edges
// ---------------------------------------------------------------------------

import { CommitNode, CommitGraph } from './parser.js';

/**
 * Rank commits by impact using a PageRank-like algorithm on merge edges.
 *
 * The key insight: commits that are merged via non-trivial merges (i.e.,
 * they appear as merge parents) are more likely to be "plot points" in the
 * repository's narrative.  We build a directed graph where an edge from
 * commit A to commit B exists if A is a parent of B (either direct or
 * via merge).  We then run a simple iterative PageRank on this graph and
 * return a Map from commit hash to rank.
 *
 * Parameters:
 *   graph         - the parsed commit graph
 *   dampingFactor - standard PageRank damping factor (default 0.85)
 *   maxIterations - maximum iterations (default 100)
 *   tolerance     - convergence threshold (default 1e-6)
 *
 * Returns:
 *   Map<string, number> — commit hash -> rank value
 */
export function rankCommits(
  graph: CommitGraph,
  dampingFactor = 0.85,
  maxIterations = 100,
  tolerance = 1e-6
): Map<string, number> {
  const commits = graph.commits;
  const n = commits.length;
  if (n === 0) return new Map();

  // Build adjacency list: parent -> children (edges from parent to child)
  // For each commit, we store its outgoing edges (its children).
  const childrenMap = new Map<string, CommitNode[]>();
  for (const commit of commits) {
    childrenMap.set(commit.hash, []);
  }

  for (const commit of commits) {
    for (const parentHash of commit.parents) {
      const parentChildren = childrenMap.get(parentHash);
      if (parentChildren) {
        parentChildren.push(commit);
      }
    }
  }

  // Initialize ranks uniformly
  let ranks = new Map<string, number>();
  const initialRank = 1 / n;
  for (const commit of commits) {
    ranks.set(commit.hash, initialRank);
  }

  // Iterative PageRank
  for (let iter = 0; iter < maxIterations; iter++) {
    const newRanks = new Map<string, number>();
    let totalDiff = 0;

    // Calculate dangling node contribution (nodes with no outgoing edges)
    let danglingSum = 0;
    for (const commit of commits) {
      const children = childrenMap.get(commit.hash) || [];
      if (children.length === 0) {
        danglingSum += ranks.get(commit.hash) || 0;
      }
    }

    const randomJump = (1 - dampingFactor) / n;

    for (const commit of commits) {
      // Sum of ranks from incoming edges (i.e., from parents)
      let incomingSum = 0;
      for (const parentHash of commit.parents) {
        const parentRank = ranks.get(parentHash) || 0;
        const parentChildren = childrenMap.get(parentHash) || [];
        const outDegree = parentChildren.length;
        if (outDegree > 0) {
          incomingSum += parentRank / outDegree;
        }
      }

      const newRank =
        randomJump +
        dampingFactor * (incomingSum + danglingSum / n);

      newRanks.set(commit.hash, newRank);
      totalDiff += Math.abs(newRank - (ranks.get(commit.hash) || 0));
    }

    ranks = newRanks;

    if (totalDiff < tolerance) {
      break;
    }
  }

  // Normalize ranks so they sum to 1 (optional, but nice for interpretability)
  let sum = 0;
  for (const rank of ranks.values()) {
    sum += rank;
  }
  if (sum > 0) {
    for (const [hash, rank] of ranks) {
      ranks.set(hash, rank / sum);
    }
  }

  return ranks;
}

/**
 * Assign impact score to each commit based on rank and additional heuristics.
 * The score is a number between 0 and 10 that can be used for narrative weight.
 */
export function assignImpactScores(
  graph: CommitGraph,
  ranks: Map<string, number>
): Map<string, number> {
  const scores = new Map<string, number>();

  // Find max rank for scaling
  let maxRank = 0;
  for (const rank of ranks.values()) {
    if (rank > maxRank) maxRank = rank;
  }

  if (maxRank === 0) {
    // Fallback: assign uniform score if everything is zero (shouldn't happen)
    for (const commit of graph.commits) {
      scores.set(commit.hash, 5);
    }
    return scores;
  }

  for (const commit of graph.commits) {
    const rank = ranks.get(commit.hash) || 0;
    // Scale rank to 0..10
    let score = (rank / maxRank) * 10;

    // Boost merge commits (they are often plot points)
    if (commit.parents.length > 1) {
      score = Math.min(score * 1.3, 10);
    }

    // Boost commits with many children (important branching points)
    const childCount = graph.commits.filter(c => c.parents.includes(commit.hash)).length;
    if (childCount >= 2) {
      score = Math.min(score * 1.2, 10);
    }

    scores.set(commit.hash, Math.round(score * 10) / 10);
  }

  return scores;
}
