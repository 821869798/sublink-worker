import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { SING_BOX_CONFIG } from '../src/config/index.js';
import { createApp } from '../src/app/createApp.jsx';
import { MemoryKVAdapter } from '../src/adapters/kv/memoryKv.js';

describe('Sing-box 1.14 configuration', () => {
    const vlessUrl = 'vless://12345678-1234-1234-1234-123456789abc@example.com:443?security=tls&sni=example.com#TestVless';

    const createTestApp = () => createApp({
        kv: new MemoryKVAdapter(),
        assetFetcher: null,
        logger: console,
        config: { configTtlSeconds: 60, shortLinkTtlSeconds: null }
    });

    it('generates valid 1.14 config with domain_resolver, http_clients and store_dns by default', async () => {
        const builder = new SingboxConfigBuilder(vlessUrl, 'minimal', [], null, 'zh-CN', null, false);
        const config = await builder.build();

        // Route and HTTP client
        expect(config.route.default_http_client).toBe('rule-set-download');
        expect(config.http_clients).toEqual([{ tag: 'rule-set-download', detour: 'DIRECT' }]);

        // Route default domain resolver
        expect(config.route.default_domain_resolver).toBe('dns_resolver');

        // Remote rule sets should not have legacy download_detour
        config.route.rule_set.forEach(rs => {
            if (rs.type === 'remote') {
                expect(rs).not.toHaveProperty('download_detour');
            }
        });

        // DNS servers and domain resolver
        const dnsProxy = config.dns.servers.find(s => s.tag === 'dns_proxy');
        expect(dnsProxy).toBeDefined();
        expect(dnsProxy.domain_resolver).toBe('dns_resolver');
        expect(dnsProxy.detour).toBe('🚀 节点选择');

        const dnsDirect = config.dns.servers.find(s => s.tag === 'dns_direct');
        expect(dnsDirect).toBeDefined();
        expect(dnsDirect.domain_resolver).toBe('dns_resolver');

        const dnsResolver = config.dns.servers.find(s => s.tag === 'dns_resolver');
        expect(dnsResolver).toBeDefined();

        // DNS rules query_type
        const proxyRule = config.dns.rules.find(r => r.server === 'dns_proxy');
        expect(proxyRule).toBeDefined();
        expect(proxyRule.query_type).toEqual(expect.arrayContaining(['CNAME', 'HTTPS', 'SVCB']));

        // Cache file
        expect(config.experimental.cache_file.store_dns).toBe(true);
        expect(config.experimental.cache_file.store_fakeip).toBe(true);
    });

    it('GET /singbox returns 1.14 config as default without version query parameter', async () => {
        const app = createTestApp();
        const res = await app.request(`http://localhost/singbox?config=${encodeURIComponent(vlessUrl)}`);
        expect(res.status).toBe(200);
        const config = await res.json();

        expect(config.route.default_http_client).toBe('rule-set-download');
        expect(config.http_clients).toBeDefined();
        expect(config.route.default_domain_resolver).toBe('dns_resolver');
    });
});
