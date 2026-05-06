import path from "path"
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Fallback: cuando VITE_API_URL no está seteado, las requests a /api/*
      // se reenvían al nginx (TLS 1.3) corriendo en https://localhost.
      // `secure: false` acepta el cert auto-firmado del nginx local.
      '/api': {
        target: 'https://localhost',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
