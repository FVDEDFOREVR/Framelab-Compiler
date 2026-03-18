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

- id: `product-card`
- component: `ProductCard`
- goal: Generate a navigable product card with slots for thumbnail and actions.

Requirements to preserve when possible:
- Declare title-text, category-text, and price-text props.
- Use a navigate intent and accessible label based on title-text.
- Build the body from surface, stack, text, and slot nodes.
- Use token references for fill, radius, padding, and text sizing.
- Keep slot placement explicit for thumbnail and actions.

Known subset limitations to respect:
- Do not infer unsupported host behavior beyond the current emitter.
- Do not use unsupported motion output.
- Stay inside the current supported subset.

Source file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/product-card/generated.fl`

Diagnostics file:

- `/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/product-card/generated.diagnostics.json`

Original source:

```fl
tokens demo {
  color.text.primary: #f0ede8
  color.text.muted: #a09b94
  surface.raised: #18181c
  radius.card: 18px
  space.inset.md: "20px 22px"
  space.gap.sm: 10px
  space.gap.md: 16px
  type.xs: 12px
  type.sm: 14px
  type.lg: 22px
}

component ProductCard(
  prop title-text: text = ""
  prop category-text: text = ""
  prop price-text: text = ""
) {
  intent navigate: "product-detail" {
    label: "@title-text"
  }

  accessible {
    role: article
    label: "@title-text"
  }

  surface {
    fill: token(surface.raised)
    radius: token(radius.card)
    padding: token(space.inset.md)

    stack(direction: vertical, gap: token(space.gap.md)) {
      slot thumbnail: any
      stack(direction: vertical, gap: token(space.gap.sm)) {
        text {
          content: @category-text
          text-color: token(color.text.muted)
          size: token(type.xs)
          weight: medium
        }
        text {
          content: @title-text
          text-color: token(color.text.primary)
          size: token(type.lg)
          weight: semibold
        }
        text {
          content: @price-text
          text-color: token(color.text.primary)
          size: token(type.sm)
          weight: medium
        }
      }
      slot actions: any
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
