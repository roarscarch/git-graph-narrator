import React, { useState, useEffect, useRef } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import { Narrative } from './narrator.js';
import { renderNarrative, OutputFormat } from './output.js';

/**
 * Display a narrative as an animated slideshow in the terminal.
 * Each paragraph fades in one word at a time, with keyboard navigation.
 */
export function playSlideShow(narrative: Narrative): void {
  const { waitUntilExit } = render(<SlideShow narrative={narrative} />);
  waitUntilExit();
}

// ─── SlideShow Component ───────────────────────────────────────────────────

interface Slide {
  title: string;
  lines: string[];
}

function buildSlides(narrative: Narrative): Slide[] {
  const slides: Slide[] = [];

  // Title slide
  slides.push({
    title: narrative.title,
    lines: [narrative.summary],
  });

  // One slide per protagonist branch
  for (const branch of narrative.protagonistBranches) {
    const lines: string[] = [];
    lines.push(`Branch: ${branch.branchName}`);
    lines.push(`Commits: ${branch.commits.length}, Merges: ${branch.mergeCount}`);
    lines.push(`Lifespan: ${branch.startDate.toLocaleDateString()} – ${branch.endDate.toLocaleDateString()}`);
    if (branch.authorDiversity !== undefined) {
      lines.push(`Author Diversity: ${branch.authorDiversity.toFixed(2)}`);
    }
    slides.push({ title: branch.branchName, lines });
  }

  // Conflict arcs
  if (narrative.conflictArcs && narrative.conflictArcs.length > 0) {
    for (const conflict of narrative.conflictArcs) {
      const lines: string[] = [];
      lines.push(`Conflict: ${conflict.description}`);
      lines.push(`Branches: ${conflict.branches.join(', ')}`);
      lines.push(`Resolved in: ${conflict.resolutionHash || 'unresolved'}`);
      slides.push({ title: `Conflict: ${conflict.description}`, lines });
    }
  }

  // Merge storms
  if (narrative.mergeStorms && narrative.mergeStorms.length > 0) {
    for (const storm of narrative.mergeStorms) {
      const lines: string[] = [];
      lines.push(`Merge Storm`);
      lines.push(`Period: ${storm.startDate.toLocaleDateString()} – ${storm.endDate.toLocaleDateString()}`);
      lines.push(`Merges: ${storm.mergeCount}`);
      lines.push(`Branches involved: ${storm.branches.join(', ')}`);
      slides.push({ title: 'Merge Storm', lines });
    }
  }

  // Refactor hotspots
  if (narrative.refactorHotspots && narrative.refactorHotspots.length > 0) {
    for (const hotspot of narrative.refactorHotspots) {
      const lines: string[] = [];
      lines.push(`Refactor Hotspot: ${hotspot.filePath}`);
      lines.push(`Changes: ${hotspot.changeCount}`);
      lines.push(`Authors: ${hotspot.authors.join(', ')}`);
      slides.push({ title: `Hotspot: ${hotspot.filePath}`, lines });
    }
  }

  return slides;
}

// ─── Typewriter effect ─────────────────────────────────────────────────────

function useTypewriter(text: string, speed: number = 30): string {
  const [displayed, setDisplayed] = useState('');
  const indexRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current > text.length) {
        clearInterval(interval);
        return;
      }
      setDisplayed(text.slice(0, indexRef.current));
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

// ─── SlideShow Component ───────────────────────────────────────────────────

const SlideShow: React.FC<{ narrative: Narrative }> = ({ narrative }) => {
  const slides = useRef(buildSlides(narrative));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animationDone, setAnimationDone] = useState(false);
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    if (key.rightArrow || input === ' ' || input === 'n') {
      if (currentSlide < slides.current.length - 1) {
        setCurrentSlide((prev) => prev + 1);
        setAnimationDone(false);
      }
    }
    if (key.leftArrow || input === 'p') {
      if (currentSlide > 0) {
        setCurrentSlide((prev) => prev - 1);
        setAnimationDone(false);
      }
    }
    if (key.return) {
      setAnimationDone(true);
    }
  });

  const slide = slides.current[currentSlide];
  const fullText = slide.lines.join('\n');
  const animatedText = useTypewriter(fullText, 20);

  // When animation finishes, mark done
  useEffect(() => {
    if (animatedText.length >= fullText.length) {
      setAnimationDone(true);
    }
  }, [animatedText, fullText]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{slide.title}</Text>
      <Text> </Text>
      <Text>{animatedText}</Text>
      {animationDone && (
        <Text dimColor>Press → for next slide, ← for previous, ⏎ to skip animation, q to quit</Text>
      )}
    </Box>
  );
};
