# Framelab-Compiler
The compiler for Framelab — a design-first language that compiles executable design systems into production UI.

## Compiler Architecture

The FrameLab compiler follows a simple staged architecture:

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
A structured representation of FrameLab components, layout primitives, states, and motion rules.

**Emitter**
Generates framework-specific UI components from the AST.
The current implementation targets **React**, but other targets could be supported.

**Runtime**
Provides lightweight primitives for signals, interaction state, and motion behavior used by compiled components.

---

This architecture allows FrameLab to remain **framework-agnostic at the language level** while emitting production UI for specific platforms.
