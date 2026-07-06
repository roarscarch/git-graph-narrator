import { CommitGraph, CommitNode } from './parser.js';

// ---------------------------------------------------------------------------
// Ranker: Compute narrative weight for each commit
// ---------------------------------------------------------------------------

const DAMPING_FACTOR = 0.85;
const MAX_ITERATIONS = 100;
const CONVERGENCE_THRESHOLD = 0.0001;

/**
 * Compute a PageRank-like score for each commit.
 * Edges: from merge commit to each of its parents.
 * Weight heuristic: commits with imperative verbs or JIRA-style IDs get a boost.
 */
export function rankCommits(graph: CommitGraph): Map<string, number> {
  const { commits } = graph;
  const commitList = Array.from(commits.values());
  const N = commitList.length;

  if (N === 0) {
    return new Map();
  }

  // Build adjacency: for each node, list of parents (incoming edges in PageRank sense)
  const incomingEdges: Map<string, string[]> = new Map();
  for (const node of commitList) {
    incomingEdges.set(node.hash, []);
  }
  for (const node of commitList) {
    for (const parentHash of node.parents) {
      if (commits.has(parentHash)) {
        incomingEdges.get(parentHash)!.push(node.hash);
      }
    }
  }

  // Initialize ranks
  let ranks: Map<string, number> = new Map();
  const initialRank = 1 / N;
  for (const node of commitList) {
    ranks.set(node.hash, initialRank);
  }

  // PageRank iteration
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const newRanks: Map<string, number> = new Map();
    let totalDiff = 0;

    for (const node of commitList) {
      const hash = node.hash;
      const incoming = incomingEdges.get(hash) || [];
      let sumRank = 0;
      for (const incHash of incoming) {
        const incNode = commits.get(incHash)!;
        const outDegree = incNode.parents.filter(p => commits.has(p)).length;
        if (outDegree > 0) {
          sumRank += (ranks.get(incHash) || 0) / outDegree;
        }
      }
      // Damping
      const rank = (1 - DAMPING_FACTOR) / N + DAMPING_FACTOR * sumRank;
      newRanks.set(hash, rank);
      totalDiff += Math.abs((ranks.get(hash) || 0) - rank);
    }

    ranks = newRanks;
    if (totalDiff < CONVERGENCE_THRESHOLD) {
      break;
    }
  }

  // Apply heuristic boost based on commit message content
  const boostedRanks: Map<string, number> = new Map();
  for (const node of commitList) {
    let rank = ranks.get(node.hash) || 0;
    // Boost for imperative verbs (common in good commit messages)
    const imperativePattern = /\b(add|fix|remove|update|refactor|implement|change|rename|bump|upgrade|downgrade|merge|revert|move|delete|create|improve|adjust|clean|bump|optimize|simplify|extract|introduce|replace|switch)\b/i;
    if (imperativePattern.test(node.message)) {
      rank *= 1.15;
    }
    // Boost for JIRA-style issue IDs (e.g., PROJ-123)
    const jiraPattern = /[A-Z]{2,}-\d+/;
    if (jiraPattern.test(node.message)) {
      rank *= 1.10;
    }
    boostedRanks.set(node.hash, rank);
  }

  // Normalize so sum = 1
  const sum = Array.from(boostedRanks.values()).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const [hash, rank] of boostedRanks) {
      boostedRanks.set(hash, rank / sum);
    }
  }

  return boostedRanks;
}
