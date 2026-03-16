#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const promptsRoot = path.join(repoRoot, "examples", "ai-loop", "prompts")
const evalsRoot = path.join(repoRoot, "examples", "ai-loop", "evals")
const cliPath = path.join(repoRoot, "dist", "cli.js")
const emptyDiagnosticsEnvelope = {
  schema: "framelab-diagnostics",
  version: 1,
  diagnostics: [],
}

function main(argv) {
  const [command, ...rest] = argv

  switch (command) {
    case "list":
      return listEvals()
    case "prompt":
      return runPrompt(rest)
    case "check":
      return runCompilerCommand("check", rest)
    case "build":
      return runCompilerCommand("build", rest)
    default:
      process.stderr.write(helpText())
      return command ? 1 : 0
  }
}

function listEvals() {
  for (const id of evalIds()) {
    process.stdout.write(`${id}\n`)
  }
  return 0
}

function runPrompt(args) {
  const [kind, evalId, ...rest] = args
  if ((kind !== "generate" && kind !== "repair") || !evalId) {
    process.stderr.write("Expected prompt generate <eval-id> or prompt repair <eval-id>.\n")
    return 1
  }

  const manifest = loadEval(evalId)
  if (manifest === null) {
    process.stderr.write(`Unknown eval id: ${evalId}\n`)
    return 1
  }

  if (kind === "generate") {
    process.stdout.write(renderTemplate("generate-template.md", {
      eval_id: manifest.id,
      component_name: manifest.componentName,
      goal: manifest.goal,
      requirements: renderList(manifest.requirements),
      limitations: renderList(manifest.limitations),
      reference_output_path: path.join("examples", "ai-loop", "evals", manifest.id, "target.fl"),
    }))
    return 0
  }

  const parsed = parseRepairArgs(rest)
  if (parsed === null) {
    return 1
  }
  const source = readFileSync(path.resolve(parsed.filePath), "utf8")
  const diagnostics = readFileSync(path.resolve(parsed.diagnosticsPath), "utf8")

  process.stdout.write(renderTemplate("repair-template.md", {
    eval_id: manifest.id,
    component_name: manifest.componentName,
    goal: manifest.goal,
    requirements: renderList(manifest.requirements),
    limitations: renderList(manifest.limitations),
    source_file: path.resolve(parsed.filePath),
    diagnostics_file: path.resolve(parsed.diagnosticsPath),
    original_source: source.trimEnd(),
    diagnostics_json: diagnostics.trimEnd(),
  }))
  return 0
}

function parseRepairArgs(args) {
  let filePath = null
  let diagnosticsPath = null

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--file") {
      filePath = args[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--diagnostics") {
      diagnosticsPath = args[index + 1] ?? null
      index += 1
      continue
    }
    process.stderr.write(`Unexpected argument: ${arg}\n`)
    return null
  }

  if (filePath === null || diagnosticsPath === null) {
    process.stderr.write("Repair prompts require --file <path> and --diagnostics <path>.\n")
    return null
  }

  return { filePath, diagnosticsPath }
}

function runCompilerCommand(command, args) {
  const { diagnosticsOut, passthroughArgs } = extractDiagnosticsOut(args)
  const result = spawnSync(process.execPath, [cliPath, command, ...passthroughArgs, "--diagnostics-format", "json"], {
    cwd: repoRoot,
    encoding: "utf8",
  })

  const stdout = result.stdout ?? ""
  const stderr = result.stderr ?? ""
  process.stdout.write(stdout)
  process.stderr.write(stderr)

  if (diagnosticsOut !== null) {
    const targetPath = path.resolve(diagnosticsOut)
    mkdirSync(path.dirname(targetPath), { recursive: true })
    writeFileSync(targetPath, stderr === "" ? `${JSON.stringify(emptyDiagnosticsEnvelope, null, 2)}\n` : stderr, "utf8")
    process.stdout.write(`DIAGNOSTICS ${targetPath}\n`)
  }

  return result.status ?? 1
}

function extractDiagnosticsOut(args) {
  let diagnosticsOut = null
  const passthroughArgs = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--diagnostics-out") {
      diagnosticsOut = args[index + 1] ?? null
      index += 1
      continue
    }
    passthroughArgs.push(arg)
  }

  return { diagnosticsOut, passthroughArgs }
}

function renderTemplate(templateName, values) {
  const template = readFileSync(path.join(promptsRoot, templateName), "utf8")
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_match, key) => values[key] ?? "")
}

function renderList(items) {
  return items.map((item) => `- ${item}`).join("\n")
}

function evalIds() {
  return ["button", "product-card", "input", "nav-item", "toast"]
}

function loadEval(evalId) {
  const manifestPath = path.join(evalsRoot, evalId, "case.json")
  if (!existsSync(manifestPath)) {
    return null
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"))
}

function helpText() {
  return [
    "FrameLab AI Loop Helper",
    "",
    "Commands:",
    "  list",
    "  prompt generate <eval-id>",
    "  prompt repair <eval-id> --file <path> --diagnostics <path>",
    "  check <file> [--diagnostics-out <path>]",
    "  build <file> --out-dir <dir> [--diagnostics-out <path>]",
    "",
  ].join("\n")
}

process.exitCode = main(process.argv.slice(2))
