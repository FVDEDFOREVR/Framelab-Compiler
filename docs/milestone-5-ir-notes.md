# Milestone 5 Notes

Milestone 5 adds a target-agnostic IR layer and a builder that consumes the normalized analyzed model from milestone 4.

Analyzed model to IR mapping:

- `AnalyzedProgram` is lowered into `IRProgram` with explicit `tokens`, `themes`, and `components` collections.
- `AnalyzedComponent` becomes `IRComponent` with resolved component parameter metadata, root layout node, and optional `intent` and `accessible` payloads.
- `AnalyzedSurface`, `AnalyzedStack`, `AnalyzedText`, and `AnalyzedSlot` become the `IRNode` hierarchy without introducing DOM- or JSX-specific element choices.
- `AnalyzedVariantBlock` is lowered into `IRVariant` plus flat per-case override props, and each variant carries the component-declared default value for that axis.
- `AnalyzedState`, `AnalyzedTransition`, and `AnalyzedMotion` become typed IR structures while preserving the currently analyzed nullability; IR building does not add missing-field validation.
- Text `level` is lifted out of generic text props into `IRText.level`, while other text properties remain in `IRText.props`.
- Source provenance is preserved on IR declarations, nodes, props, states, variants, motions, intent, accessibility, and token references for later diagnostics and debugging.

What remains symbolic in the IR:

- Token references retain both the original token path and the derived CSS custom property name (`cssVar`); the builder does not validate registry membership.
- `@` references remain symbolic as `IRReference` and `IRStringValue.refs`, with source classification (`prop`, `variant`, or `null`) derived from component params only.
- Accessible metadata, intent identifiers, roles, and keyword-valued props are preserved as language-level values rather than being mapped to framework primitives.
- Constraints are intentionally left out of the IR because they are compile-time validation concerns, not backend emission inputs.

What is intentionally deferred to emitters:

- Mapping surfaces, text roles, and intent semantics onto concrete platform primitives such as DOM elements, JSX, native views, or event handlers.
- Translating IR props, states, variants, and motions into target-specific styling systems, animation runtimes, and component signatures.
- Choosing slot projection mechanisms for a backend (`children`, named slots, render props, etc.).

Doc mismatch discovered:

- `docs/framelab-v02-impl-plan.md` describes a more fully resolved IR where state/motion completeness and reference resolution are already guaranteed. The current compiler pipeline does not yet implement the validating passes required for that stronger guarantee, so milestone 5 preserves those fields symbolically and nullable rather than moving validation into IR building.
