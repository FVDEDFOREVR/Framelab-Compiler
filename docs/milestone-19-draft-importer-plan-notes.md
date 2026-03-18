# Milestone 19 Notes

Milestone 19 defines the first prototype plan for importing a Figma-like structured export into a FrameLab draft.

Primary artifact:

- [DRAFT_IMPORTER_PLAN.md](/Users/tars/Desktop/framelab-compiler/DRAFT_IMPORTER_PLAN.md)

## Prototype Scope

The prototype scope is intentionally narrow:

- accept one small structured JSON input shape
- preserve explicit component, slot, variant, layout, token, and semantic hints
- produce a draft that AI or a human can refine into valid `.fl`
- stay within the current supported subset only

This milestone does not implement the importer. It defines the smallest believable boundary for building it next.

## Out-Of-Scope Fields

The following are intentionally out of scope for the prototype:

- raw Figma file parsing
- plugin transport or authentication
- prototype links and interaction graphs
- inferred DOM behavior
- inferred accessibility policy
- motion systems
- page-level composition
- full fidelity styling translation from arbitrary design properties
- automatic finalization of intent blocks and accessible blocks

If the source export cannot express a field explicitly and structurally, the importer should usually leave it for later refinement rather than invent it.

## Likely Failure Points

The most likely places the prototype will fail or need manual cleanup are:

- token names that do not map cleanly to desired FrameLab token paths
- ambiguous layout structure where the export does not encode stack boundaries clearly
- text nodes whose intended prop names are unclear
- semantic hints that suggest behavior but do not provide enough information for valid intent or accessibility authoring
- inputs or other components that visually imply unsupported native behavior
- exports that include richer design-system concepts than the current supported subset can represent

These failure points are acceptable at prototype stage. The goal is to preserve useful structure and make the remaining gaps explicit.
