# Milestone 3 Notes

Milestone 3 adds the semantic validation scaffold on top of the raw parser AST.

Implemented in this milestone:

- Diagnostic types, severity metadata, and source-span-aware reporting.
- A validation context and pass runner that consume the raw ordered AST.
- Component/cardinality checks for component-level statements and param integrity.
- Semantic reference checks for `@name` and string-literal `@name` usage.
- Host/body validation for the raw AST where the parser is intentionally permissive.
- Property applicability validation for the explicit frozen rules already described for surface, text, state, and variant cases.

Not implemented yet:

- Token/theme registry and token resolution passes.
- Motion completeness rules beyond host placement.
- Variant completeness/integrity rules beyond property applicability.
- Constraint evaluation, accessibility completeness, slot-instantiation warnings, or IR generation.

Doc mismatch carried forward:

- The validator consumes the raw ordered AST from Milestone 2 rather than the flattened component shape shown in the implementation plan. This keeps parsing and validation separated, as required by `AGENTS.md`.
