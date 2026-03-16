# Milestone 2 Notes

Milestone 2 adds a frozen-spec parser and raw AST for FrameLab v0.2.

Implementation notes:

- The parser produces a raw AST with ordered `body` arrays for component, surface, text, stack, slot, intent, and motion bodies. This preserves duplicate top-level statements and avoids normalization during parsing.
- `parseReference()` follows `docs/framelab-lex-parse-contract.md`: `@name` parses to `Reference`, while `@product.title` throws `PE-10`.
- Parser tests are fixture-based. Valid fixtures cover the major grammar productions; invalid fixtures cover expected structural parse errors.
- Doc mismatch: `docs/framelab-v02-impl-plan.md` shows a flattened component AST (`root`, `intent`, `accessible`, `constraints`), but `AGENTS.md` requires a raw parser AST that preserves `comp_body`. This milestone follows the raw-AST requirement and leaves flattening for a later normalization/validation phase.
