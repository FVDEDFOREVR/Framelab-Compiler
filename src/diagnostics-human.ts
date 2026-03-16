import { CompilerMessage } from "./compiler"

export function formatHumanDiagnostics(diagnostics: CompilerMessage[]): string {
  return diagnostics.map(formatHumanDiagnostic).join("")
}

export function formatHumanDiagnostic(diagnostic: CompilerMessage): string {
  return [
    `${diagnostic.severity.toUpperCase()} ${diagnostic.code} [${diagnostic.stage}]`,
    `  at ${formatLocation(diagnostic)}`,
    `  ${diagnostic.message}`,
    "",
  ].join("\n")
}

function formatLocation(diagnostic: Pick<CompilerMessage, "file" | "span" | "line" | "col">): string {
  if (diagnostic.span !== null) {
    return `${diagnostic.file}:${diagnostic.span.start.line}:${diagnostic.span.start.col}`
  }
  if (diagnostic.line !== null && diagnostic.col !== null) {
    return `${diagnostic.file}:${diagnostic.line}:${diagnostic.col}`
  }
  return diagnostic.file
}
