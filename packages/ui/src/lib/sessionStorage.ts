import type { Subscription } from '@ragenet/core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_KEY = 'ragenet.session.v1';
const META_KEY = 'ragenet_session_meta';
const CHUNK_PREFIX = 'ragenet_session_chunk_';
const CHUNK_BYTES = 1500;

export interface PersistedSession {
  subscription: Subscription;
  selectedServerId: string | null;
}

interface ChunkMeta {
  generation: string;
  count: number;
}

let writeQueue: Promise<void> = Promise.resolve();

function webStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

async function readItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webStorage()?.getItem(key) ?? null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Best effort.
  }
}

function utf8Length(value: string): number {
  let bytes = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

function splitUtf8(value: string, maxBytes: number): string[] {
  const chunks: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const char of value) {
    const bytes = utf8Length(char);
    if (current && currentBytes + bytes > maxBytes) {
      chunks.push(current);
      current = '';
      currentBytes = 0;
    }
    current += char;
    currentBytes += bytes;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function readMeta(): Promise<ChunkMeta | null> {
  const raw = await readItem(META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ChunkMeta>;
    if (
      typeof parsed.generation !== 'string' ||
      typeof parsed.count !== 'number' ||
      !Number.isInteger(parsed.count)
    ) {
      return null;
    }
    return { generation: parsed.generation, count: parsed.count };
  } catch {
    return null;
  }
}

async function deleteGeneration(meta: ChunkMeta): Promise<void> {
  for (let index = 0; index < meta.count; index += 1) {
    await deleteItem(`${CHUNK_PREFIX}${meta.generation}_${index}`);
  }
}

function normalizeSession(session: PersistedSession): PersistedSession {
  const servers = session.subscription.servers.map(
    ({ latencyMs: _latencyMs, ...server }) => server,
  );
  const selectedServerId =
    servers.find((server) => server.id === session.selectedServerId)?.id ?? servers[0]?.id ?? null;
  return {
    subscription: { ...session.subscription, servers },
    selectedServerId,
  };
}

export async function loadSession(): Promise<PersistedSession | null> {
  const rawOnWeb = Platform.OS === 'web' ? await readItem(SESSION_KEY) : null;
  if (Platform.OS === 'web' || rawOnWeb) {
    if (!rawOnWeb) return null;
    try {
      return normalizeSession(JSON.parse(rawOnWeb) as PersistedSession);
    } catch {
      await deleteItem(SESSION_KEY);
      return null;
    }
  }

  const meta = await readMeta();
  if (!meta) return null;
  const parts: string[] = [];
  for (let index = 0; index < meta.count; index += 1) {
    const part = await readItem(`${CHUNK_PREFIX}${meta.generation}_${index}`);
    if (part == null) {
      await clearSession();
      return null;
    }
    parts.push(part);
  }
  try {
    return normalizeSession(JSON.parse(parts.join('')) as PersistedSession);
  } catch {
    await clearSession();
    return null;
  }
}

async function saveSessionNow(session: PersistedSession): Promise<void> {
  const normalized = normalizeSession(session);
  const serialized = JSON.stringify(normalized);

  if (Platform.OS === 'web') {
    await writeItem(SESSION_KEY, serialized);
    return;
  }

  const previous = await readMeta();
  const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const chunks = splitUtf8(serialized, CHUNK_BYTES);
  for (let index = 0; index < chunks.length; index += 1) {
    await writeItem(`${CHUNK_PREFIX}${generation}_${index}`, chunks[index]);
  }
  await writeItem(
    META_KEY,
    JSON.stringify({ generation, count: chunks.length } satisfies ChunkMeta),
  );
  if (previous) await deleteGeneration(previous);
}

async function clearSessionNow(): Promise<void> {
  await deleteItem(SESSION_KEY);
  const meta = await readMeta();
  await deleteItem(META_KEY);
  if (meta) await deleteGeneration(meta);
}

export function saveSession(session: PersistedSession): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(() => saveSessionNow(session));
  return writeQueue;
}

export function clearSession(): Promise<void> {
  writeQueue = writeQueue.catch(() => undefined).then(clearSessionNow);
  return writeQueue;
}
