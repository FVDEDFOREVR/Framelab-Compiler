# AI Loop Results

This directory stores repeatable local eval runs for the FrameLab AI authoring and repair loop.

Each eval directory may contain:

- `generate.prompt.md`
- `reference-target.fl`
- `reference-check.diagnostics.json`
- `reference-check.result.json`
- `reference-build/`
- `reference-build.diagnostics.json`
- `reference-build.result.json`
- `generated.fl`
- `generated.diagnostics.json`
- `generated.check.result.json`
- `repair.prompt.md`
- `repaired.fl`
- `repaired.diagnostics.json`
- `repaired.check.result.json`
- `repaired-build/`
- `repaired.build.diagnostics.json`
- `repaired.build.result.json`
- `run.json`

Generated and repaired files are manual until explicitly recorded through `scripts/ai-loop-results.mjs`.
