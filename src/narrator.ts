import { CommitGraph, CommitNode } from './parser.js';

// ---------------------------------------------------------------------------
// Narrative types
// ---------------------------------------------------------------------------

export interface PlotPoint {
  hash: string;
  author: string;
  date: Date;
  message: string;
  branches: string[];
  weight: number;
}

export interface BranchArc {
  branchName: string;
  commits: PlotPoint[];
  startDate: Date;
  endDate: Date;
  mergeCount: number;
  classification: 'protagonist' | 'feature' | 'fix' | 'chore' | 'unknown';
  lifespanDays: number;
}

export interface ConflictArc {
  branches: string[];
  mergeHashes: string[];
  description: string;
}

export interface RefactorHotspot {
  branchName: string;
  refactorCommits: PlotPoint[];
  description: string;
}

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchArc[];
  conflictArcs: ConflictArc[];
  mergeStorms: number;
  longLivedBranches: number;
  refactorHotspots: RefactorHotspot[];
  paragraphs: string[];
}

// ---------------------------------------------------------------------------
// Helper: classify a branch based on its name
// ---------------------------------------------------------------------------

function classifyBranch(branchName: string): BranchArc['classification'] {
  const lower = branchName.toLowerCase();
  if (lower === 'main' || lower === 'master') return 'protagonist';
  if (lower.startsWith('feature/') || lower.startsWith('feat/')) return 'feature';
  if (lower.startsWith('fix/') || lower.startsWith('bugfix/') || lower.startsWith('hotfix/')) return 'fix';
  if (lower.startsWith('chore/') || lower.startsWith('refactor/') || lower.startsWith('docs/')) return 'chore';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Detect merge storms: periods with many merges in a short time
// ---------------------------------------------------------------------------

function detectMergeStorms(commits: CommitNode[], thresholdMinutes: number = 60): number {
  const merges = commits
    .filter(c => c.message.toLowerCase().startsWith('merge'))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let storms = 0;
  for (let i = 0; i < merges.length - 1; i++) {
    const diff = merges[i + 1].date.getTime() - merges[i].date.getTime();
    if (diff < thresholdMinutes * 60 * 1000) {
      storms++;
    }
  }
  return storms;
}

// ---------------------------------------------------------------------------
// Detect long-lived branches (lifespan > threshold days)
// ---------------------------------------------------------------------------

function detectLongLivedBranches(branchArcs: BranchArc[], thresholdDays: number = 30): number {
  return branchArcs.filter(b => b.lifespanDays > thresholdDays).length;
}

// ---------------------------------------------------------------------------
// Detect refactor hotspots: branches with many refactor-style commits
// ---------------------------------------------------------------------------

function detectRefactorHotspots(commits: CommitNode[]): RefactorHotspot[] {
  const refactorPatterns = [
    /^refactor/i,
    /^chore\(.*\):.*(?:refactor|rename|move|extract|restructure)/i,
    /^style\(.*\):.*(?:format|reformat|lint)/i,
  ];

  // Group commits by branch
  const branchCommits = new Map<string, PlotPoint[]>();
  for (const commit of commits) {
    const refactorMatch = refactorPatterns.some(p => p.test(commit.message));
    if (refactorMatch) {
      for (const branch of commit.branches) {
        if (!branchCommits.has(branch)) {
          branchCommits.set(branch, []);
        }
        branchCommits.get(branch)!.push({
          hash: commit.hash,
          author: commit.author,
          date: commit.date,
          message: commit.message,
          branches: commit.branches,
          weight: commit.weight,
        });
      }
    }
  }

  const hotspots: RefactorHotspot[] = [];
  for (const [branchName, refactorCommits] of branchCommits) {
    if (refactorCommits.length >= 2) {
      const descriptions = refactorCommits.map(c => c.message).join('; ');
      hotspots.push({
        branchName,
        refactorCommits,
        description: `Branch "${branchName}" had ${refactorCommits.length} refactor commits: ${descriptions}`,
      });
    }
  }

  return hotspots;
}

// ---------------------------------------------------------------------------
// Detect conflict arcs: merge commits that mention conflicts
// ---------------------------------------------------------------------------

function detectConflictArcs(commits: CommitNode[]): ConflictArc[] {
  const conflictPatterns = [
    /merge conflict/i,
    /conflict resolution/i,
    /fix conflict/i,
  ];

  const conflictMerges = commits.filter(c =>
    c.message.toLowerCase().startsWith('merge') &&
    conflictPatterns.some(p => p.test(c.message))
  );

  return conflictMerges.map(cm => ({
    branches: cm.branches,
    mergeHashes: [cm.hash],
    description: `Conflict resolved in merge ${cm.hash.slice(0, 7)}: ${cm.message}`,
  }));
}

// ---------------------------------------------------------------------------
// Main narrative builder
// ---------------------------------------------------------------------------

export function buildNarrative(graph: CommitGraph): Narrative {
  const allCommitNodes: CommitNode[] = [];
  for (const [, node] of graph.commits) {
    allCommitNodes.push(node);
  }

  // Build branch arcs
  const branchMap = new Map<string, PlotPoint[]>();
  for (const node of allCommitNodes) {
    for (const branch of node.branches) {
      if (!branchMap.has(branch)) {
        branchMap.set(branch, []);
      }
      branchMap.get(branch)!.push({
        hash: node.hash,
        author: node.author,
        date: node.date,
        message: node.message,
        branches: node.branches,
        weight: node.weight,
      });
    }
  }

  const branchArcs: BranchArc[] = [];
  for (const [branchName, commits] of branchMap) {
    const sorted = commits.sort((a, b) => a.date.getTime() - b.date.getTime());
    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;
    const lifespanMs = endDate.getTime() - startDate.getTime();
    const lifespanDays = Math.max(1, Math.round(lifespanMs / (1000 * 60 * 60 * 24)));
    const mergeCount = sorted.filter(c => c.message.toLowerCase().startsWith('merge')).length;

    branchArcs.push({
      branchName,
      commits: sorted,
      startDate,
      endDate,
      mergeCount,
      classification: classifyBranch(branchName),
      lifespanDays,
    });
  }

  const protagonistBranches = branchArcs.filter(b => b.classification === 'protagonist');
  const mergeStorms = detectMergeStorms(allCommitNodes, 60);
  const longLivedBranches = detectLongLivedBranches(branchArcs, 30);
  const conflictArcs = detectConflictArcs(allCommitNodes);
  const refactorHotspots = detectRefactorHotspots(allCommitNodes);

  // Generate paragraphs
  const paragraphs: string[] = [];

  if (protagonistBranches.length > 0) {
    const mainBranch = protagonistBranches[0];
    paragraphs.push(
      `The story begins on the ${mainBranch.branchName}