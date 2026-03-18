# Milestone 16 Notes

Milestone 16 adds a repeatable local results format for the existing AI authoring and repair loop.

Results structure:

- `examples/ai-loop/results/README.md`
- `examples/ai-loop/results/summary.json`
- `examples/ai-loop/results/<eval-id>/run.json`
- `examples/ai-loop/results/<eval-id>/generate.prompt.md`
- `examples/ai-loop/results/<eval-id>/reference-target.fl`
- `examples/ai-loop/results/<eval-id>/reference-check.*`
- `examples/ai-loop/results/<eval-id>/reference-build/`
- `examples/ai-loop/results/<eval-id>/reference-build.*`

Workflow helper:

- `scripts/ai-loop-results.mjs init --all`
- `scripts/ai-loop-results.mjs record-generated <eval-id> --source <path>`
- `scripts/ai-loop-results.mjs record-repaired <eval-id> --source <path>`
- `scripts/ai-loop-results.mjs summarize`

Recorded state in this milestone:

- all 5 eval cases have initialized local result directories
- reference baselines are recorded for all 5 eval targets
- generated and repaired model outputs remain manual and are currently scaffolded as pending

Summary from checked-in results:

- first-pass success rate: `0 / 5` recorded generated runs
- repair-pass success rate: `0 / 5` recorded repaired runs
- reference baseline success rate: `5 / 5`
- common failure codes: none recorded yet
- common drift patterns: none recorded yet

Interpretation:

- The results format is now repeatable and local.
- The manual model step remains explicit rather than hidden inside repository scripts.
- The current checked-in summary should be read as scaffold state plus reference baseline, not as a claim that model generations were executed automatically in-repo.

Common limitations:

- actual model generation and repair remain manual
- no failure-code or drift-pattern aggregation is available until generated or repaired drafts have been recorded
- the loop still targets the current supported subset only
