# Milestone 16 AI Eval Results

This document records the first checked-in AI eval pass from the local results tree under `examples/ai-loop/results/`.

## Observed Results

Recorded summary from [examples/ai-loop/results/summary.json](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/summary.json):

- first-pass success rate: `5 / 5`
- repair-pass success rate: `0 / 5`
- reference baseline success rate: `5 / 5`
- common failure codes: none recorded
- common drift patterns: none recorded

Per-case `run.json` files for:

- [button](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/button/run.json)
- [product-card](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/product-card/run.json)
- [nav-item](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/nav-item/run.json)
- [toast](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/toast/run.json)
- [input](/Users/tars/Desktop/framelab-compiler/examples/ai-loop/results/input/run.json)

all record:

- `generated.status = "clean"`
- `repaired.status = "pending-manual"`
- `referenceBaseline.status = "build-clean"`

## Interpretation

- Claude-generated `.fl` in the recorded eval runs passed `check` and `build` across the current five-case eval set.
- The current generation prompts and the current supported subset are aligned closely enough for this eval set.
- Repair was not needed or exercised in the recorded pass, so repair-pass success is `0 / 5` by absence of executed repair runs, not by repair failure.
- Motion remains warning-only where applicable in the current compiler, but the checked-in eval pass did not require motion-bearing repaired outputs.
- `Input` remains presentational output rather than native form behavior, and the clean eval result for `input` should be read within that current limitation.

## What This Proves

The recorded run proves that the current prompt set, results workflow, and supported subset are sufficient for this five-case eval set:

- `button`
- `product-card`
- `input`
- `nav-item`
- `toast`

It does not prove broader language coverage or general-purpose repair performance.

## Next Questions

- intentional repair-loop testing: add runs that deliberately start from invalid or warning-bearing `.fl` so repair behavior is measured directly
- designer-facing workflow simplification: reduce the manual file-handling steps around prompts, generated source, and recorded results
- future comparison against direct React generation: compare the current FrameLab loop against a same-prompt direct React baseline using the same five eval cases
