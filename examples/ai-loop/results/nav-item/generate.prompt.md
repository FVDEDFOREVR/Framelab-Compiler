Generate one valid FrameLab `.fl` file for the eval case below.

Output contract:

- Return FrameLab source only.
- Return one complete `.fl` file, not prose.
- Stay inside the current FrameLab v0.1 alpha supported subset.
- Prefer build-clean output in the current emitter subset.
- Do not use unsupported language inventions, alternate syntax, or full-spec features that are not in the current supported subset.
- Do not assume native form semantics unless the supported subset already provides them.
- Avoid motion unless the case explicitly requires a warning-producing example.

Eval case:

- id: `nav-item`
- component: `NavItem`
- goal: Generate a navigable item with an optional icon slot and a current-state variant.

Requirements:
- Declare an emphasis variant with values [default, current, suppressed].
- Declare a label-text prop.
- Use a navigate intent and accessible label.
- Build the body from surface, stack, text, and one icon slot.
- Use token references for fill, radius, padding, gap, and text sizing.

Known subset limitations to respect:
- Do not rely on browser reset behavior being generated automatically.
- Do not use unsupported motion output.
- Stay inside the current emitted subset.

Reference target path in this repo:

- `examples/ai-loop/evals/nav-item/target.fl`

Return only the `.fl` source file.
