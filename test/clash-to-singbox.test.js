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

    it('keeps converted proxies without leaking unused Clash groups or fields', async () => {
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

        expect(customGroup).toBeUndefined();

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

    it('converts Shadowsocks plugin options to sing-box SIP003 strings', async () => {
        const input = `
proxies:
  - name: Obfs-Node
    type: ss
    server: obfs.example.com
    port: 443
    cipher: aes-128-gcm
    password: test
    plugin: obfs
    plugin-opts:
      mode: http
      host: cdn.example.com
  - name: V2Ray-Node
    type: ss
    server: v2ray.example.com
    port: 443
    cipher: chacha20-ietf-poly1305
    password: test
    plugin: v2ray-plugin
    plugin-opts:
      mode: websocket
      tls: true
      host: cdn.example.com
      path: /ws
`;
        const builder = new SingboxConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'test-agent');

        const config = await builder.build();
        const obfsProxy = config.outbounds.find(outbound => outbound.tag === 'Obfs-Node');
        const v2rayProxy = config.outbounds.find(outbound => outbound.tag === 'V2Ray-Node');

        expect(obfsProxy).toMatchObject({
            plugin: 'obfs-local',
            plugin_opts: 'obfs=http;obfs-host=cdn.example.com'
        });
        expect(v2rayProxy).toMatchObject({
            plugin: 'v2ray-plugin',
            plugin_opts: 'mode=websocket;tls;host=cdn.example.com;path=/ws'
        });
    });

    it('preserves native sing-box SIP003 plugin strings', async () => {
        const input = JSON.stringify({
            outbounds: [
                {
                    type: 'shadowsocks',
                    tag: 'Native-Plugin',
                    server: 'proxy.example.com',
                    server_port: 443,
                    method: 'aes-128-gcm',
                    password: 'test',
                    plugin: 'obfs-local',
                    plugin_opts: 'obfs=tls;obfs-host=cdn.example.com'
                }
            ]
        });
        const builder = new SingboxConfigBuilder(input, 'minimal', [], null, 'zh-CN', 'test-agent');

        const config = await builder.build();
        const proxy = config.outbounds.find(outbound => outbound.tag === 'Native-Plugin');

        expect(proxy.plugin).toBe('obfs-local');
        expect(proxy.plugin_opts).toBe('obfs=tls;obfs-host=cdn.example.com');
    });
});
