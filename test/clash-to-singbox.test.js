import { describe, expect, it } from 'vitest';
import { SingboxConfigBuilder } from '../src/builders/SingboxConfigBuilder.js';

describe('Clash to sing-box conversion', () => {
    const clashConfig = `
port: 7890
socks-port: 7891
allow-lan: false
mode: Rule
log-level: info
external-controller: 127.0.0.1:9090
unified-delay: true
hosts:
  time.example.com: 192.0.2.1
dns:
  enable: true
  use-hosts: true
  nameserver:
    - 1.1.1.1
proxies:
  - name: Test-Node
    type: ss
    server: proxy.example.com
    port: 443
    cipher: aes-128-gcm
    password: test
    udp: true
proxy-groups:
  - name: Custom-Group
    type: select
    proxies:
      - Test-Node
      - DIRECT
`;

    it('keeps converted proxies and groups without leaking Clash fields', async () => {
        const builder = new SingboxConfigBuilder(
            clashConfig,
            'minimal',
            [],
            null,
            'zh-CN',
            'test-agent',
            false,
            false,
            undefined,
            undefined,
            '1.13'
        );

        const config = await builder.build();
        const proxy = config.outbounds.find(outbound => outbound.tag === 'Test-Node');
        const customGroup = config.outbounds.find(outbound => outbound.tag === 'Custom-Group');

        expect(proxy).toMatchObject({
            type: 'shadowsocks',
            server: 'proxy.example.com',
            server_port: 443,
            method: 'aes-128-gcm',
            password: 'test'
        });
        expect(proxy).not.toHaveProperty('port');
        expect(proxy).not.toHaveProperty('udp');

        expect(customGroup).toMatchObject({
            type: 'selector',
            outbounds: ['Test-Node', 'DIRECT']
        });

        for (const field of [
            'port',
            'socks-port',
            'allow-lan',
            'mode',
            'log-level',
            'external-controller',
            'unified-delay',
            'hosts'
        ]) {
            expect(config).not.toHaveProperty(field);
        }

        expect(config.dns).not.toHaveProperty('enable');
        expect(config.dns).not.toHaveProperty('use-hosts');
        expect(config.dns).not.toHaveProperty('nameserver');
    });

    it('still applies native sing-box config overrides', async () => {
        const input = JSON.stringify({
            outbounds: [
                {
                    type: 'shadowsocks',
                    tag: 'Native-Node',
                    server: 'proxy.example.com',
                    server_port: 443,
                    method: 'aes-128-gcm',
                    password: 'test'
                }
            ],
            log: {
                level: 'debug'
            }
        });
        const builder = new SingboxConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'test-agent');

        const config = await builder.build();

        expect(config.log).toEqual({ level: 'debug' });
    });
});
