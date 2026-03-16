# FRAMELAB v0.2 — TypeScript Compiler Implementation Plan
## Source: framelab-v02-frozen.md + framelab-v02-patch.md (authoritative)

This document is a compiler engineering plan, not a language design document.
Every decision here is derived from the frozen spec. Nothing is invented.

---

# 1. TOKENIZER

## 1.1 Token Types

Derived from G2 lexical rules. Every terminal in the grammar maps to exactly one
token type. The tokenizer produces a flat token stream consumed by the parser.

```typescript
export const enum TokenKind {
  // Literals
  Ident,           // [a-zA-Z][a-zA-Z0-9-]*  (kebab-case)
  ComponentName,   // [A-Z][a-zA-Z0-9]*       (PascalCase)
  StringLit,       // "..."
  Number,          // [0-9]+("."[0-9]+)?
  HexColor,        // #RGB or #RRGGBB
  DottedIdent,     // ident("."ident)*         (token paths, role names)

  // Punctuation
  LBrace,          // {
  RBrace,          // }
  LParen,          // (
  RParen,          // )
  LBracket,        // [
  RBracket,        // ]
  Colon,           // :
  Comma,           // ,
  Slash,           // /   (aspect ratio)
  At,              // @   (reference prefix)
  Newline,         // \n | \r\n  (significant as param separator)

  // Keywords — one token per reserved word (G2 keyword list)
  KwComponent,
  KwSurface,
  KwStack,
  KwSlot,
  KwText,
  KwIntent,
  KwState,
  KwMotion,
  KwVariant,
  KwTokens,
  KwTheme,
  KwAccessible,
  KwConstraints,
  KwProp,
  KwAs,
  KwExtends,
  KwRequired,
  KwFallback,
  KwFrom,
  KwTo,
  KwDuration,
  KwEase,
  KwTransition,
  KwProperty,
  KwTrue,
  KwFalse,
  KwTransparent,   // reserved value keyword (BD-11)

  // Dimension suffixes (attached to Number during tokenization)
  DimPx,           // px
  DimRem,          // rem
  DimEm,           // em
  DimPercent,      // %

  // Special
  Comment,         // // ... \n  (retained for source maps, filtered before parse)
  EOF,
}
```

## 1.2 Token Structure

```typescript
export interface Token {
  kind:   TokenKind
  value:  string        // raw source text for the token
  line:   number        // 1-based
  col:    number        // 1-based
  offset: number        // byte offset into source
}
```

## 1.3 Tokenizer Responsibilities

The tokenizer handles all lexical decisions. The parser never inspects raw characters.

**Keyword recognition:**
Every reserved word from G2 is identified during tokenization. If an identifier
matches a keyword, it emits the keyword token, not Ident. This makes the parser
context-free at the token level.

**ComponentName vs Ident:**
The tokenizer distinguishes these: if the first character is uppercase and the
token matches `[A-Z][a-zA-Z0-9]*`, emit ComponentName. Otherwise emit Ident.

**DottedIdent:**
The tokenizer eagerly consumes `ident("."ident)*` as a single DottedIdent token.
This applies to token paths (`color.text.primary`) and role names (`as heading`).
Exception: a standalone ident not followed by `.` is plain Ident.

**Number with dimension suffix:**
If a Number token is immediately followed (no whitespace) by `px`, `rem`, `em`,
or `%`, the tokenizer produces a single composite Number token and records the
suffix as a separate DimSuffix token. The parser always reads Number then
optionally a dim suffix token. Do not fuse them into one token — the validator
needs to inspect suffix separately from magnitude.

**Aspect ratio:**
`1/1`, `4/3`, `16/9` are tokenized as Number Slash Number. The parser assembles
them into an AspectVal node. The tokenizer does not need to recognize aspect ratios.

**Reference (`@name`):**
The `@` character emits an At token. The following Ident is a separate token.
The parser assembles `At Ident` into a reference. The tokenizer does not
validate whether the reference name resolves — that is semantic pass work.

**String interpolation:**
Strings containing `@name` references are tokenized as a single StringLit token.
The raw value preserves the `@name` text. The parser emits the string as-is.
The semantic pass (Pass 4, reference resolution) walks all string values and
resolves `@` references at that stage.

**Newline significance:**
Newlines are significant only inside parameter lists (G6 params use newline as
separator per BD-10). The tokenizer emits Newline tokens. The parser consumes
or discards them based on context. Outside of param lists, newlines are whitespace
and ignored.

**Comments:**
The tokenizer emits Comment tokens containing the full comment text. These are
filtered from the token stream before parsing but retained in a parallel
comment table indexed by line number. This allows the emitter to optionally
preserve comments in output, and enables future source map alignment.

## 1.4 Tokenizer Error Conditions

These are tokenizer-level errors. They are fatal (abort with position info).

- TK-01: Unterminated string literal (EOF before closing `"`)
- TK-02: Invalid hex color (# followed by non-hex or wrong digit count)
- TK-03: Unrecognized character (not in any token pattern)
- TK-04: Bare `@` not followed by Ident

---

# 2. PARSER

## 2.1 Parser Strategy

Recursive descent, LL(1) with one-token lookahead.
The grammar is designed to be unambiguous with one token of lookahead at every
decision point. There are no ambiguous productions in the frozen spec.

The parser produces an unvalidated CST/AST. It does not enforce semantic rules.
Any rule labeled [ERROR] in the spec's validation section is NOT a parse error
unless it is structurally unparseable (e.g. a missing required token).

Parse errors are structural: missing `{`, wrong token where a keyword is required,
unrecognized token in a production. Semantic errors are validated in separate passes.

## 2.2 Parse Context Stack

The parser maintains a context stack to enforce the block-type dispatch table
from the patch document. Each context names the enclosing body type.

```typescript
type ParseContext =
  | 'comp_body'
  | 'surface_body'
  | 'stack_body'
  | 'text_body'
  | 'slot_body'
  | 'intent_body'
  | 'state_body'
  | 'motion_body'
  | 'variant_case_body'
  | 'fallback_body'    // render_body — restricted comp_body
```

When the parser encounters a block-opening construct, it pushes the new context.
When it encounters a statement it does not expect in the current context, it
emits a parse error and attempts recovery (skip to next `}`).

The dispatch table (from patch Part VI) is encoded as:

```typescript
const VALID_IN_CONTEXT: Record<ParseContext, Set<string>> = {
  surface_body:      new Set(['prop', 'state', 'variant', 'motion', 'surface', 'stack', 'slot', 'text']),
  stack_body:        new Set(['surface', 'stack', 'slot', 'text']),
  text_body:         new Set(['prop', 'state', 'variant', 'slot']),
  slot_body:         new Set(['required', 'fallback']),
  intent_body:       new Set(['label']),
  comp_body:         new Set(['surface', 'stack', 'intent', 'accessible', 'constraints']),
  state_body:        new Set(['prop', 'transition']),
  motion_body:       new Set(['duration', 'ease', 'from', 'to', 'property']),
  variant_case_body: new Set(['prop']),
  fallback_body:     new Set(['surface', 'stack', 'slot', 'text']),
}
```

## 2.3 Grammar Production → Parser Function Mapping

Each grammar production maps to one parse function. Functions are named
`parse<Production>`. All functions consume tokens from the stream and return
an AST node or throw a ParseError.

```
G1  program          → parseProgram()
G1  declaration      → parseDeclaration()      // dispatches on lookahead
G5  tokens_decl      → parseTokensDecl()
G5  theme_decl       → parseThemeDecl()
G5  token_def        → parseTokenDef()
G6  component_decl   → parseComponentDecl()
G6  params           → parseParams()
G6  param            → parseParam()            // dispatches on KwVariant | KwProp
G6  variant_param    → parseVariantParam()
G6  prop_param       → parsePropParam()
G6  comp_body        → parseCompBody()
G6  comp_statement   → parseCompStatement()    // dispatches on context
G7  surface_node     → parseSurfaceNode()
G7  surface_body     → parseSurfaceBody()
G8  stack_node       → parseStackNode()
G8  stack_args       → parseStackArgs()
G8  stack_prop       → parseStackProp()
G8  stack_body       → parseStackBody()
G9  text_node        → parseTextNode()
G9  text_body        → parseTextBody()
G10 slot_node        → parseSlotNode()
G10 slot_body        → parseSlotBody()
G10 fallback_block   → parseFallbackBlock()
G10 render_body      → parseRenderBody()
G11 intent_node      → parseIntentNode()
G11 intent_body      → parseIntentBody()
G12 state_block      → parseStateBlock()
G12 state_body       → parseStateBody()
G12 transition_prop  → parseTransitionProp()
G13 motion_block     → parseMotionBlock()
G13 motion_body      → parseMotionBody()
G13 anim_value       → parseAnimValue()        // dispatches: '(' → list, number → bare
G13 anim_prop_entry  → parseAnimPropEntry()
G14 variant_block    → parseVariantBlock()
G14 variant_case     → parseVariantCase()
G15 accessible_block → parseAccessibleBlock()
G16 constraints_block→ parseConstraintsBlock()
G4  prop_assignment  → parsePropAssignment()
G4  prop_value       → parsePropValue()        // dispatches on token kind
G3  token_ref        → parseTokenRef()         // "token" "(" dotted_ident ")"
```

## 2.4 Disambiguation Points

These are the points where the parser must look ahead to decide which production
to apply. All are LL(1) — one token of lookahead is sufficient.

**parseDeclaration():**
  KwComponent → parseComponentDecl()
  KwTokens    → parseTokensDecl()
  KwTheme     → parseThemeDecl()
  other       → ParseError: "Expected component, tokens, or theme declaration"

**parseCompStatement():**
  KwSurface     → parseSurfaceNode()
  KwStack       → parseStackNode()
  KwIntent      → parseIntentNode()
  KwAccessible  → parseAccessibleBlock()
  KwConstraints → parseConstraintsBlock()
  other         → ParseError (includes slot, state, variant — all invalid at comp scope)

**parseSurfaceStatement():**
  KwState   → parseStateBlock()
  KwVariant → parseVariantBlock()
  KwMotion  → parseMotionBlock()
  KwSurface → parseSurfaceNode()     // nested surface
  KwStack   → parseStackNode()
  KwSlot    → parseSlotNode()
  KwText    → parseTextNode()
  Ident     → parsePropAssignment()  // any ident starts a prop assignment

**parseParam():**
  KwVariant → parseVariantParam()
  KwProp    → parsePropParam()
  Newline   → skip (newline separator)
  RParen    → exit param list
  other     → ParseError

**parseAnimValue():**
  LParen    → parse parenthesized anim_prop_entry list (for enter/exit)
  Number    → bare number (for pulse from/to)

**parsePropValue():**
  KwToken     → parseTokenRef()
  StringLit   → StringLitNode
  Number      → NumberNode (followed by optional dim suffix)
  KwTrue/False→ BoolNode
  KwTransparent→ TransparentNode
  Number "/" Number → AspectValNode (lookahead two tokens: Number then Slash)
  Ident (weight_val, align_val, etc.) → KeywordValueNode

## 2.5 Parse Error Strategy

Parse errors are non-fatal by default. The parser attempts recovery by:
1. Reporting the error with token position
2. Skipping tokens until it finds a synchronization point
3. Synchronization points: `}`, `{`, newline at comp_body level, EOF

Recovery allows the parser to report multiple errors in one pass rather than
stopping at the first. The AST produced after recovery is partial and must not
be passed to semantic validation if any parse errors occurred.

Parse errors (structural — detected by parser, not validator):
  PE-01: Expected `{` after node keyword
  PE-02: Expected `}` to close block
  PE-03: Expected `:` in property assignment
  PE-04: Expected `(` after `token`
  PE-05: Unexpected token in context (node type not valid in parent body)
  PE-06: Expected component name (PascalCase) after `component` keyword
  PE-07: Expected `"` for string literal
  PE-08: Unterminated param list (EOF before `)`)
  PE-09: Expected ident after `@`

---

# 3. AST NODE TYPES

Every grammar production maps to one AST node type. Nodes are discriminated
unions. Position (line, col) is on every node for error reporting.

## 3.1 Top-Level

```typescript
interface SourcePos { line: number; col: number; offset: number }

interface ProgramNode {
  kind: 'Program'
  declarations: DeclarationNode[]
  pos: SourcePos
}

type DeclarationNode =
  | ComponentDeclNode
  | TokensDeclNode
  | ThemeDeclNode
```

## 3.2 Tokens and Themes

```typescript
interface TokensDeclNode {
  kind:   'TokensDecl'
  name:   string            // block namespace root (e.g. "color")
  defs:   TokenDefNode[]
  pos:    SourcePos
}

interface TokenDefNode {
  kind:  'TokenDef'
  path:  string             // dotted path WITHOUT block name prefix
  value: TokenValueNode
  pos:   SourcePos
}

type TokenValueNode =
  | { kind: 'HexColor';  value: string }
  | { kind: 'StringVal'; value: string }
  | { kind: 'NumberVal'; value: number; suffix?: 'px'|'rem'|'em'|'%' }

interface ThemeDeclNode {
  kind:    'ThemeDecl'
  name:    string
  extends: string | null
  defs:    TokenDefNode[]
  pos:     SourcePos
}
```

## 3.3 Component

```typescript
interface ComponentDeclNode {
  kind:        'ComponentDecl'
  name:        string
  params:      ParamNode[]
  root:        SurfaceNode | StackNode   // exactly one root (VR-C1)
  intent:      IntentNode | null
  accessible:  AccessibleNode | null
  constraints: ConstraintsNode | null
  pos:         SourcePos
}

type ParamNode = VariantParamNode | PropParamNode

interface VariantParamNode {
  kind:    'VariantParam'
  axis:    string           // axis name (e.g. "tone")
  values:  string[]         // enumerated values (e.g. ["primary","ghost","danger"])
  default: string | null
  pos:     SourcePos
}

interface PropParamNode {
  kind:    'PropParam'
  name:    string
  type:    'text' | 'number' | 'boolean'
  default: string | number | boolean | null
  pos:     SourcePos
}
```

## 3.4 Surface

```typescript
interface SurfaceNode {
  kind:       'Surface'
  role:       string | null         // "as <ident>"
  props:      PropAssignmentNode[]
  states:     StateNode[]
  variants:   VariantBlockNode[]
  motions:    MotionNode[]
  children:   RenderNode[]          // surface | stack | slot | text children
  pos:        SourcePos
}

// RenderNode: nodes that produce visual output
type RenderNode =
  | SurfaceNode
  | StackNode
  | SlotNode
  | TextNode
```

## 3.5 Stack

```typescript
interface StackNode {
  kind:      'Stack'
  direction: 'vertical' | 'horizontal'   // defaults vertical (VR-K2)
  gap:       TokenRefNode | null
  align:     AlignVal | null
  justify:   JustifyVal | null
  wrap:      boolean
  children:  RenderNode[]
  pos:       SourcePos
}

type AlignVal   = 'start' | 'center' | 'end' | 'stretch'
type JustifyVal = 'start' | 'center' | 'end' | 'between'
```

## 3.6 Text

```typescript
interface TextNode {
  kind:       'Text'
  role:       TextRole | null
  props:      PropAssignmentNode[]
  states:     StateNode[]
  variants:   VariantBlockNode[]
  slot:       SlotNode | null         // at most one (VR-TX7)
  pos:        SourcePos
}

type TextRole = 'heading' | 'body' | 'label' | 'caption' | 'overline'
```

## 3.7 Slot

```typescript
interface SlotNode {
  kind:     'Slot'
  name:     string
  typeHint: SlotType | null
  required: boolean
  fallback: FallbackNode | null
  pos:      SourcePos
}

type SlotType = 'text' | 'surface' | 'any'

interface FallbackNode {
  kind:     'Fallback'
  children: RenderNode[]    // render_body: surface | stack | slot | text only
  pos:      SourcePos
}
```

## 3.8 Intent

```typescript
interface IntentNode {
  kind:       'Intent'
  intentKind: IntentKind
  identifier: string          // semantic name string after ":"
  label:      string | null   // may contain @-references (resolved in semantic pass)
  pos:        SourcePos
}

type IntentKind =
  | 'trigger' | 'navigate' | 'submit'
  | 'toggle'  | 'expand'   | 'dismiss'
```

## 3.9 State

```typescript
interface StateNode {
  kind:       'State'
  stateName:  string
  props:      PropAssignmentNode[]
  transition: TransitionNode | null
  pos:        SourcePos
}

interface TransitionNode {
  kind:     'Transition'
  verb:     'shift'
  duration: TokenRefNode
  ease:     TokenRefNode
  pos:      SourcePos
}
```

## 3.10 Motion

```typescript
type MotionNode =
  | EnterMotionNode
  | ExitMotionNode
  | PulseMotionNode
  | RevealMotionNode

interface EnterMotionNode {
  kind:     'MotionEnter'
  from:     AnimPropsNode
  to:       AnimPropsNode
  duration: TokenRefNode
  ease:     TokenRefNode
  pos:      SourcePos
}

interface ExitMotionNode {
  kind:     'MotionExit'
  from:     AnimPropsNode
  to:       AnimPropsNode
  duration: TokenRefNode
  ease:     TokenRefNode
  pos:      SourcePos
}

interface PulseMotionNode {
  kind:     'MotionPulse'
  property: AnimPropName
  from:     number
  to:       number
  duration: TokenRefNode
  ease:     TokenRefNode
  pos:      SourcePos
}

interface RevealMotionNode {
  kind:     'MotionReveal'
  duration: TokenRefNode
  ease:     TokenRefNode
  pos:      SourcePos
}

interface AnimPropsNode {
  kind:   'AnimProps'
  props:  AnimPropEntryNode[]
  pos:    SourcePos
}

interface AnimPropEntryNode {
  kind:  'AnimPropEntry'
  name:  AnimPropName
  value: number
}

type AnimPropName = 'opacity' | 'x' | 'y' | 'scale'
```

## 3.11 Variant

```typescript
interface VariantBlockNode {
  kind:  'VariantBlock'
  axis:  string               // must match a param axis name (checked in semantic pass)
  cases: VariantCaseNode[]
  pos:   SourcePos
}

interface VariantCaseNode {
  kind:  'VariantCase'
  value: string               // must be in axis value list (checked in semantic pass)
  props: PropAssignmentNode[]
  pos:   SourcePos
}
```

## 3.12 Accessible and Constraints

```typescript
interface AccessibleNode {
  kind:        'Accessible'
  role:        RoleValue | null
  label:       string | null
  description: string | null
  live:        LiveVal | null
  hidden:      boolean | null
  pos:         SourcePos
}

type RoleValue =
  | 'article' | 'button' | 'dialog' | 'img'
  | 'link'    | 'list'   | 'listitem' | 'region'
  | 'status'  | 'textbox'

type LiveVal = 'polite' | 'assertive' | 'off'

interface ConstraintsNode {
  kind:  'Constraints'
  rules: ConstraintRuleNode[]
  pos:   SourcePos
}

interface ConstraintRuleNode {
  kind:   'ConstraintRule'
  verb:   'forbid' | 'require' | 'warn'
  target: ConstraintTarget
  pos:    SourcePos
}

type ConstraintTarget =
  | { kind: 'Hardcoded'; what: 'color' | 'spacing' | 'depth' | 'any' }
  | { kind: 'AccessibleLabel' }
  | { kind: 'AccessibleRole' }
```

## 3.13 Shared

```typescript
interface PropAssignmentNode {
  kind:  'PropAssignment'
  name:  string
  value: PropValueNode
  pos:   SourcePos
}

type PropValueNode =
  | TokenRefNode
  | StringLitNode
  | NumberNode
  | BoolNode
  | TransparentNode
  | AspectValNode
  | KeywordValNode
  | ReferenceNode

interface TokenRefNode {
  kind: 'TokenRef'
  path: string    // full dotted path e.g. "color.text.primary"
  pos:  SourcePos
}

interface StringLitNode   { kind: 'StringLit';   value: string;  pos: SourcePos }
interface NumberNode      { kind: 'Number';       value: number; suffix?: string; pos: SourcePos }
interface BoolNode        { kind: 'Bool';         value: boolean; pos: SourcePos }
interface TransparentNode { kind: 'Transparent';  pos: SourcePos }
interface AspectValNode   { kind: 'AspectVal';    w: number; h: number; pos: SourcePos }
interface KeywordValNode  { kind: 'KeywordVal';   value: string; pos: SourcePos }
interface ReferenceNode   { kind: 'Reference';    name: string; pos: SourcePos }
```

---

# 4. SEMANTIC VALIDATION PASSES

Validation runs after a clean parse (zero parse errors). The AST is walked
in multiple passes. Each pass has a defined responsibility. Passes run in order
because later passes depend on results from earlier ones.

## Pass Architecture

```typescript
interface Diagnostic {
  severity: 'error' | 'warning' | 'info'
  code:     string          // VR code (e.g. "VR-T1")
  message:  string
  pos:      SourcePos
}

interface PassContext {
  program:       ProgramNode
  tokenRegistry: TokenRegistry    // built in Pass 1
  diagnostics:   Diagnostic[]
}

type SemanticPass = (ctx: PassContext) => void
```

---

## Pass 1 — Token Registry

**Runs on:** TokensDeclNode, ThemeDeclNode
**Builds:** TokenRegistry (Map from full dotted path → token value)
**Rules enforced:** VR-T1, VR-T2, VR-T4

```typescript
interface TokenEntry {
  path:   string          // "color.text.primary"
  value:  TokenValueNode
  source: 'base' | string  // "base" or theme name
}

class TokenRegistry {
  private entries = new Map<string, TokenEntry>()

  register(blockName: string, def: TokenDefNode, source: string): void
  resolve(path: string): TokenEntry | undefined
  has(path: string): boolean
}
```

**VR-T1:** When registering, check if path already exists in same block → error.
**VR-T4:** When registering, check that def.path does not start with blockName + "." → error.
**VR-T2:** When processing theme, compare overridden value to parent value → warn if same.

---

## Pass 2 — Component Registry

**Runs on:** ComponentDeclNode
**Builds:** ComponentRegistry (Map from name → ComponentDeclNode)
**Rules enforced:** (no VR codes — this pass detects duplicate component names)

```typescript
class ComponentRegistry {
  private components = new Map<string, ComponentDeclNode>()
  register(node: ComponentDeclNode): void   // error on duplicate name
  resolve(name: string): ComponentDeclNode | undefined
}
```

---

## Pass 3 — Component Structure Validation

**Runs on:** Each ComponentDeclNode independently
**Rules enforced:** VR-C1 through VR-C8, VR-SL1, VR-SL5, VR-R3

This pass validates structural rules that span the whole component but don't
require cross-component knowledge. It walks the component tree once.

Sub-checks:

**VR-C1:** Confirm exactly one root layout element (surface or stack) in comp_body.
  - Count surface_node and stack_node children of ComponentDeclNode.root.
  - Zero or more than one → error.

**VR-C2:** Count intent_nodes in entire component tree (deep walk) → more than one → error.

**VR-C3:** Count accessible_blocks in comp_body → more than one → error.

**VR-C4:** Count constraints_blocks in comp_body → more than one → error.

**VR-C5:** For each VariantParamNode, confirm default is in values array → error if not.

**VR-C6:** For each VariantParamNode, confirm axis name not in BUILTIN_STATE_NAMES → error.

**VR-C7:** For each VariantParamNode, confirm no value in BUILTIN_STATE_NAMES → error.

**VR-C8:** If intent_node exists and intent_node.label is null → error.

**VR-SL1:** Collect all SlotNode names in component (deep walk) → check for duplicates → error.

**VR-SL5:** (belt-and-suspenders) If parser passes a slot at comp scope, catch here → error.

**VR-R3:** Collect prop names and slot names in component → check for name collision → error.

```typescript
const BUILTIN_STATE_NAMES = new Set([
  'hover','focus','active','disabled',
  'loading','error','empty','selected','checked'
])
```

---

## Pass 4 — Property Validity Pass

**Runs on:** SurfaceNode, TextNode, StateNode, VariantCaseNode
**Rules enforced:** VR-S1 through VR-S4, VR-TX1 through VR-TX6, VR-ST7, VR-V5

This pass validates that properties appearing on each node are valid for that
node type, and that their value types are correct.

```typescript
const SURFACE_PROPS: Record<string, PropConstraint> = {
  fill:    { valueKind: ['TokenRef', 'Transparent'] },
  radius:  { valueKind: ['TokenRef'] },
  padding: { valueKind: ['TokenRef'] },
  depth:   { valueKind: ['TokenRef'] },
  outline: { valueKind: ['TokenRef', 'Transparent'] },
  opacity: { valueKind: ['Number'], range: [0, 1] },
  aspect:  { valueKind: ['AspectVal'] },
  width:   { valueKind: ['TokenRef'] },
  height:  { valueKind: ['TokenRef'] },
}

const TEXT_PROPS: Record<string, PropConstraint> = {
  content:    { valueKind: ['StringLit', 'Reference'] },
  'text-color': { valueKind: ['TokenRef'] },
  size:       { valueKind: ['TokenRef'] },
  weight:     { valueKind: ['KeywordVal'], allowed: ['regular','medium','semibold','bold'] },
  level:      { valueKind: ['Number'], range: [1, 6] },
  truncate:   { valueKind: ['KeywordVal'] },  // "N lines" — parsed as KeywordVal
  align:      { valueKind: ['KeywordVal'], allowed: ['start','center','end'] },
}
```

**VR-S1:** For each prop on surface, check it's in SURFACE_PROPS and value matches constraint.
**VR-S3:** For each prop on surface, check prop name not in TEXT_PROPS keys → error.
**VR-S4:** For each surface body, check no prop name appears more than once (outside state/variant).
**VR-TX1/TX2:** For text props, check text-color and size are TokenRef.
**VR-TX3/TX4:** If text.role === 'heading', require level prop, validate range.
               If text.role !== 'heading' and level prop present → error.
**VR-TX5:** For each prop on text, check it's not a surface-only prop → error.
**VR-TX7:** Text node may have at most one slot.
**VR-TX8:** Text node may not have both content prop and slot.
**VR-ST7:** For each state, check all props are valid for the containing element
            (pass state's parent context: 'surface' | 'text').
**VR-V5:** For each variant case, check all props are valid for the containing element.

---

## Pass 5 — Token Resolution Pass

**Runs on:** All TokenRefNode instances across all components
**Rules enforced:** VR-T3, VR-T4 (enforced at definition time in Pass 1)
**Requires:** TokenRegistry from Pass 1

Walk every node in every component. For each TokenRefNode, call
tokenRegistry.resolve(path). If undefined → error VR-T3.

```typescript
function walkTokenRefs(node: ASTNode, registry: TokenRegistry, diags: Diagnostic[]): void {
  // Visitor pattern — descend all node types
  // On TokenRefNode: registry.resolve(node.path) ?? diags.push(VR-T3 error)
}
```

---

## Pass 6 — Reference Resolution Pass

**Runs on:** All StringLitNode values containing `@`, all ReferenceNode instances
**Rules enforced:** VR-R1, VR-R2
**Requires:** Component params (collected in Pass 3)

For each component, build a reference scope:
  - All prop param names → resolved to PropParamNode
  - All variant param axis names → resolved to VariantParamNode

Walk all string values and explicit ReferenceNodes in the component.
Extract `@name` references from strings (scan for `@` followed by `[a-zA-Z][a-zA-Z0-9-]*`).
For each reference name: check against scope → error VR-R1 if not found.
If `@name.field` pattern detected → error VR-R2 (dot-path not valid in v0.2).

---

## Pass 7 — Variant Integrity Pass

**Runs on:** All VariantBlockNode instances
**Rules enforced:** VR-V1, VR-V2, VR-V3, VR-V4, VR-V6
**Requires:** Component params from Pass 3

For each VariantBlockNode:

**VR-V1:** Check block.axis exists in component params as a variant axis → error if not.

**VR-V2 + VR-V3:** Collect axis values from param. Collect case idents from block.
  - For each non-default axis value: must appear in cases → error (VR-V2).
  - For each case ident: must appear in axis values → error (VR-V3).
  - Default value must NOT appear as a case ident (it's expressed as element baseline).

**VR-V4:** For each VariantCaseNode: confirm children are only PropAssignmentNode → error.

**VR-V6:** For each element body, check no variant axis appears in more than one
           VariantBlockNode at the same nesting level → error.

---

## Pass 8 — Motion Completeness Pass

**Runs on:** All MotionNode instances
**Rules enforced:** VR-M1 through VR-M13

For each MotionNode, check required fields by verb type:

**VR-M1:** EnterMotionNode requires from, to, duration, ease (all non-null).
**VR-M2:** ExitMotionNode requires from, to, duration, ease.
**VR-M3:** PulseMotionNode requires property, from (number), to (number), duration, ease.
**VR-M4:** RevealMotionNode requires only duration and ease.
**VR-M5:** duration and ease must be TokenRefNode (not other PropValueNode kinds).
**VR-M6–M9:** For each surface, collect motion verbs → check at most one of each.
**VR-M10:** (belt-and-suspenders) motion not in surface_body → error. Parser should catch first.
**VR-M11:** Enter/exit from/to must be AnimPropsNode (parenthesized list), not bare number.
**VR-M12:** Pulse from/to must be bare numbers, not AnimPropsNode.
**VR-M13:** Each AnimPropEntryNode name must be in {'opacity','x','y','scale'}.

---

## Pass 9 — State Integrity Pass

**Runs on:** All StateNode instances
**Rules enforced:** VR-ST1 through VR-ST8

**VR-ST1:** State body contains only props and at most one transition → already enforced by parser.
            Belt-and-suspenders: verify no element children on StateNode.
**VR-ST2/ST3:** StateNode.children is empty (parser enforces). Check here for safety.
**VR-ST4:** StateNode parent context is surface or text → error if in other context.
            (Parser enforces via context stack, check here for safety.)
**VR-ST5/ST6:** If TransitionNode present: verb is 'shift', has exactly two TokenRefNodes → error.
**VR-ST7:** Delegate to Pass 4 results (already checked per-element).
**VR-ST8:** For each element body, collect state names → check for duplicates → error.

---

## Pass 10 — Accessibility and Intent Pass

**Runs on:** All ComponentDeclNode instances
**Rules enforced:** VR-C8, VR-I1, VR-I2, VR-I3, VR-I4, VR-A1, VR-A2, VR-A3,
                   VR-SL2, VR-SL3

**VR-I1/VR-C8:** If intent exists, intent.label must be non-null → error.
**VR-I2:** intent.label @-references must all be in ref scope (delegate to Pass 6 results).
**VR-I3:** At most one intent in component → already checked in Pass 3.
**VR-I4:** Intent appears only at comp_body → already enforced by parser.

**VR-A1:** If intent exists AND accessible.label is null AND intent.label is null → error.
           (The label may come from either source — at least one must be present.)
**VR-A2:** accessible.label and accessible.description @-references resolve → delegate to Pass 6.
**VR-A3:** accessible.role must be a valid RoleValue enum member → error.

**VR-SL2:** For each SlotNode with required=true and fallback=null → warning.
**VR-SL3:** Slot type hint violations → warning. (requires instantiation to check fully;
            in v0.2 emit a structural warning if typeHint is non-null as a reminder.)

---

## Pass 11 — Constraint Evaluation Pass

**Runs on:** ConstraintsNode per component
**Rules enforced:** VR-C4 (already checked), plus constraint rule semantics

For each ConstraintRuleNode, walk the component AST and apply the rule:

```typescript
type ConstraintEvaluator = {
  'hardcoded:color':   () => check all PropAssignmentNode values — if HexColor direct → violation
  'hardcoded:spacing': () => check surface padding/gap/width/height — if NumberNode (not TokenRef) → violation
  'hardcoded:depth':   () => check surface depth — if NumberNode → violation
  'hardcoded:any':     () => all of the above
  'accessible.label':  () => check all intent nodes have label → violation if missing
  'accessible.role':   () => check all accessible blocks have role → violation if missing
}
```

Verb maps to diagnostic severity:
  'forbid'  → error
  'require' → error (missing = error)
  'warn'    → warning

---

# 5. NORMALIZED IR

The IR is produced from the validated AST. It is the input to the emitter.
The IR resolves all symbolic references and flattens variant/state structure
into forms the emitter can render directly without further semantic reasoning.

## 5.1 Why a Separate IR

The AST preserves source structure. The IR has different requirements:
- Token paths are resolved to their CSS variable names
- @-references are resolved to their prop or variant axis sources
- Variants are represented as a resolved override map, not a block with cases
- States list their containing element type so the emitter doesn't re-derive it
- Motion verbs are typed discriminated unions with all required fields confirmed present

The emitter should not need to consult the token registry, the param list,
or the component structure. All that work is done in the IR pass.

## 5.2 IR Types

```typescript
// Resolved token reference — CSS variable name ready to emit
interface IRTokenRef {
  cssVar: string    // e.g. "--color-text-primary"
  path:   string    // original path for source maps
}

// Resolved prop value — emitter-ready
type IRPropValue =
  | { kind: 'TokenRef';    ref: IRTokenRef }
  | { kind: 'Number';      value: number; suffix?: string }
  | { kind: 'Bool';        value: boolean }
  | { kind: 'Transparent' }
  | { kind: 'AspectVal';   w: number; h: number }
  | { kind: 'Keyword';     value: string }
  | { kind: 'StringVal';   value: string; refs: ResolvedRef[] }
    // StringVal refs: each @name replaced with its resolution source

interface ResolvedRef {
  name:   string
  source: 'prop' | 'variant'
  // in v0.2 both resolve to React prop at runtime — emitter uses same pattern
}

interface IRProp {
  name:  string
  value: IRPropValue
}

// State override: a flat map of property overrides + optional transition
interface IRState {
  name:       string
  props:      IRProp[]
  transition: IRTransition | null
  hostKind:   'surface' | 'text'   // which element type hosts this state
}

interface IRTransition {
  duration: IRTokenRef
  ease:     IRTokenRef
}

// Variant override: resolved per axis value
// axis → value → flat override props
type IRVariantMap = Map<string /* axis */, Map<string /* value */, IRProp[]>>

// Motion — all verbs carry resolved fields
type IRMotion =
  | { kind: 'enter';  from: IRAnimProps; to: IRAnimProps; duration: IRTokenRef; ease: IRTokenRef }
  | { kind: 'exit';   from: IRAnimProps; to: IRAnimProps; duration: IRTokenRef; ease: IRTokenRef }
  | { kind: 'pulse';  property: AnimPropName; from: number; to: number; duration: IRTokenRef; ease: IRTokenRef }
  | { kind: 'reveal'; duration: IRTokenRef; ease: IRTokenRef }

type IRAnimProps = { opacity?: number; x?: number; y?: number; scale?: number }
```

## 5.3 IR Component

```typescript
interface IRComponent {
  name:        string
  variants:    IRVariantAxis[]
  props:       IRPropParam[]
  root:        IRSurface | IRStack
  intent:      IRIntent | null
  accessible:  IRA11y | null
}

interface IRVariantAxis {
  axis:    string
  values:  string[]
  default: string
}

interface IRPropParam {
  name:    string
  type:    'text' | 'number' | 'boolean'
  default: string | number | boolean | null
}

interface IRSurface {
  kind:      'surface'
  role:      string | null
  props:     IRProp[]
  states:    IRState[]
  variants:  IRVariantMap
  motions:   IRMotion[]
  children:  IRNode[]
}

interface IRStack {
  kind:      'stack'
  direction: 'vertical' | 'horizontal'
  gap:       IRTokenRef | null
  align:     AlignVal | null
  justify:   JustifyVal | null
  wrap:      boolean
  children:  IRNode[]
}

interface IRText {
  kind:     'text'
  role:     TextRole | null
  level:    number | null
  props:    IRProp[]
  states:   IRState[]
  variants: IRVariantMap
  slot:     IRSlot | null
}

interface IRSlot {
  kind:     'slot'
  name:     string
  typeHint: SlotType | null
  required: boolean
  fallback: IRNode[] | null
}

type IRNode = IRSurface | IRStack | IRText | IRSlot

interface IRIntent {
  intentKind: IntentKind
  identifier: string
  label:      string     // @-refs already resolved to interpolation markers
}

interface IRA11y {
  role:        RoleValue | null
  label:       string | null
  description: string | null
  live:        LiveVal | null
  hidden:      boolean | null
}
```

## 5.4 IR Builder: Token Path to CSS Variable

```typescript
function tokenPathToCSSVar(path: string): string {
  // "color.text.primary" → "--color-text-primary"
  return '--' + path.replace(/\./g, '-')
}
```

## 5.5 IR Builder: Variant Flattening

For each VariantBlockNode inside a surface or text body:
1. Look up the axis in the component's params to get the default value.
2. Build IRVariantMap: for each case, map its props through the prop resolver.
3. The default value produces an empty override map (baseline props are already
   on the surface/text node itself).

---

# 6. REACT EMITTER BOUNDARY

## 6.1 What the Emitter Receives

The emitter receives an IRComponent. It knows nothing of the AST, the token
registry, or the spec validation rules. It performs no semantic checks.
Its only job is producing valid React TSX and CSS Module output from IR.

```typescript
interface EmitterInput {
  component:   IRComponent
  targetDir:   string      // output directory path
}

interface EmitterOutput {
  tsxSource:   string      // ComponentName.tsx
  cssSource:   string      // ComponentName.module.css
  cssVarDecls: string[]    // token CSS vars for reference in consuming stylesheet
}
```

## 6.2 Emitter Responsibilities

The emitter handles these mapping decisions. None of them are spec decisions.

**Component signature:**
```tsx
// variant axes → union string props
// prop params → typed props
// slots → children props (Record<slotName, ReactNode>)
interface ButtonProps {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'primary' | 'ghost' | 'danger'
  labelText?: string
}
```

**Surface → element type:**
- surface with no role → `<div>`
- surface as `article` → `<article>`
- surface as `dialog` → handled by intent (see below)

**Stack → flex container:**
```tsx
<div style={{ display: 'flex', flexDirection: direction, gap: 'var(--...)' }}>
```

**Text role → HTML element:**
```
heading (level N) → <h1>–<h6>
body               → <p>
label              → <label>
caption            → <small>
overline           → <span>  (with class)
(no role)          → <span>
```

**Intent → interactive wrapper:**
```
trigger  → <button type="button" onClick={...}>
navigate → <a href={...}>
submit   → <button type="submit">
toggle   → <button aria-pressed={...}>
expand   → <button aria-expanded={...}>
dismiss  → <button aria-label={...}>
```
The intent wraps the entire component root as a React event boundary.
The surface inside renders as its usual div/element, but the intent's
output element is the outermost DOM wrapper.

**States → CSS classes + platform mapping:**
```
hover    → :hover pseudo-class in CSS module
focus    → :focus-visible in CSS module
active   → :active in CSS module
disabled → [aria-disabled="true"] attribute selector + CSS
loading  → data-loading="true" attribute selector + CSS
error    → aria-invalid="true" + CSS
selected → aria-selected="true" + CSS
checked  → aria-checked="true" + CSS
custom   → data-state-<name>="true" attribute + CSS class
```

**Transitions → CSS transition property:**
```css
.surface:hover { box-shadow: var(--depth-2); transition: box-shadow var(--duration-quick) var(--ease-lift); }
```

**Variants → CSS data attributes:**
```tsx
<div data-tone={tone} data-size={size}>
```
```css
.surface[data-tone="ghost"] { background: transparent; outline: var(--color-action-primary); }
.surface[data-size="sm"]    { padding: var(--space-inset-xs); }
```

**Motion enter/exit → CSS animation + reduced-motion:**
```css
@keyframes Button-enter { from { opacity: 0; } to { opacity: 1; } }
.surface { animation: Button-enter var(--duration-quick) var(--ease-out); }
@media (prefers-reduced-motion: reduce) { .surface { animation: none; } }
```

**Motion pulse → CSS animation + reduced-motion:**
```css
@keyframes Button-pulse { from { opacity: 0.4; } to { opacity: 1.0; } }
.surface { animation: Button-pulse var(--duration-slow) var(--ease-breath) infinite alternate; }
@media (prefers-reduced-motion: reduce) { .surface { animation: none; } }
```

**Motion reveal → crossfade skeleton class:**
```css
.surface { transition: opacity var(--duration-normal) var(--ease-out); }
.surface[data-loading="true"] { opacity: 0; }
```

**Slots → ReactNode props:**
```tsx
interface ProductCardProps {
  slots?: {
    thumbnail?: React.ReactNode
    category?:  React.ReactNode
    title:      React.ReactNode   // required=true → non-optional in type
    price:      React.ReactNode   // required=true
    actions?:   React.ReactNode
  }
}
// Slot renders as:
<div className={styles.slotThumbnail}>{props.slots?.thumbnail ?? fallbackContent}</div>
```

**@-references → React prop interpolation:**
```tsx
// label: "@label-text" in accessible block or intent
// resolves to:
aria-label={props.labelText}
```

**accessible block → aria attributes on root element:**
```tsx
<div role="button" aria-label={props.labelText} aria-disabled={disabled}>
```

## 6.3 CSS Module Structure

One CSS module file per component. Sections in order:

1. Base styles (surface, stack, text default props)
2. State overrides (`:hover`, `:focus-visible`, `[data-state]`)
3. Variant overrides (`[data-variant-axis="value"]`)
4. Motion keyframes
5. Animation declarations
6. Reduced-motion overrides

## 6.4 Emitter Non-Responsibilities

The emitter does NOT:
- Validate token paths (done in Pass 5)
- Validate prop types (done in Pass 4)
- Resolve @-references (done in Pass 6, IR carries resolved form)
- Apply constraints (done in Pass 11)
- Choose which HTML element is semantically "correct" for a role — the spec
  defines the mapping table and the emitter follows it mechanically

---

# 7. COMPILER PIPELINE SUMMARY

```typescript
// compiler.ts — top-level pipeline

export async function compile(source: string, options: CompilerOptions): Promise<CompilerResult> {

  // Stage 1: Tokenize
  const { tokens, tokenErrors } = tokenize(source)
  if (tokenErrors.length > 0) return { ok: false, errors: tokenErrors }

  // Stage 2: Parse
  const { ast, parseErrors } = parse(tokens)
  if (parseErrors.length > 0) return { ok: false, errors: parseErrors }

  // Stage 3: Semantic validation (all 11 passes)
  const diagnostics: Diagnostic[] = []
  const ctx: PassContext = { program: ast, tokenRegistry: new TokenRegistry(), diagnostics }

  runPass1_TokenRegistry(ctx)
  runPass2_ComponentRegistry(ctx)
  runPass3_ComponentStructure(ctx)
  runPass4_PropertyValidity(ctx)
  runPass5_TokenResolution(ctx)
  runPass6_ReferenceResolution(ctx)
  runPass7_VariantIntegrity(ctx)
  runPass8_MotionCompleteness(ctx)
  runPass9_StateIntegrity(ctx)
  runPass10_AccessibilityIntent(ctx)
  runPass11_ConstraintEvaluation(ctx)

  const errors   = diagnostics.filter(d => d.severity === 'error')
  const warnings = diagnostics.filter(d => d.severity !== 'error')

  if (errors.length > 0) return { ok: false, errors, warnings }

  // Stage 4: Build IR
  const ir = buildIR(ast, ctx.tokenRegistry)

  // Stage 5: Emit
  const outputs: EmitterOutput[] = ir.components.map(component =>
    emitReact({ component, targetDir: options.outDir })
  )

  return { ok: true, warnings, outputs }
}
```

## 7.1 Error Classification Table

This table is the authoritative reference for where each VR rule is caught.

```
VR code  Severity  Stage          Pass
-------  --------  -------------  ------
TK-01    error     Tokenize       —
TK-02    error     Tokenize       —
TK-03    error     Tokenize       —
TK-04    error     Tokenize       —
PE-01–09 error     Parse          —
VR-T1    error     Semantic       Pass 1
VR-T2    warning   Semantic       Pass 1
VR-T3    error     Semantic       Pass 5
VR-T4    error     Semantic       Pass 1
VR-C1    error     Semantic       Pass 3
VR-C2    error     Semantic       Pass 3
VR-C3    error     Semantic       Pass 3
VR-C4    error     Semantic       Pass 3
VR-C5    error     Semantic       Pass 3
VR-C6    error     Semantic       Pass 3
VR-C7    error     Semantic       Pass 3
VR-C8    error     Semantic       Pass 3 + Pass 10
VR-S1    error     Semantic       Pass 4
VR-S2    error     Semantic       Pass 4
VR-S3    error     Semantic       Pass 4
VR-S4    error     Semantic       Pass 4
VR-K1    error     Parse + Sem    Parser + Pass 4
VR-K2    info      Semantic       Pass 4
VR-K3    error     Semantic       Pass 4
VR-TX1   error     Semantic       Pass 4
VR-TX2   error     Semantic       Pass 4
VR-TX3   error     Semantic       Pass 4
VR-TX4   error     Semantic       Pass 4
VR-TX5   error     Semantic       Pass 4
VR-TX6   info      Semantic       Pass 4
VR-TX7   error     Semantic       Pass 4
VR-TX8   error     Semantic       Pass 4
VR-SL1   error     Semantic       Pass 3
VR-SL2   warning   Semantic       Pass 10
VR-SL3   warning   Semantic       Pass 10
VR-SL4   error     Parse          Parser
VR-SL5   error     Parse + Sem    Parser + Pass 3
VR-SL6   error     Parse          Parser
VR-I1    error     Semantic       Pass 10
VR-I2    error     Semantic       Pass 6 + Pass 10
VR-I3    error     Semantic       Pass 3
VR-I4    error     Parse          Parser
VR-ST1   error     Parse + Sem    Parser + Pass 9
VR-ST2   error     Parse + Sem    Parser + Pass 9
VR-ST3   error     Parse          Parser
VR-ST4   error     Parse + Sem    Parser + Pass 9
VR-ST5   error     Parse + Sem    Parser + Pass 9
VR-ST6   error     Semantic       Pass 9
VR-ST7   error     Semantic       Pass 4
VR-ST8   error     Semantic       Pass 9
VR-M1    error     Semantic       Pass 8
VR-M2    error     Semantic       Pass 8
VR-M3    error     Semantic       Pass 8
VR-M4    error     Semantic       Pass 8
VR-M5    error     Semantic       Pass 8
VR-M6    error     Semantic       Pass 8
VR-M7    error     Semantic       Pass 8
VR-M8    error     Semantic       Pass 8
VR-M9    error     Semantic       Pass 8
VR-M10   error     Parse + Sem    Parser + Pass 8
VR-M11   error     Semantic       Pass 8
VR-M12   error     Semantic       Pass 8
VR-M13   error     Semantic       Pass 8
VR-V1    error     Semantic       Pass 7
VR-V2    error     Semantic       Pass 7
VR-V3    error     Semantic       Pass 7
VR-V4    error     Parse + Sem    Parser + Pass 7
VR-V5    error     Semantic       Pass 4 + Pass 7
VR-V6    error     Semantic       Pass 7
VR-A1    error     Semantic       Pass 10
VR-A2    error     Semantic       Pass 6 + Pass 10
VR-A3    error     Semantic       Pass 10
VR-R1    error     Semantic       Pass 6
VR-R2    error     Semantic       Pass 6
VR-R3    error     Semantic       Pass 3
```

## 7.2 File Structure

```
framelab-compiler/
└── src/
    ├── tokenizer/
    │   ├── token.ts          TokenKind enum, Token interface
    │   ├── tokenizer.ts      tokenize(source) → TokenStream
    │   └── tokenizer.test.ts
    ├── parser/
    │   ├── parser.ts         parse(tokens) → ProgramNode + errors
    │   ├── parseContext.ts   ParseContext type + VALID_IN_CONTEXT table
    │   └── parser.test.ts
    ├── ast/
    │   └── nodes.ts          All AST node type definitions (Section 3)
    ├── semantic/
    │   ├── pass1-token-registry.ts
    │   ├── pass2-component-registry.ts
    │   ├── pass3-component-structure.ts
    │   ├── pass4-property-validity.ts
    │   ├── pass5-token-resolution.ts
    │   ├── pass6-reference-resolution.ts
    │   ├── pass7-variant-integrity.ts
    │   ├── pass8-motion-completeness.ts
    │   ├── pass9-state-integrity.ts
    │   ├── pass10-accessibility-intent.ts
    │   ├── pass11-constraint-evaluation.ts
    │   ├── diagnostic.ts      Diagnostic interface, severity types
    │   └── passContext.ts     PassContext interface, TokenRegistry class
    ├── ir/
    │   ├── ir.ts             All IR type definitions (Section 5)
    │   └── irBuilder.ts      buildIR(ast, registry) → IRProgram
    ├── emit/
    │   ├── emitReact.ts      emitReact(input) → EmitterOutput
    │   └── cssModule.ts      CSS module builder helpers
    └── compiler.ts           compile() pipeline (Section 7)
```
