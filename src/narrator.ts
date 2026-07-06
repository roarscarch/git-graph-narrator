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
}

export interface ConflictArc {
  branches: string[];
  mergeHashes: string[];
  description: string;
}

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchArc[];
  conflictArcs: ConflictArc[];
  mergeStorms: number;
  longLivedBranches: number;
  refactorHotspots: number;
  paragraphs: string[];
}

// ---------------------------------------------------------------------------
// Helper: detect merge storms (multiple merges in a short time window)
// ---------------------------------------------------------------------------

const MERGE_STORM_WINDOW_MS = 3600000; // 1 hour
const MERGE_STORM_THRESHOLD = 3; // at least 3 merges in window

function detectMergeStorms(graph: CommitGraph): number {
  const merges = graph.nodes.filter(n => n.parents.length > 1);
  if (merges.length < MERGE_STORM_THRESHOLD) return 0;

  // Sort by date
  merges.sort((a, b) => a.date.getTime() - b.date.getTime());

  let stormCount = 0;
  for (let i = 0; i <= merges.length - MERGE_STORM_THRESHOLD; i++) {
    const windowStart = merges[i].date.getTime();
    const windowEnd = windowStart + MERGE_STORM_WINDOW_MS;
    let count = 1;
    for (let j = i + 1; j < merges.length; j++) {
      if (merges[j].date.getTime() <= windowEnd) {
        count++;
      } else {
        break;
      }
    }
    if (count >= MERGE_STORM_THRESHOLD) {
      stormCount++;
    }
  }
  return stormCount;
}

// ---------------------------------------------------------------------------
// Helper: detect long-lived branches (branches that live > 30 days)
// ---------------------------------------------------------------------------

const LONG_LIVED_DAYS = 30;

function detectLongLivedBranches(graph: CommitGraph): number {
  const branchCommits: Map<string, CommitNode[]> = new Map();
  for (const node of graph.nodes) {
    for (const branch of node.branches) {
      if (!branchCommits.has(branch)) {
        branchCommits.set(branch, []);
      }
      branchCommits.get(branch)!.push(node);
    }
  }

  let longLivedCount = 0;
  for (const [, commits] of branchCommits) {
    if (commits.length < 2) continue;
    commits.sort((a, b) => a.date.getTime() - b.date.getTime());
    const start = commits[0].date.getTime();
    const end = commits[commits.length - 1].date.getTime();
    const days = (end - start) / (1000 * 60 * 60 * 24);
    if (days > LONG_LIVED_DAYS) {
      longLivedCount++;
    }
  }
  return longLivedCount;
}

// ---------------------------------------------------------------------------
// Helper: detect refactor hotspots (commits with refactor keywords)
// ---------------------------------------------------------------------------

const REFACTOR_KEYWORDS = /\b(refactor|reorganize|restructure|rewrite|cleanup|redesign|rework)\b/i;

function detectRefactorHotspots(graph: CommitGraph): number {
  let count = 0;
  for (const node of graph.nodes) {
    if (REFACTOR_KEYWORDS.test(node.message)) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Helper: extract protagonist branches (branches with most commits)
// ---------------------------------------------------------------------------

function extractProtagonistBranches(graph: CommitGraph, topN: number = 3): BranchArc[] {
  const branchCommits: Map<string, CommitNode[]> = new Map();
  for (const node of graph.nodes) {
    for (const branch of node.branches) {
      if (!branchCommits.has(branch)) {
        branchCommits.set(branch, []);
      }
      branchCommits.get(branch)!.push(node);
    }
  }

  const sortedBranches = Array.from(branchCommits.entries())
    .map(([name, commits]) => ({
      branchName: name,
      commits,
      startDate: commits.reduce((min, c) => c.date < min ? c.date : min, commits[0].date),
      endDate: commits.reduce((max, c) => c.date > max ? c.date : max, commits[0].date),
      mergeCount: commits.filter(c => c.parents.length > 1).length,
    }))
    .sort((a, b) => b.commits.length - a.commits.length)
    .slice(0, topN);

  return sortedBranches.map(b => ({
    branchName: b.branchName,
    commits: b.commits.map(c => ({
      hash: c.hash,
      author: c.author,
      date: c.date,
      message: c.message,
      branches: c.branches,
      weight: c.weight,
    })),
    startDate: b.startDate,
    endDate: b.endDate,
    mergeCount: b.mergeCount,
  }));
}

// ---------------------------------------------------------------------------
// Helper: detect conflict arcs (branches that merged with many parents)
// ---------------------------------------------------------------------------

function extractConflictArcs(graph: CommitGraph): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  const merges = graph.nodes.filter(n => n.parents.length > 1);
  for (const merge of merges) {
    arcs.push({
      branches: merge.branches,
      mergeHashes: [merge.hash],
      description: `Merge on ${merge.branches.join(', ')} involving ${merge.parents.length} parents`,
    });
  }
  return arcs;
}

// ---------------------------------------------------------------------------
// Main narrative builder
// ---------------------------------------------------------------------------

export function buildNarrative(graph: CommitGraph): Narrative {
  const protagonistBranches = extractProtagonistBranches(graph);
  const conflictArcs = extractConflictArcs(graph);
  const mergeStorms = detectMergeStorms(graph);
  const longLivedBranches = detectLongLivedBranches(graph);
  const refactorHotspots = detectRefactorHotspots(graph);

  const totalCommits = graph.nodes.length;
  const totalAuthors = new Set(graph.nodes.map(n => n.author)).size;
  const totalMerges = graph.nodes.filter(n => n.parents.length > 1).length;

  const paragraphs: string[] = [];

  // Opening paragraph
  paragraphs.push(
    `This repository tells the story of ${totalCommits} commits by ${totalAuthors} contributors across ${graph.nodes.reduce((acc, n) => acc + n.branches.length, 0)} branch references.`
  );

  // Protagonist branches
  if (protagonistBranches.length > 0) {
    const branchList = protagonistBranches
      .map(b => `${b.branchName} (${b.commits.length} commits, ${b.mergeCount} merges)`)
      .join(', ');
    paragraphs.push(`The main protagonists are the branches: ${branchList}.`);
  }

  // Merge storms
  if (mergeStorms > 0) {
    paragraphs.push(
      `The repository experienced ${mergeStorms} merge storm${mergeStorms > 1 ? 's' : ''}