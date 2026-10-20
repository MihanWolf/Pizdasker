export interface StoredPlantPhoto {
  id: string;
  blob: Blob;
}

const DATABASE_NAME = 'pizdasker-media';
const DATABASE_VERSION = 1;
const PHOTO_STORE = 'plant-photos';

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('Локальное хранилище фотографий недоступно в этом браузере.'));
  }
  if (databasePromise) return databasePromise;

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PHOTO_STORE)) {
        request.result.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Не удалось открыть хранилище фотографий.'));
    request.onblocked = () => reject(new Error('Хранилище фотографий занято другой вкладкой.'));
  });
  const cached = opening.catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = cached;
  return cached;
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error('Не удалось сохранить фотографии.'));
    transaction.onabort = () => reject(transaction.error ?? new Error('Сохранение фотографий было отменено.'));
  });
}

export async function storePlantPhotos(photos: StoredPlantPhoto[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(PHOTO_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(PHOTO_STORE);
  for (const photo of photos) store.put(photo);
  await completed;
}

export async function getPlantPhoto(id: string): Promise<Blob | null> {
  const db = await openDatabase();
  const transaction = db.transaction(PHOTO_STORE, 'readonly');
  const request = transaction.objectStore(PHOTO_STORE).get(id) as IDBRequest<StoredPlantPhoto | undefined>;
  const [photo] = await Promise.all([
    new Promise<StoredPlantPhoto | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Не удалось загрузить фотографию.'));
    }),
    transactionComplete(transaction),
  ]);
  return photo?.blob ?? null;
}

export async function deletePlantPhotos(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const db = await openDatabase();
  const transaction = db.transaction(PHOTO_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(PHOTO_STORE);
  for (const id of ids) store.delete(id);
  await completed;
}

export async function replacePlantPhotos(photos: StoredPlantPhoto[]): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(PHOTO_STORE, 'readwrite');
  const completed = transactionComplete(transaction);
  const store = transaction.objectStore(PHOTO_STORE);
  store.clear();
  for (const photo of photos) store.put(photo);
  await completed;
}

export async function clearPlantPhotos(): Promise<void> {
  await replacePlantPhotos([]);
}
