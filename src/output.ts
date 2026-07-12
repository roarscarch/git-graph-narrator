import { Narrative, BranchArc } from './narrator.js';
import { CommitNode } from './parser.js';

export enum OutputFormat {
  PLAIN = 'plain',
  MARKDOWN = 'markdown',
  SLIDES = 'slides',
}

/**
 * Renders a Narrative into the specified output format.
 *
 * @param narrative - The narrative to render.
 * @param format - The desired output format.
 * @returns The rendered string.
 */
export function renderNarrative(narrative: Narrative, format: OutputFormat): string {
  switch (format) {
    case OutputFormat.PLAIN:
      return renderPlain(narrative);
    case OutputFormat.MARKDOWN:
      return renderMarkdown(narrative);
    case OutputFormat.SLIDES:
      return renderSlides(narrative);
    default:
      return renderPlain(narrative);
  }
}

function renderPlain(narrative: Narrative): string {
  const lines: string[] = [];
  lines.push(narrative.title);
  lines.push('='.repeat(narrative.title.length));
  lines.push('');
  lines.push(narrative.summary);
  lines.push('');

  for (const arc of narrative.protagonistBranches) {
    const startStr = arc.startDate.toISOString().slice(0, 10);
    const endStr = arc.endDate.toISOString().slice(0, 10);
    lines.push(`## ${arc.branchName} (${startStr} to ${endStr}, ${arc.mergeCount} merges)`);
    lines.push('');
    for (const commit of arc.commits) {
      const dateStr = commit.date.toISOString().slice(0, 10);
      lines.push(`  * ${dateStr} - ${commit.author}: ${commit.message}`);
    }
    lines.push('');
  }

  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    lines.push('## Merge Storms');
    lines.push('');
    for (const storm of narrative.mergeStorms) {
      lines.push(`  * ${storm.date.toISOString().slice(0, 10)}: ${storm.description}`);
    }
    lines.push('');
  }

  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    lines.push('');
    for (const conflict of narrative.conflictArcs) {
      lines.push(`  * ${conflict.branches.join(' vs ')}: ${conflict.description}`);
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

  for (const arc of narrative.protagonistBranches) {
    const startStr = arc.startDate.toISOString().slice(0, 10);
    const endStr = arc.endDate.toISOString().slice(0, 10);
    lines.push(`## ${arc.branchName}`);
    lines.push('');
    lines.push(`_From ${startStr} to ${endStr}, ${arc.mergeCount} merges_`);
    lines.push('');
    for (const commit of arc.commits) {
      const dateStr = commit.date.toISOString().slice(0, 10);
      lines.push(`- \`${dateStr}\` **${commit.author}**: ${commit.message}`);
    }
    lines.push('');
  }

  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    lines.push('## Merge Storms');
    lines.push('');
    for (const storm of narrative.mergeStorms) {
      lines.push(`- \`${storm.date.toISOString().slice(0, 10)}\`: ${storm.description}`);
    }
    lines.push('');
  }

  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    lines.push('## Conflict Arcs');
    lines.push('');
    for (const conflict of narrative.conflictArcs) {
      lines.push(`- **${conflict.branches.join(' vs ')}**: ${conflict.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderSlides(narrative: Narrative): string {
  // Slides format: each slide separated by a form feed character
  const slides: string[] = [];

  // Title slide
  slides.push(`# ${narrative.title}\n\n${narrative.summary}`);

  // Branch slides
  for (const arc of narrative.protagonistBranches) {
    const startStr = arc.startDate.toISOString().slice(0, 10);
    const endStr = arc.endDate.toISOString().slice(0, 10);
    let slide = `## ${arc.branchName}\n\nFrom ${startStr} to ${endStr}, ${arc.mergeCount} merges\n\n`;
    for (const commit of arc.commits) {
      const dateStr = commit.date.toISOString().slice(0, 10);
      slide += `- ${dateStr} ${commit.author}: ${commit.message}\n`;
    }
    slides.push(slide);
  }

  // Merge storms slide
  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    let slide = '## Merge Storms\n\n';
    for (const storm of narrative.mergeStorms) {
      slide += `- ${storm.date.toISOString().slice(0, 10)}: ${storm.description}\n`;
    }
    slides.push(slide);
  }

  // Conflict arcs slide
  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    let slide = '## Conflict Arcs\n\n';
    for (const conflict of narrative.conflictArcs) {
      slide += `- ${conflict.branches.join(' vs ')}: ${conflict.description}\n`;
    }
    slides.push(slide);
  }

  return slides.join('\f');
}
