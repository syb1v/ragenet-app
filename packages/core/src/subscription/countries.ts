const REGIONAL_INDICATOR_A = 0x1f1e6;
const REGIONAL_INDICATOR_Z = 0x1f1ff;

const COUNTRY_NAMES: Record<string, string> = {
  германия: 'DE',
  germany: 'DE',
  нидерланды: 'NL',
  netherlands: 'NL',
  holland: 'NL',
  швеция: 'SE',
  sweden: 'SE',
  латвия: 'LV',
  latvia: 'LV',
  дания: 'DK',
  denmark: 'DK',
  чехия: 'CZ',
  czechia: 'CZ',
  czech: 'CZ',
  финляндия: 'FI',
  finland: 'FI',
  франция: 'FR',
  france: 'FR',
  польша: 'PL',
  poland: 'PL',
  сша: 'US',
  usa: 'US',
  'united states': 'US',
  america: 'US',
  великобритания: 'GB',
  англия: 'GB',
  uk: 'GB',
  'united kingdom': 'GB',
  britain: 'GB',
  турция: 'TR',
  turkey: 'TR',
  türkiye: 'TR',
  казахстан: 'KZ',
  kazakhstan: 'KZ',
  эстония: 'EE',
  estonia: 'EE',
  литва: 'LT',
  lithuania: 'LT',
  австрия: 'AT',
  austria: 'AT',
  швейцария: 'CH',
  switzerland: 'CH',
  испания: 'ES',
  spain: 'ES',
  италия: 'IT',
  italy: 'IT',
  румыния: 'RO',
  romania: 'RO',
  болгария: 'BG',
  bulgaria: 'BG',
  сербия: 'RS',
  serbia: 'RS',
  украина: 'UA',
  ukraine: 'UA',
  молдова: 'MD',
  moldova: 'MD',
  армения: 'AM',
  armenia: 'AM',
  грузия: 'GE',
  georgia: 'GE',
  израиль: 'IL',
  israel: 'IL',
  оаэ: 'AE',
  uae: 'AE',
  emirates: 'AE',
  индия: 'IN',
  india: 'IN',
  япония: 'JP',
  japan: 'JP',
  сингапур: 'SG',
  singapore: 'SG',
  гонконг: 'HK',
  hongkong: 'HK',
  'hong kong': 'HK',
  корея: 'KR',
  korea: 'KR',
  канада: 'CA',
  canada: 'CA',
  бразилия: 'BR',
  brazil: 'BR',
  австралия: 'AU',
  australia: 'AU',
  европа: 'EU',
  europe: 'EU',
  евросоюз: 'EU',
  'нидерланды ': 'NL',
};

/** Convert a flag emoji (two regional indicators) to an ISO country code. */
export function countryCodeFromFlag(flag: string | undefined): string | undefined {
  if (!flag) return undefined;
  const chars = Array.from(flag);
  if (chars.length !== 2) return undefined;
  const points = chars.map((char) => char.codePointAt(0) ?? 0);
  if (points.some((point) => point < REGIONAL_INDICATOR_A || point > REGIONAL_INDICATOR_Z)) {
    return undefined;
  }
  return points.map((point) => String.fromCharCode(point - REGIONAL_INDICATOR_A + 65)).join('');
}

/** Find a flag emoji in a server remark, e.g. "🇩🇪 Германия | Reality". */
export function extractFlagEmoji(value: string): string | undefined {
  const chars = Array.from(value);
  for (let index = 0; index < chars.length - 1; index += 1) {
    const point = chars[index].codePointAt(0) ?? 0;
    if (point < REGIONAL_INDICATOR_A || point > REGIONAL_INDICATOR_Z) continue;
    const candidate = chars[index] + chars[index + 1];
    if (countryCodeFromFlag(candidate)) return candidate;
  }
  return undefined;
}

export function countryCodeFromName(name: string): string | undefined {
  const normalized = name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[|•·—–-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return undefined;
  for (const [country, code] of Object.entries(COUNTRY_NAMES)) {
    if (normalized.includes(country)) return code;
  }
  return undefined;
}

export function flagForCountryCode(code: string | undefined): string {
  if (!code || code.length !== 2) return '🌐';
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    REGIONAL_INDICATOR_A + upper.charCodeAt(0) - 65,
    REGIONAL_INDICATOR_A + upper.charCodeAt(1) - 65,
  );
}
