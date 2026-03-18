import React from "react"
import styles from "./NavItem.module.css"

type NavItemEmphasisVariant = "default" | "current" | "suppressed"

interface NavItemSlots {
  icon?: React.ReactNode
}

interface NavItemProps {
  emphasis?: NavItemEmphasisVariant
  labelText?: string
  slots?: NavItemSlots
  states?: Record<string, boolean | undefined>
  href?: string
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

export function NavItem(props: NavItemProps): React.ReactElement {
  const { emphasis = "default", labelText = "", slots, states, href = "#" } = props
  const variantAttrs = {
    "data-emphasis": emphasis,
  }
  const stateAttrs = buildStateAttrs(states)

  return (
    <a
      className={styles.intent}
      data-intent="nav-item"
      aria-label={`${labelText}`}
      href={href}
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
            {labelText}
          </span>
        </div>
      </div>
    </a>
  )
}

export default NavItem