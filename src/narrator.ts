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
// Narrative generation
// ---------------------------------------------------------------------------

const IMPERATIVE_VERBS = /\b(add|fix|update|remove|refactor|implement|change|rename|move|delete|create|extract|merge|revert|bump|chore|docs|test|feat|perf|style|ci|build|revert)\b/i;
const ISSUE_PATTERN = /[A-Z]+-\d+/;

/**
 * Compute narrative weight for a commit based on message cues.
 */
function computeWeight(message: string): number {
  let weight = 1;
  if (IMPERATIVE_VERBS.test(message)) weight += 1;
  if (ISSUE_PATTERN.test(message)) weight += 1;
  if (message.length > 80) weight += 0.5;
  return weight;
}

/**
 * Extract plot points from commit graph, sorted by date.
 */
function extractPlotPoints(graph: CommitGraph): PlotPoint[] {
  const points: PlotPoint[] = [];
  for (const [, node] of graph.commits) {
    points.push({
      hash: node.hash,
      author: node.author,
      date: node.date,
      message: node.message,
      branches: node.branches,
      weight: computeWeight(node.message),
    });
  }
  points.sort((a, b) => a.date.getTime() - b.date.getTime());
  return points;
}

/**
 * Identify protagonist branches: those with most plot points or merges.
 */
function identifyProtagonistBranches(points: PlotPoint[], graph: CommitGraph): BranchArc[] {
  const branchCommits = new Map<string, PlotPoint[]>();
  for (const point of points) {
    for (const branch of point.branches) {
      if (!branchCommits.has(branch)) {
        branchCommits.set(branch, []);
      }
      branchCommits.get(branch)!.push(point);
    }
  }

  const arcs: BranchArc[] = [];
  for (const [branchName, commits] of branchCommits) {
    if (commits.length < 2) continue; // skip trivial branches
    const sorted = commits.sort((a, b) => a.date.getTime() - b.date.getTime());
    const mergeCount = sorted.filter(c => c.message.toLowerCase().startsWith('merge')).length;
    arcs.push({
      branchName,
      commits: sorted,
      startDate: sorted[0].date,
      endDate: sorted[sorted.length - 1].date,
      mergeCount,
    });
  }

  arcs.sort((a, b) => b.commits.length - a.commits.length);
  return arcs.slice(0, 5); // top 5 branches
}

/**
 * Detect conflict arcs: merge commits that involve multiple branches.
 */
function detectConflictArcs(graph: CommitGraph): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  for (const [, node] of graph.commits) {
    if (node.parents.length > 1) {
      const branches = node.branches.filter(b => b !== 'HEAD' && !b.startsWith('tag: '));
      if (branches.length >= 2) {
        arcs.push({
          branches,
          mergeHashes: [node.hash],
          description: `Merge of ${branches.slice(0, 3).join(', ')}` +
            (branches.length > 3 ? ` and ${branches.length - 3} more` : ''),
        });
      }
    }
  }
  return arcs.slice(0, 10);
}

/**
 * Count merge storms: days with >= 3 merges.
 */
function countMergeStorms(graph: CommitGraph): number {
  const mergeDates = new Map<string, number>();
  for (const [, node] of graph.commits) {
    if (node.parents.length > 1) {
      const day = node.date.toISOString().slice(0, 10);
      mergeDates.set(day, (mergeDates.get(day) || 0) + 1);
    }
  }
  let storms = 0;
  for (const count of mergeDates.values()) {
    if (count >= 3) storms++;
  }
  return storms;
}

/**
 * Count long-lived branches: those with span > 30 days and > 5 commits.
 */
function countLongLivedBranches(arcs: BranchArc[]): number {
  let count = 0;
  for (const arc of arcs) {
    const spanDays = (arc.endDate.getTime() - arc.startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (spanDays > 30 && arc.commits.length > 5) count++;
  }
  return count;
}

/**
 * Count refactor hotspots: commits with 'refactor' or 'rename' in message.
 */
function countRefactorHotspots(graph: CommitGraph): number {
  let count = 0;
  for (const [, node] of graph.commits) {
    if (/\b(refactor|rename|move|extract)\b/i.test(node.message)) {
      count++;
    }
  }
  return count;
}

/**
 * Generate a multi-paragraph narrative from the commit graph.
 */
export function generateNarrative(graph: CommitGraph): Narrative {
  const points = extractPlotPoints(graph);
  const protagonistBranches = identifyProtagonistBranches(points, graph);
  const conflictArcs = detectConflictArcs(graph);
  const mergeStorms = countMergeStorms(graph);
  const longLivedBranches = countLongLivedBranches(protagonistBranches);
  const refactorHotspots = countRefactorHotspots(graph);

  const totalCommits = graph.commits.size;
  const topBranch = protagonistBranches[0];

  const paragraphs: string[] = [];

  // Paragraph 1: Overview
  paragraphs.push(
    `This repository's story spans ${totalCommits} commits across ${graph.rootHashes.length} root histories.` +
    (topBranch
      ? ` The most active branch was "${topBranch.branchName}" with ${topBranch.commits.length} contributions.`
      : '')
  );

  // Paragraph 2: Protagonist branches
  if (protagonistBranches.length > 0) {
    const branchList = protagonistBranches
      .slice(0, 3)
      .map(b => `${b.branchName} (${b.commits.length} commits)`)
      .join(', ');
    paragraphs.push(`Key branches driving development: ${branchList}.`);
  }

  // Paragraph 3: Conflict arcs
  if (conflictArcs.length > 0) {
    const conflictDesc = conflictArcs
      .slice(0, 3)
      .map(c => c.description)
      .join('; ');
    paragraphs.push(`Notable merge conflicts arose: ${conflictDesc}.`);
  }