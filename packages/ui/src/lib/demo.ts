import { parseSubscription, subscriptionFromParsed, type Subscription } from '@ragenet/core';

const DEMO_LINKS = [
  'vless://11111111-1111-1111-1111-111111111111@de.ragenet.demo:443?security=reality&sni=www.microsoft.com&fp=chrome&pbk=Z84J2x7m9K2w1s3n5p7q9r2t4v6x8z1&sid=6ba85179e30d4fc2&type=tcp&flow=xtls-rprx-vision#%F0%9F%87%A9%F0%9F%87%AA%20Германия',
  'vless://22222222-2222-2222-2222-222222222222@nl.ragenet.demo:443?security=tls&sni=nl.ragenet.demo&fp=chrome&type=ws&path=%2Fws&host=nl.ragenet.demo#%F0%9F%87%B3%F0%9F%87%B1%20Нидерланды',
  'trojan://demo-password@se.ragenet.demo:443?security=tls&sni=se.ragenet.demo#%F0%9F%87%B8%F0%9F%87%AA%20Швеция',
  'ss://YWVzLTI1Ni1nY206ZGVtby1wYXNz@lv.ragenet.demo:8388#%F0%9F%87%B1%F0%9F%87%BB%20Латвия',
  'vless://33333333-3333-3333-3333-333333333333@fi.ragenet.demo:443?security=reality&sni=www.apple.com&fp=safari&pbk=Q92L3y8n1M3x2t4v6x8z1a3c5e7g9j2&sid=9f2c4a71d8e35b60&type=grpc&serviceName=grpc#%F0%9F%87%AB%F0%9F%87%AE%20Финляндия',
];

const DEMO_TITLE = 'RageNet VPN';
const GB = 1024 ** 3;

export function createDemoSubscription(): Subscription {
  const expiresAt = Math.floor(Date.now() / 1000) + 34 * 24 * 60 * 60;
  const parsed = parseSubscription(DEMO_LINKS.join('\n'), {
    'profile-title': DEMO_TITLE,
    'support-url': 'https://t.me/ragenetsupp_bot',
    'profile-update-interval': '6',
    'subscription-userinfo': `upload=${Math.round(0.4 * GB)}; download=${Math.round(12.4 * GB)}; total=${100 * GB}; expire=${expiresAt}`,
  });

  const subscription = subscriptionFromParsed('demo', 'demo://ragenet', parsed);
  return {
    ...subscription,
    meta: {
      ...subscription.meta,
      title: DEMO_TITLE,
      supportUrl: 'https://t.me/ragenetsupp_bot',
      webPageUrl: 'https://ragenet.example',
      updateIntervalHours: 6,
      totalBytes: 100 * GB,
      downloadBytes: Math.round(12.4 * GB),
      uploadBytes: Math.round(0.4 * GB),
      expiresAt,
    },
    updatedAt: Date.now(),
  };
}

export const DEMO_SUPPORT_URL = 'https://t.me/ragenetsupp_bot';
