import { Narrative, BranchNarrative } from './narrator.js';

export type OutputFormat = 'text' | 'markdown' | 'slides';

/**
 * Renders a Narrative into the specified format.
 * @param narrative The narrative to render.
 * @param format The desired output format.
 * @returns The rendered string.
 */
export function renderNarrative(narrative: Narrative, format: OutputFormat): string {
  switch (format) {
    case 'markdown':
      return renderMarkdown(narrative);
    case 'slides':
      return renderSlides(narrative);
    case 'text':
    default:
      return renderText(narrative);
  }
}

function renderText(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(narrative.title);
  lines.push('='.repeat(narrative.title.length));
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  for (const branch of narrative.protagonistBranches) {
    lines.push(`## ${branch.branchName}`);
    lines.push(`   Commits: ${branch.commits.length}, Merges: ${branch.mergeCount}`);
    lines.push(`   Period: ${branch.startDate.toISOString().slice(0,10)} - ${branch.endDate.toISOString().slice(0,10)}`);
    lines.push('');
    for (const commit of branch.commits) {
      const date = commit.date.toISOString().slice(0,10);
      lines.push(`   [${date}] ${commit.author}: ${commit.message}`);
    }
    lines.push('');
  }

  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    lines.push('');
    for (const arc of narrative.conflictArcs) {
      lines.push(`- ${arc.description}`);
    }
    lines.push('');
  }

  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    lines.push('## Merge Storms');
    lines.push('');
    for (const storm of narrative.mergeStorms) {
      lines.push(`- ${storm.description}`);
    }
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

  for (const branch of narrative.protagonistBranches) {
    lines.push(`## ${branch.branchName}`);
    lines.push('');
    lines.push(`- **Commits:** ${branch.commits.length}`);
    lines.push(`- **Merges:** ${branch.mergeCount}`);
    lines.push(`- **Period:** ${branch.startDate.toISOString().slice(0,10)} - ${branch.endDate.toISOString().slice(0,10)}`);
    lines.push('');

    const tableHeader = '| Date | Author | Message |';
    const tableSeparator = '|------|--------|---------|';
    const tableRows = branch.commits.map(c => {
      const date = c.date.toISOString().slice(0,10);
      return `| ${date} | ${c.author} | ${c.message} |`;
    });
    lines.push(tableHeader);
    lines.push(tableSeparator);
    lines.push(...tableRows);
    lines.push('');
  }

  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    lines.push('');
    lines.push(...narrative.conflictArcs.map(arc => `- ${arc.description}`));
    lines.push('');
  }

  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    lines.push('## Merge Storms');
    lines.push('');
    lines.push(...narrative.mergeStorms.map(storm => `- ${storm.description}`));
    lines.push('');
  }

  return lines.join('\n');
}

function renderSlides(narrative: Narrative): string {
  // For slides, we'll output a simple text-based slide separator for now.
  // In a full implementation, this would use Ink or an alternative.
  const slides: string[] = [];
  slides.push(`# ${narrative.title}`);
  slides.push('');
  slides.push(narrative.summary);
  slides.push('---');

  for (const branch of narrative.protagonistBranches) {
    slides.push(`## ${branch.branchName}`);
    slides.push('');
    for (const commit of branch.commits) {
      const date = commit.date.toISOString().slice(0,10);
      slides.push(`- [${date}] ${commit.author}: ${commit.message}`);
    }
    slides.push('---');
  }

  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    slides.push('## Conflict Arcs');
    slides.push('');
    slides.push(...narrative.conflictArcs.map(arc => `- ${arc.description}`));
    slides.push('---');
  }

  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    slides.push('## Merge Storms');
    slides.push('');
    slides.push(...narrative.mergeStorms.map(storm => `- ${storm.description}`));
    slides.push('---');
  }

  return slides.join('\n');
}