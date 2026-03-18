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

- id: `toast`
- component: `Toast`
- goal: Generate a compact feedback toast in the current supported subset.

Requirements to preserve when possible:
- Declare a tone variant with values [info, success, warning, danger] and default info.
- Declare a message-text prop.
- Use a trigger intent and accessible label based on message-text.
- Build the body from surface, stack, text, and optional slots.
- Use token references for fill, radius, padding, spacing, and text sizing.

Known subset limitations to respect:
- Avoid motion in the reference target because motion is warning-only in the current emitter.
- Keep the component inside the current emitted subset.
- Use diagnostics JSON rather than human-readable stderr for repair.

Source file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/toast/generated.fl`

Diagnostics file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/toast/generated.diagnostics.json`

Original source:

```fl
tokens demo {
  color.text.primary: #f0ede8
  color.status.info: #4a7cff
  color.status.success: #22c55e
  color.status.warning: #f59e0b
  color.status.error: #ef4444
  radius.card: 18px
  space.inset.sm: "12px 16px"
  space.gap.sm: 10px
  type.sm: 14px
}

component Toast(
  variant tone: [info, success, warning, danger] = info
  prop message-text: text = ""
) {
  intent trigger: "dismiss-toast" {
    label: "@message-text"
  }

  accessible {
    label: "@message-text"
  }

  surface {
    fill: token(color.status.info)
    radius: token(radius.card)
    padding: token(space.inset.sm)

    variant tone {
      success { fill: token(color.status.success) }
      warning { fill: token(color.status.warning) }
      danger { fill: token(color.status.error) }
    }

    stack(direction: horizontal, gap: token(space.gap.sm), align: center, justify: start, wrap: false) {
      slot icon: any
      text {
        content: @message-text
        text-color: token(color.text.primary)
        size: token(type.sm)
        weight: medium
      }
      slot action: any
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
