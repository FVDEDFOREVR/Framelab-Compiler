# Framelab Compiler

The compiler for **Framelab** — a design-first language that compiles executable design systems into production UI.

FrameLab explores a model where **design intent becomes the source of truth for interface architecture**, rather than static screens handed off to engineering.

Design intent → Framelab → Production UI


## What This Repository Contains

This repository contains the **FrameLab compiler**, which transforms Framelab `.fl` interface definitions into production UI components.

Current compiler targets:

- React

Future targets may include:

- Vue
- SwiftUI
- Web Components


## Compiler Architecture

The Framelab compiler follows a simple staged architecture:

```
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
Generates framework-specific UI components from the AST.  
The current implementation targets **React**, but other targets could be supported.

**Runtime**  
Provides lightweight primitives for signals, interaction state, and motion behavior used by compiled components.


---

This architecture allows Framelab to remain **framework-agnostic at the language level** while emitting production UI for specific platforms.


## Example Concept

A simple Framelab component definition might describe interface structure like this:

```
surface
stack
slot
state hover
motion shift
intent trigger
```

These declarations define UI architecture that the compiler converts into framework components.


## Development

Install dependencies:

`npm install`

Build the compiler:

`npm run build`

Run tests:

`npm test`


## Contributing

Contributions are welcome.

Please read **CONTRIBUTING.md** before submitting pull requests.


## License

Framelab is open source under the **Apache License 2.0**.

See the LICENSE file for details.
