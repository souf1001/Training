import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

// Writes the list of built files and a version into dist/sw.js,
// so the service worker can save the whole app for offline use.
function serviceWorker(): Plugin {
  let files: string[] = []
  return {
    name: 'forma-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      files = Object.keys(bundle).map((name) => `/${name}`)
    },
    closeBundle() {
      const precache = [...files.filter((f) => !f.endsWith('.html')), '/manifest.webmanifest', '/theme.js', '/icons/icon-192.png']
      const version = createHash('sha256').update(files.sort().join()).digest('hex').slice(0, 10)
      const file = path.resolve('dist/sw.js')
      const code = readFileSync(file, 'utf8')
        .replace('__VERSION__', version)
        .replace('self.__PRECACHE__ || []', JSON.stringify(precache))
      writeFileSync(file, code)
    },
  }
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  server: {
    // during development the Worker (API) runs on port 8787
    proxy: { '/api': 'http://localhost:8787' },
  },
})
