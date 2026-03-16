# Milestone 12 Notes

Milestone 12 hardens the machine-readable diagnostics contract without changing validation semantics or rule codes.

JSON diagnostics contract:

- `check` and `build` emit JSON diagnostics on stderr when run with `--diagnostics-format json` or `--json`.
- The payload is a versioned envelope:
  - `schema: "framelab-diagnostics"`
  - `version: 1`
  - `diagnostics: [...]`
- Each diagnostic object includes:
  - `code`
  - `severity`
  - `message`
  - `stage`
  - `source.file`
  - `source.span`

Span behavior:

- `source.span` is present when the compiler has a precise source location.
- `source.span` is `null` when a stage cannot provide a precise span.
- Current point-like diagnostics still use full span objects with identical `start` and `end`.

Separation of concerns:

- Compiler stages produce normalized diagnostic data.
- Human-readable diagnostics formatting remains separate from JSON serialization.
- The CLI chooses the output format but does not own validation or rule semantics.

Tests added in this milestone:

- representative parse-error JSON payload
- representative semantic-error JSON payload
- representative emitter-warning JSON payload
- schema and version locking for the machine-readable envelope

Deferred items:

- No machine-readable stream yet for non-diagnostic CLI events such as `WROTE`, `BUILD OK`, `WATCH`, or `CHANGE`.
- No richer span metadata beyond file and line/column span coordinates.
