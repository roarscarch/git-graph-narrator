import React, { useState, useEffect, useCallback } from 'react';
import { render, Text, Box, useInput, useApp } from 'ink';
import { Narrative } from './narrator.js';
import { renderNarrative, OutputFormat } from './output.js';

interface SlideConfig {
  intervalMs?: number;
  autoPlay?: boolean;
}

interface SlideState {
  currentSlide: number;
  totalSlides: number;
  slides: string[];
}

export function generateSlides(narrative: Narrative): string[] {
  const paragraphs = renderNarrative(narrative, OutputFormat.PLAIN).split('\n\n').filter(p => p.trim().length > 0);
  const slides: string[] = [];
  let buffer = '';
  for (const p of paragraphs) {
    if (buffer.length + p.length > 800) {
      slides.push(buffer.trim());
      buffer = p + '\n\n';
    } else {
      buffer += p + '\n\n';
    }
  }
  if (buffer.trim().length > 0) {
    slides.push(buffer.trim());
  }
  if (slides.length === 0) {
    slides.push('No narrative content.');
  }
  return slides;
}

const SlideView: React.FC<{ slides: string[]; config?: SlideConfig }> = ({ slides, config }) => {
  const [current, setCurrent] = useState(0);
  const { exit } = useApp();

  useInput((input, key) => {
    if (key.leftArrow || key.upArrow || input === 'p') {
      setCurrent(prev => Math.max(0, prev - 1));
    }
    if (key.rightArrow || key.downArrow || input === 'n') {
      setCurrent(prev => Math.min(slides.length - 1, prev + 1));
    }
    if (input === 'q' || key.escape || input === 'x') {
      exit();
    }
  });

  useEffect(() => {
    if (!config?.autoPlay || config.intervalMs === undefined) return;
    const timer = setInterval(() => {
      setCurrent(prev => {
        if (prev >= slides.length - 1) {
          exit();
          return prev;
        }
        return prev + 1;
      });
    }, config.intervalMs);
    return () => clearInterval(timer);
  }, [config?.autoPlay, config?.intervalMs, slides.length, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold italic>Git Graph Narrator - Slide {current + 1} of {slides.length}</Text>
      <Box marginTop={1}>
        <Text>{slides[current]}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Arrow keys or n/p to navigate, q to quit
          {config?.autoPlay ? ` (auto-advance every ${config.intervalMs}ms)` : ''}
        </Text>
      </Box>
    </Box>
  );
};

export function launchSlides(narrative: Narrative, config?: SlideConfig): void {
  const slides = generateSlides(narrative);
  const { waitUntilExit } = render(<SlideView slides={slides} config={config} />);
  waitUntilExit();
}
