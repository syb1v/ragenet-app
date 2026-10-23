import { describe, expect, it } from 'vitest';
import { buildOutbound, buildPingBatchConfig, buildXrayConfig, parseSubscription } from '../src';

describe('Hysteria 2 outbound', () => {
  it('builds a QUIC/HTTP3 Hysteria 2 outbound from a share link', () => {
    const link =
      'hysteria2://secret%3Apass@fi.example.com:8443?sni=edge.example.com' +
      '&obfs=salamander&obfs-password=obfs-secret' +
      '&pinSHA256=00112233445566778899AABBCCDDEEFF00112233445566778899AABBCCDDEEFF' +
      '&up=100&down=50&mport=443-8443&udpIdleTimeout=30#%F0%9F%87%AB%F0%9F%87%AE%20Finland';
    const node = parseSubscription(link).servers[0];
    expect(node.protocol).toBe('hysteria2');

    const config = buildXrayConfig([node], { selectedServerId: node.id });
    const outbound = config.outbounds[0] as Record<string, any>;
    expect(outbound.protocol).toBe('hysteria');
    expect(outbound.settings).toMatchObject({
      version: 2,
      address: 'fi.example.com',
      port: 8443,
    });
    expect(outbound.streamSettings).toMatchObject({
      network: 'hysteria',
      security: 'tls',
      tlsSettings: {
        serverName: 'edge.example.com',
        alpn: ['h3'],
        pinnedPeerCertSha256: expect.any(String),
      },
      hysteriaSettings: {
        version: 2,
        auth: 'secret:pass',
        udpIdleTimeout: 30,
      },
      finalmask: {
        udp: [{ type: 'salamander', settings: { password: 'obfs-secret' } }],
        quicParams: {
          brutalUp: '100 mbps',
          brutalDown: '50 mbps',
          udpHop: { ports: '443-8443' },
        },
      },
    });
  });

  it('preserves the server-provided fm finalmask, including quicParams', () => {
    const fm = {
      udp: [
        {
          type: 'salamander',
          settings: { password: 'obfs-secret' },
        },
      ],
      quicParams: {
        udpHop: { ports: '20000-50000', interval: '15-30' },
        maxIdleTimeout: 60,
        keepAlivePeriod: 10,
        disablePathMTUDiscovery: false,
      },
    };
    const link =
      'hysteria2://secret@fi.example.com:443?sni=fi.example.com' +
      '&fm=' +
      encodeURIComponent(JSON.stringify(fm)) +
      '#Finland';
    const node = parseSubscription(link).servers[0];
    const outbound = buildOutbound(node) as Record<string, any>;
    expect(outbound.streamSettings.finalmask).toEqual(fm);

    const ping = buildPingBatchConfig(node);
    const pingOutbound = (JSON.parse(ping!.xrayJson) as Record<string, any>).outbounds[0];
    expect(pingOutbound.streamSettings.finalmask).toEqual(fm);
  });

  it('accepts a hy2 scheme and an auth query fallback', () => {
    const link = 'hy2://edge.example.com:443?sni=edge.example.com&auth=letmein#Finland';
    const node = parseSubscription(link).servers[0];
    const outbound = buildOutbound(node) as Record<string, any>;
    expect(outbound.protocol).toBe('hysteria');
    expect(outbound.streamSettings.hysteriaSettings.auth).toBe('letmein');
  });
});

describe('XHTTP outbound', () => {
  it('keeps advanced extra settings from a share link', () => {
    const extra = {
      headers: { 'X-Test': 'yes' },
      scMaxBufferedPosts: 32,
      scMaxEachPostBytes: '1536-6144',
      xPaddingBytes: '48-320',
      xPaddingPlacement: 'queryInHeader',
      xPaddingMethod: 'tokenish',
      seqKey: 'offset',
      seqPlacement: 'query',
      sessionIDKey: 'media_sid',
      sessionIDPlacement: 'cookie',
      uplinkDataKey: 'X-Playback-Token',
      uplinkDataPlacement: 'header',
      uplinkHTTPMethod: 'GET',
      xmux: { maxConcurrency: '4-8', hMaxRequestTimes: '600-900' },
      mode: 'packet-up',
    };
    const link =
      'vless://11111111-1111-1111-1111-111111111111@cdn.example.com:443' +
      '?type=xhttp&security=tls&sni=cdn.example.com&host=cdn.example.com&path=%2Fpoll%2F' +
      '&extra=' +
      encodeURIComponent(JSON.stringify(extra)) +
      '#XHTTP';
    const node = parseSubscription(link).servers[0];
    const outbound = buildOutbound(node) as Record<string, any>;

    expect(outbound.streamSettings.network).toBe('xhttp');
    expect(outbound.streamSettings.xhttpSettings).toMatchObject({
      host: 'cdn.example.com',
      path: '/poll/',
      mode: 'packet-up',
      extra,
    });
  });
});
