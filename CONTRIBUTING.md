# Contributing

## Scope

This repository contains the FrameLab compiler source code. Contributions should stay focused on compiler behavior, runtime support, parsing, emitting, and tests.

## Getting Started

Requirements:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

Build the project:

```bash
npm run build
```

Run the current test entrypoint:

```bash
npm test
```

## Project Layout

- `src/tokenizer.ts`: lexical analysis
- `src/parser.ts`: parsing logic
- `src/ast.ts`: AST definitions
- `src/emitter-react.ts`: React-oriented code generation
- `src/runtime/`: runtime support code
- `src/test.ts`: test entrypoint

## Contribution Guidelines

- Keep changes scoped to the problem being solved.
- Preserve existing project style and naming unless there is a clear reason to refactor.
- Add or update tests when changing compiler behavior.
- Do not commit generated artifacts or dependency directories.
- Update documentation when changing developer workflow or language behavior.

## Pull Requests

Before opening a pull request:

1. Run `npm run build`.
2. Run `npm test`.
3. Summarize the behavioral change clearly in the PR description.
4. Call out parser, emitter, or runtime compatibility implications if relevant.

## Issues

When reporting a bug, include:

- The input `.fl` source
- The expected output or behavior
- The actual output or error
- Steps to reproduce
