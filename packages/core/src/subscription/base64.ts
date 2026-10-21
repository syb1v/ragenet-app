const BASE64_RE = /^[A-Za-z0-9+/_=\-\s]+$/;

/** Decode standard and URL-safe base64 without relying on Node's Buffer. */
export function decodeBase64(value: string): string {
  const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }

  // Hermes has atob in modern RN, but keep a tiny fallback for older runtimes.
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const char of padded.replace(/=+$/, '')) {
    const index = chars.indexOf(char);
    if (index < 0) continue;
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  try {
    return decodeURIComponent(escape(output));
  } catch {
    return output;
  }
}

/** Decode a value that may be plain text, base64, or base64 with the `base64:` prefix. */
export function maybeDecodeBase64(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('base64:')) {
    return decodeBase64(trimmed.slice(7));
  }
  if (trimmed.length < 8 || !BASE64_RE.test(trimmed)) return trimmed;

  try {
    const decoded = decodeBase64(trimmed);
    // Only accept the decoded value if it looks like text or a share link.
    if (/^[\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]+$/.test(decoded) && decoded.length > 0) {
      return decoded;
    }
  } catch {
    // Not base64 — fall through to the original value.
  }
  return trimmed;
}

export function isProbablyBase64(value: string): boolean {
  const trimmed = value.trim().replace(/\s+/g, '');
  if (trimmed.length < 16 || trimmed.length % 4 !== 0) return false;
  return BASE64_RE.test(trimmed) && !trimmed.includes('://');
}
