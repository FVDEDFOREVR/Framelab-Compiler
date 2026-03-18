import React from "react"
import styles from "./Toast.module.css"

type ToastToneVariant = "info" | "success" | "warning" | "danger"

interface ToastSlots {
  action?: React.ReactNode
  icon?: React.ReactNode
}

interface ToastProps {
  tone?: ToastToneVariant
  messageText?: string
  slots?: ToastSlots
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

export function Toast(props: ToastProps): React.ReactElement {
  const { tone = "info", messageText = "", slots, states, onIntent } = props
  const variantAttrs = {
    "data-tone": tone,
  }
  const stateAttrs = buildStateAttrs(states)

  return (
    <button
      className={styles.intent}
      data-intent="dismiss-toast"
      aria-label={`${messageText}`}
      type="button"
      onClick={onIntent ? () => onIntent("dismiss-toast") : undefined}
    >
      <div
        className={styles.root}
        {...variantAttrs}
        {...stateAttrs}
      >
        <div
          className={styles.node1}
          {...variantAttrs}
          {...stateAttrs}
        >
          {slots?.icon ?? null}
          <span
            className={styles.node2}
            {...variantAttrs}
            {...stateAttrs}
          >
            {messageText}
          </span>
          {slots?.action ?? null}
        </div>
      </div>
    </button>
  )
}

export default Toast