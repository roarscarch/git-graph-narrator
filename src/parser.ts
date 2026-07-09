import { execSync } from 'child_process';

export interface CommitNode {
  hash: string;
  author: string;
  date: Date;
  message: string;
  branches: string[];
  parents: string[];
  weight: number;
}

export interface CommitGraph {
  commits: CommitNode[];
  branches: string[];
}

/**
 * Parse git log with custom format to extract commit DAG.
 * Format: %H|%an|%aI|%s|%P|%D
 * - %H: commit hash
 * - %an: author name
 * - %aI: author date (ISO 8601)
 * - %s: subject
 * - %P: parent hashes (space-separated)
 * - %D: ref names (branch, tag, etc.)
 */
export function parseGitLog(repoPath: string = process.cwd()): CommitGraph {
  const format = '%H|%an|%aI|%s|%P|%D';
  const args = ['log', `--format=${format}`, '--all', '--topo-order'];
  const output = execSync(args.join(' '), { cwd: repoPath, encoding: 'utf-8' });
  const lines = output.trim().split('\n');

  const commits: CommitNode[] = [];
  const branchSet = new Set<string>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split('|');
    if (parts.length < 6) continue;

    const hash = parts[0];
    const author = parts[1];
    const date = new Date(parts[2]);
    const message = parts[3];
    const parentsStr = parts[4];
    const refsStr = parts[5];

    const parents = parentsStr ? parentsStr.trim().split(/\s+/) : [];

    // Extract branch names from refs (e.g., "HEAD -> main, tag: v1.0")
    const branches: string[] = [];
    if (refsStr) {
      const refs = refsStr.split(', ');
      for (const ref of refs) {
        const trimmed = ref.trim();
        // Skip HEAD pointer and tags
        if (trimmed.startsWith('tag:') || trimmed === 'HEAD') continue;
        // Extract branch name (e.g., "main" from "HEAD -> main" or just "main")
        const arrowIdx = trimmed.indexOf('-> ');
        const branchName = arrowIdx !== -1 ? trimmed.slice(arrowIdx + 3).trim() : trimmed;
        if (branchName && !branchName.startsWith('tag:') && branchName !== 'HEAD') {
          branches.push(branchName);
          branchSet.add(branchName);
        }
      }
    }

    const node: CommitNode = {
      hash,
      author,
      date,
      message,
      branches,
      parents,
      weight: 1.0, // default weight, will be updated by ranker
    };
    commits.push(node);
  }

  return {
    commits,
    branches: Array.from(branchSet),
  };
}

/**
 * Build a map from hash to CommitNode for quick lookup.
 */
export function buildCommitMap(commits: CommitNode[]): Map<string, CommitNode> {
  const map = new Map<string, CommitNode>();
  for (const commit of commits) {
    map.set(commit.hash, commit);
  }
  return map;
}

/**
 * Get the topological order of commits (parents before children).
 * Since git log --topo-order already gives us a topological order,
 * we just reverse it to get children before parents.
 */
export function topologicalOrder(commits: CommitNode[]): CommitNode[] {
  // git log --topo-order outputs children first, so reverse to get parents first
  return [...commits].reverse();
}

/**
 * Find all merge commits (commits with more than one parent).
 */
export function findMergeCommits(commits: CommitNode[]): CommitNode[] {
  return commits.filter(c => c.parents.length > 1);
}

/**
 * Determine if a commit is a root commit (no parents).
 */
export function isRootCommit(commit: CommitNode): boolean {
  return commit.parents.length === 0;
}

/**
 * Get the branch name for a commit based on its refs and parentage.
 * Falls back to 'unknown' if no branch is determined.
 */
export function getBranchForCommit(commit: CommitNode, graph: CommitGraph): string {
  if (commit.branches.length > 0) {
    // Prefer non-main branches for feature branches
    const nonMain = commit.branches.filter(b => b !== 'main' && b !== 'master');
    if (nonMain.length > 0) return nonMain[0];
    return commit.branches[0];
  }
  return 'unknown';
}
