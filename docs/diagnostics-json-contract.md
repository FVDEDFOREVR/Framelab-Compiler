# Diagnostics JSON Contract

This document defines the machine-readable diagnostics payload emitted by the FrameLab CLI when `check` or `build` is run with `--diagnostics-format json` or `--json`.

Human-readable diagnostics are a separate formatting path and are not part of this contract.

## Stability

The JSON payload is intended for tooling, editor integrations, CI wrappers, and AI agents.

The contract is versioned with:

- `schema`
- `version`

Current values:

- `schema: "framelab-diagnostics"`
- `version: 1`

Future incompatible changes should use a new version number rather than silently changing field meanings.

## Top-Level Shape

```json
{
  "schema": "framelab-diagnostics",
  "version": 1,
  "diagnostics": [
    {
      "code": "VR-C2",
      "severity": "error",
      "message": "Expected at most one intent node, found 2.",
      "stage": "semantic",
      "source": {
        "file": "/absolute/path/to/input.fl",
        "span": {
          "start": { "line": 8, "col": 3 },
          "end": { "line": 8, "col": 3 }
        }
      }
    }
  ]
}
```

## Diagnostic Fields

Each diagnostic object includes:

- `code`
  - Stable rule or compiler code such as `VR-C2`, `PE-10`, or `RE-UNSUPPORTED-MOTION`
- `severity`
  - One of `error`, `warning`, or `info`
- `message`
  - Human-readable diagnostic text
- `stage`
  - The compiler stage that surfaced the diagnostic
  - Current values are `tokenize`, `parse`, `semantic`, `normalize`, and `emit`
- `source.file`
  - The source file path used by the compiler
- `source.span`
  - A source span object when available
  - `null` when the diagnostic has no precise source span

## Source Span Shape

When present, `source.span` has:

- `start.line`
- `start.col`
- `end.line`
- `end.col`

Current behavior by stage:

- tokenize diagnostics use a point span
- parse diagnostics use a point span
- semantic diagnostics use the validator span
- emitter diagnostics use provenance when available
- normalize diagnostics may use `null` span when no precise node span is available

## Intended Usage

Recommended consumer behavior:

- key off `schema` and `version` first
- branch on `severity` and `stage`
- treat `code` as the stable machine identifier
- treat `message` as display text, not as the primary key
- handle `source.span === null` explicitly

## Non-Goals

This contract does not define:

- human-readable stderr formatting
- build artifact event output such as `WROTE ...`
- watch-mode event output such as `WATCH ...` or `CHANGE ...`
