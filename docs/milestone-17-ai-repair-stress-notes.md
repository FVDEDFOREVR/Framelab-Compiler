# Milestone 17 Notes

Milestone 17 adds a small stress-case eval layer for the existing AI authoring and repair loop.

New stress-case evals:

- `button-overreach`
- `product-card-overreach`
- `input-native-semantics`

These cases exist because the checked-in milestone 16 eval set mostly demonstrated first-pass generation success across a narrow supported subset, but it did not put meaningful pressure on the diagnostics-guided repair step.

## Why These Cases Exist

- They create controlled prompt pressure toward unsupported or over-broad output without changing the language or the supported subset.
- They keep the current AI loop format unchanged: each case still uses `evals/<id>/case.json` plus `evals/<id>/target.fl`.
- They make repair-loop evaluation explicit without faking model outputs or pre-recording results.

## What They Are Intended To Test

- `button-overreach`
  - Tests whether diagnostics can steer an icon-plus-label button back from invented button behavior, unsupported motion, or alternate syntax.
- `product-card-overreach`
  - Tests whether diagnostics can steer a product card back from nested or multiple action behavior to a single supported navigable card structure.
- `input-native-semantics`
  - Tests whether diagnostics can steer an input-like component away from invented native form semantics and back to presentational output.

Across all three cases, the intended focus is the same:

- generation may overreach
- diagnostics JSON should expose the overreach in stable machine-readable form
- repair should preserve the component goal while removing unsupported behavior

## Successful Repair-Loop Outcome

A successful outcome for these stress cases is:

- the initial generated draft may fail `check` or produce warnings for unsupported behavior
- the repair prompt uses diagnostics JSON rather than human-readable stderr as the authoritative signal
- the repaired draft stays within the current supported subset
- the repaired draft preserves the original UI goal as far as the subset allows
- the repaired draft reaches clean diagnostics, or at minimum removes the unsupported overreach that triggered the stress case

This milestone does not claim that the new stress cases already have recorded model results. It only defines the eval artifacts and usage guidance needed to run those repair-focused experiments manually.
