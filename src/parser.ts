import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommitNode {
  hash: string;
  author: string;
  date: Date;
  message: string;
  parents: string[];
  branches: string[];
}

export interface CommitGraph {
  commits: Map<string, CommitNode>;
  rootHashes: string[];
}

// ---------------------------------------------------------------------------
// Git log parser
// ---------------------------------------------------------------------------

const GIT_LOG_FORMAT = [
  '---COMMIT---',
  '%H',       // hash
  '%an',      // author name
  '%ai',      // author date ISO 8601
  '%s',       // subject
  '%P',       // parent hashes (space-separated)
  '%D',       // ref names (branch, tag, etc.)
].join('%n');

/**
 * Parse the output of `git log --all --format=...` into a CommitGraph.
 */
export function parseGitLog(cwd?: string): CommitGraph {
  const stdout = execSync(
    `git log --all --format="${GIT_LOG_FORMAT}"`,
    { cwd, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
  );

  const commits = new Map<string, CommitNode>();
  const rootHashes: string[] = [];

  const blocks = stdout.split('---COMMIT---\n').filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 5) continue;

    const hash = lines[0].trim();
    const author = lines[1].trim();
    const dateStr = lines[2].trim();
    const message = lines[3].trim();
    const parentStr = lines[4].trim();
    const refs = lines[5] ? lines[5].trim() : '';

    const parents = parentStr ? parentStr.split(/\s+/) : [];
    const branches = refs
      ? refs
          .split(',')
          .map((r) => r.trim())
          .filter((r) => r.startsWith('HEAD -> ') || r.startsWith('origin/') || !r.includes('/'))
          .map((r) => r.replace(/^HEAD -> /, '').replace(/^origin\//, ''))
          .filter((r) => r !== '')
      : [];

    const date = new Date(dateStr);

    commits.set(hash, { hash, author, date, message, parents, branches });

    if (parents.length === 0) {
      rootHashes.push(hash);
    }
  }

  return { commits, rootHashes };
}

// ---------------------------------------------------------------------------
// Utility: topological sort (Kahn's algorithm)
// ---------------------------------------------------------------------------

export function topologicalSort(graph: CommitGraph): CommitNode[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  // Initialize
  for (const hash of graph.commits.keys()) {
    inDegree.set(hash, 0);
    adj.set(hash, []);
  }

  // Build edges: parent -> child (reverse direction for topological ordering)
  for (const [hash, node] of graph.commits.entries()) {
    for (const parentHash of node.parents) {
      const parent = graph.commits.get(parentHash);
      if (parent) {
        adj.get(parentHash)!.push(hash);
        inDegree.set(hash, (inDegree.get(hash) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [hash, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(hash);
  }

  const sorted: CommitNode[] = [];
  while (queue.length > 0) {
    const hash = queue.shift()!;
    sorted.push(graph.commits.get(hash)!);

    for (const childHash of adj.get(hash) || []) {
      const newDeg = (inDegree.get(childHash) || 1) - 1;
      inDegree.set(childHash, newDeg);
      if (newDeg === 0) queue.push(childHash);
    }
  }

  return sorted;
}
