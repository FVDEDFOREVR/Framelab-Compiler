# Framelab Compiler

The compiler for **Framelab** — a design-first language that compiles executable design systems into production UI.

Framelab explores a model where design intent becomes the source of truth for interface architecture, rather than static screens handed off to engineering.

Framelab is an experimental design language exploring executable design systems and UI architecture.

Created by Daniel Hairston.

Design intent -> Framelab -> Production UI

## Current Status

This repository is an early-stage TypeScript compiler prototype for Framelab.

What currently exists:

- A tokenizer
- A parser
- An AST model
- A React emitter
- A runtime support layer
- A runnable end-to-end pipeline demo in `src/test.ts`

Current output target:

- React component source (`.tsx`)
- CSS Modules styles (`.module.css`)
- Optional token CSS output (`tokens.css`) when design tokens are present

What does not exist yet:

- A stable public CLI
- A formal language specification
- Multiple production emitter targets
- Comprehensive fixture-based test coverage

## What This Repository Contains

This repository contains the Framelab compiler, which transforms Framelab `.fl` interface definitions into production UI components.

Core areas:

- `src/tokenizer.ts`: lexical analysis
- `src/parser.ts`: parser implementation
- `src/ast.ts`: AST definitions
- `src/emitter-react.ts`: React and CSS Modules code generation
- `src/runtime/`: runtime primitives used by compiled output
- `src/test.ts`: end-to-end pipeline demonstration and assertions
- `example.fl`: sample Framelab source used by the current test flow

## Quickstart

Requirements:

- Node.js 18+
- npm

Install dependencies:

```bash
npm install
```

Build the TypeScript sources:

```bash
npm run build
```

Run the current end-to-end compiler demo:

```bash
npm test
```

Today, `npm test` compiles the TypeScript sources first via `npm run build`, then runs the generated `dist/test.js` pipeline against `example.fl`. The script tokenizes the source, parses it into an AST, emits React/CSS output, and asserts that expected structures were generated.

## Example Flow

The current sample input is:

```text
component HelloCard {
  surface {
    fill:    token(surface.raised)
    radius:  token(radius.card)
    padding: token(space.inset.md)

    state hover {
      depth:  4
      motion: shift(token(duration.quick), token(ease.lift))
    }

    stack(direction: vertical, gap: token(space.gap.md)) {
      text as heading {
        level:   2
        content: "Hello, FRAMELAB"
        color:   token(color.text.primary)
        weight:  semibold
      }

      text as body {
        content: "A design-first language that compiles to React."
        color:   token(color.text.secondary)
      }
    }
  }
}
```

From that source, the current pipeline produces generated artifacts such as:

- `HelloCard.tsx`
- `HelloCard.module.css`
- `tokens.css` when token definitions are emitted

The current test asserts that the generated React output includes component structure, hover interaction wiring, semantic heading/body tags, and CSS Module references, while the generated CSS includes layout classes, motion transitions, hover selectors, and token-backed custom properties.

## Compiler Architecture

The Framelab compiler currently follows a staged architecture:

```text
FrameLab source (.fl)
        ↓
Tokenizer
        ↓
Parser
        ↓
AST (Abstract Syntax Tree)
        ↓
Emitter
        ↓
Framework Components (React)
```

### Stages

**Tokenizer**  
Converts raw `.fl` source into tokens used by the parser.

**Parser**  
Transforms tokens into an AST representing the structure of the interface.

**AST**  
A structured representation of Framelab components, layout primitives, states, motion rules, and design tokens.

**Emitter**  
Generates framework-specific UI components from the AST. The current implementation targets React, but other targets could be supported later.

**Runtime**  
Provides lightweight primitives for signals, interaction state, and motion behavior used by compiled components.

This architecture keeps Framelab framework-agnostic at the language level while still allowing concrete framework output.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run the current pipeline test:

```bash
npm test
```

## Roadmap

Near-term areas that would make this repository substantially more complete:

- A real CLI entrypoint for compiling `.fl` files
- More language examples and fixtures
- Broader parser and emitter test coverage
- Additional emitter targets beyond React
- Clear token/theme authoring conventions
- A documented Framelab language reference

## Contributing

Contributions are welcome.

Please read `CONTRIBUTING.md` before submitting pull requests.

## License

Framelab is open source under the Apache License 2.0.

See `LICENSE` for details. See `NOTICE` for attribution information.
