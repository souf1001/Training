// What Cloudflare gives the Worker (see wrangler.jsonc) and what we store per request.
export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  PASSWORD_ITERATIONS?: string
}

export interface AppEnv {
  Bindings: Env
  Variables: { userId: number }
}
