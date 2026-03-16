export interface SourcePos {
  line: number
  col: number
  offset: number
}

export interface NodeBase {
  kind: string
  pos: SourcePos
}

export interface ProgramNode extends NodeBase {
  kind: "Program"
  declarations: DeclarationNode[]
}

export type DeclarationNode =
  | TokensDeclNode
  | ThemeDeclNode
  | ComponentDeclNode

export interface TokensDeclNode extends NodeBase {
  kind: "TokensDecl"
  name: string
  defs: TokenDefNode[]
}

export interface TokenDefNode extends NodeBase {
  kind: "TokenDef"
  path: string
  value: TokenValueNode
}

export type TokenValueNode =
  | HexColorNode
  | StringValNode
  | NumberValNode

export interface ThemeDeclNode extends NodeBase {
  kind: "ThemeDecl"
  name: string
  extends: string | null
  defs: TokenDefNode[]
}

export interface ComponentDeclNode extends NodeBase {
  kind: "ComponentDecl"
  name: string
  params: ParamNode[]
  body: CompStatementNode[]
}

export type ParamNode = VariantParamNode | PropParamNode

export interface VariantParamNode extends NodeBase {
  kind: "VariantParam"
  axis: string
  values: string[]
  default: string | null
}

export interface PropParamNode extends NodeBase {
  kind: "PropParam"
  name: string
  propType: "text" | "number" | "boolean"
  default: LiteralNode | null
}

export type CompStatementNode =
  | SurfaceNode
  | StackNode
  | SlotNode
  | IntentNode
  | AccessibleNode
  | ConstraintsNode

export interface SurfaceNode extends NodeBase {
  kind: "Surface"
  role: string | null
  body: SurfaceStatementNode[]
}

export type RenderNode = SurfaceNode | StackNode | SlotNode | TextNode

export type SurfaceStatementNode =
  | PropAssignmentNode
  | StateNode
  | VariantBlockNode
  | MotionBlockNode
  | RenderNode

export interface StackNode extends NodeBase {
  kind: "Stack"
  args: StackPropNode[]
  body: StackStatementNode[]
}

export type StackStatementNode = RenderNode

export interface StackPropNode extends NodeBase {
  kind: "StackProp"
  name: "direction" | "gap" | "align" | "justify" | "wrap"
  value: TokenRefNode | BoolNode | KeywordValNode
}

export interface TextNode extends NodeBase {
  kind: "Text"
  role: string | null
  body: TextStatementNode[]
}

export type TextStatementNode =
  | PropAssignmentNode
  | StateNode
  | VariantBlockNode
  | SlotNode

export interface SlotNode extends NodeBase {
  kind: "Slot"
  name: string
  typeHint: "text" | "surface" | "any" | null
  body: SlotStatementNode[]
}

export type SlotStatementNode = SlotRequiredNode | FallbackNode

export interface SlotRequiredNode extends NodeBase {
  kind: "SlotRequired"
}

export interface FallbackNode extends NodeBase {
  kind: "Fallback"
  body: RenderNode[]
}

export interface IntentNode extends NodeBase {
  kind: "Intent"
  intentKind: "trigger" | "navigate" | "submit" | "toggle" | "expand" | "dismiss"
  identifier: string
  body: IntentStatementNode[]
}

export type IntentStatementNode = IntentLabelNode | StateNode

export interface IntentLabelNode extends NodeBase {
  kind: "IntentLabel"
  value: string
}

export interface StateNode extends NodeBase {
  kind: "State"
  stateName: string
  body: StateStatementNode[]
}

export type StateStatementNode = PropAssignmentNode | TransitionPropNode

export interface TransitionPropNode extends NodeBase {
  kind: "TransitionProp"
  value: TransitionValueNode
}

export interface TransitionValueNode extends NodeBase {
  kind: "TransitionValue"
  verb: "shift"
  duration: TokenRefNode
  ease: TokenRefNode
}

export interface MotionBlockNode extends NodeBase {
  kind: "Motion"
  verb: "enter" | "exit" | "pulse" | "reveal"
  body: MotionStatementNode[]
}

export type MotionStatementNode =
  | MotionDurationNode
  | MotionEaseNode
  | MotionFromNode
  | MotionToNode
  | MotionPropertyNode

export interface MotionDurationNode extends NodeBase {
  kind: "MotionDuration"
  value: TokenRefNode
}

export interface MotionEaseNode extends NodeBase {
  kind: "MotionEase"
  value: TokenRefNode
}

export interface MotionFromNode extends NodeBase {
  kind: "MotionFrom"
  value: AnimValueNode
}

export interface MotionToNode extends NodeBase {
  kind: "MotionTo"
  value: AnimValueNode
}

export interface MotionPropertyNode extends NodeBase {
  kind: "MotionProperty"
  value: "opacity" | "x" | "y" | "scale"
}

export type AnimValueNode = AnimPropsNode | NumberNode

export interface AnimPropsNode extends NodeBase {
  kind: "AnimProps"
  props: AnimPropEntryNode[]
}

export interface AnimPropEntryNode extends NodeBase {
  kind: "AnimPropEntry"
  name: "opacity" | "x" | "y" | "scale"
  value: number
}

export interface VariantBlockNode extends NodeBase {
  kind: "VariantBlock"
  axis: string
  cases: VariantCaseNode[]
}

export interface VariantCaseNode extends NodeBase {
  kind: "VariantCase"
  value: string
  props: PropAssignmentNode[]
}

export interface AccessibleNode extends NodeBase {
  kind: "Accessible"
  body: AccessibleStatementNode[]
}

export type AccessibleStatementNode =
  | AccessibleRoleNode
  | AccessibleLabelNode
  | AccessibleDescriptionNode
  | AccessibleLiveNode
  | AccessibleHiddenNode

export interface AccessibleRoleNode extends NodeBase {
  kind: "AccessibleRole"
  value: string
}

export interface AccessibleLabelNode extends NodeBase {
  kind: "AccessibleLabel"
  value: string
}

export interface AccessibleDescriptionNode extends NodeBase {
  kind: "AccessibleDescription"
  value: string
}

export interface AccessibleLiveNode extends NodeBase {
  kind: "AccessibleLive"
  value: string
}

export interface AccessibleHiddenNode extends NodeBase {
  kind: "AccessibleHidden"
  value: boolean
}

export interface ConstraintsNode extends NodeBase {
  kind: "Constraints"
  rules: ConstraintRuleNode[]
}

export interface ConstraintRuleNode extends NodeBase {
  kind: "ConstraintRule"
  verb: "forbid" | "require" | "warn"
  target: ConstraintTargetNode
}

export type ConstraintTargetNode =
  | HardcodedTargetNode
  | AccessibleLabelTargetNode
  | AccessibleRoleTargetNode

export interface HardcodedTargetNode extends NodeBase {
  kind: "HardcodedTarget"
  what: "color" | "spacing" | "depth" | "any"
}

export interface AccessibleLabelTargetNode extends NodeBase {
  kind: "AccessibleLabelTarget"
}

export interface AccessibleRoleTargetNode extends NodeBase {
  kind: "AccessibleRoleTarget"
}

export interface PropAssignmentNode extends NodeBase {
  kind: "PropAssignment"
  name: string
  value: PropValueNode
}

export type PropValueNode =
  | TokenRefNode
  | StringLitNode
  | NumberNode
  | BoolNode
  | TransparentNode
  | AspectValNode
  | KeywordValNode
  | ReferenceNode

export interface TokenRefNode extends NodeBase {
  kind: "TokenRef"
  path: string
}

export interface StringLitNode extends NodeBase {
  kind: "StringLit"
  value: string
}

export interface StringValNode extends NodeBase {
  kind: "StringVal"
  value: string
}

export interface HexColorNode extends NodeBase {
  kind: "HexColor"
  value: string
}

export interface NumberNode extends NodeBase {
  kind: "Number"
  value: number
  suffix?: "px" | "rem" | "em" | "%"
}

export interface NumberValNode extends NodeBase {
  kind: "NumberVal"
  value: number
  suffix?: "px" | "rem" | "em" | "%"
}

export interface BoolNode extends NodeBase {
  kind: "Bool"
  value: boolean
}

export interface TransparentNode extends NodeBase {
  kind: "Transparent"
}

export interface AspectValNode extends NodeBase {
  kind: "AspectVal"
  w: number
  h: number
}

export interface KeywordValNode extends NodeBase {
  kind: "KeywordVal"
  value: string
}

export interface ReferenceNode extends NodeBase {
  kind: "Reference"
  name: string
}

export type LiteralNode = StringLitNode | NumberNode | BoolNode
