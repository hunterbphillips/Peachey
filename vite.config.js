import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` makes the real app.
// `npm run build:demo` makes a single self-contained HTML file with sample data.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'demo' ? [react(), viteSingleFile()] : [react()],
  define: mode === 'demo' ? { 'import.meta.env.VITE_FORCE_DEMO': '"1"' } : {},
  build: mode === 'demo' ? { outDir: 'dist-demo' } : {},
}));
