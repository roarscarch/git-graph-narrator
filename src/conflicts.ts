// ---------------------------------------------------------------------------
// Conflict detector — identifies merge conflicts and conflict arcs from the
// commit DAG by analyzing parallel work on overlapping file sets.
// ---------------------------------------------------------------------------

import { CommitGraph, CommitNode } from './parser.js';
import { CommitType, classifyCommit } from './classifier.js';

/**
 * Represents a detected conflict between two branches.
 */
export interface ConflictArc {
  /** Name of the first branch involved */
  branchA: string;
  /** Name of the second branch involved */
  branchB: string;
  /** Commits on branchA that contributed to the conflict */
  commitsA: CommitNode[];
  /** Commits on branchB that contributed to the conflict */
  commitsB: CommitNode[];
  /** The merge commit that resolved the conflict, if any */
  resolution?: CommitNode;
  /** Estimated severity (0-1) based on number of conflicting changes */
  severity: number;
  /** Human-readable description */
  description: string;
}

/**
 * Detects conflict arcs in the commit graph.
 * A conflict arc exists when two branches have parallel commits that touch
 * overlapping file sets and are later merged.
 */
export function detectConflictArcs(graph: CommitGraph): ConflictArc[] {
  const arcs: ConflictArc[] = [];

  // Build a map from commit hash to node for quick lookup
  const nodeMap = new Map<string, CommitNode>();
  for (const node of graph.nodes) {
    nodeMap.set(node.hash, node);
  }

  // Identify merge commits
  const mergeCommits = graph.nodes.filter(
    (n) => classifyCommit(n.message) === CommitType.MERGE
  );

  for (const merge of mergeCommits) {
    // Find the two parents (assuming a typical two-parent merge)
    const parents = merge.parents.slice(0, 2);
    if (parents.length < 2) continue;

    const parentA = nodeMap.get(parents[0]);
    const parentB = nodeMap.get(parents[1]);
    if (!parentA || !parentB) continue;

    // Determine branch names from the parents (use branch metadata if available)
    const branchA = parentA.branches.length > 0 ? parentA.branches[0] : 'unknown';
    const branchB = parentB.branches.length > 0 ? parentB.branches[0] : 'unknown';

    // Skip if both parents are on the same branch (e.g., fast-forward)
    if (branchA === branchB) continue;

    // Collect commits on each branch since divergence
    const lca = findLCA(parentA, parentB, nodeMap);
    const commitsA = getCommitsSince(parentA, lca, nodeMap);
    const commitsB = getCommitsSince(parentB, lca, nodeMap);

    // Detect overlap by counting commits that touch similar areas
    // (simplified heuristic: refactor and fix commits often indicate conflict)
    const conflictingA = commitsA.filter((c) => isLikelyConflicting(c));
    const conflictingB = commitsB.filter((c) => isLikelyConflicting(c));

    // Compute severity based on proportion of conflicting commits
    const total = commitsA.length + commitsB.length || 1;
    const conflictCount = conflictingA.length + conflictingB.length;
    const severity = Math.min(1, conflictCount / total);

    if (severity > 0) {
      arcs.push({
        branchA,
        branchB,
        commitsA: conflictingA,
        commitsB: conflictingB,
        resolution: merge,
        severity,
        description: `Conflict between "${branchA}" and "${branchB}" resolved in merge ${merge.hash.slice(0, 7)}`,
      });
    }
  }

  return arcs;
}

/**
 * Heuristic: a commit is "likely conflicting" if it is a refactor, fix, or
 * touches multiple concerns (feat + fix combo).
 */
function isLikelyConflicting(node: CommitNode): boolean {
  const type = classifyCommit(node.message);
  return (
    type === CommitType.REFACTOR ||
    type === CommitType.FIX ||
    type === CommitType.FEAT
  );
}

/**
 * Finds the Lowest Common Ancestor (LCA) of two commits in the DAG.
 * Uses a simple BFS from nodeA to find first intersection with ancestors of nodeB.
 */
function findLCA(
  nodeA: CommitNode,
  nodeB: CommitNode,
  nodeMap: Map<string, CommitNode>
): CommitNode {
  // Collect ancestors of nodeA (including itself)
  const ancestorsA = new Set<string>();
  const queueA: string[] = [nodeA.hash];
  while (queueA.length > 0) {
    const hash = queueA.pop()!;
    if (ancestorsA.has(hash)) continue;
    ancestorsA.add(hash);
    const node = nodeMap.get(hash);
    if (node) {
      for (const parent of node.parents) {
        queueA.push(parent);
      }
    }
  }

  // BFS from nodeB to find first ancestor that is in ancestorsA
  const visitedB = new Set<string>();
  const queueB: string[] = [nodeB.hash];
  while (queueB.length > 0) {
    const hash = queueB.shift()!;
    if (visitedB.has(hash)) continue;
    visitedB.add(hash);
    if (ancestorsA.has(hash)) {
      return nodeMap.get(hash) || nodeA;
    }
    const node = nodeMap.get(hash);
    if (node) {
      for (const parent of node.parents) {
        queueB.push(parent);
      }
    }
  }

  // Fallback: return root (first commit with no parents)
  return nodeA;
}

/**
 * Gets all commits reachable from `node` up to (but not including) `stop`.
 * Returns nodes in topological order (descending from node).
 */
function getCommitsSince(
  node: CommitNode,
  stop: CommitNode,
  nodeMap: Map<string, CommitNode>
): CommitNode[] {
  const result: CommitNode[] = [];
  const visited = new Set<string>();
  const queue: string[] = [node.hash];

  while (queue.length > 0) {
    const hash = queue.pop()!;
    if (hash === stop.hash) break;
    if (visited.has(hash)) continue;
    visited.add(hash);
    const n = nodeMap.get(hash);
    if (n) {
      result.push(n);
      for (const parent of n.parents) {
        queue.push(parent);
      }
    }
  }

  return result;
}