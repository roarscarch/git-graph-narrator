import React, { useState, useEffect, useRef } from 'react';
import { render, Text, Box, useInput, useApp, useStdoutDimensions } from 'ink';
import { parseGitLog, CommitGraph } from '../parser.js';
import { buildNarrative, Narrative } from '../narrator.js';
import { renderNarrative, OutputFormat } from '../output.js';

interface StorySlide {
  title: string;
  lines: string[];
}

function buildSlides(narrative: Narrative): StorySlide[] {
  const slides: StorySlide[] = [];

  // Title slide
  slides.push({
    title: narrative.title,
    lines: [narrative.summary, '', 'Press any key to start...'],
  });

  // Protagonist branches
  for (const branch of narrative.protagonistBranches) {
    const lines: string[] = [
      `Branch: ${branch.branchName}`,
      `Duration: ${branch.startDate.toLocaleDateString()} - ${branch.endDate.toLocaleDateString()}`,
      `Merges: ${branch.mergeCount}`,
      '',
      'Key Commits:',
    ];
    for (const commit of branch.commits.slice(0, 10)) {
      lines.push(`  ${commit.hash.slice(0, 7)} ${commit.message} (${commit.author})`);
    }
    slides.push({ title: branch.branchName, lines });
  }

  // Conflict arcs
  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    for (const conflict of narrative.conflictArcs) {
      const lines: string[] = [
        `Conflict: ${conflict.label}`,
        `Severity: ${conflict.severity}`,
        '',
        ...conflict.description.split('\n'),
      ];
      slides.push({ title: conflict.label, lines });
    }
  }

  // Merge storms
  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    for (const storm of narrative.mergeStorms) {
      const lines: string[] = [
        `Merge Storm: ${storm.description}`,
        `Branches involved: ${storm.branches.join(', ')}`,
        `Commits in storm: ${storm.commitCount}`,
      ];
      slides.push({ title: 'Merge Storm', lines });
    }
  }

  // Refactor hotspots
  if (narrative.refactorHotspots && narrative.refactorHotspots.length > 0) {
    for (const hotspot of narrative.refactorHotspots) {
      const lines: string[] = [
        `Hotspot: ${hotspot.label}`,
        `Frequency: ${hotspot.frequency}`,
        '',
        ...hotspot.description.split('\n'),
      ];
      slides.push({ title: 'Refactor Hotspot', lines });
    }
  }

  // Final slide
  slides.push({
    title: 'The End',
    lines: ['Your repository history is a story.', '', 'Thank you for listening.', 'Press any key to exit.'],
  });

  return slides;
}

function StoryApp({ narrative }: { narrative: Narrative }) {
  const { exit } = useApp();
  const [slideIndex, setSlideIndex] = useState(0);
  const slides = useRef(buildSlides(narrative));
  const [columns, rows] = useStdoutDimensions();

  useEffect(() => {
    if (slideIndex >= slides.current.length) {
      exit();
    }
  }, [slideIndex, exit]);

  useInput((_input, key) => {
    if (key.escape || (key.ctrl && _input === 'c')) {
      exit();
    } else {
      setSlideIndex((prev) => prev + 1);
    }
  });

  const currentSlide = slides.current[slideIndex] || slides.current[0];

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold backgroundColor="blue">
          {currentSlide.title}
        </Text>
      </Box>
      {currentSlide.lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      <Box marginTop={1}>
        <Text dimColor>
          Slide {slideIndex + 1} of {slides.current.length} — Press any key to continue, ESC to exit
        </Text>
      </Box>
    </Box>
  );
}

export async function interactiveStory(cwd: string): Promise<void> {
  const commitGraph: CommitGraph = await parseGitLog(cwd);
  const narrative: Narrative = buildNarrative(commitGraph);
  render(<StoryApp narrative={narrative} />);
}
