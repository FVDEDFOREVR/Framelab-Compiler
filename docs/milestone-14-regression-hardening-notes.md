# Milestone 14 Notes

Milestone 14 hardens the currently supported subset through additional regression coverage rather than new language or emitter scope.

Newly locked-down behavior:

- slot-heavy emitted output is now covered with a `ProductCard` regression fixture
- intent and accessibility mapping for navigate/article cases is covered through emitted output and end-to-end build artifacts
- presentational `Input` behavior is locked down in both emitter coverage and build-time assertions
- state and variant CSS output for the supported `Input` subset is now covered explicitly
- unsupported motion remains locked down as an explicit warning path

Unsupported cases made explicit:

- motion still emits `RE-UNSUPPORTED-MOTION` warnings rather than inferred runtime behavior
- `Input` still emits presentational React/HTML output rather than native `<input>` semantics
- unsupported behavior is treated as warning/error output, not as hidden emitter inference

Regression-driven additions:

- emitter fixtures now cover:
  - slots
  - navigate intent and accessibility mapping
  - presentational `Input`
  - states and variants in emitted CSS
- end-to-end fixtures now cover:
  - slot-heavy build output
  - presentational `Input` build output
- AI eval targets are now build-validated, not just `check`-validated

Areas intentionally still deferred:

- runtime motion systems
- native form-control emission
- broader inferred interactivity beyond the current supported subset
