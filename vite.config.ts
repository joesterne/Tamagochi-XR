import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['production', 'module', 'browser', 'default'],
  },
  optimizeDeps: {
    esbuildOptions: {
      conditions: ['production', 'module', 'browser', 'default'],
    },
  },
});
