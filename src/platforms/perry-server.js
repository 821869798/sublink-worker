import { serve } from '@perryts/hono-server';
import { createApp } from '../app/createApp.jsx';
import { MemoryKVAdapter } from '../adapters/kv/memoryKv.js';

const port = 8787;
const logger = console;
const app = createApp({
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger
});

serve({ fetch: app.fetch, port }, ({ address }) => {
    logger.info(`Sublink worker running on ${address}`);
});
