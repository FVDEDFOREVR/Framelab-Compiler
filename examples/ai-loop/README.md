# AI Authoring Loop

This directory defines a narrow FrameLab authoring and repair loop for the current v0.1 alpha supported subset.

It does not assume Figma, runtime inference, or the full frozen language surface.

## What Is Here

- `prompts/generate-template.md`
- `prompts/repair-template.md`
- `evals/<id>/case.json`
- `evals/<id>/target.fl`
- `results/`
- `../../scripts/ai-loop.mjs`
- `../../scripts/ai-loop-results.mjs`

## Eval IDs

- `button`
- `button-overreach`
- `product-card`
- `product-card-overreach`
- `input`
- `input-native-semantics`
- `nav-item`
- `toast`

The `*-overreach` and `*-native-semantics` cases are stress cases. They stay inside the same manifest-plus-`target.fl` structure as the baseline evals, but their briefs are written to tempt model output into unsupported behavior so the diagnostics-guided repair path gets exercised.

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

## Results Workflow

Initialize the local results scaffold for all evals:

```bash
node scripts/ai-loop-results.mjs init --all
```

Record a generated draft after a manual model step:

```bash
node scripts/ai-loop-results.mjs record-generated button --source /tmp/framelab-ai/button.fl
```

Record a repaired draft after a manual repair step:

```bash
node scripts/ai-loop-results.mjs record-repaired button --source /tmp/framelab-ai/button-repaired.fl
```

Refresh the aggregate summary:

```bash
node scripts/ai-loop-results.mjs summarize
```

The checked-in `results/` tree includes:

- reference baseline check/build results for each eval target
- per-eval `run.json` status files
- aggregate `results/summary.json`

Generated and repaired files remain manual until explicitly recorded.

## Stress-Case Usage

Use the three stress cases when you want to evaluate repair behavior rather than first-pass generation quality:

- `button-overreach`
- `product-card-overreach`
- `input-native-semantics`

Recommended usage pattern:

1. Run the generate prompt for one stress case and capture the model's first `.fl` output exactly as returned.
2. Run `check` with `--diagnostics-out` and treat the diagnostics JSON as the repair input contract.
3. Generate a repair prompt from that diagnostics file and capture the repaired `.fl` output exactly as returned.
4. Rerun `check`, then `build` only if the repaired file is clean enough for the current pass.
5. Record generated or repaired files only when they were produced manually; do not prefill `results/` with invented outputs.

What these stress cases are for:

- `button-overreach` pressures models toward unsupported button behavior, extra styling behavior, or alternate syntax around an icon-plus-label button.
- `product-card-overreach` pressures models toward multiple actions, nested intent behavior, or richer card semantics than the current subset supports.
- `input-native-semantics` pressures models toward native form-control semantics that the current emitted subset does not provide.

What to count as success:

- A first-pass failure is acceptable if the diagnostics are concrete and the repair prompt can use them to converge.
- A successful repair outcome preserves the original component goal while removing unsupported behavior and returning to the current supported subset.
- These stress cases are not baseline pass-rate claims; they are intentional pressure tests for the diagnostics-guided repair loop.

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
