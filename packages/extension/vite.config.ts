import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'process.env.VITE_WS_URL': JSON.stringify(env.VITE_WS_URL),
    },
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          background: path.resolve(__dirname, 'src/background/index.ts'),
          content: path.resolve(__dirname, 'src/content/index.ts'),
          overlay: path.resolve(__dirname, 'src/overlay/index.tsx'),
          popup: path.resolve(__dirname, 'src/popup/index.html'),
        },
        output: {
          entryFileNames: `src/[dir]/[name].js`,
          chunkFileNames: `src/chunks/[name].js`,
          assetFileNames: `src/[dir]/[name].[ext]`,
        },
      },
    },
  };
});
