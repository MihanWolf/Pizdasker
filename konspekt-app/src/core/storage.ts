// Универсальный слой хранения.
//
// Если приложение открыто как артефакт внутри Claude — используется его
// window.storage (облачное key-value хранилище на аккаунт пользователя).
// Если это самостоятельный сайт/PWA — тот же интерфейс реализуется поверх
// localStorage. UI и бизнес-логика никогда не знают, в каком они окружении.

export interface StorageResult<T = string> {
  key: string;
  value: T;
  shared: boolean;
}

export interface StorageDriver {
  get(key: string, shared?: boolean): Promise<StorageResult | null>;
  set(key: string, value: string, shared?: boolean): Promise<StorageResult | null>;
  delete(key: string, shared?: boolean): Promise<{ key: string; deleted: boolean; shared: boolean } | null>;
  list(prefix?: string, shared?: boolean): Promise<{ keys: string[]; prefix?: string; shared: boolean } | null>;
}

declare global {
  interface Window {
    storage?: StorageDriver;
  }
}

const LOCAL_PREFIX = 'konspekt-app:';

function createLocalStorageDriver(): StorageDriver {
  return {
    async get(key, shared) {
      const raw = localStorage.getItem(LOCAL_PREFIX + key);
      if (raw === null) throw new Error('Key not found: ' + key);
      return { key, value: raw, shared: !!shared };
    },
    async set(key, value, shared) {
      localStorage.setItem(LOCAL_PREFIX + key, value);
      return { key, value, shared: !!shared };
    },
    async delete(key, shared) {
      localStorage.removeItem(LOCAL_PREFIX + key);
      return { key, deleted: true, shared: !!shared };
    },
    async list(prefix, shared) {
      const keys: string[] = [];
      const full = LOCAL_PREFIX + (prefix || '');
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(full)) keys.push(k.slice(LOCAL_PREFIX.length));
      }
      return { keys, prefix, shared: !!shared };
    },
  };
}

// Единая точка входа: window.storage, если приложение внутри Claude,
// иначе — localStorage-реализация с тем же контрактом.
export function getStorageDriver(): StorageDriver {
  if (typeof window !== 'undefined' && window.storage) return window.storage;
  return createLocalStorageDriver();
}

const STATE_KEY = 'study-data';

export async function loadRawState(): Promise<string | null> {
  try {
    const driver = getStorageDriver();
    const res = await driver.get(STATE_KEY, false);
    return res ? res.value : null;
  } catch {
    return null; // ключа ещё нет — это нормально при первом запуске
  }
}

export async function saveRawState(payload: string, attempts = 4): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const driver = getStorageDriver();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await driver.set(STATE_KEY, payload, false);
      return { ok: true };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  return { ok: false, error: lastErr };
}
