import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Separar React y ReactDOM en su propio chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Separar React Query en su propio chunk
          'query-vendor': ['@tanstack/react-query'],
          // Separar Zustand en su propio chunk
          'state-vendor': ['zustand'],
          // Separar Axios en su propio chunk
          'http-vendor': ['axios'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Aumentar el límite de advertencia a 1000 kB
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:5000',
        changeOrigin: true,
      },
    },
  },
})
