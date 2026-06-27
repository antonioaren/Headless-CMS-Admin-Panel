import { URL, fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      // dev proxy: /api -> backend, so the SPA talks to Fastify without CORS friction
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000'
    }
  }
})
