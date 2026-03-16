import { CompilerMessage } from "./compiler"
import { DiagnosticSeverity, SourceSpan } from "./diagnostics"

export const DIAGNOSTICS_JSON_SCHEMA = "framelab-diagnostics"
export const DIAGNOSTICS_JSON_VERSION = 1

export interface DiagnosticsJsonEnvelope {
  schema: typeof DIAGNOSTICS_JSON_SCHEMA
  version: typeof DIAGNOSTICS_JSON_VERSION
  diagnostics: DiagnosticsJsonDiagnostic[]
}

export interface DiagnosticsJsonDiagnostic {
  code: string
  severity: DiagnosticSeverity
  message: string
  stage: CompilerMessage["stage"]
  source: {
    file: string
    span: SourceSpan | null
  }
}

export function formatDiagnosticsJson(diagnostics: CompilerMessage[]): string {
  return `${JSON.stringify(diagnosticsJsonEnvelope(diagnostics), null, 2)}\n`
}

export function diagnosticsJsonEnvelope(diagnostics: CompilerMessage[]): DiagnosticsJsonEnvelope {
  return {
    schema: DIAGNOSTICS_JSON_SCHEMA,
    version: DIAGNOSTICS_JSON_VERSION,
    diagnostics: diagnostics.map((diagnostic) => ({
      code: diagnostic.code,
      severity: diagnostic.severity,
      message: diagnostic.message,
      stage: diagnostic.stage,
      source: {
        file: diagnostic.file,
        span: diagnostic.span,
      },
    })),
  }
}
