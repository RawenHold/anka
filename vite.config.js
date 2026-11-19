import { defineConfig } from 'vite';
import { liveChannelMiddleware, startChannelRefresh } from './scripts/channel-refresh.mjs';

export default defineConfig({
  base: './',
  plugins: [{
    name: 'anka-channel-refresh',
    configureServer(server) {
      const stop = startChannelRefresh();
      server.httpServer?.once('close', stop);
    },
    configurePreviewServer(server) {
      server.middlewares.use(liveChannelMiddleware());
      const stop = startChannelRefresh();
      server.httpServer?.once('close', stop);
    },
  }],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'channel-catalog', test: /src[\\/]data[\\/]channel-catalog\.json/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'map', test: /node_modules[\\/]leaflet[\\/]/ },
          ],
        },
      },
    },
  },
  esbuild: {
    jsx: 'automatic'
  }
});
