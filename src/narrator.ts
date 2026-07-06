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
// Heuristics
// ---------------------------------------------------------------------------

const LONG_LIVED_THRESHOLD_DAYS = 30;
const MERGE_STORM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MERGE_STORM_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function classifyBranch(name: string): BranchArc['classification'] {
  const lower = name.toLowerCase();
  if (lower === 'main' || lower === 'master') return 'protagonist';
  if (lower.startsWith('feature/') || lower.startsWith('feat/')) return 'feature';
  if (lower.startsWith('fix/') || lower.startsWith('bugfix/') || lower.startsWith('hotfix/')) return 'fix';
  if (lower.startsWith('chore/') || lower.startsWith('refactor/') || lower.startsWith('docs/')) return 'chore';
  return 'unknown';
}

function daysBetween(a: Date, b: Date): number {
  const diffMs = Math.abs(b.getTime() - a.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// buildNarrative
// ---------------------------------------------------------------------------

export function buildNarrative(graph: CommitGraph): Narrative {
  const { commits, branches } = graph;

  // Group commits by branch
  const branchCommitsMap = new Map<string, CommitNode[]>();
  for (const commit of commits) {
    for (const branch of commit.branches) {
      if (!branchCommitsMap.has(branch)) {
        branchCommitsMap.set(branch, []);
      }
      branchCommitsMap.get(branch)!.push(commit);
    }
  }

  // Build branch arcs
  const arcs: BranchArc[] = [];
  for (const [branchName, branchCommits] of branchCommitsMap) {
    const sorted = branchCommits.sort((a, b) => a.date.getTime() - b.date.getTime());
    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;
    const mergeCount = sorted.filter(c => c.isMerge).length;
    const classification = classifyBranch(branchName);
    const lifespanDays = daysBetween(startDate, endDate);

    arcs.push({
      branchName,
      commits: sorted.map(c => ({
        hash: c.hash,
        author: c.author,
        date: c.date,
        message: c.message,
        branches: c.branches,
        weight: c.weight ?? 1.0,
      })),
      startDate,
      endDate,
      mergeCount,
      classification,
      lifespanDays,
    });
  }

  // Detect protagonist branches (main/master and any with high merge count)
  const protagonistArcs = arcs.filter(a => a.classification === 'protagonist');
  const sortedByMerge = arcs.sort((a, b) => b.mergeCount - a.mergeCount);
  const topMergeBranch = sortedByMerge[0];
  if (protagonistArcs.length === 0 && topMergeBranch) {
    protagonistArcs.push(topMergeBranch);
  }

  // Detect conflict arcs (merge commits involving two distinct branches)
  const conflictArcs: ConflictArc[] = [];
  for (const commit of commits) {
    if (commit.isMerge && commit.parents && commit.parents.length >= 2) {
      const parentBranches = new Set<string>();
      for (const parentHash of commit.parents) {
        const parent = commits.find(c => c.hash === parentHash);
        if (parent) {
          parent.branches.forEach(b => parentBranches.add(b));
        }
      }
      if (parentBranches.size >= 2) {
        const branchList = Array.from(parentBranches);
        conflictArcs.push({
          branches: branchList,
          mergeHashes: [commit.hash],
          description: `Conflict merge of ${branchList.join(' and ')} at ${commit.hash.slice(0,7)}`,
        });
      }
    }
  }

  // Detect merge storms: time windows with many merges
  const mergeCommits = commits.filter(c => c.isMerge).sort((a, b) => a.date.getTime() - b.date.getTime());
  let mergeStorms = 0;
  for (let i = 0; i < mergeCommits.length; i++) {
    let count = 1;
    for (let j = i + 1; j < mergeCommits.length; j++) {
      if (mergeCommits[j].date.getTime() - mergeCommits[i].date.getTime() <= MERGE_STORM_WINDOW_MS) {
        count++;
      } else {
        break;
      }
    }
    if (count >= MERGE_STORM_THRESHOLD) {
      mergeStorms++;
      i += count - 1;
    }
  }

  // Count long-lived branches
  const longLivedBranches = arcs.filter(a => a.lifespanDays > LONG_LIVED_THRESHOLD_DAYS && a.classification !== 'protagonist').length;

  // Count refactor hotspots (commits with 'refactor' in message)
  const refactorHotspots = commits.filter(c => /\b(refactor|refactoring)\b/i.test(c.message)).length;

  // Build paragraphs
  const paragraphs: string[] = [];
  const title = protagonistArcs.length > 0
    ? `The Epic of ${protagonistArcs[0].branchName}`
    : 'The Untold Story of the Repository';

  const totalCommits = commits.length;
  const totalBranches = branches.length;
  paragraphs.push(`This repository has seen ${totalCommits} commits across ${totalBranches} branches.`);

  if (protagonistArcs.length > 0) {
    const main = protagonistArcs[0];
    paragraphs.push(`The protagonist branch '${main.branchName}' contains ${main.commits.length} commits and ${main.mergeCount} merges, spanning ${Math.round(main.lifespanDays)} days.`);
  }

  if (conflictArcs.length > 0) {
    paragraphs.push(`There were ${conflictArcs.length} conflict arcs, involving merges between branches such as ${conflictArcs.slice(0, 3).map(c => c.branches.join(' and ')).join(', ')}.`);
  } else {
    paragraphs.push('No conflict arcs were detected; merges were smooth.');
  }

  if (mergeStorms > 0) {
    paragraphs.push(`The repository experienced ${mergeStorms} merge storm(s) — periods with many merges within a short time.`);
  }

  if (longLivedBranches > 0) {
    paragraphs.push(`${longLivedBranches}