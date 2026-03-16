import {
  AnalyzedAccessible,
  AnalyzedAnimValue,
  AnalyzedComponent,
  AnalyzedDeclaration,
  AnalyzedEnterMotion,
  AnalyzedExitMotion,
  AnalyzedIntent,
  AnalyzedMotion,
  AnalyzedNode,
  AnalyzedProgram,
  AnalyzedProp,
  AnalyzedPropValue,
  AnalyzedPulseMotion,
  AnalyzedRevealMotion,
  AnalyzedSlot,
  AnalyzedStack,
  AnalyzedState,
  AnalyzedSurface,
  AnalyzedText,
  AnalyzedTheme,
  AnalyzedTokenDef,
  AnalyzedTokenRef,
  AnalyzedTokens,
  AnalyzedTransition,
  AnalyzedVariantBlock,
  AnalyzedVariantCase,
  AnalyzedVariantParam,
  SourceProvenance,
} from "./analyzed"
import {
  IRAccessible,
  IRAnimValue,
  IRComponent,
  IREnterMotion,
  IRExitMotion,
  IRIntent,
  IRMotion,
  IRNode,
  IRProgram,
  IRProp,
  IRPropParam,
  IRPropValue,
  IRPulseMotion,
  IRRevealMotion,
  IRSlot,
  IRStack,
  IRState,
  IRStringValue,
  IRSurface,
  IRText,
  IRTheme,
  IRTokenDef,
  IRTokenRef,
  IRTokens,
  IRTransition,
  IRVariant,
  IRVariantAxis,
  IRVariantCase,
} from "./ir"

export interface IRBuildContext {
  propNames: Set<string>
  variantAxes: Set<string>
  variantDefaults: Map<string, string | null>
}

export function buildIR(program: AnalyzedProgram): IRProgram {
  const tokens: IRTokens[] = []
  const themes: IRTheme[] = []
  const components: IRComponent[] = []

  for (const declaration of program.declarations) {
    switch (declaration.kind) {
      case "AnalyzedTokens":
        tokens.push(buildTokens(declaration))
        break
      case "AnalyzedTheme":
        themes.push(buildTheme(declaration))
        break
      case "AnalyzedComponent":
        components.push(buildComponent(declaration))
        break
    }
  }

  return {
    kind: "IRProgram",
    provenance: program.provenance,
    tokens,
    themes,
    components,
  }
}

function buildTokens(tokens: AnalyzedTokens): IRTokens {
  return {
    kind: "IRTokens",
    provenance: tokens.provenance,
    name: tokens.name,
    defs: tokens.defs.map(buildTokenDef),
  }
}

function buildTheme(theme: AnalyzedTheme): IRTheme {
  return {
    kind: "IRTheme",
    provenance: theme.provenance,
    name: theme.name,
    extends: theme.extends,
    defs: theme.defs.map(buildTokenDef),
  }
}

function buildTokenDef(def: AnalyzedTokenDef): IRTokenDef {
  return {
    kind: "IRTokenDef",
    provenance: def.provenance,
    path: def.path,
    value: def.value,
  }
}

function buildComponent(component: AnalyzedComponent): IRComponent {
  const context = createContext(component)
  return {
    kind: "IRComponent",
    provenance: component.provenance,
    name: component.name,
    variants: component.variants.map(buildVariantAxis),
    props: component.props.map(buildPropParam),
    root: buildRoot(component.root, context),
    intent: component.intent ? buildIntent(component.intent, context) : null,
    accessible: component.accessible ? buildAccessible(component.accessible) : null,
  }
}

function createContext(component: AnalyzedComponent): IRBuildContext {
  return {
    propNames: new Set(component.props.map((prop) => prop.name)),
    variantAxes: new Set(component.variants.map((variant) => variant.axis)),
    variantDefaults: new Map(component.variants.map((variant) => [variant.axis, variant.default])),
  }
}

function buildVariantAxis(param: AnalyzedVariantParam): IRVariantAxis {
  return {
    kind: "IRVariantAxis",
    provenance: param.provenance,
    axis: param.axis,
    values: [...param.values],
    default: param.default,
  }
}

function buildPropParam(param: AnalyzedComponent["props"][number]): IRPropParam {
  return {
    kind: "IRPropParam",
    provenance: param.provenance,
    name: param.name,
    propType: param.propType,
    default: param.default,
  }
}

function buildRoot(node: AnalyzedSurface | AnalyzedStack, context: IRBuildContext): IRSurface | IRStack {
  return node.kind === "AnalyzedSurface" ? buildSurface(node, context) : buildStack(node, context)
}

function buildNode(node: AnalyzedNode, context: IRBuildContext): IRNode {
  switch (node.kind) {
    case "AnalyzedSurface":
      return buildSurface(node, context)
    case "AnalyzedStack":
      return buildStack(node, context)
    case "AnalyzedText":
      return buildText(node, context)
    case "AnalyzedSlot":
      return buildSlot(node, context)
  }
}

function buildSurface(surface: AnalyzedSurface, context: IRBuildContext): IRSurface {
  return {
    kind: "IRSurface",
    provenance: surface.provenance,
    role: surface.role,
    props: surface.props.map((prop) => buildProp(prop, context)),
    states: surface.states.map((state) => buildState(state, context)),
    variants: surface.variants.map((variant) => buildVariant(variant, context, getVariantDefault(variant.axis, context))),
    motions: surface.motions.map((motion) => buildMotion(motion)),
    children: surface.children.map((child) => buildNode(child, context)),
  }
}

function buildStack(stack: AnalyzedStack, context: IRBuildContext): IRStack {
  return {
    kind: "IRStack",
    provenance: stack.provenance,
    direction: stack.direction,
    gap: stack.gap ? buildTokenRef(stack.gap) : null,
    align: stack.align,
    justify: stack.justify,
    wrap: stack.wrap,
    children: stack.children.map((child) => buildNode(child, context)),
  }
}

function buildText(text: AnalyzedText, context: IRBuildContext): IRText {
  const { level, props } = splitTextLevel(text.props, context)

  return {
    kind: "IRText",
    provenance: text.provenance,
    role: text.role,
    level,
    props,
    states: text.states.map((state) => buildState(state, context)),
    variants: text.variants.map((variant) => buildVariant(variant, context, getVariantDefault(variant.axis, context))),
    slot: text.slot ? buildSlot(text.slot, context) : null,
  }
}

function splitTextLevel(props: AnalyzedProp[], context: IRBuildContext): { level: number | null; props: IRProp[] } {
  let level: number | null = null
  const remainder: IRProp[] = []

  for (const prop of props) {
    if (prop.name === "level" && prop.value.kind === "Number") {
      level = prop.value.value
      continue
    }
    remainder.push(buildProp(prop, context))
  }

  return { level, props: remainder }
}

function buildSlot(slot: AnalyzedSlot, context: IRBuildContext): IRSlot {
  return {
    kind: "IRSlot",
    provenance: slot.provenance,
    name: slot.name,
    typeHint: slot.typeHint,
    required: slot.required,
    fallback: slot.fallback ? slot.fallback.map((node) => buildNode(node, context)) : null,
  }
}

function buildIntent(intent: AnalyzedIntent, context: IRBuildContext): IRIntent {
  return {
    kind: "IRIntent",
    provenance: intent.provenance,
    intentKind: intent.intentKind,
    identifier: intent.identifier,
    label: buildStringValue(intent.label, intent.provenance, context),
    states: intent.states.map((state) => buildState(state, context)),
  }
}

function buildAccessible(accessible: AnalyzedAccessible): IRAccessible {
  return {
    kind: "IRAccessible",
    provenance: accessible.provenance,
    role: accessible.role,
    label: accessible.label,
    description: accessible.description,
    live: accessible.live,
    hidden: accessible.hidden,
  }
}

function buildProp(prop: AnalyzedProp, context: IRBuildContext): IRProp {
  return {
    kind: "IRProp",
    provenance: prop.provenance,
    name: prop.name,
    value: buildPropValue(prop.value, prop.provenance, context),
  }
}

function buildPropValue(value: AnalyzedPropValue, provenance: SourceProvenance, context: IRBuildContext): IRPropValue {
  switch (value.kind) {
    case "AnalyzedTokenRef":
      return buildTokenRef(value)
    case "StringLit":
      return buildStringValue(value.value, provenance, context)
    case "Number":
      return { kind: "IRNumber", value: value.value, suffix: value.suffix }
    case "Bool":
      return { kind: "IRBool", value: value.value }
    case "Transparent":
      return { kind: "IRTransparent" }
    case "AspectVal":
      return { kind: "IRAspectVal", w: value.w, h: value.h }
    case "KeywordVal":
      return { kind: "IRKeyword", value: value.value }
    case "Reference":
      return {
        kind: "IRReference",
        name: value.name,
        resolvedSource: resolveRefSource(value.name, context),
      }
  }
}

function buildTokenRef(tokenRef: AnalyzedTokenRef): IRTokenRef {
  return {
    kind: "IRTokenRef",
    provenance: tokenRef.provenance,
    path: tokenRef.path,
    cssVar: tokenPathToCSSVar(tokenRef.path),
  }
}

function buildStringValue(value: string, provenance: SourceProvenance, context: IRBuildContext): IRStringValue {
  return {
    kind: "IRStringValue",
    value,
    refs: collectStringRefs(value, context),
  }
}

function collectStringRefs(value: string, context: IRBuildContext): IRStringValue["refs"] {
  const refs: IRStringValue["refs"] = []
  const seen = new Set<string>()

  for (const match of value.matchAll(/@([a-zA-Z][a-zA-Z0-9-]*)/g)) {
    const name = match[1]
    if (seen.has(name)) {
      continue
    }
    seen.add(name)
    refs.push({
      name,
      source: resolveRefSource(name, context),
    })
  }

  return refs
}

function resolveRefSource(name: string, context: IRBuildContext): "prop" | "variant" | null {
  if (context.propNames.has(name)) {
    return "prop"
  }
  if (context.variantAxes.has(name)) {
    return "variant"
  }
  return null
}

function buildState(state: AnalyzedState, context: IRBuildContext): IRState {
  return {
    kind: "IRState",
    provenance: state.provenance,
    name: state.stateName,
    hostKind: state.hostKind,
    props: state.props.map((prop) => buildProp(prop, context)),
    transition: state.transition ? buildTransition(state.transition) : null,
  }
}

function buildTransition(transition: AnalyzedTransition): IRTransition {
  return {
    kind: "IRTransition",
    provenance: transition.provenance,
    verb: transition.verb,
    duration: buildTokenRef(transition.duration),
    ease: buildTokenRef(transition.ease),
  }
}

function buildVariant(variant: AnalyzedVariantBlock, context: IRBuildContext, defaultValue: string | null): IRVariant {
  return {
    kind: "IRVariant",
    provenance: variant.provenance,
    axis: variant.axis,
    default: defaultValue,
    cases: variant.cases.map((variantCase) => buildVariantCase(variantCase, context)),
  }
}

function buildVariantCase(variantCase: AnalyzedVariantCase, context: IRBuildContext): IRVariantCase {
  return {
    kind: "IRVariantCase",
    provenance: variantCase.provenance,
    value: variantCase.value,
    props: variantCase.props.map((prop) => buildProp(prop, context)),
  }
}

function getVariantDefault(axis: string, context: IRBuildContext): string | null {
  return context.variantDefaults.get(axis) ?? null
}

function buildMotion(motion: AnalyzedMotion): IRMotion {
  switch (motion.kind) {
    case "AnalyzedEnterMotion":
      return buildEnterMotion(motion)
    case "AnalyzedExitMotion":
      return buildExitMotion(motion)
    case "AnalyzedPulseMotion":
      return buildPulseMotion(motion)
    case "AnalyzedRevealMotion":
      return buildRevealMotion(motion)
  }
}

function buildEnterMotion(motion: AnalyzedEnterMotion): IREnterMotion {
  return {
    kind: "IREnterMotion",
    provenance: motion.provenance,
    from: motion.from ? buildAnimValue(motion.from) : null,
    to: motion.to ? buildAnimValue(motion.to) : null,
    duration: motion.duration ? buildTokenRef(motion.duration) : null,
    ease: motion.ease ? buildTokenRef(motion.ease) : null,
  }
}

function buildExitMotion(motion: AnalyzedExitMotion): IRExitMotion {
  return {
    kind: "IRExitMotion",
    provenance: motion.provenance,
    from: motion.from ? buildAnimValue(motion.from) : null,
    to: motion.to ? buildAnimValue(motion.to) : null,
    duration: motion.duration ? buildTokenRef(motion.duration) : null,
    ease: motion.ease ? buildTokenRef(motion.ease) : null,
  }
}

function buildPulseMotion(motion: AnalyzedPulseMotion): IRPulseMotion {
  return {
    kind: "IRPulseMotion",
    provenance: motion.provenance,
    property: motion.property,
    from: motion.from ? buildAnimValue(motion.from) : null,
    to: motion.to ? buildAnimValue(motion.to) : null,
    duration: motion.duration ? buildTokenRef(motion.duration) : null,
    ease: motion.ease ? buildTokenRef(motion.ease) : null,
  }
}

function buildRevealMotion(motion: AnalyzedRevealMotion): IRRevealMotion {
  return {
    kind: "IRRevealMotion",
    provenance: motion.provenance,
    duration: motion.duration ? buildTokenRef(motion.duration) : null,
    ease: motion.ease ? buildTokenRef(motion.ease) : null,
  }
}

function buildAnimValue(value: AnalyzedAnimValue): IRAnimValue {
  if (value.kind === "AnimProps") {
    return {
      kind: "IRAnimProps",
      props: value.props.map((prop) => ({ name: prop.name, value: prop.value })),
    }
  }
  return {
    kind: "IRAnimNumber",
    value: value.value,
    suffix: value.suffix,
  }
}

export function tokenPathToCSSVar(path: string): string {
  return `--${path.replace(/\./g, "-")}`
}
