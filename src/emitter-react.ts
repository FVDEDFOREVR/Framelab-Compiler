// =============================================================================
// FRAMELAB → React Emitter — v0.1 MVP
//
// Converts a parsed ComponentDecl into:
//   - A .tsx file (React function component)
//   - A .module.css file (scoped styles)
//
// Scope: surface, stack, text nodes, token refs, bindings, state hover/focus,
//        when blocks, repeat blocks, intent triggers.
//        Motion compiles to CSS transitions.
//        Tokens compile to CSS custom properties.
// =============================================================================

import {
  Program, ComponentDecl, ComponentParam, VariantParam, PropParam,
  ComponentBodyItem, VisualNode, NodeChild, NodeType,
  Prop, PropValue, TokenRef, BindingExpr, TernaryExpr, VariantExpr, VariantEntry,
  StateBlock, StateProps, MotionProp,
  IntentDecl, GestureHandler, ActionCall,
  WhenBlock, RepeatBlock, ConditionExpr,
  Expr, Literal, StringLiteral, NumberLiteral, BooleanLiteral, NullLiteral,
  RoleDecl, A11yDecl,
  TokensDecl, ThemeDecl, TokenEntry, TokenValue,
  ColorValue, DimensionValue, DurationValue, StringValue, NumberValue,
} from "./ast"

// =============================================================================
// Output types
// =============================================================================

export interface EmittedFile {
  path:    string
  content: string
}

// =============================================================================
// Code generation helpers
// =============================================================================

class CodeWriter {
  private lines:  string[] = []
  private indent: number   = 0

  write(line: string = ""): void {
    const prefix = "  ".repeat(this.indent)
    this.lines.push(line === "" ? "" : prefix + line)
  }

  indented(fn: () => void): void {
    this.indent++
    fn()
    this.indent--
  }

  toString(): string {
    return this.lines.join("\n")
  }
}

// =============================================================================
// Emitter
// =============================================================================

export class ReactEmitter {

  // ---------------------------------------------------------------------------
  // Program entry
  // ---------------------------------------------------------------------------

  emitProgram(program: Program): EmittedFile[] {
    const files: EmittedFile[] = []

    // Emit CSS tokens file from any tokens/theme declarations
    const tokensFile = this.emitTokensCSS(program)
    if (tokensFile) files.push(tokensFile)

    // Emit each component
    for (const node of program.body) {
      if (node.kind === "ComponentDecl") {
        files.push(...this.emitComponent(node))
      }
    }

    return files
  }

  // ---------------------------------------------------------------------------
  // tokens.css
  // ---------------------------------------------------------------------------

  private emitTokensCSS(program: Program): EmittedFile | null {
    const css = new CodeWriter()
    let   hasTokens = false

    css.write(":root {")
    css.indented(() => {
      for (const node of program.body) {
        if (node.kind === "TokensDecl" || node.kind === "ThemeDecl") {
          for (const entry of node.entries) {
            hasTokens = true
            const varName = "--" + entry.path.join("-")
            const value   = this.tokenValueToCSS(entry.value)
            css.write(`${varName}: ${value};`)
          }
        }
      }
    })
    css.write("}")

    // Dark/alternate themes
    for (const node of program.body) {
      if (node.kind === "ThemeDecl" && node.extends !== null) {
        css.write("")
        css.write(`[data-theme="${node.name}"] {`)
        css.indented(() => {
          for (const entry of node.entries) {
            const varName = "--" + entry.path.join("-")
            const value   = this.tokenValueToCSS(entry.value)
            css.write(`${varName}: ${value};`)
          }
        })
        css.write("}")
      }
    }

    if (!hasTokens) return null

    return { path: "tokens.css", content: css.toString() }
  }

  private tokenValueToCSS(v: TokenValue): string {
    switch (v.kind) {
      case "ColorValue":     return v.value
      case "DimensionValue": return `${v.value}${v.unit}`
      case "DurationValue":  return `${v.value}${v.unit}`
      case "NumberValue":    return String(v.value)
      case "StringValue":    return v.value
    }
  }

  // ---------------------------------------------------------------------------
  // Component → .tsx + .module.css
  // ---------------------------------------------------------------------------

  emitComponent(comp: ComponentDecl): EmittedFile[] {
    const tsx     = this.emitComponentTSX(comp)
    const cssFile = this.emitComponentCSS(comp)
    return [
      { path: `${comp.name}.tsx`,  content: tsx          },
      { path: cssFile.path,        content: cssFile.content },
    ]
  }

  // ---------------------------------------------------------------------------
  // TSX file
  // ---------------------------------------------------------------------------

  private emitComponentTSX(comp: ComponentDecl): string {
    const w = new CodeWriter()

    // Imports
    w.write(`import React from "react"`)
    w.write(`import styles from "./${comp.name}.module.css"`)
    w.write(`import clsx from "clsx"`)
    w.write(`import { useSignal } from "./runtime/signals"`)
    w.write("")

    // Props interface
    this.emitPropsInterface(w, comp)
    w.write("")

    // Component function
    const paramList = this.buildParamDestructure(comp.params)
    w.write(`export default function ${comp.name}(${paramList}) {`)
    w.indented(() => {
      // Hover/focus state variables
      const states = this.collectDeclaredStates(comp.body)
      if (states.has("hover")) {
        w.write(`const [isHovered, setIsHovered] = React.useState(false)`)
      }
      if (states.has("focus")) {
        w.write(`const [isFocused, setIsFocused] = React.useState(false)`)
      }
      if (states.has("loading")) {
        w.write(`const [isLoading, setIsLoading] = React.useState(false)`)
      }
      if (states.size > 0) w.write("")

      w.write("return (")
      w.indented(() => {
        w.write("<>")
        w.indented(() => {
          for (const item of comp.body) {
            this.emitBodyItem(w, item, comp)
          }
        })
        w.write("</>")
      })
      w.write(")")
    })
    w.write("}")

    return w.toString()
  }

  private emitPropsInterface(w: CodeWriter, comp: ComponentDecl): void {
    // Variant type aliases
    for (const param of comp.params) {
      if (param.kind === "VariantParam") {
        const unionType = param.options.map(o => `"${o}"`).join(" | ")
        w.write(`type ${comp.name}${this.capitalize(param.name)} = ${unionType}`)
      }
    }

    w.write(`interface ${comp.name}Props {`)
    w.indented(() => {
      for (const param of comp.params) {
        if (param.kind === "VariantParam") {
          const typeName = `${comp.name}${this.capitalize(param.name)}`
          w.write(`${param.name}?: ${typeName}`)
        } else {
          const tsType  = this.framelabTypeToTS(param.typeExpr.base, param.typeExpr.isList)
          const optional = param.defaultValue !== null || param.typeExpr.nullable ? "?" : ""
          w.write(`${param.name}${optional}: ${tsType}`)
        }
      }
    })
    w.write("}")
  }

  private buildParamDestructure(params: ComponentParam[]): string {
    if (params.length === 0) return ""

    const compName = ""  // not needed for the type, just for the param list
    const defaults: string[] = []
    for (const p of params) {
      if (p.kind === "VariantParam") {
        defaults.push(`${p.name} = "${p.defaultValue}"`)
      } else if (p.defaultValue) {
        defaults.push(`${p.name} = ${this.emitLiteral(p.defaultValue)}`)
      } else {
        defaults.push(p.name)
      }
    }

    // Use first param's component name for the type
    const typeName = "{" + defaults.join(", ") + "}"
    return typeName
  }

  // ---------------------------------------------------------------------------
  // Body item dispatch
  // ---------------------------------------------------------------------------

  private emitBodyItem(w: CodeWriter, item: ComponentBodyItem, comp: ComponentDecl): void {
    if (item.kind === "VisualNode")  { this.emitVisualNode(w, item, comp); return }
    if (item.kind === "RoleDecl")    { return } // handled at node level
    if (item.kind === "A11yDecl")   { return } // handled at node level
    if (item.kind === "StateBlock")  { return } // handled at node level
    if (item.kind === "SlotDecl")    { return } // [later]
  }

  // ---------------------------------------------------------------------------
  // Visual node → JSX element
  // ---------------------------------------------------------------------------

  private emitVisualNode(w: CodeWriter, node: VisualNode, comp: ComponentDecl): void {
    const { tag, role } = this.nodeTypeToHTML(node)

    // Collect props from inline params AND from the body's prop lines
    const allProps = this.collectAllProps(node)

    // Collect state blocks from children
    const stateBlocks = this.collectStateBlocks(node.children)

    // Build className
    const className = this.buildClassName(node, stateBlocks, allProps)

    // Build inline style (for token values that map to CSS vars)
    const style = this.buildInlineStyle(allProps)

    // Build event handlers from state blocks
    const events = this.buildEventHandlers(stateBlocks)

    // Build HTML attributes
    const attrs = this.buildAttributes(node, allProps, role)

    // Build opening tag
    const attrString = [className, style, ...attrs, ...events]
      .filter(Boolean)
      .join("\n" + "  ".repeat(w["indent"] + 2))

    // Get actual child nodes (not prop lines or state blocks)
    const childNodes = this.getChildNodes(node.children)

    if (childNodes.length === 0) {
      // Check for content prop
      const contentProp = allProps.find(p => p.name === "content")
      if (contentProp) {
        w.write(`<${tag}${attrString ? "\n" + "  ".repeat(w["indent"] + 1) + attrString : ""}>`)
        w.indented(() => {
          w.write(this.emitPropValueAsJSX(contentProp.value))
        })
        w.write(`</${tag}>`)
      } else {
        w.write(`<${tag}${attrString ? " " + attrString : ""} />`)
      }
      return
    }

    w.write(`<${tag}${attrString ? " " + attrString : ""}>`)
    w.indented(() => {
      // content prop first if present
      const contentProp = allProps.find(p => p.name === "content")
      if (contentProp) {
        w.write(this.emitPropValueAsJSX(contentProp.value))
      }
      for (const child of childNodes) {
        this.emitNodeChild(w, child, comp)
      }
    })
    w.write(`</${tag}>`)
  }

  private emitNodeChild(w: CodeWriter, child: NodeChild, comp: ComponentDecl): void {
    if (child.kind === "VisualNode")  { this.emitVisualNode(w, child, comp); return }
    if (child.kind === "WhenBlock")   { this.emitWhenBlock(w, child, comp); return }
    if (child.kind === "RepeatBlock") { this.emitRepeatBlock(w, child, comp); return }
    if (child.kind === "IntentDecl")  { this.emitIntentDecl(w, child, comp); return }
    if ((child as any).kind === "StateBlock")  { return } // handled at parent level
    if (child.kind === "TextContent") { return } // prop lines — handled at parent
  }

  // ---------------------------------------------------------------------------
  // When block
  // ---------------------------------------------------------------------------

  private emitWhenBlock(w: CodeWriter, block: WhenBlock, comp: ComponentDecl): void {
    const condition = this.emitCondition(block.condition)

    w.write(`{${condition} && (`)
    w.indented(() => {
      if (block.consequent.length === 1) {
        this.emitNodeChild(w, block.consequent[0], comp)
      } else {
        w.write("<>")
        w.indented(() => {
          for (const child of block.consequent) {
            this.emitNodeChild(w, child, comp)
          }
        })
        w.write("</>")
      }
    })
    w.write(")}")

    if (block.alternate) {
      w.write(`{!(${condition}) && (`)
      w.indented(() => {
        if (block.alternate!.length === 1) {
          this.emitNodeChild(w, block.alternate![0], comp)
        } else {
          w.write("<>")
          w.indented(() => {
            for (const child of block.alternate!) {
              this.emitNodeChild(w, child, comp)
            }
          })
          w.write("</>")
        }
      })
      w.write(")}")
    }
  }

  private emitCondition(cond: ConditionExpr): string {
    if (cond.kind === "IsCondition") {
      const binding = this.emitBinding(cond.binding)
      const check   = `${binding} === "${cond.value}"`
      return cond.negate ? `!(${check})` : check
    }
    // TruthyCondition
    const binding = this.emitBinding(cond.binding)
    return cond.negate ? `!${binding}` : binding
  }

  // ---------------------------------------------------------------------------
  // Repeat block
  // ---------------------------------------------------------------------------

  private emitRepeatBlock(w: CodeWriter, block: RepeatBlock, comp: ComponentDecl): void {
    if (block.source.kind === "NumberLiteral") {
      // e.g. repeat 6 times { SkeletonCard() }
      const arr = `Array.from({ length: ${block.source.value} })`
      w.write(`{${arr}.map((_, i) => (`)
      w.indented(() => {
        w.write(`<React.Fragment key={i}>`)
        w.indented(() => {
          for (const child of block.children) {
            this.emitNodeChild(w, child, comp)
          }
        })
        w.write(`</React.Fragment>`)
      })
      w.write(")}")
      return
    }

    // Binding source
    const source   = this.emitBinding(block.source)
    const itemName = block.itemName ?? "item"
    const keyExpr  = block.keyExpr
      ? `${itemName}.${block.keyExpr.path[block.keyExpr.path.length - 1]}`
      : "i"
    const idxPart  = block.idxName ? `, ${block.idxName}` : ", i"

    if (block.empty) {
      w.write(`{${source}.length === 0 ? (`)
      w.indented(() => {
        w.write("<>")
        w.indented(() => {
          for (const child of block.empty!) {
            this.emitNodeChild(w, child, comp)
          }
        })
        w.write("</>")
      })
      w.write(") : (")
    }

    w.write(`{${source}.map((${itemName}${idxPart}) => (`)
    w.indented(() => {
      w.write(`<React.Fragment key={${keyExpr}}>`)
      w.indented(() => {
        for (const child of block.children) {
          this.emitNodeChild(w, child, comp)
        }
      })
      w.write(`</React.Fragment>`)
    })
    w.write("))}")

    if (block.empty) {
      w.write(")}")
    }
  }

  // ---------------------------------------------------------------------------
  // Intent
  // ---------------------------------------------------------------------------

  private emitIntentDecl(w: CodeWriter, intent: IntentDecl, comp: ComponentDecl): void {
    const label = this.emitPropValueAsJSX(intent.label)
    const ariaLabel = intent.accessibleLabel
      ? ` aria-label={${this.emitExpr(intent.accessibleLabel)}}`
      : ""

    const disabled = intent.disabled
      ? ` disabled={${this.emitExpr(intent.disabled)}}`
      : ""

    // Build onClick from tap handler
    const tapHandler = intent.handlers.find(h => h.gesture === "tap")
    const onClick    = tapHandler
      ? ` onClick={() => ${this.emitActionCall(tapHandler.action)}}`
      : ""

    // Tone → className
    const toneClass = intent.tone
      ? ` className={styles.intent}`
      : ` className={styles.intent}`

    w.write(`<button type="button"${toneClass}${ariaLabel}${disabled}${onClick}>`)
    w.indented(() => {
      if (intent.label.kind === "StringLiteral") {
        w.write(intent.label.value)
      } else {
        w.write(`{${this.emitBinding(intent.label as BindingExpr)}}`)
      }
    })
    w.write("</button>")
  }

  private emitActionCall(action: ActionCall): string {
    const args = action.args.map(a => this.emitExpr(a)).join(", ")
    return `${action.name}(${args})`
  }

  // ---------------------------------------------------------------------------
  // Node type → HTML tag
  // ---------------------------------------------------------------------------

  private nodeTypeToHTML(node: VisualNode): { tag: string; role: string | null } {
    const allProps = this.collectAllProps(node)
    const roleProp = allProps.find(p => p.name === "role")
    const roleStr  = roleProp && roleProp.value.kind === "StringLiteral"
      ? roleProp.value.value
      : null

    // Semantic role → element
    const roleToTag: Record<string, string> = {
      article:    "article",
      section:    "section",
      nav:        "nav",
      navigation: "nav",
      main:       "main",
      header:     "header",
      footer:     "footer",
      aside:      "aside",
      form:       "form",
      search:     "search",
      list:       "ul",
      listitem:   "li",
    }

    switch (node.nodeType) {
      case "surface": {
        if (roleStr && roleToTag[roleStr]) return { tag: roleToTag[roleStr], role: null }
        return { tag: "div", role: roleStr }
      }
      case "stack": return { tag: "div", role: roleStr }
      case "grid":  return { tag: "div", role: roleStr }
      case "text": {
        const alias    = node.alias
        const levelProp = allProps.find(p => p.name === "level")
        const level     = levelProp && levelProp.value.kind === "NumberLiteral"
          ? levelProp.value.value
          : null
        if (alias === "heading" || (roleStr === "heading"))
          return { tag: level ? `h${level}` : "h2", role: null }
        if (alias === "body")    return { tag: "p",    role: null }
        if (alias === "caption") return { tag: "small", role: null }
        if (alias === "overline") return { tag: "span", role: null }
        if (alias === "label")   return { tag: "span", role: null }
        return { tag: "p", role: null }
      }
      case "image":   return { tag: "img",    role: null }
      case "icon":    return { tag: "span",   role: "img" }
      case "input":   return { tag: "input",  role: null }
      case "spinner": return { tag: "span",   role: "status" }
      default:
        // Component reference — return as JSX component
        return { tag: node.nodeType, role: null }
    }
  }

  // ---------------------------------------------------------------------------
  // Attribute building
  // ---------------------------------------------------------------------------

  private buildClassName(node: VisualNode, stateBlocks: StateBlock[], allProps: Prop[]): string {
    const classes: string[] = []

    // Base class from node type + alias
    const baseClass = node.alias
      ? `${node.nodeType}-${node.alias}`
      : node.nodeType
    classes.push(`styles["${this.toCSSClass(baseClass)}"]`)

    // Direction prop → class
    const dirProp = allProps.find(p => p.name === "direction")
    if (dirProp && dirProp.value.kind === "StringLiteral") {
      classes.push(`styles["${this.toCSSClass(baseClass)}-${dirProp.value.value}"]`)
    }

    // State classes
    for (const state of stateBlocks) {
      if (state.name === "hover") {
        classes.push(`isHovered && styles["${this.toCSSClass(baseClass)}-hover"]`)
      }
      if (state.name === "focus") {
        classes.push(`isFocused && styles["${this.toCSSClass(baseClass)}-focus"]`)
      }
    }

    if (classes.length === 1) {
      return `className={${classes[0]}}`
    }
    return `className={clsx(${classes.join(", ")})}`
  }

  private buildInlineStyle(props: Prop[]): string {
    // For MVP: token refs with non-standard props go inline as CSS vars
    // Standard layout props go to the CSS file
    return ""
  }

  private buildEventHandlers(stateBlocks: StateBlock[]): string[] {
    const handlers: string[] = []
    for (const state of stateBlocks) {
      if (state.name === "hover") {
        handlers.push(`onMouseEnter={() => setIsHovered(true)}`)
        handlers.push(`onMouseLeave={() => setIsHovered(false)}`)
      }
      if (state.name === "focus") {
        handlers.push(`onFocus={() => setIsFocused(true)}`)
        handlers.push(`onBlur={() => setIsFocused(false)}`)
      }
    }
    return handlers
  }

  private buildAttributes(node: VisualNode, allProps: Prop[], role: string | null): string[] {
    const attrs: string[] = []

    // role attribute
    if (role) attrs.push(`role="${role}"`)

    // aria-label from accessible label prop
    const a11yLabel = allProps.find(p => p.name === "accessible label")
    if (a11yLabel) {
      attrs.push(`aria-label={${this.emitPropValueRaw(a11yLabel.value)}}`)
    }

    // alt for images
    if (node.nodeType === "image") {
      const altProp = allProps.find(p => p.name === "accessible label" || p.name === "alt")
      const srcProp = allProps.find(p => p.name === "src")
      if (srcProp)  attrs.push(`src={${this.emitPropValueRaw(srcProp.value)}}`)
      if (altProp)  attrs.push(`alt={${this.emitPropValueRaw(altProp.value)}}`)
    }

    // loading prop for image
    const loadingProp = allProps.find(p => p.name === "loading")
    if (loadingProp && node.nodeType === "image") {
      attrs.push(`loading="${(loadingProp.value as StringLiteral).value}"`)
    }

    // id prop
    const idProp = allProps.find(p => p.name === "id")
    if (idProp) attrs.push(`id="${(idProp.value as StringLiteral).value}"`)

    return attrs
  }

  // ---------------------------------------------------------------------------
  // Prop value emission
  // ---------------------------------------------------------------------------

  private emitPropValueAsJSX(value: PropValue): string {
    if (value.kind === "StringLiteral") {
      // Check if it's a template string with @binding interpolations
      // For MVP: just return the string
      return value.value
    }
    if (value.kind === "BindingExpr") {
      return `{${this.emitBinding(value)}}`
    }
    if (value.kind === "TernaryExpr") {
      const cond = this.emitExpr(value.condition as Expr)
      const cons = this.emitPropValueRaw(value.consequent)
      const alt  = this.emitPropValueRaw(value.alternate)
      return `{${cond} ? ${cons} : ${alt}}`
    }
    return `{${this.emitPropValueRaw(value)}}`
  }

  private emitPropValueRaw(value: PropValue): string {
    switch (value.kind) {
      case "TokenRef":
        return `"var(--${value.path.join("-")})"`
      case "BindingExpr":
        return this.emitBinding(value)
      case "StringLiteral":
        return `"${value.value}"`
      case "NumberLiteral":
        return String(value.value)
      case "BooleanLiteral":
        return String(value.value)
      case "TernaryExpr": {
        const cond = this.emitExpr(value.condition as Expr)
        const cons = this.emitPropValueRaw(value.consequent)
        const alt  = this.emitPropValueRaw(value.alternate)
        return `${cond} ? ${cons} : ${alt}`
      }
      case "VariantExpr": {
        const entries = value.entries
          .map(e => `"${e.variant}": ${this.emitPropValueRaw(e.value)}`)
          .join(", ")
        return `({ ${entries} })[${value.param}]`
      }
      default:
        return `""`
    }
  }

  private emitBinding(expr: BindingExpr): string {
    return expr.path.join(".")
  }

  private emitExpr(expr: Expr): string {
    switch (expr.kind) {
      case "BindingExpr":   return this.emitBinding(expr)
      case "StringLiteral": return `"${expr.value}"`
      case "NumberLiteral": return String(expr.value)
      case "BooleanLiteral":return String(expr.value)
      case "NullLiteral":   return "null"
      case "BinaryExpr": {
        const ops: Record<string, string> = {
          "is": "===", "is not": "!==",
          "and": "&&", "or": "||",
          "contains": ".includes",
          "+": "+", "-": "-", ">": ">", "<": "<",
        }
        const op = ops[expr.operator] ?? expr.operator
        if (expr.operator === "contains") {
          return `${this.emitExpr(expr.left)}.includes(${this.emitExpr(expr.right)})`
        }
        return `${this.emitExpr(expr.left)} ${op} ${this.emitExpr(expr.right)}`
      }
      case "UnaryExpr":
        return `!${this.emitExpr(expr.operand)}`
      default:
        return `""`
    }
  }

  private emitLiteral(lit: Literal): string {
    switch (lit.kind) {
      case "StringLiteral":  return `"${lit.value}"`
      case "NumberLiteral":  return String(lit.value)
      case "BooleanLiteral": return String(lit.value)
      case "NullLiteral":    return "null"
    }
  }

  // ---------------------------------------------------------------------------
  // CSS module file
  // ---------------------------------------------------------------------------

  private emitComponentCSS(comp: ComponentDecl): EmittedFile {
    const css = new CodeWriter()

    css.write(`/* ${comp.name}.module.css — generated by FRAMELAB compiler */`)
    css.write("")

    // Collect all nodes and their props/states
    this.emitNodeCSS(css, comp.body)

    return { path: `${comp.name}.module.css`, content: css.toString() }
  }

  private emitNodeCSS(css: CodeWriter, items: ComponentBodyItem[]): void {
    const emittedClasses = new Set<string>()
    for (const item of items) {
      if (item.kind !== "VisualNode") continue
      this.emitVisualNodeCSS(css, item, emittedClasses)
    }
    // Emit shared intent styles once
    css.write(".intent {")
    css.indented(() => {
      css.write("display: inline-flex;")
      css.write("align-items: center;")
      css.write("justify-content: center;")
      css.write("cursor: pointer;")
      css.write("border: none;")
      css.write("background-color: var(--color-action-primary, #0047FF);")
      css.write("color: var(--color-text-onPrimary, #FFFFFF);")
      css.write("border-radius: var(--radius-button, 6px);")
      css.write("padding: var(--space-inset-sm, 8px 16px);")
      css.write("font-size: 0.875rem;")
      css.write("font-weight: 600;")
      css.write("transition: background-color 120ms ease, box-shadow 120ms ease;")
      css.write("cursor: pointer;")
    })
    css.write("}")
    css.write("")
    css.write(".intent:hover {")
    css.indented(() => {
      css.write("background-color: var(--color-action-hover, #0035CC);")
      css.write("box-shadow: 0 2px 8px rgba(0,0,0,0.2);")
    })
    css.write("}")
    css.write("")
    css.write(".intent:focus-visible {")
    css.indented(() => {
      css.write("outline: 2px solid var(--color-action-primary, #0047FF);")
      css.write("outline-offset: 2px;")
    })
    css.write("}")
    css.write("")
    css.write(".intent:disabled {")
    css.indented(() => {
      css.write("opacity: 0.4;")
      css.write("cursor: not-allowed;")
    })
    css.write("}")
  }

  private emitVisualNodeCSS(css: CodeWriter, node: VisualNode, emittedClasses = new Set<string>()): void {
    const baseClass  = node.alias
      ? `${node.nodeType}-${node.alias}`
      : node.nodeType
    const className  = this.toCSSClass(baseClass)
    const allProps   = this.collectAllProps(node)
    const stateBlocks = this.collectStateBlocks(node.children)

    // Base styles
    const baseStyles = this.propsToCSS(node.nodeType, allProps)
    if (baseStyles.length > 0 && !emittedClasses.has(className)) {
      emittedClasses.add(className)
      css.write(`.${className} {`)
      css.indented(() => {
        for (const rule of baseStyles) {
          css.write(rule)
        }
      })
      css.write("}")
      css.write("")
    }

    // Direction variant for stack
    if (node.nodeType === "stack") {
      const dirProp = allProps.find(p => p.name === "direction")
      if (dirProp && dirProp.value.kind === "StringLiteral") {
        const dir = dirProp.value.value
        css.write(`.${className}-${dir} {`)
        css.indented(() => {
          css.write(`flex-direction: ${dir === "vertical" ? "column" : "row"};`)
          const wrapProp = allProps.find(p => p.name === "wrap")
          if (wrapProp && (wrapProp.value as BooleanLiteral).value === true) {
            css.write("flex-wrap: wrap;")
          }
        })
        css.write("}")
        css.write("")
      }
    }

    // State styles
    for (const state of stateBlocks) {
      const stateStyles = this.statePropsToCSS(state.props)
      if (stateStyles.length > 0) {
        // State classes map to: hover → :hover, focus → :focus-visible, etc.
        const pseudoMap: Record<string, string> = {
          hover: `:hover`,
          focus: `:focus-visible`,
        }
        const pseudo = pseudoMap[state.name]

        if (pseudo) {
          css.write(`.${className}${pseudo} {`)
        } else {
          css.write(`.${className}[data-state="${state.name}"] {`)
        }
        css.indented(() => {
          for (const rule of stateStyles) {
            css.write(rule)
          }
        })
        css.write("}")
        css.write("")

        // Reduced motion override for any transitions
        const motionProp = state.props.find(p => p.kind === "MotionProp") as MotionProp | undefined
        if (motionProp) {
          css.write(`@media (prefers-reduced-motion: reduce) {`)
          css.indented(() => {
            css.write(`.${className}${pseudo ?? `[data-state="${state.name}"]`} {`)
            css.indented(() => {
              css.write("transition: none;")
              css.write("animation: none;")
            })
            css.write("}")
          })
          css.write("}")
          css.write("")
        }
      }
    }

    // Recurse into child visual nodes
    const childNodes = this.getChildNodes(node.children)
    for (const child of childNodes) {
      if (child.kind === "VisualNode") {
        this.emitVisualNodeCSS(css, child, emittedClasses)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Props → CSS rules
  // ---------------------------------------------------------------------------

  private propsToCSS(nodeType: string, props: Prop[]): string[] {
    const rules: string[] = []

    // Base styles per node type
    switch (nodeType) {
      case "surface":
        rules.push("box-sizing: border-box;")
        break
      case "stack":
        rules.push("display: flex;")
        rules.push("box-sizing: border-box;")
        break
      case "grid":
        rules.push("display: grid;")
        rules.push("box-sizing: border-box;")
        break
      case "text":
        break
    }

    for (const prop of props) {
      const rule = this.propToCSSRule(prop)
      if (rule) rules.push(rule)
    }

    return rules
  }

  private propToCSSRule(prop: Prop): string | null {
    const val = this.propValueToCSSValue(prop.value)
    if (!val) return null

    const propMap: Record<string, string> = {
      fill:       "background-color",
      radius:     "border-radius",
      padding:    "padding",
      gap:        "gap",
      depth:      "box-shadow",
      color:      "color",
      weight:     "font-weight",
      size:       "font-size",
      align:      "align-items",
      justify:    "justify-content",
      opacity:    "opacity",
      overflow:   "overflow",
      width:      "width",
      height:     "height",
      outline:    "outline",
    }

    // Special: depth → box-shadow levels
    if (prop.name === "depth") {
      const depthMap: Record<string, string> = {
        "0": "none",
        "1": "0 1px 3px rgba(0,0,0,0.1)",
        "2": "0 2px 8px rgba(0,0,0,0.12)",
        "3": "0 4px 16px rgba(0,0,0,0.14)",
        "4": "0 8px 24px rgba(0,0,0,0.16)",
      }
      const depth = prop.value.kind === "NumberLiteral" ? String(prop.value.value) : null
      if (depth && depthMap[depth]) return `box-shadow: ${depthMap[depth]};`
    }

    const cssProp = propMap[prop.name]
    if (!cssProp) return null

    return `${cssProp}: ${val};`
  }

  private propValueToCSSValue(value: PropValue): string | null {
    switch (value.kind) {
      case "TokenRef":
        return `var(--${value.path.join("-")})`
      case "StringLiteral":
        // weight aliases
        if (value.value === "semibold")  return "600"
        if (value.value === "bold")      return "700"
        if (value.value === "regular")   return "400"
        return value.value
      case "NumberLiteral":
        return String(value.value)
      default:
        return null
    }
  }

  private statePropsToCSS(props: StateProps[]): string[] {
    const rules: string[] = []
    for (const prop of props) {
      if (prop.kind === "MotionProp") {
        // motion: shift(duration.quick, ease.lift)
        // → transition: all var(--duration-quick) var(--ease-lift)
        const dur  = this.propValueToCSSValue(prop.duration) ?? "120ms"
        const ease = this.propValueToCSSValue(prop.ease) ?? "ease"
        rules.push(`transition: all ${dur} ${ease};`)
        continue
      }
      if (prop.kind === "GuardProp") continue

      // Regular prop
      const rule = this.propToCSSRule(prop as Prop)
      if (rule) rules.push(rule)
    }
    return rules
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  // Collect props from both inline params and body prop lines
  private collectAllProps(node: VisualNode): Prop[] {
    const props = [...node.props]
    for (const child of node.children) {
      // __prop marker from parser
      if ((child as any).__prop) {
        props.push((child as any).__prop as Prop)
      }
    }
    return props
  }

  private collectStateBlocks(children: NodeChild[]): StateBlock[] {
    return children.filter(c => (c as any).kind === "StateBlock") as unknown as StateBlock[]
  }

  private getChildNodes(children: NodeChild[]): NodeChild[] {
    return children.filter(c => {
      if ((c as any).__prop) return false
      if ((c as any).kind === "StateBlock") return false
      return true
    })
  }

  private collectDeclaredStates(body: ComponentBodyItem[]): Set<string> {
    const states = new Set<string>()
    for (const item of body) {
      if (item.kind === "VisualNode") {
        this.collectStatesFromNode(item, states)
      }
    }
    return states
  }

  private collectStatesFromNode(node: VisualNode, states: Set<string>): void {
    for (const child of node.children) {
      if ((child as any).kind === "StateBlock") {
        states.add((child as any).name)
      }
      if ((child as any).kind === "VisualNode") {
        this.collectStatesFromNode(child as VisualNode, states)
      }
    }
  }

  private capitalize(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  private toCSSClass(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, "-")
  }

  private framelabTypeToTS(base: string, isList: boolean): string {
    const map: Record<string, string> = {
      String:   "string",
      Int:      "number",
      Float:    "number",
      Boolean:  "boolean",
      ID:       "string",
      URL:      "string",
      Currency: "string | number",
    }
    const ts = map[base] ?? base
    return isList ? `${ts}[]` : ts
  }
}


// =============================================================================
// Public API
// =============================================================================

export function emit(program: Program): EmittedFile[] {
  return new ReactEmitter().emitProgram(program)
}
