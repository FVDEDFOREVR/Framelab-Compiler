import React from "react"
import styles from "./ProductCard.module.css"

interface ProductCardSlots {
  actions?: React.ReactNode
  thumbnail?: React.ReactNode
}

interface ProductCardProps {
  titleText?: string
  categoryText?: string
  priceText?: string
  slots?: ProductCardSlots
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

export function ProductCard(props: ProductCardProps): React.ReactElement {
  const { titleText = "", categoryText = "", priceText = "", slots, states, href = "#" } = props
  const variantAttrs = {
  }
  const stateAttrs = buildStateAttrs(states)

  return (
    <a
      className={styles.intent}
      data-intent="product-detail"
      role="article"
      aria-label={`${titleText}`}
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
          {slots?.thumbnail ?? null}
          <div
            className={styles.node2}
            {...variantAttrs}
            {...stateAttrs}
          >
            <span
              className={styles.node3}
              {...variantAttrs}
              {...stateAttrs}
            >
              {categoryText}
            </span>
            <span
              className={styles.node4}
              {...variantAttrs}
              {...stateAttrs}
            >
              {titleText}
            </span>
            <span
              className={styles.node5}
              {...variantAttrs}
              {...stateAttrs}
            >
              {priceText}
            </span>
          </div>
          {slots?.actions ?? null}
        </div>
      </div>
    </a>
  )
}

export default ProductCard