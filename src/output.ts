import { Narrative, BranchArc, ConflictArc } from './narrator.js';

export type OutputFormat = 'text' | 'markdown' | 'slides';

function colorize(text: string, colorCode: number): string {
  return `\x1b[${colorCode}m${text}\x1b[0m`;
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`;
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`;
}

function renderSlide(narrative: Narrative, slideIndex: number, totalSlides: number): string {
  const lines: string[] = [];
  const header = `Slide ${slideIndex + 1}/${totalSlides}`;
  const separator = '─'.repeat(Math.max(header.length + 4, 60));
  
  lines.push(bold(header));
  lines.push(separator);
  lines.push('');

  switch (slideIndex) {
    case 0: {
      // Title slide
      lines.push(bold(colorize(narrative.title, 36))); // cyan
      lines.push('');
      lines.push(narrative.summary);
      lines.push('');
      lines.push(dim('Press any key to advance...'));
      break;
    }
    case 1: {
      // Overview slide
      lines.push(bold('Repository Overview'));
      lines.push('');
      lines.push(`Protagonist branches: ${narrative.protagonistBranches.length}`);
      lines.push(`Conflict arcs: ${narrative.conflictArcs.length}`);
      lines.push(`Merge storms: ${narrative.mergeStorms}`);
      lines.push(`Long-lived branches: ${narrative.longLivedBranches}`);
      lines.push(`Refactor hotspots: ${narrative.refactorHotspots}`);
      lines.push('');
      lines.push(dim('Press any key to continue...'));
      break;
    }
    default: {
      // Content slides: protagonist branches then conflict arcs then paragraphs
      const protagonistSlides = narrative.protagonistBranches.length;
      const conflictSlides = narrative.conflictArcs.length;
      const paragraphSlides = narrative.paragraphs.length;
      
      let idx = slideIndex - 2;
      
      if (idx < protagonistSlides) {
        const branch = narrative.protagonistBranches[idx];
        renderBranchArc(lines, branch);
      } else if (idx < protagonistSlides + conflictSlides) {
        const conflict = narrative.conflictArcs[idx - protagonistSlides];
        renderConflictArc(lines, conflict);
      } else if (idx < protagonistSlides + conflictSlides + paragraphSlides) {
        const paragraph = narrative.paragraphs[idx - protagonistSlides - conflictSlides];
        lines.push(bold('Narrative'));
        lines.push('');
        lines.push(paragraph);
      } else {
        lines.push(bold('The End'));
        lines.push('');
        lines.push('Thank you for exploring your repository history.');
      }
      lines.push('');
      lines.push(dim('Press any key to continue...'));
      break;
    }
  }

  lines.push('');
  lines.push(separator);
  return lines.join('\
');
}

function renderBranchArc(lines: string[], branch: BranchArc): void {
  lines.push(bold(colorize(`Branch: ${branch.branchName}`, 33))); // yellow
  lines.push(`Classification: ${branch.classification}`);
  lines.push(`Lifespan: ${branch.lifespanDays} day(s)`);
  lines.push(`Merges: ${branch.mergeCount}`);
  lines.push(`Commits: ${branch.commits.length}`);
  lines.push('');
  
  const topCommits = branch.commits
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  
  if (topCommits.length > 0) {
    lines.push(dim('Top commits by impact:'));
    for (const commit of topCommits) {
      const dateStr = commit.date.toISOString().split('T')[0];
      lines.push(`  ${colorize(commit.hash.substring(0, 7), 32)} ${dateStr} ${commit.message}`);
    }
  }
}

function renderConflictArc(lines: string[], conflict: ConflictArc): void {
  lines.push(bold(colorize('Conflict Arc', 31))); // red
  lines.push(`Branches: ${conflict.branches.join(', ')}`);
  lines.push(`Merge hashes: ${conflict.mergeHashes.map(h => h.substring(0, 7)).join(', ')}`);
  lines.push('');
  lines.push(conflict.description);
}

export function renderNarrative(narrative: Narrative, format: OutputFormat): string {
  switch (format) {
    case 'slides': {
      const totalSlides = 2 + narrative.protagonistBranches.length + narrative.conflictArcs.length + narrative.paragraphs.length + 1;
      const slides: string[] = [];
      for (let i = 0; i < totalSlides; i++) {
        slides.push(renderSlide(narrative, i, totalSlides));
      }
      return slides.join('\
\
---\
\
');
    }
    case 'markdown': {
      return renderMarkdown(narrative);
    }
    case 'text':
    default: {
      return renderText(narrative);
    }
  }
}

function renderText(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(narrative.title);
  lines.push('='.repeat(narrative.title.length));
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  if (narrative.protagonistBranches.length > 0) {
    lines.push('Protagonist Branches:');
    lines.push('-'.repeat(20));
    for (const branch of narrative.protagonistBranches) {
      lines.push(`  ${branch.branchName} (${branch.classification}, ${branch.lifespanDays} days, ${branch.mergeCount} merges)`);
    }
    lines.push('');
  }

  if (narrative.conflictArcs.length > 0) {
    lines.push('Conflict Arcs:');
    lines.push('-'.repeat(14));
    for (const conflict of narrative.conflictArcs) {
      lines.push(`  Branches: ${conflict.branches.join(', ')}`);
      lines.push(`  ${conflict.description}`);
      lines.push('');
    }
  }

  lines.push('Metrics:');
  lines.push(`  Merge storms: ${narrative.mergeStorms}`);
  lines.push(`  Long-lived branches: ${narrative.longLivedBranches}`);
  lines.push(`  Refactor hotspots: ${narrative.refactorHotspots}`);
  lines.push('');

  if (narrative.paragraphs.length > 0) {
    lines.push('Narrative:');
    lines.push('-'.repeat(10));
    for (const para of narrative.paragraphs) {
      lines.push(para);
      lines.push('');
    }
  }

  return lines.join('\
');
}

function renderMarkdown(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(`# ${narrative.title}`);
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  if (narrative.protagonistBranches.length > 0) {
    lines.push('## Protagonist Branches');
    for (const branch of narrative.protagonistBranches) {
      lines.push(`- **${branch.branchName}** — ${branch.classification}, ${branch.lifespanDays}