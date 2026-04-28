/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ui': path.resolve(__dirname, './src/components_ui/ui'),
      '@mintara/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
  },
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.PORT ?? 3001}`,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
  },
})
