// ---------------------------------------------------------------------------
// Commit classifier — identifies commit types from message patterns
// ---------------------------------------------------------------------------

import { CommitNode } from './parser.js';

/**
 * Enum of recognized commit types.
 */
export enum CommitType {
  FEAT = 'feat',
  FIX = 'fix',
  REFACTOR = 'refactor',
  CHORE = 'chore',
  DOCS = 'docs',
  STYLE = 'style',
  PERF = 'perf',
  TEST = 'test',
  CI = 'ci',
  BUILD = 'build',
  REVERT = 'revert',
  MERGE = 'merge',
  UNKNOWN = 'unknown',
}

/**
 * Pattern definitions for each commit type.
 * Matches conventional commit prefixes and common patterns.
 */
const TYPE_PATTERNS: Record<CommitType, RegExp> = {
  [CommitType.FEAT]: /^(feat|feature|add|implement|introduce|new)\b/i,
  [CommitType.FIX]: /^(fix|bugfix|bug|hotfix|patch|resolve|correct|repair)\b/i,
  [CommitType.REFACTOR]: /^(refactor|rewrite|restructure|reorganize|redesign|rework|clean\s*up|simplify|extract|inline|move|rename)\b/i,
  [CommitType.CHORE]: /^(chore|bump|update\s+deps|update\s+dep|upgrade|downgrade|pin|remove\s+deps|add\s+deps?)\b/i,
  [CommitType.DOCS]: /^(docs?|document|readme|comment|docstring|changelog)\b/i,
  [CommitType.STYLE]: /^(style|format|prettier|eslint|lint|whitespace|indentation|semicolon|trailing)\b/i,
  [CommitType.PERF]: /^(perf|performance|optimize|speed|fast|slow|latency|throughput)\b/i,
  [CommitType.TEST]: /^(test|spec|unit|integration|e2e|coverage|assert)\b/i,
  [CommitType.CI]: /^(ci|cd|deploy|pipeline|workflow|github\s*actions|travis|circle|jenkins)\b/i,
  [CommitType.BUILD]: /^(build|compile|transpile|bundle|webpack|rollup|esbuild|tsc|babel)\b/i,
  [CommitType.REVERT]: /^(revert|backout|undo|rollback)\b/i,
  [CommitType.MERGE]: /^(merge|pull\s*request|pr\s*#?|cherry\s*pick)\b/i,
  [CommitType.UNKNOWN]: /^.*$/,
};

/**
 * Classify a single commit based on its message.
 * Returns the most specific CommitType.
 */
export function classifyCommit(commit: CommitNode): CommitType {
  const message = commit.message.trim();

  // Try exact match first (conventional commit prefix with colon or parens)
  const conventionalMatch = message.match(/^(\w+)(?:\([^)]*\))?!?:/);
  if (conventionalMatch) {
    const prefix = conventionalMatch[1].toLowerCase();
    for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
      if (type === CommitType.UNKNOWN) continue;
      if (pattern.test(prefix)) {
        return type as CommitType;
      }
    }
  }

  // Fallback: match against whole message
  for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
    if (type === CommitType.UNKNOWN) continue;
    if (pattern.test(message)) {
      return type as CommitType;
    }
  }

  return CommitType.UNKNOWN;
}

/**
 * Classify all commits in a graph.
 * Mutates each node by adding a `type` property.
 */
export function classifyGraph(graph: CommitNode[]): CommitNode[] {
  return graph.map((node) => ({
    ...node,
    type: classifyCommit(node),
  }));
}

/**
 * Count commits by type across a list of commits.
 */
export function countByType(commits: CommitNode[]): Record<CommitType, number> {
  const counts: Record<string, number> = {};
  for (const commit of commits) {
    const type = commit.type || classifyCommit(commit);
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts as Record<CommitType, number>;
}

/**
 * Compute a "type diversity" score (0..1) — higher means more balanced across types.
 */
export function typeDiversity(commits: CommitNode[]): number {
  if (commits.length === 0) return 0;
  const counts = countByType(commits);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  // Shannon entropy normalized by max entropy (log2 of number of types present)
  const typesPresent = Object.keys(counts).length;
  if (typesPresent <= 1) return 0;
  let entropy = 0;
  for (const count of Object.values(counts)) {
    const p = count / total;
    entropy -= p * Math.log2(p);
  }
  return entropy / Math.log2(typesPresent);
}
