// =============================================================================
// FRAMELAB Runtime — signals.ts
// Minimal reactive primitives: signal, memo, effect, batch
// Zero dependencies. ~150 lines.
// =============================================================================

// ---------------------------------------------------------------------------
// Tracking context
// ---------------------------------------------------------------------------

type EffectFn = () => void
let currentEffect: EffectFn | null = null

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export interface Signal<T> {
  get():  T
  set(value: T): void
  peek(): T
  subscribe(fn: () => void): () => void
}

export function createSignal<T>(initialValue: T): Signal<T> {
  let value = initialValue
  const subscribers = new Set<EffectFn>()

  return {
    get() {
      if (currentEffect !== null) {
        subscribers.add(currentEffect)
      }
      return value
    },

    set(newValue: T) {
      if (Object.is(newValue, value)) return
      value = newValue
      const fns = [...subscribers]
      batch(() => { for (const fn of fns) fn() })
    },

    peek() {
      return value
    },

    subscribe(fn: EffectFn): () => void {
      subscribers.add(fn)
      return () => subscribers.delete(fn)
    },
  }
}

// ---------------------------------------------------------------------------
// Memo
// ---------------------------------------------------------------------------

export interface Memo<T> {
  get():  T
  peek(): T
  subscribe(fn: () => void): () => void
}

export function createMemo<T>(fn: () => T): Memo<T> {
  const inner = createSignal<T>(undefined as unknown as T)

  createEffect(() => {
    inner.set(fn())
  })

  return {
    get()  { return inner.get() },
    peek() { return inner.peek() },
    subscribe(fn) { return inner.subscribe(fn) },
  }
}

// ---------------------------------------------------------------------------
// Effect
// ---------------------------------------------------------------------------

export function createEffect(fn: EffectFn): () => void {
  const wrapped: EffectFn = () => {
    const prev    = currentEffect
    currentEffect = wrapped
    try {
      fn()
    } finally {
      currentEffect = prev
    }
  }
  wrapped()
  return () => { /* cleanup: MVP omits full tracking */ }
}

// ---------------------------------------------------------------------------
// Batch
// ---------------------------------------------------------------------------

let batchDepth = 0
const pendingBatch = new Set<EffectFn>()

export function batch(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      const effects = [...pendingBatch]
      pendingBatch.clear()
      for (const effect of effects) effect()
    }
  }
}

// ---------------------------------------------------------------------------
// Async source
// ---------------------------------------------------------------------------

export type SourceStatus = "idle" | "loading" | "success" | "error"

export interface AsyncSource<T> {
  data:    Memo<T | null>
  status:  Memo<SourceStatus>
  error:   Memo<unknown>
  refresh(): void
}

export function createSource<T>(
  fetcher: () => Promise<T>,
  options: { cacheMs?: number } = {},
): AsyncSource<T> {
  const _data   = createSignal<T | null>(null)
  const _status = createSignal<SourceStatus>("idle")
  const _error  = createSignal<unknown>(null)

  let controller: AbortController | null = null
  let cacheUntil = 0

  function refresh(): void {
    if (options.cacheMs && Date.now() < cacheUntil) return
    controller?.abort()
    controller = new AbortController()
    _status.set("loading")
    fetcher()
      .then(result => {
        _data.set(result)
        _status.set("success")
        if (options.cacheMs) cacheUntil = Date.now() + options.cacheMs
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return
        _error.set(err)
        _status.set("error")
      })
  }

  refresh()

  return {
    data:    createMemo(() => _data.get()),
    status:  createMemo(() => _status.get()),
    error:   createMemo(() => _error.get()),
    refresh,
  }
}

// ---------------------------------------------------------------------------
// React adapter (types only — implementation requires React at runtime)
// ---------------------------------------------------------------------------

export type UseSignalFn = <T>(signal: Signal<T>) => T
export type UseMemoFn   = <T>(memo: Memo<T>) => T

// Emitted components call these via the React useSyncExternalStore hook.
// The actual implementation is injected by the emitter into each component file.
