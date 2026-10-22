import { describe, expect, it } from 'vitest';
import {
  buildXrayConfig,
  countryCodeFromFlag,
  decodeBase64,
  extractFlagEmoji,
  parseSubscription,
  parseUserInfo,
  sanitizeFullConfig,
} from '../src';

const vless =
  'vless://11111111-1111-1111-1111-111111111111@de.example.com:443?security=reality&sni=www.microsoft.com&fp=chrome&pbk=abc&sid=1234&type=tcp&flow=xtls-rprx-vision#%F0%9F%87%A9%F0%9F%87%AA%20Германия';
const trojan =
  'trojan://secret@nl.example.com:443?security=tls&sni=nl.example.com#%F0%9F%87%B3%F0%9F%87%B1%20Нидерланды';
const shadowsocks =
  'ss://YWVzLTI1Ni1nY206cGFzcw==@se.example.com:8388#%F0%9F%87%B8%F0%9F%87%AA%20Швеция';
const vmess = `vmess://${btoa(
  unescape(
    encodeURIComponent(
      JSON.stringify({
        v: '2',
        ps: '🇫🇮 Финляндия',
        add: 'fi.example.com',
        port: '443',
        id: '22222222-2222-2222-2222-222222222222',
        aid: '0',
        scy: 'auto',
        net: 'ws',
        type: 'none',
        host: 'fi.example.com',
        path: '/ws',
        tls: 'tls',
        sni: 'fi.example.com',
      }),
    ),
  ),
)}`;

function encoded(body: string): string {
  return btoa(unescape(encodeURIComponent(body)));
}

describe('base64', () => {
  it('decodes URL-safe base64 with missing padding', () => {
    expect(decodeBase64(encoded('vless://one'))).toBe('vless://one');
  });
});

describe('country flags', () => {
  it('extracts a flag and converts it to an ISO code', () => {
    const flag = extractFlagEmoji('🇩🇪 Германия');
    expect(flag).toBe('🇩🇪');
    expect(countryCodeFromFlag(flag)).toBe('DE');
  });
});

describe('subscription parser', () => {
  it('parses base64 links and HTTP metadata', () => {
    const body = encoded([vless, trojan, shadowsocks, vmess].join('\n'));
    const parsed = parseSubscription(body, {
      'content-type': 'text/plain',
      'profile-title': encoded('RageNet Test'),
      'subscription-userinfo':
        'upload=1048576; download=133169152; total=107374182400; expire=1794960000',
      'support-url': 'https://t.me/ragenet_support',
      'profile-update-interval': '12',
    });

    expect(parsed.meta.title).toBe('RageNet Test');
    expect(parsed.meta.totalBytes).toBe(107374182400);
    expect(parsed.meta.expiresAt).toBe(1794960000);
    expect(parsed.meta.supportUrl).toBe('https://t.me/ragenet_support');
    expect(parsed.meta.updateIntervalHours).toBe(12);
    expect(parsed.servers).toHaveLength(4);
    expect(parsed.servers[0].protocol).toBe('vless');
    expect(parsed.servers[0].transport).toBe('tcp');
    expect(parsed.servers[0].security).toBe('reality');
    expect(parsed.servers[0].countryCode).toBe('DE');
    expect(parsed.servers[1].protocol).toBe('trojan');
    expect(parsed.servers[2].protocol).toBe('shadowsocks');
    expect(parsed.servers[2].name).toBe('🇸🇪 Швеция');
    expect(parsed.servers[2].countryCode).toBe('SE');
    expect(parsed.servers[3].protocol).toBe('vmess');
    expect(parsed.servers[3].transport).toBe('ws');
  });

  it('parses body metadata and plain links', () => {
    const parsed = parseSubscription(
      `#profile-title: RageNet\n#support-url: https://example.com/help\n${vless}\n${trojan}`,
    );
    expect(parsed.meta.title).toBe('RageNet');
    expect(parsed.meta.supportUrl).toBe('https://example.com/help');
    expect(parsed.servers).toHaveLength(2);
  });

  it('uses a full config remarks as the location name', () => {
    const parsed = parseSubscription(
      JSON.stringify({
        remarks: '🇫🇮 Финляндия | Все операторы',
        meta: { serverDescription: 'Fallback description' },
        inbounds: [],
        outbounds: [
          {
            tag: 'proxy',
            protocol: 'vless',
            settings: { vnext: [{ address: 'fi.example.com', port: 443, users: [] }] },
          },
        ],
      }),
    );
    expect(parsed.servers[0]).toMatchObject({
      name: '🇫🇮 Финляндия | Все операторы',
      countryCode: 'FI',
    });
  });

  it('reads the endpoint from a full Hysteria 2 config', () => {
    const parsed = parseSubscription(
      JSON.stringify({
        inbounds: [],
        outbounds: [
          {
            tag: 'hy2',
            protocol: 'hysteria',
            settings: { version: 2, address: 'hy.example.com', port: 8443 },
            streamSettings: { network: 'hysteria' },
          },
        ],
      }),
    );
    expect(parsed.servers[0]).toMatchObject({
      protocol: 'hysteria2',
      host: 'hy.example.com',
      port: 8443,
    });
  });

  it('cuts a complete Xray config into a single server', () => {
    const parsed = parseSubscription(
      JSON.stringify({
        inbounds: [{ port: 10808, protocol: 'socks', settings: {} }],
        outbounds: [
          {
            tag: '🇩🇪 Germany',
            protocol: 'vless',
            settings: {
              vnext: [
                {
                  address: 'de.example.com',
                  port: 443,
                  users: [{ id: '11111111-1111-1111-1111-111111111111' }],
                },
              ],
            },
          },
        ],
      }),
    );
    expect(parsed.isFullConfig).toBe(true);
    expect(parsed.servers).toHaveLength(1);
    expect(parsed.servers[0].fullConfig).toBeTruthy();
  });
});

describe('user info', () => {
  it('normalises milliseconds to seconds and keeps byte counters', () => {
    const info = parseUserInfo('upload=1; download=2; total=3; expire=1794960000000');
    expect(info).toMatchObject({
      uploadBytes: 1,
      downloadBytes: 2,
      totalBytes: 3,
      expiresAt: 1794960000,
    });
  });
});

describe('xray config', () => {
  const servers = parseSubscription(`${vless}\n${trojan}`).servers;

  it('builds a safe TUN config with stats and selected outbound', () => {
    const config = buildXrayConfig(servers, {
      selectedServerId: servers[0].id,
      routingMode: 'global',
    });

    expect(config.inbounds[0]).toMatchObject({
      tag: 'tun',
      protocol: 'tun',
      settings: { name: 'ragenet0', mtu: 1500 },
    });
    expect(config.inbounds.some((inbound) => inbound.tag === 'api')).toBe(true);
    expect(config.outbounds[0]).toMatchObject({ protocol: 'vless', tag: servers[0].id });
    expect(config.routing).toMatchObject({ domainStrategy: 'IPIfNonMatch' });
    expect(config.api).toMatchObject({ tag: 'api' });
  });

  it('adds direct rules for bypass-local', () => {
    const config = buildXrayConfig(servers, {
      selectedServerId: servers[0].id,
      routingMode: 'bypass-local',
    });
    expect(
      (config.routing as { rules: Array<Record<string, unknown>> }).rules.some(
        (rule) => rule.outboundTag === 'direct',
      ),
    ).toBe(true);
  });

  it('hardens public inbounds in a full config', () => {
    const config = sanitizeFullConfig(
      {
        inbounds: [
          { tag: 'public', listen: '0.0.0.0', port: 10808, protocol: 'socks', settings: {} },
        ],
        outbounds: [{ tag: 'proxy', protocol: 'freedom', settings: {} }],
      },
      { selectedServerId: 'x' },
    );

    const socks = config.inbounds.find((inbound) => inbound.tag === 'public');
    expect(socks).toMatchObject({ listen: '127.0.0.1' });
    expect(config.inbounds.some((inbound) => inbound.protocol === 'tun')).toBe(true);
  });
});
