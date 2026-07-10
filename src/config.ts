// ---------------------------------------------------------------------------
// Configuration module — load, validate, and expose user settings
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { cosmiconfig } from 'cosmiconfig';

/**
 * Supported output formats.
 */
export enum OutputFormat {
  PLAIN = 'plain',
  MARKDOWN = 'markdown',
  SLIDES = 'slides',
}

/**
 * Configuration interface for git-graph-narrator.
 */
export interface Config {
  /** Git repository path (default: current working directory) */
  repoPath: string;
  /** Output format */
  outputFormat: OutputFormat;
  /** Include merge commits in the narrative */
  includeMerges: boolean;
  /** Maximum number of protagonist branches to highlight */
  maxProtagonistBranches: number;
  /** Minimum weight threshold for a commit to be considered a plot point */
  plotPointThreshold: number;
  /** Whether to colorize output (for plain text) */
  colorize: boolean;
  /** Slide transition interval in milliseconds (for slides format) */
  slideIntervalMs: number;
  /** Verbose logging */
  verbose: boolean;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: Config = {
  repoPath: process.cwd(),
  outputFormat: OutputFormat.PLAIN,
  includeMerges: true,
  maxProtagonistBranches: 3,
  plotPointThreshold: 1.0,
  colorize: true,
  slideIntervalMs: 3000,
  verbose: false,
};

/**
 * Attempt to load configuration from a config file.
 * Supported files: .gitgraphnarratorrc, .gitgraphnarratorrc.json, .gitgraphnarratorrc.yaml,
 *   .gitgraphnarratorrc.yml, .gitgraphnarratorrc.js, git-graph-narrator.config.js
 * Also checks the "gitGraphNarrator" key in package.json.
 */
export async function loadConfig(customPath?: string): Promise<Config> {
  const explorer = cosmiconfig('gitGraphNarrator', {
    searchPlaces: [
      'package.json',
      '.gitgraphnarratorrc',
      '.gitgraphnarratorrc.json',
      '.gitgraphnarratorrc.yaml',
      '.gitgraphnarratorrc.yml',
      '.gitgraphnarratorrc.js',
      'git-graph-narrator.config.js',
    ],
  });

  let result;
  if (customPath) {
    result = await explorer.load(customPath);
  } else {
    result = await explorer.search();
  }

  if (result && !result.isEmpty) {
    const userConfig = result.config as Partial<Config>;
    const merged = { ...DEFAULT_CONFIG, ...userConfig };
    validateConfig(merged);
    return merged;
  }

  return DEFAULT_CONFIG;
}

/**
 * Validate the configuration object and throw on invalid values.
 */
function validateConfig(config: Config): void {
  if (!config.repoPath || typeof config.repoPath !== 'string') {
    throw new Error('config.repoPath must be a non-empty string');
  }

  if (!Object.values(OutputFormat).includes(config.outputFormat)) {
    throw new Error(
      `config.outputFormat must be one of: ${Object.values(OutputFormat).join(', ')}`
    );
  }

  if (typeof config.includeMerges !== 'boolean') {
    throw new Error('config.includeMerges must be a boolean');
  }

  if (!Number.isInteger(config.maxProtagonistBranches) || config.maxProtagonistBranches < 1) {
    throw new Error('config.maxProtagonistBranches must be a positive integer');
  }

  if (typeof config.plotPointThreshold !== 'number' || config.plotPointThreshold < 0) {
    throw new Error('config.plotPointThreshold must be a non-negative number');
  }

  if (typeof config.colorize !== 'boolean') {
    throw new Error('config.colorize must be a boolean');
  }

  if (!Number.isInteger(config.slideIntervalMs) || config.slideIntervalMs < 100) {
    throw new Error('config.slideIntervalMs must be an integer >= 100');
  }

  if (typeof config.verbose !== 'boolean') {
    throw new Error('config.verbose must be a boolean');
  }
}

/**
 * Quick synchronous config load for CLI (no cosmiconfig async).
 * Only reads from a JSON file directly.
 */
export function loadConfigSync(customPath?: string): Config {
  if (!customPath) {
    return DEFAULT_CONFIG;
  }

  const resolved = path.resolve(customPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Config file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  let userConfig: Partial<Config>;
  try {
    userConfig = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in config file: ${resolved}`);
  }

  const merged = { ...DEFAULT_CONFIG, ...userConfig };
  validateConfig(merged);
  return merged;
}
