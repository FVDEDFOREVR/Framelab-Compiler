import { SourceProvenance } from "./analyzed"
import {
  IRAccessible,
  IRComponent,
  IRMotion,
  IRNode,
  IRProgram,
  IRProp,
  IRPropValue,
  IRReference,
  IRSlot,
  IRStack,
  IRState,
  IRStringValue,
  IRSurface,
  IRText,
  IRTokenDef,
  IRTokenRef,
  IRTokenValue,
  IRTransition,
} from "./ir"

export interface EmittedArtifact {
  path: string
  content: string
}

export interface ReactEmitterDiagnostic {
  code: string
  severity: "warning"
  component: string
  message: string
  provenance?: SourceProvenance
}

export interface ReactComponentArtifacts {
  componentName: string
  source: EmittedArtifact
  styles: EmittedArtifact
  diagnostics: ReactEmitterDiagnostic[]
}

export interface ReactProgramArtifacts {
  tokens: EmittedArtifact | null
  components: ReactComponentArtifacts[]
  diagnostics: ReactEmitterDiagnostic[]
}

interface SlotInfo {
  name: string
  required: boolean
}

interface EmitContext {
  readonly component: IRComponent
  readonly slots: SlotInfo[]
  readonly diagnostics: ReactEmitterDiagnostic[]
  readonly classNames: Map<IRSurface | IRStack | IRText, string>
}

class CodeWriter {
  private lines: string[] = []
  private indent = 0

  write(line = ""): void {
    this.lines.push(line === "" ? "" : `${"  ".repeat(this.indent)}${line}`)
  }

  indented(fn: () => void): void {
    this.indent += 1
    fn()
    this.indent -= 1
  }

  toString(): string {
    return this.lines.join("\n")
  }
}

export function emitReactProgram(program: IRProgram): ReactProgramArtifacts {
  const components = program.components.map(emitReactComponent)
  return {
    tokens: emitTokensArtifact(program),
    components,
    diagnostics: components.flatMap((component) => component.diagnostics),
  }
}

export function emitReactComponent(component: IRComponent): ReactComponentArtifacts {
  const diagnostics: ReactEmitterDiagnostic[] = []
  const context: EmitContext = {
    component,
    slots: collectSlots(component.root),
    diagnostics,
    classNames: buildClassNameMap(component.root),
  }

  return {
    componentName: component.name,
    source: {
      path: `${component.name}.tsx`,
      content: emitComponentSource(context),
    },
    styles: {
      path: `${component.name}.module.css`,
      content: emitComponentStyles(context),
    },
    diagnostics,
  }
}

function emitTokensArtifact(program: IRProgram): EmittedArtifact | null {
  const tokenDefs = program.tokens.flatMap((tokens) => tokens.defs)
  if (tokenDefs.length === 0 && program.themes.length === 0) {
    return null
  }

  const writer = new CodeWriter()
  writer.write(":root {")
  writer.indented(() => {
    for (const def of tokenDefs) {
      writer.write(`${tokenPathToCSSVar(def)}: ${tokenValueToCSS(def.value)};`)
    }
  })
  writer.write("}")

  for (const theme of program.themes) {
    writer.write("")
    writer.write(`[data-framelab-theme="${theme.name}"] {`)
    writer.indented(() => {
      for (const def of theme.defs) {
        writer.write(`${tokenPathToCSSVar(def)}: ${tokenValueToCSS(def.value)};`)
      }
    })
    writer.write("}")
  }

  return {
    path: "tokens.css",
    content: writer.toString(),
  }
}

function emitComponentSource(context: EmitContext): string {
  const writer = new CodeWriter()
  const component = context.component

  writer.write(`import React from "react"`)
  writer.write(`import styles from "./${component.name}.module.css"`)
  writer.write("")

  emitVariantAliases(writer, component)
  if (component.variants.length > 0) {
    writer.write("")
  }
  emitSlotInterface(writer, component.name, context.slots)
  if (context.slots.length > 0) {
    writer.write("")
  }
  emitPropsInterface(writer, component, context.slots)
  writer.write("")
  emitStateAttrHelper(writer)
  writer.write("")
  emitComponentFunction(writer, context)

  return writer.toString()
}

function emitVariantAliases(writer: CodeWriter, component: IRComponent): void {
  for (const variant of component.variants) {
    const typeName = `${component.name}${pascalCase(variant.axis)}Variant`
    const union = variant.values.map((value) => JSON.stringify(value)).join(" | ")
    writer.write(`type ${typeName} = ${union}`)
  }
}

function emitSlotInterface(writer: CodeWriter, componentName: string, slots: SlotInfo[]): void {
  if (slots.length === 0) {
    return
  }

  writer.write(`interface ${componentName}Slots {`)
  writer.indented(() => {
    for (const slot of slots) {
      const optional = slot.required ? "" : "?"
      writer.write(`${camelCase(slot.name)}${optional}: React.ReactNode`)
    }
  })
  writer.write("}")
}

function emitPropsInterface(writer: CodeWriter, component: IRComponent, slots: SlotInfo[]): void {
  writer.write(`interface ${component.name}Props {`)
  writer.indented(() => {
    for (const variant of component.variants) {
      const optional = variant.default === null ? "" : "?"
      writer.write(`${camelCase(variant.axis)}${optional}: ${component.name}${pascalCase(variant.axis)}Variant`)
    }
    for (const prop of component.props) {
      const optional = prop.default === null ? "" : "?"
      writer.write(`${camelCase(prop.name)}${optional}: ${toTypeScriptType(prop.propType)}`)
    }
    if (slots.length > 0) {
      const optional = slots.some((slot) => slot.required) ? "" : "?"
      writer.write(`slots${optional}: ${component.name}Slots`)
    }
    writer.write(`states?: Record<string, boolean | undefined>`)
    if (component.intent !== null) {
      if (component.intent.intentKind === "navigate") {
        writer.write(`href?: string`)
      }
      if (component.intent.intentKind !== "submit" && component.intent.intentKind !== "navigate") {
        writer.write(`onIntent?: (identifier: string) => void`)
      }
    }
  })
  writer.write("}")
}

function emitStateAttrHelper(writer: CodeWriter): void {
  writer.write(`function buildStateAttrs(states?: Record<string, boolean | undefined>): Record<string, string | undefined> {`)
  writer.indented(() => {
    writer.write(`const attrs: Record<string, string | undefined> = {}`)
    writer.write(`for (const [name, enabled] of Object.entries(states ?? {})) {`)
    writer.indented(() => {
      writer.write(`if (enabled) {`)
      writer.indented(() => {
        writer.write(`attrs[\`data-state-\${name}\`] = "true"`)
      })
      writer.write(`}`)
    })
    writer.write(`}`)
    writer.write(`return attrs`)
  })
  writer.write("}")
}

function emitComponentFunction(writer: CodeWriter, context: EmitContext): void {
  const component = context.component

  writer.write(`export function ${component.name}(props: ${component.name}Props): React.ReactElement {`)
  writer.indented(() => {
    emitDestructuring(writer, context)
    writer.write(`const variantAttrs = {`)
    writer.indented(() => {
      for (const variant of component.variants) {
        writer.write(`"data-${variant.axis}": ${camelCase(variant.axis)},`)
      }
    })
    writer.write(`}`)
    writer.write(`const stateAttrs = buildStateAttrs(states)`)
    writer.write("")
    writer.write(`return (`)
    writer.indented(() => {
      emitRoot(writer, context)
    })
    writer.write(`)`)
  })
  writer.write("}")
  writer.write("")
  writer.write(`export default ${component.name}`)
}

function emitDestructuring(writer: CodeWriter, context: EmitContext): void {
  const entries: string[] = []
  const component = context.component

  for (const variant of component.variants) {
    const name = camelCase(variant.axis)
    entries.push(variant.default === null ? name : `${name} = ${JSON.stringify(variant.default)}`)
  }
  for (const prop of component.props) {
    const name = camelCase(prop.name)
    entries.push(prop.default === null ? name : `${name} = ${literalToExpression(prop.default)}`)
  }
  if (context.slots.length > 0) {
    entries.push("slots")
  }
  entries.push("states")
  if (component.intent !== null) {
    if (component.intent.intentKind === "navigate") {
      entries.push(`href = "#"`)
    }
    if (component.intent.intentKind !== "submit" && component.intent.intentKind !== "navigate") {
      entries.push("onIntent")
    }
  }

  writer.write(`const { ${entries.join(", ")} } = props`)
}

function emitRoot(writer: CodeWriter, context: EmitContext): void {
  const { component } = context

  if (component.intent === null) {
    emitNode(writer, component.root, context, buildAccessibleProps(component.accessible, context))
    return
  }

  const tagName = intentTagName(component.intent.intentKind)
  writer.write(`<${tagName}`)
  writer.indented(() => {
    writer.write(`className={styles.intent}`)
    for (const prop of buildIntentProps(component.intent, component.accessible, context)) {
      writer.write(prop)
    }
  })
  writer.write(`>`)
  writer.indented(() => {
    emitNode(writer, component.root, context)
  })
  writer.write(`</${tagName}>`)
}

function emitNode(writer: CodeWriter, node: IRNode, context: EmitContext, extraProps: string[] = []): void {
  switch (node.kind) {
    case "IRSurface":
      emitElementNode(writer, node, surfaceTagName(node), context, extraProps)
      return
    case "IRStack":
      emitElementNode(writer, node, "div", context, extraProps)
      return
    case "IRText":
      emitElementNode(writer, node, textTagName(node), context, extraProps)
      return
    case "IRSlot":
      emitSlotExpression(writer, node, context)
      return
  }
}

function emitElementNode(
  writer: CodeWriter,
  node: IRSurface | IRStack | IRText,
  tagName: string,
  context: EmitContext,
  extraProps: string[] = [],
): void {
  const children = childNodesOf(node)
  const textParts = node.kind === "IRText" ? textRenderableParts(node) : []
  const hasChildren = children.length > 0 || textParts.length > 0

  writer.write(`<${tagName}`)
  writer.indented(() => {
    writer.write(`className={styles.${classNameOf(node, context)}}`)
    writer.write(`{...variantAttrs}`)
    writer.write(`{...stateAttrs}`)
    for (const prop of extraProps) {
      writer.write(prop)
    }
  })
  if (!hasChildren) {
    writer.write(`/>`)
    return
  }
  writer.write(`>`)
  writer.indented(() => {
    for (const part of textParts) {
      if (part.kind === "slot") {
        emitSlotExpression(writer, part.slot, context)
      } else {
        writer.write(part.expression)
      }
    }
    for (const child of children) {
      emitNode(writer, child, context)
    }
  })
  writer.write(`</${tagName}>`)
}

function childNodesOf(node: IRSurface | IRStack | IRText): IRNode[] {
  if (node.kind === "IRSurface" || node.kind === "IRStack") {
    return node.children
  }
  return []
}

function textRenderableParts(node: IRText): Array<{ kind: "expr"; expression: string } | { kind: "slot"; slot: IRSlot }> {
  const parts: Array<{ kind: "expr"; expression: string } | { kind: "slot"; slot: IRSlot }> = []

  for (const prop of node.props) {
    if (prop.name === "content") {
      parts.push({ kind: "expr", expression: renderContentExpression(prop.value, null) })
    }
  }
  if (node.slot !== null) {
    parts.push({ kind: "slot", slot: node.slot })
  }

  return parts
}

function emitSlotExpression(writer: CodeWriter, slot: IRSlot, context: EmitContext): void {
  const propName = camelCase(slot.name)
  const fallback = slot.fallback
  if (fallback === null || fallback.length === 0) {
    writer.write(`{slots?.${propName} ?? null}`)
    return
  }

  writer.write(`{slots?.${propName} ?? (`)
  writer.indented(() => {
    if (fallback.length > 1) {
      writer.write(`<>`)
      writer.indented(() => {
        for (const child of fallback) {
          emitNode(writer, child, context)
        }
      })
      writer.write(`</>`)
    } else {
      emitNode(writer, fallback[0], context)
    }
  })
  writer.write(`)}`)
}

function emitComponentStyles(context: EmitContext): string {
  const writer = new CodeWriter()
  const { component, diagnostics } = context

  if (component.intent !== null) {
    writer.write(`.intent {}`)
    writer.write("")
  }

  writer.write(`.root {`)
  writer.indented(() => {
    for (const declaration of declarationsForNode(component.root, component.name, diagnostics)) {
      writer.write(declaration)
    }
  })
  writer.write(`}`)

  for (const node of styledDescendants(component.root)) {
    writer.write("")
    writer.write(`.${classNameOf(node, context)} {`)
    writer.indented(() => {
      for (const declaration of declarationsForNode(node, component.name, diagnostics)) {
        writer.write(declaration)
      }
    })
    writer.write(`}`)
  }

  const stateBlocks = emitStateBlocks(component.root, context)
  const variantBlocks = emitVariantBlocks(component.root, context)

  if (stateBlocks.length > 0) {
    writer.write("")
    writer.write(`/* State Overrides */`)
    for (const block of stateBlocks) {
      writer.write("")
      writer.write(block)
    }
  }

  if (variantBlocks.length > 0) {
    writer.write("")
    writer.write(`/* Variant Overrides */`)
    for (const block of variantBlocks) {
      writer.write("")
      writer.write(block)
    }
  }

  return writer.toString()
}

function declarationsForNode(
  node: IRSurface | IRStack | IRText,
  componentName: string,
  diagnostics: ReactEmitterDiagnostic[],
): string[] {
  switch (node.kind) {
    case "IRSurface":
      return node.props.flatMap((prop) => propToDeclarations(prop, componentName, diagnostics))
    case "IRStack":
      return stackDeclarations(node)
    case "IRText":
      return node.props.flatMap((prop) => propToDeclarations(prop, componentName, diagnostics))
  }
}

function stackDeclarations(node: IRStack): string[] {
  const declarations = [
    "display: flex;",
    `flex-direction: ${node.direction === "horizontal" ? "row" : "column"};`,
    `flex-wrap: ${node.wrap ? "wrap" : "nowrap"};`,
  ]
  if (node.gap !== null) {
    declarations.push(`gap: ${tokenRefToCSS(node.gap)};`)
  }
  if (node.align !== null) {
    declarations.push(`align-items: ${mapAlign(node.align)};`)
  }
  if (node.justify !== null) {
    declarations.push(`justify-content: ${mapJustify(node.justify)};`)
  }
  return declarations
}

function propToDeclarations(
  prop: IRProp,
  componentName: string,
  diagnostics: ReactEmitterDiagnostic[],
): string[] {
  switch (prop.name) {
    case "fill":
      return declaration("background", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "radius":
      return declaration("border-radius", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "padding":
      return declaration("padding", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "depth":
      return declaration("box-shadow", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "outline": {
      const value = cssStaticValue(prop.value, componentName, diagnostics, prop)
      return value === null ? [] : [`border: 1px solid ${value};`]
    }
    case "opacity":
      return declaration("opacity", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "aspect":
      return declaration("aspect-ratio", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "width":
      return declaration("width", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "height":
      return declaration("height", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "text-color":
      return declaration("color", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "size":
      return declaration("font-size", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "weight":
      return declaration("font-weight", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "align":
      return declaration("text-align", cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "truncate":
      return truncateDeclarations(cssStaticValue(prop.value, componentName, diagnostics, prop))
    case "content":
    case "level":
      return []
    default:
      pushDiagnostic(diagnostics, componentName, "RE-UNSUPPORTED-PROP", `Emitter does not map prop '${prop.name}' to React/CSS output.`, prop.provenance)
      return []
  }
}

function declaration(name: string, value: string | null): string[] {
  return value === null ? [] : [`${name}: ${value};`]
}

function truncateDeclarations(value: string | null): string[] {
  if (value === null) {
    return []
  }
  const match = value.match(/^([0-9]+)\s+lines$/)
  if (!match) {
    return []
  }
  return [
    "overflow: hidden;",
    "display: -webkit-box;",
    `-webkit-line-clamp: ${match[1]};`,
    "-webkit-box-orient: vertical;",
  ]
}

function cssStaticValue(
  value: IRPropValue,
  componentName: string,
  diagnostics: ReactEmitterDiagnostic[],
  prop: IRProp,
): string | null {
  switch (value.kind) {
    case "IRTokenRef":
      return tokenRefToCSS(value)
    case "IRNumber":
      return `${value.value}${value.suffix ?? ""}`
    case "IRTransparent":
      return "transparent"
    case "IRAspectVal":
      return `${value.w} / ${value.h}`
    case "IRKeyword":
      return mapKeywordValue(prop.name, value.value)
    case "IRBool":
    case "IRReference":
    case "IRStringValue":
      pushDiagnostic(diagnostics, componentName, "RE-UNSUPPORTED-DYNAMIC-PROP", `Emitter does not support dynamic CSS emission for prop '${prop.name}'.`, prop.provenance)
      return null
  }
}

function tokenRefToCSS(value: IRTokenRef): string {
  return `var(${value.cssVar})`
}

function mapKeywordValue(propName: string, value: string): string {
  if (propName === "weight") {
    switch (value) {
      case "regular":
        return "400"
      case "medium":
        return "500"
      case "semibold":
        return "600"
      case "bold":
        return "700"
    }
  }
  if (propName === "align") {
    switch (value) {
      case "start":
        return "left"
      case "center":
        return "center"
      case "end":
        return "right"
      case "stretch":
        return "justify"
    }
  }
  return value
}

function emitStateBlocks(node: IRNode, context: EmitContext): string[] {
  const blocks: string[] = []
  if (node.kind === "IRSurface" || node.kind === "IRText") {
    const className = classNameOf(node, context)
    for (const state of node.states) {
      const declarations = state.props.flatMap((prop) => propToDeclarations(prop, context.component.name, context.diagnostics))
      if (state.transition !== null) {
        declarations.push(...transitionDeclarations(state.transition))
      }
      blocks.push(renderCSSBlock(stateSelector(className, state), declarations))
    }
  }
  if (node.kind === "IRSurface" || node.kind === "IRStack") {
    for (const child of node.children) {
      blocks.push(...emitStateBlocks(child, context))
    }
  }
  if (node.kind === "IRText" && node.slot !== null) {
    blocks.push(...emitStateBlocks(node.slot, context))
  }
  if (node.kind === "IRSlot") {
    for (const child of node.fallback ?? []) {
      blocks.push(...emitStateBlocks(child, context))
    }
  }
  return blocks
}

function emitVariantBlocks(node: IRNode, context: EmitContext): string[] {
  const blocks: string[] = []
  if (node.kind === "IRSurface" || node.kind === "IRText") {
    const className = classNameOf(node, context)
    for (const variant of node.variants) {
      for (const variantCase of variant.cases) {
        const declarations = variantCase.props.flatMap((prop) => propToDeclarations(prop, context.component.name, context.diagnostics))
        blocks.push(renderCSSBlock(`.${className}[data-${variant.axis}="${variantCase.value}"]`, declarations))
      }
    }
  }
  if (node.kind === "IRSurface" || node.kind === "IRStack") {
    for (const child of node.children) {
      blocks.push(...emitVariantBlocks(child, context))
    }
  }
  if (node.kind === "IRText" && node.slot !== null) {
    blocks.push(...emitVariantBlocks(node.slot, context))
  }
  if (node.kind === "IRSlot") {
    for (const child of node.fallback ?? []) {
      blocks.push(...emitVariantBlocks(child, context))
    }
  }
  if (node.kind === "IRSurface") {
    for (const motion of node.motions) {
      emitUnsupportedMotion(context.component.name, context.diagnostics, motion)
    }
  }
  return blocks
}

function renderCSSBlock(selector: string, declarations: string[]): string {
  const writer = new CodeWriter()
  writer.write(`${selector} {`)
  writer.indented(() => {
    for (const declaration of declarations) {
      writer.write(declaration)
    }
  })
  writer.write("}")
  return writer.toString()
}

function stateSelector(className: string, state: IRState): string {
  switch (state.name) {
    case "hover":
      return `.${className}:hover`
    case "focus":
      return `.${className}:focus-visible`
    case "active":
      return `.${className}:active`
    default:
      return `.${className}[data-state-${state.name}="true"]`
  }
}

function transitionDeclarations(transition: IRTransition): string[] {
  return [`transition: all ${tokenRefToCSS(transition.duration)} ${tokenRefToCSS(transition.ease)};`]
}

function emitUnsupportedMotion(
  componentName: string,
  diagnostics: ReactEmitterDiagnostic[],
  motion: IRMotion,
): void {
  pushDiagnostic(
    diagnostics,
    componentName,
    "RE-UNSUPPORTED-MOTION",
    `Emitter does not implement motion '${motion.kind}' yet.`,
    motion.provenance,
  )
}

function buildIntentProps(intent: IRComponent["intent"], accessible: IRAccessible | null, context: EmitContext): string[] {
  if (intent === null) {
    return []
  }

  const props: string[] = [
    `data-intent=${JSON.stringify(intent.identifier)}`,
    ...buildAccessibleProps(accessible, context),
  ]

  switch (intent.intentKind) {
    case "trigger":
    case "toggle":
    case "expand":
    case "dismiss":
      props.push(`type="button"`)
      props.push(`onClick={onIntent ? () => onIntent(${JSON.stringify(intent.identifier)}) : undefined}`)
      break
    case "submit":
      props.push(`type="submit"`)
      break
    case "navigate":
      props.push(`href={href}`)
      break
  }

  return props
}

function buildAccessibleProps(accessible: IRAccessible | null, context: EmitContext): string[] {
  if (accessible === null) {
    return []
  }

  const props: string[] = []
  if (accessible.role !== null) {
    props.push(`role=${JSON.stringify(accessible.role)}`)
  }
  if (accessible.label !== null) {
    props.push(`aria-label={${stringValueExpression(toIRString(accessible.label, context.component), context)}}`)
  }
  if (accessible.description !== null) {
    props.push(`aria-description={${stringValueExpression(toIRString(accessible.description, context.component), context)}}`)
  }
  if (accessible.live !== null) {
    props.push(`aria-live=${JSON.stringify(accessible.live)}`)
  }
  if (accessible.hidden !== null) {
    props.push(`aria-hidden={${accessible.hidden ? "true" : "false"}}`)
  }
  return props
}

function toIRString(value: string, component: IRComponent): IRStringValue {
  return {
    kind: "IRStringValue",
    value,
    refs: collectRefsFromString(value, component),
  }
}

function collectRefsFromString(value: string, component: IRComponent): IRStringValue["refs"] {
  return [...value.matchAll(/@([a-zA-Z][a-zA-Z0-9-]*)/g)].map((match) => ({
    name: match[1],
    source: component.props.some((prop) => prop.name === match[1])
      ? "prop"
      : component.variants.some((variant) => variant.axis === match[1])
        ? "variant"
        : null,
  }))
}

function renderContentExpression(value: IRPropValue, fallback: string | null): string {
  switch (value.kind) {
    case "IRStringValue":
      return `{${stringLiteralExpression(value)}}`
    case "IRReference":
      return `{${referenceExpression(value)}}`
    default:
      return fallback ?? "{null}"
  }
}

function stringLiteralExpression(value: IRStringValue): string {
  if (value.refs.length === 0) {
    return JSON.stringify(value.value)
  }

  let template = escapeTemplateLiteral(value.value)
  for (const ref of value.refs) {
    const variable = ref.source === null ? "undefined" : camelCase(ref.name)
    template = template.split(`@${ref.name}`).join(`\${${variable}}`)
  }
  return `\`${template}\``
}

function stringValueExpression(value: IRStringValue, context: EmitContext): string {
  if (value.refs.length === 0) {
    return JSON.stringify(value.value)
  }

  let template = escapeTemplateLiteral(value.value)
  for (const ref of value.refs) {
    const variable = ref.source === null ? unresolvedRefExpression(ref.name, context) : camelCase(ref.name)
    template = template.split(`@${ref.name}`).join(`\${${variable}}`)
  }
  return `\`${template}\``
}

function referenceExpression(value: IRReference): string {
  return value.resolvedSource === null ? "undefined" : camelCase(value.name)
}

function unresolvedRefExpression(name: string, context: EmitContext): string {
  pushDiagnostic(context.diagnostics, context.component.name, "RE-UNRESOLVED-REF", `Emitter could not resolve reference '@${name}' in generated output.`)
  return "undefined"
}

function surfaceTagName(node: IRSurface): string {
  return node.role === "article" ? "article" : "div"
}

function textTagName(node: IRText): string {
  switch (node.role) {
    case "heading":
      return `h${Math.min(Math.max(node.level ?? 1, 1), 6)}`
    case "body":
      return "p"
    case "label":
      return "label"
    case "caption":
      return "small"
    default:
      return "span"
  }
}

function intentTagName(kind: NonNullable<IRComponent["intent"]>["intentKind"]): string {
  return kind === "navigate" ? "a" : "button"
}

function buildClassNameMap(root: IRSurface | IRStack): Map<IRSurface | IRStack | IRText, string> {
  const map = new Map<IRSurface | IRStack | IRText, string>()
  let nextId = 1
  map.set(root, "root")

  for (const node of descendantsOf(root)) {
    if (node.kind === "IRSlot") {
      continue
    }
    map.set(node, `node${nextId}`)
    nextId += 1
  }

  return map
}

function collectSlots(root: IRNode): SlotInfo[] {
  const slots = new Map<string, SlotInfo>()
  for (const node of descendantsOf(root)) {
    if (node.kind === "IRSlot") {
      slots.set(node.name, { name: node.name, required: node.required })
    }
  }
  return [...slots.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function* descendantsOf(node: IRNode): Generator<IRNode> {
  if (node.kind === "IRSurface" || node.kind === "IRStack") {
    for (const child of node.children) {
      yield child
      yield* descendantsOf(child)
    }
    return
  }
  if (node.kind === "IRText" && node.slot !== null) {
    yield node.slot
    yield* descendantsOf(node.slot)
    return
  }
  if (node.kind === "IRSlot") {
    for (const child of node.fallback ?? []) {
      yield child
      yield* descendantsOf(child)
    }
  }
}

function styledDescendants(root: IRNode): Array<IRSurface | IRStack | IRText> {
  const nodes: Array<IRSurface | IRStack | IRText> = []
  for (const node of descendantsOf(root)) {
    if (node.kind !== "IRSlot") {
      nodes.push(node)
    }
  }
  return nodes
}

function classNameOf(node: IRSurface | IRStack | IRText, context: EmitContext): string {
  const className = context.classNames.get(node)
  if (!className) {
    throw new Error(`Missing class name for ${node.kind} in component '${context.component.name}'.`)
  }
  return className
}

function tokenPathToCSSVar(def: IRTokenDef): string {
  return `--${def.path.replace(/\./g, "-")}`
}

function tokenValueToCSS(value: IRTokenValue): string {
  switch (value.kind) {
    case "HexColor":
      return value.value
    case "StringVal":
      return value.value
    case "NumberVal":
      return `${value.value}${value.suffix ?? ""}`
  }
}

function toTypeScriptType(type: IRComponent["props"][number]["propType"]): string {
  switch (type) {
    case "text":
      return "string"
    case "number":
      return "number"
    case "boolean":
      return "boolean"
  }
}

function literalToExpression(value: string | number | boolean): string {
  return typeof value === "string" ? JSON.stringify(value) : String(value)
}

function camelCase(value: string): string {
  return value.replace(/-([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase())
}

function pascalCase(value: string): string {
  const camel = camelCase(value)
  return camel.charAt(0).toUpperCase() + camel.slice(1)
}

function escapeTemplateLiteral(value: string): string {
  return value.replace(/[`\\]/g, "\\$&").replace(/\$\{/g, "\\${")
}

function mapAlign(value: string): string {
  switch (value) {
    case "start":
      return "flex-start"
    case "end":
      return "flex-end"
    case "center":
      return "center"
    case "stretch":
      return "stretch"
    default:
      return value
  }
}

function mapJustify(value: string): string {
  switch (value) {
    case "start":
      return "flex-start"
    case "end":
      return "flex-end"
    case "center":
      return "center"
    case "between":
      return "space-between"
    default:
      return value
  }
}

function pushDiagnostic(
  diagnostics: ReactEmitterDiagnostic[],
  component: string,
  code: string,
  message: string,
  provenance?: SourceProvenance,
): void {
  diagnostics.push({
    code,
    severity: "warning",
    component,
    message,
    provenance,
  })
}
