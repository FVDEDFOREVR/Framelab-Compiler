# Milestone 4 Notes

Milestone 4 adds a target-agnostic normalization phase that transforms the raw validated AST into a canonical analyzed model.

Raw AST to normalized model mapping:

- `ComponentDecl.body` is split into explicit normalized component fields: `root`, `intent`, `accessible`, and `constraints`.
- Top-level declaration order is retained via `declarationOrder`, so later phases can recover source ordering where it matters.
- Surface, stack, text, and slot bodies are normalized into typed collections (`props`, `states`, `variants`, `motions`, `children`, `slot`) instead of mixed raw statement arrays.
- Parameter lists are split into normalized `variants` and `props`.
- Motion and transition blocks are normalized into explicit typed structures without introducing emitter-specific behavior.

Assumptions enforced by validation:

- Exactly one component root exists.
- Optional singleton declarations (`intent`, `accessible`, `constraints`) have already passed cardinality checks.
- Property applicability and reference legality have already been validated.
- Normalization assumes only validated programs are passed in and will reject a program with error diagnostics.

Deferred work for later phases:

- Resolved token registry lookup and CSS variable mapping.
- Resolved `@` reference provenance into emitter/IR-ready reference sources.
- Variant/state flattening into emitter-oriented override maps.
- IR generation and any framework-specific emission.
