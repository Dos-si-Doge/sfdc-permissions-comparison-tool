import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sfCliDevPlugin } from './server/vitePlugin';

export default defineConfig({
  base: './',
  plugins: [react(), sfCliDevPlugin()],
});
