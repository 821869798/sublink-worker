// Memory-backed asset fetcher used by the single-file build: assets are
// embedded as base64 at build time instead of being read from public/.
import { embeddedAssets } from 'embedded:assets';

export function createFileAssetFetcher() {
    const byName = new Map(embeddedAssets.map(({ name, base64 }) => [name, Buffer.from(base64, 'base64')]));

    return async (request) => {
        const url = new URL(request.url);
        const name = url.pathname === '/' || url.pathname === '/favicon.ico'
            ? 'favicon.ico'
            : url.pathname.replace(/^\/+/, '').split('/')[0];

        const body = byName.get(name);
        if (!body) return new Response('Not found', { status: 404 });

        return new Response(body, {
            headers: {
                'Content-Type': name.endsWith('.png') ? 'image/png' : 'image/x-icon',
                'Cache-Control': 'public, max-age=86400'
            }
        });
    };
}
