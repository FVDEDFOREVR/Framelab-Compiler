import { SourceProvenance } from "./analyzed"

export interface IRNodeBase {
  kind: string
  provenance: SourceProvenance
}

export interface IRProgram extends IRNodeBase {
  kind: "IRProgram"
  tokens: IRTokens[]
  themes: IRTheme[]
  components: IRComponent[]
}

export interface IRTokens extends IRNodeBase {
  kind: "IRTokens"
  name: string
  defs: IRTokenDef[]
}

export interface IRTheme extends IRNodeBase {
  kind: "IRTheme"
  name: string
  extends: string | null
  defs: IRTokenDef[]
}

export interface IRTokenDef extends IRNodeBase {
  kind: "IRTokenDef"
  path: string
  value: IRTokenValue
}

export type IRTokenValue =
  | { kind: "HexColor"; value: string }
  | { kind: "StringVal"; value: string }
  | { kind: "NumberVal"; value: number; suffix?: "px" | "rem" | "em" | "%" }

export interface IRComponent extends IRNodeBase {
  kind: "IRComponent"
  name: string
  variants: IRVariantAxis[]
  props: IRPropParam[]
  root: IRSurface | IRStack
  intent: IRIntent | null
  accessible: IRAccessible | null
}

export interface IRVariantAxis extends IRNodeBase {
  kind: "IRVariantAxis"
  axis: string
  values: string[]
  default: string | null
}

export interface IRPropParam extends IRNodeBase {
  kind: "IRPropParam"
  name: string
  propType: "text" | "number" | "boolean"
  default: string | number | boolean | null
}

export type IRNode = IRSurface | IRStack | IRText | IRSlot

export interface IRSurface extends IRNodeBase {
  kind: "IRSurface"
  role: string | null
  props: IRProp[]
  states: IRState[]
  variants: IRVariant[]
  motions: IRMotion[]
  children: IRNode[]
}

export interface IRStack extends IRNodeBase {
  kind: "IRStack"
  direction: "vertical" | "horizontal"
  gap: IRTokenRef | null
  align: string | null
  justify: string | null
  wrap: boolean
  children: IRNode[]
}

export interface IRText extends IRNodeBase {
  kind: "IRText"
  role: string | null
  level: number | null
  props: IRProp[]
  states: IRState[]
  variants: IRVariant[]
  slot: IRSlot | null
}

export interface IRSlot extends IRNodeBase {
  kind: "IRSlot"
  name: string
  typeHint: "text" | "surface" | "any" | null
  required: boolean
  fallback: IRNode[] | null
}

export interface IRProp extends IRNodeBase {
  kind: "IRProp"
  name: string
  value: IRPropValue
}

export type IRPropValue =
  | IRTokenRef
  | IRStringValue
  | { kind: "IRNumber"; value: number; suffix?: "px" | "rem" | "em" | "%" }
  | { kind: "IRBool"; value: boolean }
  | { kind: "IRTransparent" }
  | { kind: "IRAspectVal"; w: number; h: number }
  | { kind: "IRKeyword"; value: string }
  | IRReference

export interface IRTokenRef extends IRNodeBase {
  kind: "IRTokenRef"
  path: string
  cssVar: string
}

export interface IRStringValue {
  kind: "IRStringValue"
  value: string
  refs: IRResolvedRef[]
}

export interface IRReference {
  kind: "IRReference"
  name: string
  resolvedSource: "prop" | "variant" | null
}

export interface IRResolvedRef {
  name: string
  source: "prop" | "variant" | null
}

export interface IRState extends IRNodeBase {
  kind: "IRState"
  name: string
  hostKind: "surface" | "text" | "intent"
  props: IRProp[]
  transition: IRTransition | null
}

export interface IRTransition extends IRNodeBase {
  kind: "IRTransition"
  verb: "shift"
  duration: IRTokenRef
  ease: IRTokenRef
}

export interface IRVariant extends IRNodeBase {
  kind: "IRVariant"
  axis: string
  default: string | null
  cases: IRVariantCase[]
}

export interface IRVariantCase extends IRNodeBase {
  kind: "IRVariantCase"
  value: string
  props: IRProp[]
}

export type IRMotion =
  | IREnterMotion
  | IRExitMotion
  | IRPulseMotion
  | IRRevealMotion

export interface IREnterMotion extends IRNodeBase {
  kind: "IREnterMotion"
  from: IRAnimValue | null
  to: IRAnimValue | null
  duration: IRTokenRef | null
  ease: IRTokenRef | null
}

export interface IRExitMotion extends IRNodeBase {
  kind: "IRExitMotion"
  from: IRAnimValue | null
  to: IRAnimValue | null
  duration: IRTokenRef | null
  ease: IRTokenRef | null
}

export interface IRPulseMotion extends IRNodeBase {
  kind: "IRPulseMotion"
  property: "opacity" | "x" | "y" | "scale" | null
  from: IRAnimValue | null
  to: IRAnimValue | null
  duration: IRTokenRef | null
  ease: IRTokenRef | null
}

export interface IRRevealMotion extends IRNodeBase {
  kind: "IRRevealMotion"
  duration: IRTokenRef | null
  ease: IRTokenRef | null
}

export type IRAnimValue =
  | { kind: "IRAnimProps"; props: Array<{ name: "opacity" | "x" | "y" | "scale"; value: number }> }
  | { kind: "IRAnimNumber"; value: number; suffix?: "px" | "rem" | "em" | "%" }

export interface IRIntent extends IRNodeBase {
  kind: "IRIntent"
  intentKind: "trigger" | "navigate" | "submit" | "toggle" | "expand" | "dismiss"
  identifier: string
  label: IRStringValue
  states: IRState[]
}

export interface IRAccessible extends IRNodeBase {
  kind: "IRAccessible"
  role: string | null
  label: string | null
  description: string | null
  live: string | null
  hidden: boolean | null
}
