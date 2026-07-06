#!/usr/bin/env node

import { Command } from 'commander';
import { parseGitLog } from './parser.js';
import { buildNarrative } from './narrator.js';
import { renderNarrative, OutputFormat } from './output.js';

const program = new Command();

program
  .name('git-graph-narrator')
  .description('Generate a human-readable story of your Git repository\'s evolution')
  .version('0.1.0')
  .option('-p, --path <path>', 'Path to git repository (defaults to current directory)', process.cwd())
  .option('-f, --format <format>', 'Output format: text, markdown, slides', 'text')
  .action(async (options: { path: string; format: string }) => {
    const format = options.format as OutputFormat;
    if (!['text', 'markdown', 'slides'].includes(format)) {
      console.error(`Unknown format: ${format}. Use text, markdown, or slides.`);
      process.exit(1);
    }

    try {
      const graph = parseGitLog(options.path);
      const narrative = buildNarrative(graph);
      const output = renderNarrative(narrative, format);
      console.log(output);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
