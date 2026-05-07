import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
  },
  optimizeDeps: {
    exclude: ["@imgly/background-removal"],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
})
