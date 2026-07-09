import { describe, it, expect } from 'vitest';
import { buildNarrative, Narrative } from '../narrator.js';
import { CommitGraph, CommitNode } from '../parser.js';
import { CommitType } from '../classifier.js';

function createMockGraph(): CommitGraph {
  const commits: CommitNode[] = [
    {
      hash: 'a1',
      message: 'initial commit',
      author: 'Alice',
      date: new Date('2024-01-01T10:00:00Z'),
      branches: ['main'],
      weight: 1.0,
      type: CommitType.CHORE,
    },
    {
      hash: 'a2',
      message: 'feat: add core logic',
      author: 'Alice',
      date: new Date('2024-01-02T10:00:00Z'),
      branches: ['main'],
      weight: 2.0,
      type: CommitType.FEAT,
    },
    {
      hash: 'b1',
      message: 'feat: create new feature',
      author: 'Bob',
      date: new Date('2024-01-03T10:00:00Z'),
      branches: ['feature/foo'],
      weight: 1.5,
      type: CommitType.FEAT,
    },
    {
      hash: 'b2',
      message: 'fix: resolve bug in feature',
      author: 'Bob',
      date: new Date('2024-01-04T10:00:00Z'),
      branches: ['feature/foo'],
      weight: 1.0,
      type: CommitType.FIX,
    },
    {
      hash: 'a3',
      message: 'merge feature/foo into main',
      author: 'Alice',
      date: new Date('2024-01-05T10:00:00Z'),
      branches: ['main'],
      weight: 3.0,
      type: CommitType.MERGE,
    },
    {
      hash: 'a4',
      message: 'refactor: restructure modules',
      author: 'Alice',
      date: new Date('2024-01-06T10:00:00Z'),
      branches: ['main'],
      weight: 2.5,
      type: CommitType.REFACTOR,
    },
  ];

  const edges: [string, string][] = [
    ['a1', 'a2'],
    ['a2', 'a3'],
    ['a3', 'a4'],
    ['a2', 'b1'],
    ['b1', 'b2'],
    ['b2', 'a3'],
  ];

  return { commits, edges };
}

describe('buildNarrative', () => {
  it('should produce a narrative with title and summary', () => {
    const graph = createMockGraph();
    const narrative = buildNarrative(graph);
    expect(narrative.title).toBeDefined();
    expect(narrative.title.length).toBeGreaterThan(0);
    expect(narrative.summary).toBeDefined();
    expect(narrative.summary.length).toBeGreaterThan(0);
  });

  it('should identify protagonist branches', () => {
    const graph = createMockGraph();
    const narrative = buildNarrative(graph);
    expect(narrative.protagonistBranches.length).toBeGreaterThan(0);
    // main should be a protagonist
    const mainBranch = narrative.protagonistBranches.find(b => b.branchName === 'main');
    expect(mainBranch).toBeDefined();
    expect(mainBranch!.commits.length).toBeGreaterThan(0);
    expect(mainBranch!.mergeCount).toBeGreaterThanOrEqual(1);
  });

  it('should include merge storms if present', () => {
    const graph = createMockGraph();
    // simulate a merge storm by adding many merge commits in short time
    const stormCommits: CommitNode[] = [
      {
        hash: 'm1',
        message: 'merge branch hotfix-1',
        author: 'Alice',
        date: new Date('2024-01-07T10:00:00Z'),
        branches: ['main'],
        weight: 3.0,
        type: CommitType.MERGE,
      },
      {
        hash: 'm2',
        message: 'merge branch hotfix-2',
        author: 'Alice',
        date: new Date('2024-01-07T11:00:00Z'),
        branches: ['main'],
        weight: 3.0,
        type: CommitType.MERGE,
      },
      {
        hash: 'm3',
        message: 'merge branch hotfix-3',
        author: 'Alice',
        date: new Date('2024-01-07T12:00:00Z'),
        branches: ['main'],
        weight: 3.0,
        type: CommitType.MERGE,
      },
    ];
    const extendedCommits = [...graph.commits, ...stormCommits];
    const extendedEdges: [string, string][] = [
      ...graph.edges,
      ['a4', 'm1'],
      ['m1', 'm2'],
      ['m2', 'm3'],
    ];
    const stormGraph: CommitGraph = { commits: extendedCommits, edges: extendedEdges };
    const narrative = buildNarrative(stormGraph);
    expect(narrative.mergeStorms).toBeDefined();
    expect(narrative.mergeStorms!.length).toBeGreaterThan(0);
  });

  it('should detect conflict arcs when branches diverge and merge', () => {
    const graph = createMockGraph();
    const narrative = buildNarrative(graph);
    // The graph has a feature branch merged into main, so conflict arcs should exist
    expect(narrative.conflictArcs).toBeDefined();
    expect(narrative.conflictArcs!.length).toBeGreaterThan(0);
  });

  it('should respect maxProtagonists config', () => {
    const graph = createMockGraph();
    const narrative = buildNarrative(graph, { maxProtagonists: 1 });
    expect(narrative.protagonistBranches.length).toBeLessThanOrEqual(1);
  });

  it('should handle empty graph gracefully', () => {
    const emptyGraph: CommitGraph = { commits: [], edges: [] };
    const narrative = buildNarrative(emptyGraph);
    expect(narrative.title).toBe('Untitled Repository');
    expect(narrative.summary).toBe('No commits found.');
    expect(narrative.protagonistBranches).toEqual([]);
  });

  it('should include refactor hotspots when refactor commits exist', () => {
    const graph = createMockGraph();
    const narrative = buildNarrative(graph);
    expect(narrative.refactorHotspots).toBeDefined();
    expect(narrative.refactorHotspots!.length).toBeGreaterThan(0);
  });
});
