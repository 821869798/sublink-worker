import { createApp } from '../app/createApp.jsx';
import { MemoryKVAdapter } from '../adapters/kv/memoryKv.js';
import { spawn } from 'child_process';
import { startNodeHttpServer } from './nodeHttpServer.js';

const port = Number(process.env.PORT || 8787);
const logger = console;
const app = createApp({
    kv: new MemoryKVAdapter(),
    assetFetcher: null,
    logger
});

startNodeHttpServer(app, { port, logger });

if (process.env.SUBLINK_NO_OPEN_BROWSER !== 'true') {
    setTimeout(() => openBrowser(`http://127.0.0.1:${port}`), 500);
}

function openBrowser(url) {
    const commands = {
        win32: ['cmd', ['/c', 'start', '', url]],
        darwin: ['open', [url]],
        linux: ['xdg-open', [url]]
    };
    const [command, args] = commands[process.platform] || commands.linux;
    const child = spawn(command, args, { detached: true, stdio: 'ignore' });
    child.on('error', (error) => logger.warn?.(`Open ${url} manually`, error));
    child.unref();
}
