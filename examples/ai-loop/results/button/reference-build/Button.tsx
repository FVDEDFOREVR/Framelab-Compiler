import React from "react"
import styles from "./Button.module.css"

type ButtonToneVariant = "primary" | "ghost" | "danger"

interface ButtonProps {
  tone?: ButtonToneVariant
  labelText?: string
  states?: Record<string, boolean | undefined>
  onIntent?: (identifier: string) => void
}

function buildStateAttrs(states?: Record<string, boolean | undefined>): Record<string, string | undefined> {
  const attrs: Record<string, string | undefined> = {}
  for (const [name, enabled] of Object.entries(states ?? {})) {
    if (enabled) {
      attrs[`data-state-${name}`] = "true"
    }
  }
  return attrs
}

export function Button(props: ButtonProps): React.ReactElement {
  const { tone = "primary", labelText = "Button", states, onIntent } = props
  const variantAttrs = {
    "data-tone": tone,
  }
  const stateAttrs = buildStateAttrs(states)

  return (
    <button
      className={styles.intent}
      data-intent="button-action"
      role="button"
      aria-label={`${labelText}`}
      type="button"
      onClick={onIntent ? () => onIntent("button-action") : undefined}
    >
      <div
        className={styles.root}
        {...variantAttrs}
        {...stateAttrs}
      >
        <span
          className={styles.node1}
          {...variantAttrs}
          {...stateAttrs}
        >
          {labelText}
        </span>
      </div>
    </button>
  )
}

export default Button