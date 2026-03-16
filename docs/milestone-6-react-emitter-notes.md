# Milestone 6 Notes

Milestone 6 adds the first React emitter on top of the target-agnostic IR from milestone 5.

IR to React mapping decisions:

- `IRProgram` emits a shared `tokens.css` artifact plus one `.tsx` component file and one `.module.css` file per `IRComponent`.
- `IRSurface` maps to React host elements only at the emitter boundary. The default host is `div`; `surface as article` maps to `article`.
- `IRStack` maps to a `div` with flexbox styling generated in CSS from stack direction, gap, align, justify, and wrap settings.
- `IRText` maps by text role: heading becomes `h1` through `h6` using `IRText.level`, body becomes `p`, label becomes `label`, caption becomes `small`, and other roles currently fall back to `span`.
- `IRSlot` placement compiles to named `slots` props. Slot fallback content is rendered inline at the placement site when no slot content is supplied.
- Variant axes compile to React data attributes (`data-axis`) and CSS Module selectors on the affected node class.
- State blocks compile to CSS selectors. Built-in pseudo states use `:hover`, `:focus-visible`, and `:active`; all other states use `data-state-*` selectors fed by the generated `states` prop bag.
- Accessibility metadata is attached to the emitted root host or intent wrapper via `role`, `aria-label`, `aria-description`, `aria-live`, and `aria-hidden`.
- Token refs remain IR-owned and are consumed mechanically by the emitter as CSS variable references (`var(--token-path)`).

Separation kept in this milestone:

- IR stays target-agnostic. The emitter consumes existing IR nodes and values without mutating IR types to match React-specific shortcuts.
- React host mapping lives only in `src/emitter-react.ts`.
- Styling generation is isolated from JSX generation: CSS module output is derived from node props, states, and variants separately from the TSX tree walk.

What was intentionally deferred:

- Motion runtime behavior. Motion IR is detected, but the emitter currently reports unsupported-output diagnostics instead of inventing a runtime animation system.
- Dynamic CSS generation for prop values that remain symbolic at emit time, such as non-static references inside style-bearing props.
- Broader host-element inference for surface roles beyond the explicit mappings implemented here.
- More advanced React ergonomics such as richer intent callback contracts, slot helper components, or component-level state machines.

Unsupported-output behavior in this milestone:

- Motion blocks produce `RE-UNSUPPORTED-MOTION` warnings and are omitted from emitted CSS/TSX behavior.
- Dynamic or unresolved style-bearing values produce emitter warnings rather than silently guessing a React/CSS mapping.
- Unresolved string references in accessible metadata produce emitter warnings and fall back to `undefined` interpolation markers in generated output.

Doc mismatch discovered:

- The frozen implementation plan describes a fuller React boundary with animation output and richer intent/state semantics. The current implemented validator and IR still leave some cases symbolic, so milestone 6 emits the supported static React/CSS subset and surfaces the remaining cases as explicit emitter warnings instead of moving validation or runtime inference into the emitter.
