# Milestone 11 Notes

Milestone 11 extends the CLI for day-to-day development without moving compiler logic into the CLI layer.

Watch mode behavior:

- `check` and `build` now accept `--watch`.
- Watch mode observes the parent directory of the requested input file and reruns only when the selected file changes.
- The watch runner debounces rapid file-system events into a single rerun.
- Watch mode prints `WATCH <absolute-path>` when it starts and `CHANGE <absolute-path>` before each rerun triggered by file changes.
- The underlying pipeline stays the same: watch mode reuses the normal `check` or `build` command path for each cycle.

Human diagnostics format:

- `check` and `build` default to a human-readable stderr format.
- Each diagnostic is emitted as a stable multi-line block:
  - `<SEVERITY> <CODE> [<stage>]`
  - `  at <file[:line:col]>`
  - `  <message>`
- This keeps diagnostics easier to scan while remaining deterministic in tests and golden files.

Machine-readable diagnostics format:

- `check` and `build` accept `--diagnostics-format json`.
- `--json` is supported as a shorthand alias for `--diagnostics-format json`.
- JSON diagnostics are written to stderr as:
  - `{ "diagnostics": [ ... ] }`
- Each diagnostic object preserves the existing compiler fields:
  - `severity`
  - `code`
  - `message`
  - `file`
  - `line`
  - `col`
  - `stage`

Deferred workflow features:

- No recursive or multi-file watch mode yet.
- No watch mode for `inspect`.
- No machine-readable output stream for `build` artifact events yet; only diagnostics have a JSON mode.
- No alternate emit targets or workflow orchestration beyond the existing single-file compiler pipeline.
