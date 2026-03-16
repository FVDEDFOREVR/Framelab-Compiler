// =============================================================================
// FRAMELAB Tokenizer — v0.1 MVP
//
// Converts a raw .framelab source string into a flat array of Token objects.
// The tokenizer is intentionally simple: single-pass, no backtracking.
// =============================================================================

export type TokenKind =
  // Literals
  | "STRING"
  | "NUMBER"
  | "HEX_COLOR"
  | "DIMENSION"      // 12px, 1.5rem, 100%
  | "DURATION"       // 200ms, 0.3s

  // Identifiers & keywords
  | "IDENT"
  | "KEYWORD"

  // Punctuation
  | "LBRACE"         // {
  | "RBRACE"         // }
  | "LPAREN"         // (
  | "RPAREN"         // )
  | "LBRACKET"       // [
  | "RBRACKET"       // ]
  | "COLON"          // :
  | "COMMA"          // ,
  | "DOT"            // .
  | "ARROW"          // →  or  ->
  | "AT"             // @
  | "HASH"           // #  (used in focus: #element-id)
  | "QUESTION"       // ?
  | "SLASH"          // /
  | "EQUALS"          // =
  | "BANG"            // !

  // End of file
  | "EOF"

export const KEYWORDS = new Set([
  // Top-level declarations
  "model", "source", "derived", "action", "component",
  "page", "theme", "tokens", "import", "constraints",
  "plugin", "system",

  // Visual nodes (built-in)
  "surface", "stack", "grid", "text", "image", "icon",
  "input", "spinner", "slot",

  // Node modifiers
  "as", "keyed",

  // Variant / prop system
  "variant", "token",

  // Control flow
  "when", "else", "repeat", "empty", "each", "times", "skeletons",

  // Intents
  "intent", "trigger", "navigate", "toggle", "submit",
  "on", "tap", "doubletap", "longpress", "hover", "focus",
  "blur", "swipe", "keypress",

  // States
  "state", "guard", "defaults",

  // Actions
  "set", "to", "append", "remove", "where",
  "call", "fetch", "GET", "POST", "PUT", "DELETE",

  // Data / types
  "from", "filter", "sort", "map",
  "ascending", "descending", "first",
  "render", "server", "client", "cache", "triggers", "params",

  // A11y
  "role", "accessible", "live", "trap",

  // Constraints
  "forbid", "require", "warn", "note", "hardcoded", "nesting", "inside",

  // Theme / tokens
  "extends", "alias", "namespace", "validate",

  // Misc
  "not", "and", "or", "is", "contains",
  "required", "override", "augment", "super",

  // Literals
  "true", "false", "null",
])

export interface Token {
  kind:    TokenKind
  value:   string           // raw source text
  line:    number
  column:  number
}

export class TokenizerError extends Error {
  constructor(
    message: string,
    public readonly line:   number,
    public readonly column: number,
    public readonly file:   string,
  ) {
    super(`${file}:${line}:${column} — ${message}`)
    this.name = "TokenizerError"
  }
}

// =============================================================================
// Tokenizer class
// =============================================================================

export class Tokenizer {
  private pos    = 0
  private line   = 1
  private column = 1
  private tokens: Token[] = []

  constructor(
    private readonly source: string,
    private readonly file:   string = "<unknown>",
  ) {}

  tokenize(): Token[] {
    while (this.pos < this.source.length) {
      this.skipWhitespaceAndComments()
      if (this.pos >= this.source.length) break
      this.readToken()
    }

    this.tokens.push({
      kind:   "EOF",
      value:  "",
      line:   this.line,
      column: this.column,
    })

    return this.tokens
  }

  // ---------------------------------------------------------------------------
  // Whitespace & Comments
  // ---------------------------------------------------------------------------

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]

      // Whitespace
      if (ch === " " || ch === "\t" || ch === "\r") {
        this.advance()
        continue
      }

      // Newline
      if (ch === "\n") {
        this.advanceLine()
        continue
      }

      // Line comment: // ...
      if (ch === "/" && this.source[this.pos + 1] === "/") {
        this.pos += 2
        this.column += 2
        while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
          this.advance()
        }
        continue
      }

      // Block comment: /* ... */
      if (ch === "/" && this.source[this.pos + 1] === "*") {
        this.pos += 2
        this.column += 2
        while (this.pos < this.source.length) {
          if (this.source[this.pos] === "*" && this.source[this.pos + 1] === "/") {
            this.pos += 2
            this.column += 2
            break
          }
          if (this.source[this.pos] === "\n") {
            this.advanceLine()
          } else {
            this.advance()
          }
        }
        continue
      }

      break
    }
  }

  // ---------------------------------------------------------------------------
  // Token dispatch
  // ---------------------------------------------------------------------------

  private readToken(): void {
    const ch      = this.source[this.pos]
    const line    = this.line
    const column  = this.column

    // Unicode arrow →
    if (ch === "\u2192") {
      this.emit("ARROW", "→", line, column)
      this.advance()
      return
    }

    // ASCII arrow ->
    if (ch === "-" && this.source[this.pos + 1] === ">") {
      this.emit("ARROW", "->", line, column)
      this.pos += 2; this.column += 2
      return
    }

    // Hex color: starts with # followed by hex digits
    if (ch === "#" && this.isHexDigit(this.source[this.pos + 1] ?? "")) {
      this.readHexColor(line, column)
      return
    }

    // Single-char punctuation
    const single: Partial<Record<string, TokenKind>> = {
      "{": "LBRACE",
      "}": "RBRACE",
      "(": "LPAREN",
      ")": "RPAREN",
      "[": "LBRACKET",
      "]": "RBRACKET",
      ":": "COLON",
      ",": "COMMA",
      ".": "DOT",
      "@": "AT",
      "#": "HASH",
      "?": "QUESTION",
      "/": "SLASH",
      "=": "EQUALS",
      "!": "BANG",
    }
    if (single[ch]) {
      this.emit(single[ch]!, ch, line, column)
      this.advance()
      return
    }

    // String literal: "..."
    if (ch === '"') {
      this.readString(line, column)
      return
    }

    // Number (including dimensions and durations)
    if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.source[this.pos + 1] ?? ""))) {
      this.readNumber(line, column)
      return
    }

    // Identifier or keyword
    if (this.isIdentStart(ch)) {
      this.readIdent(line, column)
      return
    }

    this.error(`Unexpected character '${ch}'`, line, column)
  }

  // ---------------------------------------------------------------------------
  // Readers
  // ---------------------------------------------------------------------------

  private readString(line: number, column: number): void {
    this.advance() // opening "
    let value = ""
    while (this.pos < this.source.length) {
      const ch = this.source[this.pos]
      if (ch === "\\") {
        this.advance()
        const escaped = this.source[this.pos]
        switch (escaped) {
          case "n":  value += "\n"; break
          case "t":  value += "\t"; break
          case "r":  value += "\r"; break
          case '"':  value += '"';  break
          case "\\": value += "\\"; break
          default:   value += escaped
        }
        this.advance()
      } else if (ch === '"') {
        this.advance() // closing "
        this.emit("STRING", value, line, column)
        return
      } else if (ch === "\n") {
        this.error("Unterminated string literal", line, column)
      } else {
        value += ch
        this.advance()
      }
    }
    this.error("Unterminated string literal", line, column)
  }

  private readNumber(line: number, column: number): void {
    let value = ""

    // Optional leading minus
    if (this.source[this.pos] === "-") {
      value += "-"
      this.advance()
    }

    // Integer part
    while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
      value += this.source[this.pos]
      this.advance()
    }

    // Fractional part
    if (this.source[this.pos] === "." && this.isDigit(this.source[this.pos + 1] ?? "")) {
      value += "."
      this.advance()
      while (this.pos < this.source.length && this.isDigit(this.source[this.pos])) {
        value += this.source[this.pos]
        this.advance()
      }
    }

    // Unit suffix: px, rem, em, %, vw, vh, ms, s
    const unitStart = this.pos
    let unit = ""
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      unit += this.source[this.pos]
      this.advance()
    }

    // % is a unit but not an ident char — check for it
    if (unit === "" && this.source[this.pos] === "%") {
      unit = "%"
      this.advance()
    }

    if (unit === "ms" || unit === "s") {
      this.emit("DURATION", value + unit, line, column)
    } else if (unit !== "") {
      this.emit("DIMENSION", value + unit, line, column)
    } else {
      this.emit("NUMBER", value, line, column)
    }
  }

  private readHexColor(line: number, column: number): void {
    this.advance() // skip #
    let value = "#"
    while (this.pos < this.source.length && this.isHexDigit(this.source[this.pos])) {
      value += this.source[this.pos]
      this.advance()
    }
    if (value.length !== 4 && value.length !== 7) {
      this.error(`Invalid hex color '${value}': must be #RGB or #RRGGBB`, line, column)
    }
    this.emit("HEX_COLOR", value, line, column)
  }

  private readIdent(line: number, column: number): void {
    let value = ""
    while (this.pos < this.source.length && this.isIdentChar(this.source[this.pos])) {
      value += this.source[this.pos]
      this.advance()
    }
    const kind: TokenKind = KEYWORDS.has(value) ? "KEYWORD" : "IDENT"
    this.emit(kind, value, line, column)
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private emit(kind: TokenKind, value: string, line: number, column: number): void {
    this.tokens.push({ kind, value, line, column })
  }

  private advance(): void {
    this.pos++
    this.column++
  }

  private advanceLine(): void {
    this.pos++
    this.line++
    this.column = 1
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9"
  }

  private isHexDigit(ch: string): boolean {
    return (ch >= "0" && ch <= "9") ||
           (ch >= "a" && ch <= "f") ||
           (ch >= "A" && ch <= "F")
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") ||
           (ch >= "A" && ch <= "Z") ||
           ch === "_"
  }

  private isIdentChar(ch: string): boolean {
    return this.isIdentStart(ch) || (ch >= "0" && ch <= "9") || ch === "-"
  }

  private error(message: string, line: number, column: number): never {
    throw new TokenizerError(message, line, column, this.file)
  }
}

// =============================================================================
// Public API
// =============================================================================

export function tokenize(source: string, file = "<unknown>"): Token[] {
  return new Tokenizer(source, file).tokenize()
}
