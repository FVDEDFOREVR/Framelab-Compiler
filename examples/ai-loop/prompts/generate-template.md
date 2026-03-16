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

- id: `{{eval_id}}`
- component: `{{component_name}}`
- goal: {{goal}}

Requirements:
{{requirements}}

Known subset limitations to respect:
{{limitations}}

Reference target path in this repo:

- `{{reference_output_path}}`

Return only the `.fl` source file.
