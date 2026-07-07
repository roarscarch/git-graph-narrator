import { CommitGraph, CommitNode } from './parser.js';
import { Narrative, PlotPoint, BranchArc, ConflictArc } from './narrator.js';

export type OutputFormat = 'text' | 'markdown' | 'slides';

// ---------------------------------------------------------------------------
// Terminal control constants for animated slides
// ---------------------------------------------------------------------------

const ESC = '\x1b';
const CSI = ESC + '[';

function cursorHide(): string {
  return CSI + '?25l';
}

function cursorShow(): string {
  return CSI + '?25h';
}

function cursorUp(n: number): string {
  return CSI + n + 'A';
}

function clearLine(): string {
  return CSI + '2K';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

function renderText(narrative: Narrative): string {
  const lines: string[] = [];

  lines.push(narrative.title);
  lines.push('='.repeat(narrative.title.length));
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  // Protagonist branches
  if (narrative.protagonistBranches.length > 0) {
    lines.push('Protagonist Branches:');
    lines.push('-' .repeat(20));
    for (const arc of narrative.protagonistBranches) {
      lines.push(`  ${arc.branchName} (${arc.classification})`);
      lines.push(`    Lifespan: ${arc.lifespanDays.toFixed(1)} days`);
      lines.push(`    Merges: ${arc.mergeCount}`);
      lines.push(`    Commits: ${arc.commits.length}`);
      lines.push('');
    }
  }

  // Conflict arcs
  if (narrative.conflictArcs.length > 0) {
    lines.push('Conflict Arcs:');
    lines.push('-' .repeat(20));
    for (const conflict of narrative.conflictArcs) {
      lines.push(`  Branches: ${conflict.branches.join(', ')}`);
      lines.push(`  Merges: ${conflict.mergeHashes.join(', ')}`);
      lines.push(`  ${conflict.description}`);
      lines.push('');
    }
  }

  // Stats
  lines.push('Statistics:');
  lines.push(`  Merge storms: ${narrative.mergeStorms}`);
  lines.push(`  Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`  Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');

  // Paragraphs
  if (narrative.paragraphs.length > 0) {
    lines.push('Narrative:');
    lines.push('-' .repeat(20));
    for (const para of narrative.paragraphs) {
      lines.push(para);
      lines.push('');
    }
  }

  return lines.join('\
');
}

// ---------------------------------------------------------------------------
// Markdown rendering
// ---------------------------------------------------------------------------

function renderMarkdown(narrative: Narrative): string {
  const lines: string[] = [];

  lines.push(`# ${narrative.title}`);
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  if (narrative.protagonistBranches.length > 0) {
    lines.push('## Protagonist Branches');
    for (const arc of narrative.protagonistBranches) {
      lines.push(`- **${arc.branchName}** (${arc.classification})`);
      lines.push(`  - Lifespan: ${arc.lifespanDays.toFixed(1)} days`);
      lines.push(`  - Merges: ${arc.mergeCount}`);
      lines.push(`  - Commits: ${arc.commits.length}`);
    }
    lines.push('');
  }

  if (narrative.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    for (const conflict of narrative.conflictArcs) {
      lines.push(`- **${conflict.branches.join(' vs ')}**`);
      lines.push(`  - Merge hashes: \`${conflict.mergeHashes.join(', ')}\``);
      lines.push(`  - ${conflict.description}`);
    }
    lines.push('');
  }

  lines.push('## Statistics');
  lines.push(`- Merge storms: ${narrative.mergeStorms}`);
  lines.push(`- Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`- Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');

  if (narrative.paragraphs.length > 0) {
    lines.push('## Narrative');
    for (const para of narrative.paragraphs) {
      lines.push(para);
      lines.push('');
    }
  }

  return lines.join('\
');
}

// ---------------------------------------------------------------------------
// Slides rendering (animated)
// ---------------------------------------------------------------------------

function renderSlide(narrative: Narrative, index: number, total: number): string {
  const slideLines: string[] = [];
  const header = `Slide ${index + 1} / ${total}`;
  const separator = '-'.repeat(40);

  slideLines.push(header);
  slideLines.push(separator);
  slideLines.push('');

  if (index === 0) {
    // Title slide
    slideLines.push(narrative.title);
    slideLines.push('');
    slideLines.push(narrative.summary);
  } else if (index === 1) {
    // Branches slide
    slideLines.push('Protagonist Branches:');
    for (const arc of narrative.protagonistBranches) {
      slideLines.push(`  - ${arc.branchName} (${arc.classification}, ${arc.lifespanDays.toFixed(1)} days)`);
    }
  } else if (index === 2) {
    // Conflict slide
    slideLines.push('Conflict Arcs:');
    for (const conflict of narrative.conflictArcs) {
      slideLines.push(`  - ${conflict.branches.join(', ')}: ${conflict.description}`);
    }
  } else if (index === 3) {
    // Stats slide
    slideLines.push('Statistics:');
    slideLines.push(`  Merge storms: ${narrative.mergeStorms}`);
    slideLines.push(`  Long-lived branches: ${narrative.longLivedBranches}`);
    slideLines.push(`  Refactor hotspots: ${narrative.refactorHotspots}`);
  } else if (index === 4) {
    // Narrative paragraphs slide (first paragraph)
    if (narrative.paragraphs.length > 0) {
      slideLines.push(narrative.paragraphs[0]);
    }
  } else if (index === 5) {
    // Second paragraph if exists
    if (narrative.paragraphs.length > 1) {
      slideLines.push(narrative.paragraphs[1]);
    }
  } else {
    // Remaining paragraphs
    const paraIndex = index - 4;
    if (paraIndex < narrative.paragraphs.length) {
      slideLines.push(narrative.paragraphs[paraIndex]);
    } else {
      slideLines.push('(End of narrative)');
    }
  }

  slideLines.push('');
  slideLines.push('Press Ctrl+C to exit.');

  return slideLines.join('\
');
}

function totalSlides(narrative: Narrative): number {
  // title + branches + conflicts + stats + paragraphs (each as a slide)
  return 4 + narrative.paragraphs.length;
}