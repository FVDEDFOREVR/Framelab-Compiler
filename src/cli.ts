#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import {
  analyzeSource,
  buildIRSource,
  compileSource,
  parseSource,
  writeBuildArtifacts,
} from "./compiler"

type InspectTarget = "ast" | "analyzed" | "ir"

export function runCli(argv: string[], stdout = process.stdout, stderr = process.stderr): number {
  const [command, ...rest] = argv

  if (!command || command === "-h" || command === "--help") {
    stdout.write(helpText())
    return 0
  }

  switch (command) {
    case "check":
      return runCheck(rest, stdout, stderr)
    case "build":
      return runBuild(rest, stdout, stderr)
    case "inspect":
      return runInspect(rest, stdout, stderr)
    default:
      stderr.write(`Unknown command: ${command}\n`)
      stderr.write(helpText())
      return 1
  }
}

function runCheck(args: string[], stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): number {
  const filePath = requireSingleInput(args, stderr, "check")
  if (filePath === null) {
    return 1
  }

  const result = compileFile(filePath)
  emitDiagnostics(result.diagnostics, stderr)
  if (!result.ok) {
    return 1
  }

  stdout.write(`OK ${path.resolve(filePath)}\n`)
  return 0
}

function runBuild(args: string[], stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): number {
  const parsed = parseBuildArgs(args, stderr)
  if (parsed === null) {
    return 1
  }

  const result = compileFile(parsed.filePath)
  emitDiagnostics(result.diagnostics, stderr)
  if (!result.ok) {
    return 1
  }

  const written = writeBuildArtifacts(result, parsed.outDir)
  for (const filePath of written) {
    stdout.write(`WROTE ${path.resolve(filePath)}\n`)
  }
  stdout.write(`BUILD OK ${parsed.outDir}\n`)
  return 0
}

function runInspect(args: string[], stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): number {
  const parsed = parseInspectArgs(args, stderr)
  if (parsed === null) {
    return 1
  }

  const absolutePath = path.resolve(parsed.filePath)
  const source = fs.readFileSync(absolutePath, "utf8")
  if (parsed.target === "ast") {
    const result = parseSource(source, absolutePath)
    if (!result.ok) {
      emitDiagnostics(result.diagnostics, stderr)
      return 1
    }
    stdout.write(`${JSON.stringify(result.ast, null, 2)}\n`)
    return 0
  }

  switch (parsed.target) {
    case "analyzed":
      return inspectAnalyzed(source, absolutePath, stdout, stderr)
    case "ir":
      return inspectIR(source, absolutePath, stdout, stderr)
  }
}

function compileFile(filePath: string) {
  const absolutePath = path.resolve(filePath)
  const source = fs.readFileSync(absolutePath, "utf8")
  return compileSource(source, absolutePath)
}

function inspectAnalyzed(
  source: string,
  filePath: string,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): number {
  const result = analyzeSource(source, filePath)
  emitDiagnostics(result.diagnostics, stderr)
  if (!result.ok) {
    return 1
  }
  stdout.write(`${JSON.stringify(result.analyzed, null, 2)}\n`)
  return 0
}

function inspectIR(
  source: string,
  filePath: string,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): number {
  const result = buildIRSource(source, filePath)
  emitDiagnostics(result.diagnostics, stderr)
  if (!result.ok) {
    return 1
  }
  stdout.write(`${JSON.stringify(result.ir, null, 2)}\n`)
  return 0
}

function requireSingleInput(
  args: string[],
  stderr: NodeJS.WritableStream,
  command: string,
): string | null {
  if (args.length !== 1) {
    stderr.write(`Expected exactly one input file for ${command}.\n`)
    return null
  }
  return args[0]
}

function parseBuildArgs(
  args: string[],
  stderr: NodeJS.WritableStream,
): { filePath: string; outDir: string } | null {
  let filePath: string | null = null
  let outDir: string | null = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--out-dir") {
      outDir = args[index + 1] ?? null
      index += 1
      continue
    }
    if (filePath === null) {
      filePath = arg
      continue
    }
    stderr.write(`Unexpected argument: ${arg}\n`)
    return null
  }

  if (filePath === null) {
    stderr.write("Expected an input file for build.\n")
    return null
  }

  return {
    filePath,
    outDir: path.resolve(outDir ?? path.join(process.cwd(), "framelab-build")),
  }
}

function parseInspectArgs(
  args: string[],
  stderr: NodeJS.WritableStream,
): { target: InspectTarget; filePath: string } | null {
  let target: InspectTarget | null = null
  let filePath: string | null = null

  for (const arg of args) {
    if (arg === "--ast") {
      target = "ast"
      continue
    }
    if (arg === "--analyzed") {
      target = "analyzed"
      continue
    }
    if (arg === "--ir") {
      target = "ir"
      continue
    }
    if (filePath === null) {
      filePath = arg
      continue
    }
    stderr.write(`Unexpected argument: ${arg}\n`)
    return null
  }

  if (target === null) {
    stderr.write("Inspect requires one of --ast, --analyzed, or --ir.\n")
    return null
  }
  if (filePath === null) {
    stderr.write("Inspect requires an input file.\n")
    return null
  }

  return { target, filePath }
}

function emitDiagnostics(
  diagnostics: Array<{
    severity: string
    code: string
    message: string
    file: string
    line: number | null
    col: number | null
    stage: string
  }>,
  stderr: NodeJS.WritableStream,
): void {
  for (const diagnostic of diagnostics) {
    const location = diagnostic.line === null || diagnostic.col === null
      ? diagnostic.file
      : `${diagnostic.file}:${diagnostic.line}:${diagnostic.col}`
    stderr.write(`${location} ${diagnostic.severity.toUpperCase()} ${diagnostic.code} [${diagnostic.stage}] ${diagnostic.message}\n`)
  }
}

function helpText(): string {
  return [
    "FrameLab CLI",
    "",
    "Commands:",
    "  check <file>",
    "  build <file> [--out-dir <dir>]",
    "  inspect --ast <file>",
    "  inspect --analyzed <file>",
    "  inspect --ir <file>",
    "",
  ].join("\n")
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2))
}
