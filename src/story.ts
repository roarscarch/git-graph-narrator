import { execSync } from 'child_process';
import { parseGitLog, CommitGraph } from './parser.js';
import { classifyCommits, CommitType } from './classifier.js';
import { rankCommits } from './ranker.js';
import { analyzeConflicts, detectMergeStorms, detectRefactorHotspots, classifyBranches, generateNarrative, Narrative } from './narrator.js';
import { renderNarrative, OutputFormat } from './output.js';
import { Config } from './config.js';

/**
 * Runs the full story pipeline: parse, classify, rank, analyze, narrate, and output.
 * @param config - configuration options
 * @param format - output format (text, markdown, slides)
 * @returns the rendered narrative string
 */
export function runStory(config: Config, format: OutputFormat = 'text'): string {
  // 1. Parse git log
  const graph: CommitGraph = parseGitLog(config.repoPath || process.cwd());

  // 2. Classify commits
  const classified = classifyCommits(graph.nodes);

  // 3. Rank commits by impact
  const ranked = rankCommits(graph.nodes, graph.edges);

  // 4. Analyze conflicts, merge storms, refactor hotspots, branch classification
  const conflictArcs = config.detectConflicts !== false ? analyzeConflicts(graph) : [];
  const mergeStorms = detectMergeStorms(graph, 3, 7); // threshold: 3 merges in 7 days
  const refactorHotspots = config.detectHotspots !== false ? detectRefactorHotspots(graph, classified) : [];
  const branchClassifications = config.classifyBranches !== false ? classifyBranches(graph) : [];

  // 5. Generate narrative
  const narrative: Narrative = generateNarrative(
    graph,
    ranked,
    conflictArcs,
    mergeStorms,
    refactorHotspots,
    branchClassifications,
    config
  );

  // 6. Render output
  const output = renderNarrative(narrative, format);

  return output;
}