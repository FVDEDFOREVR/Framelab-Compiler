# Milestone 1 Notes

Milestone 1 implements the frozen v0.2 tokenizer in TypeScript and verifies it with focused tokenizer tests.

Implementation notes:

- The tokenizer now follows the frozen lexical contract: per-keyword token kinds, `ComponentName` vs `Ident`, eager `DottedIdent`, explicit `Newline`, retained `Comment`, and split dimension suffix tokens (`px`, `rem`, `em`, `%`).
- Standalone references follow `docs/framelab-lex-parse-contract.md`: `@name` tokenizes as `At` + `Ident`, while `@product.title` tokenizes as `At` + `DottedIdent` and is left for the parser to reject later as `PE-10`.
- `TK-04` is enforced only for truly bare `@` forms such as `@`, `@ `, `@1`, or `@{`.
- The grammar requires the literal `token(...)` and the reserved value `transparent`. The frozen docs describe both, but the keyword table and token-kind list are not perfectly aligned. This implementation reserves both because they are required by the grammar.
- The TypeScript build is intentionally scoped to tokenizer milestone files so `npm run build` and `npm test` validate Milestone 1 cleanly without pulling the older pre-freeze parser/emitter sources into this checkpoint.
