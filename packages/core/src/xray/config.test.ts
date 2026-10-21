import { describe, expect, it } from 'vitest';
import type { ServerNode } from '../types';
import { buildXrayConfig } from './config';

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
});
