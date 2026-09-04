import { serve } from '@perryts/hono-server';
import { Hono } from 'hono';

const app = new Hono();
app.get('/', (c) => c.text('PERRY_PROBE_SERVER_OK'));

serve({ fetch: app.fetch, port: 8798 }, ({ address }) => {
    console.log(`PERRY_PROBE_SERVER_READY ${address}`);
});
