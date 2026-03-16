import { NodeBase, SourcePos } from "./ast"

export type DiagnosticSeverity = "error" | "warning" | "info"

export interface SourceSpan {
  start: SourcePos
  end: SourcePos
}

export interface Diagnostic {
  severity: DiagnosticSeverity
  code: string
  message: string
  span: SourceSpan
  file: string
}

type RuleSpec = {
  severity: DiagnosticSeverity
  defaultMessage: string
}

export const RULES: Record<string, RuleSpec> = {
  "VR-C1": { severity: "error", defaultMessage: "Component body must contain exactly one root layout element." },
  "VR-C2": { severity: "error", defaultMessage: "Component body must contain at most one intent node." },
  "VR-C3": { severity: "error", defaultMessage: "Component body must contain at most one accessible block." },
  "VR-C4": { severity: "error", defaultMessage: "Component body must contain at most one constraints block." },
  "VR-C5": { severity: "error", defaultMessage: "Variant param default must appear in the value list." },
  "VR-C6": { severity: "error", defaultMessage: "Variant axis names must not use built-in state names." },
  "VR-C7": { severity: "error", defaultMessage: "Variant values must not use built-in state names." },
  "VR-C8": { severity: "error", defaultMessage: "Intent nodes must declare a label property." },
  "VR-S1": { severity: "error", defaultMessage: "Surface properties must use the allowed value kinds." },
  "VR-S2": { severity: "error", defaultMessage: "Surface opacity must be a number in range [0, 1]." },
  "VR-S3": { severity: "error", defaultMessage: "Text-only properties are not valid on surface nodes." },
  "VR-S4": { severity: "error", defaultMessage: "Surface properties may not be duplicated in the same body." },
  "VR-K3": { severity: "error", defaultMessage: "Stack gap must be a token_ref." },
  "VR-TX1": { severity: "error", defaultMessage: "text-color must be a token_ref." },
  "VR-TX2": { severity: "error", defaultMessage: "size must be a token_ref." },
  "VR-TX3": { severity: "error", defaultMessage: "Heading text requires level, and non-heading text must not define it." },
  "VR-TX4": { severity: "error", defaultMessage: "Text level must be a number in range [1, 6]." },
  "VR-TX5": { severity: "error", defaultMessage: "Surface-only properties are not valid on text nodes." },
  "VR-SL1": { severity: "error", defaultMessage: "Slot names must be unique within a component." },
  "VR-SL4": { severity: "error", defaultMessage: "Slot bodies may contain only required and fallback statements." },
  "VR-SL5": { severity: "error", defaultMessage: "Slots are not valid at component scope." },
  "VR-I4": { severity: "error", defaultMessage: "Intent nodes are valid only in component bodies." },
  "VR-ST4": { severity: "error", defaultMessage: "State blocks are valid only inside surface, text, or intent bodies." },
  "VR-ST7": { severity: "error", defaultMessage: "State properties must be valid for the containing element." },
  "VR-V5": { severity: "error", defaultMessage: "Variant-case properties must be valid for the containing element." },
  "VR-M10": { severity: "error", defaultMessage: "Motion blocks are valid only inside surface bodies." },
  "VR-R1": { severity: "error", defaultMessage: "@ references must resolve to declared prop or variant names." },
  "VR-R2": { severity: "error", defaultMessage: "Dot-path @ references are not valid in v0.2 string values." },
  "VR-R3": { severity: "error", defaultMessage: "Prop names and slot names must not collide within a component." },
}

export function spanFromNode(node: NodeBase): SourceSpan {
  return {
    start: node.pos,
    end: node.pos,
  }
}

export function createDiagnostic(
  code: string,
  file: string,
  node: NodeBase,
  message?: string,
): Diagnostic {
  const rule = RULES[code]
  if (!rule) {
    throw new Error(`Unknown diagnostic rule code: ${code}`)
  }

  return {
    severity: rule.severity,
    code,
    message: message ?? rule.defaultMessage,
    span: spanFromNode(node),
    file,
  }
}
