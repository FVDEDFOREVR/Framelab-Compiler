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

- id: `toast`
- component: `Toast`
- goal: Generate a compact feedback toast in the current supported subset.

Requirements:
- Declare a tone variant with values [info, success, warning, danger] and default info.
- Declare a message-text prop.
- Use a trigger intent and accessible label based on message-text.
- Build the body from surface, stack, text, and optional slots.
- Use token references for fill, radius, padding, spacing, and text sizing.

Known subset limitations to respect:
- Avoid motion in the reference target because motion is warning-only in the current emitter.
- Keep the component inside the current emitted subset.
- Use diagnostics JSON rather than human-readable stderr for repair.

Reference target path in this repo:

- `examples/ai-loop/evals/toast/target.fl`

Return only the `.fl` source file.
