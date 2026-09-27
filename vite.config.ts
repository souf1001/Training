import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // the exercise and food tables are bundled on purpose (they work offline)
  build: { chunkSizeWarningLimit: 800 },
  server: {
    // during development the API runs on port 3000
    proxy: { '/api': 'http://localhost:3000' },
  },
})
