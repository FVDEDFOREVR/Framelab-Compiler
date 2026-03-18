Repair the FrameLab `.fl` file below using the diagnostics JSON as the authoritative interface.

Repair contract:

- Return FrameLab source only.
- Return one complete corrected `.fl` file, not a diff.
- Use the diagnostics JSON as the primary machine-readable repair signal.
- Preserve the component goal unless a diagnostic makes that impossible in the current supported subset.
- Fix errors first.
- If warnings remain, remove them when possible without leaving the current supported subset.
- Do not introduce unsupported syntax or broader full-spec behavior.
- If diagnostics mention unsupported motion, remove or rewrite that motion rather than expecting runtime motion support.

Eval case:

- id: `input`
- component: `Input`
- goal: Generate a presentational input-like component in the current supported subset.

Requirements to preserve when possible:
- Declare a tone variant with values [default, danger] and default default.
- Declare label-text, value-text, and hint-text props.
- Use accessible label and description.
- Build the body from surface, stack, and text nodes.
- Use token references for outline, fill, spacing, and text sizing.

Known subset limitations to respect:
- Treat the component as presentational output, not a native form control.
- Do not invent input-specific runtime behavior.
- Stay inside the current emitted subset.

Source file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/input/generated.fl`

Diagnostics file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/input/generated.diagnostics.json`

Original source:

```fl
tokens demo {
  color.text.primary: #f0ede8
  color.text.muted: #a09b94
  color.border.default: "rgba(255,255,255,0.18)"
  color.status.error: #ef4444
  surface.input: #121217
  radius.input: 14px
  space.inset.sm: "12px 16px"
  space.gap.xs: 6px
  type.xs: 12px
  type.sm: 14px
}

component Input(
  variant tone: [default, danger] = default
  prop label-text: text = ""
  prop value-text: text = ""
  prop hint-text: text = ""
) {
  accessible {
    label: "@label-text"
    description: "@hint-text"
  }

  surface {
    fill: token(surface.input)
    radius: token(radius.input)
    padding: token(space.inset.sm)
    outline: token(color.border.default)

    variant tone {
      danger { outline: token(color.status.error) }
    }

    stack(direction: vertical, gap: token(space.gap.xs)) {
      text {
        content: @label-text
        text-color: token(color.text.muted)
        size: token(type.xs)
        weight: medium
      }
      text {
        content: @value-text
        text-color: token(color.text.primary)
        size: token(type.sm)
        weight: medium
      }
      text {
        content: @hint-text
        text-color: token(color.text.muted)
        size: token(type.xs)
        weight: regular
      }
    }
  }
}
```

Diagnostics JSON:

```json
{
  "schema": "framelab-diagnostics",
  "version": 1,
  "diagnostics": []
}
```

Return only the repaired `.fl` source file.
