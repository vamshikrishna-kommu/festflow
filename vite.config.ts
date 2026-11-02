import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/ - FestFlow
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/three')) {
            return 'vendor-three'
          }
          if (id.includes('node_modules/exceljs')) {
            return 'vendor-excel'
          }
          if (id.includes('node_modules/html5-qrcode')) {
            return 'vendor-qrcode'
          }
          if (
            id.includes('node_modules/motion') ||
            id.includes('node_modules/@gsap') ||
            id.includes('node_modules/gsap')
          ) {
            return 'vendor-animations'
          }
          if (id.includes('node_modules/@supabase')) {
            return 'vendor-supabase'
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router')
          ) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
