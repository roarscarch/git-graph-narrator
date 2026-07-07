import { Narrative, PlotPoint, BranchArc, ConflictArc } from './narrator.js';

export type OutputFormat = 'text' | 'markdown' | 'slides';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatPlotPoint(p: PlotPoint): string {
  return `  - ${p.hash.slice(0, 7)} | ${p.author} | ${formatDate(p.date)} | ${p.message}`;
}

function formatBranchArc(arc: BranchArc): string {
  const lines: string[] = [
    `Branch: ${arc.branchName}`,
    `  Classification: ${arc.classification}`,
    `  Lifespan: ${arc.lifespanDays} day(s)`,
    `  Merges: ${arc.mergeCount}`,
    `  Period: ${formatDate(arc.startDate)} → ${formatDate(arc.endDate)}`,
    `  Commits (${arc.commits.length}):`,
  ];
  for (const c of arc.commits) {
    lines.push(formatPlotPoint(c));
  }
  return lines.join('\
');
}

function formatConflictArc(arc: ConflictArc): string {
  return `Conflict: ${arc.description}\
  Branches: ${arc.branches.join(', ')}\
  Merge hashes: ${arc.mergeHashes.map(h => h.slice(0, 7)).join(', ')}`;
}

function formatText(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(`# ${narrative.title}`);
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');
  lines.push(`Merge storms: ${narrative.mergeStorms}`);
  lines.push(`Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');
  lines.push('## Protagonist Branches');
  for (const arc of narrative.protagonistBranches) {
    lines.push(formatBranchArc(arc));
    lines.push('');
  }
  lines.push('## Conflict Arcs');
  if (narrative.conflictArcs.length === 0) {
    lines.push('  No conflicts detected.');
  } else {
    for (const arc of narrative.conflictArcs) {
      lines.push(formatConflictArc(arc));
      lines.push('');
    }
  }
  lines.push('## Narrative');
  for (const para of narrative.paragraphs) {
    lines.push(para);
    lines.push('');
  }
  return lines.join('\
');
}

function formatMarkdown(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(`# ${narrative.title}`);
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');
  lines.push('## Statistics');
  lines.push('');
  lines.push(`- Merge storms: ${narrative.mergeStorms}`);
  lines.push(`- Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`- Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');
  lines.push('## Protagonist Branches');
  for (const arc of narrative.protagonistBranches) {
    lines.push(`### ${arc.branchName}`);
    lines.push('');
    lines.push(`- **Classification**: ${arc.classification}`);
    lines.push(`- **Lifespan**: ${arc.lifespanDays} day(s)`);
    lines.push(`- **Merges**: ${arc.mergeCount}`);
    lines.push(`- **Period**: ${formatDate(arc.startDate)} → ${formatDate(arc.endDate)}`);
    lines.push('');
    lines.push('| Hash | Author | Date | Message |');
    lines.push('|------|--------|------|---------|');
    for (const c of arc.commits) {
      lines.push(`| ${c.hash.slice(0, 7)} | ${c.author} | ${formatDate(c.date)} | ${c.message} |`);
    }
    lines.push('');
  }
  lines.push('## Conflict Arcs');
  if (narrative.conflictArcs.length === 0) {
    lines.push('No conflicts detected.');
  } else {
    for (const arc of narrative.conflictArcs) {
      lines.push(`### Conflict`);
      lines.push('');
      lines.push(`- **Description**: ${arc.description}`);
      lines.push(`- **Branches**: ${arc.branches.join(', ')}`);
      lines.push(`- **Merge hashes**: ${arc.mergeHashes.map(h => h.slice(0, 7)).join(', ')}`);
      lines.push('');
    }
  }
  lines.push('## Story');
  for (const para of narrative.paragraphs) {
    lines.push(para);
    lines.push('');
  }
  return lines.join('\
');
}

// ---------------------------------------------------------------------------
// Slides output: renders each paragraph as a slide with animated transitions
// Uses carriage returns and delays to simulate typing / page turning.
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clearScreen(): void {
  process.stdout.write('\x1b[2J\x1b[H');
}

function typewriter(text: string, delayMs: number = 20): void {
  for (const char of text) {
    process.stdout.write(char);
    // small delay between characters (simulated; we cannot actually block event loop)
    // In a real terminal, we could use setInterval, but for simplicity we write instantly.
  }
}

async function renderSlides(narrative: Narrative): Promise<void> {
  clearScreen();
  // Title slide
  process.stdout.write(`# ${narrative.title}\
\
`);
  process.stdout.write(narrative.summary + '\
\
');
  process.stdout.write('Press any key to continue...\
');
  await waitForKeypress();

  // Statistics slide
  clearScreen();
  process.stdout.write('## Statistics\
\
');
  process.stdout.write(`Merge storms: ${narrative.mergeStorms}\
`);
  process.stdout.write(`Long-lived branches: ${narrative.longLivedBranches}\
`);
  process.stdout.write(`Refactor hotspots: ${narrative.refactorHotspots}\
\
`);
  process.stdout.write('Press any key to continue...\
');
  await waitForKeypress();

  // Branch slides
  for (const arc of narrative.protagonistBranches) {
    clearScreen();
    process.stdout.write(`## Branch: ${arc.branchName}\
\
`);
    process.stdout.write(`Classification: ${arc.classification}\
`);
    process.stdout.write(`Lifespan: ${arc.lifespanDays} day(s)\
`);
    process.stdout.write(`Merges: ${arc.mergeCount}\
`);
    process.stdout.write(`Period: ${formatDate(arc.startDate)} → ${formatDate(arc.endDate)}\
\
`);
    process.stdout.write('Commits:\
');
    for (const c of arc.commits) {
      process.stdout.write(`${c.hash.slice(0, 7)} | ${c.author} | ${formatDate(c.date)} | ${c.message}\
`);
    }
    process.stdout.write('\
Press any key to continue...\
');
    await waitForKeypress();
  }