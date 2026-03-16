import {
  AccessibleDescriptionNode,
  AccessibleLabelNode,
  ComponentDeclNode,
  ConstraintsNode,
  FallbackNode,
  IntentLabelNode,
  IntentNode,
  KeywordValNode,
  NodeBase,
  ProgramNode,
  PropAssignmentNode,
  PropParamNode,
  PropValueNode,
  ReferenceNode,
  RenderNode,
  SlotNode,
  SlotRequiredNode,
  StackNode,
  StateNode,
  StringLitNode,
  SurfaceNode,
  TextNode,
  VariantBlockNode,
  VariantCaseNode,
  AccessibleNode,
} from "./ast"
import { Diagnostic, createDiagnostic } from "./diagnostics"

export interface ValidationContext {
  readonly file: string
  readonly program: ProgramNode
  readonly diagnostics: Diagnostic[]
  report: (code: string, node: NodeBase, message?: string) => void
}

export type SemanticPass = (ctx: ValidationContext) => void

export interface ValidationResult {
  diagnostics: Diagnostic[]
}

const BUILTIN_STATE_NAMES = new Set([
  "hover", "focus", "active", "disabled",
  "loading", "error", "empty", "selected", "checked",
])

const SURFACE_TEXT_ONLY_PROPS = new Set(["text-color", "size", "weight", "content", "level", "truncate", "align"])
const SURFACE_VALID_PROPS = new Set(["fill", "radius", "padding", "depth", "outline", "opacity", "aspect", "width", "height"])
const TEXT_SURFACE_ONLY_PROPS = new Set(["fill", "radius", "padding", "depth", "outline", "width", "height", "aspect"])
const TEXT_VALID_PROPS = new Set(["content", "text-color", "size", "weight", "level", "truncate", "align"])

function createContext(program: ProgramNode, file: string): ValidationContext {
  const diagnostics: Diagnostic[] = []
  return {
    file,
    program,
    diagnostics,
    report(code, node, message) {
      diagnostics.push(createDiagnostic(code, file, node, message))
    },
  }
}

export function validateProgram(program: ProgramNode, file = "<unknown>"): ValidationResult {
  const context = createContext(program, file)
  const passes: SemanticPass[] = [
    componentStructurePass,
    hostValidationPass,
    referenceValidationPass,
    propertyApplicabilityPass,
  ]

  for (const pass of passes) {
    pass(context)
  }

  return { diagnostics: context.diagnostics }
}

function componentStructurePass(ctx: ValidationContext): void {
  for (const declaration of ctx.program.declarations) {
    if (declaration.kind !== "ComponentDecl") {
      continue
    }

    const component = declaration
    const roots = component.body.filter((statement) => statement.kind === "Surface" || statement.kind === "Stack")
    const intents = component.body.filter((statement) => statement.kind === "Intent")
    const accessibles = component.body.filter((statement) => statement.kind === "Accessible")
    const constraints = component.body.filter((statement) => statement.kind === "Constraints")

    if (roots.length !== 1) {
      ctx.report("VR-C1", component, `Expected exactly one root layout element, found ${roots.length}.`)
    }
    if (intents.length > 1) {
      ctx.report("VR-C2", intents[1], `Expected at most one intent node, found ${intents.length}.`)
    }
    if (accessibles.length > 1) {
      ctx.report("VR-C3", accessibles[1], `Expected at most one accessible block, found ${accessibles.length}.`)
    }
    if (constraints.length > 1) {
      ctx.report("VR-C4", constraints[1], `Expected at most one constraints block, found ${constraints.length}.`)
    }

    for (const param of component.params) {
      if (param.kind !== "VariantParam") {
        continue
      }
      if (param.default !== null && !param.values.includes(param.default)) {
        ctx.report("VR-C5", param, `Variant axis '${param.axis}' default '${param.default}' is not in the value list.`)
      }
      if (BUILTIN_STATE_NAMES.has(param.axis)) {
        ctx.report("VR-C6", param, `Variant axis '${param.axis}' uses a built-in state name.`)
      }
      for (const value of param.values) {
        if (BUILTIN_STATE_NAMES.has(value)) {
          ctx.report("VR-C7", param, `Variant axis '${param.axis}' value '${value}' uses a built-in state name.`)
        }
      }
    }

    for (const intent of intents as IntentNode[]) {
      const hasLabel = intent.body.some((statement) => statement.kind === "IntentLabel")
      if (!hasLabel) {
        ctx.report("VR-C8", intent, `Intent '${intent.intentKind}' is missing a label property.`)
      }
    }

    const slotNames = new Map<string, SlotNode>()
    for (const slot of collectSlots(component)) {
      const previous = slotNames.get(slot.name)
      if (previous) {
        ctx.report("VR-SL1", slot, `Slot name '${slot.name}' is duplicated in component '${component.name}'.`)
      } else {
        slotNames.set(slot.name, slot)
      }
    }

    const propNames = new Map<string, PropParamNode>()
    for (const param of component.params) {
      if (param.kind === "PropParam") {
        propNames.set(param.name, param)
      }
    }
    for (const slot of collectSlots(component)) {
      if (propNames.has(slot.name)) {
        ctx.report("VR-R3", slot, `Slot name '${slot.name}' collides with a prop parameter of the same name.`)
      }
    }
  }
}

function hostValidationPass(ctx: ValidationContext): void {
  for (const declaration of ctx.program.declarations) {
    if (declaration.kind !== "ComponentDecl") {
      continue
    }

    for (const statement of declaration.body) {
      if (statement.kind === "Slot") {
        ctx.report("VR-SL5", statement, `Slot '${statement.name}' is not valid at component scope.`)
      }
      inspectHostRules(ctx, statement, "component")
    }
  }
}

function inspectHostRules(
  ctx: ValidationContext,
  node: SurfaceNode | StackNode | TextNode | SlotNode | IntentNode | ConstraintsNode | AccessibleNode | RenderNode,
  parentHost: "component" | "surface" | "stack" | "text" | "slot" | "intent" | "fallback",
): void {
  switch (node.kind) {
    case "Surface":
      for (const statement of node.body) {
        if (statement.kind === "State") {
          inspectStateHost(ctx, statement, "surface")
        } else if (statement.kind === "Motion") {
          inspectMotionHost(ctx, statement, "surface")
        } else if (statement.kind === "Surface" || statement.kind === "Stack" || statement.kind === "Text" || statement.kind === "Slot") {
          inspectHostRules(ctx, statement, "surface")
        }
      }
      return
    case "Stack":
      for (const statement of node.body) {
        inspectHostRules(ctx, statement, "stack")
      }
      return
    case "Text":
      for (const statement of node.body) {
        if (statement.kind === "State") {
          inspectStateHost(ctx, statement, "text")
        } else if (statement.kind === "VariantBlock") {
          continue
        } else if (statement.kind === "Slot") {
          inspectHostRules(ctx, statement, "text")
        }
      }
      return
    case "Slot":
      for (const statement of node.body) {
        if (statement.kind !== "SlotRequired" && statement.kind !== "Fallback") {
          ctx.report("VR-SL4", statement as unknown as NodeBase)
        }
        if (statement.kind === "Fallback") {
          inspectFallbackHost(ctx, statement)
        }
      }
      return
    case "Intent":
      if (parentHost !== "component") {
        ctx.report("VR-I4", node, "Intent nodes are only valid in component bodies.")
      }
      for (const statement of node.body) {
        if (statement.kind === "State") {
          inspectStateHost(ctx, statement, "intent")
        }
      }
      return
    case "Accessible":
    case "Constraints":
    default:
      return
  }
}

function inspectFallbackHost(ctx: ValidationContext, fallback: FallbackNode): void {
  for (const child of fallback.body) {
    inspectHostRules(ctx, child, "fallback")
  }
}

function inspectStateHost(ctx: ValidationContext, state: StateNode, host: "surface" | "text" | "intent"): void {
  if (host !== "surface" && host !== "text" && host !== "intent") {
    ctx.report("VR-ST4", state)
  }
}

function inspectMotionHost(ctx: ValidationContext, motion: SurfaceNode["body"][number], host: "surface" | "text" | "stack" | "component"): void {
  if (motion.kind === "Motion" && host !== "surface") {
    ctx.report("VR-M10", motion)
  }
}

function referenceValidationPass(ctx: ValidationContext): void {
  for (const declaration of ctx.program.declarations) {
    if (declaration.kind !== "ComponentDecl") {
      continue
    }

    const scope = new Set<string>()
    for (const param of declaration.params) {
      if (param.kind === "PropParam") {
        scope.add(param.name)
      }
      if (param.kind === "VariantParam") {
        scope.add(param.axis)
      }
    }

    walkComponentStringsAndRefs(declaration, (node) => {
      if (node.kind === "Reference") {
        if (!scope.has(node.name)) {
          ctx.report("VR-R1", node, `Reference '@${node.name}' does not resolve in component '${declaration.name}'.`)
        }
        return
      }

      for (const match of node.value.matchAll(/@([A-Za-z][A-Za-z0-9-]*)(\.[A-Za-z][A-Za-z0-9-]*)?/g)) {
        const name = match[1]
        const tail = match[2]
        if (tail) {
          ctx.report("VR-R2", node, `Dot-path reference '@${name}${tail}' is not valid in v0.2.`)
          continue
        }
        if (!scope.has(name)) {
          ctx.report("VR-R1", node, `Reference '@${name}' does not resolve in component '${declaration.name}'.`)
        }
      }
    })
  }
}

function propertyApplicabilityPass(ctx: ValidationContext): void {
  for (const declaration of ctx.program.declarations) {
    if (declaration.kind !== "ComponentDecl") {
      continue
    }
    for (const statement of declaration.body) {
      if (statement.kind === "Surface") {
        validateSurface(ctx, statement)
      } else if (statement.kind === "Stack") {
        validateStack(ctx, statement)
      }
    }
  }
}

function validateSurface(ctx: ValidationContext, surface: SurfaceNode): void {
  const seen = new Map<string, PropAssignmentNode>()
  for (const statement of surface.body) {
    if (statement.kind === "PropAssignment") {
      validateSurfaceProp(ctx, statement)
      if (seen.has(statement.name)) {
        ctx.report("VR-S4", statement, `Surface property '${statement.name}' is duplicated.`)
      } else {
        seen.set(statement.name, statement)
      }
    } else if (statement.kind === "State") {
      validateStateProps(ctx, statement, "surface")
    } else if (statement.kind === "VariantBlock") {
      for (const variantCase of statement.cases) {
        validateVariantCaseProps(ctx, variantCase, "surface")
      }
    } else if (statement.kind === "Surface") {
      validateSurface(ctx, statement)
    } else if (statement.kind === "Stack") {
      validateStack(ctx, statement)
    } else if (statement.kind === "Text") {
      validateText(ctx, statement)
    } else if (statement.kind === "Slot") {
      validateSlotDescendants(ctx, statement)
    }
  }
}

function validateStack(ctx: ValidationContext, stack: StackNode): void {
  for (const arg of stack.args) {
    if (arg.name === "gap" && arg.value.kind !== "TokenRef") {
      ctx.report("VR-K3", arg, "Stack gap must use token(...).")
    }
  }
  for (const statement of stack.body) {
    if (statement.kind === "Surface") {
      validateSurface(ctx, statement)
    } else if (statement.kind === "Stack") {
      validateStack(ctx, statement)
    } else if (statement.kind === "Text") {
      validateText(ctx, statement)
    } else if (statement.kind === "Slot") {
      validateSlotDescendants(ctx, statement)
    }
  }
}

function validateText(ctx: ValidationContext, text: TextNode): void {
  let levelProp: PropAssignmentNode | null = null
  for (const statement of text.body) {
    if (statement.kind === "PropAssignment") {
      validateTextProp(ctx, statement)
      if (statement.name === "level") {
        levelProp = statement
      }
    } else if (statement.kind === "State") {
      validateStateProps(ctx, statement, "text")
    } else if (statement.kind === "VariantBlock") {
      for (const variantCase of statement.cases) {
        validateVariantCaseProps(ctx, variantCase, "text")
      }
    } else if (statement.kind === "Slot") {
      validateSlotDescendants(ctx, statement)
    }
  }

  if (text.role === "heading" && levelProp === null) {
    ctx.report("VR-TX3", text, "Heading text requires a level property.")
  }
  if (text.role !== "heading" && levelProp !== null) {
    ctx.report("VR-TX3", levelProp, "level is only valid when text role is heading.")
  }
  if (levelProp && levelProp.value.kind === "Number") {
    if (levelProp.value.value < 1 || levelProp.value.value > 6) {
      ctx.report("VR-TX4", levelProp, `level must be in range [1, 6], received ${levelProp.value.value}.`)
    }
  }
}

function validateSlotDescendants(ctx: ValidationContext, slot: SlotNode): void {
  for (const statement of slot.body) {
    if (statement.kind === "Fallback") {
      for (const child of statement.body) {
        if (child.kind === "Surface") {
          validateSurface(ctx, child)
        } else if (child.kind === "Stack") {
          validateStack(ctx, child)
        } else if (child.kind === "Text") {
          validateText(ctx, child)
        } else if (child.kind === "Slot") {
          validateSlotDescendants(ctx, child)
        }
      }
    }
  }
}

function validateStateProps(ctx: ValidationContext, state: StateNode, host: "surface" | "text"): void {
  for (const statement of state.body) {
    if (statement.kind !== "PropAssignment") {
      continue
    }
    if (host === "surface") {
      if (!isValidSurfaceProp(statement)) {
        ctx.report("VR-ST7", statement, `Property '${statement.name}' is not valid in a surface state.`)
      }
    } else if (host === "text") {
      if (!isValidTextProp(statement)) {
        ctx.report("VR-ST7", statement, `Property '${statement.name}' is not valid in a text state.`)
      }
    }
  }
}

function validateVariantCaseProps(ctx: ValidationContext, variantCase: VariantCaseNode, host: "surface" | "text"): void {
  for (const prop of variantCase.props) {
    if (host === "surface") {
      if (!isValidSurfaceProp(prop)) {
        ctx.report("VR-V5", prop, `Property '${prop.name}' is not valid in a surface variant case.`)
      }
    } else if (host === "text") {
      if (!isValidTextProp(prop)) {
        ctx.report("VR-V5", prop, `Property '${prop.name}' is not valid in a text variant case.`)
      }
    }
  }
}

function validateSurfaceProp(ctx: ValidationContext, prop: PropAssignmentNode): void {
  if (SURFACE_TEXT_ONLY_PROPS.has(prop.name)) {
    ctx.report("VR-S3", prop, `Property '${prop.name}' is not valid on surface nodes.`)
    return
  }

  if (!SURFACE_VALID_PROPS.has(prop.name)) {
    ctx.report("VR-S1", prop, `Property '${prop.name}' is not a valid surface property.`)
    return
  }

  if (prop.name === "opacity") {
    if (prop.value.kind !== "Number" || prop.value.value < 0 || prop.value.value > 1) {
      ctx.report("VR-S2", prop, "opacity must be a number in range [0, 1].")
    }
    return
  }

  if (prop.name === "aspect") {
    if (prop.value.kind !== "AspectVal") {
      ctx.report("VR-S1", prop, "aspect must use a number/number value.")
    }
    return
  }

  if ((prop.name === "fill" || prop.name === "outline") && prop.value.kind === "Transparent") {
    return
  }

  if (prop.value.kind !== "TokenRef") {
    ctx.report("VR-S1", prop, `Surface property '${prop.name}' must use token(...).`)
  }
}

function validateTextProp(ctx: ValidationContext, prop: PropAssignmentNode): void {
  if (TEXT_SURFACE_ONLY_PROPS.has(prop.name)) {
    ctx.report("VR-TX5", prop, `Property '${prop.name}' is not valid on text nodes.`)
    return
  }

  if (!TEXT_VALID_PROPS.has(prop.name)) {
    ctx.report("VR-TX5", prop, `Property '${prop.name}' is not a valid text property.`)
    return
  }

  if (prop.name === "text-color" && prop.value.kind !== "TokenRef") {
    ctx.report("VR-TX1", prop, "text-color must use token(...).")
  }
  if (prop.name === "size" && prop.value.kind !== "TokenRef") {
    ctx.report("VR-TX2", prop, "size must use token(...).")
  }
  if (prop.name === "level" && prop.value.kind !== "Number") {
    ctx.report("VR-TX4", prop, "level must be numeric.")
  }
}

function isValidSurfaceProp(prop: PropAssignmentNode): boolean {
  if (SURFACE_TEXT_ONLY_PROPS.has(prop.name)) {
    return false
  }
  if (!SURFACE_VALID_PROPS.has(prop.name)) {
    return false
  }
  if (prop.name === "opacity") {
    return prop.value.kind === "Number" && prop.value.value >= 0 && prop.value.value <= 1
  }
  if (prop.name === "aspect") {
    return prop.value.kind === "AspectVal"
  }
  if ((prop.name === "fill" || prop.name === "outline") && prop.value.kind === "Transparent") {
    return true
  }
  return prop.value.kind === "TokenRef"
}

function isValidTextProp(prop: PropAssignmentNode): boolean {
  if (TEXT_SURFACE_ONLY_PROPS.has(prop.name)) {
    return false
  }
  if (!TEXT_VALID_PROPS.has(prop.name)) {
    return false
  }
  if (prop.name === "text-color" || prop.name === "size") {
    return prop.value.kind === "TokenRef"
  }
  if (prop.name === "level") {
    return prop.value.kind === "Number"
  }
  return true
}

function collectSlots(component: ComponentDeclNode): SlotNode[] {
  const slots: SlotNode[] = []
  for (const statement of component.body) {
    collectSlotsFromNode(statement, slots)
  }
  return slots
}

function collectSlotsFromNode(node: ComponentDeclNode["body"][number] | RenderNode, slots: SlotNode[]): void {
  switch (node.kind) {
    case "Slot":
      slots.push(node)
      for (const statement of node.body) {
        if (statement.kind === "Fallback") {
          for (const child of statement.body) {
            collectSlotsFromNode(child, slots)
          }
        }
      }
      return
    case "Surface":
      for (const statement of node.body) {
        if (statement.kind === "Surface" || statement.kind === "Stack" || statement.kind === "Slot" || statement.kind === "Text") {
          collectSlotsFromNode(statement, slots)
        }
      }
      return
    case "Stack":
      for (const child of node.body) {
        collectSlotsFromNode(child, slots)
      }
      return
    case "Text":
      for (const statement of node.body) {
        if (statement.kind === "Slot") {
          collectSlotsFromNode(statement, slots)
        }
      }
      return
    default:
      return
  }
}

function walkComponentStringsAndRefs(
  component: ComponentDeclNode,
  visit: (node: StringLitNode | ReferenceNode | IntentLabelNode | AccessibleLabelNode | AccessibleDescriptionNode) => void,
): void {
  for (const statement of component.body) {
    walkNodeStringsAndRefs(statement, visit)
  }
}

function walkNodeStringsAndRefs(
  node: ComponentDeclNode["body"][number] | RenderNode | SlotRequiredNode | FallbackNode | VariantBlockNode | VariantCaseNode | StateNode,
  visit: (node: StringLitNode | ReferenceNode | IntentLabelNode | AccessibleLabelNode | AccessibleDescriptionNode) => void,
): void {
  switch (node.kind) {
    case "Surface":
      for (const statement of node.body) {
        if (statement.kind === "PropAssignment") {
          visitPropValue(statement.value, visit)
        } else if (statement.kind === "State") {
          walkNodeStringsAndRefs(statement, visit)
        } else if (statement.kind === "VariantBlock") {
          walkNodeStringsAndRefs(statement, visit)
        } else if (statement.kind === "Surface" || statement.kind === "Stack" || statement.kind === "Slot" || statement.kind === "Text") {
          walkNodeStringsAndRefs(statement, visit)
        }
      }
      return
    case "Stack":
      for (const child of node.body) {
        walkNodeStringsAndRefs(child, visit)
      }
      return
    case "Text":
      for (const statement of node.body) {
        if (statement.kind === "PropAssignment") {
          visitPropValue(statement.value, visit)
        } else if (statement.kind === "State") {
          walkNodeStringsAndRefs(statement, visit)
        } else if (statement.kind === "VariantBlock") {
          walkNodeStringsAndRefs(statement, visit)
        } else if (statement.kind === "Slot") {
          walkNodeStringsAndRefs(statement, visit)
        }
      }
      return
    case "Slot":
      for (const statement of node.body) {
        if (statement.kind === "Fallback") {
          walkNodeStringsAndRefs(statement, visit)
        }
      }
      return
    case "Fallback":
      for (const child of node.body) {
        walkNodeStringsAndRefs(child, visit)
      }
      return
    case "Intent":
      for (const statement of node.body) {
        if (statement.kind === "IntentLabel") {
          visit(statement)
        } else if (statement.kind === "State") {
          walkNodeStringsAndRefs(statement, visit)
        }
      }
      return
    case "Accessible":
      for (const statement of node.body) {
        if (statement.kind === "AccessibleLabel" || statement.kind === "AccessibleDescription") {
          visit(statement)
        }
      }
      return
    case "State":
      for (const statement of node.body) {
        if (statement.kind === "PropAssignment") {
          visitPropValue(statement.value, visit)
        }
      }
      return
    case "VariantBlock":
      for (const variantCase of node.cases) {
        walkNodeStringsAndRefs(variantCase, visit)
      }
      return
    case "VariantCase":
      for (const prop of node.props) {
        visitPropValue(prop.value, visit)
      }
      return
    default:
      return
  }
}

function visitPropValue(
  value: PropValueNode,
  visit: (node: StringLitNode | ReferenceNode | IntentLabelNode | AccessibleLabelNode | AccessibleDescriptionNode) => void,
): void {
  if (value.kind === "StringLit" || value.kind === "Reference") {
    visit(value)
  }
}
