import { strToU8, unzipSync, zipSync } from 'fflate';
import type { AppState } from './types';
import { getPlantPhoto, type StoredPlantPhoto } from './plantPhotoStorage';
import { exportBackup, importBackup, type ImportResult } from './backup';

const BACKUP_FILE = 'konspekt-backup.json';
const PHOTO_PATH = /^photos\/([a-zA-Z0-9_-]+)\.(webp|png|jpe?g|gif|avif)$/i;
const PHOTO_TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
};

function photoExtension(blob: Blob): string {
  const subtype = blob.type.split('/')[1]?.toLowerCase();
  if (subtype === 'jpeg') return 'jpg';
  if (subtype && ['webp', 'png', 'jpg', 'gif', 'avif'].includes(subtype)) return subtype;
  return 'webp';
}

export async function exportBackupArchive(state: AppState): Promise<Uint8Array> {
  const referencedIds = Array.from(new Set(state.waterings.flatMap((entry) => entry.photoIds ?? [])));
  const archive: Record<string, Uint8Array> = {
    [BACKUP_FILE]: strToU8(exportBackup(state)),
  };

  for (const id of referencedIds) {
    const blob = await getPlantPhoto(id);
    if (!blob) throw new Error(`Не найдена фотография ${id}; экспорт бэкапа остановлен.`);
    archive[`photos/${id}.${photoExtension(blob)}`] = new Uint8Array(await blob.arrayBuffer());
  }
  return zipSync(archive, { level: 6 });
}

export async function parseBackupArchive(bytes: Uint8Array): Promise<ImportResult & { photos: StoredPlantPhoto[] }> {
  const files = unzipSync(bytes);
  const backupData = files[BACKUP_FILE];
  if (!backupData) throw new Error('В ZIP-архиве нет файла резервной копии.');

  const imported = importBackup(new TextDecoder().decode(backupData));
  const photos: StoredPlantPhoto[] = [];
  const photoIds = new Set<string>();
  for (const [path, data] of Object.entries(files)) {
    const match = PHOTO_PATH.exec(path);
    if (!match) continue;
    const id = match[1];
    if (photoIds.has(id)) throw new Error(`В архиве несколько фотографий с идентификатором ${id}.`);
    photoIds.add(id);
    const extension = match[2].toLowerCase();
    photos.push({ id, blob: new Blob([data.slice().buffer], { type: PHOTO_TYPES[extension] }) });
  }

  const referencedIds = new Set(imported.state.waterings.flatMap((entry) => entry.photoIds ?? []));
  const missing = Array.from(referencedIds).filter((id) => !photoIds.has(id));
  if (missing.length) throw new Error(`В ZIP-архиве отсутствуют ${missing.length} фото из журнала.`);

  return { ...imported, photos };
}
