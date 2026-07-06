import { Narrative, BranchArc, PlotPoint } from './narrator.js';

export type OutputFormat = 'text' | 'markdown' | 'slides';

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatPlotPoint(p: PlotPoint): string {
  return `  - ${p.hash.slice(0,7)} ${formatDate(p.date)} ${p.author}: ${p.message} (weight: ${p.weight.toFixed(2)})`;
}

function formatBranchArc(arc: BranchArc): string {
  let out = `## ${arc.branchName}\n`;
  out += `- From ${formatDate(arc.startDate)} to ${formatDate(arc.endDate)}, ${arc.commits.length} commits, ${arc.mergeCount} merges\n`;
  for (const c of arc.commits) {
    out += formatPlotPoint(c) + '\n';
  }
  return out;
}

export function renderNarrative(narrative: Narrative, format: OutputFormat): string {
  switch (format) {
    case 'text':
      return renderText(narrative);
    case 'markdown':
      return renderMarkdown(narrative);
    case 'slides':
      return renderSlides(narrative);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

function renderText(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(narrative.title);
  lines.push('='.repeat(narrative.title.length));
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const arc of narrative.protagonistBranches) {
    lines.push(`Branch: ${arc.branchName}`);
    lines.push(`Period: ${formatDate(arc.startDate)} - ${formatDate(arc.endDate)}`);
    lines.push(`Commits: ${arc.commits.length} | Merges: ${arc.mergeCount}`);
    for (const c of arc.commits) {
      lines.push(formatPlotPoint(c));
    }
    lines.push('');
  }
  if (narrative.conflictArcs.length > 0) {
    lines.push('Conflicts:');
    for (const ca of narrative.conflictArcs) {
      lines.push(`  ${ca.branches.join(' vs ')}: ${ca.description}`);
    }
    lines.push('');
  }
  lines.push('--- Stats ---');
  lines.push(`Merge storms: ${narrative.mergeStorms}`);
  lines.push(`Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');
  // Paragraphs
  for (const p of narrative.paragraphs) {
    lines.push(p);
    lines.push('');
  }
  return lines.join('\n');
}

function renderMarkdown(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(`# ${narrative.title}`);
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');
  lines.push('---');
  lines.push('');
  for (const arc of narrative.protagonistBranches) {
    lines.push(formatBranchArc(arc));
    lines.push('');
  }
  if (narrative.conflictArcs.length > 0) {
    lines.push('## Conflicts');
    lines.push('');
    for (const ca of narrative.conflictArcs) {
      lines.push(`- **${ca.branches.join(' vs ')}**: ${ca.description}`);
    }
    lines.push('');
  }
  lines.push('## Statistics');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Merge storms | ${narrative.mergeStorms} |`);
  lines.push(`| Long-lived branches | ${narrative.longLivedBranches} |`);
  lines.push(`| Refactor hotspots | ${narrative.refactorHotspots} |`);
  lines.push('');
  lines.push('## Story');
  lines.push('');
  for (const p of narrative.paragraphs) {
    lines.push(p);
    lines.push('');
  }
  return lines.join('\n');
}

function renderSlides(narrative: Narrative): string {
  // For now, return a simple text-based slide representation
  // Future: ink-based animated terminal slides
  const slides: string[] = [];
  slides.push(`=== Slide 1: ${narrative.title} ===`);
  slides.push(narrative.summary);
  slides.push('');
  for (let i = 0; i < narrative.protagonistBranches.length; i++) {
    const arc = narrative.protagonistBranches[i];
    slides.push(`=== Slide ${i + 2}: Branch ${arc.branchName} ===`);
    slides.push(`Period: ${formatDate(arc.startDate)} - ${formatDate(arc.endDate)}`);
    slides.push(`Commits: ${arc.commits.length} | Merges: ${arc.mergeCount}`);
    for (const c of arc.commits) {
      slides.push(formatPlotPoint(c));
    }
    slides.push('');
  }
  const conflictSlideIndex = narrative.protagonistBranches.length + 2;
  if (narrative.conflictArcs.length > 0) {
    slides.push(`=== Slide ${conflictSlideIndex}: Conflicts ===`);
    for (const ca of narrative.conflictArcs) {
      slides.push(`- ${ca.branches.join(' vs ')}: ${ca.description}`);
    }
    slides.push('');
  }
  const statsSlideIndex = conflictSlideIndex + (narrative.conflictArcs.length > 0 ? 1 : 0);
  slides.push(`=== Slide ${statsSlideIndex}: Statistics ===`);
  slides.push(`Merge storms: ${narrative.mergeStorms}`);
  slides.push(`Long-lived branches: ${narrative.longLivedBranches}`);
  slides.push(`Refactor hotspots: ${narrative.refactorHotspots}`);
  slides.push('');
  const storySlideIndex = statsSlideIndex + 1;
  for (let i = 0; i < narrative.paragraphs.length; i++) {
    slides.push(`=== Slide ${storySlideIndex + i}: Chapter ${i + 1} ===`);
    slides.push(narrative.paragraphs[i]);
    slides.push('');
  }
  return slides.join('\n');
}
