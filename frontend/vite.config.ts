import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: '/GoalScheduleSystem/',
  server: {
    port: 3201,
    proxy: {
      '/api': {
        target: 'http://localhost:3200',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
