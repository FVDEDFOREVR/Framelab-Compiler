import { DiagnosticSeverity, SourceSpan } from "./diagnostics"

export interface SourceProvenance {
  sourceKind: string
  span: SourceSpan
}

export interface AnalyzedNodeBase {
  kind: string
  provenance: SourceProvenance
}

export interface AnalyzedProgram extends AnalyzedNodeBase {
  kind: "AnalyzedProgram"
  declarations: AnalyzedDeclaration[]
}

export type AnalyzedDeclaration =
  | AnalyzedTokens
  | AnalyzedTheme
  | AnalyzedComponent

export interface AnalyzedTokens extends AnalyzedNodeBase {
  kind: "AnalyzedTokens"
  name: string
  defs: AnalyzedTokenDef[]
}

export interface AnalyzedTheme extends AnalyzedNodeBase {
  kind: "AnalyzedTheme"
  name: string
  extends: string | null
  defs: AnalyzedTokenDef[]
}

export interface AnalyzedTokenDef extends AnalyzedNodeBase {
  kind: "AnalyzedTokenDef"
  path: string
  value: AnalyzedTokenValue
}

export type AnalyzedTokenValue =
  | { kind: "HexColor"; value: string }
  | { kind: "StringVal"; value: string }
  | { kind: "NumberVal"; value: number; suffix?: "px" | "rem" | "em" | "%" }

export interface AnalyzedComponent extends AnalyzedNodeBase {
  kind: "AnalyzedComponent"
  name: string
  variants: AnalyzedVariantParam[]
  props: AnalyzedPropParam[]
  root: AnalyzedSurface | AnalyzedStack
  intent: AnalyzedIntent | null
  accessible: AnalyzedAccessible | null
  constraints: AnalyzedConstraints | null
  declarationOrder: AnalyzedTopLevelOrderEntry[]
}

export interface AnalyzedTopLevelOrderEntry extends AnalyzedNodeBase {
  kind: "AnalyzedTopLevelOrderEntry"
  entryKind: "root" | "intent" | "accessible" | "constraints"
  ordinal: number
}

export interface AnalyzedVariantParam extends AnalyzedNodeBase {
  kind: "AnalyzedVariantParam"
  axis: string
  values: string[]
  default: string | null
}

export interface AnalyzedPropParam extends AnalyzedNodeBase {
  kind: "AnalyzedPropParam"
  name: string
  propType: "text" | "number" | "boolean"
  default: string | number | boolean | null
}

export type AnalyzedNode = AnalyzedSurface | AnalyzedStack | AnalyzedText | AnalyzedSlot

export interface AnalyzedSurface extends AnalyzedNodeBase {
  kind: "AnalyzedSurface"
  role: string | null
  props: AnalyzedProp[]
  states: AnalyzedState[]
  variants: AnalyzedVariantBlock[]
  motions: AnalyzedMotion[]
  children: AnalyzedNode[]
}

export interface AnalyzedStack extends AnalyzedNodeBase {
  kind: "AnalyzedStack"
  direction: "vertical" | "horizontal"
  gap: AnalyzedTokenRef | null
  align: string | null
  justify: string | null
  wrap: boolean
  children: AnalyzedNode[]
}

export interface AnalyzedText extends AnalyzedNodeBase {
  kind: "AnalyzedText"
  role: string | null
  props: AnalyzedProp[]
  states: AnalyzedState[]
  variants: AnalyzedVariantBlock[]
  slot: AnalyzedSlot | null
}

export interface AnalyzedSlot extends AnalyzedNodeBase {
  kind: "AnalyzedSlot"
  name: string
  typeHint: "text" | "surface" | "any" | null
  required: boolean
  fallback: AnalyzedNode[] | null
}

export interface AnalyzedIntent extends AnalyzedNodeBase {
  kind: "AnalyzedIntent"
  intentKind: "trigger" | "navigate" | "submit" | "toggle" | "expand" | "dismiss"
  identifier: string
  label: string
  states: AnalyzedState[]
}

export interface AnalyzedAccessible extends AnalyzedNodeBase {
  kind: "AnalyzedAccessible"
  role: string | null
  label: string | null
  description: string | null
  live: string | null
  hidden: boolean | null
}

export interface AnalyzedConstraints extends AnalyzedNodeBase {
  kind: "AnalyzedConstraints"
  rules: AnalyzedConstraintRule[]
}

export interface AnalyzedConstraintRule extends AnalyzedNodeBase {
  kind: "AnalyzedConstraintRule"
  verb: "forbid" | "require" | "warn"
  severity: DiagnosticSeverity
  target: AnalyzedConstraintTarget
}

export type AnalyzedConstraintTarget =
  | { kind: "HardcodedTarget"; what: "color" | "spacing" | "depth" | "any" }
  | { kind: "AccessibleLabelTarget" }
  | { kind: "AccessibleRoleTarget" }

export interface AnalyzedProp extends AnalyzedNodeBase {
  kind: "AnalyzedProp"
  name: string
  value: AnalyzedPropValue
}

export type AnalyzedPropValue =
  | AnalyzedTokenRef
  | { kind: "StringLit"; value: string }
  | { kind: "Number"; value: number; suffix?: "px" | "rem" | "em" | "%" }
  | { kind: "Bool"; value: boolean }
  | { kind: "Transparent" }
  | { kind: "AspectVal"; w: number; h: number }
  | { kind: "KeywordVal"; value: string }
  | { kind: "Reference"; name: string }

export interface AnalyzedTokenRef extends AnalyzedNodeBase {
  kind: "AnalyzedTokenRef"
  path: string
}

export interface AnalyzedState extends AnalyzedNodeBase {
  kind: "AnalyzedState"
  stateName: string
  hostKind: "surface" | "text" | "intent"
  props: AnalyzedProp[]
  transition: AnalyzedTransition | null
}

export interface AnalyzedTransition extends AnalyzedNodeBase {
  kind: "AnalyzedTransition"
  verb: "shift"
  duration: AnalyzedTokenRef
  ease: AnalyzedTokenRef
}

export interface AnalyzedVariantBlock extends AnalyzedNodeBase {
  kind: "AnalyzedVariantBlock"
  axis: string
  cases: AnalyzedVariantCase[]
}

export interface AnalyzedVariantCase extends AnalyzedNodeBase {
  kind: "AnalyzedVariantCase"
  value: string
  props: AnalyzedProp[]
}

export type AnalyzedMotion =
  | AnalyzedEnterMotion
  | AnalyzedExitMotion
  | AnalyzedPulseMotion
  | AnalyzedRevealMotion

export interface AnalyzedEnterMotion extends AnalyzedNodeBase {
  kind: "AnalyzedEnterMotion"
  from: AnalyzedAnimValue | null
  to: AnalyzedAnimValue | null
  duration: AnalyzedTokenRef | null
  ease: AnalyzedTokenRef | null
}

export interface AnalyzedExitMotion extends AnalyzedNodeBase {
  kind: "AnalyzedExitMotion"
  from: AnalyzedAnimValue | null
  to: AnalyzedAnimValue | null
  duration: AnalyzedTokenRef | null
  ease: AnalyzedTokenRef | null
}

export interface AnalyzedPulseMotion extends AnalyzedNodeBase {
  kind: "AnalyzedPulseMotion"
  property: "opacity" | "x" | "y" | "scale" | null
  from: AnalyzedAnimValue | null
  to: AnalyzedAnimValue | null
  duration: AnalyzedTokenRef | null
  ease: AnalyzedTokenRef | null
}

export interface AnalyzedRevealMotion extends AnalyzedNodeBase {
  kind: "AnalyzedRevealMotion"
  duration: AnalyzedTokenRef | null
  ease: AnalyzedTokenRef | null
}

export type AnalyzedAnimValue =
  | { kind: "AnimProps"; props: Array<{ name: "opacity" | "x" | "y" | "scale"; value: number }> }
  | { kind: "Number"; value: number; suffix?: "px" | "rem" | "em" | "%" }
