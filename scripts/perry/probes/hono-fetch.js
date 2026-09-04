import { Hono } from 'hono';

const app = new Hono();
app.get('/', (c) => c.text('PERRY_PROBE_HONO_OK'));

const response = await app.fetch(new Request('http://localhost/'));
console.log(await response.text());
