export interface DeviceInfo {
  hwid: string;
  os: 'Android' | 'iOS' | 'Windows' | 'macOS' | 'Linux' | 'Web';
  osVersion: string;
  model: string;
  appVersion: string;
}

export function generateHwid(): string {
  const cryptoObject = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;
  if (cryptoObject?.randomUUID) return cryptoObject.randomUUID().toUpperCase();

  const bytes = new Uint8Array(16);
  if (cryptoObject?.getRandomValues) {
    cryptoObject.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version 4 bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)]
    .join('-')
    .toUpperCase();
}

export function shortHwid(hwid: string): string {
  return hwid.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export function subscriptionHeaders(device: DeviceInfo): Record<string, string> {
  return {
    'User-Agent': `RageNet/${device.appVersion} (${device.os}; ${device.osVersion})`,
    Accept: '*/*',
    'x-client': 'RageNet',
    'x-hwid': device.hwid,
    'x-device-os': device.os,
    'x-ver-os': device.osVersion,
    'x-device-model': device.model,
  };
}
