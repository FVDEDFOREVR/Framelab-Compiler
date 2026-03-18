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

- id: `nav-item`
- component: `NavItem`
- goal: Generate a navigable item with an optional icon slot and a current-state variant.

Requirements to preserve when possible:
- Declare an emphasis variant with values [default, current, suppressed].
- Declare a label-text prop.
- Use a navigate intent and accessible label.
- Build the body from surface, stack, text, and one icon slot.
- Use token references for fill, radius, padding, gap, and text sizing.

Known subset limitations to respect:
- Do not rely on browser reset behavior being generated automatically.
- Do not use unsupported motion output.
- Stay inside the current emitted subset.

Source file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/nav-item/generated.fl`

Diagnostics file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/nav-item/generated.diagnostics.json`

Original source:

```fl
tokens demo {
  color.text.primary: #f0ede8
  color.action.primary: #4a7cff
  surface.base: "rgba(255,255,255,0.04)"
  surface.selected: "rgba(74,124,255,0.16)"
  radius.sm: 8px
  space.inset.sm: "12px 16px"
  space.gap.sm: 10px
  type.sm: 14px
}

component NavItem(
  variant emphasis: [default, current, suppressed] = default
  prop label-text: text = ""
) {
  intent navigate: "nav-item" {
    label: "@label-text"
  }

  accessible {
    label: "@label-text"
  }

  surface {
    fill: token(surface.base)
    radius: token(radius.sm)
    padding: token(space.inset.sm)

    variant emphasis {
      current { fill: token(surface.selected) outline: token(color.action.primary) }
      suppressed { opacity: 0.4 }
    }

    stack(direction: horizontal, gap: token(space.gap.sm), align: center, justify: start, wrap: false) {
      slot icon: any
      text {
        content: @label-text
        text-color: token(color.text.primary)
        size: token(type.sm)
        weight: medium
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
