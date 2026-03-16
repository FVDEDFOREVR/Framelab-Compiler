# Milestone 9: FrameLab Demo Dogfooding Notes

Milestone 9 integrated the compiler into the local `framelab-demo` workflow and replaced a small fixed set of hand-authored demo UI with emitted FrameLab artifacts.

## Demo Workflow

The demo now builds generated UI through a thin wrapper script in the demo repo:

1. build the compiler with `npm run build` in `framelab-compiler`
2. run the compiler CLI on `src/framelab/demo.fl`
3. write emitted artifacts to `src/generated`
4. continue with the demo TypeScript and Vite build

The demo exposes that through:

- `npm run framelab:build`
- `npm run build`

`npm run build` is now the reproducible top-level path for the dogfood flow.

## Components Converted

The demo now consumes emitted artifacts for:

- `Button`
- `ProductCard`
- `Input`
- `NavItem`
- `Toast`

All five compile from a single `src/framelab/demo.fl` input and are imported from `src/generated`.

## What Converted Cleanly

- Surface, stack, text, variants, states, slots, accessibility metadata, and token-backed CSS variable output all worked well enough to replace the selected hand-authored demo components.
- `Button`, `ProductCard`, and `NavItem` mapped cleanly into the current React emitter subset.
- Slot placement for thumbnail, actions, and icon/action affordances was usable without compiler changes.

## Workarounds And Friction

- `Toast` intentionally keeps a `motion enter` declaration and currently emits `RE-UNSUPPORTED-MOTION`. The demo accepts that warning and ships without runtime motion instead of hiding it with a custom animation path.
- `Input` compiles as a presentational structure, not a native `<input>`. The demo uses it as a visual field representation rather than inventing native form behavior in the emitter.
- Intent wrappers currently emit an empty `.intent {}` rule. The demo adds a small global button reset in app CSS so generated button-like wrappers do not pick up unwanted browser chrome.
- Token paths had to stay inside the existing language rules. Numeric-looking token path segments used in design shorthand were rewritten into named segments such as `depth.rest` and `depth.soft`.
- Duration/easing values that are not plain identifiers or numeric dimensions were kept as quoted symbolic token values in the `.fl` source.

## Future Compiler Work

- Emitter support for the currently-declared motion subset, or clearer structured output for deferred motion handling.
- Better default styling resets for host elements introduced by `intent` mapping, so demo apps do not need to compensate for browser button/link defaults.
- More deliberate host mapping for form-like components where the frozen spec already provides enough information to do so safely.
- Continued compatibility hardening for emitted TypeScript/React signatures across consumer TS configs.

## Future Language Work

- If FrameLab needs true form controls rather than presentational field compositions, that should be added explicitly at the language/spec layer instead of inferred from current `surface` and `text` constructs.
- If design token naming should support additional shorthand patterns, that belongs in the language contract and parser rules rather than demo-local exceptions.

## Scope Boundary Confirmed By Dogfooding

The demo integration stayed thin:

- no validation moved into the demo
- no emitter logic moved into the demo
- no IR or language rules were broadened to make the demo pass

Unsupported cases stayed visible as warnings or explicit workarounds.
