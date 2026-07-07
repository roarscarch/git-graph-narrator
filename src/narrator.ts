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
// Helper: classify a branch by its name and commit messages
// ---------------------------------------------------------------------------

function classifyBranch(commits: PlotPoint[], branchName: string): BranchArc['classification'] {
  const lower = branchName.toLowerCase();
  if (lower === 'main' || lower === 'master' || lower === 'develop') {
    return 'protagonist';
  }
  if (lower.startsWith('feature/') || lower.startsWith('feat/') || lower.includes('feature')) {
    return 'feature';
  }
  if (lower.startsWith('fix/') || lower.startsWith('bugfix/') || lower.includes('fix')) {
    return 'fix';
  }
  if (lower.startsWith('chore/') || lower.startsWith('refactor/') || lower.startsWith('test/') || lower.startsWith('docs/')) {
    return 'chore';
  }
  // Check commit messages for keywords
  for (const c of commits) {
    const msg = c.message.toLowerCase();
    if (msg.startsWith('feat') || msg.startsWith('feature')) return 'feature';
    if (msg.startsWith('fix') || msg.startsWith('bug')) return 'fix';
    if (msg.startsWith('chore') || msg.startsWith('refactor') || msg.startsWith('test') || msg.startsWith('docs')) return 'chore';
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Helper: detect conflict arcs from merge commits
// ---------------------------------------------------------------------------

function detectConflictArcs(graph: CommitGraph): ConflictArc[] {
  const conflicts: ConflictArc[] = [];
  const visitedMerges = new Set<string>();

  for (const node of graph.nodes) {
    // A merge commit has more than one parent
    if (node.parents.length >= 2) {
      const mergeHash = node.hash;
      if (visitedMerges.has(mergeHash)) continue;
      visitedMerges.add(mergeHash);

      // Collect all branches involved: the merge commit's branches and its parents' branches
      const involvedBranches = new Set<string>();
      for (const branch of node.branches) {
        involvedBranches.add(branch);
      }
      for (const parentHash of node.parents) {
        const parentNode = graph.nodes.find(n => n.hash === parentHash);
        if (parentNode) {
          for (const branch of parentNode.branches) {
            involvedBranches.add(branch);
          }
        }
      }

      if (involvedBranches.size >= 2) {
        // Check if this merge likely involved conflicts (based on commit message)
        const msgLower = node.message.toLowerCase();
        const hasConflictKeywords = msgLower.includes('conflict') || msgLower.includes('merge') || msgLower.includes('resolve');
        const description = hasConflictKeywords
          ? `Merge of ${Array.from(involvedBranches).join(' and ')} required conflict resolution`
          : `Merge of ${Array.from(involvedBranches).join(' and ')}`;

        conflicts.push({
          branches: Array.from(involvedBranches),
          mergeHashes: [mergeHash],
          description,
        });
      }
    }
  }

  // Merge adjacent conflicts that share branches (simplistic grouping)
  const grouped: ConflictArc[] = [];
  for (const conflict of conflicts) {
    const existing = grouped.find(g =>
      g.branches.some(b => conflict.branches.includes(b))
    );
    if (existing) {
      existing.mergeHashes.push(...conflict.mergeHashes);
      existing.branches = Array.from(new Set([...existing.branches, ...conflict.branches]));
      existing.description = `Repeated merges between ${existing.branches.join(' and ')}`;
    } else {
      grouped.push({ ...conflict, mergeHashes: [...conflict.mergeHashes] });
    }
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// Helper: detect merge storms (many merges in a short time window)
// ---------------------------------------------------------------------------

function detectMergeStorms(graph: CommitGraph): number {
  const mergeCommits = graph.nodes.filter(n => n.parents.length >= 2);
  if (mergeCommits.length < 3) return 0;

  // Sort by date
  const sorted = mergeCommits.sort((a, b) => a.date.getTime() - b.date.getTime());
  let stormCount = 0;
  let windowStart = 0;

  for (let i = 1; i < sorted.length; i++) {
    const diffMinutes = (sorted[i].date.getTime() - sorted[i - 1].date.getTime()) / 60000;
    if (diffMinutes <= 60) {
      // Within 1 hour window
      if (i - windowStart >= 2) {
        stormCount++;
      }
    } else {
      windowStart = i;
    }
  }

  return stormCount;
}

// ---------------------------------------------------------------------------
// Helper: detect long-lived branches (more than 14 days)
// ---------------------------------------------------------------------------

function detectLongLivedBranches(graph: CommitGraph): number {
  const branchDates: Map<string, { first: Date; last: Date }> = new Map();

  for (const node of graph.nodes) {
    for (const branch of node.branches) {
      const existing = branchDates.get(branch);
      if (existing) {
        if (node.date < existing.first) existing.first = node.date;
        if (node.date > existing.last) existing.last = node.date;
      } else {
        branchDates.set(branch, { first: node.date, last: node.date });
      }
    }
  }

  let longLived = 0;
  for (const [, dates] of branchDates) {
    const days = (dates.last.getTime() - dates.first.getTime()) / 86400000;
    if (days > 14) longLived++;
  }

  return longLived;
}

// ---------------------------------------------------------------------------
// Helper: count refactor hotspots (commits with refactor keywords)
// ---------------------------------------------------------------------------

function detectRefactorHotspots(graph: CommitGraph): number {
  return graph.nodes.filter(n => {
    const msg = n.message.toLowerCase();
    return msg.includes('refactor') || msg.includes('rewrite') || msg.includes('redesign');
  }).length;
}

// ---------------------------------------------------------------------------
// Build narrative from parsed commit graph
// ---------------------------------------------------------------------------

export function buildNarrative(graph: CommitGraph): Narrative {
  // Group commits by branch
  const branchCommits: Map<string, PlotPoint[]> = new Map();
  for (const node of graph.nodes) {
    const plotPoint: PlotPoint = {
      hash: node.hash,
      author: node.author,
      date: node.date,
      message: node.message,
      branches: node.branches,
      weight: node.weight,
    }