// =============================================================================
// FRAMELAB Compiler — test.ts
// Demonstrates the full pipeline: .fl source → tokens → AST → React output
// Run with: npm test   (after: npm run build)
// =============================================================================

import * as fs   from "fs"
import * as path from "path"
import { tokenize, Token }   from "./tokenizer"
import { parse }             from "./parser"
import { emit, EmittedFile } from "./emitter-react"
import { Program }           from "./ast"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const RESET   = "\x1b[0m"
const BOLD    = "\x1b[1m"
const DIM     = "\x1b[2m"
const GREEN   = "\x1b[32m"
const YELLOW  = "\x1b[33m"
const CYAN    = "\x1b[36m"
const RED     = "\x1b[31m"
const WHITE   = "\x1b[97m"
const BG_DARK = "\x1b[48;5;235m"

function header(title: string): void {
  const width = 70
  const pad   = Math.max(0, width - title.length - 4)
  console.log(`\n${BOLD}${CYAN}┌${"─".repeat(width)}┐${RESET}`)
  console.log(`${BOLD}${CYAN}│  ${WHITE}${title}${CYAN}${" ".repeat(pad)}  │${RESET}`)
  console.log(`${BOLD}${CYAN}└${"─".repeat(width)}┘${RESET}`)
}

function section(title: string): void {
  console.log(`\n${BOLD}${YELLOW}── ${title} ${"─".repeat(Math.max(0, 60 - title.length))}${RESET}`)
}

function ok(msg: string): void   { console.log(`  ${GREEN}✓${RESET}  ${msg}`) }
function fail(msg: string): void { console.log(`  ${RED}✗${RESET}  ${msg}`); process.exitCode = 1 }

function assert(condition: boolean, message: string): void {
  condition ? ok(message) : fail(message)
}

function printCode(label: string, content: string): void {
  console.log(`\n  ${BOLD}${WHITE}📄 ${label}${RESET}`)
  console.log(`  ${DIM}${"─".repeat(66)}${RESET}`)
  for (const line of content.split("\n")) {
    console.log(`  ${DIM}│${RESET}  ${line}`)
  }
  console.log(`  ${DIM}${"─".repeat(66)}${RESET}`)
}

function propValueStr(v: any): string {
  if (!v) return "?"
  if (v.kind === "TokenRef")      return `token(${v.path.join(".")})`
  if (v.kind === "StringLiteral") return JSON.stringify(v.value)
  if (v.kind === "NumberLiteral") return String(v.value)
  if (v.kind === "BindingExpr")   return `@${v.path.join(".")}`
  return v.kind
}

function printAST(node: any, indent = 0): void {
  const pad = "  ".repeat(indent)
  if (!node || typeof node !== "object") return

  if (node.kind === "Program") {
    console.log(`  ${pad}${BOLD}Program${RESET}  (${node.body.length} declaration)`)
    for (const child of node.body) printAST(child, indent + 1)
    return
  }
  if (node.kind === "ComponentDecl") {
    console.log(`  ${pad}${BOLD}${CYAN}ComponentDecl${RESET}  name=${WHITE}${node.name}${RESET}  params=${node.params.length}`)
    for (const item of node.body) printAST(item, indent + 1)
    return
  }
  if (node.kind === "VisualNode") {
    const alias      = node.alias ? ` ${DIM}as ${node.alias}${RESET}` : ""
    const propKids   = node.children.filter((c: any) => c.__prop)
    const stateKids  = node.children.filter((c: any) => c.kind === "StateBlock")
    const nodeKids   = node.children.filter((c: any) => !c.__prop && c.kind !== "StateBlock")
    console.log(`  ${pad}${GREEN}VisualNode${RESET}  ${BOLD}${node.nodeType}${RESET}${alias}`)
    for (const c of propKids) {
      const p = c.__prop
      console.log(`  ${pad}  ${DIM}prop  ${p.name}: ${propValueStr(p.value)}${RESET}`)
    }
    for (const c of stateKids) {
      console.log(`  ${pad}  ${YELLOW}StateBlock${RESET}  name=${c.name}  props=${c.props.length}`)
    }
    for (const c of nodeKids) printAST(c, indent + 1)
    return
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Read example.fl
// ─────────────────────────────────────────────────────────────────────────────

header("FRAMELAB Compiler  ·  Full Pipeline Demo  ·  v0.1")

const EXAMPLE_PATH = path.resolve(__dirname, "../example.fl")

section("Step 1 — Source file")

let source: string
try {
  source = fs.readFileSync(EXAMPLE_PATH, "utf8")
  ok(`Read ${EXAMPLE_PATH}`)
  ok(`${source.split("\n").length} lines, ${source.length} bytes`)
} catch (e: any) {
  fail(`Cannot read example.fl: ${e.message}`)
  process.exit(1)
}

printCode("example.fl", source.trimEnd())

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Tokenize
// ─────────────────────────────────────────────────────────────────────────────

section("Step 2 — Tokenize")

let tokens: Token[]
try {
  tokens = tokenize(source, "example.fl")
  ok(`Produced ${tokens.length} tokens (including EOF)`)
} catch (e: any) {
  fail(`Tokenizer error: ${e.message}`)
  process.exit(1)
}

const display = tokens.filter(t => t.kind !== "EOF")
console.log()
console.log(`  ${"KIND".padEnd(14)} ${"VALUE".padEnd(30)} LINE:COL`)
console.log(`  ${"─".repeat(14)} ${"─".repeat(30)} ${"─".repeat(8)}`)
for (const t of display.slice(0, 40)) {
  const k = t.kind.padEnd(14)
  const v = JSON.stringify(t.value).padEnd(30)
  const p = `${t.line}:${t.column}`
  console.log(`  ${CYAN}${k}${RESET} ${WHITE}${v}${RESET} ${DIM}${p}${RESET}`)
}
if (display.length > 40) {
  console.log(`  ${DIM}... and ${display.length - 40} more tokens${RESET}`)
}

assert(tokens[0].kind === "KEYWORD" && tokens[0].value === "component",  "First token is KEYWORD 'component'")
assert(tokens[1].kind === "IDENT"   && tokens[1].value === "HelloCard",  "Second token is IDENT 'HelloCard'")
assert(tokens[tokens.length - 1].kind === "EOF",                          "Last token is EOF")
assert(tokens.some(t => t.kind === "KEYWORD" && t.value === "surface"),  "Token stream contains 'surface'")
assert(tokens.some(t => t.kind === "KEYWORD" && t.value === "stack"),    "Token stream contains 'stack'")
assert(tokens.some(t => t.kind === "KEYWORD" && t.value === "text"),     "Token stream contains 'text'")
assert(tokens.some(t => t.kind === "KEYWORD" && t.value === "token"),    "Token stream contains 'token'")
assert(tokens.some(t => t.kind === "KEYWORD" && t.value === "state"),    "Token stream contains 'state'")
assert(tokens.some(t => t.kind === "STRING"),                             "Token stream contains STRING literals")

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Parse → AST
// ─────────────────────────────────────────────────────────────────────────────

section("Step 3 — Parse → AST")

let program: Program
try {
  program = parse(source, "example.fl")
  ok("Parsed with no errors")
} catch (e: any) {
  fail(`Parse error: ${e.message}`)
  process.exit(1)
}

console.log()
printAST(program)
console.log()

const comp = program.body.find((n: any) => n.kind === "ComponentDecl") as any
assert(!!comp,                            "Program contains a ComponentDecl")
assert(comp?.name === "HelloCard",        "Component name is 'HelloCard'")
assert(comp?.params.length === 0,         "Component has 0 params")
assert(comp?.body.length === 1,           "Component body has 1 root node")

const surface = comp?.body[0]
assert(surface?.kind === "VisualNode",    "Root item is a VisualNode")
assert(surface?.nodeType === "surface",   "Root VisualNode is 'surface'")

const allKids    = surface?.children ?? []
const propKids   = allKids.filter((c: any) => c.__prop)
const stateKids  = allKids.filter((c: any) => c.kind === "StateBlock")
const nodeKids   = allKids.filter((c: any) => !c.__prop && c.kind !== "StateBlock")
assert(propKids.length  >= 3,             "surface has fill, radius, padding props")
assert(stateKids.length === 1,            "surface has 1 state block")
assert(stateKids[0]?.name === "hover",    "State block is 'hover'")
assert(nodeKids.length  === 1,            "surface has 1 child node")
assert(nodeKids[0]?.nodeType === "stack", "Child node is 'stack'")

const stack     = nodeKids[0]
const textNodes = (stack?.children ?? []).filter(
  (c: any) => !c.__prop && c.kind !== "StateBlock" && c.nodeType === "text"
)
assert(textNodes.length === 2,            "stack contains 2 text nodes")
assert(textNodes[0]?.alias === "heading", "First text node: alias 'heading'")
assert(textNodes[1]?.alias === "body",    "Second text node: alias 'body'")

const headingProps = textNodes[0]?.children ?? []
const headingContent = headingProps.find((c: any) => c.__prop?.name === "content")
assert(!!headingContent,                  "Heading node has a 'content' prop")
assert(
  headingContent?.__prop?.value?.value === "Hello, FRAMELAB",
  "Heading content value is 'Hello, FRAMELAB'"
)

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — Emit → React
// ─────────────────────────────────────────────────────────────────────────────

section("Step 4 — Emit → React JSX + CSS Modules")

let files: EmittedFile[]
try {
  files = emit(program)
  ok(`Emitter produced ${files.length} file(s)`)
} catch (e: any) {
  fail(`Emitter error: ${e.message}`)
  process.exit(1)
}

for (const file of files) {
  printCode(file.path, file.content)
}

const tsxFile = files.find(f => f.path.endsWith(".tsx"))
const cssFile = files.find(f => f.path.endsWith(".module.css"))

assert(!!tsxFile, "TSX file emitted")
assert(!!cssFile, "CSS Modules file emitted")

if (tsxFile) {
  const tsx = tsxFile.content
  assert(tsx.includes("import React"),                       "TSX: imports React")
  assert(tsx.includes("import styles"),                      "TSX: imports CSS module")
  assert(tsx.includes("import clsx"),                        "TSX: imports clsx")
  assert(tsx.includes("export default function HelloCard"),  "TSX: exports HelloCard")
  assert(tsx.includes("interface HelloCardProps"),           "TSX: emits Props interface")
  assert(tsx.includes("isHovered"),                          "TSX: hover state variable")
  assert(tsx.includes("onMouseEnter"),                       "TSX: onMouseEnter handler")
  assert(tsx.includes("onMouseLeave"),                       "TSX: onMouseLeave handler")
  assert(tsx.includes("<h2"),                                "TSX: heading level:2 → <h2>")
  assert(tsx.includes("<p"),                                 "TSX: text as body → <p>")
  assert(tsx.includes("Hello, FRAMELAB"),                       "TSX: heading content rendered")
  assert(tsx.includes("A design-first language"),            "TSX: body content rendered")
  assert(tsx.includes("styles["),                            "TSX: CSS module class refs")
}

if (cssFile) {
  const css = cssFile.content
  assert(css.includes(".surface"),                           "CSS: .surface class")
  assert(css.includes(".stack"),                             "CSS: .stack class")
  assert(css.includes(".text-heading"),                      "CSS: .text-heading class")
  assert(css.includes(".text-body"),                         "CSS: .text-body class")
  assert(css.includes(".surface:hover"),                     "CSS: hover → :hover pseudo-class")
  assert(css.includes("transition:"),                        "CSS: motion → transition")
  assert(css.includes("prefers-reduced-motion"),             "CSS: reduced-motion media query")
  assert(css.includes("var(--"),                             "CSS: token() → CSS custom properties")
  assert(css.includes("flex-direction: column"),             "CSS: stack vertical direction")
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

section("Pipeline summary")

console.log(`
  ${GREEN}example.fl${RESET}
    ${DIM}↓  tokenize()   →  ${tokens.length} tokens${RESET}
    ${DIM}↓  parse()      →  ComponentDecl: HelloCard${RESET}
    ${DIM}↓  emit()       →  ${files.map(f => f.path).join("  +  ")}${RESET}
`)

const exitCode = process.exitCode ?? 0
if (exitCode === 0) {
  console.log(`  ${BG_DARK}${GREEN}${BOLD}  ✓  All assertions passed. The FRAMELAB pipeline is working.  ${RESET}\n`)
} else {
  console.log(`  ${RED}${BOLD}  Some assertions failed — see above.${RESET}\n`)
}
