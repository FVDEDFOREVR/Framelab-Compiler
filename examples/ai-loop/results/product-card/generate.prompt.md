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

- id: `product-card`
- component: `ProductCard`
- goal: Generate a navigable product card with slots for thumbnail and actions.

Requirements:
- Declare title-text, category-text, and price-text props.
- Use a navigate intent and accessible label based on title-text.
- Build the body from surface, stack, text, and slot nodes.
- Use token references for fill, radius, padding, and text sizing.
- Keep slot placement explicit for thumbnail and actions.

Known subset limitations to respect:
- Do not infer unsupported host behavior beyond the current emitter.
- Do not use unsupported motion output.
- Stay inside the current supported subset.

Reference target path in this repo:

- `examples/ai-loop/evals/product-card/target.fl`

Return only the `.fl` source file.
