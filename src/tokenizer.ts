export enum TokenKind {
  Ident = "Ident",
  ComponentName = "ComponentName",
  StringLit = "StringLit",
  Number = "Number",
  HexColor = "HexColor",
  DottedIdent = "DottedIdent",
  LBrace = "LBrace",
  RBrace = "RBrace",
  LParen = "LParen",
  RParen = "RParen",
  LBracket = "LBracket",
  RBracket = "RBracket",
  Colon = "Colon",
  Comma = "Comma",
  Equals = "Equals",
  Slash = "Slash",
  At = "At",
  Newline = "Newline",
  KwComponent = "KwComponent",
  KwSurface = "KwSurface",
  KwStack = "KwStack",
  KwSlot = "KwSlot",
  KwText = "KwText",
  KwIntent = "KwIntent",
  KwState = "KwState",
  KwMotion = "KwMotion",
  KwVariant = "KwVariant",
  KwTokens = "KwTokens",
  KwTheme = "KwTheme",
  KwAccessible = "KwAccessible",
  KwConstraints = "KwConstraints",
  KwProp = "KwProp",
  KwAs = "KwAs",
  KwExtends = "KwExtends",
  KwRequired = "KwRequired",
  KwFallback = "KwFallback",
  KwFrom = "KwFrom",
  KwTo = "KwTo",
  KwDuration = "KwDuration",
  KwEase = "KwEase",
  KwTransition = "KwTransition",
  KwProperty = "KwProperty",
  KwTrue = "KwTrue",
  KwFalse = "KwFalse",
  KwToken = "KwToken",
  KwTransparent = "KwTransparent",
  DimPx = "DimPx",
  DimRem = "DimRem",
  DimEm = "DimEm",
  DimPercent = "DimPercent",
  Comment = "Comment",
  EOF = "EOF",
}

export interface Token {
  kind: TokenKind
  value: string
  line: number
  col: number
  offset: number
}

const KEYWORD_KINDS: Record<string, TokenKind> = {
  component: TokenKind.KwComponent,
  surface: TokenKind.KwSurface,
  stack: TokenKind.KwStack,
  slot: TokenKind.KwSlot,
  text: TokenKind.KwText,
  intent: TokenKind.KwIntent,
  state: TokenKind.KwState,
  motion: TokenKind.KwMotion,
  variant: TokenKind.KwVariant,
  tokens: TokenKind.KwTokens,
  theme: TokenKind.KwTheme,
  accessible: TokenKind.KwAccessible,
  constraints: TokenKind.KwConstraints,
  prop: TokenKind.KwProp,
  as: TokenKind.KwAs,
  extends: TokenKind.KwExtends,
  required: TokenKind.KwRequired,
  fallback: TokenKind.KwFallback,
  from: TokenKind.KwFrom,
  to: TokenKind.KwTo,
  duration: TokenKind.KwDuration,
  ease: TokenKind.KwEase,
  transition: TokenKind.KwTransition,
  property: TokenKind.KwProperty,
  true: TokenKind.KwTrue,
  false: TokenKind.KwFalse,
  token: TokenKind.KwToken,
  transparent: TokenKind.KwTransparent,
}

type DimensionSuffix = "px" | "rem" | "em" | "%"

const DIMENSION_KINDS: Record<DimensionSuffix, TokenKind> = {
  px: TokenKind.DimPx,
  rem: TokenKind.DimRem,
  em: TokenKind.DimEm,
  "%": TokenKind.DimPercent,
}

export class TokenizerError extends Error {
  constructor(
    public readonly code: "TK-01" | "TK-02" | "TK-03" | "TK-04",
    message: string,
    public readonly line: number,
    public readonly col: number,
    public readonly offset: number,
    public readonly file: string,
  ) {
    super(`${file}:${line}:${col} ${code} ${message}`)
    this.name = "TokenizerError"
  }
}

export class Tokenizer {
  private pos = 0
  private line = 1
  private col = 1
  private readonly tokens: Token[] = []

  constructor(
    private readonly source: string,
    private readonly file: string = "<unknown>",
  ) {}

  tokenize(): Token[] {
    while (!this.isEOF()) {
      const ch = this.peekChar()

      if (ch === " " || ch === "\t") {
        this.advance()
        continue
      }

      if (ch === "\n") {
        this.emit(TokenKind.Newline, "\n", this.line, this.col, this.pos)
        this.advanceNewline("\n")
        continue
      }

      if (ch === "\r" && this.peekChar(1) === "\n") {
        this.emit(TokenKind.Newline, "\r\n", this.line, this.col, this.pos)
        this.advanceNewline("\r\n")
        continue
      }

      if (ch === "/" && this.peekChar(1) === "/") {
        this.readComment()
        continue
      }

      this.readToken()
    }

    this.emit(TokenKind.EOF, "", this.line, this.col, this.pos)
    return this.tokens
  }

  private readToken(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    const ch = this.peekChar()

    switch (ch) {
      case "{":
        this.emit(TokenKind.LBrace, ch, line, col, offset)
        this.advance()
        return
      case "}":
        this.emit(TokenKind.RBrace, ch, line, col, offset)
        this.advance()
        return
      case "(":
        this.emit(TokenKind.LParen, ch, line, col, offset)
        this.advance()
        return
      case ")":
        this.emit(TokenKind.RParen, ch, line, col, offset)
        this.advance()
        return
      case "[":
        this.emit(TokenKind.LBracket, ch, line, col, offset)
        this.advance()
        return
      case "]":
        this.emit(TokenKind.RBracket, ch, line, col, offset)
        this.advance()
        return
      case ":":
        this.emit(TokenKind.Colon, ch, line, col, offset)
        this.advance()
        return
      case ",":
        this.emit(TokenKind.Comma, ch, line, col, offset)
        this.advance()
        return
      case "=":
        this.emit(TokenKind.Equals, ch, line, col, offset)
        this.advance()
        return
      case "/":
        this.emit(TokenKind.Slash, ch, line, col, offset)
        this.advance()
        return
      case "@":
        this.readAt()
        return
      case "\"":
        this.readString()
        return
      case "#":
        this.readHexColor()
        return
      default:
        break
    }

    if (this.isDigit(ch)) {
      this.readNumber()
      return
    }

    if (this.isIdentStart(ch)) {
      this.readNameLike()
      return
    }

    this.error("TK-03", `Unrecognized character '${ch}'`, line, col, offset)
  }

  private readComment(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    let value = ""

    value += this.peekChar()
    this.advance()
    value += this.peekChar()
    this.advance()

    while (!this.isEOF()) {
      const ch = this.peekChar()
      if (ch === "\n" || (ch === "\r" && this.peekChar(1) === "\n")) {
        break
      }
      value += ch
      this.advance()
    }

    this.emit(TokenKind.Comment, value, line, col, offset)
  }

  private readAt(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    this.emit(TokenKind.At, "@", line, col, offset)
    this.advance()

    const next = this.peekChar()
    if (next === "" || next === " " || next === "\t" || next === "\n" || (next === "\r" && this.peekChar(1) === "\n")) {
      this.error("TK-04", 'Expected identifier after "@"', this.line, this.col, this.pos)
    }

    if (!this.isIdentStart(next)) {
      this.error("TK-04", 'Expected identifier after "@"', this.line, this.col, this.pos)
    }
  }

  private readString(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos

    this.advance()
    let value = ""

    while (!this.isEOF()) {
      const ch = this.peekChar()
      if (ch === "\"") {
        this.advance()
        this.emit(TokenKind.StringLit, value, line, col, offset)
        return
      }

      if (ch === "\n") {
        value += "\n"
        this.advanceNewline("\n")
        continue
      }

      if (ch === "\r" && this.peekChar(1) === "\n") {
        value += "\r\n"
        this.advanceNewline("\r\n")
        continue
      }

      value += ch
      this.advance()
    }

    this.error("TK-01", "Unterminated string literal", line, col, offset)
  }

  private readHexColor(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    let value = "#"

    this.advance()
    while (this.isHexDigit(this.peekChar())) {
      value += this.peekChar()
      this.advance()
    }

    if (value.length !== 4 && value.length !== 7) {
      this.error("TK-02", `Invalid hex color '${value}'`, line, col, offset)
    }

    this.emit(TokenKind.HexColor, value, line, col, offset)
  }

  private readNumber(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    let value = ""

    while (this.isDigit(this.peekChar())) {
      value += this.peekChar()
      this.advance()
    }

    if (this.peekChar() === "." && this.isDigit(this.peekChar(1))) {
      value += "."
      this.advance()
      while (this.isDigit(this.peekChar())) {
        value += this.peekChar()
        this.advance()
      }
    }

    this.emit(TokenKind.Number, value, line, col, offset)

    const suffix = this.readDimensionSuffix()
    if (suffix !== null) {
      this.emit(DIMENSION_KINDS[suffix], suffix, this.line, this.col, this.pos)
      this.advanceBy(suffix.length)
    }
  }

  private readDimensionSuffix(): DimensionSuffix | null {
    if (this.peekChar() === "%") {
      return "%"
    }

    const rem = this.source.slice(this.pos, this.pos + 3)
    if (rem === "rem") {
      return "rem"
    }

    const two = this.source.slice(this.pos, this.pos + 2)
    if (two === "px") {
      return "px"
    }
    if (two === "em") {
      return "em"
    }

    return null
  }

  private readNameLike(): void {
    const line = this.line
    const col = this.col
    const offset = this.pos
    const segments = [this.readIdentSegment()]

    while (this.peekChar() === ".") {
      if (!this.isIdentStart(this.peekChar(1))) {
        this.error("TK-03", "Expected identifier after '.'", this.line, this.col, this.pos)
      }
      this.advance()
      segments.push(this.readIdentSegment())
    }

    const value = segments.join(".")
    if (segments.length > 1) {
      this.emit(TokenKind.DottedIdent, value, line, col, offset)
      return
    }

    const keywordKind = KEYWORD_KINDS[value]
    if (keywordKind) {
      this.emit(keywordKind, value, line, col, offset)
      return
    }

    if (this.isComponentName(value)) {
      this.emit(TokenKind.ComponentName, value, line, col, offset)
      return
    }

    this.emit(TokenKind.Ident, value, line, col, offset)
  }

  private readIdentSegment(): string {
    let value = ""
    value += this.peekChar()
    this.advance()

    while (this.isIdentChar(this.peekChar())) {
      value += this.peekChar()
      this.advance()
    }

    return value
  }

  private emit(kind: TokenKind, value: string, line: number, col: number, offset: number): void {
    this.tokens.push({ kind, value, line, col, offset })
  }

  private advance(): void {
    this.pos += 1
    this.col += 1
  }

  private advanceBy(count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.advance()
    }
  }

  private advanceNewline(raw: "\n" | "\r\n"): void {
    this.pos += raw.length
    this.line += 1
    this.col = 1
  }

  private peekChar(ahead = 0): string {
    return this.source[this.pos + ahead] ?? ""
  }

  private isEOF(): boolean {
    return this.pos >= this.source.length
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9"
  }

  private isHexDigit(ch: string): boolean {
    return (ch >= "0" && ch <= "9")
      || (ch >= "a" && ch <= "f")
      || (ch >= "A" && ch <= "F")
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z")
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch) || ch === "-"
  }

  private isComponentName(value: string): boolean {
    return /^[A-Z][a-zA-Z0-9]*$/.test(value)
  }

  private error(
    code: "TK-01" | "TK-02" | "TK-03" | "TK-04",
    message: string,
    line: number,
    col: number,
    offset: number,
  ): never {
    throw new TokenizerError(code, message, line, col, offset, this.file)
  }
}

export function tokenize(source: string, file = "<unknown>"): Token[] {
  return new Tokenizer(source, file).tokenize()
}
