import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'recharts-es-toolkit-esm',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replace(/\\/g, '/').includes('/recharts/')) return

        // The per-function compat entries are CommonJS. Use the same helpers
        // from the ESM barrel to avoid a Vite 8 runtime initialization crash.
        // https://github.com/recharts/recharts/issues/7376
        const updated = code.replace(
          /import\s+([\w$]+)\s+from\s+(['"])es-toolkit\/compat\/([\w$]+)\2\s*;?/g,
          (_, localName, _quote, exportName) =>
            `import { ${exportName} as ${localName} } from 'es-toolkit/compat';`,
        )
        if (updated !== code) return { code: updated, map: null }
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
  },
})
