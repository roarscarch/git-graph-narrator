// ---------------------------------------------------------------------------
// Narrator — generates a human-readable story from the commit graph
// ---------------------------------------------------------------------------

import { CommitGraph, CommitNode } from './parser.js';
import { RankedCommit } from './ranker.js';
import { CommitType, classifyCommit } from './classifier.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BranchArc {
  branchName: string;
  commits: RankedCommit[];
  startDate: Date;
  endDate: Date;
  mergeCount: number;
}

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchArc[];
  conflictArcs: ConflictArc[];
  refactorHotspots: RefactorHotspot[];
  mergeStorms: MergeStorm[];
}

export interface ConflictArc {
  branchA: string;
  branchB: string;
  conflictCount: number;
  description: string;
}

export interface RefactorHotspot {
  file: string;
  refactorCount: number;
  authors: string[];
}

export interface MergeStorm {
  date: Date;
  mergeCount: number;
  branches: string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Configuration for narrative generation
// ---------------------------------------------------------------------------

export interface NarratorConfig {
  maxProtagonists: number;
  longLivedThresholdDays: number;
  refactorWeight: number;
  detectConflicts: boolean;
  detectHotspots: boolean;
  detectMergeStorms: boolean;
  mergeStormWindowHours: number;
  mergeStormThreshold: number;
  classifyBranches: boolean;
}

export const DEFAULT_NARRATOR_CONFIG: NarratorConfig = {
  maxProtagonists: 3,
  longLivedThresholdDays: 30,
  refactorWeight: 1.5,
  detectConflicts: true,
  detectHotspots: true,
  detectMergeStorms: true,
  mergeStormWindowHours: 6,
  mergeStormThreshold: 3,
  classifyBranches: true,
};

// ---------------------------------------------------------------------------
// Helper: build a map from hash to CommitNode
// ---------------------------------------------------------------------------

function buildCommitMap(commits: CommitNode[]): Map<string, CommitNode> {
  const map = new Map<string, CommitNode>();
  for (const c of commits) {
    map.set(c.hash, c);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helper: classify all commits
// ---------------------------------------------------------------------------

function classifyCommits(commits: CommitNode[]): Map<string, CommitType> {
  const map = new Map<string, CommitType>();
  for (const c of commits) {
    map.set(c.hash, classifyCommit(c));
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helper: detect merge storms
// ---------------------------------------------------------------------------

function detectMergeStorms(
  commits: CommitNode[],
  windowHours: number,
  threshold: number
): MergeStorm[] {
  if (commits.length === 0) return [];

  // Filter merge commits
  const mergeCommits = commits.filter((c) => c.isMerge);
  if (mergeCommits.length < threshold) return [];

  // Sort by date ascending
  const sorted = [...mergeCommits].sort((a, b) => a.date.getTime() - b.date.getTime());

  const storms: MergeStorm[] = [];
  let i = 0;
  while (i < sorted.length) {
    const windowStart = sorted[i].date.getTime();
    const windowEnd = windowStart + windowHours * 60 * 60 * 1000;
    const windowCommits: CommitNode[] = [];
    let j = i;
    while (j < sorted.length && sorted[j].date.getTime() <= windowEnd) {
      windowCommits.push(sorted[j]);
      j++;
    }
    if (windowCommits.length >= threshold) {
      const branchSet = new Set<string>();
      for (const mc of windowCommits) {
        for (const b of mc.branches) {
          branchSet.add(b);
        }
      }
      const branches = Array.from(branchSet).sort();
      const description = `Merge storm detected: ${windowCommits.length} merge commits within ${windowHours} hours involving ${branches.length} branches.`;
      storms.push({
        date: windowCommits[0].date,
        mergeCount: windowCommits.length,
        branches,
        description,
      });
      i = j; // move past this window
    } else {
      i++;
    }
  }
  return storms;
}

// ---------------------------------------------------------------------------
// Helper: detect conflict arcs from merge commits with multiple parents
// ---------------------------------------------------------------------------

function detectConflictArcs(
  commits: CommitNode[],
  commitMap: Map<string, CommitNode>
): ConflictArc[] {
  const conflictPairs = new Map<string, number>(); // key: "branchA|branchB"

  for (const c of commits) {
    if (c.parents.length >= 2) {
      // It's a merge commit — get branches of parents
      const parentBranches: string[] = [];
      for (const parentHash of c.parents) {
        const parent = commitMap.get(parentHash);
        if (parent && parent.branches.length > 0) {
          // Use the first branch as representative
          parentBranches.push(parent.branches[0]);
        }
      }
      // If we have at least two distinct branches
      const uniqueBranches = Array.from(new Set(parentBranches)).sort();
      if (uniqueBranches.length >= 2) {
        for (let i = 0; i < uniqueBranches.length; i++) {
          for (let j = i + 1; j < uniqueBranches.length; j++) {
            const key = `${uniqueBranches[i]}|${uniqueBranches[j]}`;
            conflictPairs.set(key, (conflictPairs.get(key) || 0) + 1);
          }
        }
      }
    }
  }

  const arcs: ConflictArc[] = [];
  for (const [key, count] of conflictPairs.entries()) {
    const [branchA, branchB] = key.split('|');
    arcs.push({
      branchA,
      branchB,
      conflictCount: count,
      description: `Branch '${branchA}' and '${branchB}' have been merged ${count} time(s), indicating recurring integration points.`,
    });
  }
  return arcs.sort((a, b) => b.conflictCount - a.conflictCount);
}

// ---------------------------------------------------------------------------
// Helper: detect refactor hotspots
// ---------------------------------------------------------------------------

function detectRefactorHotspots(
  commits: CommitNode[],
  classified: Map<string, CommitType>
): RefactorHotspot[] {
  const fileMap = new Map<string, { count: number; authors: Set<string> }>();

  for (const c of commits) {
    const type = classified.get(c.hash);
    if (type === CommitType.REFACTOR) {
      // We don't have file-level info from the commit log directly,
      // so we approximate by counting refactor commits per author and per branch
      // In a full implementation, we would parse diff stats.
      // For now, we use a heuristic: count refactor commits and group by branch.
      for (const branch of c.branches) {
        const key = branch;
        if (!fileMap.has(key)) {
          fileMap.set(key, { count: 0, authors: new Set() });
        }
        const entry = fileMap.get(key)!;
        entry.count++;
        entry.authors.add(c.author);
      }
    }
  }

  const hotspots: RefactorHotspot[] = [];
  for (const [file, { count, authors }