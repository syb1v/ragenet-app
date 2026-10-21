import type { DeviceInfo } from '../device';
import { subscriptionHeaders } from '../device';
import type { ParsedSubscription } from '../types';
import { parseSubscription, type HeaderMap } from './parse';

export interface FetchSubscriptionOptions {
  device: DeviceInfo;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Injectable for tests and for providers that need custom headers. */
  fetchImpl?: typeof fetch;
}

export interface SubscriptionFetchResult {
  parsed: ParsedSubscription;
  headers: HeaderMap;
  body: string;
}

function headersToObject(headers: Headers): HeaderMap {
  const result: HeaderMap = {};
  headers.forEach((value, key) => {
    result[key.toLowerCase()] = value;
  });
  return result;
}

export class SubscriptionFetchError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'SubscriptionFetchError';
    this.status = status;
  }
}

export async function fetchSubscription(
  url: string,
  options: FetchSubscriptionOptions,
): Promise<SubscriptionFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: subscriptionHeaders(options.device),
      signal: controller.signal,
      redirect: 'follow',
    });

    if (!response.ok) {
      const message =
        response.status === 404 || response.status === 410
          ? 'Подписка не найдена или удалена'
          : response.status === 429
            ? 'Слишком много запросов. Попробуйте позже'
            : `Сервер вернул ошибку ${response.status}`;
      throw new SubscriptionFetchError(message, response.status);
    }

    const body = await response.text();
    const headers = headersToObject(response.headers);
    const parsed = parseSubscription(body, headers);
    if (parsed.servers.length === 0) {
      throw new SubscriptionFetchError('В подписке не найдено ни одного сервера');
    }

    return { parsed, headers, body };
  } catch (error) {
    if (error instanceof SubscriptionFetchError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SubscriptionFetchError('Превышено время ожидания ответа');
    }
    throw new SubscriptionFetchError(
      'Не удалось загрузить подписку. Проверьте ссылку и подключение к интернету',
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
