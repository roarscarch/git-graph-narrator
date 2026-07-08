import fs from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Configuration types
// ---------------------------------------------------------------------------

export interface Config {
  /** Path to git repository (defaults to current directory) */
  repoPath?: string;
  /** Output format: text, markdown, slides */
  format?: 'text' | 'markdown' | 'slides';
  /** Maximum number of protagonist branches to highlight */
  maxProtagonists?: number;
  /** Minimum lifespan in days for a branch to be considered long-lived */
  longLivedThresholdDays?: number;
  /** Weight factor for refactor commits (higher = more emphasis) */
  refactorWeight?: number;
  /** Enable/disable conflict arc detection */
  detectConflicts?: boolean;
  /** Enable/disable refactor hotspot detection */
  detectHotspots?: boolean;
  /** Enable/disable branch classification */
  classifyBranches?: boolean;
  /** Slide delay in milliseconds (slides format only) */
  slideDelayMs?: number;
  /** Slide color theme (slides format only) */
  slideTheme?: 'default' | 'dark' | 'light' | 'retro';
}

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: Config = {
  repoPath: process.cwd(),
  format: 'text',
  maxProtagonists: 3,
  longLivedThresholdDays: 30,
  refactorWeight: 1.5,
  detectConflicts: true,
  detectHotspots: true,
  classifyBranches: true,
  slideDelayMs: 2000,
  slideTheme: 'default',
};

// ---------------------------------------------------------------------------
// Configuration loading
// ---------------------------------------------------------------------------

const CONFIG_FILE_NAMES = [
  '.ggnrc',
  '.ggnrc.json',
  '.ggnrc.yaml',
  '.ggnrc.yml',
  'git-graph-narrator.json',
  'git-graph-narrator.yaml',
  'git-graph-narrator.yml',
];

/**
 * Attempt to parse a string as JSON. Returns null on failure.
 */
function tryParseJson(content: string): Record<string, unknown> | null {
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Attempt to parse a string as YAML (simple key-value replacement).
 * This is a minimal YAML parser that supports only flat key-value pairs
 * and nested objects (no arrays, no complex types). For full YAML support,
 * consider using a library like js-yaml.
 */
function tryParseYaml(content: string): Record<string, unknown> | null {
  try {
    const result: Record<string, unknown> = {};
    const lines = content.split('\n');
    let currentKey: string | null = null;
    let currentIndent = 0;
    const stack: Array<{ key: string; obj: Record<string, unknown>; indent: number }> = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\s+$/, '');
      if (line.length === 0 || line.startsWith('#')) {
        continue;
      }

      const indent = line.search(/\S/);
      const trimmed = line.trim();

      if (trimmed.endsWith(':')) {
        // New nested key
        const key = trimmed.slice(0, -1).trim();
        if (indent === 0) {
          stack.length = 0;
          currentKey = key;
          result[key] = {};
          stack.push({ key, obj: result[key] as Record<string, unknown>, indent });
        } else {
          while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
            stack.pop();
          }
          const parent = stack.length > 0 ? stack[stack.length - 1].obj : result;
          const newObj: Record<string, unknown> = {};
          parent[key] = newObj;
          stack.push({ key, obj: newObj, indent });
          currentKey = key;
        }
      } else if (trimmed.includes(':')) {
        // Key-value pair
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        let value: unknown = trimmed.slice(colonIndex + 1).trim();

        // Remove quotes
        if (typeof value === 'string') {
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Parse booleans and numbers
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (value === 'null') value = null;
          else if (/^\d+$/.test(value)) value = parseInt(value as string, 10);
          else if (/^\d+\.\d+$/.test(value)) value = parseFloat(value as string);
        }

        // Place in the correct nested object
        if (stack.length > 0) {
          stack[stack.length - 1].obj[key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Load configuration from a file. First checks the current working directory
 * for known config file names, then falls back to the user's home directory.
 * Returns null if no config file is found.
 */
export function loadConfigFromFile(cwd?: string): Config | null {
  const searchDirs = [cwd || process.cwd(), process.env.HOME || process.env.USERPROFILE || '/'].filter(Boolean);

  for (const dir of searchDirs) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const fullPath = path.join(dir, fileName);
      if (fs.existsSync(fullPath)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const ext = path.extname(fileName).toLowerCase();
          let parsed: Record<string, unknown> | null = null;

          if (ext === '.json' || fileName.endsWith('.json')) {
            parsed = tryParseJson(content);
          } else if (ext === '.yaml' || ext === '.yml') {
            parsed = tryParseYaml(content);
          }

          if (parsed) {
            // Merge with defaults
            const config: Config = { ...DEFAULT_CONFIG };
            for (const [key, value] of Object.entries(parsed)) {
              if (key in DEFAULT_CONFIG) {
                (config as Record<string, unknown>)[key] = value;
              }
            }
            return config;
          }
        } catch {
          // Skip invalid config files
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Merge CLI options with config file and defaults.
 * CLI options take highest priority, then config file, then defaults.
 */
export function mergeConfig(cliOptions: Partial<Config>): Config {
  const fileConfig = loadConfigFromFile(cliOptions.repoPath) || {};
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...cliOptions,
  };
}