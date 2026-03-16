// =============================================================================
// FRAMELAB Parser — v0.1 MVP
//
// Recursive descent parser. Covers: component, surface, stack, text nodes,
// props, token refs, bindings, string/number literals, state blocks.
//
// Every parse method either returns a node or throws a ParseError.
// No partial results. No error recovery in MVP.
// =============================================================================

import {
  Token, TokenKind, KEYWORDS, tokenize,
} from "./tokenizer"

import {
  Program, TopLevelDecl,
  ComponentDecl, ComponentParam, VariantParam, PropParam, TypeExpr,
  ComponentBodyItem, VisualNode, NodeType, NodeChild,
  Prop, PropValue, TokenRef, BindingExpr, TernaryExpr, VariantExpr, VariantEntry,
  StateBlock, StateProps, MotionProp, GuardProp,
  SlotDecl, IntentDecl, GestureHandler, ActionCall,
  WhenBlock, RepeatBlock, ConditionExpr, IsCondition, TruthyCondition,
  TextContent, RoleDecl, A11yDecl,
  TokensDecl, TokenEntry, TokenValue,
  ColorValue, DimensionValue, DurationValue, StringValue, NumberValue,
  ThemeDecl,
  Expr, BinaryExpr, UnaryExpr,
  Literal, StringLiteral, NumberLiteral, BooleanLiteral, NullLiteral,
  SourceLocation,
} from "./ast"

// =============================================================================
// Error
// =============================================================================

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly loc: SourceLocation,
  ) {
    super(`${loc.file}:${loc.startLine}:${loc.startColumn} — ${message}`)
    this.name = "ParseError"
  }
}

// =============================================================================
// Parser
// =============================================================================

export class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly file:   string = "<unknown>",
  ) {}

  // ---------------------------------------------------------------------------
  // Program
  // ---------------------------------------------------------------------------

  parseProgram(): Program {
    const start = this.peek()
    const body: TopLevelDecl[] = []

    while (!this.isEOF()) {
      body.push(this.parseTopLevel())
    }

    return {
      kind: "Program",
      body,
      loc:  this.loc(start, this.prev()),
    }
  }

  private parseTopLevel(): TopLevelDecl {
    const t = this.peek()

    if (this.isKeyword("component")) return this.parseComponent()
    if (this.isKeyword("tokens"))    return this.parseTokens()
    if (this.isKeyword("theme"))     return this.parseTheme()

    this.error(`Unexpected token '${t.value}': expected 'component', 'tokens', or 'theme'`)
  }

  // ---------------------------------------------------------------------------
  // Tokens declaration
  // ---------------------------------------------------------------------------

  private parseTokens(): TokensDecl {
    const start = this.consume("KEYWORD", "tokens")
    const name  = this.consume("IDENT").value
    this.consume("LBRACE")

    const entries: TokenEntry[] = []
    while (!this.check("RBRACE") && !this.isEOF()) {
      entries.push(this.parseTokenEntry())
    }

    const end = this.consume("RBRACE")
    return { kind: "TokensDecl", name, entries, loc: this.loc(start, end) }
  }

  private parseTokenEntry(): TokenEntry {
    const start = this.peek()

    // path: color.text.primary  OR  depth.2 (numeric segment)
    const path = [this.consumeTokenPathSegment()]
    while (this.check("DOT")) {
      this.advance()
      path.push(this.consumeTokenPathSegment())
    }

    this.consume("COLON")

    const value = this.parseTokenValue()
    return { kind: "TokenEntry", path, value, loc: this.loc(start, this.prev()) }
  }

  // Collect a multi-part CSS value like "0 2px 8px rgba(0,0,0,0.12)"
  private collectMultiPartValue(initial: string): string {
    let raw = initial
    while (true) {
      const next = this.peek()
      if (next.kind === "DIMENSION" || next.kind === "NUMBER") {
        raw += " " + this.advance().value
      } else if (next.kind === "IDENT" && next.value === "rgba") {
        this.advance()
        this.consume("LPAREN")
        let inner = "rgba("
        let depth = 1
        while (!this.isEOF() && depth > 0) {
          const t = this.advance()
          if (t.kind === "LPAREN") { depth++; inner += "(" }
          else if (t.kind === "RPAREN") { depth--; if (depth > 0) inner += ")" }
          else if (t.kind === "COMMA") { inner += "," }
          else { inner += t.value }
        }
        inner += ")"
        raw += " " + inner
      } else {
        break
      }
    }
    return raw
  }

  private consumeTokenPathSegment(): string {
    const t = this.peek()
    if (t.kind === "IDENT" || t.kind === "KEYWORD") { this.advance(); return t.value }
    if (t.kind === "NUMBER")  { this.advance(); return t.value }
    this.error(`Expected token path segment but got '${t.value}' (${t.kind})`)
  }

  private parseTokenValue(): TokenValue {
    const t = this.peek()

    if (t.kind === "HEX_COLOR") {
      this.advance()
      return { kind: "ColorValue", value: t.value } as ColorValue
    }

    if (t.kind === "DIMENSION") {
      this.advance()
      // Multi-value dimensions: "8px 16px", "0 2px 8px rgba(...)"
      let raw = t.value
      raw = this.collectMultiPartValue(raw)
      if (raw !== t.value) {
        return { kind: "StringValue", value: raw } as StringValue
      }
      const match = raw.match(/^(-?[\d.]+)(.+)$/)!
      return { kind: "DimensionValue", value: parseFloat(match[1]), unit: match[2] } as DimensionValue
    }

    if (t.kind === "DURATION") {
      this.advance()
      const match = t.value.match(/^(-?[\d.]+)(ms|s)$/)!
      return { kind: "DurationValue", value: parseFloat(match[1]), unit: match[2] as "ms" | "s" } as DurationValue
    }

    if (t.kind === "NUMBER") {
      this.advance()
      // Might be a multi-part value like "0 2px 8px rgba(0,0,0,0.12)"
      if (this.peek().kind === "DIMENSION" || this.peek().kind === "NUMBER" ||
          (this.peek().kind === "IDENT" && this.peek().value === "rgba")) {
        let raw = t.value
        raw = this.collectMultiPartValue(raw)
        return { kind: "StringValue", value: raw } as StringValue
      }
      return { kind: "NumberValue", value: parseFloat(t.value) } as NumberValue
    }

    if (t.kind === "STRING") {
      this.advance()
      return { kind: "StringValue", value: t.value } as StringValue
    }

    // Bare identifier value: "ease-out", "center", "none", etc.
    if (t.kind === "IDENT" || t.kind === "KEYWORD") {
      this.advance()
      // Could be followed by more ident/dimension parts (e.g. "cubic-bezier(..." — future)
      return { kind: "StringValue", value: t.value } as StringValue
    }

    this.error(`Expected token value (color, dimension, duration, number, or string), got '${t.value}' (${t.kind})`)
  }

  // ---------------------------------------------------------------------------
  // Theme declaration
  // ---------------------------------------------------------------------------

  private parseTheme(): ThemeDecl {
    const start   = this.consume("KEYWORD", "theme")
    const name    = this.consumeIdent().value
    let   ext: string | null = null

    if (this.checkKeyword("extends")) {
      this.advance()
      ext = this.consumeIdent().value
    }

    this.consume("LBRACE")
    const entries: TokenEntry[] = []
    while (!this.check("RBRACE") && !this.isEOF()) {
      entries.push(this.parseTokenEntry())
    }
    const end = this.consume("RBRACE")

    return { kind: "ThemeDecl", name, extends: ext, entries, loc: this.loc(start, end) }
  }

  // ---------------------------------------------------------------------------
  // Component declaration
  // ---------------------------------------------------------------------------

  private parseComponent(): ComponentDecl {
    const start = this.consume("KEYWORD", "component")
    const name  = this.consume("IDENT").value

    // Optional parameter list
    const params: ComponentParam[] = []
    if (this.check("LPAREN")) {
      this.advance()
      while (!this.check("RPAREN") && !this.isEOF()) {
        params.push(this.parseComponentParam())
        if (this.check("COMMA")) this.advance()
      }
      this.consume("RPAREN")
    }

    this.consume("LBRACE")
    const body: ComponentBodyItem[] = []
    while (!this.check("RBRACE") && !this.isEOF()) {
      body.push(this.parseComponentBodyItem())
    }
    const end = this.consume("RBRACE")

    return { kind: "ComponentDecl", name, params, body, loc: this.loc(start, end) }
  }

  private parseComponentParam(): ComponentParam {
    const start = this.peek()

    // variant size: [compact, default] = default
    if (this.checkKeyword("variant")) {
      this.advance()
      const name    = this.consumeIdent().value
      this.consume("COLON")
      this.consume("LBRACKET")

      const options: string[] = []
      while (!this.check("RBRACKET") && !this.isEOF()) {
        options.push(this.consumeIdent().value)
        if (this.check("COMMA")) this.advance()
      }
      this.consume("RBRACKET")

      let defaultValue = options[0]
      if (this.check("EQUALS")) {
        this.advance()  // consume "="
        defaultValue = this.consumeIdent().value
      }

      return {
        kind: "VariantParam",
        name, options, defaultValue,
        loc: this.loc(start, this.prev()),
      } as VariantParam
    }

    // Regular prop: name: Type [= default]
    const name     = this.consumeIdent().value
    this.consume("COLON")
    const typeExpr = this.parseTypeExpr()

    let defaultValue: Literal | null = null
    if (this.check("EQUALS")) {
      this.advance()  // consume "="
      defaultValue = this.parseLiteral()
    }

    return {
      kind: "PropParam",
      name, typeExpr, defaultValue,
      loc: this.loc(start, this.prev()),
    } as PropParam
  }

  private parseTypeExpr(): TypeExpr {
    const start   = this.peek()
    const base    = this.consumeIdent().value
    const isList  = this.check("LBRACKET") && this.tokens[this.pos + 1]?.kind === "RBRACKET"
    if (isList) { this.advance(); this.advance() }
    const nullable = this.check("QUESTION") ? (this.advance(), true) : false

    return { kind: "TypeExpr", base, isList, nullable, loc: this.loc(start, this.prev()) }
  }

  // ---------------------------------------------------------------------------
  // Component body items
  // ---------------------------------------------------------------------------

  private parseComponentBodyItem(): ComponentBodyItem {
    // role: button
    if (this.checkKeyword("role")) return this.parseRoleDecl()

    // accessible label/description/hidden/live
    if (this.checkKeyword("accessible") || this.checkKeyword("live")) return this.parseA11yDecl()

    // slot
    if (this.checkKeyword("slot")) return this.parseSlotDecl()

    // state
    if (this.checkKeyword("state")) return this.parseStateBlock()

    // Visual node or component reference
    return this.parseVisualNode()
  }

  private parseRoleDecl(): RoleDecl {
    const start = this.consume("KEYWORD", "role")
    this.consume("COLON")
    const role  = this.consumeIdent().value
    return { kind: "RoleDecl", role, loc: this.loc(start, this.prev()) }
  }

  private parseA11yDecl(): A11yDecl {
    const start = this.peek()
    let property: A11yDecl["property"]
    let value: Expr | string

    if (this.checkKeyword("live")) {
      this.advance()
      this.consume("COLON")
      property = "live"
      value    = this.consumeIdent().value
    } else {
      this.consume("KEYWORD", "accessible")
      const prop = this.consumeIdent().value
      this.consume("COLON")
      property = prop as A11yDecl["property"]
      value    = this.parseExpr()
    }

    return { kind: "A11yDecl", property, value, loc: this.loc(start, this.prev()) }
  }

  private parseSlotDecl(): SlotDecl {
    const start    = this.consume("KEYWORD", "slot")
    const name     = this.consumeIdent().value
    let   modifier: SlotDecl["modifier"] = null
    let   defaults: NodeChild[] | null = null

    if (this.checkKeyword("required")) { this.advance(); modifier = "required" }
    else if (this.peek().value === "empty" && this.tokens[this.pos + 1]?.value === "by") {
      this.advance(); this.advance(); this.consume("KEYWORD", "default")
      modifier = "empty"
    }

    if (this.checkKeyword("defaults")) {
      this.advance()
      this.consume("KEYWORD", "to")
      this.consume("LBRACE")
      defaults = this.parseNodeChildren()
      this.consume("RBRACE")
    }

    return { kind: "SlotDecl", name, modifier, defaults, loc: this.loc(start, this.prev()) }
  }

  // ---------------------------------------------------------------------------
  // Visual nodes
  // ---------------------------------------------------------------------------

  private parseVisualNode(): VisualNode {
    const start    = this.peek()
    const nodeType = this.parseNodeType()
    const alias    = this.parseAlias()
    const props    = this.parseInlineProps()
    const children = this.parseNodeBody()

    return {
      kind: "VisualNode",
      nodeType, alias, props, children,
      loc: this.loc(start, this.prev()),
    }
  }

  private parseNodeType(): NodeType {
    const t = this.peek()
    const BUILTIN_NODES = new Set(["surface","stack","grid","text","image","icon","input","spinner","slot"])
    if (t.kind === "KEYWORD" && BUILTIN_NODES.has(t.value)) {
      this.advance()
      return t.value as NodeType
    }
    if (t.kind === "IDENT") {
      this.advance()
      return t.value
    }
    this.error(`Expected node type (surface, stack, text, ...) but got '${t.value}'`)
  }

  // as alias-name
  private parseAlias(): string | null {
    if (!this.checkKeyword("as")) return null
    this.advance()
    return this.consumeIdent().value
  }

  // Inline props before the body: NodeType(prop: value, prop2: value2)
  // OR block form: NodeType { prop: value }
  // MVP: props appear inside the body block { } as "prop: value" lines
  private parseInlineProps(): Prop[] {
    const props: Prop[] = []
    if (!this.check("LPAREN")) return props

    this.consume("LPAREN")
    while (!this.check("RPAREN") && !this.isEOF()) {
      props.push(this.parseProp())
      if (this.check("COMMA")) this.advance()
    }
    this.consume("RPAREN")
    return props
  }

  // Parse the { } body of a node — contains props and child nodes
  private parseNodeBody(): NodeChild[] {
    if (!this.check("LBRACE")) return []

    this.consume("LBRACE")

    // Collect props that appear at the top of the block
    // before any child nodes
    const children: NodeChild[] = []

    while (!this.check("RBRACE") && !this.isEOF()) {
      // intent block
      if (this.checkKeyword("intent")) {
        children.push(this.parseIntentDecl())
        continue
      }

      // state block
      if (this.checkKeyword("state")) {
        // State blocks inside a node body are visual children for now
        // (full emitter handles them as class modifiers)
        const state = this.parseStateBlock()
        // Wrap as a pseudo-child so the emitter can process it
        children.push(state as unknown as NodeChild)
        continue
      }

      // when block
      if (this.checkKeyword("when")) {
        children.push(this.parseWhenBlock())
        continue
      }

      // repeat / each block
      if (this.checkKeyword("repeat") || this.checkKeyword("each")) {
        children.push(this.parseRepeatBlock())
        continue
      }

      // Check if this looks like a prop (ident/keyword : value)
      // vs a child node (ident/keyword without colon or with {)
      if (this.isPropLine()) {
        // Emit as a pseudo-TextContent so it lands in children
        // The emitter reads props off the VisualNode's children list
        // We actually want to attach these to the node's props — but
        // since we already returned props from parseInlineProps,
        // we parse them here and store them in a wrapper.
        const prop = this.parseProp()
        children.push({
          kind:  "TextContent",
          value: { kind: "StringLiteral", value: `__prop__${prop.name}`, loc: prop.loc } as StringLiteral,
          loc:   prop.loc,
          // Attach the actual prop for the emitter to read
          __prop: prop,
        } as unknown as NodeChild)
        continue
      }

      // Child node
      children.push(this.parseNodeChild())
    }

    this.consume("RBRACE")
    return children
  }

  // Is the current position a "prop: value" line rather than a child node?
  private isPropLine(): boolean {
    // Look ahead: IDENT/KEYWORD followed by COLON
    // But NOT: "state name {", "when condition {", etc.
    const t0 = this.tokens[this.pos]
    const t1 = this.tokens[this.pos + 1]

    if (!t0 || !t1) return false

    // Multi-word props: "accessible label:", "trap focus:"
    if ((t0.kind === "KEYWORD" || t0.kind === "IDENT") &&
        (t1.kind === "IDENT" || t1.kind === "KEYWORD") &&
        this.tokens[this.pos + 2]?.kind === "COLON") {
      return true
    }

    return (t0.kind === "IDENT" || t0.kind === "KEYWORD") &&
           t1.kind === "COLON" &&
           // These keywords open blocks, not props
           !["state","when","repeat","each","intent","slot"].includes(t0.value)
  }

  private parseNodeChild(): NodeChild {
    return this.parseVisualNode()
  }

  private parseNodeChildren(): NodeChild[] {
    const children: NodeChild[] = []
    while (!this.check("RBRACE") && !this.isEOF()) {
      if (this.checkKeyword("intent")) { children.push(this.parseIntentDecl()); continue }
      if (this.checkKeyword("when"))   { children.push(this.parseWhenBlock()); continue }
      if (this.checkKeyword("repeat") || this.checkKeyword("each")) {
        children.push(this.parseRepeatBlock()); continue
      }
      if (this.isPropLine()) {
        const prop = this.parseProp()
        children.push({
          kind: "TextContent",
          value: { kind: "StringLiteral", value: `__prop__${prop.name}`, loc: prop.loc } as StringLiteral,
          loc: prop.loc,
          __prop: prop,
        } as unknown as NodeChild)
        continue
      }
      children.push(this.parseVisualNode())
    }
    return children
  }

  // ---------------------------------------------------------------------------
  // Props
  // ---------------------------------------------------------------------------

  private parseProp(): Prop {
    const start = this.peek()

    // Handle "accessible label:", "trap focus:", etc. (two-word prop names)
    let name = this.consumeIdent().value
    if ((name === "accessible" || name === "trap") &&
        (this.check("IDENT") || this.check("KEYWORD")) &&
        this.tokens[this.pos + 1]?.kind === "COLON") {
      name = name + " " + this.consumeIdent().value
    }

    this.consume("COLON")
    const value = this.parsePropValue()

    return { kind: "Prop", name, value, loc: this.loc(start, this.prev()) }
  }

  private parsePropValue(): PropValue {
    const t = this.peek()

    // token(color.text.primary)
    if (t.kind === "KEYWORD" && t.value === "token") {
      return this.parseTokenRef()
    }

    // @binding.path
    if (t.kind === "AT") {
      const binding = this.parseBindingExpr()
      // Ternary: @binding ? a : b
      if (this.check("QUESTION")) {
        return this.parseTernaryExpr(binding)
      }
      return binding
    }

    // variant(param, a: tokenA, b: tokenB)
    if (t.kind === "KEYWORD" && t.value === "variant") {
      return this.parseVariantExpr()
    }

    // String literal
    if (t.kind === "STRING") {
      this.advance()
      const lit: StringLiteral = { kind: "StringLiteral", value: t.value, loc: this.tokenLoc(t) }
      return lit
    }

    // Number, dimension, duration
    if (t.kind === "NUMBER" || t.kind === "DIMENSION" || t.kind === "DURATION") {
      this.advance()
      return { kind: "NumberLiteral", value: parseFloat(t.value), loc: this.tokenLoc(t) } as NumberLiteral
    }

    // Boolean
    if (t.kind === "KEYWORD" && (t.value === "true" || t.value === "false")) {
      this.advance()
      return { kind: "BooleanLiteral", value: t.value === "true", loc: this.tokenLoc(t) } as BooleanLiteral
    }

    // Bare identifier (e.g. direction: vertical, align: center)
    if (t.kind === "IDENT" || t.kind === "KEYWORD") {
      this.advance()
      return { kind: "StringLiteral", value: t.value, loc: this.tokenLoc(t) } as StringLiteral
    }

    // Hex color
    if (t.kind === "HEX_COLOR") {
      this.advance()
      return { kind: "StringLiteral", value: t.value, loc: this.tokenLoc(t) } as StringLiteral
    }

    this.error(`Expected prop value but got '${t.value}'`)
  }

  private parseTokenRef(): TokenRef {
    const start = this.consume("KEYWORD", "token")
    this.consume("LPAREN")
    const path = [this.consumeIdent().value]
    while (this.check("DOT")) {
      this.advance()
      path.push(this.consumeIdent().value)
    }
    const end = this.consume("RPAREN")
    return { kind: "TokenRef", path, loc: this.loc(start, end) }
  }

  private parseBindingExpr(): BindingExpr {
    const start = this.consume("AT")
    const path  = [this.consumeIdent().value]
    while (this.check("DOT")) {
      this.advance()
      path.push(this.consumeIdent().value)
    }
    return { kind: "BindingExpr", path, loc: this.loc(start, this.prev()) }
  }

  private parseTernaryExpr(condition: BindingExpr): TernaryExpr {
    const start = condition
    this.consume("QUESTION")
    const consequent = this.parsePropValue()
    this.consume("COLON")
    const alternate  = this.parsePropValue()
    return { kind: "TernaryExpr", condition, consequent, alternate, loc: this.loc(condition.loc as unknown as Token, this.prev()) }
  }

  private parseVariantExpr(): VariantExpr {
    const start = this.consume("KEYWORD", "variant")
    this.consume("LPAREN")
    const param   = this.consumeIdent().value
    this.consume("COMMA")
    const entries: VariantEntry[] = []
    while (!this.check("RPAREN") && !this.isEOF()) {
      const variant = this.consumeIdent().value
      this.consume("COLON")
      const value   = this.parsePropValue()
      entries.push({ variant, value })
      if (this.check("COMMA")) this.advance()
    }
    const end = this.consume("RPAREN")
    return { kind: "VariantExpr", param, entries, loc: this.loc(start, end) }
  }

  // ---------------------------------------------------------------------------
  // State blocks
  // ---------------------------------------------------------------------------

  private parseStateBlock(): StateBlock {
    const start = this.consume("KEYWORD", "state")
    const name  = this.consumeIdent().value
    this.consume("LBRACE")

    const props: StateProps[] = []
    while (!this.check("RBRACE") && !this.isEOF()) {
      if (this.checkKeyword("motion")) {
        props.push(this.parseMotionProp())
      } else if (this.checkKeyword("guard")) {
        props.push(this.parseGuardProp())
      } else {
        props.push(this.parseProp() as StateProps)
      }
    }

    const end = this.consume("RBRACE")
    return { kind: "StateBlock", name, props, loc: this.loc(start, end) }
  }

  private parseMotionProp(): MotionProp {
    const start = this.consumeIdent()  // "motion" — may be IDENT or KEYWORD
    this.consume("COLON")
    const verb     = this.consumeIdent().value
    this.consume("LPAREN")
    const duration = this.parsePropValue()
    this.consume("COMMA")
    const ease     = this.parsePropValue()
    let   stagger: DurationValue | null = null
    if (this.check("COMMA")) {
      this.advance()
      this.consume("KEYWORD", "stagger")
      this.consume("COLON")
      const t = this.peek()
      if (t.kind === "DURATION") {
        this.advance()
        const m = t.value.match(/^(-?[\d.]+)(ms|s)$/)!
        stagger = { kind: "DurationValue", value: parseFloat(m[1]), unit: m[2] as "ms" | "s" }
      }
    }
    const end = this.consume("RPAREN")
    return { kind: "MotionProp", verb, duration, ease, stagger, loc: this.loc(start, end) }
  }

  private parseGuardProp(): GuardProp {
    const start     = this.consume("KEYWORD", "guard")
    this.consume("COLON")
    const condition = this.parseConditionExpr()
    return { kind: "GuardProp", condition, loc: this.loc(start, this.prev()) }
  }

  // ---------------------------------------------------------------------------
  // Control flow
  // ---------------------------------------------------------------------------

  private parseWhenBlock(): WhenBlock {
    const start     = this.consume("KEYWORD", "when")
    const condition = this.parseConditionExpr()
    this.consume("LBRACE")
    const consequent = this.parseNodeChildren()
    this.consume("RBRACE")

    let alternate: NodeChild[] | null = null
    if (this.checkKeyword("else")) {
      this.advance()
      this.consume("LBRACE")
      alternate = this.parseNodeChildren()
      this.consume("RBRACE")
    }

    return { kind: "WhenBlock", condition, consequent, alternate, loc: this.loc(start, this.prev()) }
  }

  private parseConditionExpr(): ConditionExpr {
    const start  = this.peek()
    let negate   = false

    if (this.checkKeyword("not")) {
      this.advance()
      negate = true
    }

    const binding = this.parseBindingExpr()

    if (this.checkKeyword("is")) {
      this.advance()
      let isNot = false
      if (this.checkKeyword("not")) { this.advance(); isNot = true }
      const value = this.consumeIdent().value
      return {
        kind: "IsCondition",
        binding, value,
        negate: negate || isNot,
        loc: this.loc(start, this.prev()),
      } as IsCondition
    }

    return { kind: "TruthyCondition", binding, negate, loc: this.loc(start, this.prev()) } as TruthyCondition
  }

  private parseRepeatBlock(): RepeatBlock {
    const start = this.peek()
    if (this.checkKeyword("each")) this.advance()
    else this.consume("KEYWORD", "repeat")

    // Source: binding or number
    let source: BindingExpr | NumberLiteral
    if (this.check("AT")) {
      source = this.parseBindingExpr()
    } else if (this.check("NUMBER")) {
      const t = this.advance()
      source  = { kind: "NumberLiteral", value: parseFloat(t.value), loc: this.tokenLoc(t) } as NumberLiteral
    } else {
      this.error("Expected binding (@...) or number after repeat/each")
    }

    let itemName: string | null = null
    let idxName:  string | null = null
    if (this.checkKeyword("as")) {
      this.advance()
      itemName = this.consumeIdent().value
      if (this.check("COMMA")) {
        this.advance()
        idxName = this.consumeIdent().value
      }
    }

    // Skip "times" / "skeletons"
    if (this.checkKeyword("times") || this.checkKeyword("skeletons")) this.advance()

    let keyExpr: BindingExpr | null = null
    if (this.checkKeyword("keyed")) {
      this.advance()
      keyExpr = this.parseBindingExpr()
    }

    this.consume("LBRACE")
    const children = this.parseNodeChildren()

    let empty: NodeChild[] | null = null
    if (this.checkKeyword("empty")) {
      this.advance()
      this.consume("LBRACE")
      empty = this.parseNodeChildren()
      this.consume("RBRACE")
    }

    const end = this.consume("RBRACE")
    return { kind: "RepeatBlock", source, itemName, idxName, keyExpr, children, empty, loc: this.loc(start, end) }
  }

  // ---------------------------------------------------------------------------
  // Intent
  // ---------------------------------------------------------------------------

  private parseIntentDecl(): IntentDecl {
    const start      = this.consume("KEYWORD", "intent")
    const intentType = this.consumeIdent().value as IntentDecl["intentType"]
    this.consume("COLON")
    const labelTok   = this.consume("STRING")
    const label: StringLiteral = { kind: "StringLiteral", value: labelTok.value, loc: this.tokenLoc(labelTok) }

    this.consume("LBRACE")

    let   accessibleLabel: Expr | null = null
    let   tone:  TokenRef | null       = null
    let   disabled: Expr | null        = null
    const handlers: GestureHandler[]   = []
    const states:   StateBlock[]       = []

    while (!this.check("RBRACE") && !this.isEOF()) {
      if (this.checkKeyword("accessible")) {
        this.advance()
        this.consumeIdent() // "label"
        this.consume("COLON")
        accessibleLabel = this.parseExpr()
        continue
      }
      if (this.checkKeyword("tone")) {
        this.advance(); this.consume("COLON")
        tone = this.parseTokenRef()
        continue
      }
      if (this.checkKeyword("disabled")) {
        this.advance(); this.consume("COLON")
        disabled = this.parseExpr()
        continue
      }
      if (this.checkKeyword("on")) {
        handlers.push(this.parseGestureHandler())
        continue
      }
      if (this.checkKeyword("state")) {
        states.push(this.parseStateBlock())
        continue
      }
      // Skip unknown props inside intent
      this.parseProp()
    }

    const end = this.consume("RBRACE")
    return {
      kind: "IntentDecl",
      intentType, label, accessibleLabel, tone, disabled,
      handlers, states,
      loc: this.loc(start, end),
    }
  }

  private parseGestureHandler(): GestureHandler {
    const start   = this.consume("KEYWORD", "on")
    const gesture = this.consumeIdent().value
    this.consume("COLON")
    const name    = this.consumeIdent().value
    const args:   Expr[] = []
    if (this.check("LPAREN")) {
      this.advance()
      while (!this.check("RPAREN") && !this.isEOF()) {
        args.push(this.parseExpr())
        if (this.check("COMMA")) this.advance()
      }
      this.consume("RPAREN")
    }
    const action: ActionCall = { kind: "ActionCall", name, args, loc: this.loc(start, this.prev()) }
    return { kind: "GestureHandler", gesture, action, loc: this.loc(start, this.prev()) }
  }

  // ---------------------------------------------------------------------------
  // Expressions
  // ---------------------------------------------------------------------------

  private parseExpr(): Expr {
    const t = this.peek()

    if (t.kind === "AT") return this.parseBindingExpr()

    if (t.kind === "STRING") {
      this.advance()
      return { kind: "StringLiteral", value: t.value, loc: this.tokenLoc(t) } as StringLiteral
    }

    if (t.kind === "NUMBER") {
      this.advance()
      return { kind: "NumberLiteral", value: parseFloat(t.value), loc: this.tokenLoc(t) } as NumberLiteral
    }

    if (t.kind === "KEYWORD" && (t.value === "true" || t.value === "false")) {
      this.advance()
      return { kind: "BooleanLiteral", value: t.value === "true", loc: this.tokenLoc(t) } as BooleanLiteral
    }

    if (t.kind === "KEYWORD" && t.value === "null") {
      this.advance()
      return { kind: "NullLiteral", loc: this.tokenLoc(t) } as NullLiteral
    }

    if (t.kind === "KEYWORD" && t.value === "not") {
      this.advance()
      const operand = this.parseExpr()
      return { kind: "UnaryExpr", operator: "not", operand, loc: this.loc(t, this.prev()) } as UnaryExpr
    }

    this.error(`Expected expression but got '${t.value}'`)
  }

  private parseLiteral(): Literal {
    const t = this.peek()
    if (t.kind === "STRING")  { this.advance(); return { kind: "StringLiteral",  value: t.value,                loc: this.tokenLoc(t) } as StringLiteral  }
    if (t.kind === "NUMBER")  { this.advance(); return { kind: "NumberLiteral",  value: parseFloat(t.value),   loc: this.tokenLoc(t) } as NumberLiteral  }
    if (t.kind === "KEYWORD" && t.value === "true")  { this.advance(); return { kind: "BooleanLiteral", value: true,  loc: this.tokenLoc(t) } as BooleanLiteral }
    if (t.kind === "KEYWORD" && t.value === "false") { this.advance(); return { kind: "BooleanLiteral", value: false, loc: this.tokenLoc(t) } as BooleanLiteral }
    if (t.kind === "KEYWORD" && t.value === "null")  { this.advance(); return { kind: "NullLiteral",            loc: this.tokenLoc(t) } as NullLiteral  }
    this.error(`Expected literal but got '${t.value}'`)
  }

  // ---------------------------------------------------------------------------
  // Token / position helpers
  // ---------------------------------------------------------------------------

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]
  }

  private prev(): Token {
    return this.tokens[Math.max(0, this.pos - 1)]
  }

  private advance(): Token {
    const t = this.tokens[this.pos]
    if (t.kind !== "EOF") this.pos++
    return t
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind
  }

  private checkKeyword(value: string): boolean {
    const t = this.peek()
    return (t.kind === "KEYWORD" || t.kind === "IDENT") && t.value === value
  }

  private isEOF(): boolean {
    return this.peek().kind === "EOF"
  }

  private consume(kind: TokenKind, value?: string): Token {
    const t = this.peek()
    if (t.kind !== kind) {
      this.error(`Expected '${value ?? kind}' but got '${t.value}' (${t.kind})`)
    }
    if (value !== undefined && t.value !== value) {
      this.error(`Expected '${value}' but got '${t.value}'`)
    }
    return this.advance()
  }

  private consumeIdent(): Token {
    const t = this.peek()
    if (t.kind !== "IDENT" && t.kind !== "KEYWORD") {
      this.error(`Expected identifier but got '${t.value}' (${t.kind})`)
    }
    return this.advance()
  }

  private isKeyword(value: string): boolean {
    return this.checkKeyword(value)
  }

  private loc(start: Token | { loc: SourceLocation }, end: Token): SourceLocation {
    const sl = "loc" in start ? start.loc : this.tokenLoc(start as Token)
    return {
      file:        this.file,
      startLine:   sl.startLine,
      startColumn: sl.startColumn,
      endLine:     end.line,
      endColumn:   end.column + end.value.length,
    }
  }

  private tokenLoc(t: Token): SourceLocation {
    return {
      file:        this.file,
      startLine:   t.line,
      startColumn: t.column,
      endLine:     t.line,
      endColumn:   t.column + t.value.length,
    }
  }

  private error(message: string): never {
    const t = this.peek()
    throw new ParseError(message, this.tokenLoc(t))
  }
}

// =============================================================================
// Public API
// =============================================================================

export function parse(source: string, file = "<unknown>"): Program {
  const tokens = tokenize(source, file)
  const parser = new Parser(tokens, file)
  return parser.parseProgram()
}
