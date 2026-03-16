import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { emitReactProgram } from "./emitter-react"
import { buildIR } from "./ir-builder"
import { NormalizeError, normalizeProgram } from "./normalize"
import { ParseError, parse } from "./parser"
import { TokenKind, TokenizerError, tokenize } from "./tokenizer"
import { validateProgram } from "./validator"

const FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/parser")
const SEMANTIC_FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/semantic")
const NORMALIZE_FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/normalize")
const IR_FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/ir")
const EMITTER_FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/emitter")
const E2E_FIXTURES_ROOT = path.resolve(__dirname, "../fixtures/e2e")
const CLI_PATH = path.resolve(__dirname, "./cli.js")
const UPDATE_E2E_GOLDENS = process.env.UPDATE_E2E_GOLDENS === "1"

function test(name: string, fn: () => void): void {
  try {
    fn()
    console.log(`PASS ${name}`)
  } catch (error) {
    console.error(`FAIL ${name}`)
    throw error
  }
}

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize)
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(record)) {
      if (key === "pos" || key === "provenance" || nested === undefined) {
        continue
      }
      out[key] = sanitize(nested)
    }
    return out
  }
  return value
}

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

function runValidFixtures(): void {
  const dir = path.join(FIXTURES_ROOT, "valid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const expected = loadJson(expectedPath)
    const actual = sanitize(parse(source, fileName))
    assert.deepStrictEqual(actual, expected, fileName)
  }
}

function runInvalidFixtures(): void {
  const dir = path.join(FIXTURES_ROOT, "invalid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".error.json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const expected = loadJson(expectedPath) as { code: string; message: string }
    assert.throws(
      () => parse(source, fileName),
      (error: unknown) =>
        error instanceof ParseError
        && error.code === expected.code
        && error.message.includes(expected.message),
      fileName,
    )
  }
}

function runTokenizerRegression(): void {
  const tokens = tokenize("content: @name\n")
  assert.deepStrictEqual(
    tokens.slice(0, 4).map((token) => token.kind),
    [TokenKind.Ident, TokenKind.Colon, TokenKind.At, TokenKind.Ident],
  )

  const dotted = tokenize("content: @product.title\n")
  assert.deepStrictEqual(
    dotted.slice(0, 4).map((token) => token.kind),
    [TokenKind.Ident, TokenKind.Colon, TokenKind.At, TokenKind.DottedIdent],
  )

  assert.throws(
    () => tokenize("@", "bare-at.fl"),
    (error: unknown) => error instanceof TokenizerError && error.code === "TK-04",
  )
}

function runSemanticValidFixtures(): void {
  const dir = path.join(SEMANTIC_FIXTURES_ROOT, "valid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const source = fs.readFileSync(fixturePath, "utf8")
    const program = parse(source, fileName)
    const result = validateProgram(program, fileName)
    assert.deepStrictEqual(result.diagnostics, [], fileName)
  }
}

function runSemanticInvalidFixtures(): void {
  const dir = path.join(SEMANTIC_FIXTURES_ROOT, "invalid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".diag.json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const expected = loadJson(expectedPath) as Array<{ code: string; severity: string }>
    const program = parse(source, fileName)
    const result = validateProgram(program, fileName)
    const actual = result.diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
    }))
    assert.deepStrictEqual(actual, expected, fileName)
  }
}

function runNormalizeFixtures(): void {
  const dir = path.join(NORMALIZE_FIXTURES_ROOT, "valid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const program = parse(source, fileName)
    const validation = validateProgram(program, fileName)
    const normalized = normalizeProgram(program, validation)
    assertNormalizedHasProvenance(normalized)
    assert.deepStrictEqual(sanitize(normalized), loadJson(expectedPath), fileName)
  }
}

function runNormalizeGuards(): void {
  const fixturePath = path.join(SEMANTIC_FIXTURES_ROOT, "invalid", "02-vr-c2-duplicate-intent.fl")
  const source = fs.readFileSync(fixturePath, "utf8")
  const program = parse(source, "02-vr-c2-duplicate-intent.fl")
  const validation = validateProgram(program, "02-vr-c2-duplicate-intent.fl")

  assert.ok(validation.diagnostics.some((diagnostic) => diagnostic.code === "VR-C2"))
  assert.throws(
    () => normalizeProgram(program, validation),
    (error: unknown) => error instanceof NormalizeError,
  )
}

function runIRFixtures(): void {
  const dir = path.join(IR_FIXTURES_ROOT, "valid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const program = parse(source, fileName)
    const validation = validateProgram(program, fileName)
    const analyzed = normalizeProgram(program, validation)
    const ir = buildIR(analyzed)
    assertIRHasProvenance(ir)
    assert.deepStrictEqual(sanitize(ir), loadJson(expectedPath), fileName)
  }
}

function runEmitterFixtures(): void {
  const dir = path.join(EMITTER_FIXTURES_ROOT, "valid")
  for (const fileName of fs.readdirSync(dir).filter((name) => name.endsWith(".fl")).sort()) {
    const fixturePath = path.join(dir, fileName)
    const expectedPath = fixturePath.replace(/\.fl$/, ".json")
    const source = fs.readFileSync(fixturePath, "utf8")
    const program = parse(source, fileName)
    const validation = validateProgram(program, fileName)
    const analyzed = normalizeProgram(program, validation)
    const ir = buildIR(analyzed)
    const emitted = emitReactProgram(ir)
    assert.deepStrictEqual(sanitize(emitted), loadJson(expectedPath), fileName)
  }
}

function runCliIntegration(): void {
  const inspectFixture = path.join(FIXTURES_ROOT, "valid", "08-intent-accessible-constraints.fl")
  const astExpected = loadJson(inspectFixture.replace(/\.fl$/, ".json"))
  const inspectAst = runCli(["inspect", "--ast", inspectFixture])
  assert.equal(inspectAst.status, 0)
  assert.deepStrictEqual(sanitize(JSON.parse(inspectAst.stdout)), astExpected)

  const analyzedFixture = path.join(NORMALIZE_FIXTURES_ROOT, "valid", "01-component-normalized.fl")
  const analyzedExpected = loadJson(analyzedFixture.replace(/\.fl$/, ".json"))
  const inspectAnalyzed = runCli(["inspect", "--analyzed", analyzedFixture])
  assert.equal(inspectAnalyzed.status, 0)
  assert.deepStrictEqual(sanitize(JSON.parse(inspectAnalyzed.stdout)), analyzedExpected)

  const irFixture = path.join(IR_FIXTURES_ROOT, "valid", "01-component-ir.fl")
  const irExpected = loadJson(irFixture.replace(/\.fl$/, ".json"))
  const inspectIr = runCli(["inspect", "--ir", irFixture])
  assert.equal(inspectIr.status, 0)
  assert.deepStrictEqual(sanitize(JSON.parse(inspectIr.stdout)), irExpected)

  const validCheck = runCli(["check", buildFixturePath()])
  assert.equal(validCheck.status, 0)
  assert.match(validCheck.stdout, /^OK /)
  assert.equal(validCheck.stderr, "")

  const invalidFixture = path.join(SEMANTIC_FIXTURES_ROOT, "invalid", "02-vr-c2-duplicate-intent.fl")
  const invalidCheck = runCli(["check", invalidFixture])
  assert.equal(invalidCheck.status, 1)
  assert.match(invalidCheck.stderr, /VR-C2/)

  const buildFixture = buildFixturePath()
  const buildExpected = loadJson(buildFixture.replace(/\.fl$/, ".json")) as {
    tokens: { path: string; content: string } | null
    components: Array<{
      source: { path: string; content: string }
      styles: { path: string; content: string }
    }>
  }
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "framelab-cli-"))
  const buildResult = runCli(["build", buildFixture, "--out-dir", outDir])
  assert.equal(buildResult.status, 0)
  assert.match(buildResult.stdout, /BUILD OK/)
  if (buildExpected.tokens !== null) {
    assert.equal(
      fs.readFileSync(path.join(outDir, buildExpected.tokens.path), "utf8"),
      buildExpected.tokens.content,
    )
  }
  for (const component of buildExpected.components) {
    assert.equal(
      fs.readFileSync(path.join(outDir, component.source.path), "utf8"),
      component.source.content,
    )
    assert.equal(
      fs.readFileSync(path.join(outDir, component.styles.path), "utf8"),
      component.styles.content,
    )
  }
}

function runE2EGoldens(): void {
  const cases = fs.readdirSync(E2E_FIXTURES_ROOT).sort()
  for (const caseName of cases) {
    const caseRoot = path.join(E2E_FIXTURES_ROOT, caseName)
    const inputPath = path.join(caseRoot, "input.fl")
    const goldenRoot = path.join(caseRoot, "golden")
    const source = fs.readFileSync(inputPath, "utf8")
    assert.ok(source.length > 0, `${caseName} input should not be empty`)

    verifyCommandGolden(caseName, inputPath, goldenRoot, "check", runCli(["check", inputPath]), inputPath)
    verifyInspectGolden(caseName, inputPath, goldenRoot, "ast")
    verifyInspectGolden(caseName, inputPath, goldenRoot, "analyzed")
    verifyInspectGolden(caseName, inputPath, goldenRoot, "ir")
    verifyBuildGolden(caseName, inputPath, goldenRoot)
  }
}

function buildFixturePath(): string {
  return path.join(EMITTER_FIXTURES_ROOT, "valid", "01-button-react.fl")
}

function verifyInspectGolden(caseName: string, inputPath: string, goldenRoot: string, target: "ast" | "analyzed" | "ir"): void {
  const result = runCli(["inspect", `--${target}`, inputPath])
  const normalizedStdout = normalizeCliText(result.stdout, inputPath)
  const normalizedStderr = normalizeCliText(result.stderr, inputPath)
  verifyTextGolden(path.join(goldenRoot, `inspect.${target}.status.txt`), `${result.status}\n`)
  verifyTextGolden(path.join(goldenRoot, `inspect.${target}.stdout.txt`), normalizedStdout)
  verifyTextGolden(path.join(goldenRoot, `inspect.${target}.stderr.txt`), normalizedStderr)
  assertGolden(caseName, `inspect --${target} status`, `${result.status}\n`, path.join(goldenRoot, `inspect.${target}.status.txt`))
  assertGolden(caseName, `inspect --${target} stdout`, normalizedStdout, path.join(goldenRoot, `inspect.${target}.stdout.txt`))
  assertGolden(caseName, `inspect --${target} stderr`, normalizedStderr, path.join(goldenRoot, `inspect.${target}.stderr.txt`))
}

function verifyBuildGolden(caseName: string, inputPath: string, goldenRoot: string): void {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "framelab-e2e-"))
  const result = runCli(["build", inputPath, "--out-dir", outDir])
  const normalizedStdout = normalizeCliText(result.stdout, inputPath, outDir)
  const normalizedStderr = normalizeCliText(result.stderr, inputPath, outDir)
  const buildRoot = path.join(goldenRoot, "build")

  verifyTextGolden(path.join(goldenRoot, "build.status.txt"), `${result.status}\n`)
  verifyTextGolden(path.join(goldenRoot, "build.stdout.txt"), normalizedStdout)
  verifyTextGolden(path.join(goldenRoot, "build.stderr.txt"), normalizedStderr)
  assertGolden(caseName, "build status", `${result.status}\n`, path.join(goldenRoot, "build.status.txt"))
  assertGolden(caseName, "build stdout", normalizedStdout, path.join(goldenRoot, "build.stdout.txt"))
  assertGolden(caseName, "build stderr", normalizedStderr, path.join(goldenRoot, "build.stderr.txt"))

  const actualFiles = result.status === 0 ? listRelativeFiles(outDir) : []
  const expectedFiles = fs.existsSync(buildRoot) ? listRelativeFiles(buildRoot) : []
  verifyBuildFileGoldens(buildRoot, outDir, actualFiles)
  if (UPDATE_E2E_GOLDENS) {
    return
  }
  assert.deepStrictEqual(actualFiles, expectedFiles, `${caseName} build files`)
  for (const relativePath of expectedFiles) {
    const actualContent = fs.readFileSync(path.join(outDir, relativePath), "utf8")
    const expectedContent = fs.readFileSync(path.join(buildRoot, relativePath), "utf8")
    assert.strictEqual(actualContent, expectedContent, `${caseName} build artifact ${relativePath}`)
  }
}

function verifyCommandGolden(
  caseName: string,
  inputPath: string,
  goldenRoot: string,
  command: "check",
  result: { status: number; stdout: string; stderr: string },
  filePath: string,
): void {
  const normalizedStdout = normalizeCliText(result.stdout, filePath)
  const normalizedStderr = normalizeCliText(result.stderr, filePath)
  verifyTextGolden(path.join(goldenRoot, `${command}.status.txt`), `${result.status}\n`)
  verifyTextGolden(path.join(goldenRoot, `${command}.stdout.txt`), normalizedStdout)
  verifyTextGolden(path.join(goldenRoot, `${command}.stderr.txt`), normalizedStderr)
  assertGolden(caseName, `${command} status`, `${result.status}\n`, path.join(goldenRoot, `${command}.status.txt`))
  assertGolden(caseName, `${command} stdout`, normalizedStdout, path.join(goldenRoot, `${command}.stdout.txt`))
  assertGolden(caseName, `${command} stderr`, normalizedStderr, path.join(goldenRoot, `${command}.stderr.txt`))
}

function verifyTextGolden(filePath: string, content: string): void {
  if (!UPDATE_E2E_GOLDENS) {
    return
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf8")
}

function verifyBuildFileGoldens(buildRoot: string, actualRoot: string, actualFiles: string[]): void {
  if (!UPDATE_E2E_GOLDENS) {
    return
  }

  fs.rmSync(buildRoot, { recursive: true, force: true })
  if (actualFiles.length === 0) {
    return
  }
  for (const relativePath of actualFiles) {
    const targetPath = path.join(buildRoot, relativePath)
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.copyFileSync(path.join(actualRoot, relativePath), targetPath)
  }
}

function assertGolden(caseName: string, label: string, actual: string, goldenPath: string): void {
  const expected = fs.readFileSync(goldenPath, "utf8")
  assert.strictEqual(actual, expected, `${caseName} ${label}`)
}

function listRelativeFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return []
  }

  const files: string[] = []
  walkFiles(root, files)
  return files.sort()
}

function walkFiles(root: string, files: string[], current = root): void {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    const fullPath = path.join(current, entry.name)
    if (entry.isDirectory()) {
      walkFiles(root, files, fullPath)
      continue
    }
    files.push(path.relative(root, fullPath))
  }
}

function normalizeCliText(text: string, inputPath: string, outDir?: string): string {
  let normalized = text.split(path.resolve(inputPath)).join("<INPUT>")
  if (outDir) {
    normalized = normalized.split(path.resolve(outDir)).join("<OUT_DIR>")
  }
  return normalized
}

function assertNormalizedHasProvenance(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertNormalizedHasProvenance(item)
    }
    return
  }

  if (!value || typeof value !== "object") {
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.kind === "string" && record.kind.startsWith("Analyzed")) {
    assert.ok(record.provenance, `Missing provenance for ${record.kind}`)
  }

  for (const nested of Object.values(record)) {
    assertNormalizedHasProvenance(nested)
  }
}

function assertIRHasProvenance(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      assertIRHasProvenance(item)
    }
    return
  }

  if (!value || typeof value !== "object") {
    return
  }

  const record = value as Record<string, unknown>
  if (typeof record.kind === "string" && kindRequiresProvenance(record.kind)) {
    assert.ok(record.provenance, `Missing provenance for ${record.kind}`)
  }

  for (const nested of Object.values(record)) {
    assertIRHasProvenance(nested)
  }
}

function kindRequiresProvenance(kind: string): boolean {
  return new Set([
    "IRProgram",
    "IRTokens",
    "IRTheme",
    "IRTokenDef",
    "IRComponent",
    "IRVariantAxis",
    "IRPropParam",
    "IRSurface",
    "IRStack",
    "IRText",
    "IRSlot",
    "IRProp",
    "IRTokenRef",
    "IRState",
    "IRTransition",
    "IRVariant",
    "IRVariantCase",
    "IREnterMotion",
    "IRExitMotion",
    "IRPulseMotion",
    "IRRevealMotion",
    "IRIntent",
    "IRAccessible",
  ]).has(kind)
}

function runCli(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: path.resolve(__dirname, ".."),
    encoding: "utf8",
  })

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

test("parser valid fixtures", runValidFixtures)
test("parser invalid fixtures", runInvalidFixtures)
test("semantic valid fixtures", runSemanticValidFixtures)
test("semantic invalid fixtures", runSemanticInvalidFixtures)
test("normalization fixtures", runNormalizeFixtures)
test("normalization guards", runNormalizeGuards)
test("ir fixtures", runIRFixtures)
test("emitter fixtures", runEmitterFixtures)
test("cli integration", runCliIntegration)
test("e2e goldens", runE2EGoldens)
test("tokenizer reference regression", runTokenizerRegression)

console.log("Compiler milestone tests passed.")
