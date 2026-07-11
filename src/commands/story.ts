import fs from 'fs';
import path from 'path';
import { Command } from 'commander';
import { parseGitLog } from '../parser.js';
import { classifyCommits } from '../classifier.js';
import { buildNarrative } from '../narrator.js';
import { renderNarrative } from '../output.js';
import { loadConfig } from '../config.js';
import { renderSlides } from '../slides.js';

export function storyCommand(): Command {
  const cmd = new Command('story')
    .description('Generate a narrative from git history')
    .option('-d, --directory <dir>', 'Path to git repository', '.')
    .option('-o, --output <file>', 'Output file (optional, prints to stdout if not set)')
    .option('-f, --format <format>', 'Output format: text, markdown, slides', 'text')
    .option('--interactive', 'Run in interactive slideshow mode', false)
    .action(async (options) => {
      try {
        const config = loadConfig(options.directory);
        const gitDir = path.resolve(options.directory);
        if (!fs.existsSync(path.join(gitDir, '.git'))) {
          console.error('Error: Not a git repository: ' + gitDir);
          process.exit(1);
        }

        const graph = parseGitLog(gitDir);
        const classifiedCommits = classifyCommits(graph.commits);
        graph.commits = classifiedCommits;
        const narrative = buildNarrative(graph);

        const format = options.format;
        const output = options.output;

        if (format === 'slides' || options.interactive) {
          if (options.interactive) {
            await renderSlides(narrative, true);
          } else {
            const slides = renderNarrative(narrative, 'slides');
            if (output) {
              fs.writeFileSync(output, slides, 'utf-8');
            } else {
              console.log(slides);
            }
          }
        } else {
          const rendered = renderNarrative(narrative, format as 'text' | 'markdown');
          if (output) {
            fs.writeFileSync(output, rendered, 'utf-8');
          } else {
            console.log(rendered);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('Error generating story:', message);
        process.exit(1);
      }
    });

  return cmd;
}