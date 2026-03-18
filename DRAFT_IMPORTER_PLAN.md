# Draft Importer Plan v0.1

This document defines the first prototype path for importing a Figma-like structured export into a FrameLab draft.

It is a planning milestone only. It does not define a Figma plugin, a production importer, or a full roundtrip workflow.

The importer plan is intentionally limited to the current supported subset described in [SUPPORTED.md](/Users/tars/Desktop/framelab-compiler/SUPPORTED.md).

## Goal

Accept a small structured JSON export and turn it into a draft that is close enough for AI or a human to finish inside the current FrameLab subset.

The prototype importer should solve one narrow problem:

- convert explicit structure and token hints into a draftable FrameLab-shaped representation

It should not try to solve:

- behavior inference
- accessibility policy inference
- full Figma fidelity
- automatic final `.fl` correctness without refinement

## Prototype Output Boundary

The importer should produce a draft, not a final reviewed compiler input.

That draft may be either:

- a partial `.fl` draft
- or an intermediate JSON draft ready for AI-assisted conversion into `.fl`

For this milestone, the recommended target is an intermediate JSON draft because it keeps the prototype narrow and explicit about gaps.

## Minimal JSON Input Shape

The prototype importer should accept one small JSON shape:

```json
{
  "schema": "framelab-draft-import",
  "version": 1,
  "tokens": [
    { "path": "surface.raised", "value": "#18181c" },
    { "path": "space.gap.md", "value": "16px" },
    { "path": "type.lg", "value": "22px" }
  ],
  "component": {
    "name": "ProductCard",
    "variants": [
      { "axis": "tone", "values": ["default", "featured"], "default": "default" }
    ],
    "slots": [
      { "name": "thumbnail" },
      { "name": "actions" }
    ],
    "layout": {
      "kind": "surface",
      "props": {
        "fillToken": "surface.raised",
        "radiusToken": "radius.card",
        "paddingToken": "space.inset.md"
      },
      "children": [
        {
          "kind": "stack",
          "props": {
            "direction": "vertical",
            "gapToken": "space.gap.md"
          },
          "children": [
            { "kind": "slot", "name": "thumbnail" },
            {
              "kind": "stack",
              "props": {
                "direction": "vertical",
                "gapToken": "space.gap.sm"
              },
              "children": [
                {
                  "kind": "text",
                  "contentHint": "category-text",
                  "props": {
                    "sizeToken": "type.xs",
                    "textColorToken": "color.text.muted"
                  }
                },
                {
                  "kind": "text",
                  "contentHint": "title-text",
                  "props": {
                    "sizeToken": "type.lg",
                    "textColorToken": "color.text.primary"
                  }
                },
                {
                  "kind": "text",
                  "contentHint": "price-text",
                  "props": {
                    "sizeToken": "type.sm",
                    "textColorToken": "color.text.primary"
                  }
                }
              ]
            },
            { "kind": "slot", "name": "actions" }
          ]
        }
      ]
    },
    "semanticHints": {
      "surfaceRole": "article",
      "primaryLabelField": "title-text"
    }
  }
}
```

## Required Fields

- `schema`
- `version`
- `component.name`
- `component.layout.kind`
- `component.layout.children`

## Optional But Supported Fields

- `tokens`
- `component.variants`
- `component.slots`
- `layout.props`
- `text.contentHint`
- `component.semanticHints`

## Mapping Rules

### Component Name

Input:

- `component.name`

Importer behavior:

- preserve the explicit component name
- do not invent a different name
- reject or flag names that are empty or obviously malformed

What still needs refinement later:

- exact prop declarations inferred from text content hints
- final naming cleanup if source data uses design-system-only naming

### Slots

Input:

- `component.slots`
- `layout.children` nodes with `kind: "slot"`

Importer behavior:

- map each explicit slot name into a slot hint in the draft
- preserve slot order from the layout tree
- do not infer requiredness
- do not infer fallback content

What still needs refinement later:

- whether the slot should be optional or required
- whether any slot needs typed content hints beyond the prototype

### Variants

Input:

- `component.variants`

Importer behavior:

- map explicit axis names and values into draft variant axes
- preserve explicit default when supplied
- do not invent variant axes from styling differences alone

What still needs refinement later:

- whether the variant names fit FrameLab authoring conventions
- whether body-level variant overrides should be added in `.fl`

### Layout Hints

Input:

- recursive `layout`
- supported `kind` values: `surface`, `stack`, `text`, `slot`

Importer behavior:

- `surface` maps to a draft surface root or nested surface
- `stack` maps to stack structure with explicit direction and gap hints when present
- `text` maps to a text node with content and token hints
- `slot` maps to a named slot position in the tree

Prototype limits:

- only explicit nested structure should be imported
- no pixel-based auto-inference of stacks from arbitrary coordinates
- no flattening into final FrameLab props beyond obvious supported mappings

What still needs refinement later:

- exact text weights or role decisions when the export does not specify them clearly
- any unsupported structures that need simplification before valid `.fl`

### Token References

Input:

- `tokens`
- token-valued fields in `layout.props` or text props such as `fillToken`, `gapToken`, `sizeToken`

Importer behavior:

- preserve explicit token paths as token hints
- include literal token values in the draft input when they are exported
- do not rename tokens automatically
- do not assume all external token paths are valid final FrameLab token policy

What still needs refinement later:

- token normalization if export naming does not match desired FrameLab naming
- removal or replacement of token references that do not fit the current subset cleanly

### Semantic Hints

Input:

- `component.semanticHints`

Supported prototype fields:

- `surfaceRole`
- `primaryLabelField`
- optional text-level role hints if explicitly present in the export

Importer behavior:

- preserve explicit semantic hints as non-authoritative guidance
- do not convert them directly into final intent policy
- do not infer accessibility behavior from visual structure alone

What still needs refinement later:

- accessible block content
- intent kind and identifier
- final label and description policy

## What The Importer Can Infer

The prototype importer may infer only small structural conveniences:

- if the root node is `surface`, treat it as the component root hint
- if a `stack` explicitly declares direction, preserve it directly
- if a `text` node has a `contentHint`, treat that as a likely prop hint
- if a slot name appears both in `component.slots` and in the tree, preserve the tree position and keep the explicit slot list

These are safe structural inferences because they stay inside the current supported subset and do not invent behavior.

## What AI Or A Human Must Refine

After import, AI or a human still needs to refine:

- exact `.fl` syntax
- prop declarations
- intent blocks
- accessible blocks
- final token naming cleanup
- unsupported or ambiguous structures
- any compiler validation failures

The importer should be judged by whether it gives refinement a strong starting point, not by whether it solves authoring end to end.

## Concrete Example Mapping

### ProductCard

Structured export input:

```json
{
  "schema": "framelab-draft-import",
  "version": 1,
  "tokens": [
    { "path": "surface.raised", "value": "#18181c" },
    { "path": "radius.card", "value": "18px" },
    { "path": "space.inset.md", "value": "20px 22px" },
    { "path": "space.gap.md", "value": "16px" },
    { "path": "space.gap.sm", "value": "10px" },
    { "path": "type.xs", "value": "12px" },
    { "path": "type.sm", "value": "14px" },
    { "path": "type.lg", "value": "22px" },
    { "path": "color.text.primary", "value": "#f0ede8" },
    { "path": "color.text.muted", "value": "#a09b94" }
  ],
  "component": {
    "name": "ProductCard",
    "slots": [
      { "name": "thumbnail" },
      { "name": "actions" }
    ],
    "layout": {
      "kind": "surface",
      "props": {
        "fillToken": "surface.raised",
        "radiusToken": "radius.card",
        "paddingToken": "space.inset.md"
      },
      "children": [
        {
          "kind": "stack",
          "props": {
            "direction": "vertical",
            "gapToken": "space.gap.md"
          },
          "children": [
            { "kind": "slot", "name": "thumbnail" },
            {
              "kind": "stack",
              "props": {
                "direction": "vertical",
                "gapToken": "space.gap.sm"
              },
              "children": [
                {
                  "kind": "text",
                  "contentHint": "category-text",
                  "props": {
                    "sizeToken": "type.xs",
                    "textColorToken": "color.text.muted"
                  }
                },
                {
                  "kind": "text",
                  "contentHint": "title-text",
                  "props": {
                    "sizeToken": "type.lg",
                    "textColorToken": "color.text.primary"
                  }
                },
                {
                  "kind": "text",
                  "contentHint": "price-text",
                  "props": {
                    "sizeToken": "type.sm",
                    "textColorToken": "color.text.primary"
                  }
                }
              ]
            },
            { "kind": "slot", "name": "actions" }
          ]
        }
      ]
    },
    "semanticHints": {
      "surfaceRole": "article",
      "primaryLabelField": "title-text"
    }
  }
}
```

Importer output intent:

- component name becomes `ProductCard`
- slot hints become `thumbnail` and `actions`
- root structure becomes `surface -> stack -> text/slot`
- token references remain explicit token hints
- semantic hints remain draft metadata, not final behavior

What still happens after import:

- AI or a human adds prop declarations for `title-text`, `category-text`, and `price-text`
- AI or a human adds `intent navigate: "product-detail"` if that behavior is desired
- AI or a human adds the accessible label strategy
- the compiler validates the final `.fl` source and repair may still be needed

## Prototype Success Criteria

The prototype importer is successful if it can:

- accept a small explicit structured export
- preserve component name, variants, slots, layout hints, token hints, and semantic hints
- produce a draft shape that is easy for AI or a human to finish
- stay honest about unsupported gaps

The prototype importer is not required to:

- generate final clean `.fl` every time
- infer behavior or semantics from visual appearance
- roundtrip arbitrary Figma files
- capture full design fidelity
