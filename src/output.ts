import { Narrative } from './narrator.js';

// ---------------------------------------------------------------------------
// Output formatters
// ---------------------------------------------------------------------------

export type OutputFormat = 'text' | 'markdown' | 'slides';

/**
 * Render a Narrative in the requested format.
 */
export function renderNarrative(narrative: Narrative, format: OutputFormat): string {
  switch (format) {
    case 'text':
      return renderText(narrative);
    case 'markdown':
      return renderMarkdown(narrative);
    case 'slides':
      return renderSlides(narrative);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

function renderText(n: Narrative): string {
  const lines: string[] = [];

  lines.push(n.title);
  lines.push('='.repeat(n.title.length));
  lines.push('');
  lines.push(n.summary);
  lines.push('');

  lines.push('Protagonist Branches');
  lines.push('--------------------');
  for (const b of n.protagonistBranches) {
    lines.push(`  ${b.branchName} (${b.commits.length} commits, merged ${b.mergeCount} times)`);
    lines.push(`    Duration: ${b.startDate.toISOString().slice(0,10)} to ${b.endDate.toISOString().slice(0,10)}`);
    for (const pc of b.commits.slice(0, 5)) {
      lines.push(`    - ${pc.hash.slice(0,7)} ${pc.message}`);
    }
    if (b.commits.length > 5) {
      lines.push(`    ... and ${b.commits.length - 5} more`);
    }
  }
  lines.push('');

  if (n.conflictArcs.length > 0) {
    lines.push('Conflict Arcs');
    lines.push('-------------');
    for (const c of n.conflictArcs) {
      lines.push(`  Branches: ${c.branches.join(', ')}`);
      lines.push(`  ${c.description}`);
    }
    lines.push('');
  }

  lines.push('Statistics');
  lines.push('----------');
  lines.push(`  Merge storms: ${n.mergeStorms}`);
  lines.push(`  Long-lived branches: ${n.longLivedBranches}`);
  lines.push(`  Refactor hotspots: ${n.refactorHotspots}`);
  lines.push('');

  lines.push('---');
  lines.push('');
  for (const p of n.paragraphs) {
    lines.push(p);
    lines.push('');
  }

  return lines.join('\
');
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

function renderMarkdown(n: Narrative): string {
  const lines: string[] = [];

  lines.push(`# ${n.title}`);
  lines.push('');
  lines.push(n.summary);
  lines.push('');

  lines.push('## Protagonist Branches');
  lines.push('');
  for (const b of n.protagonistBranches) {
    lines.push(`### ${b.branchName}`);
    lines.push('');
    lines.push(`- **Commits:** ${b.commits.length}`);
    lines.push(`- **Merges:** ${b.mergeCount}`);
    lines.push(`- **Duration:** ${b.startDate.toISOString().slice(0,10)} → ${b.endDate.toISOString().slice(0,10)}`);
    lines.push('');
    lines.push('| Hash | Message |');
    lines.push('|------|---------|');
    for (const pc of b.commits.slice(0, 10)) {
      lines.push(`| \`${pc.hash.slice(0,7)}\` | ${pc.message.replace(/\|/g, '\\|')} |`);
    }
    if (b.commits.length > 10) {
      lines.push(`| ... | *${b.commits.length - 10} more commits* |`);
    }
    lines.push('');
  }

  if (n.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    lines.push('');
    for (const c of n.conflictArcs) {
      lines.push(`- **${c.branches.join(' vs ')}**: ${c.description}`);
    }
    lines.push('');
  }

  lines.push('## Statistics');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Merge storms | ${n.mergeStorms} |`);
  lines.push(`| Long-lived branches | ${n.longLivedBranches} |`);
  lines.push(`| Refactor hotspots | ${n.refactorHotspots} |`);
  lines.push('');

  lines.push('---');
  lines.push('');
  for (const p of n.paragraphs) {
    lines.push(p);
    lines.push('');
  }

  return lines.join('\
');
}

// ---------------------------------------------------------------------------
// Animated terminal slides (simple ASCII frame format)
// ---------------------------------------------------------------------------

function renderSlides(n: Narrative): string {
  // Returns a multi-line string where each slide is separated by a form feed
  // so that a terminal or Ink renderer can display them one by one.
  const slides: string[] = [];

  // Slide 1: Title
  slides.push(`╔${'═'.repeat(58)}╗`);
  slides.push(`║ ${n.title.padEnd(56)} ║`);
  slides.push(`║${'═'.repeat(58)}║`);
  slides.push(`║ ${n.summary.padEnd(56)} ║`);
  slides.push(`╚${'═'.repeat(58)}╝`);

  // Slide 2: Protagonist Branches
  const branchLines: string[] = [];
  branchLines.push(`╔${'═'.repeat(58)}╗`);
  branchLines.push(`║ Protagonist Branches${' '.repeat(38)}║`);
  branchLines.push(`║${'═'.repeat(58)}║`);
  for (const b of n.protagonistBranches.slice(0, 6)) {
    branchLines.push(`║ ${b.branchName.padEnd(56)} ║`);
    branchLines.push(`║   Commits: ${String(b.commits.length).padEnd(46)} ║`);
    branchLines.push(`║   Merges:  ${String(b.mergeCount).padEnd(46)} ║`);
  }
  if (n.protagonistBranches.length > 6) {
    branchLines.push(`║   ... and ${n.protagonistBranches.length - 6} more${' '.repeat(46)}║`);
  }
  branchLines.push(`╚${'═'.repeat(58)}╝`);
  slides.push(branchLines.join('\
'));

  // Slide 3: Conflict Arcs
  const conflictLines: string[] = [];
  conflictLines.push(`╔${'═'.repeat(58)}╗`);
  conflictLines.push(`║ Conflict Arcs${' '.repeat(44)}║`);
  conflictLines.push(`║${'═'.repeat(58)}║`);
  if (n.conflictArcs.length === 0) {
    conflictLines.push(`║ No conflicts detected.${' '.repeat(37)}║`);
  }