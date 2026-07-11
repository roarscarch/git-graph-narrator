import { CommitNode } from './parser.js';
import { CommitType } from './classifier.js';

export interface ConflictArc {
  /** Human-readable label for the conflict (e.g., 'The Great Refactor Standoff') */
  label: string;
  /** Branches involved in the conflict */
  branches: string[];
  /** Number of commits in the conflict zone */
  commitCount: number;
  /** Severity score (0-10) based on commit frequency and type mix */
  severity: number;
  /** Start date of the conflict */
  startDate: Date;
  /** End date of the conflict */
  endDate: Date;
  /** Key commits that define the conflict (e.g., merge commits or conflicting changes) */
  keyCommits: CommitNode[];
}

/**
 * Detects conflict arcs in a commit graph.
 * Conflict arcs are periods where two or more branches have overlapping
 * commit activity with high semantic change (feat/fix/refactor) and
 * frequent merges, indicating contention or parallel development.
 */
export function detectConflictArcs(
  graph: Map<string, CommitNode>,
  parentMap: Map<string, string[]>,
  branchMap: Map<string, string[]>,
  windowSizeMs: number = 7 * 24 * 60 * 60 * 1000, // 7 days default
): ConflictArc[] {
  const arcs: ConflictArc[] = [];
  const commits = Array.from(graph.values());
  if (commits.length < 2) return arcs;

  // Sort by date
  commits.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Sliding window analysis
  let windowStart = 0;
  for (let windowEnd = 1; windowEnd < commits.length; windowEnd++) {
    while (commits[windowEnd].date.getTime() - commits[windowStart].date.getTime() > windowSizeMs) {
      windowStart++;
    }

    const windowCommits = commits.slice(windowStart, windowEnd + 1);
    if (windowCommits.length < 3) continue;

    // Count branches active in window
    const branchCounts = new Map<string, number>();
    for (const c of windowCommits) {
      for (const b of c.branches) {
        branchCounts.set(b, (branchCounts.get(b) || 0) + 1);
      }
    }

    const activeBranches = Array.from(branchCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([name]) => name);

    if (activeBranches.length < 2) continue;

    // Calculate severity: mix of commit types and frequency
    const typeWeights: Record<string, number> = {
      [CommitType.FEAT]: 3,
      [CommitType.FIX]: 2,
      [CommitType.REFACTOR]: 4,
      [CommitType.DOCS]: 1,
      [CommitType.CHORE]: 0.5,
      [CommitType.TEST]: 1,
    };

    let severityScore = 0;
    for (const c of windowCommits) {
      severityScore += typeWeights[c.type] || 1;
    }
    severityScore = Math.min(10, Math.round(severityScore / windowCommits.length));

    // Check for merge commits in window
    const mergeCommits = windowCommits.filter(c =>
      c.message.toLowerCase().startsWith('merge') ||
      c.message.toLowerCase().includes('merge branch')
    );

    if (mergeCommits.length > 0 || severityScore >= 4) {
      const label = generateConflictLabel(activeBranches, windowCommits);
      arcs.push({
        label,
        branches: activeBranches,
        commitCount: windowCommits.length,
        severity: severityScore,
        startDate: windowCommits[0].date,
        endDate: windowCommits[windowCommits.length - 1].date,
        keyCommits: mergeCommits.length > 0 ? mergeCommits : [windowCommits[Math.floor(windowCommits.length / 2)]],
      });
    }
  }

  // Merge overlapping arcs
  return mergeOverlappingArcs(arcs);
}

function generateConflictLabel(branches: string[], commits: CommitNode[]): string {
  const branchNames = branches.map(b => b.replace(/^refs\/heads\//, ''));
  const topType = getDominantType(commits);
  const typeLabel = topType === CommitType.REFACTOR ? 'Refactor' :
    topType === CommitType.FEAT ? 'Feature' :
    topType === CommitType.FIX ? 'Bugfix' : 'Development';
  return `${typeLabel} Standoff: ${branchNames.join(' vs ')}`;
}

function getDominantType(commits: CommitNode[]): string {
  const counts: Record<string, number> = {};
  for (const c of commits) {
    counts[c.type] = (counts[c.type] || 0) + 1;
  }
  let maxCount = 0;
  let dominant = CommitType.CHORE;
  for (const [type, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      dominant = type;
    }
  }
  return dominant;
}

function mergeOverlappingArcs(arcs: ConflictArc[]): ConflictArc[] {
  if (arcs.length === 0) return arcs;
  arcs.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const merged: ConflictArc[] = [arcs[0]];
  for (let i = 1; i < arcs.length; i++) {
    const last = merged[merged.length - 1];
    const current = arcs[i];
    if (current.startDate.getTime() <= last.endDate.getTime()) {
      // Overlap: merge into last
      last.endDate = new Date(Math.max(last.endDate.getTime(), current.endDate.getTime()));
      last.commitCount += current.commitCount;
      last.severity = Math.min(10, Math.round((last.severity + current.severity) / 2));
      last.branches = Array.from(new Set([...last.branches, ...current.branches]));
      last.keyCommits = [...last.keyCommits, ...current.keyCommits];
      last.label = `${last.label.split(':')[0]} Conflict: ${last.branches.join(' vs ')}`;
    } else {
      merged.push(current);
    }
  }
  return merged;
}