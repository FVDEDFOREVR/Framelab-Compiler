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

- id: `button`
- component: `Button`
- goal: Generate a compact action button in the current supported subset.

Requirements to preserve when possible:
- Declare a tone variant with values [primary, ghost, danger] and default primary.
- Declare a label-text prop with a string default.
- Use an intent trigger and an accessible label.
- Build the body from surface and text nodes only.
- Use token references for fill, radius, padding, text color, and text size.

Known subset limitations to respect:
- Do not rely on unsupported motion output.
- Do not use dot-path @ references.
- Keep the output inside the emitted React/CSS subset.

Source file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/button/generated.fl`

Diagnostics file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/button/generated.diagnostics.json`

Original source:

```fl
tokens demo {
  color.action.primary: #4a7cff
  color.text.on-action: #f8fbff
  color.status.error: #ef4444
  radius.button: 999px
  space.inset.sm: "12px 16px"
  type.sm: 14px
}

component Button(
  variant tone: [primary, ghost, danger] = primary
  prop label-text: text = "Button"
) {
  intent trigger: "button-action" {
    label: "@label-text"
  }

  accessible {
    role: button
    label: "@label-text"
  }

  surface {
    fill: token(color.action.primary)
    radius: token(radius.button)
    padding: token(space.inset.sm)

    variant tone {
      ghost { fill: transparent outline: token(color.action.primary) }
      danger { fill: token(color.status.error) }
    }

    text {
      content: @label-text
      text-color: token(color.text.on-action)
      size: token(type.sm)
      weight: semibold
      align: center
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
