# FRAMELAB v0.2 — Compiler Freeze Specification
## Freeze Pass Edition — All contradictions resolved, all grammar complete

---

# PART I — FINAL UNRESOLVED ISSUES FOUND IN REVISED SPEC

The following issues survived the previous critique pass and must be decided
before the grammar is frozen. Each is classified and a binding decision follows.

---

## FI-1. Intent scope: D6 vs C4 grammar [CONTRADICTION]

D6 (decisions section) states:
  "The intent may appear anywhere in the component body
   (top level, inside surface, inside stack)."

C4 (normative grammar) defines comp_body as:
  comp_statement ::= surface_node | stack_node | slot_node
                   | intent_node | accessible_block | constraints_block

intent_node appears only in comp_statement. It does NOT appear in
surface_body or stack_body. Those productions do not list intent_node.

Result: The grammar only allows intent at component body scope.
The prose decision says it can appear anywhere. They disagree.

DECISION: Intent is declared at component body scope only.
Rationale: "intent may appear anywhere" was intended to mean the intent
wraps the whole component interaction, not that it can be placed inside
a surface or stack. Placing intent inside surface creates ambiguity about
which element receives the interactive role. One location, one rule.
The grammar is authoritative. D6 prose is wrong. Rewrite D6.

---

## FI-2. Motion scope: D1 vs C11 [CONTRADICTION]

D1 (decisions) motion verb table lists:
  enter | block | surface, component | mount
  exit  | block | surface, component | mount

C11 (normative grammar) states:
  "Motion blocks are valid only inside: surface_body."
  "Motion blocks are NOT valid inside state_body, text_body, or intent_body."

D1 allows enter/exit at component scope. C11 forbids it.

DECISION: Motion blocks are valid only inside surface_body.
Rationale: A component body has no visual rendering layer. enter/exit
animations are properties of a rendered surface, not of a component
abstraction. If a component needs a mount animation, its root surface
declares it. The grammar is authoritative. D1 motion verb table is wrong.

---

## FI-3. Required slot: D4 vs C8 [CONTRADICTION]

D4 (decisions) states:
  "required — component instantiation without a required slot is an error"

C8 (normative grammar) states:
  "VR-SL2: A required slot that receives no content at instantiation
   is a compile warning. (Compile error is deferred to v0.3 when
   instantiation syntax exists.)"

D4 says error. C8 says warning. They directly contradict.

DECISION: Missing required slot is a compile WARNING in v0.2.
Rationale: v0.2 has no instantiation syntax. The compiler cannot know
at component-definition time whether a slot will be filled — that is
determined at instantiation. Since instantiation syntax is v0.3, the
compiler cannot enforce this as an error in v0.2. D4 was wrong to
promise error enforcement. VR-SL2 is correct.

---

## FI-4. prop_assignment undefined throughout grammar [MISSING]

prop_assignment appears in:
  surface_statement, state_body, variant_case, text_body, motion_body, intent_body

But prop_assignment is never defined as a grammar production. The parser
cannot know what a prop_assignment looks like.

DECISION: Define prop_assignment as:
  prop_assignment ::= prop_name ":" prop_value
  prop_name       ::= ident
  prop_value      ::= token_ref | string_lit | number | bool_val
                    | aspect_val | weight_val | align_val | truncate_val

---

## FI-5. prop_list undefined in motion_block grammar [MISSING]

C11 motion_block grammar references prop_list in from/to parenthesized form:
  | "from" ":" "(" prop_list ")"

prop_list is never defined. It appears in intent_body grammar in the
previous draft but was removed in the revision.

DECISION: Define prop_list and anim_prop_list as separate productions.
prop_list is the general case (used in fallback bodies etc.)
anim_prop_list is the restricted set valid in motion from/to.

---

## FI-6. text heading level property not in grammar [MISSING]

C7 prose states:
  "text as heading → h1–h6 (level set by level: number property)"
  "VR-TX4: text as heading requires a level: number property (1–6)"

The `level` property does not appear in the text prop list. The grammar
defines text_prop as prop_assignment | state_block | comment. Since
prop_assignment accepts any ident as prop_name, `level` is technically
parseable, but its type (number, range 1–6) and requirement (only for
heading role) are not expressed in the grammar.

DECISION: Add `level` to the explicit text property table with type
number and range validation. Make it required when role is heading.

---

## FI-7. Slot semantic ambiguity: declaration vs placement [AMBIGUOUS]

A slot in v0.2 currently does two things that are conflated into one construct:

  Role A — Declaration: "This component has a named insertion point called 'title'"
  Role B — Placement:   "The insertion point lives at this position in the layout tree"

In the current grammar, a slot_node appears inside surface_body and stack_body
as a statement — which implies placement. But it also carries required/fallback
which are declaration-level properties.

The ambiguity: Is the slot_node a layout-position marker, or a contract declaration?
In every example, it is both simultaneously. This is fine for a single-slot
component. For a component with multiple layout regions, the author cannot
declare a slot in one surface and use it in another.

DECISION: In v0.2, slot declaration and placement are the same construct.
A slot_node at a position in the tree means: "insert content here, and
this insertion point is named X." One slot = one position. There is no
way to declare a slot separately from where it appears. This is the v0.2
constraint. Separate declaration/placement is a v0.3 concern.

This is not ambiguous — it is a deliberate design limitation. Document it
explicitly. Remove the hedging language from C8.

---

## FI-8. Standalone constraints: prose vs grammar [CONTRADICTION]

C14 (normative) states:
  "A constraints block may appear at component body scope (applies to that
   component only) or in a standalone file constraints.fl (applies project-wide)."

The program grammar in C1 is:
  program ::= declaration*
  declaration ::= component_decl | tokens_decl | theme_decl

constraints_block is NOT a top-level declaration. It can only appear inside
a component_decl body. The prose promises a standalone constraints.fl file
but the grammar cannot parse one.

DECISION: Remove standalone constraints from v0.2. constraints_block is
valid only inside component_decl body. Project-wide constraints are v0.3.

---

## FI-9. text-color property in variant_case violates surface property rules [INVALID]

Badge and Chip examples include text-color in variant_case blocks:
  variant tone {
    success { fill: token(...)  text-color: token(...) }
  }

These variant blocks are inside surface_body. surface_body's valid property
list (C5) does not include text-color. text-color is a text node property.
Assigning text-color on a surface is either:
  (a) an implicit cascade to child text nodes — which requires the compiler
      to implement inheritance, which is not specified
  (b) an invalid property assignment on surface

DECISION: text-color is NOT a valid property on surface. Variant cases
inherit the property restrictions of their containing element. Badge and
Chip must be restructured so that text nodes carry their own color properties.
This changes the component structure for those two examples.

---

## FI-10. Avatar has no intent but accessible label is required [LATENT CONFLICT]

VR-C7 states: "A component with an intent_node and no accessible_block label
is a compile error." Avatar has no intent_node and has an accessible block
with a label. This is fine — the rule only triggers when intent exists.

However: Avatar has no intent. Its role is `img`. It is a passive element.
This is valid and no rule is violated. No action needed — documenting this
explicitly so the compiler team knows that accessible block without intent
is always valid.

---

## FI-11. Params separator: comma is inconsistent [GRAMMAR BUG]

C4 grammar:
  params ::= "(" param ("," param)* ")"

All examples use newline-separated params without commas:
  component Button(
    variant size: [sm, md, lg] = md
    variant tone: [primary, ghost, danger] = primary
    prop label-text: text = "Button"
  )

The grammar requires commas. The examples omit them. One must be fixed.

DECISION: Params are newline-separated, not comma-separated. The grammar
uses newlines as separators for param lists. This matches all example usage
and is more ergonomic for multi-param components.

---

## FI-12. `transparent` used as a fill value but is not a valid prop_value [GRAMMAR BUG]

Button example:
  ghost { fill: transparent  outline: token(color.action.primary) }

`transparent` is not a token_ref, hex_color, string_lit, number, or bool_val.
It is an unquoted keyword. The prop_value grammar has no slot for it.

DECISION: Add `transparent` as a reserved keyword valid only as a value for
the `fill` and `outline` surface properties. It compiles to CSS `transparent`.

---

## FI-13. Motion from/to with single property: parenthesized list of one [AMBIGUOUS]

Toast motion exit:
  from: ( opacity: 1 )
  to:   ( opacity: 0 )

A parenthesized list of one property. This is valid per the grammar.
But the parser must decide: is `( opacity: 1 )` parsed as anim_prop_list
with one entry, or as something else? Since anim_prop_list is currently
undefined (FI-5), this must be resolved together with FI-5.

DECISION: Resolved by FI-5 fix. A parenthesized anim_prop_list of one
entry is valid. The grammar will make this explicit.

---

## FI-14. NavItem variant emphasis includes `disabled` but built-in `disabled` state also exists [CONFLICT]

NavItem:
  variant emphasis: [default, active, disabled] = default

VR-C6 bans variant axis names that match built-in state names. But it bans
axis NAMES, not axis VALUES. `emphasis` as the axis name is fine. However,
`disabled` as a variant VALUE creates a semantic conflict: there will be
both a `state disabled` block and a `variant emphasis { disabled { ... } }`
block in the same surface, both producing output when the component is disabled.

Their outputs could conflict. The compiler has no merge or priority rule.

DECISION: Extend the ban from axis names to axis VALUES. Variant case values
must not be any built-in state name. NavItem must rename `disabled` to
`suppressed` or similar, and `active` to `current`.

---

# PART II — BINDING DESIGN DECISIONS

Each decision below is final for v0.2. No further revision in v0.2.

---

## BD-1. Intent is declared at component body scope ONLY.
Grammar is authoritative. intent_node is not valid inside surface_body or stack_body.
It wraps the component's primary interaction, not a specific element.

## BD-2. Motion blocks (enter, exit, pulse, reveal) are valid only inside surface_body.
Grammar is authoritative. There is no component-scope motion.

## BD-3. Missing required slot is a compile WARNING in v0.2. Not an error.
Instantiation syntax does not exist in v0.2. Cannot enforce at definition time.

## BD-4. prop_assignment is fully defined.
  prop_assignment ::= prop_name ":" prop_value
  prop_value      ::= token_ref | string_lit | number dimension_suffix?
                    | bool_val | aspect_val | weight_val | align_val
                    | truncate_val | "transparent"

## BD-5. Motion from/to uses a parenthesized anim_prop_list.
  anim_prop_list  ::= anim_prop ("  " anim_prop)*   // space-separated pairs
  anim_prop       ::= anim_prop_name ":" anim_prop_value
  anim_prop_name  ::= "opacity" | "x" | "y" | "scale"
  anim_prop_value ::= number

## BD-6. text heading level: required property when role is heading, type number 1–6.
  text as heading { level: 2  ... }

## BD-7. Slot is a single construct. Declaration = placement. No split.
One slot_node = one named position in the layout tree.

## BD-8. Standalone constraints removed from v0.2.
constraints_block is valid only inside component_decl body.
Project-wide constraints are v0.3.

## BD-9. text-color is NOT valid on surface or in surface variant cases.
text-color is a text node property only. Surface variants may only override
surface-valid properties: fill, radius, padding, depth, outline, opacity,
width, height.

## BD-10. Params are newline-separated (no commas).
  params ::= "(" param+ ")"    // one param per line, no separator token

## BD-11. `transparent` is a reserved value keyword.
Valid as the value of fill and outline on surface only.

## BD-12. Variant case values must not be built-in state names.
The ban covers both axis names AND axis values.
Built-in state names: hover focus active disabled loading error empty selected checked
NavItem variant emphasis values renamed: default → default, active → current, disabled → suppressed.

---

# PART III — FULLY CORRECTED NORMATIVE GRAMMAR

This is the single authoritative grammar for FrameLab v0.2.
No prose in this document overrides this grammar.
If prose and grammar conflict, the grammar wins.

---

## G1. Program

```
program         ::= declaration*

declaration     ::= component_decl
                  | tokens_decl
                  | theme_decl

comment         ::= "//" ( any character except newline )*
```

---

## G2. Lexical

```
NEWLINE         ::= "\n" | "\r\n"
WHITESPACE      ::= " " | "\t"

ident           ::= [a-zA-Z] [a-zA-Z0-9-]*
component_name  ::= [A-Z] [a-zA-Z0-9]*
string_lit      ::= '"' [^"]* '"'
number          ::= [0-9]+ ( "." [0-9]+ )?
bool_val        ::= "true" | "false"
hex_color       ::= "#" [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]
                      ( [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] )?
dotted_ident    ::= ident ( "." ident )*
reference       ::= "@" ident
```

Reserved keywords (may not be used as ident in any position):
```
component surface stack slot text intent state motion variant
tokens theme accessible constraints prop as extends required
fallback from to duration ease transition property true false
```

Identifiers are kebab-case: `label-text`, `nav-item`, `focus-ring`.
Component names are PascalCase: `Button`, `ProductCard`, `NavItem`.

---

## G3. Token Values and Dimension

```
token_ref       ::= "token" "(" dotted_ident ")"

token_value     ::= hex_color
                  | string_lit
                  | number dimension_suffix?

dimension_suffix ::= "px" | "rem" | "em" | "%"
```

---

## G4. prop_assignment (used throughout)

```
prop_assignment ::= prop_name ":" prop_value

prop_name       ::= ident

prop_value      ::= token_ref
                  | string_lit
                  | number dimension_suffix?
                  | bool_val
                  | "transparent"
                  | aspect_val
                  | weight_val
                  | align_val
                  | justify_val
                  | truncate_val

aspect_val      ::= number "/" number
weight_val      ::= "regular" | "medium" | "semibold" | "bold"
align_val       ::= "start" | "center" | "end" | "stretch"
justify_val     ::= "start" | "center" | "end" | "between"
truncate_val    ::= number "lines"
```

Note: Not all prop_value forms are valid for all properties.
Property-specific value restrictions are enforced by validation rules,
not by grammar production. The grammar is permissive; the validator is strict.

---

## G5. Token and Theme Declarations

```
tokens_decl     ::= "tokens" ident "{" token_def* "}"
token_def       ::= dotted_ident ":" token_value

theme_decl      ::= "theme" ident ( "extends" ident )? "{" token_def* "}"
```

---

## G6. Component Declaration

```
component_decl  ::= "component" component_name params? "{" comp_body "}"

params          ::= "(" param+ ")"

param           ::= variant_param
                  | prop_param

variant_param   ::= "variant" ident ":" "[" ident ( "," ident )* "]"
                    ( "=" ident )?

prop_param      ::= "prop" ident ":" prop_type ( "=" literal )?

prop_type       ::= "text" | "number" | "boolean"
literal         ::= string_lit | number | bool_val

comp_body       ::= comp_statement*

comp_statement  ::= surface_node
                  | stack_node
                  | slot_node
                  | intent_node
                  | accessible_block
                  | constraints_block
                  | comment
```

---

## G7. Surface Node

```
surface_node    ::= "surface" role? "{" surface_body "}"

role            ::= "as" ident

surface_body    ::= surface_statement*

surface_statement ::= prop_assignment
                    | state_block
                    | variant_block
                    | motion_block
                    | surface_node
                    | stack_node
                    | slot_node
                    | text_node
                    | comment
```

Valid surface properties (enforced by validator, not parser):
```
  fill:    token_ref | "transparent"
  radius:  token_ref
  padding: token_ref
  depth:   token_ref
  outline: token_ref | "transparent"
  opacity: number                       (range: 0.0 – 1.0)
  aspect:  aspect_val
  width:   token_ref
  height:  token_ref
```

No other properties are valid on surface.
text-color, size, weight, content, level are not valid on surface.

---

## G8. Stack Node

```
stack_node      ::= "stack" stack_args? "{" stack_body "}"

stack_args      ::= "(" stack_prop ( "," stack_prop )* ")"

stack_prop      ::= "direction" ":" ( "vertical" | "horizontal" )
                  | "gap"       ":" token_ref
                  | "align"     ":" align_val
                  | "justify"   ":" justify_val
                  | "wrap"      ":" bool_val

stack_body      ::= stack_statement*

stack_statement ::= surface_node
                  | stack_node
                  | slot_node
                  | text_node
                  | comment
```

Stack has no visual properties. No prop_assignment is valid at stack scope.
state_block, variant_block, and motion_block are not valid in stack_body.

---

## G9. Text Node

```
text_node       ::= "text" role? "{" text_body "}"

text_body       ::= text_statement*

text_statement  ::= prop_assignment
                  | state_block
                  | comment
```

Valid text properties (enforced by validator):
```
  content:    string_lit | reference
  text-color: token_ref
  size:       token_ref
  weight:     weight_val
  level:      number                    (only valid when role is heading, range: 1–6)
  truncate:   truncate_val
  align:      align_val
```

No other properties are valid on text.
fill, radius, padding, depth, outline, aspect, width, height are not valid on text.

---

## G10. Slot Node

```
slot_node       ::= "slot" ident slot_type_hint? slot_body?

slot_type_hint  ::= ":" slot_type

slot_type       ::= "text" | "surface" | "any"

slot_body       ::= "{" slot_statement* "}"

slot_statement  ::= "required"
                  | fallback_block
                  | comment

fallback_block  ::= "fallback" "{" comp_body "}"
```

A slot_node at a position in the layout tree declares a named insertion point
at that position. Declaration and placement are the same act in v0.2.
A slot has no visual properties of its own.

---

## G11. Intent Node

```
intent_node     ::= "intent" intent_kind ":" string_lit "{" intent_body "}"

intent_kind     ::= "trigger" | "navigate" | "submit"
                  | "toggle"  | "expand"   | "dismiss"

intent_body     ::= intent_statement*

intent_statement ::= "label" ":" string_lit
                   | state_block
                   | comment
```

intent_node is valid only in comp_body (G6). It is NOT valid inside
surface_body, stack_body, text_body, or slot_body.

---

## G12. State Block

```
state_block     ::= "state" state_name "{" state_body "}"

state_name      ::= ident

state_body      ::= state_statement*

state_statement ::= prop_assignment
                  | transition_prop
                  | comment

transition_prop ::= "transition" ":" transition_val

transition_val  ::= "shift" "(" token_ref token_ref ")"
```

state_block is valid inside: surface_body, text_body, intent_body.
state_block is NOT valid inside: comp_body, stack_body, slot_body,
motion_body, variant_case, or inside another state_block.

The two token_ref args to shift are duration then ease, in that order.

State blocks contain property overrides and at most one transition_prop.
Properties inside a state_block are validated against the containing element's
property list. A state inside surface_body may only use surface properties.
A state inside text_body may only use text properties.

---

## G13. Motion Block

```
motion_block    ::= "motion" motion_verb "{" motion_body "}"

motion_verb     ::= "enter" | "exit" | "pulse" | "reveal"

motion_body     ::= motion_statement*

motion_statement ::= "duration" ":" token_ref
                   | "ease"     ":" token_ref
                   | "from"     ":" anim_value
                   | "to"       ":" anim_value
                   | "property" ":" anim_prop_name
                   | comment

anim_value      ::= "(" anim_prop_entry+ ")"
                  | number

anim_prop_entry ::= anim_prop_name ":" number

anim_prop_name  ::= "opacity" | "x" | "y" | "scale"
```

motion_block is valid ONLY inside surface_body.
motion_block is NOT valid in comp_body, stack_body, text_body,
intent_body, state_body, or variant_case.

Motion verbs by required properties:

  enter:
    Required: duration, ease, from (anim_value), to (anim_value)
    from/to must use the parenthesized form ( anim_prop_entry+ )
    Describes mount transition.

  exit:
    Required: duration, ease, from (anim_value), to (anim_value)
    from/to must use the parenthesized form ( anim_prop_entry+ )
    Describes unmount transition.

  pulse:
    Required: duration, ease, property (anim_prop_name), from (number), to (number)
    from/to must use the bare number form.
    Describes a continuous looping animation on a single property.

  reveal:
    Required: duration, ease only.
    No from/to. No property. Compiler generates a crossfade from skeleton to content.

---

## G14. Variant Block

```
variant_block   ::= "variant" ident "{" variant_case* "}"

variant_case    ::= ident "{" prop_assignment* "}"
```

variant_block is valid inside: surface_body, text_body.
variant_block is NOT valid in comp_body, stack_body, state_body,
motion_body, intent_body, or slot_body.

---

## G15. Accessible Block

```
accessible_block ::= "accessible" "{" a11y_statement* "}"

a11y_statement   ::= "role"        ":" role_value
                   | "label"       ":" string_lit
                   | "description" ":" string_lit
                   | "live"        ":" live_val
                   | "hidden"      ":" bool_val
                   | comment

role_value       ::= "article" | "button" | "dialog" | "img"
                   | "link"    | "list"   | "listitem" | "region"
                   | "status"  | "textbox"

live_val         ::= "polite" | "assertive" | "off"
```

accessible_block is valid only in comp_body.
A component may have at most one accessible_block.

---

## G16. Constraints Block

```
constraints_block  ::= "constraints" "{" constraint_rule* "}"

constraint_rule    ::= constraint_verb constraint_target

constraint_verb    ::= "forbid" | "require" | "warn"

constraint_target  ::= "hardcoded" ":" hardcoded_kind
                     | "accessible.label"
                     | "accessible.role"

hardcoded_kind     ::= "color" | "spacing" | "depth" | "any"
```

constraints_block is valid only in comp_body.
A component may have at most one constraints_block.
Standalone constraints.fl is NOT supported in v0.2.

---

# PART IV — FULLY CORRECTED VALIDATION RULES

Rules are grouped by node type. VR codes are stable across versions.
Compiler must check all rules. Rules marked [ERROR] abort compilation.
Rules marked [WARN] emit a warning and continue.

---

## Tokens and Themes

VR-T1  [ERROR] Token paths within a tokens block must be unique.
VR-T2  [WARN]  A theme should not redefine a token to the same value as its parent.
VR-T3  [ERROR] Every token(path) reference in a component must resolve to a declared token.
VR-T4  [ERROR] A token path must not repeat the block name prefix inside the block.
               Correct: tokens color { text.primary: #111 }
               Wrong:   tokens color { color.text.primary: #111 }

---

## Component

VR-C1  [ERROR] A component body must contain exactly one root layout element.
               The root must be either surface_node or stack_node.
               Zero root elements or two root elements are both errors.
VR-C2  [ERROR] A component body must contain at most one intent_node.
VR-C3  [ERROR] A component body must contain at most one accessible_block.
VR-C4  [ERROR] A component body must contain at most one constraints_block.
VR-C5  [ERROR] A variant param default value must appear in the param's value list.
VR-C6  [ERROR] A variant param ident must not be a built-in state name.
               Built-in state names: hover focus active disabled loading
                                     error empty selected checked
VR-C7  [ERROR] A variant param value must not be a built-in state name.
               (Same list as VR-C6. Bans both axis names and axis values.)
VR-C8  [ERROR] A component with an intent_node that has no label property is an error.
               (VR-I1 already covers this. VR-C8 makes it a component-level check too.)

---

## Surface

VR-S1  [ERROR] fill, radius, padding, depth, outline, width, height must be token_ref.
               Exception: fill and outline may also be the keyword `transparent`.
VR-S2  [ERROR] opacity must be a number in range [0.0, 1.0].
VR-S3  [ERROR] text-color, size, weight, content, level, truncate, align are not valid
               surface properties.
VR-S4  [ERROR] No property name may appear more than once in a surface_body
               (not counting inside state_block or variant_block).

---

## Stack

VR-K1  [ERROR] stack_body must not contain prop_assignment, state_block,
               variant_block, or motion_block.
VR-K2  [INFO]  direction defaults to vertical when no stack_args are present.
VR-K3  [ERROR] gap, if present, must be a token_ref.

---

## Text

VR-TX1 [ERROR] text-color must be a token_ref.
VR-TX2 [ERROR] size must be a token_ref.
VR-TX3 [ERROR] level is required when role is heading. It is invalid when role is not heading.
VR-TX4 [ERROR] level must be a number in range [1, 6].
VR-TX5 [ERROR] fill, radius, padding, depth, outline, width, height, aspect are not valid
               text properties.
VR-TX6 [INFO]  A text node without a content property emits an empty text node. No error.

---

## Slot

VR-SL1 [ERROR] Slot names must be unique within a component.
VR-SL2 [WARN]  A required slot with no content at instantiation is a warning.
               (v0.2 has no instantiation syntax; this warning fires when component
                definition references a required slot but no fallback is provided.)
VR-SL3 [WARN]  A slot type hint violation is a warning, not an error.
VR-SL4 [ERROR] A slot body may contain only: required, fallback, comments.
               No prop_assignment is valid in a slot body.

---

## Intent

VR-I1  [ERROR] An intent_node must have a label property. Missing label is an error.
VR-I2  [ERROR] @-references in intent label must resolve to a declared prop name.
               @name is valid only if the component declares prop name or variant name.
VR-I3  [ERROR] A component may have at most one intent_node.
VR-I4  [ERROR] intent_node is valid only in comp_body.
               intent_node inside surface_body or stack_body is an error.

---

## State

VR-ST1 [ERROR] State bodies may contain only: prop_assignment and at most one transition_prop.
VR-ST2 [ERROR] State bodies may not contain nested elements (no surface, stack, text, slot).
VR-ST3 [ERROR] State bodies may not contain nested state blocks.
VR-ST4 [ERROR] State blocks are valid only inside: surface_body, text_body, intent_body.
VR-ST5 [ERROR] transition_prop must use the shift verb.
VR-ST6 [ERROR] transition shift requires exactly two token_ref args: duration then ease.
VR-ST7 [ERROR] Properties inside a state block must be valid for the containing element.
               A state inside surface_body may only use surface-valid properties.
               A state inside text_body may only use text-valid properties.
VR-ST8 [ERROR] A state_name must not duplicate a state_name already defined in the
               same containing element.

---

## Motion

VR-M1  [ERROR] motion enter requires: duration, ease, from (anim_value), to (anim_value).
VR-M2  [ERROR] motion exit requires: duration, ease, from (anim_value), to (anim_value).
VR-M3  [ERROR] motion pulse requires: duration, ease, property, from (number), to (number).
VR-M4  [ERROR] motion reveal requires: duration and ease only.
               from, to, property are not valid in motion reveal.
VR-M5  [ERROR] duration and ease must be token_ref values.
VR-M6  [ERROR] A surface may have at most one enter block.
VR-M7  [ERROR] A surface may have at most one exit block.
VR-M8  [ERROR] A surface may have at most one pulse block.
VR-M9  [ERROR] A surface may have at most one reveal block.
VR-M10 [ERROR] motion_block is valid only inside surface_body.
VR-M11 [ERROR] enter/exit from/to must use the parenthesized anim_prop_entry form.
               Bare numbers are not valid for enter/exit.
VR-M12 [ERROR] pulse from/to must use bare numbers. Parenthesized form is not valid for pulse.
VR-M13 [ERROR] anim_prop_name must be one of: opacity, x, y, scale.
               No other property names are valid in from/to.

---

## Variant

VR-V1  [ERROR] The variant ident must match a variant axis declared in component params.
VR-V2  [ERROR] Every value in the axis list must appear as a variant_case ident,
               except the default value. The default is expressed as the element's
               own baseline properties, not as a variant case.
VR-V3  [ERROR] No variant_case ident may be absent from the axis value list.
VR-V4  [ERROR] variant_case bodies may contain only prop_assignment.
               No elements, state blocks, motion blocks, or nested variant blocks.
VR-V5  [ERROR] Properties in a variant_case must be valid for the containing element.
               A variant in surface_body may only use surface-valid properties.
               A variant in text_body may only use text-valid properties.
               text-color is not valid in a surface variant_case.
VR-V6  [ERROR] The same variant ident may not appear more than once in the same
               element body (at the same nesting level).

---

## Accessible

VR-A1  [ERROR] A component with an intent and no accessible label is an error.
               The label may come from either: accessible_block label property,
               or intent_node label property. At least one must be present.
VR-A2  [ERROR] @-references in label or description must resolve to declared props.
VR-A3  [ERROR] role must be one of the enumerated role_value values.
               Arbitrary ident roles are not accepted (removed from grammar).

---

## Reference (@)

VR-R1  [ERROR] @name in any string value must resolve to a declared prop ident
               or variant axis ident in the same component's params.
VR-R2  [ERROR] @name with dot-path (@name.field) is not valid in v0.2.
VR-R3  [ERROR] A prop ident and a slot ident with the same name in the same component
               is an error. (Eliminates ambiguous @-reference.)

---

# PART V — CANONICAL EXAMPLES

All examples parse under the grammar in Part III exactly.
All examples pass all validation rules in Part IV.
No annotations are needed — examples must speak for themselves.

---

## E1. Button

```framelab
component Button(
  variant size: [sm, md, lg] = md
  variant tone: [primary, ghost, danger] = primary
  prop label-text: text = "Button"
) {
  surface {
    fill:    token(color.action.primary)
    radius:  token(radius.full)
    padding: token(space.inset.sm)
    depth:   token(depth.0)

    state hover {
      depth:      token(depth.2)
      transition: shift( token(duration.quick) token(ease.lift) )
    }
    state active {
      depth:      token(depth.0)
      transition: shift( token(duration.instant) token(ease.snap) )
    }
    state disabled {
      opacity: 0.4
    }

    variant tone {
      ghost  { fill: transparent  outline: token(color.action.primary) }
      danger { fill: token(color.status.error) }
    }

    variant size {
      sm { padding: token(space.inset.xs) }
      lg { padding: token(space.inset.md) }
    }

    motion enter {
      from: ( opacity: 0 )
      to:   ( opacity: 1 )
      duration: token(duration.quick)
      ease:     token(ease.out)
    }
  }

  slot label: text

  intent trigger: "button-action" {
    label: "@label-text"
  }

  accessible {
    role: button
  }
}
```

---

## E2. Product Card

```framelab
component ProductCard(
  prop title-text: text = ""
) {
  surface {
    fill:    token(surface.raised)
    radius:  token(radius.card)
    padding: token(space.inset.md)
    depth:   token(depth.2)

    state hover {
      depth:      token(depth.4)
      transition: shift( token(duration.quick) token(ease.lift) )
    }
    state loading {
      fill: token(surface.skeleton)
    }

    motion enter {
      from: ( opacity: 0  y: 8 )
      to:   ( opacity: 1  y: 0 )
      duration: token(duration.normal)
      ease:     token(ease.spring)
    }

    stack(direction: vertical, gap: token(space.gap.md)) {
      slot thumbnail: surface
      stack(direction: vertical, gap: token(space.gap.sm)) {
        slot category: text
        slot title: text { required }
        slot price: text  { required }
      }
      slot actions: any
    }
  }

  intent navigate: "product-detail" {
    label: "@title-text"
  }

  accessible {
    role:  article
    label: "@title-text"
  }
}
```

---

## E3. Avatar

```framelab
component Avatar(
  variant size:  [xs, sm, md, lg] = md
  variant shape: [circle, square] = circle
  prop name-text: text = ""
) {
  surface {
    aspect: 1/1
    fill:   token(surface.media)

    variant size {
      xs { width: token(size.avatar.xs) }
      sm { width: token(size.avatar.sm) }
      lg { width: token(size.avatar.lg) }
    }

    variant shape {
      square { radius: token(radius.sm) }
    }

    state loading {
      fill: token(surface.skeleton)
    }

    motion pulse {
      property: opacity
      from:     0.5
      to:       1.0
      duration: token(duration.slow)
      ease:     token(ease.breath)
    }

    slot image: surface
    slot fallback: text
  }

  accessible {
    role:  img
    label: "@name-text"
  }
}
```

---

## E4. Badge

```framelab
component Badge(
  variant tone: [neutral, success, warning, error, info] = neutral
) {
  surface {
    fill:    token(color.surface.subtle)
    radius:  token(radius.full)
    padding: token(space.inset.xs)

    variant tone {
      success { fill: token(color.status.success.bg) }
      warning { fill: token(color.status.warning.bg) }
      error   { fill: token(color.status.error.bg)   }
      info    { fill: token(color.status.info.bg)    }
    }

    stack(direction: horizontal, gap: token(space.gap.xs)) {
      text {
        text-color: token(color.text.secondary)
        size:       token(type.xs)
      }
      slot label: text { required }
    }
  }

  accessible {
    role: status
  }
}
```

Explanation: Badge cannot set text-color on surface (VR-V5). Instead it
wraps content in a text node that each variant would need to override via
a text variant block. For v0.2 the default text-color is expressed on the
text node directly. Per-tone text color variation requires the text node to
also carry a variant block referencing the same `tone` axis.

---

## E4b. Badge (with per-tone text color via text variant)

```framelab
component Badge(
  variant tone: [neutral, success, warning, error, info] = neutral
) {
  surface {
    fill:    token(color.surface.subtle)
    radius:  token(radius.full)
    padding: token(space.inset.xs)

    variant tone {
      success { fill: token(color.status.success.bg) }
      warning { fill: token(color.status.warning.bg) }
      error   { fill: token(color.status.error.bg)   }
      info    { fill: token(color.status.info.bg)    }
    }

    text {
      text-color: token(color.text.secondary)
      size:       token(type.xs)

      variant tone {
        success { text-color: token(color.status.success.fg) }
        warning { text-color: token(color.status.warning.fg) }
        error   { text-color: token(color.status.error.fg)   }
        info    { text-color: token(color.status.info.fg)    }
      }

      slot label: text { required }
    }
  }

  accessible {
    role: status
  }
}
```

---

## E5. Text Input

```framelab
component TextInput(
  prop label-text:       text = ""
  prop hint-text:        text = ""
  prop placeholder-text: text = ""
) {
  surface {
    fill:    token(surface.input)
    radius:  token(radius.input)
    padding: token(space.inset.sm)
    outline: token(color.border.default)

    state focus {
      outline:    token(color.focus.ring)
      transition: shift( token(duration.quick) token(ease.out) )
    }
    state error {
      outline: token(color.status.error)
    }
    state disabled {
      opacity: 0.5
      fill:    token(surface.disabled)
    }

    slot label:     text { required }
    slot hint:      text
    slot error-msg: text
  }

  intent submit: "input-submit" {
    label: "@label-text"
  }

  accessible {
    role:        textbox
    label:       "@label-text"
    description: "@hint-text"
  }
}
```

---

## E6. Navigation Item

```framelab
component NavItem(
  variant emphasis: [default, current, suppressed] = default
  prop label-text: text = ""
) {
  surface {
    padding: token(space.inset.sm)
    radius:  token(radius.sm)
    fill:    token(surface.base)

    state hover {
      fill:       token(surface.hover)
      transition: shift( token(duration.quick) token(ease.out) )
    }
    state disabled {
      opacity: 0.4
    }

    variant emphasis {
      current    { fill: token(surface.selected)  outline: token(color.action.primary) }
      suppressed { opacity: 0.4 }
    }

    stack(direction: horizontal, gap: token(space.gap.sm)) {
      slot icon:  surface
      slot label: text { required }
      slot badge: surface
    }
  }

  intent navigate: "nav-item" {
    label: "@label-text"
  }

  accessible {
    role:  link
    label: "@label-text"
  }
}
```

---

## E7. Modal

```framelab
component Modal(
  prop title-text: text = ""
) {
  surface {
    fill:    token(surface.overlay)
    radius:  token(radius.modal)
    padding: token(space.inset.lg)
    depth:   token(depth.8)

    motion enter {
      from: ( opacity: 0  y: 16 )
      to:   ( opacity: 1  y: 0  )
      duration: token(duration.normal)
      ease:     token(ease.spring)
    }

    motion exit {
      from: ( opacity: 1  y: 0 )
      to:   ( opacity: 0  y: 8 )
      duration: token(duration.quick)
      ease:     token(ease.out)
    }

    stack(direction: vertical, gap: token(space.gap.lg)) {
      slot header: surface
      slot body:   any    { required }
      slot footer: surface
    }
  }

  intent dismiss: "close-modal" {
    label: "Close dialog"
  }

  accessible {
    role:  dialog
    label: "@title-text"
    live:  assertive
  }
}
```

---

## E8. Toast Notification

```framelab
component Toast(
  variant tone: [info, success, warning, error] = info
  prop message-text: text = ""
) {
  surface {
    fill:    token(surface.raised)
    radius:  token(radius.card)
    padding: token(space.inset.sm)
    depth:   token(depth.4)
    outline: token(color.status.info)

    variant tone {
      success { outline: token(color.status.success) }
      warning { outline: token(color.status.warning) }
      error   { outline: token(color.status.error)   }
    }

    motion enter {
      from: ( opacity: 0  x: 24 )
      to:   ( opacity: 1  x: 0  )
      duration: token(duration.normal)
      ease:     token(ease.spring)
    }

    motion exit {
      from: ( opacity: 1 )
      to:   ( opacity: 0 )
      duration: token(duration.quick)
      ease:     token(ease.out)
    }

    stack(direction: horizontal, gap: token(space.gap.md)) {
      slot icon:    surface
      slot message: text  { required }
      slot action:  any
    }
  }

  intent dismiss: "dismiss-toast" {
    label: "Dismiss notification"
  }

  accessible {
    role:  status
    live:  polite
    label: "@message-text"
  }
}
```

---

## E9. Skeleton

```framelab
component Skeleton(
  variant shape: [line, avatar, card] = line
) {
  surface {
    fill:   token(surface.skeleton)
    radius: token(radius.sm)
    height: token(size.skeleton.line)

    variant shape {
      avatar { aspect: 1/1   radius: token(radius.full)  width: token(size.avatar.md) }
      card   { aspect: 4/3   radius: token(radius.card)                               }
    }

    motion pulse {
      property: opacity
      from:     0.4
      to:       1.0
      duration: token(duration.slow)
      ease:     token(ease.breath)
    }
  }

  accessible {
    role:   img
    label:  "Loading"
    hidden: false
  }
}
```

---

## E10. Chip

```framelab
component Chip(
  variant tone: [neutral, brand, success, warning, error] = neutral
  prop label-text: text = ""
) {
  surface {
    fill:    token(color.surface.subtle)
    radius:  token(radius.full)
    padding: token(space.inset.xs)

    state hover {
      fill:       token(surface.hover)
      transition: shift( token(duration.quick) token(ease.out) )
    }

    variant tone {
      brand   { fill: token(color.brand.subtle)      }
      success { fill: token(color.status.success.bg) }
      warning { fill: token(color.status.warning.bg) }
      error   { fill: token(color.status.error.bg)   }
    }

    stack(direction: horizontal, gap: token(space.gap.xs)) {
      slot icon:   surface
      text {
        content:    "@label-text"
        text-color: token(color.text.secondary)
        size:       token(type.sm)
      }
      slot remove: surface
    }
  }

  accessible {
    role:  listitem
    label: "@label-text"
  }
}
```

Note: slot label replaced with a text node carrying @label-text content,
since the Chip renders its own label rather than accepting external text.
The slot label was aspirational — requiring no external text content,
since Chip is instantiated with a label-text prop. The remove slot is retained
as an optional composition point.

---

# PART VI — WHAT CHANGED FROM REVISED SPEC

| # | Issue | Decision | Impact |
|---|-------|----------|--------|
| FI-1  | Intent scope contradiction    | Intent at comp_body only       | Grammar authoritative over D6 prose |
| FI-2  | Motion scope contradiction    | Motion inside surface_body only | Grammar authoritative over D1 table |
| FI-3  | Required slot contradiction   | Missing required = WARNING      | D4 promise of error was wrong |
| FI-4  | prop_assignment undefined      | Fully defined in G4             | Parser now unambiguous |
| FI-5  | prop_list undefined            | Defined as anim_value in G13    | motion from/to now parseable |
| FI-6  | heading level property missing | Added to G9 and VR-TX3/4        | text as heading now enforced |
| FI-7  | Slot declaration vs placement  | Same construct, documented      | No split in v0.2 |
| FI-8  | Standalone constraints         | Removed from v0.2               | Only per-component constraints |
| FI-9  | text-color on surface          | Invalid on surface              | Badge/Chip restructured (E4b) |
| FI-11 | Param comma separator          | No commas, newline-separated    | All examples corrected |
| FI-12 | `transparent` not in grammar   | Added as reserved value keyword | Button ghost variant now parses |
| FI-13 | Single-entry anim list         | Valid per G13 anim_value rule   | Toast exit now parses |
| FI-14 | Variant values = state names   | VR-C7 bans both names and values| NavItem active→current, disabled→suppressed |
