import { createServer } from 'node:http';

export function startPerryHttpServer(app, { port = 8787, logger = console } = {}) {
    const server = createServer((req, res) => {
        handleRequest(app, req, res).catch((error) => {
            logger.error('Perry HTTP server error', error);
            res.statusCode = 500;
            res.end('Internal Server Error');
        });
    });

    server.listen(port);
    logger.info(`Sublink worker running on http://0.0.0.0:${port}`);
    return server;
}

async function handleRequest(app, req, res) {
    const method = req.method || 'GET';
    const host = req.headers.host || 'localhost';
    const headers = new Headers();

    for (const key of Object.keys(req.headers)) {
        const value = req.headers[key];
        if (value !== undefined) headers.set(key, String(value));
    }

    const init = { method, headers };
    if (method !== 'GET' && method !== 'HEAD') {
        init.body = await readBody(req);
    }

    const request = new Request(`http://${host}${req.url || '/'}`, init);
    const response = await app.fetch(request);
    res.statusCode = response.status;

    response.headers.forEach((value, key) => {
        res.setHeader(key, value);
    });

    if (!response.body) {
        res.end();
        return;
    }

    const body = new Uint8Array(await response.arrayBuffer());
    res.end(body);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            let size = 0;
            for (const chunk of chunks) size += chunk.length;
            const body = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                body.set(chunk, offset);
                offset += chunk.length;
            }
            resolve(body);
        });
        req.on('error', reject);
    });
}
