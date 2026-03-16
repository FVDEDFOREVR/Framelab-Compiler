# Milestone 8 Notes

Milestone 8 adds golden end-to-end regression coverage for the full compiler pipeline by exercising the built CLI against readable fixture directories.

Golden fixture structure:

- End-to-end cases live under `fixtures/e2e/<case>/`.
- Each case contains one `input.fl` source file and a `golden/` directory.
- `golden/` stores command-by-command results:
  - `check.status.txt`
  - `check.stdout.txt`
  - `check.stderr.txt`
  - `inspect.ast.*`
  - `inspect.analyzed.*`
  - `inspect.ir.*`
  - `build.status.txt`
  - `build.stdout.txt`
  - `build.stderr.txt`
  - `build/` emitted artifacts such as `.tsx`, `.module.css`, and `tokens.css`
- Golden command text normalizes environment-specific absolute paths into `<INPUT>` and `<OUT_DIR>` placeholders so the checked-in files stay deterministic across machines.

Update workflow:

- Normal test runs verify goldens only; they do not rewrite fixtures.
- Intentional updates are done by rebuilding and running:
  `UPDATE_E2E_GOLDENS=1 npm test`
- That update path rewrites the command output goldens and refreshes the `golden/build/` artifact directory from actual CLI output.
- Because each command result and each emitted artifact is stored as a separate readable file, fixture diffs stay reviewable instead of collapsing into opaque snapshots.

What is intentionally locked down:

- CLI exit status, stdout, and stderr for `check`, `build`, and `inspect`.
- AST, analyzed-model, and IR inspect output as emitted by the CLI.
- Emitted React artifacts exactly as written by build mode, including `tokens.css` when present.
- Unsupported-output warnings such as motion are locked down in both `check` and `build` diagnostics.
- Failure-path behavior is locked down as well: semantic-error fixtures verify that later stages do not produce analyzed/IR/build output and that diagnostics remain stable.

Current golden cases:

- `01-button-valid`: successful full pipeline with tokens and emitted React artifacts.
- `02-motion-warning`: successful build with explicit unsupported-motion warnings.
- `03-semantic-error`: semantic failure case for duplicate intent diagnostics and stage stopping behavior.
