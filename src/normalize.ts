import {
  AccessibleHiddenNode,
  AccessibleLabelNode,
  AccessibleLiveNode,
  AccessibleRoleNode,
  AccessibleStatementNode,
  AccessibleDescriptionNode,
  AccessibleNode,
  AnimValueNode,
  ComponentDeclNode,
  ConstraintRuleNode,
  ConstraintTargetNode,
  ConstraintsNode,
  FallbackNode,
  IntentLabelNode,
  IntentNode,
  MotionBlockNode,
  NodeBase,
  ProgramNode,
  PropAssignmentNode,
  PropParamNode,
  PropValueNode,
  RenderNode,
  SlotNode,
  StackNode,
  StackPropNode,
  StateNode,
  SurfaceNode,
  TextNode,
  ThemeDeclNode,
  TokenDefNode,
  TokensDeclNode,
  TransitionPropNode,
  VariantBlockNode,
  VariantCaseNode,
  VariantParamNode,
} from "./ast"
import {
  AnalyzedAccessible,
  AnalyzedAnimValue,
  AnalyzedComponent,
  AnalyzedConstraintRule,
  AnalyzedConstraints,
  AnalyzedDeclaration,
  AnalyzedEnterMotion,
  AnalyzedExitMotion,
  AnalyzedIntent,
  AnalyzedMotion,
  AnalyzedNode,
  AnalyzedProgram,
  AnalyzedProp,
  AnalyzedPropParam,
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
  AnalyzedTopLevelOrderEntry,
  AnalyzedTransition,
  AnalyzedVariantBlock,
  AnalyzedVariantCase,
  AnalyzedVariantParam,
  SourceProvenance,
} from "./analyzed"
import { DiagnosticSeverity, spanFromNode } from "./diagnostics"
import { ValidationResult } from "./validator"

export class NormalizeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NormalizeError"
  }
}

export function normalizeProgram(program: ProgramNode, validation: ValidationResult): AnalyzedProgram {
  const errors = validation.diagnostics.filter((diagnostic) => diagnostic.severity === "error")
  if (errors.length > 0) {
    throw new NormalizeError("Cannot normalize program with validation errors.")
  }

  return {
    kind: "AnalyzedProgram",
    provenance: provenanceOf(program, "Program"),
    declarations: program.declarations.map(normalizeDeclaration),
  }
}

function normalizeDeclaration(declaration: ProgramNode["declarations"][number]): AnalyzedDeclaration {
  switch (declaration.kind) {
    case "TokensDecl":
      return normalizeTokens(declaration)
    case "ThemeDecl":
      return normalizeTheme(declaration)
    case "ComponentDecl":
      return normalizeComponent(declaration)
  }
}

function normalizeTokens(tokens: TokensDeclNode): AnalyzedTokens {
  return {
    kind: "AnalyzedTokens",
    provenance: provenanceOf(tokens, "TokensDecl"),
    name: tokens.name,
    defs: tokens.defs.map(normalizeTokenDef),
  }
}

function normalizeTheme(theme: ThemeDeclNode): AnalyzedTheme {
  return {
    kind: "AnalyzedTheme",
    provenance: provenanceOf(theme, "ThemeDecl"),
    name: theme.name,
    extends: theme.extends,
    defs: theme.defs.map(normalizeTokenDef),
  }
}

function normalizeTokenDef(def: TokenDefNode): AnalyzedTokenDef {
  return {
    kind: "AnalyzedTokenDef",
    provenance: provenanceOf(def, "TokenDef"),
    path: def.path,
    value: normalizeTokenValue(def.value),
  }
}

function normalizeTokenValue(value: TokenDefNode["value"]): AnalyzedTokenDef["value"] {
  switch (value.kind) {
    case "HexColor":
      return { kind: "HexColor", value: value.value }
    case "StringVal":
      return { kind: "StringVal", value: value.value }
    case "NumberVal":
      return { kind: "NumberVal", value: value.value, suffix: value.suffix }
  }
}

function normalizeComponent(component: ComponentDeclNode): AnalyzedComponent {
  let root: AnalyzedSurface | AnalyzedStack | null = null
  let intent: AnalyzedIntent | null = null
  let accessible: AnalyzedAccessible | null = null
  let constraints: AnalyzedConstraints | null = null
  const declarationOrder: AnalyzedTopLevelOrderEntry[] = []

  for (const [index, statement] of component.body.entries()) {
    if (statement.kind === "Surface" || statement.kind === "Stack") {
      if (root === null) {
        root = normalizeRootNode(statement)
      }
      declarationOrder.push(orderEntry(statement, "root", index))
      continue
    }
    if (statement.kind === "Intent") {
      if (intent === null) {
        intent = normalizeIntent(statement)
      }
      declarationOrder.push(orderEntry(statement, "intent", index))
      continue
    }
    if (statement.kind === "Accessible") {
      if (accessible === null) {
        accessible = normalizeAccessible(statement)
      }
      declarationOrder.push(orderEntry(statement, "accessible", index))
      continue
    }
    if (statement.kind === "Constraints") {
      if (constraints === null) {
        constraints = normalizeConstraints(statement)
      }
      declarationOrder.push(orderEntry(statement, "constraints", index))
    }
  }

  if (root === null) {
    throw new NormalizeError(`Validated component '${component.name}' is missing a root.`)
  }

  return {
    kind: "AnalyzedComponent",
    provenance: provenanceOf(component, "ComponentDecl"),
    name: component.name,
    variants: component.params.filter((param): param is VariantParamNode => param.kind === "VariantParam").map(normalizeVariantParam),
    props: component.params.filter((param): param is PropParamNode => param.kind === "PropParam").map(normalizePropParam),
    root,
    intent,
    accessible,
    constraints,
    declarationOrder,
  }
}

function orderEntry(node: NodeBase, entryKind: AnalyzedTopLevelOrderEntry["entryKind"], ordinal: number): AnalyzedTopLevelOrderEntry {
  return {
    kind: "AnalyzedTopLevelOrderEntry",
    provenance: provenanceOf(node, entryKind),
    entryKind,
    ordinal,
  }
}

function normalizeVariantParam(param: VariantParamNode): AnalyzedVariantParam {
  return {
    kind: "AnalyzedVariantParam",
    provenance: provenanceOf(param, "VariantParam"),
    axis: param.axis,
    values: [...param.values],
    default: param.default,
  }
}

function normalizePropParam(param: PropParamNode): AnalyzedPropParam {
  return {
    kind: "AnalyzedPropParam",
    provenance: provenanceOf(param, "PropParam"),
    name: param.name,
    propType: param.propType,
    default: param.default === null ? null : normalizeLiteralValue(param.default),
  }
}

function normalizeLiteralValue(value: PropParamNode["default"]): string | number | boolean | null {
  if (value === null) {
    return null
  }
  switch (value.kind) {
    case "StringLit":
      return value.value
    case "Number":
      return value.value
    case "Bool":
      return value.value
  }
}

function normalizeRootNode(node: SurfaceNode | StackNode): AnalyzedSurface | AnalyzedStack {
  return node.kind === "Surface" ? normalizeSurface(node) : normalizeStack(node)
}

function normalizeSurface(surface: SurfaceNode): AnalyzedSurface {
  const props: AnalyzedProp[] = []
  const states: AnalyzedState[] = []
  const variants: AnalyzedVariantBlock[] = []
  const motions: AnalyzedMotion[] = []
  const children: AnalyzedNode[] = []

  for (const statement of surface.body) {
    switch (statement.kind) {
      case "PropAssignment":
        props.push(normalizeProp(statement))
        break
      case "State":
        states.push(normalizeState(statement, "surface"))
        break
      case "VariantBlock":
        variants.push(normalizeVariantBlock(statement))
        break
      case "Motion":
        motions.push(normalizeMotion(statement))
        break
      case "Surface":
      case "Stack":
      case "Text":
      case "Slot":
        children.push(normalizeNode(statement))
        break
    }
  }

  return {
    kind: "AnalyzedSurface",
    provenance: provenanceOf(surface, "Surface"),
    role: surface.role,
    props,
    states,
    variants,
    motions,
    children,
  }
}

function normalizeStack(stack: StackNode): AnalyzedStack {
  let direction: "vertical" | "horizontal" = "vertical"
  let gap: AnalyzedTokenRef | null = null
  let align: string | null = null
  let justify: string | null = null
  let wrap = false

  for (const arg of stack.args) {
    switch (arg.name) {
      case "direction":
        direction = readKeyword(arg) as "vertical" | "horizontal"
        break
      case "gap":
        gap = normalizeTokenRef(arg.value as { kind: "TokenRef"; path: string } & NodeBase)
        break
      case "align":
        align = readKeyword(arg)
        break
      case "justify":
        justify = readKeyword(arg)
        break
      case "wrap":
        wrap = readBool(arg)
        break
    }
  }

  return {
    kind: "AnalyzedStack",
    provenance: provenanceOf(stack, "Stack"),
    direction,
    gap,
    align,
    justify,
    wrap,
    children: stack.body.map(normalizeNode),
  }
}

function normalizeText(text: TextNode): AnalyzedText {
  const props: AnalyzedProp[] = []
  const states: AnalyzedState[] = []
  const variants: AnalyzedVariantBlock[] = []
  let slot: AnalyzedSlot | null = null

  for (const statement of text.body) {
    if (statement.kind === "PropAssignment") {
      props.push(normalizeProp(statement))
    } else if (statement.kind === "State") {
      states.push(normalizeState(statement, "text"))
    } else if (statement.kind === "VariantBlock") {
      variants.push(normalizeVariantBlock(statement))
    } else if (statement.kind === "Slot" && slot === null) {
      slot = normalizeSlot(statement)
    }
  }

  return {
    kind: "AnalyzedText",
    provenance: provenanceOf(text, "Text"),
    role: text.role,
    props,
    states,
    variants,
    slot,
  }
}

function normalizeSlot(slot: SlotNode): AnalyzedSlot {
  const required = slot.body.some((statement) => statement.kind === "SlotRequired")
  const fallback = slot.body.find((statement): statement is FallbackNode => statement.kind === "Fallback")

  return {
    kind: "AnalyzedSlot",
    provenance: provenanceOf(slot, "Slot"),
    name: slot.name,
    typeHint: slot.typeHint,
    required,
    fallback: fallback ? fallback.body.map(normalizeNode) : null,
  }
}

function normalizeIntent(intent: IntentNode): AnalyzedIntent {
  const label = intent.body.find((statement): statement is IntentLabelNode => statement.kind === "IntentLabel")
  return {
    kind: "AnalyzedIntent",
    provenance: provenanceOf(intent, "Intent"),
    intentKind: intent.intentKind,
    identifier: intent.identifier,
    label: label?.value ?? "",
    states: intent.body
      .filter((statement): statement is StateNode => statement.kind === "State")
      .map((state) => normalizeState(state, "intent")),
  }
}

function normalizeAccessible(accessible: AccessibleNode): AnalyzedAccessible {
  const role = findAccessibleValue<AccessibleRoleNode>(accessible.body, "AccessibleRole")
  const label = findAccessibleValue<AccessibleLabelNode>(accessible.body, "AccessibleLabel")
  const description = findAccessibleValue<AccessibleDescriptionNode>(accessible.body, "AccessibleDescription")
  const live = findAccessibleValue<AccessibleLiveNode>(accessible.body, "AccessibleLive")
  const hidden = findAccessibleValue<AccessibleHiddenNode>(accessible.body, "AccessibleHidden")

  return {
    kind: "AnalyzedAccessible",
    provenance: provenanceOf(accessible, "Accessible"),
    role: role?.value ?? null,
    label: label?.value ?? null,
    description: description?.value ?? null,
    live: live?.value ?? null,
    hidden: hidden?.value ?? null,
  }
}

function normalizeConstraints(constraints: ConstraintsNode): AnalyzedConstraints {
  return {
    kind: "AnalyzedConstraints",
    provenance: provenanceOf(constraints, "Constraints"),
    rules: constraints.rules.map(normalizeConstraintRule),
  }
}

function normalizeConstraintRule(rule: ConstraintRuleNode): AnalyzedConstraintRule {
  return {
    kind: "AnalyzedConstraintRule",
    provenance: provenanceOf(rule, "ConstraintRule"),
    verb: rule.verb,
    severity: normalizeConstraintSeverity(rule.verb),
    target: normalizeConstraintTarget(rule.target),
  }
}

function normalizeConstraintSeverity(verb: ConstraintRuleNode["verb"]): DiagnosticSeverity {
  return verb === "warn" ? "warning" : "error"
}

function normalizeConstraintTarget(target: ConstraintTargetNode): AnalyzedConstraintRule["target"] {
  switch (target.kind) {
    case "HardcodedTarget":
      return { kind: "HardcodedTarget", what: target.what }
    case "AccessibleLabelTarget":
      return { kind: "AccessibleLabelTarget" }
    case "AccessibleRoleTarget":
      return { kind: "AccessibleRoleTarget" }
  }
}

function normalizeNode(node: RenderNode): AnalyzedNode {
  switch (node.kind) {
    case "Surface":
      return normalizeSurface(node)
    case "Stack":
      return normalizeStack(node)
    case "Text":
      return normalizeText(node)
    case "Slot":
      return normalizeSlot(node)
  }
}

function normalizeState(state: StateNode, hostKind: AnalyzedState["hostKind"]): AnalyzedState {
  const props: AnalyzedProp[] = []
  let transition: AnalyzedTransition | null = null

  for (const statement of state.body) {
    if (statement.kind === "PropAssignment") {
      props.push(normalizeProp(statement))
    } else if (statement.kind === "TransitionProp") {
      transition = normalizeTransition(statement)
    }
  }

  return {
    kind: "AnalyzedState",
    provenance: provenanceOf(state, "State"),
    stateName: state.stateName,
    hostKind,
    props,
    transition,
  }
}

function normalizeTransition(transition: TransitionPropNode): AnalyzedTransition {
  return {
    kind: "AnalyzedTransition",
    provenance: provenanceOf(transition, "TransitionProp"),
    verb: "shift",
    duration: normalizeTokenRef(transition.value.duration),
    ease: normalizeTokenRef(transition.value.ease),
  }
}

function normalizeVariantBlock(variant: VariantBlockNode): AnalyzedVariantBlock {
  return {
    kind: "AnalyzedVariantBlock",
    provenance: provenanceOf(variant, "VariantBlock"),
    axis: variant.axis,
    cases: variant.cases.map(normalizeVariantCase),
  }
}

function normalizeVariantCase(variantCase: VariantCaseNode): AnalyzedVariantCase {
  return {
    kind: "AnalyzedVariantCase",
    provenance: provenanceOf(variantCase, "VariantCase"),
    value: variantCase.value,
    props: variantCase.props.map(normalizeProp),
  }
}

function normalizeMotion(motion: MotionBlockNode): AnalyzedMotion {
  let duration: AnalyzedTokenRef | null = null
  let ease: AnalyzedTokenRef | null = null
  let from: AnalyzedAnimValue | null = null
  let to: AnalyzedAnimValue | null = null
  let property: AnalyzedPulseMotion["property"] = null

  for (const statement of motion.body) {
    switch (statement.kind) {
      case "MotionDuration":
        duration = normalizeTokenRef(statement.value)
        break
      case "MotionEase":
        ease = normalizeTokenRef(statement.value)
        break
      case "MotionFrom":
        from = normalizeAnimValue(statement.value)
        break
      case "MotionTo":
        to = normalizeAnimValue(statement.value)
        break
      case "MotionProperty":
        property = statement.value
        break
    }
  }

  const provenance = provenanceOf(motion, "Motion")
  switch (motion.verb) {
    case "enter":
      return { kind: "AnalyzedEnterMotion", provenance, from, to, duration, ease } as AnalyzedEnterMotion
    case "exit":
      return { kind: "AnalyzedExitMotion", provenance, from, to, duration, ease } as AnalyzedExitMotion
    case "pulse":
      return { kind: "AnalyzedPulseMotion", provenance, property, from, to, duration, ease } as AnalyzedPulseMotion
    case "reveal":
      return { kind: "AnalyzedRevealMotion", provenance, duration, ease } as AnalyzedRevealMotion
  }
}

function normalizeAnimValue(value: AnimValueNode): AnalyzedAnimValue {
  if (value.kind === "AnimProps") {
    return {
      kind: "AnimProps",
      props: value.props.map((prop) => ({ name: prop.name, value: prop.value })),
    }
  }
  return {
    kind: "Number",
    value: value.value,
    suffix: value.suffix,
  }
}

function normalizeProp(prop: PropAssignmentNode): AnalyzedProp {
  return {
    kind: "AnalyzedProp",
    provenance: provenanceOf(prop, "PropAssignment"),
    name: prop.name,
    value: normalizePropValue(prop.value),
  }
}

function normalizePropValue(value: PropValueNode): AnalyzedPropValue {
  switch (value.kind) {
    case "TokenRef":
      return normalizeTokenRef(value)
    case "StringLit":
      return { kind: "StringLit", value: value.value }
    case "Number":
      return { kind: "Number", value: value.value, suffix: value.suffix }
    case "Bool":
      return { kind: "Bool", value: value.value }
    case "Transparent":
      return { kind: "Transparent" }
    case "AspectVal":
      return { kind: "AspectVal", w: value.w, h: value.h }
    case "KeywordVal":
      return { kind: "KeywordVal", value: value.value }
    case "Reference":
      return { kind: "Reference", name: value.name }
  }
}

function normalizeTokenRef(tokenRef: { kind: "TokenRef"; path: string } & NodeBase): AnalyzedTokenRef {
  return {
    kind: "AnalyzedTokenRef",
    provenance: provenanceOf(tokenRef, "TokenRef"),
    path: tokenRef.path,
  }
}

function provenanceOf(node: NodeBase, sourceKind: string): SourceProvenance {
  return {
    sourceKind,
    span: spanFromNode(node),
  }
}

function readKeyword(arg: StackPropNode): string {
  return (arg.value as { kind: "KeywordVal"; value: string }).value
}

function readBool(arg: StackPropNode): boolean {
  return (arg.value as { kind: "Bool"; value: boolean }).value
}

function findAccessibleValue<T extends AccessibleStatementNode>(body: AccessibleStatementNode[], kind: T["kind"]): T | null {
  const match = body.find((statement): statement is T => statement.kind === kind)
  return match ?? null
}
