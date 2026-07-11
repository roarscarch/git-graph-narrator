import { CommitGraph, CommitNode, Edge } from './parser.js';
import { CommitType, classifyCommit } from './classifier.js';
import { BranchRole, classifyBranch, BranchProfile } from './branch-classifier.js';

export interface Narrative {
  title: string;
  summary: string;
  protagonistBranches: BranchNarrative[];
  conflictArcs: ConflictArc[];
  mergeStorms: MergeStorm[];
}

export interface BranchNarrative {
  branchName: string;
  role: BranchRole;
  commits: CommitNode[];
  startDate: Date;
  endDate: Date;
  mergeCount: number;
}

export interface ConflictArc {
  description: string;
  branches: string[];
  commitCount: number;
}

export interface MergeStorm {
  timeRange: { start: Date; end: Date };
  mergeCount: number;
  branches: string[];
  description: string;
}

export function buildNarrative(graph: CommitGraph): Narrative {
  const branchMap = new Map<string, CommitNode[]>();
  for (const commit of graph.commits) {
    for (const branch of commit.branches) {
      if (!branchMap.has(branch)) {
        branchMap.set(branch, []);
      }
      branchMap.get(branch)!.push(commit);
    }
  }

  const branchProfiles: BranchProfile[] = [];
  for (const [branchName, commits] of branchMap) {
    const profile = classifyBranch(commits, branchName);
    branchProfiles.push(profile);
  }

  const protagonistBranches: BranchNarrative[] = branchProfiles.map(profile => ({
    branchName: profile.branchName,
    role: profile.role,
    commits: profile.commits,
    startDate: profile.commits.length > 0 ? profile.commits[0].date : new Date(),
    endDate: profile.commits.length > 0 ? profile.commits[profile.commits.length - 1].date : new Date(),
    mergeCount: graph.edges.filter(e => e.target === profile.branchName && e.type === 'merge').length,
  }));

  const conflictArcs = detectConflicts(graph, branchProfiles);
  const mergeStorms = detectMergeStorms(graph);

  const title = generateTitle(protagonistBranches, conflictArcs);
  const summary = generateSummary(protagonistBranches, conflictArcs, mergeStorms);

  return {
    title,
    summary,
    protagonistBranches,
    conflictArcs,
    mergeStorms,
  };
}

function detectConflicts(graph: CommitGraph, profiles: BranchProfile[]): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  // Simple heuristic: branches that merged into main within a short time window
  const mergeEdges = graph.edges.filter(e => e.type === 'merge');
  const timeWindows = new Map<string, { start: Date; end: Date; branches: string[] }>();
  for (const edge of mergeEdges) {
    const commit = graph.commits.find(c => c.hash === edge.source);
    if (!commit) continue;
    const windowKey = `${edge.source}-${edge.target}`;
    const existing = timeWindows.get(windowKey);
    if (existing) {
      existing.branches.push(edge.target);
    } else {
      timeWindows.set(windowKey, {
        start: commit.date,
        end: commit.date,
        branches: [edge.target],
      });
    }
  }

  for (const [, window] of timeWindows) {
    if (window.branches.length >= 2) {
      arcs.push({
        description: `Branches ${window.branches.join(', ')} merged into main in quick succession, suggesting parallel development.`,
        branches: window.branches,
        commitCount: window.branches.length,
      });
    }
  }

  return arcs;
}

function detectMergeStorms(graph: CommitGraph): MergeStorm[] {
  const storms: MergeStorm[] = [];
  const mergeEdges = graph.edges.filter(e => e.type === 'merge');
  if (mergeEdges.length < 3) {
    return storms;
  }

  // Sort by date
  const sorted = mergeEdges
    .map(e => ({
      edge: e,
      commit: graph.commits.find(c => c.hash === e.source),
    }))
    .filter(item => item.commit !== undefined)
    .sort((a, b) => a.commit!.date.getTime() - b.commit!.date.getTime());

  // Sliding window of 24 hours
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  let i = 0;
  while (i < sorted.length) {
    const windowStart = sorted[i].commit!.date;
    let j = i + 1;
    while (j < sorted.length && (sorted[j].commit!.date.getTime() - windowStart.getTime()) < WINDOW_MS) {
      j++;
    }
    const count = j - i;
    if (count >= 3) {
      const uniqueBranches = new Set(sorted.slice(i, j).map(item => item.edge.target));
      storms.push({
        timeRange: {
          start: sorted[i].commit!.date,
          end: sorted[j - 1].commit!.date,
        },
        mergeCount: count,
        branches: Array.from(uniqueBranches),
        description: `Merge storm: ${count} merges involving ${uniqueBranches.size} branches within a 24-hour window.`,
      });
    }
    i = j;
  }

  return storms;
}

function generateTitle(protagonists: BranchNarrative[], conflictArcs: ConflictArc[]): string {
  if (conflictArcs.length > 0) {
    return `The Tale of ${protagonists.filter(p => p.role === BranchRole.MAIN || p.role === BranchRole.FEATURE).map(p => p.branchName).join(', ')} and Their Conflicts`;
  }
  return `The Epic of ${protagonists.filter(p => p.role === BranchRole.MAIN).map(p => p.branchName).join(', ')}`;
}

function generateSummary(protagonists: BranchNarrative[], conflictArcs: ConflictArc[], mergeStorms: MergeStorm[]): string {
  const parts: string[] = [];
  const mainBranches = protagonists.filter(p => p.role === BranchRole.MAIN);
  const featureBranches = protagonists.filter(p => p.role === BranchRole.FEATURE);
  const bugfixBranches = protagonists.filter(p => p.role === BranchRole.BUGFIX);
  const releaseBranches = protagonists.filter(p => p.role === BranchRole.RELEASE);

  if (mainBranches.length > 0) {
    parts.push(`The main branch \`${mainBranches[0].branchName}\` saw ${mainBranches[0].commits.length} commits.`);
  }
  if (featureBranches.length > 0) {
    parts.push(`${featureBranches.length} feature branches contributed to the story.`);
  }
  if (bugfixBranches.length > 0) {
    parts.push(`${bugfixBranches.length} bugfix branches helped stabilize the codebase.`);
  }
  if (releaseBranches.length > 0) {
    parts.push(`${releaseBranches.length} release branches were prepared.`);
  }
  if (conflictArcs.length > 0) {
    parts.push(`There were ${conflictArcs.length} conflict arcs.`);
  }
  if (mergeStorms.length > 0) {
    parts.push(`Merge storms detected: ${mergeStorms.length}.`);
  }

  return parts.join(' ');
}