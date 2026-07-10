// ---------------------------------------------------------------------------
// Configuration module — loads and validates config from file and environment
// ---------------------------------------------------------------------------

import fs from 'fs';
import path from 'path';
import { cosmiconfig } from 'cosmiconfig';

/**
 * Output format for the narrative.
 */
export enum OutputFormat {
  TEXT = 'text',
  MARKDOWN = 'markdown',
  SLIDES = 'slides',
}

/**
 * Configuration interface for git-graph-narrator.
 */
export interface Config {
  /** Repository path (default: cwd) */
  repoPath: string;
  /** Output format */
  outputFormat: OutputFormat;
  /** Maximum number of commits to analyze (0 = unlimited) */
  maxCommits: number;
  /** Include merge commits in narrative */
  includeMerges: boolean;
  /** Minimum weight for a commit to appear in story */
  minWeight: number;
  /** Color output enabled */
  color: boolean;
  /** Verbose logging */
  verbose: boolean;
  /** Custom git log format string */
  gitLogFormat: string;
  /** Branch patterns to treat as protagonists */
  protagonistPatterns: string[];
  /** Ignore branches matching these patterns */
  ignoreBranchPatterns: string[];
}

/**
 * Default configuration values.
 */
export const DEFAULT_CONFIG: Config = {
  repoPath: process.cwd(),
  outputFormat: OutputFormat.TEXT,
  maxCommits: 1000,
  includeMerges: true,
  minWeight: 0.5,
  color: true,
  verbose: false,
  gitLogFormat: '--format=%H||%an||%ae||%aI||%s||%P||%D',
  protagonistPatterns: ['main', 'master', 'develop'],
  ignoreBranchPatterns: [],
};

/**
 * Validate a partial config object, filling defaults and returning a full Config.
 * Throws on invalid values.
 */
export function validateConfig(raw: Partial<Config>): Config {
  const config: Config = { ...DEFAULT_CONFIG, ...raw };

  // Validate repoPath
  if (typeof config.repoPath !== 'string' || config.repoPath.trim() === '') {
    throw new Error('repoPath must be a non-empty string');
  }
  // Resolve relative paths
  config.repoPath = path.resolve(config.repoPath);
  if (!fs.existsSync(config.repoPath)) {
    throw new Error(`repoPath does not exist: ${config.repoPath}`);
  }

  // Validate outputFormat
  const validFormats = Object.values(OutputFormat);
  if (!validFormats.includes(config.outputFormat as OutputFormat)) {
    throw new Error(`outputFormat must be one of: ${validFormats.join(', ')}`);
  }

  // Validate maxCommits
  if (typeof config.maxCommits !== 'number' || config.maxCommits < 0 || !Number.isInteger(config.maxCommits)) {
    throw new Error('maxCommits must be a non-negative integer');
  }

  // Validate includeMerges
  if (typeof config.includeMerges !== 'boolean') {
    throw new Error('includeMerges must be a boolean');
  }

  // Validate minWeight
  if (typeof config.minWeight !== 'number' || config.minWeight < 0) {
    throw new Error('minWeight must be a non-negative number');
  }

  // Validate color
  if (typeof config.color !== 'boolean') {
    throw new Error('color must be a boolean');
  }

  // Validate verbose
  if (typeof config.verbose !== 'boolean') {
    throw new Error('verbose must be a boolean');
  }

  // Validate gitLogFormat
  if (typeof config.gitLogFormat !== 'string' || config.gitLogFormat.trim() === '') {
    throw new Error('gitLogFormat must be a non-empty string');
  }

  // Validate protagonistPatterns
  if (!Array.isArray(config.protagonistPatterns) || config.protagonistPatterns.some(p => typeof p !== 'string')) {
    throw new Error('protagonistPatterns must be an array of strings');
  }

  // Validate ignoreBranchPatterns
  if (!Array.isArray(config.ignoreBranchPatterns) || config.ignoreBranchPatterns.some(p => typeof p !== 'string')) {
    throw new Error('ignoreBranchPatterns must be an array of strings');
  }

  return config;
}

/**
 * Load configuration from file and environment variables.
 * File config takes precedence over defaults; env vars override file config.
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  // Start with defaults
  const config: Config = { ...DEFAULT_CONFIG };

  // Load from config file using cosmiconfig
  const explorer = cosmiconfig('git-graph-narrator', {
    searchPlaces: [
      '.git-graph-narratorrc',
      '.git-graph-narratorrc.json',
      '.git-graph-narratorrc.yaml',
      '.git-graph-narratorrc.yml',
      '.git-graph-narratorrc.js',
      'git-graph-narrator.config.js',
      'package.json',
    ],
  });

  try {
    const result = configPath
      ? await explorer.load(configPath)
      : await explorer.search();

    if (result && !result.isEmpty) {
      Object.assign(config, result.config);
    }
  } catch (error) {
    // If no config file found, continue with defaults
    if (configPath && !(error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw error;
    }
  }

  // Override with environment variables
  const envMap: Record<string, keyof Config> = {
    GGN_REPO_PATH: 'repoPath',
    GGN_OUTPUT_FORMAT: 'outputFormat',
    GGN_MAX_COMMITS: 'maxCommits',
    GGN_INCLUDE_MERGES: 'includeMerges',
    GGN_MIN_WEIGHT: 'minWeight',
    GGN_COLOR: 'color',
    GGN_VERBOSE: 'verbose',
    GGN_GIT_LOG_FORMAT: 'gitLogFormat',
    GGN_PROTAGONIST_PATTERNS: 'protagonistPatterns',
    GGN_IGNORE_BRANCH_PATTERNS: 'ignoreBranchPatterns',
  };

  for (const [envVar, configKey] of Object.entries(envMap)) {
    const envValue = process.env[envVar];
    if (envValue !== undefined) {
      switch (configKey) {
        case 'maxCommits':
          config[configKey] = parseInt(envValue, 10);
          break;
        case 'includeMerges':
        case 'color':
        case 'verbose':
          config[configKey] = envValue.toLowerCase() === 'true' || envValue === '1';
          break;
        case 'minWeight':
          config[configKey] = parseFloat(envValue);
          break;
        case 'protagonistPatterns':
        case 'ignoreBranchPatterns':
          config[configKey] = envValue.split(',').map(s => s.trim());
          break;
        default:
          (config as Record<string, unknown>)[configKey] = envValue;
      }
    }
  }

  // Validate final config
  return validateConfig(config);
}
