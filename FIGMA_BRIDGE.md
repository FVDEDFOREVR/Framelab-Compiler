# Figma to FrameLab Bridge v0.1

This document defines the first narrow bridge from Figma into FrameLab.

It is a documentation and contract milestone only. It does not define a plugin, and it does not make Figma the source of truth.

The bridge is intentionally limited to the current FrameLab supported subset described in [SUPPORTED.md](/Users/tars/Desktop/framelab-compiler/SUPPORTED.md).

## Purpose

The bridge exists to carry architecture-relevant design data from Figma into a FrameLab draft that a human or AI can finish and validate.

The bridge does not replace FrameLab authoring.

## Source of Truth

- Figma is a source of design hints and structured export data.
- FrameLab source remains the compiler input and the reviewed source of truth.
- The bridge output is a draft, not a final compiler artifact.

## Minimal Data Figma Should Contribute

The bridge should stay narrow and export only data that maps cleanly to the current supported subset.

### Tokens

Figma may contribute:

- color tokens
- spacing tokens
- radius tokens
- typography size tokens
- simple shadow/depth tokens when already represented as named design tokens

The bridge should export token names and token values, not inferred semantics.

### Component Names

Figma may contribute:

- component name
- optional component group or library namespace

The bridge should preserve the explicit component name rather than inventing one.

### Variant Axes

Figma may contribute:

- variant axis name
- variant values
- default variant value when obvious from the main component or default instance

The bridge should only export explicit variant axes already represented in Figma variants.

### Slot Hints

Figma may contribute named slot hints when the design clearly contains replaceable regions such as:

- thumbnail
- icon
- actions
- trailing

Slot hints should be exported as names only. Requiredness and fallback content still belong to FrameLab authoring.

### Layout Hints

Figma may contribute:

- root node kind hint: `surface` or `stack`
- stack direction
- stack gap token hint
- align hint
- justify hint
- wrap hint
- obvious nested stack boundaries

The bridge should prefer explicit layout structure over pixel-perfect flattening.

### Semantic Annotations

Figma may contribute explicit semantic hints only when they are directly annotated or structurally obvious, such as:

- surface role hint like `article`
- text role hint like heading, body, label, caption
- slot label metadata

The bridge should not infer product semantics from visual appearance alone.

## What Remains FrameLab Responsibility

The following stay outside the Figma contribution boundary and must be authored or reviewed in FrameLab:

- intent semantics such as trigger, navigate, submit, and identifiers
- accessibility policy such as ARIA labeling strategy and role policy
- compiler constraints and validation correctness
- runtime behavior
- emitted target behavior
- warning acceptance or removal decisions
- repair decisions driven by diagnostics JSON

Figma may suggest structure. FrameLab must define behavior.

## Minimal Intermediate Draft Format

The first bridge should target a small JSON draft format that can be turned into `.fl` by a later tool or by an AI prompt workflow.

Example shape:

```json
{
  "schema": "framelab-figma-bridge",
  "version": 1,
  "tokens": [
    { "path": "color.action.primary", "value": "#4a7cff" },
    { "path": "space.gap.sm", "value": "10px" }
  ],
  "component": {
    "name": "Button",
    "variants": [
      { "axis": "tone", "values": ["primary", "ghost", "danger"], "default": "primary" }
    ],
    "slotHints": [],
    "layout": {
      "kind": "surface",
      "children": [
        {
          "kind": "text",
          "roleHint": "label",
          "contentHint": "label-text"
        }
      ]
    },
    "semanticHints": {
      "surfaceRole": null
    }
  }
}
```

Bridge draft format rules:

- `schema` and `version` are required
- token values are literal exported values, not compiler-ready token policy
- `layout` is structural and recursive
- `slotHints` are names only
- semantic hints are optional and non-authoritative

## Mapping Rules

The bridge should map only to currently supported FrameLab concepts:

- Figma component frame -> `component`
- named design tokens -> `tokens`
- auto-layout row/column -> `stack`
- styled container -> `surface`
- text layer -> `text`
- replaceable region marker -> `slot` hint
- variant property set -> `variant` axis

The bridge should not map directly to:

- React elements
- DOM event handlers
- accessibility policy
- runtime motion systems
- form-control semantics

## Example Mappings

### 1. Button

Figma contributes:

- component name: `Button`
- variant axis: `tone = primary | ghost | danger`
- root styled container
- one text layer for the label
- token references for fill, radius, padding, and type size

FrameLab still adds:

- `intent trigger: "button-action"`
- accessible label policy
- exact prop declarations such as `label-text`

Bridge draft result:

- `component.name = "Button"`
- one `surface` root hint
- one `text` child hint
- one `tone` variant axis

### 2. ProductCard

Figma contributes:

- component name: `ProductCard`
- outer card surface
- vertical stack structure
- nested text stack
- slot hints for `thumbnail` and `actions`
- article-like semantic hint if explicitly annotated

FrameLab still adds:

- `intent navigate: "product-detail"`
- accessible label policy from `title-text`
- exact prop names for `title-text`, `category-text`, and `price-text`

Bridge draft result:

- `component.name = "ProductCard"`
- `slotHints = ["thumbnail", "actions"]`
- root `surface` with nested vertical `stack`

### 3. Input

Figma contributes:

- component name: `Input`
- variant axis: `tone = default | danger`
- root container surface
- vertical stack of label, value, and hint text
- outline and fill token hints

FrameLab still adds:

- accessible label and description
- explicit decision to keep the component presentational
- exact prop names such as `label-text`, `value-text`, and `hint-text`

Important current limit:

- the bridge must not treat this as a native form control export target
- current FrameLab support only covers presentational emitted behavior here

## What The Bridge Must Not Do

The bridge must not:

- infer intent from visual affordance alone
- infer accessibility policy from layer names alone
- infer runtime motion support from prototype links
- convert Figma interactions directly into FrameLab runtime semantics
- assume Figma tokens are already valid FrameLab token paths
- output unsupported language constructs to chase full-spec coverage

## Recommended Workflow

1. Export the narrow bridge draft from Figma.
2. Convert or prompt from that draft into `.fl`.
3. Run `framelab check --diagnostics-format json`.
4. Repair the `.fl` source using diagnostics JSON if needed.
5. Run `framelab build`.

This keeps Figma as an input signal and FrameLab as the authored, validated source.

## Current Limits

This bridge contract is intentionally limited by the current supported subset:

- motion remains warning-only in the emitter
- `Input` remains presentational rather than native form behavior
- only the supported `surface` / `stack` / `text` / `slot` / `variant` / `state` / `accessible` / `intent` subset is in scope
- no plugin protocol, sync mechanism, or round-trip editing contract is defined here

That narrow scope is deliberate so the bridge can be implemented later without redesigning the compiler.
