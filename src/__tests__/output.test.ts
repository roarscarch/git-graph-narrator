import { describe, it, expect } from 'vitest';
import { renderNarrative, OutputFormat } from '../output.js';
import { Narrative } from '../narrator.js';

const sampleNarrative: Narrative = {
  title: 'The Epic of main',
  summary: 'A tale of two branches, conflict, and resolution.',
  protagonistBranches: [
    {
      branchName: 'main',
      commits: [
        {
          hash: 'abc123',
          author: 'Alice',
          date: new Date('2024-01-01T10:00:00Z'),
          message: 'initial commit',
          branches: ['main'],
          weight: 1.0,
        },
        {
          hash: 'def456',
          author: 'Bob',
          date: new Date('2024-01-02T12:00:00Z'),
          message: 'feat: add feature',
          branches: ['main'],
          weight: 2.5,
        },
      ],
      startDate: new Date('2024-01-01T10:00:00Z'),
      endDate: new Date('2024-01-02T12:00:00Z'),
      mergeCount: 1,
    },
    {
      branchName: 'feature/foo',
      commits: [
        {
          hash: '789ghi',
          author: 'Charlie',
          date: new Date('2024-01-03T08:00:00Z'),
          message: 'fix: resolve bug',
          branches: ['feature/foo'],
          weight: 1.2,
        },
      ],
      startDate: new Date('2024-01-03T08:00:00Z'),
      endDate: new Date('2024-01-03T08:00:00Z'),
      mergeCount: 0,
    },
  ],
  conflictArcs: [
    {
      branches: ['feature/foo', 'feature/bar'],
      mergeHashes: ['merge1'],
      description: 'Conflict between foo and bar over config file.',
    },
  ],
  mergeStorms: 2,
  longLivedBranches: 1,
  refactorHotspots: 3,
  paragraphs: [
    'Once upon a time, main was born.',
    'Then feature/foo appeared, bringing new changes.',
    'Conflict arose, but was resolved through merging.',
  ],
};

describe('renderNarrative', () => {
  it('renders text format', () => {
    const output = renderNarrative(sampleNarrative, 'text');
    expect(output).toContain('The Epic of main');
    expect(output).toContain('A tale of two branches, conflict, and resolution.');
    expect(output).toContain('Protagonist Branches');
    expect(output).toContain('main');
    expect(output).toContain('feature/foo');
    expect(output).toContain('Conflict Arcs');
    expect(output).toContain('Conflict between foo and bar over config file.');
    expect(output).toContain('Merge Storms: 2');
    expect(output).toContain('Long-Lived Branches: 1');
    expect(output).toContain('Refactor Hotspots: 3');
    expect(output).toContain('The Story');
    expect(output).toContain('Once upon a time, main was born.');
  });

  it('renders markdown format', () => {
    const output = renderNarrative(sampleNarrative, 'markdown');
    expect(output).toContain('# The Epic of main');
    expect(output).toContain('**Merge Storms:** 2');
    expect(output).toContain('- **Conflict between foo and bar over config file.**');
    expect(output).toContain('### Protagonist Branches');
    expect(output).toContain('Once upon a time, main was born.');
  });

  it('renders slides format', () => {
    const output = renderNarrative(sampleNarrative, 'slides');
    // Slides should contain -- separator
    expect(output).toContain('---');
    const slides = output.split('---').filter(s => s.trim().length > 0);
    // At least title slide, summary, protagonist branches, conflict arcs, story
    expect(slides.length).toBeGreaterThanOrEqual(5);
    expect(slides[0]).toContain('The Epic of main');
  });

  it('throws on unknown format', () => {
    expect(() => renderNarrative(sampleNarrative, 'unknown' as OutputFormat)).toThrow('Unknown output format: unknown');
  });

  it('handles empty narrative gracefully', () => {
    const emptyNarrative: Narrative = {
      title: 'Empty',
      summary: 'No commits.',
      protagonistBranches: [],
      conflictArcs: [],
      mergeStorms: 0,
      longLivedBranches: 0,
      refactorHotspots: 0,
      paragraphs: [],
    };
    const text = renderNarrative(emptyNarrative, 'text');
    expect(text).toContain('Empty');
    expect(text).not.toContain('Protagonist Branches');
  });
});
