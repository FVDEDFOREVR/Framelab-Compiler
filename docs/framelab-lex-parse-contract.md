# FRAMELAB v0.2 — Lex/Parse Contract: @reference Handling
## Addendum to: framelab-v02-impl-plan.md + framelab-v02-impl-patch.md
## Scope: Four precise behavioral rules for @ outside string literals. No redesign.

---

## CONTRACT

### Rule 1 — Tokenizer: `@` always emits `At`

The tokenizer emits `At` for every `@` character it encounters outside a string
literal. It does not inspect what follows before emitting. The `At` token's value
is `"@"`.

This is unchanged from the existing plan. Stated here explicitly so Rule 2 is
unambiguous.

---

### Rule 2 — Tokenizer: the token following `At` is lexed normally

After emitting `At`, the tokenizer resumes normal lexing of the next character.
It does not enter a special "reference mode".

Consequence: if the character sequence after `@` is `product.title`, the tokenizer
emits:

```
At          "@"
DottedIdent "product.title"
```

Not:

```
At    "@"
Ident "product"
Dot   "."
Ident "title"
```

Because the tokenizer eagerly produces `DottedIdent` for any `ident("."ident)*`
sequence (Section 1.3, DottedIdent rule). It has no context telling it to stop
at the dot when following an `At`.

TK-04 (`Bare "@" not followed by Ident`) is therefore **too broad**. It fires
correctly for `@` followed by a number, `{`, or EOF. But `@product.title` is not
a bare `@` — it is `@` followed by a `DottedIdent`, which is a distinct error.

**Patched TK-04:**
```
TK-04a: Bare "@" followed by a non-name token (number, punctuation, EOF)
         → tokenizer error: 'Expected identifier after "@"'
TK-04b: (removed from tokenizer — handled by parser, see Rule 3)
```

The tokenizer does not error on `At DottedIdent`. It emits both tokens and lets
the parser handle the structural violation. The tokenizer is context-free.

---

### Rule 3 — Parser: `parseReference()` accepts `Ident` only

A new dedicated parser function handles the `At Ident` production.

```
parseReference():
  expect(At)                       // consume "@"
  next = peek()
  if next.kind === Ident:
    consume()
    return ReferenceNode { name: next.value, pos: atToken.pos }
  if next.kind === DottedIdent:
    consume()                      // consume the DottedIdent so recovery can continue
    emit parse error PE-10 at next.pos:
      'Dot-path reference "@{value}" is not valid in standalone position.
       Only simple names are allowed: "@{firstName}"'
       where firstName = next.value.split('.')[0]
    return null                    // recovery: return null, caller skips
  else:
    emit parse error TK-04a (already emitted by tokenizer, or PE-09 as fallback)
    return null
```

`parseReference()` is called from `parsePropValue()` when lookahead is `At`,
and from any other parse site where a `reference` production is valid.

**New parse error code:**

```
PE-10: Dot-path reference "@{value}" is not valid in standalone position.
```

This is the only place PE-10 is emitted. It is a parse error, not a semantic
error, because the structure `At DottedIdent` cannot form a valid `ReferenceNode`
regardless of what the reference name resolves to.

---

### Rule 4 — Interaction with Pass 3 Patch 3 (VR-R2 in string literals)

VR-R2 (from impl-patch.md Patch 3) applies to `@name.field` patterns found inside
string literal values during Pass 6 string scanning.

Rule 3 above applies to `@name.field` in **standalone position** (as a prop value,
as a direct reference node).

These are complementary and non-overlapping:

| Location            | Detection point  | Error code | Stage   |
|---------------------|------------------|------------|---------|
| Standalone position | `parseReference()` | PE-10    | Parse   |
| Inside string lit   | Pass 6 scanner   | VR-R2     | Semantic |

No rule handles both. No rule is redundant with the other.

---

## AFFECTED SECTIONS (in-place updates)

### Section 1.3 — Tokenizer Responsibilities, "Reference" bullet

Replace:

> **Reference (`@name`):**
> The `@` character emits an At token. The following Ident is a separate token.
> The parser assembles `At Ident` into a reference. The tokenizer does not
> validate whether the reference name resolves — that is semantic pass work.

With:

> **Reference (`@name`):**
> The `@` character emits an `At` token. The tokenizer then resumes normal lexing
> with no special mode. If the next character sequence is `product.title`, the
> tokenizer emits `DottedIdent "product.title"` — not `Ident "product"`. The
> tokenizer does not inspect what follows `At` before emitting it. Structural
> validation of the `At` + following token sequence is the parser's responsibility
> (see `parseReference()`).

---

### Section 1.4 — Tokenizer Error Conditions

Replace TK-04 with:

> - TK-04: Bare `@` followed by a non-name token (number, punctuation, whitespace,
>   or EOF) → fatal tokenizer error: `'Expected identifier after "@"'`
>   Note: `@` followed by `DottedIdent` is NOT a TK-04 error. The tokenizer emits
>   `At DottedIdent` and the parser emits PE-10.

---

### Section 2.3 — Parser Function Mapping

Add one line:

```
G2  reference   → parseReference()   // At Ident | At DottedIdent(→PE-10)
```

---

### Section 2.4 — Disambiguation Points, parsePropValue

Add one case:

```
parsePropValue():
  ...
  At           → parseReference()    ← ADDED: "@name" as a prop value
  ...
```

---

### Section 2.5 — Parse Error Codes

Add:

```
PE-10: Dot-path reference "@{value}" is not valid in standalone position.
       Use a simple name: "@{firstName}".
```

---

### RULE_REGISTRY addition (Patch 6 in impl-patch.md)

Add to the `RuleCode` union type:

```typescript
| 'PE-10'
```

Add to `RULE_REGISTRY`:

```typescript
'PE-10': {
  severity: 'error',
  stage:    'parse',
  pass:     'parser',
  message:  'Dot-path reference "@{value}" is not valid in standalone position; use "@{firstName}"'
},
```
