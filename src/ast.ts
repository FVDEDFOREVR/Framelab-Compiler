// =============================================================================
// FRAMELAB AST — v0.1 MVP
// Covers: component, surface, stack, text, props, bindings, token refs
// =============================================================================

export interface SourceLocation {
  file:        string
  startLine:   number
  startColumn: number
  endLine:     number
  endColumn:   number
}

// Every AST node carries a source location for error reporting + sourcemaps
export interface Node {
  kind: string
  loc:  SourceLocation
}

// -----------------------------------------------------------------------------
// Program
// -----------------------------------------------------------------------------

export interface Program extends Node {
  kind: "Program"
  body: TopLevelDecl[]
}

export type TopLevelDecl =
  | ComponentDecl
  | TokensDecl
  | ThemeDecl

// -----------------------------------------------------------------------------
// Tokens & Themes
// -----------------------------------------------------------------------------

export interface TokensDecl extends Node {
  kind:    "TokensDecl"
  name:    string
  entries: TokenEntry[]
}

export interface TokenEntry extends Node {
  kind:  "TokenEntry"
  path:  string[]          // ["color", "text", "primary"]
  value: TokenValue
}

export type TokenValue =
  | ColorValue
  | DimensionValue
  | DurationValue
  | StringValue
  | NumberValue

export interface ColorValue     { kind: "ColorValue";     value: string }
export interface DimensionValue { kind: "DimensionValue"; value: number; unit: string }
export interface DurationValue  { kind: "DurationValue";  value: number; unit: "ms" | "s" }
export interface StringValue    { kind: "StringValue";    value: string }
export interface NumberValue    { kind: "NumberValue";    value: number }

export interface ThemeDecl extends Node {
  kind:    "ThemeDecl"
  name:    string
  extends: string | null
  entries: TokenEntry[]
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export interface ComponentDecl extends Node {
  kind:   "ComponentDecl"
  name:   string
  params: ComponentParam[]
  body:   ComponentBodyItem[]
}

export type ComponentParam =
  | VariantParam
  | PropParam

export interface VariantParam extends Node {
  kind:         "VariantParam"
  name:         string
  options:      string[]
  defaultValue: string
}

export interface PropParam extends Node {
  kind:         "PropParam"
  name:         string
  typeExpr:     TypeExpr
  defaultValue: Literal | null
}

export interface TypeExpr extends Node {
  kind:     "TypeExpr"
  base:     string           // "String" | "Int" | "Boolean" | custom
  isList:   boolean
  nullable: boolean
}

export type ComponentBodyItem =
  | VisualNode
  | StateBlock
  | SlotDecl
  | RoleDecl
  | A11yDecl

// -----------------------------------------------------------------------------
// Visual Nodes
// -----------------------------------------------------------------------------

export interface VisualNode extends Node {
  kind:     "VisualNode"
  nodeType: NodeType
  alias:    string | null
  props:    Prop[]
  children: NodeChild[]
}

// Built-in node types
export type NodeType =
  | "surface"
  | "stack"
  | "text"
  | "image"
  | "icon"
  | "input"
  | "spinner"
  | string   // component reference

export interface Prop extends Node {
  kind:  "Prop"
  name:  string
  value: PropValue
}

export type PropValue =
  | TokenRef
  | BindingExpr
  | TernaryExpr
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | VariantExpr

export interface TokenRef extends Node {
  kind: "TokenRef"
  path: string[]           // ["color", "text", "primary"]
}

export interface BindingExpr extends Node {
  kind: "BindingExpr"
  path: string[]           // ["product", "title"] from @product.title
}

export interface TernaryExpr extends Node {
  kind:       "TernaryExpr"
  condition:  Expr
  consequent: PropValue
  alternate:  PropValue
}

export interface VariantExpr extends Node {
  kind:    "VariantExpr"
  param:   string
  entries: VariantEntry[]
}

export interface VariantEntry {
  variant: string
  value:   PropValue
}

// -----------------------------------------------------------------------------
// Node Children
// -----------------------------------------------------------------------------

export type NodeChild =
  | VisualNode
  | WhenBlock
  | RepeatBlock
  | IntentDecl
  | TextContent

// Inline text content: text { content: "Hello" } or text { content: @title }
export interface TextContent extends Node {
  kind:  "TextContent"
  value: StringLiteral | BindingExpr
}

// -----------------------------------------------------------------------------
// Control Flow
// -----------------------------------------------------------------------------

export interface WhenBlock extends Node {
  kind:       "WhenBlock"
  condition:  ConditionExpr
  consequent: NodeChild[]
  alternate:  NodeChild[] | null
}

export type ConditionExpr =
  | IsCondition
  | TruthyCondition

export interface IsCondition extends Node {
  kind:    "IsCondition"
  binding: BindingExpr
  value:   string
  negate:  boolean
}

export interface TruthyCondition extends Node {
  kind:    "TruthyCondition"
  binding: BindingExpr
  negate:  boolean
}

export interface RepeatBlock extends Node {
  kind:     "RepeatBlock"
  source:   BindingExpr | NumberLiteral
  itemName: string | null
  idxName:  string | null
  keyExpr:  BindingExpr | null
  children: NodeChild[]
  empty:    NodeChild[] | null
}

// -----------------------------------------------------------------------------
// States
// -----------------------------------------------------------------------------

export interface StateBlock extends Node {
  kind:  "StateBlock"
  name:  string
  props: StateProps[]
}

export interface MotionProp extends Node {
  kind:     "MotionProp"
  verb:     string
  duration: PropValue
  ease:     PropValue
  stagger:  DurationValue | null
}

export interface GuardProp extends Node {
  kind:      "GuardProp"
  condition: ConditionExpr
}

export type StateProps = Prop | MotionProp | GuardProp

// -----------------------------------------------------------------------------
// Slots
// -----------------------------------------------------------------------------

export interface SlotDecl extends Node {
  kind:     "SlotDecl"
  name:     string
  modifier: "required" | "empty" | "accessible-only" | null
  defaults: NodeChild[] | null
}

// -----------------------------------------------------------------------------
// Intents
// -----------------------------------------------------------------------------

export interface IntentDecl extends Node {
  kind:            "IntentDecl"
  intentType:      "trigger" | "navigate" | "toggle" | "submit"
  label:           StringLiteral | BindingExpr
  accessibleLabel: Expr | null
  tone:            TokenRef | null
  disabled:        Expr | null
  handlers:        GestureHandler[]
  states:          StateBlock[]
}

export interface GestureHandler extends Node {
  kind:    "GestureHandler"
  gesture: string
  action:  ActionCall
}

export interface ActionCall extends Node {
  kind: "ActionCall"
  name: string
  args: Expr[]
}

// -----------------------------------------------------------------------------
// Accessibility
// -----------------------------------------------------------------------------

export interface RoleDecl extends Node {
  kind: "RoleDecl"
  role: string
}

export interface A11yDecl extends Node {
  kind:     "A11yDecl"
  property: "label" | "description" | "hidden" | "live"
  value:    Expr | string
}

// -----------------------------------------------------------------------------
// Expressions & Literals
// -----------------------------------------------------------------------------

export type Expr =
  | BindingExpr
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral
  | BinaryExpr
  | UnaryExpr

export interface BinaryExpr extends Node {
  kind:     "BinaryExpr"
  left:     Expr
  operator: string
  right:    Expr
}

export interface UnaryExpr extends Node {
  kind:     "UnaryExpr"
  operator: "not"
  operand:  Expr
}

export type Literal =
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullLiteral

export interface StringLiteral  extends Node { kind: "StringLiteral";  value: string  }
export interface NumberLiteral  extends Node { kind: "NumberLiteral";  value: number  }
export interface BooleanLiteral extends Node { kind: "BooleanLiteral"; value: boolean }
export interface NullLiteral    extends Node { kind: "NullLiteral"                    }
