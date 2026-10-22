import { describe, expect, it } from 'vitest';
import type { ServerNode } from '../types';
import { buildXrayConfig, LATENCY_PROBE_DOMAIN, sanitizeFullConfig } from './config';

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
});
