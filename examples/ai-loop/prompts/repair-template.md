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

- id: `{{eval_id}}`
- component: `{{component_name}}`
- goal: {{goal}}

Requirements to preserve when possible:
{{requirements}}

Known subset limitations to respect:
{{limitations}}

Source file:

- `{{source_file}}`

Diagnostics file:

- `{{diagnostics_file}}`

Original source:

```fl
{{original_source}}
```

Diagnostics JSON:

```json
{{diagnostics_json}}
```

Return only the repaired `.fl` source file.
