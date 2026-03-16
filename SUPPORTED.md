# FrameLab v0.1 Alpha Supported Subset

This document defines the currently supported FrameLab subset in this repository.

It describes implemented behavior only.

## Compiler Surface

Supported CLI commands:

- `check <file>`
- `build <file> [--out-dir <dir>]`
- `inspect --ast <file>`
- `inspect --analyzed <file>`
- `inspect --ir <file>`

`build` writes a flat output directory containing:

- `tokens.css` when token or theme declarations exist
- `<Component>.tsx` for each emitted component
- `<Component>.module.css` for each emitted component

## Supported Language Constructs

The current pipeline supports these constructs when they pass semantic validation:

- top-level `tokens`, `theme`, and `component` declarations
- component `prop` declarations
- component `variant` declarations with explicit value lists and optional defaults
- `accessible` blocks
- `intent` blocks
- `surface`
- `stack`
- `text`
- `slot`
- `state`
- `variant` overrides inside component bodies
- token references through `token(path.segment)`
- direct `@reference` usage where allowed by the frozen lex/parse contract

The current emitted subset is centered on component structures composed from:

- `surface`
- `stack`
- `text`
- slot placement
- variants
- states
- accessibility metadata
- token-backed styling

## Supported React Emission Behavior

Current React emission behavior is:

- one React function component per FrameLab component
- one CSS Module per FrameLab component
- one shared `tokens.css` file for token and theme output
- token references emitted as CSS variable usage: `var(--token-path)`
- `surface` emitted as host elements only at the emitter boundary
- `stack` emitted as a `div` with flexbox CSS
- `text` emitted as host text elements based on the current text-role mapping
- slots emitted as named `slots` props with inline fallback rendering
- variants emitted as `data-*` attributes plus CSS selectors
- built-in pseudo states mapped to CSS pseudo selectors where implemented
- other states emitted through a generated `states` prop bag and `data-state-*` attributes
- accessibility emitted through the current supported root or intent-wrapper ARIA/role mapping
- `intent` emitted through the current wrapper host mapping and generated props such as `href` or `onIntent` where applicable

Generated output is intended to be readable and deterministic. Golden tests lock down exact build output.

## Warning And Unsupported-Output Behavior

Current behavior for unsupported or deferred emission cases:

- tokenizer and parser failures stop the pipeline immediately
- semantic errors stop before normalization, IR build, and emission
- emitter warnings do not stop `check` or `build`
- diagnostics are written in a stable single-line format on stderr

Known unsupported-output warning behavior:

- motion declarations currently produce `RE-UNSUPPORTED-MOTION` warnings
- those motion declarations do not produce runtime animation behavior

## Known Limitations

The current implementation has these known limits:

- motion is not emitted beyond warnings
- `Input`-style components compile as presentational output, not native form controls
- emitted `intent` wrappers currently rely on consumer styling resets if browser default button or link styling is undesirable
- the compiler does not add watch mode, recursive directory builds, or alternate emit targets
- the supported subset should be treated as the emitted React/CSS behavior covered by the current tests and dogfooded demo, not as the full frozen language surface

## Recommended Developer Workflow

Recommended workflow in this repository:

1. run `npm run build`
2. run `npm test`
3. use `node dist/cli.js check <file>` while iterating on validity
4. use `node dist/cli.js inspect --ast|--analyzed|--ir <file>` when debugging pipeline stages
5. use `node dist/cli.js build <file> --out-dir <dir>` to inspect emitted artifacts directly

For the local demo integration in `framelab-demo`:

1. run `npm run framelab:build` in the demo repo to regenerate emitted artifacts
2. run `npm run build` in the demo repo to verify the full demo build

## Not Yet Supported

These behaviors are not part of the current supported contract:

- emitted runtime motion or animation systems
- native form-control emission inferred from presentational FrameLab structures
- directory-wide build orchestration, watch mode, or machine-readable diagnostics output
- support promises beyond the React/CSS subset already exercised by fixtures and the demo
