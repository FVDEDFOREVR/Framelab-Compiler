# AI Authoring Loop

This directory defines a narrow FrameLab authoring and repair loop for the current v0.1 alpha supported subset.

It does not assume Figma, runtime inference, or the full frozen language surface.

## What Is Here

- `prompts/generate-template.md`
- `prompts/repair-template.md`
- `evals/<id>/case.json`
- `evals/<id>/target.fl`
- `../../scripts/ai-loop.mjs`

## Eval IDs

- `button`
- `product-card`
- `input`
- `nav-item`
- `toast`

## Lightweight Workflow

1. Generate a prompt for one eval:

```bash
node scripts/ai-loop.mjs prompt generate button > /tmp/button-generate.prompt.md
```

2. Send that prompt to an AI model and save the returned FrameLab source:

```bash
mkdir -p /tmp/framelab-ai
$EDITOR /tmp/framelab-ai/button.fl
```

3. Run machine-readable validation and capture diagnostics JSON:

```bash
node scripts/ai-loop.mjs check /tmp/framelab-ai/button.fl --diagnostics-out /tmp/framelab-ai/button.diagnostics.json
```

4. If diagnostics need repair, generate a repair prompt:

```bash
node scripts/ai-loop.mjs prompt repair button \
  --file /tmp/framelab-ai/button.fl \
  --diagnostics /tmp/framelab-ai/button.diagnostics.json \
  > /tmp/framelab-ai/button-repair.prompt.md
```

5. Send the repair prompt to an AI model, overwrite the `.fl` file, and rerun `check`.

6. When `check` is clean enough for the current task, run build:

```bash
node scripts/ai-loop.mjs build /tmp/framelab-ai/button.fl \
  --out-dir /tmp/framelab-ai/build \
  --diagnostics-out /tmp/framelab-ai/build.diagnostics.json
```

## Supported-Subset Guidance

This loop works best when prompts stay inside the currently emitted subset:

- `surface`
- `stack`
- `text`
- `slot`
- `accessible`
- `intent`
- `state`
- `variant`
- token references

Current limits that matter for AI usage:

- motion is warning-only in the emitter
- `Input`-style output is presentational, not native form control behavior
- the repair interface is the diagnostics JSON contract, not human-readable stderr
