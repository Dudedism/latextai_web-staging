import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Security: Block dev server from serving sensitive files
    fs: {
      deny: [
        '**/.env*',
        '**/docker-compose.yml',
        '**/docker-compose.yaml',
        '**/Dockerfile',
        '**/.dockerignore',
        '**/.git/**',
        '**/.gitignore',
        '**/*.md',
        '**/*.sh',
        '**/package.json',
        '**/package-lock.json',
        '**/tsconfig*.json',
        '**/vite.config.ts',
        '**/eslint.config.js',
      ]
    }
  }
})
