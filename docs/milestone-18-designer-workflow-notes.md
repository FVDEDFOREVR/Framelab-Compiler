# Milestone 18 Notes

Milestone 18 defines the simplest first designer-facing workflow for FrameLab as a product workflow spec.

Primary artifact:

- [DESIGNER_WORKFLOW.md](/Users/tars/Desktop/framelab-compiler/DESIGNER_WORKFLOW.md)

## Why This Workflow Was Chosen

- It matches the current system reality: AI can draft, the compiler can validate and build, and the supported subset is narrow enough to describe honestly.
- It gives designers a believable path from intent to preview to handoff without forcing them to understand FrameLab internals.
- It keeps FrameLab source as the real authored input while still allowing the product surface to feel prompt-first and preview-first.
- It aligns with the existing AI loop and the narrow Figma bridge without requiring a new plugin, a new editor, or a redesigned language.

## What Is Intentionally Deferred

- a dedicated product UI implementation
- rich multi-screen or page-level workflows
- direct Figma plugin behavior
- automatic design-to-code parity claims outside the current supported subset
- native form-control workflows beyond presentational `Input`-style output
- runtime motion authoring
- exposing full compiler controls to designers

This milestone is a workflow contract, not a feature-complete product surface.

## What Still Feels Too Technical For Designers

Even with the workflow simplified, several parts of the current system are still too technical to expose directly:

- raw `.fl` authoring as the primary interaction
- CLI-oriented preview and build steps
- diagnostics-driven repair as an explicit user action
- token path authoring at compiler-source granularity
- intent and accessibility policy details when presented in compiler terms

For the first designer-facing workflow, those concerns should stay internal or be translated into design-oriented controls and language.

## Scope Boundary

The workflow is intentionally scoped to the current supported subset only.

That means the believable first workflow centers on component patterns already represented well in the repository, such as:

- `Button`
- `ProductCard`
- `NavItem`
- `Toast`

It does not yet claim a comfortable designer workflow for:

- native-form components
- animation-heavy components
- full application composition
- unsupported full-spec constructs
