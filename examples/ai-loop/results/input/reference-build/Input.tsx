import React from "react"
import styles from "./Input.module.css"

type InputToneVariant = "default" | "danger"

interface InputProps {
  tone?: InputToneVariant
  labelText?: string
  valueText?: string
  hintText?: string
  states?: Record<string, boolean | undefined>
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

export function Input(props: InputProps): React.ReactElement {
  const { tone = "default", labelText = "", valueText = "", hintText = "", states } = props
  const variantAttrs = {
    "data-tone": tone,
  }
  const stateAttrs = buildStateAttrs(states)

  return (
    <div
      className={styles.root}
      {...variantAttrs}
      {...stateAttrs}
      aria-label={`${labelText}`}
      aria-description={`${hintText}`}
    >
      <div
        className={styles.node1}
        {...variantAttrs}
        {...stateAttrs}
      >
        <span
          className={styles.node2}
          {...variantAttrs}
          {...stateAttrs}
        >
          {labelText}
        </span>
        <span
          className={styles.node3}
          {...variantAttrs}
          {...stateAttrs}
        >
          {valueText}
        </span>
        <span
          className={styles.node4}
          {...variantAttrs}
          {...stateAttrs}
        >
          {hintText}
        </span>
      </div>
    </div>
  )
}

export default Input