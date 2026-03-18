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

- id: `input`
- component: `Input`
- goal: Generate a presentational input-like component in the current supported subset.

Requirements:
- Declare a tone variant with values [default, danger] and default default.
- Declare label-text, value-text, and hint-text props.
- Use accessible label and description.
- Build the body from surface, stack, and text nodes.
- Use token references for outline, fill, spacing, and text sizing.

Known subset limitations to respect:
- Treat the component as presentational output, not a native form control.
- Do not invent input-specific runtime behavior.
- Stay inside the current emitted subset.

Reference target path in this repo:

- `examples/ai-loop/evals/input/target.fl`

Return only the `.fl` source file.
