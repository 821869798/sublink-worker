import { createApp } from '../app/createApp.jsx';
import { MemoryKVAdapter } from '../adapters/kv/memoryKv.js';
import { startNodeHttpServer } from './nodeHttpServer.js';

const port = Number(process.env.PORT || 8787);
const logger = console;
const app = createApp({
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger
});

startNodeHttpServer(app, { port, logger });
