import { Command } from 'commander';
import { parseGitLog, CommitGraph } from '../parser.js';
import { rankCommits } from '../ranker.js';
import { buildNarrative } from '../narrator.js';
import { renderNarrative, OutputFormat } from '../output.js';
import { detectMergeStorms } from '../mergeStorm.js';
import { detectConflictArcs } from '../conflict-arcs.js';
import { classifyBranches, BranchProfile } from '../branch-classifier.js';
import { renderSlides } from '../slides.js';
import { loadConfig } from '../config.js';

export function createStoryCommand(): Command {
  const command = new Command('story')
    .description('Generate a narrative from your git repository history')
    .option('-f, --format <format>', 'output format: text, markdown, slides', 'text')
    .option('-c, --config <path>', 'path to config file')
    .option('-p, --path <path>', 'path to git repository', '.')
    .action(async (options) => {
      const config = options.config ? loadConfig(options.config) : {};
      const format = options.format as OutputFormat;

      try {
        const graph: CommitGraph = await parseGitLog(options.path);
        const rankedGraph = rankCommits(graph);
        const mergeStorms = detectMergeStorms(rankedGraph);
        const conflictArcs = detectConflictArcs(rankedGraph, mergeStorms);
        const branchProfiles: BranchProfile[] = classifyBranches(rankedGraph);
        const narrative = buildNarrative(rankedGraph, branchProfiles, mergeStorms, conflictArcs);

        if (format === 'slides') {
          await renderSlides(narrative, config);
        } else {
          const output = renderNarrative(narrative, format);
          process.stdout.write(output);
        }
      } catch (error) {
        console.error('Error generating story:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });

  return command;
}
