import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import dotenv from 'dotenv';

// Load .env from monorepo root so we can read PORT
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const BACKEND_PORT = process.env.PORT || '3000';
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': BACKEND_URL,
      '/ws': {
        target: BACKEND_URL,
        ws: true,
      },
    },
  },
});
