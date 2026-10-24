import { importBackupFile, type BackupFileImportResult } from './backup';
import { parseBackupArchive } from './backupArchive';
import type { StoredPlantPhoto } from './plantPhotoStorage';

export type PreparedBackupFile = BackupFileImportResult & {
  photos: StoredPlantPhoto[] | null;
};

export async function readBackupFile(file: File): Promise<PreparedBackupFile> {
  const isZip = file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
  if (isZip) {
    const prepared = await parseBackupArchive(new Uint8Array(await file.arrayBuffer()));
    return { ...prepared };
  }

  const prepared = importBackupFile(await file.text());
  if (prepared.state.waterings.some((entry) => entry.photoIds?.length)) {
    throw new Error('Бэкап содержит фотографии. Для их восстановления выберите ZIP-архив.');
  }
  return { ...prepared, photos: null };
}
