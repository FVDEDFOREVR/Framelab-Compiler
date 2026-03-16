# Milestone 7 Notes

Milestone 7 adds the first usable CLI and a thin top-level workflow over the existing compiler phases.

Command surface:

- `check <file>` runs parse, semantic validation, normalization, IR build, and React emission planning, then reports diagnostics without writing files.
- `build <file> [--out-dir <dir>]` runs the full pipeline and writes emitted React artifacts to the requested output directory.
- `inspect --ast <file>` prints the parsed AST as formatted JSON.
- `inspect --analyzed <file>` prints the normalized analyzed model as formatted JSON.
- `inspect --ir <file>` prints the target-agnostic IR as formatted JSON.

Output layout:

- Build output is deterministic and flat within the selected output directory.
- Shared token output is written as `tokens.css` when token/theme declarations exist.
- Each component emits `<Component>.tsx` and `<Component>.module.css`.
- Build mode prints one `WROTE <absolute-path>` line per emitted artifact, followed by `BUILD OK <out-dir>`.

Diagnostic behavior:

- All diagnostics are written to stderr in a stable single-line format:
  `<file[:line:col]> <SEVERITY> <CODE> [<stage>] <message>`.
- Tokenizer and parser failures stop the pipeline immediately.
- Semantic errors stop before normalization/IR/emission.
- Emitter warnings are included in `check` and `build`, but do not block artifact generation.
- `inspect --ast` stops at parse; `inspect --analyzed` stops at normalization; `inspect --ir` stops at IR generation. Those inspect commands do not run later pipeline stages.

Deferred CLI features:

- No recursive directory builds, glob expansion, or watch mode yet.
- No configurable output format for diagnostics beyond the default human-readable lines.
- No separate machine-readable diagnostics stream yet.
- No alternative emit targets beyond the current React emitter.

Doc mismatch discovered:

- The frozen implementation plan sketches a broader compiler entrypoint and more mature pass breakdown than the current repository implements. This milestone keeps the CLI as a thin wrapper over the existing parser, validator, normalizer, IR builder, and React emitter instead of inventing new compiler stages or moving logic upward into the CLI.
