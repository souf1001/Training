// Safe localStorage access: private mode or broken data never crash the app.

export function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeJson(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked: the app keeps working, it just doesn't remember this
  }
}

export function removeKeys(filter: (key: string) => boolean) {
  try {
    Object.keys(localStorage).filter(filter).forEach((key) => localStorage.removeItem(key))
  } catch {
    // nothing to clean up
  }
}
