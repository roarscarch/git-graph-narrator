#!/usr/bin/env node

import { Command } from 'commander';
import { parseGitLog } from './parser.js';
import { buildNarrative } from './narrator.js';
import { renderNarrative, OutputFormat } from './output.js';
import { loadConfig, Config } from './config.js';

const program = new Command();

program
  .name('git-graph-narrator')
  .description('Generate a human-readable story of your Git repository\'s evolution')
  .version('0.1.0')
  .option('-p, --path <path>', 'Path to git repository (defaults to current directory)', process.cwd())
  .option('-f, --format <format>', 'Output format: text, markdown, slides', 'text')
  .option('-c, --config <path>', 'Path to config file (yaml or json)', '')
  .option('--max-protagonists <number>', 'Maximum number of protagonist branches to highlight', parseInt)
  .option('--long-lived-threshold <days>', 'Minimum lifespan in days for long-lived branch', parseInt)
  .option('--refactor-weight <number>', 'Weight factor for refactor commits', parseFloat)
  .option('--no-conflicts', 'Disable conflict arc detection')
  .option('--no-hotspots', 'Disable refactor hotspot detection')
  .option('--no-classify', 'Disable branch classification')
  .option('--slide-delay <ms>', 'Slide delay in milliseconds (slides format only)', parseInt)
  .option('--slide-theme <theme>', 'Slide color theme: default, dark, light, retro', 'default')
  .action(async (options: {
    path: string;
    format: string;
    config: string;
    maxProtagonists: number | undefined;
    longLivedThreshold: number | undefined;
    refactorWeight: number | undefined;
    conflicts: boolean;
    hotspots: boolean;
    classify: boolean;
    slideDelay: number | undefined;
    slideTheme: string;
  }) => {
    const format = options.format as OutputFormat;
    if (!['text', 'markdown', 'slides'].includes(format)) {
      console.error(`Unknown format: ${format}. Use text, markdown, or slides.`);
      process.exit(1);
    }

    try {
      // Load config from file if provided, then merge CLI overrides
      const cliOverrides: Partial<Config> = {
        repoPath: options.path,
        format: format,
        maxProtagonists: options.maxProtagonists,
        longLivedThresholdDays: options.longLivedThreshold,
        refactorWeight: options.refactorWeight,
        detectConflicts: options.conflicts,
        detectHotspots: options.hotspots,
        classifyBranches: options.classify,
        slideDelayMs: options.slideDelay,
        slideTheme: options.slideTheme as Config['slideTheme'],
      };

      // Remove undefined keys
      for (const key of Object.keys(cliOverrides)) {
        if (cliOverrides[key as keyof typeof cliOverrides] === undefined) {
          delete cliOverrides[key as keyof typeof cliOverrides];
        }
      }

      let config: Config;
      if (options.config) {
        config = loadConfig(options.config, cliOverrides);
      } else {
        // Try default config file locations
        const defaultPaths = [
          '.git-graph-narrator.yaml',
          '.git-graph-narrator.yml',
          '.git-graph-narrator.json',
          '.git-graph-narratorrc',
          '.git-graph-narratorrc.json',
        ];
        let loaded = false;
        for (const p of defaultPaths) {
          try {
            config = loadConfig(p, cliOverrides);
            loaded = true;
            break;
          } catch {
            // file not found, continue
          }
        }
        if (!loaded) {
          config = cliOverrides as Config;
        }
      }

      const graph = parseGitLog(config.repoPath || process.cwd());
      const narrative = buildNarrative(graph, config);
      const output = renderNarrative(narrative, config.format || 'text', config);
      console.log(output);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error: ${message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
