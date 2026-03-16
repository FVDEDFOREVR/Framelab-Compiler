# FrameLab Compiler — AGENTS.md

## Purpose
Implement the FrameLab compiler from the frozen v0.2 spec.

## Authoritative docs
Treat these files as the source of truth:

- `docs/framelab-v02-frozen.md`
- `docs/framelab-v02-impl-plan.md`
- `docs/framelab-lex-parse-contract.md`

If code and docs disagree, follow the docs and leave a note in your summary.

## Non-goals
Do not redesign the language.
Do not change grammar, semantics, or validation rules unless implementation is impossible.
If you find a contradiction or blocker, stop at the smallest safe patch and explain it clearly instead of inventing behavior.

## Working style
Prefer small, reviewable diffs.
Preserve existing file organization unless a change is necessary.
Add or update tests with every meaningful code change.
Prefer clarity over cleverness.
Do not add new dependencies unless they materially simplify the implementation.

## Compiler implementation rules
Follow this phase order unless the task explicitly says otherwise:

1. tokenizer
2. parser to raw AST
3. semantic validation passes
4. normalized IR
5. emitter

Do not skip ahead to emitter work before tokenizer, parser, and validation are in place.

## Parser and AST rules
The parser must preserve raw component body statements.
Do not normalize during parsing.
Do not discard duplicate top-level statements in the parser.
Structural parsing errors belong in the parser.
Language-rule enforcement belongs in semantic validation unless the frozen spec explicitly makes it a parse-time error.

## Reference handling
Implement references exactly per `docs/framelab-lex-parse-contract.md`.

Key rule:
- standalone `@reference` is parsed structurally
- invalid standalone dot-path references such as `@product.title` must fail per the frozen lex/parse contract
- do not invent alternate reference syntax

## Validation rules
Use the frozen validation model and rule codes from the docs.
Keep rule staging consistent with the implementation plan.
Do not silently downgrade errors to warnings or upgrade warnings to errors without documenting why.

## Tests
Add focused fixtures for:
- valid grammar cases
- expected parse failures
- expected semantic validation failures
- regression coverage for any bug you fix

When possible, keep test names aligned with grammar productions or rule codes.

## Output expectations
When you finish a task, summarize:
- what changed
- what tests were added or updated
- any unresolved blockers
- any doc/code mismatch discovered

## If blocked
If you cannot proceed without changing the frozen spec:
1. implement the smallest safe subset
2. leave the surrounding code clean
3. explain the blocker precisely
4. do not expand scope on your own