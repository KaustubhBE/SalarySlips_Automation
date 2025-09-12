import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isDev = mode === 'development'

  // Optional SSL for dev (only if cert files exist)
  const sslKeyPath = '/etc/letsencrypt/live/uatadmin.bajajearths.com/privkey.pem'
  const sslCertPath = '/etc/letsencrypt/live/uatadmin.bajajearths.com/fullchain.pem'
  const httpsConfig = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)
    ? {
        key: fs.readFileSync(sslKeyPath),
        cert: fs.readFileSync(sslCertPath)
      }
    : false

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
      sourcemap: isDev,
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
      minify: !isDev,                                                                                                                                         
      target: 'es2018',                                                                                                                                       
      commonjsOptions: {                                                                                                                                      
        transformMixedEsModules: true,                                                                                                                        
      },                                                                                                                                                      
    },                                                                                                                                                        
    server: isDev                                                                                                                                             
      ? {                                                                                                                                                     
          port: 7081,                                                                                                                                         
          strictPort: true,                                                                                                                                   
          host: '0.0.0.0',                                                                                                                                    
          https: httpsConfig, // Optional: use HTTPS if certs are found                                                                                       
          allowedHosts: ['uatadmin.bajajearths.com'],                                                                                                            
          hmr: {                                                                                                                                              
            protocol: httpsConfig ? 'wss' : 'ws',                                                                                                             
            host: 'uatadmin.bajajearths.com',                                                                                                                    
            port: httpsConfig ? 443 : 7081,                                                                                                                   
          }
        }                                                                                                                                                     
      : undefined,                                                                                                                                            
    preview: {                                                                                                                                                
      port: 7081,                                                                                                                                             
      strictPort: true,                                                                                                                                       
      host: '0.0.0.0'                                                                                                                                         
    },                                                                                                                                                        
    esbuild: {                                                                                                                                                
      loader: 'jsx',                                                                                                                                          
      include: /src\/.*\.jsx?$/,                                                                                                                              
      exclude: [],                                                                                                                                            
      target: 'es2018'                                                                                                                                        
    },                                                                                                                                                        
    define: {                                                                                                                                                 
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