import { createApp } from '../app/createApp.jsx';
import { MemoryKVAdapter } from '../adapters/kv/memoryKv.js';
import { startNodeHttpServer } from './nodeHttpServer.js';

console.log('[perry] entry loaded');

const port = 8797;
const logger = console;
console.log('[perry] creating runtime');
const kv = new MemoryKVAdapter();
console.log('[perry] creating app');
const app = createApp({ kv, assetFetcher: null, logger });
console.log('[perry] starting HTTP server');
startNodeHttpServer(app, { port, logger });
console.log('[perry] HTTP server started');
