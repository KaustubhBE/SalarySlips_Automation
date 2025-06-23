import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    base: '/',
    plugins: [react()],
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src'),
        'crypto': 'crypto-browserify',
        'stream': 'stream-browserify',
        'buffer': 'buffer',
        'process': 'process/browser',
        'config': '/app/src/config.js'
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: mode === 'development',
      assetsDir: 'assets',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'axios']
          },
          assetFileNames: (assetInfo) => {
            if (assetInfo.name.endsWith('.css')) {
              return 'assets/css/[name][extname]';
            }
            return 'assets/[name][extname]';
          },
          chunkFileNames: 'assets/js/[name].js',
          entryFileNames: 'assets/js/[name].js',
        },
      },
      minify: mode === 'production',
      target: 'es2018',
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    server: {
      port: 3000,
      strictPort: true,
      host: 'localhost'
    },
    preview: {
      port: 3000,
      strictPort: true,
      host: 'localhost'
    },
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
      target: 'es2018'
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'global': 'globalThis'
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      },
      include: ['react', 'react-dom', 'react-router-dom'],
    }
  }
})
