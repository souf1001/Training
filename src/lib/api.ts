// Small helper for talking to our own server.

export class ApiError extends Error {
  status: number // 0 = no connection
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Fired when the server says the session is gone (e.g. logged out on another device).
export const UNAUTHORIZED_EVENT = 'forma:unauthorized'

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'Keine Verbindung. Bist du online?')
  }
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !url.startsWith('/auth/')) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  if (!res.ok) throw new ApiError(res.status, data.error ?? `Fehler ${res.status}`)
  return data as T
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body ?? {}),
  put: <T>(url: string, body: unknown) => request<T>('PUT', url, body),
  delete: <T>(url: string, body?: unknown) => request<T>('DELETE', url, body),
}
