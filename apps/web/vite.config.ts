import { defineConfig, type ViteDevServer } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  base: process.env.PAGES_BASE || '/',
  plugins: [{ name: 'spatial-review-discovery-cors', configureServer: discoveryCors, configurePreviewServer: discoveryCors }],
  worker: { format: 'es' },
  define: { __SPATIAL_REVIEW_BUILD_ID__: JSON.stringify(`fly-escape-${process.env.VERCEL_GIT_COMMIT_SHA ?? 'local'}-${Date.now()}`) },
  build: {
    target: 'es2022',
    rolldownOptions: { input: {
      game: fileURLToPath(new URL('./index.html', import.meta.url)),
      review: fileURLToPath(new URL('./spatial-review.html', import.meta.url)),
    } },
  },
});

function discoveryCors(server: Pick<ViteDevServer, 'middlewares'>) {
  server.middlewares.use((request, response, next) => {
    if (/^\/\.well-known\/spatial-review(?:-turn-the-corner)?\.json$/.test(request.url?.split('?')[0] ?? ''))
      response.setHeader('Access-Control-Allow-Origin', 'https://spatial-review.alterno.dev');
    next();
  });
}
