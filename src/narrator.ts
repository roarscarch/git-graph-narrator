import { CommitGraph, CommitNode } from './parser.js';
import { rankCommits, RankedCommit } from './ranker.js';
import { classifyCommit, CommitType } from './classifier.js';
import { Config, DEFAULT_CONFIG } from './config.js';

// ---------------------------------------------------------------------------
// Narrative types
// ---------------------------------------------------------------------------

export interface BranchArc {
  branchName: string;
  commits: RankedCommit[];
  startDate: Date;
  endDate: Date;
  mergeCount: number;
  classification?: string; // e.g., 'feature', 'bugfix', 'refactor', 'chore'
}

export interface ConflictArc {
  branches: string[];
  mergeCommits: RankedCommit[];
  description: string;
}

export interface MergeStorm {
  date: Date;
  mergeCount: number;
  branches: string[];
}

export interface RefactorHotspot {
  filePattern?: string;
  commitCount: number;
  authors: string[];
  dateRange: { start: Date; end: Date };
}

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchArc[];
  conflictArcs: ConflictArc[];
  mergeStorms: MergeStorm[];
  refactorHotspots: RefactorHotspot[];
  totalCommits: number;
  totalBranches: number;
  dateRange: { start: Date; end: Date };
}

// ---------------------------------------------------------------------------
// Helper: compute branch classification based on commit types
// ---------------------------------------------------------------------------

function classifyBranch(commits: RankedCommit[]): string {
  const typeCounts: Record<string, number> = {};
  for (const c of commits) {
    const type = classifyCommit(c.message);
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  }
  // Determine dominant type (excluding unknown)
  let dominantType = 'unknown';
  let maxCount = 0;
  for (const [type, count] of Object.entries(typeCounts)) {
    if (type !== CommitType.UNKNOWN && count > maxCount) {
      maxCount = count;
      dominantType = type;
    }
  }
  // Map to user-friendly label
  const labelMap: Record<string, string> = {
    [CommitType.FEAT]: 'feature',
    [CommitType.FIX]: 'bugfix',
    [CommitType.REFACTOR]: 'refactor',
    [CommitType.CHORE]: 'chore',
    [CommitType.DOCS]: 'documentation',
    [CommitType.STYLE]: 'style',
    [CommitType.PERF]: 'performance',
    [CommitType.TEST]: 'testing',
    [CommitType.CI]: 'ci',
    [CommitType.BUILD]: 'build',
    [CommitType.REVERT]: 'revert',
    [CommitType.MERGE]: 'merge',
  };
  return labelMap[dominantType] || 'unknown';
}

// ---------------------------------------------------------------------------
// Helper: detect conflict arcs from merge commits
// ---------------------------------------------------------------------------

function detectConflictArcs(
  rankedCommits: Map<string, RankedCommit>,
  graph: CommitGraph
): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  // Look for merge commits with multiple parents from different branches
  for (const [hash, node] of graph.commits) {
    if (node.parents.length < 2) continue;
    // Identify distinct branch origins
    const parentBranches = new Set<string>();
    for (const parentHash of node.parents) {
      const parentNode = graph.commits.get(parentHash);
      if (parentNode && parentNode.branches.length > 0) {
        // Use the first branch as representative
        parentBranches.add(parentNode.branches[0]);
      }
    }
    if (parentBranches.size >= 2) {
      const mergeCommit = rankedCommits.get(hash);
      if (mergeCommit) {
        arcs.push({
          branches: Array.from(parentBranches),
          mergeCommits: [mergeCommit],
          description: `Merge of ${Array.from(parentBranches).join(' and ')} at commit ${hash.slice(0,7)}`,
        });
      }
    }
  }
  return arcs;
}

// ---------------------------------------------------------------------------
// Helper: detect merge storms (periods with many merges)
// ---------------------------------------------------------------------------

function detectMergeStorms(
  rankedCommits: RankedCommit[],
  windowHours: number = 24,
  threshold: number = 3
): MergeStorm[] {
  const storms: MergeStorm[] = [];
  const merges = rankedCommits.filter(c => c.message.startsWith('merge') || c.message.startsWith('Merge'));
  if (merges.length === 0) return storms;

  // Sort by date
  const sorted = [...merges].sort((a, b) => a.date.getTime() - b.date.getTime());

  let windowStart = 0;
  for (let i = 0; i < sorted.length; i++) {
    while (sorted[i].date.getTime() - sorted[windowStart].date.getTime() > windowHours * 60 * 60 * 1000) {
      windowStart++;
    }
    const windowCount = i - windowStart + 1;
    if (windowCount >= threshold) {
      // Check if we already have a storm at this date (avoid duplicates)
      const existing = storms.find(s =>
        Math.abs(s.date.getTime() - sorted[i].date.getTime()) < 60 * 60 * 1000
      );
      if (!existing) {
        const branchSet = new Set<string>();
        for (let j = windowStart; j <= i; j++) {
          for (const b of sorted[j].branches) {
            branchSet.add(b);
          }
        }
        storms.push({
          date: sorted[i].date,
          mergeCount: windowCount,
          branches: Array.from(branchSet),
        });
      }
    }
  }
  return storms;
}

// ---------------------------------------------------------------------------
// Helper: detect refactor hotspots
// ---------------------------------------------------------------------------

function detectRefactorHotspots(
  rankedCommits: RankedCommit[],
  threshold: number = 3
): RefactorHotspot[] {
  const hotspots: RefactorHotspot[] = [];
  const refactorCommits = rankedCommits.filter(c => {
    const type = classifyCommit(c.message);
    return type === CommitType.REFACTOR;
  });

  if (refactorCommits.length < threshold) return hotspots;

  // Group by author (simple heuristic: if multiple refactors by same author in close proximity)
  const authorGroups: Map<string, RankedCommit[]> = new Map();
  for (const c of refactorCommits) {
    const group = authorGroups.get(c.author) || [];
    group.push(c);
    authorGroups.set(c.author, group);
  }

  for (const [author, commits] of authorGroups) {
    if (commits.length >= threshold) {
      const sorted = commits.sort((a, b) => a.date.getTime() - b.date.getTime());
      hotspots.push({
        commitCount: commits.length,
        authors: [author],
        dateRange: {
          start: sorted[0].date,
          end: sorted[sorted.length - 1].date,
        },
      });
    }
  }

  return hotspots;
}

// ---------------------------------------------------------------------------
// Main narrative generation
// ---------------------------------------------------------------------------

export function generateNarrative(
  graph: CommitGraph,
  config: Config = DEFAULT_CONFIG
): Narrative {
  const ranked = rankCommits(graph);
  const rankedMap = new Map<string, RankedCommit>();
  for (const c of ranked) {
    rankedMap.set(c.hash, c);
  }