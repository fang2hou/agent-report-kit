import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({ fallback: 'index.html' }),
      output: { bundleStrategy: 'inline' },
      router: { type: 'hash' },
      version: { pollInterval: 0 }
    })
  ]
});
