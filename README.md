# Git Graph Narrator

> Your repo's history as a story

Generates a concise, human-readable story of your Git repository's evolution by analyzing commit messages, branching patterns, and merge strategies.

## Stack
- Language: **typescript**
- node:child_process, commander, ink

## Features
- Parses git log with custom formatting to extract commit DAG
- Ranks commits by impact via PageRank-like algorithm on merge edges
- Generates a multi-paragraph narrative with protagonist branches and conflict arcs
- Summarizes merge storms, long-lived branches, and refactor hotspots
- Outputs as plain text, markdown, or animated terminal slides

## Architecture
Uses a custom topological sort augmented with a 'narrative weight' heuristic — commit messages with imperative verbs and JIRA-style issue IDs are treated as plot points, while fast-forward merges are suppressed as scene transitions.

## Getting Started
```bash
# Coming soon — this project is under active development.
```

*Built fresh every day by an AI-powered automation pipeline.*
