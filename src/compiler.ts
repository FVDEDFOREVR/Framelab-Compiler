import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { AnalyzedProgram } from "./analyzed"
import { Diagnostic, DiagnosticSeverity, SourceSpan } from "./diagnostics"
import {
  emitReactProgram,
  ReactEmitterDiagnostic,
  ReactProgramArtifacts,
} from "./emitter-react"
import { buildIR } from "./ir-builder"
import { IRProgram } from "./ir"
import { NormalizeError, normalizeProgram } from "./normalize"
import { ParseError, parse } from "./parser"
import { TokenizerError } from "./tokenizer"
import { validateProgram } from "./validator"
import { ProgramNode } from "./ast"

export type CompilerStage = "tokenize" | "parse" | "semantic" | "normalize" | "emit"

export interface CompilerMessage {
  severity: DiagnosticSeverity
  code: string
  message: string
  file: string
  line: number | null
  col: number | null
  span: SourceSpan | null
  stage: CompilerStage
}

export interface CompilerFailure {
  ok: false
  diagnostics: CompilerMessage[]
  ast: ProgramNode | null
  analyzed: AnalyzedProgram | null
  ir: IRProgram | null
  emitted: ReactProgramArtifacts | null
}

export interface CompilerSuccess {
  ok: true
  diagnostics: CompilerMessage[]
  ast: ProgramNode
  analyzed: AnalyzedProgram
  ir: IRProgram
  emitted: ReactProgramArtifacts
}

export type CompilerResult = CompilerFailure | CompilerSuccess

export interface AnalyzeFailure {
  ok: false
  diagnostics: CompilerMessage[]
  ast: ProgramNode | null
  analyzed: AnalyzedProgram | null
}

export interface AnalyzeSuccess {
  ok: true
  diagnostics: CompilerMessage[]
  ast: ProgramNode
  analyzed: AnalyzedProgram
}

export type AnalyzeResult = AnalyzeFailure | AnalyzeSuccess

export interface IRFailure {
  ok: false
  diagnostics: CompilerMessage[]
  ast: ProgramNode | null
  analyzed: AnalyzedProgram | null
  ir: IRProgram | null
}

export interface IRSuccess {
  ok: true
  diagnostics: CompilerMessage[]
  ast: ProgramNode
  analyzed: AnalyzedProgram
  ir: IRProgram
}

export type IRResult = IRFailure | IRSuccess

export function compileSource(source: string, file = "<unknown>"): CompilerResult {
  const irResult = buildIRSource(source, file)
  if (!irResult.ok) {
    return failure(irResult.diagnostics, irResult.ast, irResult.analyzed, irResult.ir, null)
  }

  const { ast, analyzed, ir } = irResult
  const emitted = emitReactProgram(ir)
  const emitterMessages = emitted.diagnostics.map((diagnostic) => emitterMessage(diagnostic, file))

  return {
    ok: true,
    diagnostics: [...irResult.diagnostics, ...emitterMessages],
    ast,
    analyzed,
    ir,
    emitted,
  }
}

export function analyzeSource(source: string, file = "<unknown>"): AnalyzeResult {
  const parseResult = parseSource(source, file)
  if (!parseResult.ok) {
    return { ok: false, diagnostics: parseResult.diagnostics, ast: null, analyzed: null }
  }

  const validation = validateProgram(parseResult.ast, file)
  const semanticMessages = validation.diagnostics.map(diagnosticMessage)
  if (semanticMessages.some((message) => message.severity === "error")) {
    return { ok: false, diagnostics: semanticMessages, ast: parseResult.ast, analyzed: null }
  }

  try {
    const analyzed = normalizeProgram(parseResult.ast, validation)
    return {
      ok: true,
      diagnostics: semanticMessages,
      ast: parseResult.ast,
      analyzed,
    }
  } catch (error) {
    if (error instanceof NormalizeError) {
      return {
        ok: false,
        diagnostics: [{
          severity: "error",
          code: "NM-01",
          message: error.message,
          file,
          line: null,
          col: null,
          span: null,
          stage: "normalize",
        }],
        ast: parseResult.ast,
        analyzed: null,
      }
    }
    throw error
  }
}

export function buildIRSource(source: string, file = "<unknown>"): IRResult {
  const analyzedResult = analyzeSource(source, file)
  if (!analyzedResult.ok) {
    return {
      ok: false,
      diagnostics: analyzedResult.diagnostics,
      ast: analyzedResult.ast,
      analyzed: analyzedResult.analyzed,
      ir: null,
    }
  }

  return {
    ok: true,
    diagnostics: analyzedResult.diagnostics,
    ast: analyzedResult.ast,
    analyzed: analyzedResult.analyzed,
    ir: buildIR(analyzedResult.analyzed),
  }
}

export function parseSource(source: string, file = "<unknown>"):
  | { ok: true; diagnostics: CompilerMessage[]; ast: ProgramNode }
  | { ok: false; diagnostics: CompilerMessage[] }
{
  try {
    return {
      ok: true,
      diagnostics: [],
      ast: parse(source, file),
    }
  } catch (error) {
    if (error instanceof TokenizerError) {
      return { ok: false, diagnostics: [tokenizerMessage(error)] }
    }
    if (error instanceof ParseError) {
      return { ok: false, diagnostics: [parseMessage(error)] }
    }
    throw error
  }
}

export function writeBuildArtifacts(result: CompilerSuccess, outDir: string): string[] {
  mkdirSync(outDir, { recursive: true })
  const written: string[] = []

  if (result.emitted.tokens !== null) {
    const filePath = path.join(outDir, result.emitted.tokens.path)
    writeFileSync(filePath, result.emitted.tokens.content, "utf8")
    written.push(filePath)
  }

  for (const component of result.emitted.components) {
    for (const artifact of [component.source, component.styles]) {
      const filePath = path.join(outDir, artifact.path)
      writeFileSync(filePath, artifact.content, "utf8")
      written.push(filePath)
    }
  }

  return written
}

function failure(
  diagnostics: CompilerMessage[],
  ast: ProgramNode | null,
  analyzed: AnalyzedProgram | null,
  ir: IRProgram | null,
  emitted: ReactProgramArtifacts | null,
): CompilerFailure {
  return { ok: false, diagnostics, ast, analyzed, ir, emitted }
}

function tokenizerMessage(error: TokenizerError): CompilerMessage {
  const span = pointSpan(error.line, error.col)
  return {
    severity: "error",
    code: error.code,
    message: error.message,
    file: error.file,
    line: error.line,
    col: error.col,
    span,
    stage: "tokenize",
  }
}

function parseMessage(error: ParseError): CompilerMessage {
  return {
    severity: "error",
    code: error.code,
    message: error.message,
    file: error.file,
    line: error.pos.line,
    col: error.pos.col,
    span: pointSpan(error.pos.line, error.pos.col),
    stage: "parse",
  }
}

function diagnosticMessage(diagnostic: Diagnostic): CompilerMessage {
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    file: diagnostic.file,
    line: diagnostic.span.start.line,
    col: diagnostic.span.start.col,
    span: diagnostic.span,
    stage: "semantic",
  }
}

function emitterMessage(diagnostic: ReactEmitterDiagnostic, file: string): CompilerMessage {
  const span = diagnostic.provenance?.span ?? null
  return {
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    file,
    line: span?.start.line ?? null,
    col: span?.start.col ?? null,
    span,
    stage: "emit",
  }
}

function pointSpan(line: number, col: number): SourceSpan {
  return {
    start: { line, col, offset: 0 },
    end: { line, col, offset: 0 },
  }
}
