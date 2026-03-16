import React from "react"
import styles from "./Toast.module.css"

interface ToastProps {
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

export function Toast(props: ToastProps): React.ReactElement {
  const { states } = props
  const variantAttrs = {
  }
  const stateAttrs = buildStateAttrs(states)

  return (
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
        {"Saved"}
      </span>
    </div>
  )
}

export default Toast