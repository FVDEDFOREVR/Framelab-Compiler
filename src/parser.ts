import { Token, TokenKind, tokenize } from "./tokenizer"
import {
  AccessibleDescriptionNode,
  AccessibleHiddenNode,
  AccessibleLabelNode,
  AccessibleLiveNode,
  AccessibleNode,
  AccessibleRoleNode,
  AccessibleRoleTargetNode,
  AccessibleStatementNode,
  AnimPropEntryNode,
  AnimPropsNode,
  AnimValueNode,
  AspectValNode,
  BoolNode,
  CompStatementNode,
  ComponentDeclNode,
  ConstraintRuleNode,
  ConstraintTargetNode,
  ConstraintsNode,
  DeclarationNode,
  FallbackNode,
  HardcodedTargetNode,
  IntentLabelNode,
  IntentNode,
  IntentStatementNode,
  KeywordValNode,
  LiteralNode,
  MotionBlockNode,
  MotionDurationNode,
  MotionEaseNode,
  MotionFromNode,
  MotionPropertyNode,
  MotionStatementNode,
  MotionToNode,
  NumberNode,
  NumberValNode,
  ParamNode,
  ProgramNode,
  PropAssignmentNode,
  PropParamNode,
  PropValueNode,
  ReferenceNode,
  RenderNode,
  SlotNode,
  SlotRequiredNode,
  SlotStatementNode,
  SourcePos,
  StackNode,
  StackPropNode,
  StackStatementNode,
  StateNode,
  StateStatementNode,
  StringLitNode,
  StringValNode,
  SurfaceNode,
  SurfaceStatementNode,
  TextNode,
  TextStatementNode,
  ThemeDeclNode,
  TokenDefNode,
  TokenRefNode,
  TokenValueNode,
  TokensDeclNode,
  TransitionPropNode,
  TransitionValueNode,
  TransparentNode,
  VariantBlockNode,
  VariantCaseNode,
  VariantParamNode,
  AccessibleLabelTargetNode,
  HexColorNode,
} from "./ast"

const INTENT_KINDS = new Set(["trigger", "navigate", "submit", "toggle", "expand", "dismiss"])
const MOTION_VERBS = new Set(["enter", "exit", "pulse", "reveal"])
const ANIM_PROP_NAMES = new Set(["opacity", "x", "y", "scale"])
const STACK_DIRECTION_VALUES = new Set(["vertical", "horizontal"])
const SLOT_TYPE_VALUES = new Set(["text", "surface", "any"])
const CONSTRAINT_VERBS = new Set(["forbid", "require", "warn"])
const HARDCODED_VALUES = new Set(["color", "spacing", "depth", "any"])

export class ParseError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly pos: SourcePos,
    public readonly file: string,
  ) {
    super(`${file}:${pos.line}:${pos.col} ${code} ${message}`)
    this.name = "ParseError"
  }
}

export class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly file: string = "<unknown>",
  ) {}

  parseProgram(): ProgramNode {
    const start = this.currentPos()
    const declarations: DeclarationNode[] = []

    this.skipTrivia()
    while (!this.check(TokenKind.EOF)) {
      declarations.push(this.parseDeclaration())
      this.skipTrivia()
    }

    return { kind: "Program", declarations, pos: start }
  }

  private parseDeclaration(): DeclarationNode {
    this.skipTrivia()
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.KwTokens:
        return this.parseTokensDecl()
      case TokenKind.KwTheme:
        return this.parseThemeDecl()
      case TokenKind.KwComponent:
        return this.parseComponentDecl()
      default:
        this.fail("PE-05", "Expected component, tokens, or theme declaration", token)
    }
  }

  private parseTokensDecl(): TokensDeclNode {
    const start = this.expect(TokenKind.KwTokens)
    const name = this.expectIdentLike("Expected tokens block name").value
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after tokens declaration")
    const defs: TokenDefNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close tokens block", this.peek())
      }
      defs.push(this.parseTokenDef())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "TokensDecl", name, defs, pos: this.posOf(start) }
  }

  private parseTokenDef(): TokenDefNode {
    const start = this.peek()
    const path = this.expectNamePath("Expected token path").value
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in token definition")
    const value = this.parseTokenValue()
    return { kind: "TokenDef", path, value, pos: this.posOf(start) }
  }

  private parseTokenValue(): TokenValueNode {
    const token = this.peek()
    if (token.kind === TokenKind.HexColor) {
      this.advance()
      return { kind: "HexColor", value: token.value, pos: this.posOf(token) } as HexColorNode
    }
    if (token.kind === TokenKind.StringLit) {
      this.advance()
      return { kind: "StringVal", value: token.value, pos: this.posOf(token) } as StringValNode
    }
    if (token.kind === TokenKind.Number) {
      return this.parseNumberVal()
    }
    this.fail("PE-05", "Expected token value", token)
  }

  private parseThemeDecl(): ThemeDeclNode {
    const start = this.expect(TokenKind.KwTheme)
    const name = this.expectIdentLike("Expected theme name").value
    let extendsName: string | null = null
    if (this.match(TokenKind.KwExtends)) {
      extendsName = this.expectIdentLike("Expected theme name after extends").value
    }
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after theme declaration")
    const defs: TokenDefNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close theme block", this.peek())
      }
      defs.push(this.parseTokenDef())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "ThemeDecl", name, extends: extendsName, defs, pos: this.posOf(start) }
  }

  private parseComponentDecl(): ComponentDeclNode {
    const start = this.expect(TokenKind.KwComponent)
    const nameToken = this.peek()
    if (nameToken.kind !== TokenKind.ComponentName) {
      this.fail("PE-06", "Expected component name (PascalCase) after component", nameToken)
    }
    this.advance()
    const params = this.check(TokenKind.LParen) ? this.parseParams() : []
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after component declaration")
    const body = this.parseCompBody()
    this.expect(TokenKind.RBrace, "PE-02", "Expected '}' to close component block")
    return { kind: "ComponentDecl", name: nameToken.value, params, body, pos: this.posOf(start) }
  }

  private parseParams(): ParamNode[] {
    this.expect(TokenKind.LParen)
    const params: ParamNode[] = []
    this.skipParamTrivia()
    while (!this.check(TokenKind.RParen)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-08", "Unterminated parameter list", this.peek())
      }
      if (this.check(TokenKind.LBrace)) {
        this.fail("PE-08", "Unterminated parameter list", this.peek())
      }
      params.push(this.parseParam())
      this.skipParamTrivia()
    }
    this.expect(TokenKind.RParen)
    return params
  }

  private parseParam(): ParamNode {
    this.skipParamTrivia()
    const token = this.peek()
    if (token.kind === TokenKind.KwVariant) {
      return this.parseVariantParam()
    }
    if (token.kind === TokenKind.KwProp) {
      return this.parsePropParam()
    }
    this.fail("PE-05", "Unexpected token in parameter list", token)
  }

  private parseVariantParam(): VariantParamNode {
    const start = this.expect(TokenKind.KwVariant)
    const axis = this.expectIdentLike("Expected variant axis name").value
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in variant parameter")
    this.expect(TokenKind.LBracket)
    const values = [this.expectIdentLike("Expected variant value").value]
    while (this.match(TokenKind.Comma)) {
      values.push(this.expectIdentLike("Expected variant value after ','").value)
    }
    this.expect(TokenKind.RBracket)
    let defaultValue: string | null = null
    if (this.match(TokenKind.Equals)) {
      defaultValue = this.expectIdentLike("Expected default variant value").value
    }
    return { kind: "VariantParam", axis, values, default: defaultValue, pos: this.posOf(start) }
  }

  private parsePropParam(): PropParamNode {
    const start = this.expect(TokenKind.KwProp)
    const name = this.expectIdentLike("Expected prop name").value
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in prop parameter")
    const propType = this.parsePropType()
    let defaultValue: LiteralNode | null = null
    if (this.match(TokenKind.Equals)) {
      defaultValue = this.parseLiteral()
    }
    return { kind: "PropParam", name, propType, default: defaultValue, pos: this.posOf(start) }
  }

  private parsePropType(): "text" | "number" | "boolean" {
    const token = this.peek()
    if (token.kind === TokenKind.KwText) {
      this.advance()
      return "text"
    }
    if (token.kind === TokenKind.Ident && (token.value === "number" || token.value === "boolean")) {
      this.advance()
      return token.value
    }
    this.fail("PE-05", "Expected prop type", token)
  }

  private parseCompBody(): CompStatementNode[] {
    const body: CompStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close component block", this.peek())
      }
      body.push(this.parseCompStatement())
      this.skipTrivia()
    }
    return body
  }

  private parseCompStatement(): CompStatementNode {
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.KwSurface:
        return this.parseSurfaceNode()
      case TokenKind.KwStack:
        return this.parseStackNode()
      case TokenKind.KwSlot:
        return this.parseSlotNode()
      case TokenKind.KwIntent:
        return this.parseIntentNode()
      case TokenKind.KwAccessible:
        return this.parseAccessibleBlock()
      case TokenKind.KwConstraints:
        return this.parseConstraintsBlock()
      default:
        this.fail("PE-05", "Unexpected token in comp_body", token)
    }
  }

  private parseSurfaceNode(): SurfaceNode {
    const start = this.expect(TokenKind.KwSurface)
    const role = this.parseOptionalRole()
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after surface")
    const body: SurfaceStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close surface block", this.peek())
      }
      body.push(this.parseSurfaceStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Surface", role, body, pos: this.posOf(start) }
  }

  private parseSurfaceStatement(): SurfaceStatementNode {
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.Ident:
        return this.parsePropAssignment()
      case TokenKind.KwState:
        return this.parseStateBlock()
      case TokenKind.KwVariant:
        return this.parseVariantBlock()
      case TokenKind.KwMotion:
        return this.parseMotionBlock()
      case TokenKind.KwSurface:
        return this.parseSurfaceNode()
      case TokenKind.KwStack:
        return this.parseStackNode()
      case TokenKind.KwSlot:
        return this.parseSlotNode()
      case TokenKind.KwText:
        return this.parseTextNode()
      default:
        this.fail("PE-05", "Unexpected token in surface_body", token)
    }
  }

  private parseStackNode(): StackNode {
    const start = this.expect(TokenKind.KwStack)
    const args = this.check(TokenKind.LParen) ? this.parseStackArgs() : []
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after stack")
    const body: StackStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close stack block", this.peek())
      }
      body.push(this.parseStackStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Stack", args, body, pos: this.posOf(start) }
  }

  private parseStackArgs(): StackPropNode[] {
    this.expect(TokenKind.LParen)
    const args = [this.parseStackProp()]
    while (this.match(TokenKind.Comma)) {
      args.push(this.parseStackProp())
    }
    this.expect(TokenKind.RParen)
    return args
  }

  private parseStackProp(): StackPropNode {
    const start = this.peek()
    const name = this.expectIdentLike("Expected stack prop name").value
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in stack argument")

    let value: StackPropNode["value"]
    if (name === "gap") {
      value = this.parseTokenRef()
    } else if (name === "wrap") {
      value = this.parseBool()
    } else if (name === "direction") {
      const keyword = this.parseKeywordValue()
      if (!STACK_DIRECTION_VALUES.has(keyword.value)) {
        this.fail("PE-05", "Expected vertical or horizontal", this.prev())
      }
      value = keyword
    } else if (name === "align" || name === "justify") {
      value = this.parseKeywordValue()
    } else {
      this.fail("PE-05", `Unknown stack prop '${name}'`, start)
    }

    return { kind: "StackProp", name: name as StackPropNode["name"], value, pos: this.posOf(start) }
  }

  private parseStackStatement(): StackStatementNode {
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.KwSurface:
        return this.parseSurfaceNode()
      case TokenKind.KwStack:
        return this.parseStackNode()
      case TokenKind.KwSlot:
        return this.parseSlotNode()
      case TokenKind.KwText:
        return this.parseTextNode()
      default:
        this.fail("PE-05", "Unexpected token in stack_body", token)
    }
  }

  private parseTextNode(): TextNode {
    const start = this.expect(TokenKind.KwText)
    const role = this.parseOptionalRole()
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after text")
    const body: TextStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close text block", this.peek())
      }
      body.push(this.parseTextStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Text", role, body, pos: this.posOf(start) }
  }

  private parseTextStatement(): TextStatementNode {
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.Ident:
        return this.parsePropAssignment()
      case TokenKind.KwState:
        return this.parseStateBlock()
      case TokenKind.KwVariant:
        return this.parseVariantBlock()
      case TokenKind.KwSlot:
        return this.parseSlotNode()
      default:
        this.fail("PE-05", "Unexpected token in text_body", token)
    }
  }

  private parseSlotNode(): SlotNode {
    const start = this.expect(TokenKind.KwSlot)
    const name = this.expectIdentLike("Expected slot name").value
    let typeHint: SlotNode["typeHint"] = null
    if (this.match(TokenKind.Colon)) {
      const token = this.peek()
      if (token.kind === TokenKind.KwText || token.kind === TokenKind.KwSurface || token.kind === TokenKind.Ident) {
        this.advance()
        if (!SLOT_TYPE_VALUES.has(token.value)) {
          this.fail("PE-05", "Expected slot type text, surface, or any", token)
        }
        typeHint = token.value as SlotNode["typeHint"]
      } else {
        this.fail("PE-05", "Expected slot type", token)
      }
    }
    const body = this.check(TokenKind.LBrace) ? this.parseSlotBody() : []
    return { kind: "Slot", name, typeHint, body, pos: this.posOf(start) }
  }

  private parseSlotBody(): SlotStatementNode[] {
    this.expect(TokenKind.LBrace)
    const statements: SlotStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close slot block", this.peek())
      }
      if (this.match(TokenKind.KwRequired)) {
        statements.push({ kind: "SlotRequired", pos: this.posOf(this.prev()) } as SlotRequiredNode)
      } else if (this.check(TokenKind.KwFallback)) {
        statements.push(this.parseFallbackBlock())
      } else {
        this.fail("PE-05", "Unexpected token in slot_body", this.peek())
      }
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return statements
  }

  private parseFallbackBlock(): FallbackNode {
    const start = this.expect(TokenKind.KwFallback)
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after fallback")
    const body: RenderNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close fallback block", this.peek())
      }
      body.push(this.parseRenderNode())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Fallback", body, pos: this.posOf(start) }
  }

  private parseRenderNode(): RenderNode {
    const token = this.peek()
    switch (token.kind) {
      case TokenKind.KwSurface:
        return this.parseSurfaceNode()
      case TokenKind.KwStack:
        return this.parseStackNode()
      case TokenKind.KwSlot:
        return this.parseSlotNode()
      case TokenKind.KwText:
        return this.parseTextNode()
      default:
        this.fail("PE-05", "Unexpected token in render body", token)
    }
  }

  private parseIntentNode(): IntentNode {
    const start = this.expect(TokenKind.KwIntent)
    const intentToken = this.expectIdentLike("Expected intent kind")
    if (!INTENT_KINDS.has(intentToken.value)) {
      this.fail("PE-05", "Expected valid intent kind", intentToken)
    }
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' after intent kind")
    const identifier = this.expect(TokenKind.StringLit).value
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after intent")
    const body: IntentStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close intent block", this.peek())
      }
      body.push(this.parseIntentStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return {
      kind: "Intent",
      intentKind: intentToken.value as IntentNode["intentKind"],
      identifier,
      body,
      pos: this.posOf(start),
    }
  }

  private parseIntentStatement(): IntentStatementNode {
    const token = this.peek()
    if (token.kind === TokenKind.Ident && token.value === "label") {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after label")
      const value = this.expect(TokenKind.StringLit).value
      return { kind: "IntentLabel", value, pos: this.posOf(start) } as IntentLabelNode
    }
    if (token.kind === TokenKind.KwState) {
      return this.parseStateBlock()
    }
    this.fail("PE-05", "Unexpected token in intent_body", token)
  }

  private parseStateBlock(): StateNode {
    const start = this.expect(TokenKind.KwState)
    const stateName = this.expectIdentLike("Expected state name").value
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after state")
    const body: StateStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close state block", this.peek())
      }
      body.push(this.parseStateStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "State", stateName, body, pos: this.posOf(start) }
  }

  private parseStateStatement(): StateStatementNode {
    const token = this.peek()
    if (token.kind === TokenKind.KwTransition) {
      return this.parseTransitionProp()
    }
    if (token.kind === TokenKind.Ident) {
      return this.parsePropAssignment()
    }
    this.fail("PE-05", "Unexpected token in state_body", token)
  }

  private parseTransitionProp(): TransitionPropNode {
    const start = this.expect(TokenKind.KwTransition)
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' after transition")
    const value = this.parseTransitionValue()
    return { kind: "TransitionProp", value, pos: this.posOf(start) }
  }

  private parseTransitionValue(): TransitionValueNode {
    const start = this.expectIdentValue("shift")
    this.expect(TokenKind.LParen)
    const duration = this.parseTokenRef()
    const ease = this.parseTokenRef()
    this.expect(TokenKind.RParen)
    return { kind: "TransitionValue", verb: "shift", duration, ease, pos: this.posOf(start) }
  }

  private parseMotionBlock(): MotionBlockNode {
    const start = this.expect(TokenKind.KwMotion)
    const verbToken = this.expectIdentLike("Expected motion verb")
    if (!MOTION_VERBS.has(verbToken.value)) {
      this.fail("PE-05", "Expected valid motion verb", verbToken)
    }
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after motion")
    const body: MotionStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close motion block", this.peek())
      }
      body.push(this.parseMotionStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Motion", verb: verbToken.value as MotionBlockNode["verb"], body, pos: this.posOf(start) }
  }

  private parseMotionStatement(): MotionStatementNode {
    const token = this.peek()
    if (token.kind === TokenKind.KwDuration) {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after duration")
      return { kind: "MotionDuration", value: this.parseTokenRef(), pos: this.posOf(start) } as MotionDurationNode
    }
    if (token.kind === TokenKind.KwEase) {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after ease")
      return { kind: "MotionEase", value: this.parseTokenRef(), pos: this.posOf(start) } as MotionEaseNode
    }
    if (token.kind === TokenKind.KwFrom) {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after from")
      return { kind: "MotionFrom", value: this.parseAnimValue(), pos: this.posOf(start) } as MotionFromNode
    }
    if (token.kind === TokenKind.KwTo) {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after to")
      return { kind: "MotionTo", value: this.parseAnimValue(), pos: this.posOf(start) } as MotionToNode
    }
    if (token.kind === TokenKind.KwProperty) {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after property")
      const value = this.expectIdentLike("Expected motion property")
      if (!ANIM_PROP_NAMES.has(value.value)) {
        this.fail("PE-05", "Expected anim property opacity, x, y, or scale", value)
      }
      return { kind: "MotionProperty", value: value.value as MotionPropertyNode["value"], pos: this.posOf(start) }
    }
    this.fail("PE-05", "Unexpected token in motion_body", token)
  }

  private parseAnimValue(): AnimValueNode {
    if (this.check(TokenKind.LParen)) {
      const start = this.expect(TokenKind.LParen)
      const props: AnimPropEntryNode[] = []
      this.skipTrivia()
      while (!this.check(TokenKind.RParen)) {
        if (this.check(TokenKind.EOF)) {
          this.fail("PE-02", "Expected ')' to close anim props", this.peek())
        }
        props.push(this.parseAnimPropEntry())
        this.skipTrivia()
      }
      this.expect(TokenKind.RParen)
      return { kind: "AnimProps", props, pos: this.posOf(start) } as AnimPropsNode
    }
    return this.parseNumberNode()
  }

  private parseAnimPropEntry(): AnimPropEntryNode {
    const start = this.expectIdentLike("Expected animation property")
    if (!ANIM_PROP_NAMES.has(start.value)) {
      this.fail("PE-05", "Expected anim property opacity, x, y, or scale", start)
    }
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in animation prop entry")
    const value = this.parseNumberNode()
    return { kind: "AnimPropEntry", name: start.value as AnimPropEntryNode["name"], value: value.value, pos: this.posOf(start) }
  }

  private parseVariantBlock(): VariantBlockNode {
    const start = this.expect(TokenKind.KwVariant)
    const axis = this.expectIdentLike("Expected variant axis").value
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after variant")
    const cases: VariantCaseNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close variant block", this.peek())
      }
      cases.push(this.parseVariantCase())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "VariantBlock", axis, cases, pos: this.posOf(start) }
  }

  private parseVariantCase(): VariantCaseNode {
    const start = this.expectIdentLike("Expected variant case value")
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after variant case")
    const props: PropAssignmentNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close variant case", this.peek())
      }
      props.push(this.parsePropAssignment())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "VariantCase", value: start.value, props, pos: this.posOf(start) }
  }

  private parseAccessibleBlock(): AccessibleNode {
    const start = this.expect(TokenKind.KwAccessible)
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after accessible")
    const body: AccessibleStatementNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close accessible block", this.peek())
      }
      body.push(this.parseAccessibleStatement())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Accessible", body, pos: this.posOf(start) }
  }

  private parseAccessibleStatement(): AccessibleStatementNode {
    const start = this.expectIdentLike("Expected accessible statement")
    this.expect(TokenKind.Colon, "PE-03", "Expected ':' in accessible statement")
    if (start.value === "role") {
      const value = this.expectIdentLike("Expected role value")
      return { kind: "AccessibleRole", value: value.value, pos: this.posOf(start) } as AccessibleRoleNode
    }
    if (start.value === "label") {
      return { kind: "AccessibleLabel", value: this.expect(TokenKind.StringLit).value, pos: this.posOf(start) } as AccessibleLabelNode
    }
    if (start.value === "description") {
      return { kind: "AccessibleDescription", value: this.expect(TokenKind.StringLit).value, pos: this.posOf(start) } as AccessibleDescriptionNode
    }
    if (start.value === "live") {
      const value = this.expectIdentLike("Expected live value")
      return { kind: "AccessibleLive", value: value.value, pos: this.posOf(start) } as AccessibleLiveNode
    }
    if (start.value === "hidden") {
      return { kind: "AccessibleHidden", value: this.parseBool().value, pos: this.posOf(start) } as AccessibleHiddenNode
    }
    this.fail("PE-05", "Unexpected token in accessible block", start)
  }

  private parseConstraintsBlock(): ConstraintsNode {
    const start = this.expect(TokenKind.KwConstraints)
    this.expect(TokenKind.LBrace, "PE-01", "Expected '{' after constraints")
    const rules: ConstraintRuleNode[] = []
    this.skipTrivia()
    while (!this.check(TokenKind.RBrace)) {
      if (this.check(TokenKind.EOF)) {
        this.fail("PE-02", "Expected '}' to close constraints block", this.peek())
      }
      rules.push(this.parseConstraintRule())
      this.skipTrivia()
    }
    this.expect(TokenKind.RBrace)
    return { kind: "Constraints", rules, pos: this.posOf(start) }
  }

  private parseConstraintRule(): ConstraintRuleNode {
    const start = this.expectIdentLike("Expected constraint verb")
    if (!CONSTRAINT_VERBS.has(start.value)) {
      this.fail("PE-05", "Expected constraint verb forbid, require, or warn", start)
    }
    const target = this.parseConstraintTarget()
    return { kind: "ConstraintRule", verb: start.value as ConstraintRuleNode["verb"], target, pos: this.posOf(start) }
  }

  private parseConstraintTarget(): ConstraintTargetNode {
    const token = this.peek()
    if (token.kind === TokenKind.Ident && token.value === "hardcoded") {
      const start = this.advance()
      this.expect(TokenKind.Colon, "PE-03", "Expected ':' after hardcoded")
      const what = this.expectIdentLike("Expected hardcoded target kind")
      if (!HARDCODED_VALUES.has(what.value)) {
        this.fail("PE-05", "Expected hardcoded target color, spacing, depth, or any", what)
      }
      return { kind: "HardcodedTarget", what: what.value as HardcodedTargetNode["what"], pos: this.posOf(start) }
    }
    if (token.kind === TokenKind.DottedIdent && token.value === "accessible.label") {
      this.advance()
      return { kind: "AccessibleLabelTarget", pos: this.posOf(token) } as AccessibleLabelTargetNode
    }
    if (token.kind === TokenKind.DottedIdent && token.value === "accessible.role") {
      this.advance()
      return { kind: "AccessibleRoleTarget", pos: this.posOf(token) } as AccessibleRoleTargetNode
    }
    this.fail("PE-05", "Expected constraint target", token)
  }

  private parsePropAssignment(): PropAssignmentNode {
    const start = this.expectIdentLike("Expected property name")
    if (!this.match(TokenKind.Colon)) {
      this.fail("PE-03", "Expected ':' in property assignment", this.peek())
    }
    const value = this.parsePropValue()
    return { kind: "PropAssignment", name: start.value, value, pos: this.posOf(start) }
  }

  private parsePropValue(): PropValueNode {
    const token = this.peek()
    if (token.kind === TokenKind.KwToken) {
      return this.parseTokenRef()
    }
    if (token.kind === TokenKind.StringLit) {
      this.advance()
      return { kind: "StringLit", value: token.value, pos: this.posOf(token) } as StringLitNode
    }
    if (token.kind === TokenKind.Number) {
      const number = this.parseNumberNode()
      if (!number.suffix && this.check(TokenKind.Slash)) {
        this.advance()
        const rhs = this.parseNumberNode()
        return { kind: "AspectVal", w: number.value, h: rhs.value, pos: number.pos } as AspectValNode
      }
      if (!number.suffix && this.check(TokenKind.Ident) && this.peek().value === "lines") {
        const lines = this.advance()
        return { kind: "KeywordVal", value: `${number.value} ${lines.value}`, pos: number.pos } as KeywordValNode
      }
      return number
    }
    if (token.kind === TokenKind.KwTrue || token.kind === TokenKind.KwFalse) {
      return this.parseBool()
    }
    if (token.kind === TokenKind.KwTransparent) {
      this.advance()
      return { kind: "Transparent", pos: this.posOf(token) } as TransparentNode
    }
    if (token.kind === TokenKind.At) {
      return this.parseReference()
    }
    if (token.kind === TokenKind.Ident) {
      return this.parseKeywordValue()
    }
    this.fail("PE-05", "Expected property value", token)
  }

  private parseTokenRef(): TokenRefNode {
    const start = this.expect(TokenKind.KwToken)
    if (!this.match(TokenKind.LParen)) {
      this.fail("PE-04", "Expected '(' after token", this.peek())
    }
    const path = this.expectNamePath("Expected dotted token path").value
    this.expect(TokenKind.RParen)
    return { kind: "TokenRef", path, pos: this.posOf(start) }
  }

  private parseReference(): ReferenceNode {
    const at = this.expect(TokenKind.At)
    const next = this.peek()
    if (next.kind === TokenKind.Ident) {
      this.advance()
      return { kind: "Reference", name: next.value, pos: this.posOf(at) }
    }
    if (next.kind === TokenKind.DottedIdent) {
      this.advance()
      const firstName = next.value.split(".")[0]
      this.fail("PE-10", `Dot-path reference "@${next.value}" is not valid in standalone position; use "@${firstName}"`, next)
    }
    this.fail("PE-09", "Expected ident after '@'", next)
  }

  private parseLiteral(): LiteralNode {
    const token = this.peek()
    if (token.kind === TokenKind.StringLit) {
      this.advance()
      return { kind: "StringLit", value: token.value, pos: this.posOf(token) } as StringLitNode
    }
    if (token.kind === TokenKind.Number) {
      return this.parseNumberNode()
    }
    if (token.kind === TokenKind.KwTrue || token.kind === TokenKind.KwFalse) {
      return this.parseBool()
    }
    this.fail("PE-05", "Expected literal value", token)
  }

  private parseNumberVal(): NumberValNode {
    const token = this.expect(TokenKind.Number)
    const suffix = this.parseOptionalDimensionSuffix()
    return { kind: "NumberVal", value: Number(token.value), suffix, pos: this.posOf(token) }
  }

  private parseNumberNode(): NumberNode {
    const token = this.expect(TokenKind.Number)
    const suffix = this.parseOptionalDimensionSuffix()
    return { kind: "Number", value: Number(token.value), suffix, pos: this.posOf(token) }
  }

  private parseOptionalDimensionSuffix(): NumberNode["suffix"] {
    const token = this.peek()
    if (token.kind === TokenKind.DimPx) {
      this.advance()
      return "px"
    }
    if (token.kind === TokenKind.DimRem) {
      this.advance()
      return "rem"
    }
    if (token.kind === TokenKind.DimEm) {
      this.advance()
      return "em"
    }
    if (token.kind === TokenKind.DimPercent) {
      this.advance()
      return "%"
    }
    return undefined
  }

  private parseBool(): BoolNode {
    const token = this.peek()
    if (token.kind === TokenKind.KwTrue) {
      this.advance()
      return { kind: "Bool", value: true, pos: this.posOf(token) }
    }
    if (token.kind === TokenKind.KwFalse) {
      this.advance()
      return { kind: "Bool", value: false, pos: this.posOf(token) }
    }
    this.fail("PE-05", "Expected boolean value", token)
  }

  private parseKeywordValue(): KeywordValNode {
    const token = this.expectIdentLike("Expected keyword value")
    return { kind: "KeywordVal", value: token.value, pos: this.posOf(token) }
  }

  private parseOptionalRole(): string | null {
    if (!this.match(TokenKind.KwAs)) {
      return null
    }
    return this.expectIdentLike("Expected role name after as").value
  }

  private expectNamePath(message: string): Token {
    const token = this.peek()
    if (token.kind === TokenKind.Ident || token.kind === TokenKind.DottedIdent) {
      this.advance()
      return token
    }
    this.fail("PE-05", message, token)
  }

  private expectIdentLike(message: string): Token {
    const token = this.peek()
    if (token.kind === TokenKind.Ident || token.kind === TokenKind.ComponentName) {
      this.advance()
      return token
    }
    this.fail("PE-05", message, token)
  }

  private expectIdentValue(value: string): Token {
    const token = this.peek()
    if (token.kind === TokenKind.Ident && token.value === value) {
      this.advance()
      return token
    }
    this.fail("PE-05", `Expected '${value}'`, token)
  }

  private expect(kind: TokenKind, code = "PE-05", message?: string): Token {
    const token = this.peek()
    if (token.kind !== kind) {
      this.fail(code, message ?? `Expected ${kind}`, token)
    }
    this.advance()
    return token
  }

  private match(kind: TokenKind): boolean {
    if (this.peek().kind === kind) {
      this.advance()
      return true
    }
    return false
  }

  private check(kind: TokenKind): boolean {
    return this.peek().kind === kind
  }

  private skipTrivia(): void {
    while (this.peek().kind === TokenKind.Newline || this.peek().kind === TokenKind.Comment) {
      this.advance()
    }
  }

  private skipParamTrivia(): void {
    while (true) {
      const token = this.peek()
      if (token.kind === TokenKind.Newline || token.kind === TokenKind.Comment) {
        this.advance()
        continue
      }
      break
    }
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]
  }

  private prev(): Token {
    return this.tokens[this.pos - 1] ?? this.tokens[0]
  }

  private advance(): Token {
    const token = this.peek()
    this.pos += 1
    return token
  }

  private currentPos(): SourcePos {
    const token = this.peek()
    return this.posOf(token)
  }

  private posOf(token: Token): SourcePos {
    return { line: token.line, col: token.col, offset: token.offset }
  }

  private fail(code: string, message: string, token: Token): never {
    throw new ParseError(code, message, this.posOf(token), this.file)
  }
}

export function parse(source: string, file = "<unknown>"): ProgramNode {
  const tokens = tokenize(source, file)
  return new Parser(tokens, file).parseProgram()
}
