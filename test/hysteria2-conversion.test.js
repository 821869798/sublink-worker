import { describe, it, expect } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';
import { ClashConfigBuilder } from '../src/builders/ClashConfigBuilder.js';

describe('Hysteria2 port hopping and field conversion', () => {
    it('converts hysteria2 URI with ports to sing-box server_ports (colon-separated) without conflicts or unknown fields', async () => {
        const uri = 'hysteria2://f0da7f3a-f81f-435a-a25b-3e5236388c34@pq.us6.globals-download.com:35000?sni=www.apple.com&insecure=1&ports=35000-39000&hop-interval=30#HY2-Hopping';
        const builder = new SingboxConfigBuilder(uri, 'minimal', [], null, 'zh-CN', 'test-agent');
        const config = await builder.build();

        const proxy = config.outbounds.find(o => o.tag === 'HY2-Hopping');
        expect(proxy).toBeDefined();
        expect(proxy.type).toBe('hysteria2');
        expect(proxy.server).toBe('pq.us6.globals-download.com');
        expect(proxy.server_ports).toEqual(['35000:39000']);
        expect(proxy.hop_interval).toBe('30s');
        expect(proxy.password).toBe('f0da7f3a-f81f-435a-a25b-3e5236388c34');
        expect(proxy.tls).toEqual({
            enabled: true,
            server_name: 'www.apple.com',
            insecure: true
        });

        // Must NOT leak Clash / URI fields that cause sing-box fatal errors
        expect(proxy).not.toHaveProperty('ports');
        expect(proxy).not.toHaveProperty('server_port');
        expect(proxy).not.toHaveProperty('auth');
        expect(proxy).not.toHaveProperty('fast_open');
        expect(proxy).not.toHaveProperty('recv_window_conn');
        expect(proxy).not.toHaveProperty('udp');
        expect(proxy).not.toHaveProperty('network');
    });

    it('converts Clash YAML hysteria2 node with port hopping to sing-box', async () => {
        const yamlInput = `
proxies:
  - name: HY2-Clash
    type: hysteria2
    server: hy2.example.com
    port: 35000
    ports: 35000-39000
    password: test-password
    sni: hy2.example.com
    skip-cert-verify: true
    hop-interval: 15
    up: 100 Mbps
    down: 50 Mbps
    fast-open: true
`;
        const builder = new SingboxConfigBuilder(yamlInput, 'minimal', [], null, 'zh-CN', 'test-agent');
        const config = await builder.build();

        const proxy = config.outbounds.find(o => o.tag === 'HY2-Clash');
        expect(proxy).toBeDefined();
        expect(proxy.server_ports).toEqual(['35000:39000']);
        expect(proxy.hop_interval).toBe('15s');
        expect(proxy.up_mbps).toBe(100);
        expect(proxy.down_mbps).toBe(50);
        expect(proxy).not.toHaveProperty('ports');
        expect(proxy).not.toHaveProperty('server_port');
        expect(proxy).not.toHaveProperty('up');
        expect(proxy).not.toHaveProperty('down');
        expect(proxy).not.toHaveProperty('fast_open');
    });

    it('keeps server_port for single port hysteria2 nodes without port hopping', async () => {
        const uri = 'hysteria2://password@pq.us6.globals-download.com:35000?sni=www.apple.com#HY2-SinglePort';
        const builder = new SingboxConfigBuilder(uri, 'minimal', [], null, 'zh-CN', 'test-agent');
        const config = await builder.build();

        const proxy = config.outbounds.find(o => o.tag === 'HY2-SinglePort');
        expect(proxy).toBeDefined();
        expect(proxy.server_port).toBe(35000);
        expect(proxy).not.toHaveProperty('server_ports');
        expect(proxy).not.toHaveProperty('ports');
    });

    it('normalizes multi-port and colon ranges properly for sing-box', async () => {
        const uri = 'hysteria2://password@example.com:2080?ports=2080:3000,4000#HY2-MultiPort';
        const builder = new SingboxConfigBuilder(uri, 'minimal', [], null, 'zh-CN', 'test-agent');
        const config = await builder.build();

        const proxy = config.outbounds.find(o => o.tag === 'HY2-MultiPort');
        expect(proxy).toBeDefined();
        expect(proxy.server_ports).toEqual(['2080:3000', '4000:4000']);
        expect(proxy).not.toHaveProperty('server_port');
        expect(proxy).not.toHaveProperty('ports');
    });

    it('converts sing-box JSON with server_ports to Clash YAML with ports and port', async () => {
        const singboxInput = JSON.stringify({
            outbounds: [
                {
                    type: 'hysteria2',
                    tag: 'HY2-From-Singbox',
                    server: 'hy2.example.com',
                    server_ports: ['35000:39000'],
                    password: 'test-password',
                    hop_interval: '20s',
                    up_mbps: 100,
                    down_mbps: 50,
                    tls: {
                        enabled: true,
                        server_name: 'hy2.example.com'
                    }
                }
            ]
        });

        const builder = new ClashConfigBuilder(singboxInput, 'minimal', [], null, 'zh-CN', 'test-agent');
        const yamlOutput = await builder.build();
        const yaml = await import('js-yaml');
        const config = yaml.load(yamlOutput);

        const proxy = config.proxies.find(p => p.name === 'HY2-From-Singbox');
        expect(proxy).toBeDefined();
        expect(proxy.type).toBe('hysteria2');
        expect(proxy.ports).toBe('35000:39000');
        expect(proxy.port).toBe(35000);
        expect(proxy.up).toBe('100 Mbps');
        expect(proxy.down).toBe('50 Mbps');
        expect(proxy['hop-interval']).toBe('20s');
    });
});
