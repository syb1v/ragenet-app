import { describe, expect, it } from 'vitest';
import type { ServerNode } from '../types';
import {
  buildPingBatchConfig,
  buildXrayConfig,
  LATENCY_PROBE_DOMAIN,
  sanitizeFullConfig,
} from './config';

const server: ServerNode = {
  id: 's1',
  name: 'Test',
  protocol: 'vless',
  host: 'example.com',
  port: 443,
  rawLink: 'vless://00000000-0000-0000-0000-000000000000@example.com:443?security=tls',
};

describe('buildXrayConfig', () => {
  it('does not depend on geoip/geosite assets for mobile routing', () => {
    const config = buildXrayConfig([server], {
      selectedServerId: server.id,
      routingMode: 'bypass-ru',
    });
    const routing = JSON.stringify(config.routing);

    expect(routing).not.toContain('geoip:');
    expect(routing).not.toContain('geosite:');
  });

  it('forces the latency probe through the selected proxy', () => {
    const config = buildXrayConfig([server], {
      selectedServerId: server.id,
      routingMode: 'bypass-ru',
    });
    const rules = (config.routing as { rules?: Array<Record<string, unknown>> }).rules ?? [];

    expect(rules[0]).toMatchObject({ inboundTag: ['api'] });
    expect(rules[1]).toMatchObject({
      domain: [`domain:${LATENCY_PROBE_DOMAIN}`],
      outboundTag: server.id,
    });
  });

  it('keeps the latency probe proxied in a full custom config', () => {
    const config = sanitizeFullConfig(
      {
        inbounds: [
          { tag: 'socks', protocol: 'socks', listen: '0.0.0.0', port: 1080 },
          { tag: 'tun', protocol: 'tun', sniffing: { enabled: false } },
        ],
        outbounds: [
          { tag: 'custom-proxy', protocol: 'vless', settings: {} },
          { tag: 'direct', protocol: 'freedom', settings: {} },
        ],
        routing: {
          rules: [{ type: 'field', domain: ['geosite:google'], outboundTag: 'direct' }],
        },
      },
      { selectedServerId: server.id },
    );
    const rules = (config.routing as { rules?: Array<Record<string, unknown>> }).rules ?? [];

    expect(rules[0]).toMatchObject({
      domain: [`domain:${LATENCY_PROBE_DOMAIN}`],
      outboundTag: 'custom-proxy',
    });
    const tun = config.inbounds.find((inbound) => inbound.protocol === 'tun');
    expect(tun?.sniffing).toMatchObject({ enabled: true });
  });

  it('preserves advanced XHTTP settings in a full config', () => {
    const extra = {
      headers: { Accept: '*/*' },
      xPaddingBytes: '48-320',
      xPaddingPlacement: 'queryInHeader',
      xmux: { maxConcurrency: '4-8' },
    };
    const config = sanitizeFullConfig(
      {
        inbounds: [{ tag: 'socks', protocol: 'socks', listen: '127.0.0.1', port: 1080 }],
        outbounds: [
          {
            tag: 'proxy',
            protocol: 'vless',
            settings: {},
            streamSettings: {
              network: 'xhttp',
              security: 'tls',
              xhttpSettings: {
                host: 'cdn.example.com',
                path: '/poll/',
                mode: 'packet-up',
                extra,
              },
            },
          },
        ],
        routing: { rules: [{ type: 'field', network: 'tcp,udp', outboundTag: 'proxy' }] },
      },
      { selectedServerId: server.id },
    );
    const outbound = config.outbounds[0] as {
      streamSettings?: { xhttpSettings?: { extra?: unknown } };
    };

    expect(outbound.streamSettings?.xhttpSettings?.extra).toEqual(extra);
  });

  it('builds an isolated pingBatch config and target tag', () => {
    const ping = buildPingBatchConfig(server);
    expect(ping?.outboundTag).toBe(server.id);
    expect(JSON.parse(ping!.xrayJson).outbounds[0]).toMatchObject({
      tag: server.id,
      protocol: 'vless',
    });
  });

  it('uses the proxy tag from a full pingBatch config', () => {
    const ping = buildPingBatchConfig({
      ...server,
      fullConfig: JSON.stringify({
        inbounds: [],
        outbounds: [
          { tag: 'custom-proxy', protocol: 'vless', settings: {} },
          { tag: 'direct', protocol: 'freedom', settings: {} },
        ],
      }),
    });
    expect(ping).toMatchObject({ outboundTag: 'custom-proxy' });
  });

  it('inserts the TUN fallback before a catch-all direct rule', () => {
    const config = sanitizeFullConfig(
      {
        inbounds: [{ tag: 'socks', protocol: 'socks', listen: '0.0.0.0', port: 1080 }],
        outbounds: [
          { tag: 'custom-proxy', protocol: 'vless', settings: {} },
          { tag: 'direct', protocol: 'freedom', settings: {} },
        ],
        routing: {
          rules: [
            { type: 'field', port: 53, outboundTag: 'direct' },
            { type: 'field', network: 'tcp,udp', outboundTag: 'direct' },
          ],
        },
      },
      { selectedServerId: server.id },
    );
    const rules = (config.routing as { rules?: Array<Record<string, unknown>> }).rules ?? [];
    const tunIndex = rules.findIndex(
      (rule) => Array.isArray(rule.inboundTag) && rule.inboundTag.includes('tun'),
    );
    const catchAllIndex = rules.findIndex(
      (rule) => rule.network === 'tcp,udp' && rule.outboundTag === 'direct',
    );

    expect(tunIndex).toBeGreaterThanOrEqual(0);
    expect(catchAllIndex).toBeGreaterThan(tunIndex);
    expect(rules[tunIndex]).toMatchObject({ outboundTag: 'custom-proxy' });
  });
});
