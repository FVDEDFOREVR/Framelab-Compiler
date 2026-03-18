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

- id: `button`
- component: `Button`
- goal: Generate a compact action button in the current supported subset.

Requirements:
- Declare a tone variant with values [primary, ghost, danger] and default primary.
- Declare a label-text prop with a string default.
- Use an intent trigger and an accessible label.
- Build the body from surface and text nodes only.
- Use token references for fill, radius, padding, text color, and text size.

Known subset limitations to respect:
- Do not rely on unsupported motion output.
- Do not use dot-path @ references.
- Keep the output inside the emitted React/CSS subset.

Reference target path in this repo:

- `examples/ai-loop/evals/button/target.fl`

Return only the `.fl` source file.
