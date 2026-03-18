#!/usr/bin/env node

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, "..")
const aiLoopPath = path.join(repoRoot, "scripts", "ai-loop.mjs")
const evalsRoot = path.join(repoRoot, "examples", "ai-loop", "evals")
const defaultResultsRoot = path.join(repoRoot, "examples", "ai-loop", "results")

function main(argv) {
  const [command, ...rest] = argv

  switch (command) {
    case "init":
      return runInit(rest)
    case "record-generated":
      return runRecord(rest, "generated")
    case "record-repaired":
      return runRecord(rest, "repaired")
    case "summarize":
      return runSummarize(rest)
    default:
      process.stderr.write(helpText())
      return command ? 1 : 0
  }
}

function runInit(args) {
  const { resultsRoot, evalIds } = parseInitArgs(args)
  mkdirSync(resultsRoot, { recursive: true })

  for (const evalId of evalIds) {
    initializeEval(resultsRoot, evalId)
  }

  writeResultsReadme(resultsRoot)
  const summary = summarizeResults(resultsRoot)
  writeJson(path.join(resultsRoot, "summary.json"), summary)
  process.stdout.write(`INITIALIZED ${resultsRoot}\n`)
  return 0
}

function runRecord(args, mode) {
  const parsed = parseRecordArgs(args)
  if (parsed === null) {
    return 1
  }

  const evalId = parsed.evalId
  const evalDir = path.join(parsed.resultsRoot, evalId)
  const runPath = path.join(evalDir, "run.json")
  if (!existsSync(runPath)) {
    process.stderr.write(`Missing run.json for ${evalId}. Run init first.\n`)
    return 1
  }

  const run = readJson(runPath)
  const sourcePath = path.resolve(parsed.sourcePath)
  const flTarget = path.join(evalDir, `${mode}.fl`)
  copyFileSync(sourcePath, flTarget)

  const diagnosticsPath = path.join(evalDir, `${mode}.diagnostics.json`)
  const checkResult = runAiLoop(["check", flTarget, "--diagnostics-out", diagnosticsPath])
  writeJson(path.join(evalDir, `${mode}.check.result.json`), normalizeCommandResult(checkResult))

  if (mode === "generated") {
    const repairPrompt = runAiLoop(["prompt", "repair", evalId, "--file", flTarget, "--diagnostics", diagnosticsPath])
    writeText(path.join(evalDir, "repair.prompt.md"), repairPrompt.stdout)
    run.generated = {
      status: checkResult.status === 0 ? "clean" : "needs-repair",
      file: "generated.fl",
      diagnostics: "generated.diagnostics.json",
      checkResult: "generated.check.result.json",
    }
  } else {
    const buildOutDir = path.join(evalDir, "repaired-build")
    rmSync(buildOutDir, { recursive: true, force: true })
    const buildDiagnostics = path.join(evalDir, "repaired.build.diagnostics.json")
    const buildResult = runAiLoop(["build", flTarget, "--out-dir", buildOutDir, "--diagnostics-out", buildDiagnostics])
    writeJson(path.join(evalDir, "repaired.build.result.json"), normalizeCommandResult(buildResult))
    run.repaired = {
      status: buildResult.status === 0 && diagnosticsCount(buildDiagnostics) === 0 ? "build-clean" : buildResult.status === 0 ? "build-warning" : "build-failed",
      file: "repaired.fl",
      diagnostics: "repaired.diagnostics.json",
      checkResult: "repaired.check.result.json",
      buildDiagnostics: "repaired.build.diagnostics.json",
      buildResult: "repaired.build.result.json",
      buildArtifactsDir: "repaired-build",
    }
  }

  run.summary = summarizeRun(evalDir, run)
  writeJson(runPath, run)
  writeJson(path.join(parsed.resultsRoot, "summary.json"), summarizeResults(parsed.resultsRoot))
  process.stdout.write(`RECORDED ${mode} ${evalId}\n`)
  return 0
}

function runSummarize(args) {
  const { resultsRoot } = parseCommonArgs(args)
  const summary = summarizeResults(resultsRoot)
  writeJson(path.join(resultsRoot, "summary.json"), summary)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
  return 0
}

function initializeEval(resultsRoot, evalId) {
  const evalDir = path.join(resultsRoot, evalId)
  mkdirSync(evalDir, { recursive: true })

  const generatePrompt = runAiLoop(["prompt", "generate", evalId])
  writeText(path.join(evalDir, "generate.prompt.md"), generatePrompt.stdout)

  const targetPath = path.join(evalsRoot, evalId, "target.fl")
  copyFileSync(targetPath, path.join(evalDir, "reference-target.fl"))

  const referenceDiagnostics = path.join(evalDir, "reference-check.diagnostics.json")
  const checkResult = runAiLoop(["check", targetPath, "--diagnostics-out", referenceDiagnostics])
  writeJson(path.join(evalDir, "reference-check.result.json"), normalizeCommandResult(checkResult))

  const buildOutDir = path.join(evalDir, "reference-build")
  rmSync(buildOutDir, { recursive: true, force: true })
  const buildDiagnostics = path.join(evalDir, "reference-build.diagnostics.json")
  const buildResult = runAiLoop(["build", targetPath, "--out-dir", buildOutDir, "--diagnostics-out", buildDiagnostics])
  writeJson(path.join(evalDir, "reference-build.result.json"), normalizeCommandResult(buildResult))

  const run = {
    evalId,
    referenceBaseline: {
      status: checkResult.status === 0 && buildResult.status === 0 && diagnosticsCount(referenceDiagnostics) === 0 && diagnosticsCount(buildDiagnostics) === 0
        ? "build-clean"
        : "failed",
      file: "reference-target.fl",
      checkDiagnostics: "reference-check.diagnostics.json",
      checkResult: "reference-check.result.json",
      buildDiagnostics: "reference-build.diagnostics.json",
      buildResult: "reference-build.result.json",
      buildArtifactsDir: "reference-build",
    },
    generated: {
      status: "pending-manual",
      file: null,
      diagnostics: null,
      checkResult: null,
    },
    repaired: {
      status: "pending-manual",
      file: null,
      diagnostics: null,
      checkResult: null,
      buildDiagnostics: null,
      buildResult: null,
      buildArtifactsDir: null,
    },
    observedFailureCodes: [],
    observedDriftPatterns: [],
  }
  run.summary = summarizeRun(evalDir, run)
  writeJson(path.join(evalDir, "run.json"), run)
}

function summarizeResults(resultsRoot) {
  const evalIds = readdirSync(resultsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  const runs = evalIds
    .map((evalId) => path.join(resultsRoot, evalId, "run.json"))
    .filter((filePath) => existsSync(filePath))
    .map((filePath) => readJson(filePath))

  const firstPassSuccesses = runs.filter((run) => run.generated.status === "clean").length
  const repairPassSuccesses = runs.filter((run) => run.repaired.status === "build-clean").length
  const referenceBaselineSuccesses = runs.filter((run) => run.referenceBaseline.status === "build-clean").length
  const failureCodes = aggregateValues(runs.flatMap((run) => run.summary.failureCodes))
  const driftPatterns = aggregateValues(runs.flatMap((run) => run.observedDriftPatterns ?? []))

  return {
    schema: "framelab-ai-loop-results",
    version: 1,
    evalCount: runs.length,
    firstPassSuccessRate: rate(firstPassSuccesses, runs.length),
    repairPassSuccessRate: rate(repairPassSuccesses, runs.length),
    referenceBaselineSuccessRate: rate(referenceBaselineSuccesses, runs.length),
    commonFailureCodes: failureCodes,
    commonDriftPatterns: driftPatterns,
    notes: [
      "Generated and repaired steps are manual unless record-generated or record-repaired has been run.",
      "Reference baseline uses checked-in target.fl files to confirm the current supported subset builds locally.",
    ],
  }
}

function summarizeRun(evalDir, run) {
  const failureCodes = []

  for (const relativePath of [
    run.generated.diagnostics,
    run.repaired.diagnostics,
    run.repaired.buildDiagnostics,
  ]) {
    if (!relativePath) {
      continue
    }
    const absolutePath = path.join(evalDir, relativePath)
    if (!existsSync(absolutePath)) {
      continue
    }
    const diagnostics = readJson(absolutePath).diagnostics ?? []
    for (const diagnostic of diagnostics) {
      failureCodes.push(diagnostic.code)
    }
  }

  return {
    firstPassSuccess: run.generated.status === "clean",
    repairPassSuccess: run.repaired.status === "build-clean",
    failureCodes: aggregateValues(failureCodes),
  }
}

function aggregateValues(values) {
  const counts = new Map()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }))
}

function rate(successes, total) {
  return {
    successes,
    total,
    ratio: total === 0 ? null : successes / total,
  }
}

function parseInitArgs(args) {
  const { resultsRoot, positional } = parseCommonArgs(args)
  const evalIds = positional.includes("--all") || positional.length === 0
    ? listEvalIds()
    : positional.filter((value) => value !== "--all")
  return { resultsRoot, evalIds }
}

function parseRecordArgs(args) {
  const { resultsRoot, positional } = parseCommonArgs(args)
  const [evalId, ...rest] = positional
  if (!evalId) {
    process.stderr.write("Expected an eval id.\n")
    return null
  }

  let sourcePath = null
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === "--source") {
      sourcePath = rest[index + 1] ?? null
      index += 1
      continue
    }
    process.stderr.write(`Unexpected argument: ${arg}\n`)
    return null
  }

  if (sourcePath === null) {
    process.stderr.write("Expected --source <path>.\n")
    return null
  }

  return { resultsRoot, evalId, sourcePath }
}

function parseCommonArgs(args) {
  let resultsRoot = defaultResultsRoot
  const positional = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--results-dir") {
      resultsRoot = path.resolve(args[index + 1] ?? defaultResultsRoot)
      index += 1
      continue
    }
    positional.push(arg)
  }

  return { resultsRoot, positional }
}

function listEvalIds() {
  return readdirSync(evalsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
}

function runAiLoop(args) {
  return spawnSync(process.execPath, [aiLoopPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
  })
}

function normalizeCommandResult(result) {
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  }
}

function diagnosticsCount(filePath) {
  return readJson(filePath).diagnostics.length
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function writeJson(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function writeText(filePath, value) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, value, "utf8")
}

function writeResultsReadme(resultsRoot) {
  writeText(path.join(resultsRoot, "README.md"), [
    "# AI Loop Results",
    "",
    "This directory stores repeatable local eval runs for the FrameLab AI authoring and repair loop.",
    "",
    "Each eval directory may contain:",
    "",
    "- `generate.prompt.md`",
    "- `reference-target.fl`",
    "- `reference-check.diagnostics.json`",
    "- `reference-check.result.json`",
    "- `reference-build/`",
    "- `reference-build.diagnostics.json`",
    "- `reference-build.result.json`",
    "- `generated.fl`",
    "- `generated.diagnostics.json`",
    "- `generated.check.result.json`",
    "- `repair.prompt.md`",
    "- `repaired.fl`",
    "- `repaired.diagnostics.json`",
    "- `repaired.check.result.json`",
    "- `repaired-build/`",
    "- `repaired.build.diagnostics.json`",
    "- `repaired.build.result.json`",
    "- `run.json`",
    "",
    "Generated and repaired files are manual until explicitly recorded through `scripts/ai-loop-results.mjs`.",
    "",
  ].join("\n"))
}

function helpText() {
  return [
    "FrameLab AI Loop Results Helper",
    "",
    "Commands:",
    "  init [--all|<eval-id>...] [--results-dir <dir>]",
    "  record-generated <eval-id> --source <path> [--results-dir <dir>]",
    "  record-repaired <eval-id> --source <path> [--results-dir <dir>]",
    "  summarize [--results-dir <dir>]",
    "",
  ].join("\n")
}

process.exitCode = main(process.argv.slice(2))
