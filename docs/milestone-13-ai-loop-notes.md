# Milestone 13 Notes

Milestone 13 adds a narrow AI authoring and repair loop for the current supported FrameLab subset.

Generation contract:

- Generation uses a prompt template that asks for one complete `.fl` file only.
- The prompt explicitly targets the current supported subset rather than the full frozen spec.
- The prompt prefers build-clean output and tells the model to avoid unsupported motion unless a case explicitly asks for warning-producing output.

Repair contract:

- Repair uses diagnostics JSON as the authoritative machine interface.
- Repair prompts request a full corrected `.fl` file, not a diff.
- Repair prioritizes errors first and warnings second.
- Repair is constrained to the current supported subset and should remove unsupported motion instead of expecting runtime support.

Eval cases:

- `button`
- `product-card`
- `input`
- `nav-item`
- `toast`

Each eval case includes:

- a machine-readable case manifest
- a reference `target.fl`

Observed limitations:

- The loop works best for components that fit the emitted subset built from `surface`, `stack`, `text`, `slot`, `accessible`, `intent`, `state`, and `variant`.
- `Input` remains presentational output rather than native form behavior, so prompts and repairs must not infer native input semantics.
- Motion is still warning-only in the emitter, so generation prompts should avoid motion for build-clean results unless the task explicitly wants to exercise warning behavior.
- The helper script does not call an LLM directly; it assembles prompts and wraps the existing CLI so the loop stays local, deterministic, and thin.
