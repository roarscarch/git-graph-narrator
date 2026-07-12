import { CommitGraph, CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export interface ConflictArc {
  id: string;
  branches: string[];
  startCommit: CommitNode;
  endCommit: CommitNode;
  commitCount: number;
  description: string;
}

/**
 * Detect conflict arcs: sequences of commits where two or more branches
 * have overlapping changes (based on file-level or semantic proximity).
 * For now, uses a heuristic: if branches share common parents or merge points,
 * and have commits with similar messages or types within a time window.
 */
export function detectConflictArcs(graph: CommitGraph): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  const branches = collectBranchCommits(graph.commits);
  const branchNames = Object.keys(branches);

  for (let i = 0; i < branchNames.length; i++) {
    for (let j = i + 1; j < branchNames.length; j++) {
      const branchA = branchNames[i];
      const branchB = branchNames[j];
      // Skip same branch or main vs main
      if (branchA === branchB) continue;

      const commitsA = branches[branchA];
      const commitsB = branches[branchB];

      // Find overlapping time windows: commits from both branches within 2 hours of each other
      const candidates: { commitA: CommitNode; commitB: CommitNode }[] = [];
      for (const ca of commitsA) {
        for (const cb of commitsB) {
          const diffMs = Math.abs(ca.date.getTime() - cb.date.getTime());
          if (diffMs < 2 * 60 * 60 * 1000) {
            // same 2-hour window
            candidates.push({ commitA: ca, commitB: cb });
          }
        }
      }

      if (candidates.length === 0) continue;

      // Heuristic: if there are at least 2 commit pairs in the same window, it's a conflict arc
      if (candidates.length >= 2) {
        const startCommit = candidates[0].commitA.date < candidates[0].commitB.date
          ? candidates[0].commitA
          : candidates[0].commitB;
        const endCommit = candidates[candidates.length - 1].commitA.date > candidates[candidates.length - 1].commitB.date
          ? candidates[candidates.length - 1].commitA
          : candidates[candidates.length - 1].commitB;
        const allRelatedCommits = new Set<string>();
        for (const pair of candidates) {
          allRelatedCommits.add(pair.commitA.hash);
          allRelatedCommits.add(pair.commitB.hash);
        }
        arcs.push({
          id: `arc-${branchA}-${branchB}-${startCommit.hash.slice(0, 7)}`,
          branches: [branchA, branchB],
          startCommit,
          endCommit,
          commitCount: allRelatedCommits.size,
          description: `Conflict arc between ${branchA} and ${branchB}: ${candidates.length} overlapping commit pairs detected.`,
        });
      }
    }
  }

  return arcs;
}

interface BranchCommits {
  [branchName: string]: CommitNode[];
}

function collectBranchCommits(commits: CommitNode[]): BranchCommits {
  const branchMap: BranchCommits = {};
  for (const commit of commits) {
    for (const branch of commit.branches) {
      if (!branchMap[branch]) {
        branchMap[branch] = [];
      }
      branchMap[branch].push(commit);
    }
  }
  return branchMap;
}
