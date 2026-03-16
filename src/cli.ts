#!/usr/bin/env node

import fs from "node:fs"
import path from "node:path"
import {
  CompilerMessage,
  analyzeSource,
  buildIRSource,
  compileSource,
  parseSource,
  writeBuildArtifacts,
} from "./compiler"
import { formatHumanDiagnostics } from "./diagnostics-human"
import { formatDiagnosticsJson } from "./diagnostics-json"

type InspectTarget = "ast" | "analyzed" | "ir"
type DiagnosticsFormat = "human" | "json"

interface CheckOptions {
  filePath: string
  watch: boolean
  diagnosticsFormat: DiagnosticsFormat
}

interface BuildOptions extends CheckOptions {
  outDir: string
}

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
  const parsed = parseCheckArgs(args, stderr)
  if (parsed === null) {
    return 1
  }

  if (parsed.watch) {
    return runWatch(parsed.filePath, stdout, () => runCheckOnce(parsed, stdout, stderr))
  }

  return runCheckOnce(parsed, stdout, stderr)
}

function runBuild(args: string[], stdout: NodeJS.WritableStream, stderr: NodeJS.WritableStream): number {
  const parsed = parseBuildArgs(args, stderr)
  if (parsed === null) {
    return 1
  }

  if (parsed.watch) {
    return runWatch(parsed.filePath, stdout, () => runBuildOnce(parsed, stdout, stderr))
  }

  return runBuildOnce(parsed, stdout, stderr)
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
      emitDiagnostics(result.diagnostics, stderr, "human")
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

function runCheckOnce(
  options: CheckOptions,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): number {
  const result = compileFile(options.filePath)
  emitDiagnostics(result.diagnostics, stderr, options.diagnosticsFormat)
  if (!result.ok) {
    return 1
  }

  stdout.write(`OK ${path.resolve(options.filePath)}\n`)
  return 0
}

function runBuildOnce(
  options: BuildOptions,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): number {
  const result = compileFile(options.filePath)
  emitDiagnostics(result.diagnostics, stderr, options.diagnosticsFormat)
  if (!result.ok) {
    return 1
  }

  const written = writeBuildArtifacts(result, options.outDir)
  for (const filePath of written) {
    stdout.write(`WROTE ${path.resolve(filePath)}\n`)
  }
  stdout.write(`BUILD OK ${options.outDir}\n`)
  return 0
}

function inspectAnalyzed(
  source: string,
  filePath: string,
  stdout: NodeJS.WritableStream,
  stderr: NodeJS.WritableStream,
): number {
  const result = analyzeSource(source, filePath)
  emitDiagnostics(result.diagnostics, stderr, "human")
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
  emitDiagnostics(result.diagnostics, stderr, "human")
  if (!result.ok) {
    return 1
  }
  stdout.write(`${JSON.stringify(result.ir, null, 2)}\n`)
  return 0
}

function parseCheckArgs(
  args: string[],
  stderr: NodeJS.WritableStream,
): CheckOptions | null {
  let filePath: string | null = null
  let watch = false
  let diagnosticsFormat: DiagnosticsFormat = "human"

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--watch") {
      watch = true
      continue
    }
    if (arg === "--diagnostics-format") {
      const value = args[index + 1] ?? null
      if (value !== "human" && value !== "json") {
        stderr.write("Expected --diagnostics-format to be one of: human, json.\n")
        return null
      }
      diagnosticsFormat = value
      index += 1
      continue
    }
    if (arg === "--json") {
      diagnosticsFormat = "json"
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
    stderr.write("Expected an input file for check.\n")
    return null
  }

  return { filePath, watch, diagnosticsFormat }
}

function parseBuildArgs(
  args: string[],
  stderr: NodeJS.WritableStream,
): BuildOptions | null {
  let filePath: string | null = null
  let outDir: string | null = null
  let watch = false
  let diagnosticsFormat: DiagnosticsFormat = "human"

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--watch") {
      watch = true
      continue
    }
    if (arg === "--diagnostics-format") {
      const value = args[index + 1] ?? null
      if (value !== "human" && value !== "json") {
        stderr.write("Expected --diagnostics-format to be one of: human, json.\n")
        return null
      }
      diagnosticsFormat = value
      index += 1
      continue
    }
    if (arg === "--json") {
      diagnosticsFormat = "json"
      continue
    }
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
    watch,
    diagnosticsFormat,
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
  diagnostics: CompilerMessage[],
  stderr: NodeJS.WritableStream,
  format: DiagnosticsFormat,
): void {
  if (diagnostics.length === 0) {
    return
  }

  if (format === "json") {
    stderr.write(formatDiagnosticsJson(diagnostics))
    return
  }

  stderr.write(formatHumanDiagnostics(diagnostics))
}

export interface WatchScheduler {
  notify(): void
  close(): void
}

export function createWatchScheduler(run: () => void, delayMs = 50): WatchScheduler {
  let timer: NodeJS.Timeout | null = null

  return {
    notify(): void {
      if (timer !== null) {
        clearTimeout(timer)
      }
      timer = setTimeout(() => {
        timer = null
        run()
      }, delayMs)
    },
    close(): void {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    },
  }
}

function runWatch(filePath: string, stdout: NodeJS.WritableStream, runOnce: () => number): number {
  const absolutePath = path.resolve(filePath)
  const directory = path.dirname(absolutePath)
  const baseName = path.basename(absolutePath)
  const scheduler = createWatchScheduler(() => {
    stdout.write(`CHANGE ${absolutePath}\n`)
    runOnce()
  })
  const watcher = fs.watch(directory, (_eventType, changedFileName) => {
    if (changedFileName !== null && changedFileName.toString() !== baseName) {
      return
    }
    scheduler.notify()
  })

  process.once("SIGINT", () => {
    scheduler.close()
    watcher.close()
  })

  stdout.write(`WATCH ${absolutePath}\n`)
  runOnce()
  return 0
}

function helpText(): string {
  return [
    "FrameLab CLI",
    "",
    "Commands:",
    "  check <file> [--watch] [--diagnostics-format human|json]",
    "  build <file> [--out-dir <dir>] [--watch] [--diagnostics-format human|json]",
    "  inspect --ast <file>",
    "  inspect --analyzed <file>",
    "  inspect --ir <file>",
    "",
  ].join("\n")
}

if (require.main === module) {
  process.exitCode = runCli(process.argv.slice(2))
}
